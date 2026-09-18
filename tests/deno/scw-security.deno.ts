import { deepEqual, equal, rejects } from "node:assert/strict";

// Stub all credential sources before importing the client.
Deno.env.get = (name) => ({ SCW_SECRET_KEY: "test-token", SCW_PROJECT_ID: "test-project" })[name];
Deno.readTextFileSync = () => "active_profile: default\nprofiles:\n  default:\n    secret_key: test-token\n    default_project_id: test-project\n  __proto__:\n    secret_key: proto-token\n    default_project_id: proto-project\n";
const scw = await import("../../src/deno/scw.ts");

Deno.test("all secret operations reject injected path segments before fetching", async () => {
	let calls = 0;
	globalThis.fetch = () => {
		calls++;
		throw new Error("unexpected network request");
	};
	for (const input of ["../other", ".", "..", "%2e%2e", "id?x=y", "id#x", "id\\other", "id\n", "", "not-a-uuid", "destroy", "0", "-1"]) {
		for (const operation of [
			() => scw.getSecretVersions(input),
			() => scw.accessSecretVersion(input, "latest_enabled"),
			() => scw.accessSecretVersion("12345678-1234-1234-1234-123456789abc", input),
			() => scw.createSecretVersion(input, "value"),
			() => scw.updateSecret(input, { name: "renamed" }),
			() => scw.enableSecretVersion(input, 1),
			() => scw.disableSecretVersion(input, 1),
			() => scw.destroySecretVersion(input, 1),
			() => scw.deleteSecret(input),
		]) {
			await rejects(operation, /invalid Secret Manager path segment/);
		}
	}
	equal(calls, 0);
});

Deno.test("authenticated reads, writes and deletes never follow redirects", async () => {
	const methods: string[] = [];
	globalThis.fetch = (input, init) => {
		equal(new URL(String(input)).origin, "https://api.scaleway.com");
		equal(init?.redirect, "error");
		equal(new Headers(init?.headers).get("X-Auth-Token"), "test-token");
		methods.push(init!.method!);
		return Promise.resolve(init?.method === "DELETE"
			? new Response(null, { status: 204 })
			: Response.json({ data: "dmFsdWU=" }));
	};
	for (const revision of ["1", "latest", "latest_enabled"]) {
		equal(await scw.accessSecretVersion("12345678-1234-1234-1234-123456789abc", revision), "value");
	}
	await scw.createSecretVersion("12345678-1234-1234-1234-123456789abc", "value");
	await scw.updateSecret("12345678-1234-1234-1234-123456789abc", { name: "renamed" });
	await scw.deleteSecret("12345678-1234-1234-1234-123456789abc");
	deepEqual(methods, ["GET", "GET", "GET", "POST", "PATCH", "DELETE"]);
});

Deno.test("profile names cannot resolve inherited properties", async () => {
	const profiles = scw.getProfiles().profiles;
	equal(profiles.some(({ name }) => name === "__proto__"), true);
	await rejects(() => scw.getProjects("constructor"), /profile 'constructor' not found/);
	await rejects(() => scw.getProjects("toString"), /profile 'toString' not found/);
});
