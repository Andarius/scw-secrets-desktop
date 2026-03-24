import { useEffect, useMemo, useState } from "react";
import { FolderTree, ChevronRight } from "lucide-react";

type NavigatorProps = {
	paths: [string, number][];
	pathFilter: string;
	onPathSelect: (path: string) => void;
	totalSecrets: number;
};

type PathNode = {
	segment: string;
	fullPath: string;
	exactCount: number | null;
	totalCount: number;
	children: PathNode[];
};

function buildPathTree(paths: [string, number][]): PathNode[] {
	const root: PathNode[] = [];

	for (const [path, count] of paths) {
		const segments = path.split("/").filter(Boolean);
		let currentLevel = root;
		let currentPath = "";
		let target: PathNode | null = null;

		for (const segment of segments) {
			currentPath = `${currentPath}/${segment}`;
			let node = currentLevel.find((entry) => entry.segment === segment);
			if (!node) {
				node = {
					segment,
					fullPath: currentPath,
					exactCount: null,
					totalCount: 0,
					children: [],
				};
				currentLevel.push(node);
			}

			target = node;
			currentLevel = node.children;
		}

		if (target) {
			target.exactCount = count;
		}
	}

	function finalize(nodes: PathNode[]): PathNode[] {
		return nodes
			.map((node) => {
				const children = finalize(node.children).sort((left, right) =>
					left.fullPath.localeCompare(right.fullPath),
				);
				const childrenTotal = children.reduce((sum, child) => sum + child.totalCount, 0);
				return {
					...node,
					children,
					totalCount: (node.exactCount ?? 0) + childrenTotal,
				};
			})
			.sort((left, right) => left.fullPath.localeCompare(right.fullPath));
	}

	return finalize(root);
}

export function Navigator({
	paths,
	pathFilter,
	onPathSelect,
	totalSecrets,
}: NavigatorProps) {
	const tree = useMemo(() => buildPathTree(paths), [paths]);
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

	useEffect(() => {
		setExpandedPaths((current) => {
			const next = new Set(current);
			if (current.size === 0) {
				for (const node of tree) {
					next.add(node.fullPath);
				}
			}

			if (pathFilter !== "all") {
				const segments = pathFilter.split("/").filter(Boolean);
				let currentPath = "";
				for (const segment of segments) {
					currentPath = `${currentPath}/${segment}`;
					next.add(currentPath);
				}
			}

			return next;
		});
	}, [tree, pathFilter]);

	function toggleExpanded(path: string) {
		setExpandedPaths((current) => {
			const next = new Set(current);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	}

	function renderNodes(nodes: PathNode[], depth = 0) {
		return nodes.map((node) => {
			const hasChildren = node.children.length > 0;
			const isSelected = pathFilter === node.fullPath;
			const isExpanded = expandedPaths.has(node.fullPath);
			const count = node.totalCount;
			const label = depth === 0 ? node.fullPath : node.segment;

			return (
				<div key={node.fullPath}>
					<div
						className={`flex items-center gap-1 rounded-lg border text-sm transition-all ${
							isSelected
								? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
								: "text-gray-300 border-transparent hover:bg-white/5"
						}`}
						style={{ paddingLeft: `${12 + depth * 18}px` }}
					>
						<button
							type="button"
							onClick={() => (hasChildren ? toggleExpanded(node.fullPath) : onPathSelect(node.fullPath))}
							className="flex h-9 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-white/5"
							title={hasChildren ? `${isExpanded ? "Collapse" : "Expand"} ${node.fullPath}` : node.fullPath}
						>
							{hasChildren ? (
								<ChevronRight
									className={`w-3.5 h-3.5 transition-transform ${
										isExpanded ? "rotate-90" : ""
									} ${isSelected ? "text-cyan-400/80" : "text-gray-500"}`}
								/>
							) : (
								<span className="block w-3.5" />
							)}
						</button>

						<button
							type="button"
							onClick={() => onPathSelect(node.fullPath)}
							className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2.5 pr-3"
							title={node.fullPath}
						>
							<div className="min-w-0">
								<span className={`font-mono text-sm truncate block ${isSelected ? "font-medium" : ""}`}>
									{label}
								</span>
							</div>
							<span
								className={`shrink-0 text-xs px-2 py-0.5 rounded ${
									isSelected
										? "bg-cyan-500/30 text-cyan-300"
										: "bg-white/10 text-gray-400"
								}`}
							>
								{count}
							</span>
						</button>
					</div>

					{hasChildren && isExpanded ? renderNodes(node.children, depth + 1) : null}
				</div>
			);
		});
	}

	return (
		<div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden flex flex-col h-full">
			<div className="p-4 border-b border-white/10">
				<div className="flex items-center justify-end mb-4">
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

					{renderNodes(tree)}
				</div>
			</div>

		</div>
	);
}
