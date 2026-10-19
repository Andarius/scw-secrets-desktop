import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { basename, join } from "node:path";

function collectFiles(root: string): string[] {
	const entries = readdirSync(root);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(root, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory() && !entry.endsWith(".app")) {
			files.push(...collectFiles(fullPath));
		} else if (stat.isFile()) {
			files.push(fullPath);
		}
	}

	return files;
}

const releaseTag = Bun.env.RELEASE_TAG?.trim();
const ghRepo = Bun.env.GH_REPO?.trim();

if (!releaseTag) {
	throw new Error("RELEASE_TAG is required");
}

const artifactsDir = join(process.cwd(), "src-tauri", "target", "release", "bundle");
if (!existsSync(artifactsDir)) {
	throw new Error(`Artifacts directory not found: ${artifactsDir}`);
}

// Upload distributables only; native bundle directories contain intermediate files.
const DIST_EXT_RE = /\.(AppImage|deb|rpm|dmg|msi|zip|snap)$/i;
const artifactFiles = collectFiles(artifactsDir).filter((file) => DIST_EXT_RE.test(file));
if (artifactFiles.length === 0) {
	throw new Error(`No distributable files found in ${artifactsDir}`);
}

const stagingDir = join(process.cwd(), ".release-assets");
rmSync(stagingDir, { force: true, recursive: true });
mkdirSync(stagingDir, { recursive: true });

const stagedFiles: string[] = [];
for (const filePath of artifactFiles) {
	const name = filePath.endsWith(".AppImage")
		? "ScwSecrets.AppImage"
		: filePath.endsWith(".msi")
			? "ScwSecrets.msi"
			: basename(filePath);
	const stagedPath = join(stagingDir, name);
	if (existsSync(stagedPath)) {
		throw new Error(`Duplicate release asset: ${name}`);
	}
	cpSync(filePath, stagedPath);
	stagedFiles.push(stagedPath);
}

console.log(`Uploading ${stagedFiles.length} files to GitHub release ${releaseTag}`);
for (const filePath of stagedFiles) {
	console.log(`- ${basename(filePath)}`);
}

const upload = Bun.spawn({
	cmd: [
		"gh",
		"release",
		"upload",
		releaseTag,
		...(ghRepo ? ["--repo", ghRepo] : []),
		...stagedFiles,
		"--clobber",
	],
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
	env: process.env,
});

// .release-assets stays for the release workflow's sign job
process.exit(await upload.exited);
