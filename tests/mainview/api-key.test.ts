import { expect, test } from "bun:test";

import { describeKeyExpiry, formatKeyLifetime } from "../../src/mainview/lib/api-key";

const NOW = Date.parse("2026-10-23T12:00:00Z");

test.each([
	["no organization cap", 0, "No limit"],
	["a single day", 86_400, "1 day"],
	["whole days", 90 * 86_400, "90 days"],
	["sub-day caps in hours", 7_200, "2 hours"],
	["less than an hour", 60, "1 hour"],
] as const)("formatKeyLifetime: %s", (_name, seconds, label) => {
	expect(formatKeyLifetime(seconds)).toBe(label);
});

test.each([
	["a key without expiry", null, { label: "Never expires", tone: "ok" }],
	["a far expiry", "2026-12-29T19:18:53Z", { label: "Expires 29 Dec 2026 (in 68 days)", tone: "ok" }],
	["an expiry within 30 days", "2026-11-22T12:00:00Z", { label: "Expires 22 Nov 2026 (in 30 days)", tone: "warn" }],
	["an expiry later today", "2026-10-23T18:00:00Z", { label: "Expires 23 Oct 2026 (in 1 day)", tone: "warn" }],
	["an expired key", "2026-10-01T00:00:00Z", { label: "Expired on 1 Oct 2026", tone: "expired" }],
] as const)("describeKeyExpiry: %s", (_name, expiresAt, expected) => {
	expect(describeKeyExpiry(expiresAt, NOW)).toEqual(expected);
});
