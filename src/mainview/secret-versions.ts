import type { SecretVersion } from "../shared/models";

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
