import { UUID_PATTERN, REVISION_PATTERN, RELEASE_PAGE_PATTERN, VERSION_PATTERN } from "../shared/validation.ts";
import type { ApiMethod, ApiRequests } from "../shared/rpc.ts";

/**
 * An error whose message was written for the user and is safe to show. Every other error is
 * reported as a generic "request failed", so upstream details (e.g. Scaleway responses) never
 * reach the page.
 */
export class PublicError extends Error {}

export type Handlers = {
	[K in ApiMethod]: (params: ApiRequests[K]["params"]) => Promise<ApiRequests[K]["response"]> | ApiRequests[K]["response"];
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const fields: Record<ApiMethod, string[]> = {
	getProfiles: [], switchProfile: ["profile"], getProjects: ["profile?"],
	getSecrets: ["profile?", "projectId?", "query?", "path?", "status?"],
	getSecretVersions: ["secretId", "profile?", "projectId?"],
	getSecretValue: ["secretId", "revision", "profile?", "projectId?"],
	prefetchSecretValues: ["secretIds", "profile?", "projectId?"],
	getActiveVersionCounts: ["secretIds", "profile?", "projectId?"],
	createSecret: ["name", "path?", "type?", "value", "tags?", "profile?", "projectId?"],
	updateSecretValue: ["secretId", "value", "profile?", "projectId?"],
	enableSecretVersion: ["secretId", "revision", "profile?", "projectId?"],
	disableSecretVersion: ["secretId", "revision", "profile?", "projectId?"],
	destroySecretVersion: ["secretId", "revision", "profile?", "projectId?"],
	updateSecret: ["secretId", "name?", "tags?", "profile?", "projectId?"],
	duplicateSecret: ["secretId", "name", "path?", "type?", "tags?", "profile?", "projectId?"],
	deleteSecret: ["secretId", "profile?", "projectId?"],
	getHttpLogs: [], clearHttpLogs: [], openExternal: ["url"], getLatestRelease: [],
	getUpdateSupport: [], installUpdate: ["version"],
};

function validParams(method: ApiMethod, params: unknown): boolean {
	if (!params || typeof params !== "object" || Array.isArray(params)) return false;
	const data = params as Record<string, unknown>;
	const spec = fields[method];
	if (Object.keys(data).some((key) => !spec.includes(key) && !spec.includes(`${key}?`))) return false;
	return spec.every((field) => {
		const optional = field.endsWith("?");
		const key = optional ? field.slice(0, -1) : field;
		const value = data[key];
		if (value === undefined) return optional;
		if (key === "revision") {
			return method === "getSecretValue"
				? typeof value === "string" && REVISION_PATTERN.test(value)
				: typeof value === "number" && Number.isSafeInteger(value) && value > 0;
		}
		if (key === "tags" || key === "secretIds") {
			return Array.isArray(value) && value.length <= 10000 && value.every((item) =>
				typeof item === "string" && (key !== "secretIds" || UUID_PATTERN.test(item))
			);
		}
		if (typeof value !== "string") return false;
		if (key === "secretId" || key === "projectId") return UUID_PATTERN.test(value);
		if (key === "status") return ["all", "ready", "disabled"].includes(value);
		if (key === "version") return VERSION_PATTERN.test(value);
		return !["name", "profile", "url", "type"].includes(key) || value.length > 0;
	});
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
	status,
	headers: { "content-type": "application/json", "cache-control": "no-store" },
});

export function createHttpHandler(
	handlers: Handlers,
	serveStatic: (path: string) => Promise<Response>,
	token: string,
	onUnauthorized?: () => void,
) {
	async function handle(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const host = req.headers.get("host") ?? url.host;
		if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/.test(host)) return json({ error: "invalid host" }, 403);
		const requestOrigin = `${url.protocol}//${host}`;
		if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return json({ error: "invalid host" }, 403);
		if (!url.pathname.startsWith("/api/")) {
			return req.method === "GET" ? serveStatic(url.pathname) : json({ error: "method not allowed" }, 405);
		}
		// before the token check so other sites can't trigger onUnauthorized
		const site = req.headers.get("sec-fetch-site");
		const origin = req.headers.get("origin");
		if ((site && site !== "same-origin" && site !== "none") ||
			(origin !== null && origin !== requestOrigin)) {
			return json({ error: "cross-site requests are not allowed" }, 403);
		}
		if (req.headers.get("authorization") !== `Bearer ${token}`) {
			onUnauthorized?.();
			return json({ error: "unauthorized" }, 401);
		}
		if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
		if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
			return json({ error: "application/json required" }, 415);
		}
		const method = url.pathname.slice("/api/".length);
		if (!Object.prototype.hasOwnProperty.call(handlers, method)) return json({ error: "not found" }, 404);
		const chunks: ArrayBuffer[] = [];
		let size = 0;
		let params: unknown;
		try {
			if (req.body) {
				const reader = req.body.getReader();
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						size += value.byteLength;
						if (size > MAX_BODY_BYTES) {
							await reader.cancel();
							return json({ error: "request too large" }, 413);
						}
						chunks.push(new Uint8Array(value).buffer);
					}
				} finally {
					reader.releaseLock();
				}
			}
			params = JSON.parse(await new Blob(chunks).text());
		} catch {
			return json({ error: "invalid JSON" }, 400);
		}
		if (!validParams(method as ApiMethod, params)) return json({ error: "invalid parameters" }, 400);
		try {
			return json(await (handlers[method as ApiMethod] as (params: unknown) => unknown)(params));
		} catch (error) {
			return json({ error: error instanceof PublicError ? error.message : "request failed" }, 500);
		}
	}
	return async (req: Request): Promise<Response> => {
		const response = await handle(req);
		response.headers.set("x-content-type-options", "nosniff");
		response.headers.set("referrer-policy", "no-referrer");
		response.headers.set("x-frame-options", "DENY");
		response.headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
		return response;
	};
}

export function externalCommand(url: string, os: string): [string, string[]] {
	const isConsoleUrl = /^https:\/\/console\.scaleway\.com\/secret-manager\/secrets\/[a-z]{2}-[a-z]+\/[0-9a-f-]{36}\/overview$/.test(url);
	if (!isConsoleUrl && !RELEASE_PAGE_PATTERN.test(url)) {
		throw new Error("only Scaleway secret console and app release URLs can be opened");
	}
	if (os === "darwin") return ["open", [url]];
	if (os === "windows") return ["rundll32.exe", ["url.dll,FileProtocolHandler", url]];
	return ["xdg-open", [url]];
}
