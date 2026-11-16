// Compiled entry: embeds the renderer, which `bun build --compile` misses through the napi loader.
import renderer from "@gpuix/native-linux-x64-gnu/gpuix-native.linux-x64-gnu.node" with { type: "file" };

process.env.NAPI_RS_NATIVE_LIBRARY_PATH ??= renderer;
const { start } = await import("./app");
start();
