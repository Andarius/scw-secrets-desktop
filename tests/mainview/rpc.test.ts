import { expect, test } from "bun:test";

test("RPC uses Tauri IPC and preserves user-facing errors", () => {
	const script = `
		import assert from "node:assert/strict";
		import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
		globalThis.window = {};
		globalThis.isTauri = true;
		const requests = [];
		mockIPC((command, args) => {
			assert.equal(command, "rpc");
			requests.push(args);
			if (args.method === "deleteSecret") throw "request failed";
			return { active: null, profiles: [] };
		});
		const { api } = await import("./src/mainview/lib/rpc.ts");
		assert.deepEqual(await api.getProfiles({}), { active: null, profiles: [] });
		await assert.rejects(api.deleteSecret({ secretId: "test-id" }), { message: "request failed" });
		assert.deepEqual(requests, [
			{ method: "getProfiles", params: {} },
			{ method: "deleteSecret", params: { secretId: "test-id" } },
		]);
		clearMocks();
	`;
	const result = Bun.spawnSync([process.execPath, "-e", script], { env: { ...process.env, VITE_MOCK: "0" } });
	expect(result.stderr.toString()).toBe("");
	expect(result.exitCode).toBe(0);
});

test.each([
	["browser preview", false, "0"],
	["explicit mock mode", true, "1"],
] as const)("%s uses sample data without invoking native commands", (_name, desktop, mockMode) => {
	const script = `
		import assert from "node:assert/strict";
		globalThis.window = {};
		globalThis.isTauri = ${desktop};
		const { api } = await import("./src/mainview/lib/rpc.ts");
		assert.deepEqual(await api.getProfiles({}), { active: null, profiles: [] });
		const { value } = await api.getSecretValue({ secretId: "sample", revision: "latest_enabled" });
		assert.equal(JSON.parse(value).host, "db.fr-par.scw.cloud");
	`;
	const result = Bun.spawnSync([process.execPath, "-e", script], { env: { ...process.env, VITE_MOCK: mockMode } });
	expect(result.stderr.toString()).toBe("");
	expect(result.exitCode).toBe(0);
});

test("secret copies use the native clipboard and clear only the copied value", () => {
	const script = `
		import assert from "node:assert/strict";
		import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
		globalThis.window = {};
		globalThis.isTauri = true;
		let clipboard = "";
		let expire;
		globalThis.setTimeout = callback => { expire = callback; return 1; };
		globalThis.clearTimeout = () => {};
		mockIPC((command, args) => {
			if (command === "plugin:clipboard-manager|write_text") clipboard = args.text;
			else if (command === "plugin:clipboard-manager|read_text") return clipboard;
			else throw new Error(command);
		});
		const { copySecret } = await import("./src/mainview/lib/clipboard.ts");
		await copySecret("secret");
		assert.equal(clipboard, "secret");
		await expire();
		assert.equal(clipboard, "");
		await copySecret("secret");
		clipboard = "user replacement";
		await expire();
		assert.equal(clipboard, "user replacement");
		clearMocks();
	`;
	const result = Bun.spawnSync([process.execPath, "-e", script]);
	expect(result.stderr.toString()).toBe("");
	expect(result.exitCode).toBe(0);
});
