// Bundles the app to CJS for hermes-node (no ESM) and puts size-optimized native libraries beside it.
import { $ } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const mac = process.platform === "darwin";
const renderer = mac ? "native-darwin-arm64/gpuix-native.darwin-arm64.node" : "native-linux-x64-gnu/gpuix-native.linux-x64-gnu.node";
const out = join(root, "dist-hermes");
const build = await Bun.build({
	entrypoints: [join(import.meta.dir, "main.ts")],
	outdir: out,
	naming: "app.cjs",
	target: "node",
	format: "cjs",
	minify: true,
	define: { "process.env.NODE_ENV": '"production"' },
	banner:
		'if(typeof queueMicrotask!=="function"){globalThis.queueMicrotask=function(f){process.nextTick(f)};}if(typeof performance==="undefined"){globalThis.performance={now:function(){var t=process.hrtime();return t[0]*1e3+t[1]/1e6}}}',
	plugins: [{
		name: "native-beside-exe",
		setup(b) {
			b.onResolve({ filter: /\.node$/ }, (args) => ({ path: args.path, external: true }));
			b.onLoad({ filter: /@gpuix\/native\/index\.js$/ }, async () => ({ contents: await Bun.file(join(import.meta.dir, "native-loader.js")).text(), loader: "js" }));
			// Hermes cannot parse import(); the automation client only uses it for node builtins.
			b.onLoad({ filter: /@gpuix\/native\/dist\/automation\/client\.js$/ }, async (args) => ({
				contents: (await Bun.file(args.path).text()).replace("return import(specifier);", "return Promise.resolve(require(specifier));"),
				loader: "js",
			}));
		},
	}],
});
if (!build.success) throw new AggregateError(build.logs, "build failed");
await $`cp ${join(root, "node_modules/@gpuix", renderer)} ${join(out, "gpuix-native.node")}`;
await $`cargo build --profile dist`.cwd(join(root, "native")).env({ ...process.env, RUSTC_WRAPPER: "" }).quiet();
await $`cp ${join(root, "native/target/dist", mac ? "libscw_gpuix_native.dylib" : "libscw_gpuix_native.so")} ${join(out, "scw-native.node")}`;
await (mac ? $`strip -x ${join(out, "gpuix-native.node")}` : $`strip --strip-unneeded ${join(out, "gpuix-native.node")}`);

// Links dist-hermes/scw-secrets: the runtime with the bytecode bundle appended. macOS needs a source build (see README).
const hermes = process.env.HERMES_NODE ?? join(import.meta.dir, "hermes-node-0.0.2-linux-x64/hermes-node");
await $`${hermes} --build-bundle=app.bundle app.cjs`.cwd(out).quiet();
await $`${hermes} --build-exe=scw-secrets --kit=${process.env.HERMES_KIT ?? join(hermes, "..", "kit")} app.bundle`.cwd(out).quiet();
await $`rm app.bundle`.cwd(out);
