import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("release tag validation rejects shell syntax before running git", () => {
	const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");
	const step = workflow.split("      - name: Resolve release tag\n")[1].split("      - name:")[0];
	const script = step.split("        run: |\n")[1].replace(/^          /gm, "");
	for (const tag of ['$(echo injected)', 'v1.0.0"; echo injected; #', 'v1.0.0\nextra=value']) {
		const result = Bun.spawnSync(["bash", "-c", script], {
			env: { ...process.env, INPUT_TAG: tag, GITHUB_EVENT_NAME: "workflow_dispatch" },
		});
		expect(result.exitCode).toBe(1);
		expect(result.stdout.toString()).toBe("");
		expect(result.stderr.toString()).toContain("Release tag must be a version");
	}
});
