#!/usr/bin/env bun
// DESCRIPTION: Run e2e tests with video recording, then concatenate all clips into a single video with test name overlays and click/input indicators
// USAGE: bun scripts/record-e2e.ts [--output videos/e2e.mp4] [--slow-mo 200]

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
	options: {
		output: { type: "string", short: "o", default: "videos/e2e.mp4" },
		"slow-mo": { type: "string", short: "s", default: "150" },
	},
	strict: false,
});

const outputPath = values.output as string;
const slowMo = values["slow-mo"] as string;
const jsonReportPath = "test-results/e2e-report.json";
const testResultsDir = "test-results";

// Step 1: Run Playwright with video + JSON reporter
console.log("Running e2e tests with video recording...");
const env: Record<string, string> = {
	...process.env as Record<string, string>,
	PW_VIDEO: "1",
	PLAYWRIGHT_JSON_OUTPUT_NAME: jsonReportPath,
};
if (Number(slowMo) > 0) {
	env.PW_SLOW_MO = slowMo;
}

const pw = Bun.spawnSync(
	["npx", "playwright", "test", "--reporter=json", "--workers=1"],
	{ env, stdout: "pipe", stderr: "pipe" },
);

if (pw.exitCode !== 0) {
	console.error("Playwright failed:");
	console.error(pw.stdout.toString().slice(-2000));
	console.error(pw.stderr.toString());
	process.exit(1);
}

// Step 2: Parse JSON report to get test names and video paths in order
if (!existsSync(jsonReportPath)) {
	console.error(`JSON report not found at ${jsonReportPath}`);
	process.exit(1);
}

type PwAttachment = { name: string; path: string; contentType: string };
type PwResult = { attachments: PwAttachment[] };
type PwSpec = {
	title: string;
	tests: Array<{ results: PwResult[] }>;
};
type PwSuite = {
	title: string;
	specs: PwSpec[];
	suites?: PwSuite[];
};
type PwReport = { suites: PwSuite[] };

const report = JSON.parse(readFileSync(jsonReportPath, "utf8")) as PwReport;

type TestClip = { title: string; videoPath: string };
const clips: TestClip[] = [];

function extractClips(suites: PwSuite[]) {
	for (const suite of suites) {
		for (const spec of suite.specs) {
			for (const test of spec.tests) {
				for (const result of test.results) {
					const videoAttachment = result.attachments.find(
						(a) => a.name === "video" && a.path,
					);
					if (videoAttachment) {
						clips.push({
							title: spec.title,
							videoPath: videoAttachment.path,
						});
					}
				}
			}
		}
		if (suite.suites) {
			extractClips(suite.suites);
		}
	}
}

extractClips(report.suites);

if (clips.length === 0) {
	console.error("No video clips found in the report");
	process.exit(1);
}

console.log(`Found ${clips.length} test clips`);

// Step 3: Generate title card + overlay for each clip, then concatenate
const tmpDir = join(testResultsDir, "_concat_tmp");
if (!existsSync(tmpDir)) {
	mkdirSync(tmpDir, { recursive: true });
}

const overlaidPaths: string[] = [];

for (let i = 0; i < clips.length; i++) {
	const clip = clips[i];
	const overlaidPath = resolve(tmpDir, `clip_${i}.mp4`);
	const counter = `${i + 1}/${clips.length}`;

	console.log(`  [${counter}] ${clip.title}`);

	const escapedTitle = clip.title.replace(/'/g, "'\\''").replace(/:/g, "\\:");
	const escapedCounter = counter.replace(/'/g, "'\\''");

	// Probe duration for fade-out
	const probeRes = Bun.spawnSync([
		"ffprobe", "-v", "quiet", "-print_format", "json", "-show_format",
		clip.videoPath,
	], { stdout: "pipe" });
	const probe = JSON.parse(probeRes.stdout.toString()) as { format: { duration: string } };
	const duration = Number.parseFloat(probe.format.duration) || 3;
	const fadeOut = Math.max(duration - 0.3, 0);

	// Re-encode clip to h264 with counter + test name banner and fades
	const overlay = Bun.spawnSync([
		"ffmpeg", "-y",
		"-i", clip.videoPath,
		"-vf", [
			`fade=t=in:st=0:d=0.3`,
			`fade=t=out:st=${fadeOut.toFixed(2)}:d=0.3`,
			`drawbox=x=0:y=0:w=iw:h=28:color=0x0a0a0a@0.8:t=fill`,
			`drawtext=text='${escapedCounter}':fontcolor=0x666666:fontsize=13:x=8:y=7:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf`,
			`drawtext=text='${escapedTitle}':fontcolor=0x67e8f9:fontsize=13:x=50:y=7:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf`,
		].join(","),
		"-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25",
		overlaidPath,
	], { stdout: "pipe", stderr: "pipe" });

	if (overlay.exitCode !== 0) {
		console.error(`Failed to overlay "${clip.title}"`);
		console.error(overlay.stderr.toString());
		process.exit(1);
	}

	overlaidPaths.push(overlaidPath);
}

// Step 4: Concatenate all clips
const concatListPath = join(tmpDir, "concat.txt");
const concatContent = overlaidPaths.map((p) => `file '${p}'`).join("\n");
writeFileSync(concatListPath, concatContent);

const outDir = dirname(outputPath);
if (!existsSync(outDir)) {
	mkdirSync(outDir, { recursive: true });
}

console.log(`Concatenating into ${outputPath}...`);
const concat = Bun.spawnSync([
	"ffmpeg", "-y",
	"-f", "concat", "-safe", "0",
	"-i", concatListPath,
	"-c:v", "libx264", "-pix_fmt", "yuv420p",
	"-movflags", "+faststart",
	outputPath,
], { stdout: "pipe", stderr: "pipe" });

if (concat.exitCode !== 0) {
	console.error("Failed to concatenate clips");
	console.error(concat.stderr.toString());
	process.exit(1);
}

// Cleanup temp files
for (const p of overlaidPaths) {
	try { unlinkSync(p); } catch {}
}
try { unlinkSync(concatListPath); } catch {}
try { unlinkSync(jsonReportPath); } catch {}

// Get output file size
const stat = Bun.file(outputPath);
const sizeMb = ((await stat.size) / 1024 / 1024).toFixed(1);

console.log(`\nDone! ${clips.length} tests recorded → ${outputPath} (${sizeMb} MB)`);
