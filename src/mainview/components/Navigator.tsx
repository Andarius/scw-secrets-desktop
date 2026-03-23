import { FolderTree, ChevronRight } from "lucide-react";

type NavigatorProps = {
	paths: [string, number][];
	pathFilter: string;
	onPathSelect: (path: string) => void;
	totalSecrets: number;
};

export function Navigator({
	paths,
	pathFilter,
	onPathSelect,
	totalSecrets,
}: NavigatorProps) {
	return (
		<div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden flex flex-col h-full">
			<div className="p-4 border-b border-white/10">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
						Navigator
					</h2>
					<div className="flex items-center gap-1.5 text-xs text-gray-500">
						<FolderTree className="w-3.5 h-3.5" />
						<span>{paths.length}</span>
					</div>
				</div>
				<div className="text-base font-medium">Paths</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				<div className="p-2">
					<button
						type="button"
						onClick={() => onPathSelect("all")}
						className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${
							pathFilter === "all"
								? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
								: "hover:bg-white/5 text-gray-300 border border-transparent"
						}`}
					>
						<div className="flex items-center gap-2">
							<ChevronRight
								className={`w-3.5 h-3.5 transition-transform ${
									pathFilter === "all"
										? "rotate-90 text-cyan-400"
										: "text-gray-500"
								}`}
							/>
							<span className={pathFilter === "all" ? "font-medium" : ""}>
								All paths
							</span>
						</div>
						<span
							className={`text-xs px-2 py-0.5 rounded ${
								pathFilter === "all"
									? "bg-cyan-500/30 text-cyan-300"
									: "bg-white/10 text-gray-400"
							}`}
						>
							{totalSecrets}
						</span>
					</button>

					{paths.map(([path, count]) => (
						<button
							key={path}
							type="button"
							onClick={() => onPathSelect(path)}
							className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${
								pathFilter === path
									? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
									: "hover:bg-white/5 text-gray-300 border border-transparent"
							}`}
						>
							<div className="flex items-center gap-2">
								<ChevronRight
									className={`w-3.5 h-3.5 transition-transform ${
										pathFilter === path
											? "rotate-90 text-cyan-400"
											: "text-gray-500"
									}`}
								/>
								<span
									className={`font-mono text-sm ${pathFilter === path ? "font-medium" : ""}`}
								>
									{path}
								</span>
							</div>
							<span
								className={`text-xs px-2 py-0.5 rounded ${
									pathFilter === path
										? "bg-cyan-500/30 text-cyan-300"
										: "bg-white/10 text-gray-400"
								}`}
							>
								{count}
							</span>
						</button>
					))}
				</div>
			</div>

		</div>
	);
}
