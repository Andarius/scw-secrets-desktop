import { Users, FolderOpen, Key, Route } from "lucide-react";

type StatsCardsProps = {
	profileCount: number;
	activeSourceName: string;
	projectCount: number;
	selectedProjectName: string;
	filteredSecretsCount: number;
	totalSecretsCount: number;
	pathCount: number;
	currentPathFilter: string;
};

export function StatsCards({
	profileCount,
	activeSourceName,
	projectCount,
	selectedProjectName,
	filteredSecretsCount,
	totalSecretsCount,
	pathCount,
	currentPathFilter,
}: StatsCardsProps) {
	const stats = [
		{
			label: "Profiles",
			value: String(profileCount),
			subtitle: activeSourceName
				? `Active source: ${activeSourceName}`
				: "No auth source",
			icon: Users,
			color: "from-purple-500/20 to-purple-500/5",
			iconColor: "text-purple-400",
		},
		{
			label: "Projects",
			value: String(projectCount),
			subtitle: selectedProjectName || "No project selected",
			icon: FolderOpen,
			color: "from-blue-500/20 to-blue-500/5",
			iconColor: "text-blue-400",
		},
		{
			label: "Secrets",
			value: String(filteredSecretsCount),
			subtitle: `${totalSecretsCount} fetched from the selected project`,
			icon: Key,
			color: "from-cyan-500/20 to-cyan-500/5",
			iconColor: "text-cyan-400",
		},
		{
			label: "Paths",
			value: String(pathCount),
			subtitle: currentPathFilter === "all" ? "All paths" : currentPathFilter,
			icon: Route,
			color: "from-emerald-500/20 to-emerald-500/5",
			iconColor: "text-emerald-400",
		},
	];

	return (
		<div className="grid grid-cols-4 gap-4 min-w-0 overflow-hidden">
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
