import { Key, Route, Coins, Layers2, Scissors, Receipt } from "lucide-react";

type StatsCardsProps = {
	filteredSecretsCount: number;
	totalSecretsCount: number;
	visibleVersionCount: number;
	totalVersionCount: number;
	visiblePrunableVersionCount: number;
	totalPrunableVersionCount: number;
	pathCount: number;
	currentPathFilter: string;
};

const STORAGE_PRICE_PER_VERSION_EUR = 0.04;
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

export function StatsCards({
	filteredSecretsCount,
	totalSecretsCount,
	visibleVersionCount,
	totalVersionCount,
	visiblePrunableVersionCount,
	totalPrunableVersionCount,
	pathCount,
	currentPathFilter,
}: StatsCardsProps) {
	const estimatedMonthlyStorage = totalVersionCount * STORAGE_PRICE_PER_VERSION_EUR;
	const potentialMonthlySavings = totalPrunableVersionCount * STORAGE_PRICE_PER_VERSION_EUR;

	const stats = [
		{
			label: "Secrets",
			value: String(filteredSecretsCount),
			subtitle: `${totalSecretsCount} fetched from the selected project`,
			icon: Key,
			color: "from-cyan-500/20 to-cyan-500/5",
			iconColor: "text-cyan-400",
		},
		{
			label: "Versions",
			value: String(visibleVersionCount),
			subtitle: `${totalVersionCount} stored revisions in the selected project`,
			icon: Layers2,
			color: "from-blue-500/20 to-blue-500/5",
			iconColor: "text-blue-400",
		},
		{
			label: "Reclaimable",
			value: String(visiblePrunableVersionCount),
			subtitle: `${totalPrunableVersionCount} older revisions beyond latest`,
			icon: Scissors,
			color: "from-purple-500/20 to-purple-500/5",
			iconColor: "text-purple-400",
		},
		{
			label: "Paths",
			value: String(pathCount),
			subtitle: currentPathFilter === "all" ? "All paths" : currentPathFilter,
			icon: Route,
			color: "from-emerald-500/20 to-emerald-500/5",
			iconColor: "text-emerald-400",
		},
		{
			label: "Est. Storage",
			value: `${formatEuro(estimatedMonthlyStorage)}/mo`,
			subtitle: `${totalVersionCount} stored versions at ${formatEuro(STORAGE_PRICE_PER_VERSION_EUR)} per version-month`,
			icon: Coins,
			color: "from-amber-500/20 to-amber-500/5",
			iconColor: "text-amber-400",
		},
		{
			label: "Cleanup Savings",
			value: `-${formatEuro(potentialMonthlySavings)}/mo`,
			subtitle: `Keep Latest schedules old revisions for deletion, API calls ${formatEuro(API_CALLS_PRICE_PER_10K_EUR)} per 10k`,
			icon: Receipt,
			color: "from-rose-500/20 to-rose-500/5",
			iconColor: "text-rose-400",
		},
	];

	return (
		<div className="grid grid-cols-2 gap-4 min-w-0 overflow-hidden md:grid-cols-3 xl:grid-cols-6">
			{stats.map((stat) => {
				const Icon = stat.icon;
				return (
					<div
						key={stat.label}
						className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 backdrop-blur-sm hover:border-white/20 transition-all group"
					>
						<div
							className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-50 group-hover:opacity-70 transition-opacity`}
						/>
						<div className="relative">
							<div className="flex items-start justify-between mb-3">
								<div className="text-xs text-gray-400 uppercase tracking-wider">
									{stat.label}
								</div>
								<Icon className={`w-5 h-5 ${stat.iconColor}`} />
							</div>
							<div className="text-3xl font-bold mb-1">{stat.value}</div>
							<div className="text-xs text-gray-400">{stat.subtitle}</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
