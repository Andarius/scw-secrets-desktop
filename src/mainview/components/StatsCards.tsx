import { Scissors } from "lucide-react";

type StatsCardsProps = {
	filteredSecretsCount: number;
	totalSecretsCount: number;
	visibleVersionCount: number;
	totalVersionCount: number;
	visiblePrunableVersionCount: number;
	totalPrunableVersionCount: number;
	onCleanupClick?: () => void;
};

export const STORAGE_PRICE_PER_VERSION_EUR = 0.04;
const API_CALLS_PRICE_PER_10K_EUR = 0.03;

const euroFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "EUR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

function formatEuro(value: number): string {
	return euroFormatter.format(value);
}

type TileProps = {
	value: string;
	label: string;
	sub: string;
	accent?: boolean;
	onClick?: () => void;
};

function Tile({ value, label, sub, accent, onClick }: TileProps) {
	const interactive = Boolean(onClick);
	const className = `min-w-0 rounded-lg border px-3.5 py-2 text-left transition-colors ${
		accent
			? "border-cyan-500/30 bg-cyan-500/[0.07]"
			: "border-white/10 bg-white/[0.03]"
	} ${interactive ? "hover:bg-cyan-500/[0.14] cursor-pointer" : ""}`;
	const content = (
		<>
			<div className="flex items-baseline gap-2 min-w-0">
				<span className={`text-base font-bold tabular-nums ${accent ? "text-cyan-300" : ""}`}>{value}</span>
				<span className="text-xs text-gray-400 truncate">{label}</span>
				{accent && interactive ? <Scissors className="w-3 h-3 ml-auto shrink-0 self-center text-cyan-300" /> : null}
			</div>
			<div className="text-[10.5px] text-gray-500 truncate" title={sub}>
				{sub}
			</div>
		</>
	);
	return interactive ? (
		<button type="button" onClick={onClick} className={className}>
			{content}
		</button>
	) : (
		<div className={className}>{content}</div>
	);
}

export function StatsCards({
	filteredSecretsCount,
	totalSecretsCount,
	visibleVersionCount,
	totalVersionCount,
	visiblePrunableVersionCount,
	totalPrunableVersionCount,
	onCleanupClick,
}: StatsCardsProps) {
	const estimatedMonthlyStorage = totalVersionCount * STORAGE_PRICE_PER_VERSION_EUR;
	const potentialMonthlySavings = totalPrunableVersionCount * STORAGE_PRICE_PER_VERSION_EUR;
	const cleanable = totalPrunableVersionCount > 0 && Boolean(onCleanupClick);

	return (
		<div className="grid grid-cols-3 gap-2.5 min-w-0">
			<Tile
				value={String(filteredSecretsCount)}
				label="secrets"
				sub={`${totalSecretsCount} fetched from the selected project`}
			/>
			<Tile
				value={String(visibleVersionCount)}
				label="versions"
				sub={`${totalVersionCount} stored revisions in the selected project`}
			/>
			<Tile
				value={String(visiblePrunableVersionCount)}
				label="reclaimable"
				sub={`${totalPrunableVersionCount} older revisions · storage ${formatEuro(estimatedMonthlyStorage)}/mo at ${formatEuro(STORAGE_PRICE_PER_VERSION_EUR)}/version-mo · Keep Latest saves ${formatEuro(potentialMonthlySavings)}/mo (API ${formatEuro(API_CALLS_PRICE_PER_10K_EUR)}/10k)`}
				accent={cleanable}
				onClick={cleanable ? onCleanupClick : undefined}
			/>
		</div>
	);
}
