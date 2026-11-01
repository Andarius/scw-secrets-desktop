import { Clock } from "lucide-react";

import type { Expiry, ExpiryTone } from "../../lib/secret-expiry";

const TONES: Record<ExpiryTone, string> = {
	ok: "border-white/10 bg-white/5 text-gray-300",
	warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
	expired: "border-red-500/30 bg-red-500/10 text-red-300",
};

export const EXPIRY_TEXT_TONES: Record<ExpiryTone, string> = {
	ok: "text-gray-300",
	warn: "text-amber-300",
	expired: "text-red-300",
};

export function ExpiryBadge({ expiry }: { expiry: Expiry }) {
	return (
		<span
			title={expiry.label}
			className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap ${TONES[expiry.tone]}`}
		>
			<Clock className="w-2.5 h-2.5" />
			{expiry.short}
		</span>
	);
}
