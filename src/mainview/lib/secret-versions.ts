import type { Secret, SecretVersion } from "../../shared/models";
import { api } from "./rpc";

export type SecretVersionAction =
	| { type: "disable"; revision: number }
	| { type: "destroy"; revision: number };

export function isVersionDeleted(status: string): boolean {
	return status === "scheduled_for_deletion" || status === "destroyed";
}

export function planKeepLatestVersionOnly(
	versions: SecretVersion[],
): SecretVersionAction[] {
	const remainingVersions = versions.filter((version) => !isVersionDeleted(version.status));
	const latestRevision =
		remainingVersions.find((version) => version.latest)?.revision ?? remainingVersions[0]?.revision;

	if (latestRevision === undefined) {
		return [];
	}

	const actions: SecretVersionAction[] = [];
	for (const version of versions) {
		if (isVersionDeleted(version.status) || version.revision === latestRevision) {
			continue;
		}

		if (version.status === "enabled") {
			actions.push({ type: "disable", revision: version.revision });
		}

		actions.push({ type: "destroy", revision: version.revision });
	}

	return actions;
}

// Scaleway never reuses revision numbers, so the next write lands one above the highest seen.
export function nextRevision(versions: SecretVersion[]): number {
	return Math.max(0, ...versions.map((version) => version.revision)) + 1;
}

const applyVersionAction = {
	disable: api.disableSecretVersion,
	destroy: api.destroySecretVersion,
};

export async function keepLatestVersionOnly(secretId: string, profile?: string, projectId?: string): Promise<void> {
	const versions = await api.getSecretVersions({ secretId, profile, projectId });
	// sequential: a revision is disabled before it is destroyed
	for (const { type, revision } of planKeepLatestVersionOnly(versions)) {
		await applyVersionAction[type]({ secretId, revision, profile, projectId });
	}
}

// Falls back to version_count (which includes deleted versions) while active counts are unknown.
export function activeVersionCount(secret: Secret, activeCounts: ReadonlyMap<string, number> | null): number {
	return activeCounts?.get(secret.id) ?? secret.version_count;
}
