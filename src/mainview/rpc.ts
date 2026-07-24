import type { ApiClient, ApiMethod, ApiRequests } from "../shared/rpc";
import { mockApi } from "./rpc.mock";

async function call<K extends ApiMethod>(
	method: K,
	params: ApiRequests[K]["params"],
): Promise<ApiRequests[K]["response"]> {
	const response = await fetch(`/api/${method}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(params),
	});
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		const message = (data as { error?: string } | null)?.error;
		throw new Error(message || `${response.status} ${response.statusText}`);
	}
	return data as ApiRequests[K]["response"];
}

const httpApi = new Proxy({} as ApiClient, {
	get: (_target, method) => (params: unknown) => call(method as ApiMethod, params as never),
});

export const api: ApiClient = import.meta.env.VITE_MOCK === "1" ? mockApi : httpApi;
