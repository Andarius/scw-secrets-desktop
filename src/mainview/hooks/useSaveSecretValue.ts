import { useState } from "react";

import { api } from "../rpc";
import { planKeepLatestVersionOnly } from "../secret-versions";

type SaveTarget = {
	secretId: string;
	profile?: string;
	projectId?: string;
	autoKeepLatest?: boolean;
};

const applyVersionAction = {
	disable: api.disableSecretVersion,
	destroy: api.destroySecretVersion,
};

// Scaleway versions are immutable: every save writes a new revision. With Keep Latest on,
// older revisions are then disabled and scheduled for deletion.
export function useSaveSecretValue({ secretId, profile, projectId, autoKeepLatest }: SaveTarget, onSaved: () => void) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function keepLatestOnly() {
		const versions = await api.getSecretVersions({ secretId, profile, projectId });
		// sequential: a revision is disabled before it is destroyed
		for (const { type, revision } of planKeepLatestVersionOnly(versions)) {
			await applyVersionAction[type]({ secretId, revision, profile, projectId });
		}
	}

	async function save(value: string) {
		setSaving(true);
		setError(null);
		try {
			await api.updateSecretValue({ secretId, value, profile, projectId });
			if (autoKeepLatest) await keepLatestOnly();
			onSaved();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setSaving(false);
		}
	}

	return { save, saving, error };
}
