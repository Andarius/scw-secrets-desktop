import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("AppImage integration writes a menu entry matching the Wayland app id", () => {
	const directory = mkdtempSync(join(tmpdir(), "scw-desktop-test-"));
	try {
		const binary = join(directory, "scw-secrets");
		writeFileSync(binary, `#!/usr/bin/env bash
# DESCRIPTION: Fake AppImage extraction for the installer regression test.
# USAGE: scw-secrets --appimage-extract '*.png'
set -euo pipefail
mkdir -p squashfs-root
cp "$SCW_TEST_ICON" squashfs-root/ScwSecrets.png
`, { mode: 0o755 });

		const result = Bun.spawnSync([
			"bash", "-c", 'source "$1"; integrate_appimage "$2"',
			"quickstart-test", resolve("bin/quickstart.sh"), binary,
		], {
			env: { ...process.env, XDG_DATA_HOME: directory, SCW_SECRETS_APP: "none", SCW_TEST_ICON: resolve("icon.png") },
		});

		expect(result.exitCode).toBe(0);
		const desktop = readFileSync(join(directory, "applications", "ScwSecrets.desktop"), "utf8");
		expect(desktop).toContain(`Exec=${binary}\n`);
		expect(desktop).toContain("StartupWMClass=ScwSecrets\n");
		const icon = join(directory, "icons/hicolor/256x256/apps/io.github.andarius.scw-secrets.png");
		expect(readFileSync(icon)).toEqual(readFileSync("icon.png"));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
