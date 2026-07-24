import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";

export default defineConfig({
	plugins: [react()],
	define: {
		APP_VERSION: JSON.stringify(packageJson.version),
	},
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5181,
		strictPort: true,
		// deno backend (deno task serve)
		proxy: {
			"/api": "http://127.0.0.1:8790",
		},
	},
});
