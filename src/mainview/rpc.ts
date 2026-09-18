import type { ApiClient, ApiMethod, ApiRequests } from "../shared/rpc";
import { mockApi } from "./rpc.mock";

function sessionToken(): string | null {
	if (typeof window === "undefined") return null;
	const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
	if (token) {
		window.history.replaceState(null, "", window.location.pathname + window.location.search);
		try { sessionStorage.setItem("scw-session-token", token); } catch { /* storage may be disabled */ }
		return token;
	}
	try { return sessionStorage.getItem("scw-session-token"); } catch { return null; }
}

const token = sessionToken();

async function call<K extends ApiMethod>(
	method: K,
	params: ApiRequests[K]["params"],
): Promise<ApiRequests[K]["response"]> {
	const response = await fetch(`/api/${method}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
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
