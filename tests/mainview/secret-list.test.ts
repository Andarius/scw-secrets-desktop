import { describe, expect, test } from "bun:test";

import type { Secret } from "../../src/shared/models";
import {
	filterSecrets,
	getPathEntries,
	reconcileSelectedSecretIds,
	sortSecrets,
} from "../../src/mainview/secret-list";

function makeSecret(overrides: Partial<Secret>): Secret {
	return {
		id: "secret-id",
		name: "secret-name",
		path: "/",
		type: "opaque",
		version_count: 1,
		status: "ready",
		tags: [],
		created_at: "2026-03-01T00:00:00Z",
		updated_at: "2026-03-01T00:00:00Z",
		...overrides,
	};
}

describe("getPathEntries", () => {
	test("counts and sorts unique paths", () => {
		const paths = getPathEntries([
			makeSecret({ id: "2", path: "/prod" }),
			makeSecret({ id: "3", path: "/apps" }),
			makeSecret({ id: "4", path: "/prod" }),
		]);

		expect(paths).toEqual([
			["/apps", 1],
			["/prod", 2],
		]);
	});
});

describe("filterSecrets", () => {
	const cases: Array<{
		name: string;
		secrets: Secret[];
		filters: {
			query: string;
			pathFilter: string;
			statusFilter: "all" | "ready" | "attention";
		};
		expectedIds: string[];
	}> = [
		{
			name: "keeps nested paths when filtering by a parent path",
			secrets: [
				makeSecret({ id: "1", path: "/prod" }),
				makeSecret({ id: "2", path: "/prod/api" }),
				makeSecret({ id: "3", path: "/dev" }),
			],
			filters: {
				query: "",
				pathFilter: "/prod",
				statusFilter: "all",
			},
			expectedIds: ["1", "2"],
		},
		{
			name: "matches query against both name and path and excludes ready items from attention",
			secrets: [
				makeSecret({ id: "1", name: "database-password", path: "/prod/api" }),
				makeSecret({ id: "2", name: "api-token", path: "/prod/web", status: "locked" }),
				makeSecret({ id: "3", name: "misc", path: "/dev/worker", status: "destroyed" }),
			],
			filters: {
				query: "prod/web",
				pathFilter: "all",
				statusFilter: "attention",
			},
			expectedIds: ["2"],
		},
	];

	for (const { name, secrets, filters, expectedIds } of cases) {
		test(name, () => {
			const filtered = filterSecrets(secrets, filters);

			expect(filtered.map((secret) => secret.id)).toEqual(expectedIds);
		});
	}
});

describe("sortSecrets", () => {
	test("sorts by updated date and falls back to string comparison for invalid dates", () => {
		const secrets = [
			makeSecret({ id: "1", name: "bravo", updated_at: "invalid-date" }),
			makeSecret({ id: "2", name: "alpha", updated_at: "2026-03-10T12:00:00Z" }),
			makeSecret({ id: "3", name: "charlie", updated_at: "invalid-earlier" }),
		];

		const sorted = sortSecrets(secrets, {
			sortKey: "updated_at",
			sortDirection: "desc",
		});

		expect(sorted.map((secret) => secret.id)).toEqual(["3", "1", "2"]);
	});
});

describe("reconcileSelectedSecretIds", () => {
	const cases: Array<{
		name: string;
		visibleSecrets: Secret[];
		selectedSecretIds: Set<string>;
		expectedSelection: string[];
	}> = [
		{
			name: "drops invisible selections but keeps still-visible ones",
			visibleSecrets: [
				makeSecret({ id: "1" }),
				makeSecret({ id: "2" }),
			],
			selectedSecretIds: new Set(["2", "missing"]),
			expectedSelection: ["2"],
		},
		{
			name: "selects the first visible secret when the current selection disappears",
			visibleSecrets: [
				makeSecret({ id: "first" }),
				makeSecret({ id: "second" }),
			],
			selectedSecretIds: new Set(["missing"]),
			expectedSelection: ["first"],
		},
		{
			name: "clears selection when no secrets remain visible",
			visibleSecrets: [],
			selectedSecretIds: new Set(["selected"]),
			expectedSelection: [],
		},
	];

	for (const { name, visibleSecrets, selectedSecretIds, expectedSelection } of cases) {
		test(name, () => {
			const nextSelection = reconcileSelectedSecretIds(visibleSecrets, selectedSecretIds);

			expect(nextSelection ? [...nextSelection] : null).toEqual(expectedSelection);
		});
	}
});
