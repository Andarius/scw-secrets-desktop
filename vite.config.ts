import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";

const isMock = process.env.VITE_MOCK === "1";

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
	resolve: isMock
		? {
				alias: {
					"electrobun/view": resolve(__dirname, "src/mainview/rpc.mock.ts"),
				},
			}
		: undefined,
	server: {
		port: 5181,
		strictPort: true,
	},
});
