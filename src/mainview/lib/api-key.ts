const DAY_MS = 86_400_000;
const EXPIRY_WARNING_DAYS = 30;

export type KeyExpiry = { label: string; tone: "ok" | "warn" | "expired" };

function plural(count: number, unit: string) {
	return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function formatDate(date: Date) {
	return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatKeyLifetime(seconds: number): string {
	if (seconds === 0) return "No limit";
	if (seconds % 86_400 === 0) return plural(seconds / 86_400, "day");
	return plural(Math.max(1, Math.round(seconds / 3600)), "hour");
}

export function describeKeyExpiry(expiresAt: string | null, now = Date.now()): KeyExpiry {
	if (expiresAt === null) return { label: "Never expires", tone: "ok" };
	const date = new Date(expiresAt);
	const remaining = date.getTime() - now;
	if (remaining <= 0) return { label: `Expired on ${formatDate(date)}`, tone: "expired" };
	const days = Math.ceil(remaining / DAY_MS);
	return {
		label: `Expires ${formatDate(date)} (in ${plural(days, "day")})`,
		tone: days <= EXPIRY_WARNING_DAYS ? "warn" : "ok",
	};
}
