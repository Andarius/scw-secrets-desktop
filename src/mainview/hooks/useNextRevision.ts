import { useEffect, useState } from "react";

import { api } from "../rpc";
import { nextRevision } from "../secret-versions";

type RevisionTarget = {
	secretId: string;
	profile?: string;
	projectId?: string;
};

// Fetched lazily (once the user has changes) so opening a value never costs an extra call.
// Keyed by target so a late response for another secret is ignored. null while unknown or
// on failure — callers fall back to a generic hint.
export function useNextRevision({ secretId, profile, projectId }: RevisionTarget, enabled: boolean): number | null {
	const [result, setResult] = useState<{ key: string; revision: number } | null>(null);
	const key = `${profile ?? ""}/${projectId ?? ""}/${secretId}`;
	const isCurrent = result?.key === key;

	/**
	 *  Fetches the secret's versions once the user has changes, unless already resolved for
	 *  this target, and stores the next revision tagged with the key it was requested for.
	 *  Re-runs on first change, once resolved (then bails out) and when the target changes.
	 */
	useEffect(() => {
		if (!enabled || isCurrent) return;
		api.getSecretVersions({ secretId, profile, projectId }).then(
			(versions) => setResult({ key, revision: nextRevision(versions) }),
			() => { /* keep the generic hint */ },
		);
	}, [enabled, isCurrent, key, secretId, profile, projectId]);

	return isCurrent ? result.revision : null;
}
