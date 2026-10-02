import { describe, expect, test } from "bun:test";

import { detectInstallTarget, pickReleaseAsset } from "../../src/deno/install-target";

describe("detectInstallTarget", () => {
	test("updates an installed macOS bundle, picking the asset for the CPU", () => {
		const execPath = "/Applications/ScwSecrets.app/Contents/MacOS/laufey_webview";
		expect(detectInstallTarget(execPath, {}, "darwin", "aarch64")).toEqual({
			kind: "macos",
			appPath: "/Applications/ScwSecrets.app",
			asset: "ScwSecrets-macos-arm64.app.zip",
		});
		expect(detectInstallTarget(execPath, {}, "darwin", "x86_64")?.asset).toBe("ScwSecrets-macos-x64.app.zip");
	});

	test("updates a bundle installed outside /Applications", () => {
		expect(detectInstallTarget("/Users/me/Apps/ScwSecrets.app/Contents/MacOS/laufey_webview", {}, "darwin", "aarch64")?.kind).toBe("macos");
	});

	test("updates a Linux AppImage in place", () => {
		expect(detectInstallTarget("/tmp/.mount_x/usr/bin/app", { APPIMAGE: "/home/me/.local/bin/scw-secrets" }, "linux", "x86_64")).toEqual({
			kind: "appimage",
			path: "/home/me/.local/bin/scw-secrets",
			asset: "ScwSecrets.AppImage",
		});
	});

	test("refuses dev runs, snap/deb/msi installs and relative paths", () => {
		// deno desktop --hmr runs from a cached bundle named after the app, not ScwSecrets.app
		expect(detectInstallTarget("/Users/me/Library/Caches/deno/desktop/x/Scw Secrets.app/Contents/MacOS/laufey_webview", {}, "darwin", "aarch64")).toBeNull();
		expect(detectInstallTarget("/opt/homebrew/bin/deno", {}, "darwin", "aarch64")).toBeNull();
		expect(detectInstallTarget("/snap/scw-secrets/1/bin/scw-secrets", {}, "linux", "x86_64")).toBeNull();
		expect(detectInstallTarget("/usr/bin/scw-secrets", { APPIMAGE: "relative/path" }, "linux", "x86_64")).toBeNull();
		expect(detectInstallTarget("C:\\Program Files\\ScwSecrets\\app.exe", {}, "windows", "x86_64")).toBeNull();
	});
});

describe("pickReleaseAsset", () => {
	const asset = "ScwSecrets-macos-arm64.app.zip";
	const url = `https://github.com/Andarius/scw-secrets-desktop/releases/download/v0.9.0/${asset}`;
	const sha = "c46473597e8bb637b3c6332469613859c63c6564970c67fd7305f5324d811e0b";
	const payload = (overrides: Record<string, unknown> = {}) => ({
		assets: [
			{ name: "ScwSecrets.msi", browser_download_url: "https://github.com/x", digest: `sha256:${sha}` },
			{ name: asset, browser_download_url: url, digest: `sha256:${sha}`, ...overrides },
		],
	});

	test("returns the download URL and digest of the matching asset", () => {
		expect(pickReleaseAsset(payload(), "0.9.0", asset)).toEqual({ url, sha256: sha });
	});

	test("rejects assets that can't be verified or point elsewhere", () => {
		expect(pickReleaseAsset(payload({ digest: undefined }), "0.9.0", asset)).toBeNull();
		expect(pickReleaseAsset(payload({ digest: "md5:abc" }), "0.9.0", asset)).toBeNull();
		expect(pickReleaseAsset(payload({ browser_download_url: "https://evil.example/app.zip" }), "0.9.0", asset)).toBeNull();
		// an asset from another version must not be installed under this one
		expect(pickReleaseAsset(payload(), "0.9.1", asset)).toBeNull();
		expect(pickReleaseAsset(payload(), "0.9.0; rm -rf", asset)).toBeNull();
		expect(pickReleaseAsset({ message: "Not Found" }, "0.9.0", asset)).toBeNull();
	});
});
