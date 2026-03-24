import type { Secret } from "../shared/models";

export type SelectionState = {
	selectedSecretIds: Set<string>;
	lastClickedIndex: number | null;
};

export function getNextSelectionState(
	secrets: Secret[],
	selectedSecretIds: Set<string>,
	lastClickedIndex: number | null,
	clickedSecret: Secret,
	clickedIndex: number,
	{
		shiftKey,
		ctrlKey,
		metaKey,
	}: {
		shiftKey: boolean;
		ctrlKey: boolean;
		metaKey: boolean;
	},
): SelectionState {
	if (shiftKey && lastClickedIndex !== null) {
		const start = Math.min(lastClickedIndex, clickedIndex);
		const end = Math.max(lastClickedIndex, clickedIndex);
		const rangeIds = secrets.slice(start, end + 1).map((secret) => secret.id);
		const next = new Set(selectedSecretIds);
		for (const id of rangeIds) {
			next.add(id);
		}

		return {
			selectedSecretIds: next,
			lastClickedIndex,
		};
	}

	if (ctrlKey || metaKey) {
		const next = new Set(selectedSecretIds);
		if (next.has(clickedSecret.id)) {
			next.delete(clickedSecret.id);
			if (next.size === 0) {
				next.add(clickedSecret.id);
			}
		} else {
			next.add(clickedSecret.id);
		}

		return {
			selectedSecretIds: next,
			lastClickedIndex: clickedIndex,
		};
	}

	return {
		selectedSecretIds: new Set([clickedSecret.id]),
		lastClickedIndex: clickedIndex,
	};
}

export function getSelectAllState(secrets: Secret[]): SelectionState {
	return {
		selectedSecretIds: new Set(secrets.map((secret) => secret.id)),
		lastClickedIndex: secrets.length > 0 ? secrets.length - 1 : null,
	};
}
