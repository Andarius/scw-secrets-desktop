import { describe, expect, test } from "bun:test";

import type { Secret } from "../../src/shared/models";
import { getNextSelectionState, getSelectAllState } from "../../src/mainview/inventory-selection";

function makeSecret(id: string): Secret {
	return {
		id,
		name: `secret-${id}`,
		path: "/prod",
		type: "opaque",
		version_count: 1,
		status: "ready",
		tags: [],
		created_at: "2026-03-01T00:00:00Z",
		updated_at: "2026-03-01T00:00:00Z",
	};
}

const secrets = [makeSecret("a"), makeSecret("b"), makeSecret("c"), makeSecret("d")];

describe("getNextSelectionState", () => {
	const cases: Array<{
		name: string;
		selectedSecretIds: Set<string>;
		lastClickedIndex: number | null;
		clickedIndex: number;
		modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };
		expectedSelection: string[];
		expectedLastClickedIndex: number | null;
	}> = [
		{
			name: "selects a range on shift-click without resetting the existing anchor",
			selectedSecretIds: new Set(["a"]),
			lastClickedIndex: 0,
			clickedIndex: 2,
			modifiers: { shiftKey: true, ctrlKey: false, metaKey: false },
			expectedSelection: ["a", "b", "c"],
			expectedLastClickedIndex: 0,
		},
		{
			name: "keeps one item selected when ctrl-click would otherwise empty the selection",
			selectedSecretIds: new Set(["b"]),
			lastClickedIndex: 1,
			clickedIndex: 1,
			modifiers: { shiftKey: false, ctrlKey: true, metaKey: false },
			expectedSelection: ["b"],
			expectedLastClickedIndex: 1,
		},
		{
			name: "adds a new item on meta-click",
			selectedSecretIds: new Set(["a"]),
			lastClickedIndex: 0,
			clickedIndex: 3,
			modifiers: { shiftKey: false, ctrlKey: false, metaKey: true },
			expectedSelection: ["a", "d"],
			expectedLastClickedIndex: 3,
		},
		{
			name: "replaces the selection on a plain click",
			selectedSecretIds: new Set(["a", "b"]),
			lastClickedIndex: 1,
			clickedIndex: 2,
			modifiers: { shiftKey: false, ctrlKey: false, metaKey: false },
			expectedSelection: ["c"],
			expectedLastClickedIndex: 2,
		},
	];

	for (const {
		name,
		selectedSecretIds,
		lastClickedIndex,
		clickedIndex,
		modifiers,
		expectedSelection,
		expectedLastClickedIndex,
	} of cases) {
		test(name, () => {
			const nextState = getNextSelectionState(
				secrets,
				selectedSecretIds,
				lastClickedIndex,
				secrets[clickedIndex],
				clickedIndex,
				modifiers,
			);

			expect([...nextState.selectedSecretIds]).toEqual(expectedSelection);
			expect(nextState.lastClickedIndex).toBe(expectedLastClickedIndex);
		});
	}
});

describe("getSelectAllState", () => {
	test("selects every visible secret and stores the last index as the new anchor", () => {
		const nextState = getSelectAllState(secrets);

		expect([...nextState.selectedSecretIds]).toEqual(["a", "b", "c", "d"]);
		expect(nextState.lastClickedIndex).toBe(3);
	});
});
