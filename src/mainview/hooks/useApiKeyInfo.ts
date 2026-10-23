import { useEffect, useState } from "react";

import type { ApiKeyInfo } from "../../shared/models";
import { api } from "../lib/rpc";

// undefined while loading; null when the request itself failed.
export function useApiKeyInfo(profile: string | undefined): ApiKeyInfo | null | undefined {
	const [result, setResult] = useState<{ profile: string | undefined; info: ApiKeyInfo | null } | null>(null);

	useEffect(() => {
		let cancelled = false;
		api.getApiKeyInfo(profile ? { profile } : {}).then(
			(info) => { if (!cancelled) setResult({ profile, info }); },
			() => { if (!cancelled) setResult({ profile, info: null }); },
		);
		return () => { cancelled = true; };
	}, [profile]);

	return result && result.profile === profile ? result.info : undefined;
}
