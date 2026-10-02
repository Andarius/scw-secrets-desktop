// Pure decisions for the in-app update (no Deno globals, so it is unit-testable):
// which install can replace itself, and which release asset to trust.
import { VERSION_PATTERN } from "../shared/validation.ts";

const REPO = "Andarius/scw-secrets-desktop";

export type InstallTarget =
	| { kind: "macos"; appPath: string; asset: string }
	| { kind: "appimage"; path: string; asset: string };

export type ReleaseAsset = { url: string; sha256: string };

/** Pure: where this process can update itself, or null when it can't. */
export function detectInstallTarget(execPath: string, env: { APPIMAGE?: string }, os: string, arch: string): InstallTarget | null {
	if (os === "darwin") {
		// the release bundle is named ScwSecrets.app; dev runs from a cached bundle with another name
		const appPath = execPath.match(/^(\/.*\/ScwSecrets\.app)\/Contents\/MacOS\/[^/]+$/)?.[1];
		if (!appPath) return null;
		return { kind: "macos", appPath, asset: `ScwSecrets-macos-${arch === "aarch64" ? "arm64" : "x64"}.app.zip` };
	}
	if (os === "linux" && env.APPIMAGE?.startsWith("/")) {
		return { kind: "appimage", path: env.APPIMAGE, asset: "ScwSecrets.AppImage" };
	}
	return null;
}

/** Pure: the asset to download from a GitHub release payload, with its expected digest. */
export function pickReleaseAsset(payload: unknown, version: string, assetName: string): ReleaseAsset | null {
	if (!VERSION_PATTERN.test(version) || !payload || typeof payload !== "object") return null;
	const assets = (payload as { assets?: unknown }).assets;
	if (!Array.isArray(assets)) return null;
	const asset = assets.find((item) => item && typeof item === "object" && (item as { name?: unknown }).name === assetName) as
		| { browser_download_url?: unknown; digest?: unknown }
		| undefined;
	const expectedUrl = `https://github.com/${REPO}/releases/download/v${version}/${assetName}`;
	if (asset?.browser_download_url !== expectedUrl) return null;
	const sha256 = typeof asset.digest === "string" ? asset.digest.match(/^sha256:([0-9a-f]{64})$/)?.[1] : undefined;
	return sha256 ? { url: expectedUrl, sha256 } : null;
}
