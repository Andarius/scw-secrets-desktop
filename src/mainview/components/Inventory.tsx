import { useRef } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import type { Secret } from "../../shared/models";

type StatusFilter = "all" | "ready" | "attention";
type VersionSortDirection = "desc" | "asc";

type InventoryProps = {
	secrets: Secret[];
	selectedSecretIds: Set<string>;
	onSelectionChange: (ids: Set<string>) => void;
	query: string;
	onQueryChange: (query: string) => void;
	statusFilter: StatusFilter;
	onStatusFilterChange: (filter: StatusFilter) => void;
	versionSortDirection: VersionSortDirection;
	onVersionSortDirectionChange: (direction: VersionSortDirection) => void;
	loading: boolean;
	totalCount: number;
};

function formatCompactDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

function formatSecretType(type?: string): string {
	if (!type) {
		return "—";
	}

	const labels: Record<string, string> = {
		opaque: "Opaque",
		basic_credentials: "Basic Creds",
		database_credentials: "DB Creds",
		key_value: "Key/Value",
		ssh_key: "SSH Key",
	};

	return labels[type] ?? type.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function StatusBadge({ status }: { status: string }) {
	const isReady = status === "ready";
	return (
		<span
			className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${
				isReady
					? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
					: "border-amber-500/30 bg-amber-500/10 text-amber-300"
			}`}
		>
			{status.toUpperCase()}
		</span>
	);
}

const FILTERS: { key: StatusFilter; label: string }[] = [
	{ key: "all", label: "ALL" },
	{ key: "ready", label: "READY" },
	{ key: "attention", label: "ATTENTION" },
];

export function Inventory({
	secrets,
	selectedSecretIds,
	onSelectionChange,
	query,
	onQueryChange,
	statusFilter,
	onStatusFilterChange,
	versionSortDirection,
	onVersionSortDirectionChange,
	loading,
	totalCount,
}: InventoryProps) {
	const lastClickedIndex = useRef<number | null>(null);
	const allVisibleSelected =
		secrets.length > 0 && secrets.every((secret) => selectedSecretIds.has(secret.id));

	function handleRowClick(secret: Secret, index: number, event: React.MouseEvent) {
		if (event.shiftKey && lastClickedIndex.current !== null) {
			const start = Math.min(lastClickedIndex.current, index);
			const end = Math.max(lastClickedIndex.current, index);
			const rangeIds = secrets.slice(start, end + 1).map((s) => s.id);
			const next = new Set(selectedSecretIds);
			for (const id of rangeIds) {
				next.add(id);
			}
			onSelectionChange(next);
		} else if (event.ctrlKey || event.metaKey) {
			const next = new Set(selectedSecretIds);
			if (next.has(secret.id)) {
				next.delete(secret.id);
				if (next.size === 0) {
					next.add(secret.id);
				}
			} else {
				next.add(secret.id);
			}
			onSelectionChange(next);
			lastClickedIndex.current = index;
		} else {
			onSelectionChange(new Set([secret.id]));
			lastClickedIndex.current = index;
		}
	}

	function handleSelectAll() {
		onSelectionChange(new Set(secrets.map((secret) => secret.id)));
		lastClickedIndex.current = secrets.length > 0 ? secrets.length - 1 : null;
	}

	return (
		<div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden flex flex-col h-full">
			<div className="p-4 border-b border-white/10">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
						Inventory
					</h2>
					<div className="text-xs text-gray-500">
						{loading
							? "Refreshing…"
							: `${secrets.length} visible of ${totalCount}`}
					</div>
				</div>
				<div className="flex items-center justify-between gap-3 mb-4">
					<div className="text-base font-medium">Secrets</div>
					<button
						type="button"
						onClick={handleSelectAll}
						disabled={secrets.length === 0 || allVisibleSelected}
						className="px-3 py-1.5 text-xs font-medium rounded-md bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
					>
						Select All
					</button>
				</div>

				<div className="space-y-3">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<input
							type="search"
							placeholder="Filter by name or path"
							value={query}
							onChange={(e) => onQueryChange(e.target.value)}
							className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-colors"
						/>
					</div>

					<div className="flex gap-2">
						{FILTERS.map((f) => (
							<button
								key={f.key}
								type="button"
								onClick={() => onStatusFilterChange(f.key)}
								className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
									statusFilter === f.key
										? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
										: "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
								}`}
							>
								{f.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-auto">
				{loading ? (
					<div className="p-8 text-center">
						<p className="text-sm text-gray-500">
							Fetching the current project inventory…
						</p>
					</div>
				) : secrets.length === 0 ? (
					<div className="p-8 text-center">
						<p className="text-sm text-gray-500">
							No secrets match this view.
						</p>
					</div>
				) : (
					<table className="w-full">
						<thead className="sticky top-0 bg-black/60 backdrop-blur-sm border-b border-white/10">
							<tr className="text-left">
								<th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
									Name
								</th>
								<th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
									Path
								</th>
								<th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
									Type
								</th>
								<th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
									Status
								</th>
								<th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
									Tags
								</th>
								<th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
									<button
										type="button"
										onClick={() =>
											onVersionSortDirectionChange(
												versionSortDirection === "desc" ? "asc" : "desc",
											)
										}
										className={`inline-flex items-center gap-1 transition-colors ${
											versionSortDirection === "desc" || versionSortDirection === "asc"
												? "text-cyan-300 hover:text-cyan-200"
												: "hover:text-gray-200"
										}`}
										aria-label={`Sort by versions ${versionSortDirection === "desc" ? "ascending" : "descending"}`}
									>
										<span>Versions</span>
										{versionSortDirection === "desc" ? (
											<ChevronDown className="h-3.5 w-3.5" />
										) : (
											<ChevronUp className="h-3.5 w-3.5" />
										)}
									</button>
								</th>
								<th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
									Updated
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5">
							{secrets.map((secret, index) => {
								const isSelected = selectedSecretIds.has(secret.id);
								return (
									<tr
										key={secret.id}
										onClick={(e) => handleRowClick(secret, index, e)}
										className={`relative cursor-pointer transition-colors select-none ${
											isSelected
												? "bg-cyan-500/10"
												: "hover:bg-white/5"
										}`}
									>
										<td className="px-4 py-3 relative">
											{isSelected && (
												<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-400 rounded-r-full" />
											)}
											<div className="text-sm font-medium text-white">
												{secret.name}
											</div>
											<div className="text-xs text-gray-500 font-mono truncate">
												{secret.id}
											</div>
										</td>
										<td className="px-4 py-3">
											<div className="text-sm text-gray-300 font-mono">
												{secret.path}
											</div>
										</td>
										<td className="px-4 py-3">
											<div className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-300">
												{formatSecretType(secret.type)}
											</div>
										</td>
										<td className="px-4 py-3">
											<StatusBadge status={secret.status} />
										</td>
										<td className="px-4 py-3">
											<div className="flex flex-wrap gap-1">
												{secret.tags.length > 0
													? secret.tags.map((tag) => (
														<span
															key={tag}
															className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 border border-white/10"
														>
															{tag}
														</span>
													))
													: <span className="text-xs text-gray-600">—</span>}
											</div>
										</td>
										<td className="px-4 py-3">
											<div className="text-sm text-gray-300">
												{secret.version_count}
											</div>
										</td>
										<td className="px-4 py-3">
											<div className="text-sm text-gray-300">
												{formatCompactDate(secret.updated_at)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
