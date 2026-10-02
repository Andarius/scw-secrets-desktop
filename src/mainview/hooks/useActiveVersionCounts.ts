import { useEffect, useMemo, useState } from "react";

import { api } from "../lib/rpc";
import type { Secret } from "../../shared/models";

// Scaleway's version_count includes versions scheduled for deletion; this counts only active ones.
// Refetches whenever the secrets list is reloaded; null until the first fetch resolves.
export function useActiveVersionCounts(secrets: Secret[], profile?: string, projectId?: string) {
	const [activeCounts, setActiveCounts] = useState<ReadonlyMap<string, number> | null>(null);
	const [loading, setLoading] = useState(false);
	const candidateIds = useMemo(() => secrets.filter((s) => s.version_count > 1).map((s) => s.id), [secrets]);

	useEffect(() => {
		let cancelled = false;
		if (candidateIds.length === 0) {
			setActiveCounts(new Map());
			setLoading(false);
			return;
		}
		setLoading(true);
		api.getActiveVersionCounts({ secretIds: candidateIds, profile, projectId }).then(
			(response) => {
				if (!cancelled) setActiveCounts(new Map(Object.entries(response.counts).map(([k, v]) => [k, Number(v)])));
			},
			(err) => {
				if (cancelled) return;
				console.error("Failed to fetch active version counts", err);
				setActiveCounts(new Map());
			},
		).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [candidateIds, profile, projectId]);

	return { activeCounts, loading };
}
