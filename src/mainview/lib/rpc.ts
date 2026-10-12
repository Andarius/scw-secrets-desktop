import { invoke } from "@tauri-apps/api/core";
import type { ApiClient, ApiMethod, ApiRequests } from "../../shared/rpc";
import { mockApi } from "../mock/rpc.mock";

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

export const api: ApiClient = import.meta.env.VITE_MOCK === "1" ? mockApi : desktopApi;
