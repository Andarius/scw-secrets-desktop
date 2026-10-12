import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test.each(["managed", "unrelated", "absent"])(
	"AppImage integration matches Wayland identity with %s legacy launcher",
	(legacy) => {
		const directory = mkdtempSync(join(tmpdir(), "scw-desktop-test-"));
		try {
			const applications = join(directory, "applications");
			mkdirSync(applications);
			const binary = join(directory, "scw-secrets");
			writeFileSync(binary, `#!/usr/bin/env bash
# DESCRIPTION: Fake AppImage extraction for the installer regression test.
# USAGE: scw-secrets --appimage-extract '*.png'
set -euo pipefail
mkdir -p squashfs-root
cp "$SCW_TEST_ICON" squashfs-root/scw-secrets.png
`, { mode: 0o755 });
			const oldPath = join(applications, "ScwSecrets.desktop");
			const oldContents = `[Desktop Entry]\nExec=${legacy === "managed" ? binary : "/custom/scw-secrets"}\n`;
			if (legacy !== "absent") writeFileSync(oldPath, oldContents);

			const result = Bun.spawnSync([
				"bash", "-c", 'source "$1"; integrate_appimage "$2"',
				"quickstart-test", resolve("bin/quickstart.sh"), binary,
			], {
				env: { ...process.env, XDG_DATA_HOME: directory, SCW_SECRETS_APP: "none", SCW_TEST_ICON: resolve("icon.png") },
			});

			expect(result.exitCode).toBe(0);
			const desktop = readFileSync(join(applications, "scw-secrets.desktop"), "utf8");
			expect(desktop).toContain(`Exec=${binary}\n`);
			expect(desktop).toContain("StartupWMClass=scw-secrets\n");
			const icon = join(directory, "icons/hicolor/256x256/apps/io.github.andarius.scw-secrets.png");
			expect(readFileSync(icon)).toEqual(readFileSync("icon.png"));
			if (legacy === "unrelated") expect(readFileSync(oldPath, "utf8")).toBe(oldContents);
			else expect(existsSync(oldPath)).toBe(false);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	},
);
