// Latest published release, used by the frontend to offer an update. Best effort: any
// failure (offline, rate limit, unexpected payload) yields null and never surfaces an error.
import type { LatestRelease } from "../shared/models.ts";

const REPO = "Andarius/scw-secrets-desktop";
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASE_PAGE_PREFIX = `https://github.com/${REPO}/releases/`;
const TIMEOUT_MS = 5000;

/** Pure: validates the GitHub payload, so a tampered response can't inject a URL or label. */
export function parseLatestRelease(payload: unknown): LatestRelease | null {
	if (!payload || typeof payload !== "object") return null;
	const { tag_name, html_url, draft, prerelease } = payload as Record<string, unknown>;
	if (draft || prerelease) return null;
	if (typeof tag_name !== "string" || !/^v?\d+\.\d+\.\d+$/.test(tag_name)) return null;
	if (typeof html_url !== "string" || !html_url.startsWith(RELEASE_PAGE_PREFIX)) return null;
	return { version: tag_name.replace(/^v/, ""), url: html_url };
}

export async function getLatestRelease(): Promise<LatestRelease | null> {
	try {
		const response = await fetch(LATEST_RELEASE_URL, {
			headers: { accept: "application/vnd.github+json", "user-agent": "scw-secrets-desktop" },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		return response.ok ? parseLatestRelease(await response.json()) : null;
	} catch {
		return null;
	}
}
