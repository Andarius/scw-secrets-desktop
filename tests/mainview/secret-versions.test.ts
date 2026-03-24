import { describe, expect, test } from "bun:test";

import type { SecretVersion } from "../../src/shared/models";
import { isVersionDeleted, planKeepLatestVersionOnly } from "../../src/mainview/secret-versions";

function makeVersion(overrides: Partial<SecretVersion>): SecretVersion {
	return {
		revision: 1,
		secret_id: "secret-id",
		status: "enabled",
		created_at: "2026-03-01T00:00:00Z",
		updated_at: "2026-03-01T00:00:00Z",
		description: "",
		latest: false,
		...overrides,
	};
}

describe("isVersionDeleted", () => {
	const cases: Array<{ status: string; expected: boolean }> = [
		{ status: "scheduled_for_deletion", expected: true },
		{ status: "destroyed", expected: true },
		{ status: "enabled", expected: false },
	];

	for (const { status, expected } of cases) {
		test(`returns ${String(expected)} for ${status}`, () => {
			expect(isVersionDeleted(status)).toBe(expected);
		});
	}
});

describe("planKeepLatestVersionOnly", () => {
	const cases: Array<{
		name: string;
		versions: SecretVersion[];
		expectedActions: Array<{ type: "disable" | "destroy"; revision: number }>;
	}> = [
		{
			name: "keeps the explicit latest revision and disables enabled revisions before destroying them",
			versions: [
				makeVersion({ revision: 4, status: "enabled", latest: true }),
				makeVersion({ revision: 3, status: "enabled" }),
				makeVersion({ revision: 2, status: "disabled" }),
				makeVersion({ revision: 1, status: "scheduled_for_deletion" }),
			],
			expectedActions: [
				{ type: "disable", revision: 3 },
				{ type: "destroy", revision: 3 },
				{ type: "destroy", revision: 2 },
			],
		},
		{
			name: "falls back to the first non-deleted revision when no version is marked latest",
			versions: [
				makeVersion({ revision: 5, status: "disabled" }),
				makeVersion({ revision: 4, status: "enabled" }),
				makeVersion({ revision: 3, status: "destroyed" }),
			],
			expectedActions: [
				{ type: "disable", revision: 4 },
				{ type: "destroy", revision: 4 },
			],
		},
		{
			name: "returns no actions when every revision is already deleted",
			versions: [
				makeVersion({ revision: 2, status: "destroyed" }),
				makeVersion({ revision: 1, status: "scheduled_for_deletion" }),
			],
			expectedActions: [],
		},
	];

	for (const { name, versions, expectedActions } of cases) {
		test(name, () => {
			const actions = planKeepLatestVersionOnly(versions);

			expect(actions).toEqual(expectedActions);
		});
	}
});
