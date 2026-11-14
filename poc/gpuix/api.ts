import type { ApiClient } from "../../src/shared/rpc";
import { sampleApi } from "./sample";

// Read-only slice the native addon accepts.
export type ReadApi = Pick<ApiClient, "getProfiles" | "getProjects" | "getSecrets" | "getSecretValue" | "getActiveVersionCounts">;

type Native = { call(method: string, params: string): Promise<string> };

function dlopen(path: string): unknown {
	const module = { exports: {} };
	process.dlopen(module, path);
	return module.exports;
}

function nativeApi(): ReadApi {
	// Static require so `bun build --compile` embeds the addon; Hermes executables dlopen it from beside the exe.
	const native = (process.env.SCW_NATIVE_ADDON ? dlopen(process.env.SCW_NATIVE_ADDON) : require("./scw-native.node")) as Native;
	return new Proxy({} as ReadApi, {
		get: (_, method: string) => async (params: unknown) =>
			JSON.parse(await native.call(method, JSON.stringify(params ?? {}))),
	});
}

export const api: ReadApi = process.env.SCW_GPUIX_SAMPLE === "1" ? sampleApi : nativeApi();
