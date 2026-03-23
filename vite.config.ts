import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isMock = process.env.VITE_MOCK === "1";

export default defineConfig({
	plugins: [react()],
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
		port: 5173,
		strictPort: true,
	},
});
