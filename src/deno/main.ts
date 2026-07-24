// Deno-desktop entrypoint. `deno desktop src/deno/main.ts` (Deno 2.9+) opens a native
// window pointed at this in-process HTTP server. `deno task serve` runs it headless
// (open http://localhost:8790 in a browser).
import { APP_ROOT, HOST, PORT, WINDOW_FILE } from "./config.ts";
import { ASSETS } from "./embed.ts";
import type { ApiMethod, ApiRequests } from "../shared/rpc.ts";
import {
	accessSecretVersion,
	clearHttpLogs,
	createSecret,
	createSecretVersion,
	deleteSecret,
	destroySecretVersion,
	disableSecretVersion,
	enableSecretVersion,
	getActiveVersionCounts,
	getHttpLogs,
	getProfiles,
	getProjects,
	getSecrets,
	getSecretVersions,
	prefetchSecretValues,
	switchActiveProfile,
	updateSecret,
} from "./scw.ts";

// Loopback = the app itself (vite dev proxies /api); an attacker page keeps its own
// public origin even when it rebinds DNS to 127.0.0.1.
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function isCrossSite(req: Request): boolean {
	const site = req.headers.get("sec-fetch-site");
	if (site && site !== "same-origin" && site !== "none") return true;
	const origin = req.headers.get("origin");
	return Boolean(origin) && !LOOPBACK_ORIGIN.test(origin!);
}

function openExternal(url: string): void {
	if (!/^https?:\/\//.test(url)) {
		throw new Error("only http(s) URLs can be opened");
	}
	const [cmd, ...args] = Deno.build.os === "darwin"
		? ["open", url]
		: Deno.build.os === "windows"
		? ["cmd", "/c", "start", "", url]
		: ["xdg-open", url];
	new Deno.Command(cmd, { args, stdout: "null", stderr: "null" }).spawn().unref();
}

type Handlers = {
	[K in ApiMethod]: (
		params: ApiRequests[K]["params"],
	) => Promise<ApiRequests[K]["response"]> | ApiRequests[K]["response"];
};

const handlers: Handlers = {
	getProfiles: () => getProfiles(),
	switchProfile: ({ profile }) => switchActiveProfile(profile),
	getProjects: ({ profile }) => getProjects(profile),
	getSecrets: (filters) => getSecrets(filters),
	getSecretVersions: ({ secretId, profile, projectId }) => getSecretVersions(secretId, profile, projectId),
	getSecretValue: async ({ secretId, revision, profile, projectId }) => ({
		value: await accessSecretVersion(secretId, revision, profile, projectId),
	}),
	prefetchSecretValues: ({ secretIds, profile, projectId }) => prefetchSecretValues(secretIds, profile, projectId),
	getActiveVersionCounts: ({ secretIds, profile, projectId }) => getActiveVersionCounts(secretIds, profile, projectId),
	createSecret: async ({ name, path, type, value, tags, profile, projectId }) => {
		const secret = await createSecret(name, path ?? "/", type ?? "opaque", tags ?? [], profile, projectId);
		await createSecretVersion(secret.id, value, profile, projectId);
		return { secretId: secret.id };
	},
	updateSecretValue: async ({ secretId, value, profile, projectId }) => {
		await createSecretVersion(secretId, value, profile, projectId);
		return { ok: true };
	},
	enableSecretVersion: async ({ secretId, revision, profile, projectId }) => {
		await enableSecretVersion(secretId, revision, profile, projectId);
		return { ok: true };
	},
	disableSecretVersion: async ({ secretId, revision, profile, projectId }) => {
		await disableSecretVersion(secretId, revision, profile, projectId);
		return { ok: true };
	},
	destroySecretVersion: async ({ secretId, revision, profile, projectId }) => {
		await destroySecretVersion(secretId, revision, profile, projectId);
		return { ok: true };
	},
	updateSecret: async ({ secretId, name, tags, profile, projectId }) => {
		await updateSecret(secretId, { name, tags }, profile, projectId);
		return { ok: true };
	},
	duplicateSecret: async ({ secretId, name, path, type, tags, profile, projectId }) => {
		const value = await accessSecretVersion(secretId, "latest_enabled", profile, projectId);
		const newSecret = await createSecret(name, path ?? "/", type ?? "opaque", tags ?? [], profile, projectId);
		await createSecretVersion(newSecret.id, value, profile, projectId);
		return { secretId: newSecret.id };
	},
	deleteSecret: async ({ secretId, profile, projectId }) => {
		await deleteSecret(secretId, profile, projectId);
		return { ok: true };
	},
	getHttpLogs: () => getHttpLogs(),
	clearHttpLogs: () => {
		clearHttpLogs();
		return { ok: true };
	},
	openExternal: ({ url }) => {
		openExternal(url);
		return { ok: true };
	},
};

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});

const WEB_DIST = `${APP_ROOT}/dist`;

const CONTENT_TYPES: Record<string, string> = {
	js: "text/javascript",
	css: "text/css",
	html: "text/html",
	svg: "image/svg+xml",
	png: "image/png",
	ico: "image/x-icon",
	json: "application/json",
	map: "application/json",
	woff2: "font/woff2",
};

async function serveStatic(pathname: string): Promise<Response> {
	const p = pathname === "/" ? "index.html" : pathname.slice(1);
	const ext = p.slice(p.lastIndexOf(".") + 1);
	const headers = {
		"content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
		// hashed assets are immutable; everything else must revalidate so a rebuild is picked up on reload
		"cache-control": p.startsWith("assets/")
			? "public, max-age=31536000, immutable"
			: "no-cache",
	};
	try {
		// dev: read from disk so `bun run build` refreshes live
		const body = await Deno.readFile(`${WEB_DIST}/${p}`);
		return new Response(body, { headers });
	} catch {
		// bundled installs: assets embedded in the compile VFS
		const embedded = ASSETS[p];
		if (embedded) return new Response(new Uint8Array(embedded), { headers });
		// a missing asset must 404 — an HTML body here makes dynamic import() fail with a MIME error
		if (p.startsWith("assets/")) {
			return new Response("not found", { status: 404 });
		}
		return new Response(
			`<h1>Scw Secrets</h1><p>Frontend not built — run <code>bun run build</code>.</p>`,
			{ headers: { "content-type": "text/html" } },
		);
	}
}

async function serveHandler(req: Request): Promise<Response> {
	const { pathname } = new URL(req.url);

	if (!pathname.startsWith("/api/")) {
		return req.method === "GET" ? serveStatic(pathname) : json({ error: "method not allowed" }, 405);
	}

	if (isCrossSite(req)) {
		return json({ error: "cross-site requests are not allowed" }, 403);
	}
	if (req.method !== "POST") {
		return json({ error: "method not allowed" }, 405);
	}

	const method = pathname.slice("/api/".length);
	if (!Object.hasOwn(handlers, method)) {
		return json({ error: "not found" }, 404);
	}
	const fn = handlers[method as ApiMethod] as (params: unknown) => unknown;

	let params: unknown = {};
	try {
		params = await req.json();
	} catch {
		// empty body — keep {}
	}

	try {
		return json(await fn(params));
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, 500);
	}
}

// `Deno.BrowserWindow` only exists under the `deno desktop` runtime — the env var
// alternative fails in bundles, where compile-time env doesn't reach the binary.
// deno-lint-ignore no-explicit-any
const BW = (Deno as any).BrowserWindow;

// Under `deno desktop` don't pin a port — the framework binds the address the webview
// navigates to. Headless serve uses a fixed port so the browser and the vite dev proxy
// know where to reach the API.
let server: Deno.HttpServer<Deno.NetAddr>;
if (BW) {
	console.log("Scw Secrets (desktop)");
	server = Deno.serve(serveHandler);
} else {
	console.log(`Scw Secrets → http://localhost:${PORT}`);
	server = Deno.serve({ port: PORT, hostname: HOST }, serveHandler);
}
void server;

// Desktop window: adopt the auto-opened window, restore saved geometry, persist on change.
if (BW) {
	let geo: { width?: number; height?: number; x?: number; y?: number } = {};
	try {
		geo = JSON.parse(await Deno.readTextFile(WINDOW_FILE));
	} catch {
		// first run
	}
	const win = new BW({
		title: "Scw Secrets",
		width: geo.width ?? 1440,
		height: geo.height ?? 920,
		x: geo.x,
		y: geo.y,
	});
	// ctor opts may not apply when adopting — enforce explicitly
	if (geo.width && geo.height) win.setSize(geo.width, geo.height);
	else win.setSize(1440, 920);
	if (geo.x != null && geo.y != null) win.setPosition(geo.x, geo.y);
	win.setTitle("Scw Secrets");
	// macOS resets the title to the binary name after webview init — re-apply
	for (const ms of [300, 1200, 4000]) {
		setTimeout(() => {
			try {
				win.setTitle("Scw Secrets");
			} catch {
				// window gone
			}
		}, ms);
	}
	try {
		win.addEventListener("focus", () => win.setTitle("Scw Secrets"));
	} catch {
		// focus events unsupported on this backend
	}
	let t: ReturnType<typeof setTimeout> | undefined;
	const persist = () => {
		clearTimeout(t);
		t = setTimeout(async () => {
			try {
				const [width, height] = win.getSize();
				const [x, y] = win.getPosition();
				await Deno.mkdir(WINDOW_FILE.replace(/\/[^/]+$/, ""), { recursive: true });
				await Deno.writeTextFile(WINDOW_FILE, JSON.stringify({ width, height, x, y }));
			} catch {
				// window gone
			}
		}, 400);
	};
	win.addEventListener("resize", persist);
	win.addEventListener("move", persist);
}
