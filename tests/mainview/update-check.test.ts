import { describe, expect, test } from "bun:test";

import { isNewerVersion } from "../../src/mainview/lib/update-check";
import { parseLatestRelease } from "../../src/deno/updates";

describe("isNewerVersion", () => {
	const cases: Array<{ latest: string; current: string; expected: boolean }> = [
		{ latest: "0.9.0", current: "0.8.1", expected: true },
		{ latest: "1.0.0", current: "0.99.99", expected: true },
		{ latest: "0.8.10", current: "0.8.9", expected: true },
		{ latest: "v0.8.2", current: "0.8.1", expected: true },
		{ latest: "0.8.1", current: "0.8.1", expected: false },
		{ latest: "0.8.0", current: "0.8.1", expected: false },
		{ latest: "0.7.9", current: "0.8.0", expected: false },
	];

	for (const { latest, current, expected } of cases) {
		test(`${latest} vs ${current} → ${String(expected)}`, () => {
			expect(isNewerVersion(latest, current)).toBe(expected);
		});
	}
});

describe("parseLatestRelease", () => {
	const valid = {
		tag_name: "v0.9.0",
		html_url: "https://github.com/Andarius/scw-secrets-desktop/releases/tag/v0.9.0",
		draft: false,
		prerelease: false,
	};

	test("extracts the version without its v prefix and the release page", () => {
		expect(parseLatestRelease(valid)).toEqual({
			version: "0.9.0",
			url: "https://github.com/Andarius/scw-secrets-desktop/releases/tag/v0.9.0",
		});
	});

	test("rejects drafts, prereleases, odd tags and foreign URLs", () => {
		expect(parseLatestRelease({ ...valid, draft: true })).toBeNull();
		expect(parseLatestRelease({ ...valid, prerelease: true })).toBeNull();
		expect(parseLatestRelease({ ...valid, tag_name: "v1.0.0-beta.1" })).toBeNull();
		expect(parseLatestRelease({ ...valid, tag_name: "<script>" })).toBeNull();
		expect(parseLatestRelease({ ...valid, html_url: "https://evil.example/releases/" })).toBeNull();
		expect(parseLatestRelease(null)).toBeNull();
		expect(parseLatestRelease({ message: "API rate limit exceeded" })).toBeNull();
	});
});
