import { useEffect, useState } from "react";

import type { LatestRelease } from "../../shared/models";
import { api } from "../lib/rpc";
import { dismissVersion, isNewerVersion, loadDismissedVersion } from "../lib/update-check";

// The newer release to offer, or null: up to date, check disabled, dismissed, or unreachable.
// checkNow() runs a manual check that bypasses both the setting and a past dismissal.
export function useAvailableUpdate(enabled: boolean, currentVersion: string) {
	const [latest, setLatest] = useState<LatestRelease | null>(null);
	const [dismissed, setDismissed] = useState(loadDismissedVersion);
	const [forced, setForced] = useState(false);

	/**
	 *  Asks the backend for the latest release once the check is enabled (at startup by
	 *  default). Failures resolve to null, so an offline start shows nothing.
	 */
	useEffect(() => {
		if (!enabled) return;
		api.getLatestRelease({}).then(setLatest, () => { /* best effort */ });
	}, [enabled]);

	const release =
		(enabled || forced) && latest && (forced || latest.version !== dismissed) && isNewerVersion(latest.version, currentVersion)
			? latest
			: null;

	function dismiss() {
		if (!release) return;
		dismissVersion(release.version);
		setDismissed(release.version);
		setForced(false);
	}

	async function checkNow(): Promise<LatestRelease | null> {
		const result = await api.getLatestRelease({});
		setLatest(result);
		setForced(true);
		return result;
	}

	return { release, dismiss, checkNow };
}
