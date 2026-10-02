// Deno-desktop entrypoint. `deno desktop src/deno/main.ts` (Deno 2.9+) opens a native
// window pointed at this in-process HTTP server. `deno task serve` runs it headless
// (open http://localhost:8790 in a browser).
import { HOST, PORT, WINDOW_FILE } from "./config.ts";
import { ASSETS } from "./embed.ts";
import { attachWindowLifecycle, type Geometry } from "./window.ts";
import { createHttpHandler, externalCommand, type Handlers } from "./http.ts";
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

function openExternal(url: string): void {
	const [cmd, args] = externalCommand(url, Deno.build.os);
	const executable = Deno.build.os === "windows"
		? `${Deno.env.get("SystemRoot") ?? "C:\\Windows"}\\System32\\${cmd}`
		: `/usr/bin/${cmd}`;
	new Deno.Command(executable, { args, stdout: "null", stderr: "null" }).spawn().unref();
}

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
	const embedded = Object.hasOwn(ASSETS, p) ? ASSETS[p] : undefined;
	if (embedded) return new Response(new Uint8Array(embedded), { headers });
	return new Response("not found", { status: 404 });
}

const sessionToken = crypto.randomUUID();
// Desktop only: re-sends the window to the tokenized URL (see below).
let navigateWithToken: (() => void) | undefined;
const serveHandler = createHttpHandler(handlers, serveStatic, sessionToken, () => navigateWithToken?.());

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
	server = Deno.serve({ hostname: "127.0.0.1" }, serveHandler);
} else {
	console.log(`Scw Secrets → http://localhost:${PORT}/#token=${sessionToken}`);
	console.log(`HMR frontend → http://localhost:5181/#token=${sessionToken}`);
	server = Deno.serve({ port: PORT, hostname: HOST }, serveHandler);
}
if (!["127.0.0.1", "::1"].includes(server.addr.hostname)) {
	await server.shutdown();
	throw new Error("Secret server must bind to loopback");
}

// Desktop window: adopt the auto-opened window, restore saved geometry, persist on
// change, and quit when it's closed.
if (BW) {
	const TITLE = "Scw Secrets";
	const DEFAULT_SIZE = [1440, 920] as const;

	let saved: Geometry = {};
	try {
		saved = JSON.parse(await Deno.readTextFile(WINDOW_FILE));
	} catch {
		// first run
	}
	const win = new BW({
		title: TITLE,
		width: saved.width ?? DEFAULT_SIZE[0],
		height: saved.height ?? DEFAULT_SIZE[1],
		x: saved.x,
		y: saved.y,
	});
	const tokenUrl = `http://127.0.0.1:${server.addr.port}/index.html#token=${sessionToken}`;
	win.navigate(tokenUrl);
	// The runtime's own initial navigation to "/" can land after ours and drop the
	// token; a tokenless API call means the window lost it, so send it back.
	let lastNavigate = 0;
	navigateWithToken = () => {
		const now = Date.now();
		if (now - lastNavigate < 2000) return;
		lastNavigate = now;
		win.navigate(tokenUrl);
	};
	attachWindowLifecycle(win, {
		title: TITLE,
		defaultSize: DEFAULT_SIZE,
		saved,
		// sync: the close path writes this immediately before exiting
		persist: (geo) => {
			try {
				Deno.mkdirSync(WINDOW_FILE.replace(/\/[^/]+$/, ""), { recursive: true });
				Deno.writeTextFileSync(WINDOW_FILE, JSON.stringify(geo));
			} catch {
				// best effort — geometry is a convenience, not state we can fail on
			}
		},
		quit: () => Deno.exit(0),
	});
}
