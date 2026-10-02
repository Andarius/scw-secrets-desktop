import { expect, test } from "bun:test";
import { createHttpHandler, externalCommand, PublicError, type Handlers } from "../../src/deno/http";

const token = "test-capability";
const secretId = "12345678-1234-1234-1234-123456789abc";
function setup() {
	const calls: unknown[] = [];
	const handlers = Object.fromEntries(["getProfiles", "deleteSecret", "getSecretValue", "destroySecretVersion", "prefetchSecretValues"].map((method) => [method, (params: unknown) => {
		calls.push(params);
		return { ok: true };
	}])) as unknown as Handlers;
	const handle = createHttpHandler(handlers, async () => new Response("public asset"), token);
	return { calls, handle };
}
function request(method = "getProfiles", body = "{}", headers: Record<string, string> = {}, host = "localhost:8790") {
	return new Request(`http://${host}/api/${method}`, {
		method: "POST", body,
		headers: { origin: `http://${host}`, authorization: `Bearer ${token}`, "content-type": "application/json", ...headers },
	});
}

test.each([
	["missing capability", { authorization: "" }, "localhost:8790", 401],
	["wrong capability", { authorization: "Bearer wrong" }, "localhost:8790", 401],
	["external origin", { origin: "https://evil.example" }, "localhost:8790", 403],
	["another local app", { origin: "http://localhost:4444" }, "localhost:8790", 403],
	["opaque origin", { origin: "null" }, "localhost:8790", 403],
	["cross-site metadata", { "sec-fetch-site": "cross-site" }, "localhost:8790", 403],
	["DNS rebinding", {}, "evil.example:8790", 403],
	["form content type", { "content-type": "text/plain" }, "localhost:8790", 415],
] as const)("rejects %s before dispatch", async (_name, headers, host, status) => {
	const { calls, handle } = setup();
	expect((await handle(request("getProfiles", "{}", headers, host))).status).toBe(status);
	expect(calls).toHaveLength(0);
});

test.each([
	["deleteSecret", JSON.stringify({ secretId }), 200],
	["deleteSecret", JSON.stringify({ secretId: "../other" }), 400],
	["deleteSecret", "null", 400],
	["getProfiles", "{", 400],
	["getProfiles", '{"__proto__":{}}', 400],
	["getSecretValue", JSON.stringify({ secretId, revision: "../other" }), 400],
	["destroySecretVersion", JSON.stringify({ secretId, revision: -1 }), 400],
	["prefetchSecretValues", JSON.stringify({ secretIds: [secretId, {}] }), 400],
	["constructor", "{}", 404],
] as const)("validates %s %s", async (method, body, status) => {
	const { calls, handle } = setup();
	expect((await handle(request(method, body))).status).toBe(status);
	expect(calls).toHaveLength(status === 200 ? 1 : 0);
});

test("caps streamed bodies before dispatch and never publishes capability", async () => {
	const { calls, handle } = setup();
	expect((await handle(request("getProfiles", " ".repeat(2 * 1024 * 1024 + 1)))).status).toBe(413);
	expect(calls).toHaveLength(0);
	const asset = await handle(new Request("http://localhost:8790/"));
	expect(await asset.text()).not.toContain(token);
	expect(asset.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
	const result = await handle(request());
	expect(result.headers.get("cache-control")).toBe("no-store");
});

test("authenticated native requests do not need browser-only headers", async () => {
	const { handle } = setup();
	const req = request();
	req.headers.delete("origin");
	expect((await handle(req)).status).toBe(200);
});

test.each(["https://example.com", "https://console.scaleway.com/&calc", "javascript:alert(1)", "https://console.scaleway.com@evil.example/"])("rejects external launcher input %s", (url) => {
	expect(() => externalCommand(url, "windows")).toThrow();
});

test("only PublicError messages reach the page; other failures stay generic", async () => {
	const handlers = {
		getProfiles: () => { throw new PublicError("download failed (404)"); },
		getProjects: () => { throw new Error("upstream detail: token=abc"); },
	} as unknown as Handlers;
	const handle = createHttpHandler(handlers, async () => new Response(""), token);
	expect(await (await handle(request("getProfiles", "{}"))).json()).toEqual({ error: "download failed (404)" });
	expect(await (await handle(request("getProjects", "{}"))).json()).toEqual({ error: "request failed" });
});

test("opens only this app's GitHub release pages besides console links", () => {
	const release = "https://github.com/Andarius/scw-secrets-desktop/releases/tag/v0.9.0";
	expect(externalCommand(release, "darwin")).toEqual(["open", [release]]);
	for (const url of [
		"https://github.com/Andarius/scw-secrets-desktop/releases/download/v0.9.0/app.zip",
		"https://github.com/someone-else/repo/releases/tag/v0.9.0",
		`${release}?x=1`,
	]) {
		expect(() => externalCommand(url, "darwin")).toThrow();
	}
});

test("opens a console link without a Windows shell", () => {
	const url = `https://console.scaleway.com/secret-manager/secrets/fr-par/${secretId}/overview`;
	expect(externalCommand(url, "windows")).toEqual(["rundll32.exe", ["url.dll,FileProtocolHandler", url]]);
});


test("honors the Vite proxy's preserved loopback Host without trusting forwarded headers", async () => {
	const { handle } = setup();
	const req = request("getProfiles", "{}", { host: "localhost:5181", origin: "http://localhost:5181" });
	expect((await handle(req)).status).toBe(200);
	const forged = request("getProfiles", "{}", { host: "evil.example:5181", origin: "http://evil.example:5181" });
	expect((await handle(forged)).status).toBe(403);
	const missing = request("getProfiles", "{}", { authorization: "", "sec-fetch-site": "same-origin" });
	expect((await handle(missing)).status).toBe(401);
});
