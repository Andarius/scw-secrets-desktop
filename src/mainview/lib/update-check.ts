const DISMISSED_KEY = "scw-secrets-dismissed-update";

export const UPDATE_COMMAND = "curl -fsSL https://raw.githubusercontent.com/Andarius/scw-secrets-desktop/master/bin/quickstart.sh | bash";

const parts = (version: string) => version.replace(/^v/, "").split(".").map(Number);

/** True when `latest` is a strictly higher x.y.z than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
	const [a, b] = [parts(latest), parts(current)];
	const diff = [0, 1, 2].map((i) => (a[i] ?? 0) - (b[i] ?? 0)).find((d) => d !== 0);
	return (diff ?? 0) > 0;
}

export function loadDismissedVersion(): string | null {
	try {
		return localStorage.getItem(DISMISSED_KEY);
	} catch {
		return null;
	}
}

export function dismissVersion(version: string) {
	try {
		localStorage.setItem(DISMISSED_KEY, version);
	} catch {
		// ignore
	}
}
