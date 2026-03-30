import { describe, expect, test } from "bun:test";

import type { Secret } from "../../src/shared/models";
import { matchSecrets } from "../../src/mainview/components/SpotlightSearch";

function makeSecret(overrides: Partial<Secret> = {}): Secret {
	return {
		id: "aaaa-bbbb-cccc-dddd",
		name: "my-secret",
		path: "/prod",
		type: "opaque",
		version_count: 1,
		status: "ready",
		tags: [],
		created_at: "2026-03-01T00:00:00Z",
		updated_at: "2026-03-01T00:00:00Z",
		...overrides,
	};
}

const secrets: Secret[] = [
	makeSecret({ id: "aaa-111", name: "DATABASE_URL", path: "/services", type: "key_value", tags: ["production", "db"] }),
	makeSecret({ id: "bbb-222", name: "API_KEY", path: "/auth", type: "opaque", tags: ["production"] }),
	makeSecret({ id: "ccc-333", name: "SLACK_WEBHOOK", path: "/services", type: "opaque", tags: ["integration"] }),
	makeSecret({ id: "ddd-444", name: "DEBUG_TOKEN", path: "/dev", status: "locked", tags: [] }),
];

describe("matchSecrets", () => {
	test("returns empty for blank query", () => {
		expect(matchSecrets(secrets, "")).toEqual([]);
		expect(matchSecrets(secrets, "   ")).toEqual([]);
	});

	test("returns empty for prefix with no value", () => {
		expect(matchSecrets(secrets, "id:")).toEqual([]);
		expect(matchSecrets(secrets, "name:  ")).toEqual([]);
	});

	describe("free-text search", () => {
		test("matches by name first", () => {
			const results = matchSecrets(secrets, "DATABASE");
			expect(results).toHaveLength(1);
			expect(results[0].matchField).toBe("name");
			expect(results[0].secret.name).toBe("DATABASE_URL");
		});

		test("matches by id when name does not match", () => {
			const results = matchSecrets(secrets, "ccc-333");
			expect(results).toHaveLength(1);
			expect(results[0].matchField).toBe("id");
			expect(results[0].secret.name).toBe("SLACK_WEBHOOK");
		});

		test("matches by path", () => {
			const results = matchSecrets(secrets, "/auth");
			expect(results).toHaveLength(1);
			expect(results[0].matchField).toBe("path");
			expect(results[0].secret.name).toBe("API_KEY");
		});

		test("matches by tag", () => {
			const results = matchSecrets(secrets, "integration");
			expect(results).toHaveLength(1);
			expect(results[0].matchField).toBe("tag");
			expect(results[0].matchValue).toBe("integration");
		});

		test("matches by type", () => {
			const results = matchSecrets(secrets, "key_value");
			expect(results).toHaveLength(1);
			expect(results[0].matchField).toBe("type");
			expect(results[0].secret.name).toBe("DATABASE_URL");
		});

		test("matches multiple secrets", () => {
			const results = matchSecrets(secrets, "prod");
			expect(results.length).toBeGreaterThan(1);
		});

		test("is case insensitive", () => {
			const results = matchSecrets(secrets, "database_url");
			expect(results).toHaveLength(1);
			expect(results[0].secret.name).toBe("DATABASE_URL");
		});
	});

	describe("prefixed search", () => {
		test.each([
			{ query: "id:aaa-111", field: "id", expectedName: "DATABASE_URL" },
			{ query: "name:API_KEY", field: "name", expectedName: "API_KEY" },
			{ query: "path:/dev", field: "path", expectedName: "DEBUG_TOKEN" },
			{ query: "tag:db", field: "tag", expectedName: "DATABASE_URL" },
			{ query: "type:key_value", field: "type", expectedName: "DATABASE_URL" },
			{ query: "status:locked", field: "status", expectedName: "DEBUG_TOKEN" },
		])("$query matches by $field", ({ query, field, expectedName }) => {
			const results = matchSecrets(secrets, query);
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].matchField).toBe(field);
			expect(results[0].secret.name).toBe(expectedName);
		});

		test("id: does not match name", () => {
			const results = matchSecrets(secrets, "id:DATABASE");
			expect(results).toHaveLength(0);
		});

		test("name: does not match id", () => {
			const results = matchSecrets(secrets, "name:aaa-111");
			expect(results).toHaveLength(0);
		});

		test("unknown prefix is treated as free text", () => {
			const results = matchSecrets(secrets, "foo:DATABASE");
			expect(results).toHaveLength(0);

			const results2 = matchSecrets(secrets, "xyz:API_KEY");
			expect(results2).toHaveLength(0);
		});
	});

	test("limits results to 50", () => {
		const manySecrets = Array.from({ length: 100 }, (_, i) =>
			makeSecret({ id: `id-${i}`, name: `secret-${i}` }),
		);
		const results = matchSecrets(manySecrets, "secret");
		expect(results).toHaveLength(50);
	});
});
