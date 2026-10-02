import { expect, test } from "bun:test";

test("RPC consumes the launch token, strips the fragment and reuses it on reload", () => {
	const script = `
		import assert from "node:assert/strict";
		const storage = new Map();
		globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
		globalThis.window = {
			location: { hash: "#token=test-token", pathname: "/index.html", search: "?view=secrets" },
			history: { replaceState: (_state, _title, url) => {
				assert.equal(url, "/index.html?view=secrets");
				window.location.hash = "";
			} },
		};
		let requests = 0;
		globalThis.fetch = async (url, options) => {
			assert.equal(url, "/api/getProfiles");
			assert.equal(options.method, "POST");
			assert.equal(options.headers.authorization, "Bearer test-token");
			assert.equal(options.headers["content-type"], "application/json");
			assert.equal(options.body, "{}");
			requests++;
			return Response.json({ profiles: [] });
		};
		const first = await import("./src/mainview/lib/rpc.ts?first");
		await first.api.getProfiles({});
		assert.equal(window.location.hash, "");
		assert.equal(storage.get("scw-session-token"), "test-token");
		const reloaded = await import("./src/mainview/lib/rpc.ts?reload");
		await reloaded.api.getProfiles({});
		assert.equal(requests, 2);
	`;
	const result = Bun.spawnSync([process.execPath, "-e", script], { env: { ...process.env, VITE_MOCK: "0" } });
	expect(result.stderr.toString()).toBe("");
	expect(result.exitCode).toBe(0);
});
