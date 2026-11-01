import type { EphemeralAction, EphemeralPolicy, EphemeralProperties } from "../../shared/models";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const EXPIRY_WARNING_DAYS = 7;

export type ExpiryTone = "ok" | "warn" | "expired";

/** short fits a table cell; label is the full sentence for the detail panel. */
export type Expiry = { short: string; label: string; tone: ExpiryTone };

function plural(count: number, unit: string) {
	return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Built by hand: Intl joins date and time differently across ICU versions.
function formatDate(date: Date) {
	const time = date.toISOString().slice(11, 16);
	return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${time} UTC`;
}

function formatSpan(ms: number) {
	if (ms >= DAY_MS) return plural(Math.ceil(ms / DAY_MS), "day");
	if (ms >= HOUR_MS) return plural(Math.ceil(ms / HOUR_MS), "hour");
	return plural(Math.max(1, Math.ceil(ms / 60_000)), "minute");
}

const ACTION_PAST: Record<EphemeralAction, string | null> = {
	delete: "deleted",
	disable: "disabled",
	unknown_action: null,
};

/** Scaleway encodes durations as decimal seconds, e.g. "2592000s" or "3600.5s". */
export function parseDurationSeconds(value: string): number | null {
	const match = /^(\d+)(?:\.\d+)?s$/.exec(value);
	return match ? Number(match[1]) : null;
}

export function describePolicy(policy: EphemeralPolicy): string {
	const seconds = policy.time_to_live ? parseDurationSeconds(policy.time_to_live) : null;
	const triggers = [
		seconds ? `${formatSpan(seconds * 1000)} after creation` : null,
		policy.expires_once_accessed ? "once read" : null,
	].filter(Boolean);
	const when = triggers.length > 0 ? triggers.join(" or ") : "on expiry";
	const action = ACTION_PAST[policy.action];
	return `New versions expire ${when}${action ? `, then are ${action}` : ""}.`;
}

/** Expiry of a version; null when it never expires. */
export function describeExpiry(properties: EphemeralProperties | null | undefined, now = Date.now()): Expiry | null {
	if (properties?.expires_at) {
		const date = new Date(properties.expires_at);
		if (!Number.isNaN(date.getTime())) {
			const remaining = date.getTime() - now;
			if (remaining <= 0) return { short: "Expired", label: `Expired on ${formatDate(date)}`, tone: "expired" };
			const span = formatSpan(remaining);
			return {
				short: `In ${span}`,
				label: `Expires ${formatDate(date)} (in ${span})`,
				tone: remaining <= EXPIRY_WARNING_DAYS * DAY_MS ? "warn" : "ok",
			};
		}
	}
	if (properties?.expires_once_accessed) {
		return { short: "Once read", label: "Expires the first time it is read", tone: "warn" };
	}
	return null;
}
