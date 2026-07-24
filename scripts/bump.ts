// DESCRIPTION: Bump package.json version, commit, and create a git tag.
// USAGE: bun run bump <version|patch|minor|major>
// EXAMPLES:
//   bun run bump 0.3.0
//   bun run bump patch   # 0.2.0 → 0.2.1
//   bun run bump minor   # 0.2.0 → 0.3.0

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkgPath = new URL("../package.json", import.meta.url).pathname;
const denoPath = new URL("../deno.json", import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const denoJson = JSON.parse(readFileSync(denoPath, "utf8"));
const current = pkg.version as string;

const arg = process.argv[2];
if (!arg) {
	console.error(`Current version: ${current}`);
	console.error("Usage: bun run bump <version|patch|minor|major>");
	process.exit(1);
}

function increment(version: string, part: "patch" | "minor" | "major"): string {
	const [major, minor, patch] = version.split(".").map(Number);
	switch (part) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
	}
}

const next =
	arg === "patch" || arg === "minor" || arg === "major"
		? increment(current, arg)
		: arg.replace(/^v/, "");

if (!/^\d+\.\d+\.\d+$/.test(next)) {
	console.error(`Invalid version: ${next}`);
	process.exit(1);
}

if (next === current) {
	console.error(`Already at ${current}`);
	process.exit(1);
}

const tag = `v${next}`;
const run = (cmd: string) => execSync(cmd, { stdio: "inherit" });

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
denoJson.version = next;
writeFileSync(denoPath, `${JSON.stringify(denoJson, null, "\t")}\n`);

run("git add package.json deno.json");
run(`git commit -m "chore: bump version to ${next}"`);
run(`git tag -a ${tag} -m ${tag}`);

console.log(`\n${current} → ${next}`);
console.log(`Push with: git push origin HEAD && git push origin ${tag}`);
