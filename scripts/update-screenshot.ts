#!/usr/bin/env bun
// DESCRIPTION: Take a screenshot of the mock app and save it as docs/screenshot.png
// USAGE: bun scripts/update-screenshot.ts [--width 1440] [--height 900]

import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { values } = parseArgs({
	options: {
		width: { type: "string", default: "1440" },
		height: { type: "string", default: "900" },
	},
	strict: true,
});

const width = Number(values.width);
const height = Number(values.height);

const chromiumExecutable = [
	process.env.PW_CHROMIUM_EXECUTABLE_PATH,
	"/snap/chromium/current/usr/lib/chromium-browser/chrome",
].find((candidate): candidate is string => Boolean(candidate) && existsSync(candidate));

const mockServerUrl = "http://127.0.0.1:5199";
const outputPath = "docs/screenshot.png";

const server = Bun.spawn(["bun", "run", "mock:e2e"], {
	stdout: "pipe",
	stderr: "pipe",
});

async function waitForServer(url: string, timeoutMs = 15_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
		} catch {
			// not ready yet
		}
		await Bun.sleep(250);
	}
	throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

try {
	await waitForServer(mockServerUrl);

	const browser = await chromium.launch({
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
		...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
	});
	const page = await browser.newPage({ viewport: { width, height } });
	await page.goto(mockServerUrl, { waitUntil: "networkidle" });
	await page.screenshot({ path: outputPath, type: "png" });
	await browser.close();

	console.log(`Screenshot saved to ${outputPath} (${width}x${height})`);
} finally {
	server.kill();
}
