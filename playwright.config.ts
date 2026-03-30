import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const parsedSlowMo = Number(process.env.PW_SLOW_MO ?? 0);
const slowMo = Number.isFinite(parsedSlowMo) && parsedSlowMo > 0 ? parsedSlowMo : 0;
const recordVideo = process.env.PW_VIDEO === "1";
const chromiumExecutable = [
	process.env.PW_CHROMIUM_EXECUTABLE_PATH,
	"/snap/chromium/current/usr/lib/chromium-browser/chrome",
].find((candidate): candidate is string => Boolean(candidate) && existsSync(candidate));

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "**/*.e2e.ts",
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	fullyParallel: true,
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:5199",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		...(recordVideo ? { video: "on" } : {}),
	},
	webServer: {
		command: "bun run mock:e2e",
		url: "http://127.0.0.1:5199",
		reuseExistingServer: true,
		timeout: 120_000,
	},
	projects: [
		{
			name: "chromium",
			use: {
				browserName: "chromium",
				launchOptions: {
					args: ["--no-sandbox", "--disable-dev-shm-usage"],
					...(slowMo > 0 ? { slowMo } : {}),
					...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
				},
			},
		},
	],
});
