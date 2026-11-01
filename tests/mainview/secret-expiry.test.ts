import { expect, test } from "bun:test";

import type { EphemeralPolicy, EphemeralProperties } from "../../src/shared/models";
import { describeExpiry, describePolicy, type Expiry, parseDurationSeconds } from "../../src/mainview/lib/secret-expiry";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const at = (expires_at: string | null, expires_once_accessed = false): EphemeralProperties => ({
	expires_at,
	expires_once_accessed,
	action: "delete",
});

test.each([
	["whole seconds", "3600s", 3600],
	["fractional seconds", "2592000.000000000s", 2_592_000],
	["missing unit", "3600", null],
	["negative", "-1s", null],
])("parseDurationSeconds: %s", (_name, value, expected) => {
	expect(parseDurationSeconds(value)).toBe(expected);
});

test.each([
	["ttl then delete", { time_to_live: "2592000s", expires_once_accessed: false, action: "delete" }, "New versions expire 30 days after creation, then are deleted."],
	["sub-day ttl then disable", { time_to_live: "7200s", action: "disable" }, "New versions expire 2 hours after creation, then are disabled."],
	["ttl or once read", { time_to_live: "86400s", expires_once_accessed: true, action: "delete" }, "New versions expire 1 day after creation or once read, then are deleted."],
	["once read, unknown action", { time_to_live: null, expires_once_accessed: true, action: "unknown_action" }, "New versions expire once read."],
] satisfies [string, EphemeralPolicy, string][])("describePolicy: %s", (_name, policy, expected) => {
	expect(describePolicy(policy)).toBe(expected);
});

test.each([
	["no expiration", null, null],
	["properties without a date", at(null), null],
	["far expiry", at("2026-12-29T19:18:00Z"), { short: "In 68 days", label: "Expires 29 Dec 2026, 19:18 UTC (in 68 days)", tone: "ok" }],
	["within 7 days", at("2026-10-30T12:00:00Z"), { short: "In 7 days", label: "Expires 30 Oct 2026, 12:00 UTC (in 7 days)", tone: "warn" }],
	["later today in hours", at("2026-10-23T17:30:00Z"), { short: "In 6 hours", label: "Expires 23 Oct 2026, 17:30 UTC (in 6 hours)", tone: "warn" }],
	["already expired", at("2026-10-01T00:00:00Z"), { short: "Expired", label: "Expired on 1 Oct 2026, 00:00 UTC", tone: "expired" }],
	["expires once read", at(null, true), { short: "Once read", label: "Expires the first time it is read", tone: "warn" }],
	["unparseable date", at("soon"), null],
] satisfies [string, EphemeralProperties | null, Expiry | null][])("describeExpiry: %s", (_name, properties, expected) => {
	expect(describeExpiry(properties, NOW)).toEqual(expected);
});
