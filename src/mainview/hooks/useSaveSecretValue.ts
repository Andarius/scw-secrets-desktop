import { useState } from "react";

import { api } from "../lib/rpc";
import { keepLatestVersionOnly } from "../lib/secret-versions";
import { normalizeKeyValue } from "../lib/value-format";

type SaveTarget = {
	secretId: string;
	profile?: string;
	projectId?: string;
	autoKeepLatest?: boolean;
	secretType?: string;
};

// Scaleway versions are immutable: every save writes a new revision. With Keep Latest on,
// older revisions are then disabled and scheduled for deletion.
export function useSaveSecretValue({ secretId, profile, projectId, autoKeepLatest, secretType }: SaveTarget, onSaved: () => void) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function save(value: string) {
		setSaving(true);
		setError(null);
		try {
			if (secretType === "key_value") value = normalizeKeyValue(value);
			await api.updateSecretValue({ secretId, value, profile, projectId });
			if (autoKeepLatest) await keepLatestVersionOnly(secretId, profile, projectId);
			onSaved();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setSaving(false);
		}
	}

	return { save, saving, error };
}
