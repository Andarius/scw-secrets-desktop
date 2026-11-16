// Hermes entry: the native libraries sit beside the executable (or the bundle in dev).
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const dir = [dirname(process.execPath), dirname(resolve(process.argv[1] ?? ""))].find((candidate) => existsSync(join(candidate, "scw-native.node")));
if (!dir) throw new Error("scw-native.node not found beside the executable");
process.env.NAPI_RS_NATIVE_LIBRARY_PATH ??= join(dir, "gpuix-native.node");
process.env.SCW_NATIVE_ADDON ??= join(dir, "scw-native.node");
require("../app").start();
