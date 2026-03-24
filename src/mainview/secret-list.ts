import type { Secret } from "../shared/models";

export type StatusFilter = "all" | "ready" | "attention";
export type InventorySortKey = "name" | "updated_at" | "version_count";
export type InventorySortDirection = "desc" | "asc";

export function getPathEntries(secrets: Secret[]): Array<[string, number]> {
	const pathCounts = new Map<string, number>();
	for (const secret of secrets) {
		pathCounts.set(secret.path, (pathCounts.get(secret.path) ?? 0) + 1);
	}

	return Array.from(pathCounts.entries()).sort((left, right) =>
		left[0].localeCompare(right[0]),
	);
}

export function filterSecrets(
	secrets: Secret[],
	{
		query,
		pathFilter,
		statusFilter,
	}: {
		query: string;
		pathFilter: string;
		statusFilter: StatusFilter;
	},
): Secret[] {
	const normalizedQuery = query.trim().toLowerCase();

	return secrets.filter((secret) => {
		if (
			pathFilter !== "all" &&
			secret.path !== pathFilter &&
			!secret.path.startsWith(`${pathFilter}/`)
		) {
			return false;
		}

		if (statusFilter === "ready" && secret.status !== "ready") {
			return false;
		}

		if (statusFilter === "attention" && secret.status === "ready") {
			return false;
		}

		if (!normalizedQuery) {
			return true;
		}

		const searchable = `${secret.name} ${secret.path}`.toLowerCase();
		return searchable.includes(normalizedQuery);
	});
}

export function sortSecrets(
	secrets: Secret[],
	{
		sortKey,
		sortDirection,
	}: {
		sortKey: InventorySortKey;
		sortDirection: InventorySortDirection;
	},
): Secret[] {
	return [...secrets].sort((left, right) => {
		const factor = sortDirection === "asc" ? 1 : -1;

		if (sortKey === "version_count") {
			const diff = left.version_count - right.version_count;
			if (diff !== 0) {
				return diff * factor;
			}
		} else if (sortKey === "updated_at") {
			const leftTime = new Date(left.updated_at).getTime();
			const rightTime = new Date(right.updated_at).getTime();
			if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
				return (leftTime - rightTime) * factor;
			}

			const fallbackDate = left.updated_at.localeCompare(right.updated_at);
			if (fallbackDate !== 0) {
				return fallbackDate * factor;
			}
		} else {
			const diff = left.name.localeCompare(right.name);
			if (diff !== 0) {
				return diff * factor;
			}
		}

		return left.name.localeCompare(right.name);
	});
}

export function reconcileSelectedSecretIds(
	visibleSecrets: Secret[],
	selectedSecretIds: Set<string>,
): Set<string> | null {
	if (visibleSecrets.length === 0) {
		return selectedSecretIds.size > 0 ? new Set() : null;
	}

	const filteredIds = new Set(visibleSecrets.map((secret) => secret.id));
	const stillValid = [...selectedSecretIds].filter((id) => filteredIds.has(id));
	if (stillValid.length === 0) {
		return new Set([visibleSecrets[0].id]);
	}

	if (stillValid.length !== selectedSecretIds.size) {
		return new Set(stillValid);
	}

	return null;
}
