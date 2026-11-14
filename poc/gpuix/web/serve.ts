// Serves the app on gpuix's WASM renderer with sample data, for headless screenshots.
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const out = join(import.meta.dir, "dist");
const build = await Bun.build({
	entrypoints: [join(import.meta.dir, "main.tsx")],
	outdir: out,
	target: "browser",
	plugins: [{
		name: "sample-api",
		setup(b) {
			b.onResolve({ filter: /^\.\/api$/ }, (args) =>
				args.importer.startsWith(root) && !args.importer.includes("/web/") ? { path: join(import.meta.dir, "api.ts") } : undefined);
		},
	}],
});
if (!build.success) throw new AggregateError(build.logs, "build failed");

const port = Number(process.env.PORT ?? 5299);
Bun.serve({
	port,
	hostname: "127.0.0.1",
	async fetch(req) {
		const path = new URL(req.url).pathname;
		const file = Bun.file(path === "/" ? join(import.meta.dir, "index.html") : join(out, path));
		if (!(await file.exists())) return new Response("not found", { status: 404 });
		// threads need SharedArrayBuffer, which needs cross-origin isolation
		return new Response(file, { headers: { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" } });
	},
});
console.log(`http://127.0.0.1:${port}`);
