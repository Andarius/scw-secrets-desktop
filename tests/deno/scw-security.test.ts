import { expect, test } from "bun:test";

test("Scaleway security regressions in the Deno runtime", () => {
	const result = Bun.spawnSync(["deno", "test", "--allow-read=.", "tests/deno/scw-security.deno.ts"]);
	if (result.exitCode !== 0) {
		throw new Error(new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
	}
	expect(result.exitCode).toBe(0);
});
