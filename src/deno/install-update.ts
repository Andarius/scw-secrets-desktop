// In-app update: download the release asset for this platform, verify it against the
// SHA-256 digest GitHub publishes, swap it in place of the running app, and relaunch.
// Only for installs that can replace themselves without root: a macOS ScwSecrets.app bundle
// and a Linux AppImage. Everything else (snap, .deb, .msi, source) keeps the copy command.
import { detectInstallTarget, pickReleaseAsset, type InstallTarget } from "./install-target.ts";

const REPO = "Andarius/scw-secrets-desktop";

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function run(executable: string, args: string[]): Promise<void> {
	const { success, stderr } = await new Deno.Command(executable, { args, stdout: "null", stderr: "piped" }).output();
	if (!success) throw new Error(`${executable} failed: ${new TextDecoder().decode(stderr).trim()}`);
}

// Starts the new app once this process is gone, independently of it.
function relaunch(command: string[]): void {
	new Deno.Command("/bin/sh", { args: ["-c", 'sleep 1; exec "$@"', "sh", ...command], stdout: "null", stderr: "null" })
		.spawn()
		.unref();
}

async function replaceMacosApp(appPath: string, zip: Uint8Array): Promise<void> {
	const workDir = await Deno.makeTempDir({ prefix: "scw-secrets-update-" });
	try {
		await Deno.writeFile(`${workDir}/update.zip`, zip);
		await run("/usr/bin/ditto", ["-xk", `${workDir}/update.zip`, `${workDir}/extract`]);
		await Deno.stat(`${workDir}/extract/ScwSecrets.app/Contents/MacOS`);
		// stage next to the app (same volume) so the final swap is two atomic renames
		const staged = `${appPath}.new`;
		const previous = `${appPath}.old`;
		await Deno.remove(staged, { recursive: true }).catch(() => {});
		await Deno.remove(previous, { recursive: true }).catch(() => {});
		await run("/usr/bin/ditto", [`${workDir}/extract/ScwSecrets.app`, staged]);
		await run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", staged]).catch(() => {});
		await Deno.rename(appPath, previous);
		await Deno.rename(staged, appPath).catch(async (error) => {
			await Deno.rename(previous, appPath);
			throw error;
		});
		await Deno.remove(previous, { recursive: true }).catch(() => {});
	} finally {
		await Deno.remove(workDir, { recursive: true }).catch(() => {});
	}
	relaunch(["/usr/bin/open", "-n", appPath]);
}

async function replaceAppImage(path: string, binary: Uint8Array): Promise<void> {
	const staged = `${path}.new`;
	await Deno.writeFile(staged, binary, { mode: 0o755 });
	// rename over the running file is safe; writing into it would fail (text file busy)
	await Deno.rename(staged, path);
	relaunch([path]);
}

function currentTarget(): InstallTarget | null {
	return detectInstallTarget(Deno.execPath(), { APPIMAGE: Deno.env.get("APPIMAGE") }, Deno.build.os, Deno.build.arch);
}

export function canInstallUpdate(): boolean {
	return currentTarget() !== null;
}

/** Downloads, verifies and installs `version`, then quits so the relaunched app takes over. */
export async function installUpdate(version: string): Promise<void> {
	const target = currentTarget();
	if (!target) throw new Error("this install can't update itself; run the update command instead");

	const release = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/v${version}`, {
		headers: { accept: "application/vnd.github+json", "user-agent": "scw-secrets-desktop" },
		signal: AbortSignal.timeout(10_000),
	});
	if (!release.ok) throw new Error(`release v${version} not found (${release.status})`);
	const asset = pickReleaseAsset(await release.json(), version, target.asset);
	if (!asset) throw new Error(`release v${version} has no verifiable ${target.asset}`);

	const download = await fetch(asset.url, { signal: AbortSignal.timeout(5 * 60_000) });
	if (!download.ok) throw new Error(`download failed (${download.status})`);
	const bytes = new Uint8Array(await download.arrayBuffer());
	if (await sha256Hex(bytes) !== asset.sha256) throw new Error("downloaded file doesn't match the published SHA-256");

	if (target.kind === "macos") await replaceMacosApp(target.appPath, bytes);
	else await replaceAppImage(target.path, bytes);

	// let the HTTP response reach the window before quitting
	setTimeout(() => Deno.exit(0), 300);
}
