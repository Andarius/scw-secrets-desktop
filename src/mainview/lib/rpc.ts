import { invoke } from "@tauri-apps/api/core";
import type { ApiClient, ApiMethod, ApiRequests } from "../../shared/rpc";
import { mockApi } from "../mock/rpc.mock";
import { isMock } from "./runtime";

async function call<K extends ApiMethod>(
	method: K,
	params: ApiRequests[K]["params"],
): Promise<ApiRequests[K]["response"]> {
	try {
		return await invoke<ApiRequests[K]["response"]>("rpc", { method, params });
	} catch (error) {
		throw error instanceof Error ? error : new Error(typeof error === "string" ? error : "request failed");
	}
}

const desktopApi = new Proxy({} as ApiClient, {
	get: (_target, method) => (params: unknown) => call(method as ApiMethod, params as never),
});

export const api: ApiClient = isMock ? mockApi : desktopApi;
