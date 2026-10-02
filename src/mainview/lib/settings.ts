const SETTINGS_KEY = "scw-secrets-settings";

export type AppSettings = {
	autoKeepLatest: boolean;
	/** Ask GitHub for a newer release at startup. */
	checkForUpdates: boolean;
};

const defaults: AppSettings = {
	autoKeepLatest: false,
	checkForUpdates: true,
};

export function loadSettings(): AppSettings {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (raw) {
			return { ...defaults, ...(JSON.parse(raw) as Partial<AppSettings>) };
		}
	} catch {
		// ignore
	}
	return { ...defaults };
}

export function saveSettings(settings: AppSettings) {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
	} catch {
		// ignore
	}
}
