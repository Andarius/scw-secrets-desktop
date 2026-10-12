import { describe, expect, test } from "bun:test";

import { isNewerVersion } from "../../src/mainview/lib/update-check";

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
