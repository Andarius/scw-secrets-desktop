import { useEffect, useMemo, useState } from "react";

import { api } from "../lib/rpc";
import type { EphemeralProperties, Secret } from "../../shared/models";

// Only secrets with an expiration policy are queried; others map to nothing. Empty until the fetch resolves.
export function useVersionExpiries(secrets: Secret[], profile?: string, projectId?: string) {
	const [expiries, setExpiries] = useState<ReadonlyMap<string, EphemeralProperties | null>>(new Map());
	const candidateIds = useMemo(() => secrets.filter((s) => s.ephemeral_policy).map((s) => s.id), [secrets]);

	useEffect(() => {
		let cancelled = false;
		if (candidateIds.length === 0) {
			setExpiries(new Map());
			return;
		}
		api.getVersionExpiries({ secretIds: candidateIds, profile, projectId }).then(
			(response) => {
				if (!cancelled) setExpiries(new Map(Object.entries(response.expiries)));
			},
			(err) => {
				if (!cancelled) console.error("Failed to fetch version expiries", err);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [candidateIds, profile, projectId]);

	return expiries;
}
