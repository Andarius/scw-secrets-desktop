import { readFileSync } from "node:fs";
import type { ElectrobunConfig } from "electrobun";

const packageJson = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
	version: string;
};

export default {
	app: {
		name: "Scw Secrets",
		identifier: "dev.julien.scw-secrets",
		version: process.env.ELECTROBUN_APP_VERSION?.trim() || packageJson.version,
	},
	build: {
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"icon.png": "appIcon.png",
		},
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
			icons: "icon.iconset",
		},
		linux: {
			bundleCEF: false,
			icon: "icon.png",
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
