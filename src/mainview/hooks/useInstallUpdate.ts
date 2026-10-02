import { useEffect, useState } from "react";

import { api } from "../lib/rpc";

// Whether this install can update itself (macOS bundle, AppImage), and the install action.
// On success the backend quits and relaunches the new version, so there is no "done" state.
export function useInstallUpdate() {
	const [canInstall, setCanInstall] = useState(false);
	const [installing, setInstalling] = useState(false);
	const [error, setError] = useState<string | null>(null);

	/**
	 *  Asks the backend once whether in-app install is possible here; on failure the
	 *  button stays hidden and the copy command remains the way to update.
	 */
	useEffect(() => {
		api.getUpdateSupport({}).then(({ canInstall }) => setCanInstall(canInstall), () => {});
	}, []);

	async function install(version: string) {
		setInstalling(true);
		setError(null);
		try {
			await api.installUpdate({ version });
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
			setInstalling(false);
		}
	}

	return { canInstall, installing, error, install };
}
