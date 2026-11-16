import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createRenderer, render, startFrameLoop } from "@gpuix/react";
import type { ProfileSummary, Project, Secret } from "../../src/shared/models";
import { getNextSelectionState, getSelectAllState } from "../../src/mainview/lib/inventory-selection";
import {
	filterSecrets,
	getPathEntries,
	reconcileSelectedSecretIds,
	sortSecrets,
	type InventorySortDirection,
	type InventorySortKey,
	type StatusFilter,
} from "../../src/mainview/lib/secret-list";
import { api } from "./api";
import { DetailPanel } from "./ui/detail";
import { Inventory } from "./ui/inventory";
import { Header, PaneRail, StatsCards } from "./ui/layout";
import { Navigator } from "./ui/navigator";
import { C, SM, T } from "./ui/theme";
import { ValueModal, type ValueEntry } from "./ui/value";

// Read-only port of src/mainview/App.tsx; filtering, sorting and selection reuse its lib/ helpers.
export function SecretsApp() {
	const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
	const [profile, setProfile] = useState("");
	const [projects, setProjects] = useState<Project[]>([]);
	const [projectId, setProjectId] = useState("");
	const [secrets, setSecrets] = useState<Secret[]>([]);
	const [activeCounts, setActiveCounts] = useState<ReadonlyMap<string, number>>(new Map());
	const [loading, setLoading] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [lastClicked, setLastClicked] = useState<number | null>(null);
	const [query, setQuery] = useState("");
	const [pathFilter, setPathFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
	const [typeFilter, setTypeFilter] = useState("all");
	const [sortKey, setSortKey] = useState<InventorySortKey>("version_count");
	const [sortDirection, setSortDirection] = useState<InventorySortDirection>("desc");
	const [showPaths, setShowPaths] = useState(true);
	const [showDetail, setShowDetail] = useState(true);
	const [expanded, setExpanded] = useState<{ title: string; values: ValueEntry[] } | null>(null);
	const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

	useEffect(() => {
		api.getProfiles({})
			.then(({ active, profiles }) => {
				setProfiles(profiles);
				setProfile(active ?? profiles[0]?.name ?? "");
			})
			.catch(fail);
	}, []);

	useEffect(() => {
		if (!profile) return;
		api.getProjects({ profile })
			.then((list) => {
				setProjects(list);
				const preferred = profiles.find((entry) => entry.name === profile)?.projectId;
				setProjectId(list.find((entry) => entry.id === preferred)?.id ?? list[0]?.id ?? "");
			})
			.catch(fail);
	}, [profile, profiles]);

	useEffect(() => {
		if (!projectId) return;
		setLoading(true);
		setError(null);
		api.getSecrets({ profile, projectId })
			.then((list) => {
				setSecrets(list);
				setPathFilter("all");
				return api.getActiveVersionCounts({ secretIds: list.map((secret) => secret.id), profile, projectId });
			})
			.then(({ counts }) => setActiveCounts(new Map(Object.entries(counts))))
			.catch(fail)
			.finally(() => setLoading(false));
	}, [profile, projectId, refreshKey]);

	const deferredQuery = useDeferredValue(query);
	const visible = useMemo(
		() => sortSecrets(filterSecrets(secrets, { query: deferredQuery, pathFilter, statusFilter, tagFilter, typeFilter }), { sortKey, sortDirection }),
		[secrets, deferredQuery, pathFilter, statusFilter, tagFilter, typeFilter, sortKey, sortDirection],
	);

	useEffect(() => {
		const next = reconcileSelectedSecretIds(visible, selectedIds);
		if (next) setSelectedIds(next);
	}, [visible, selectedIds]);

	const active = (secret: Secret) => activeCounts.get(secret.id) ?? secret.version_count;
	const prunable = (list: Secret[]) => list.reduce((sum, secret) => sum + Math.max(active(secret) - 1, 0), 0);
	const versions = (list: Secret[]) => list.reduce((sum, secret) => sum + secret.version_count, 0);
	const selected = visible.filter((secret) => selectedIds.has(secret.id));
	const project = projects.find((entry) => entry.id === projectId) ?? null;

	const openValues = (targets: Secret[]) => {
		Promise.all(targets.map((secret) => api.getSecretValue({ secretId: secret.id, revision: "latest_enabled", profile, projectId })))
			.then((responses) =>
				setExpanded({
					title: targets.length === 1 ? targets[0].name : `${targets.length} secrets`,
					values: targets.map((secret, index) => ({ secretId: secret.id, name: secret.name, path: secret.path, value: responses[index].value })),
				}),
			)
			.catch(fail);
	};

	const columns = (showPaths ? [280] : [28]).concat(showDetail ? [360] : [28]);
	return (
		<div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: C.page }}>
			<Header
				profiles={profiles}
				profile={profile}
				onProfileChange={setProfile}
				projects={projects}
				project={project}
				onProjectChange={setProjectId}
				onRefresh={() => setRefreshKey((key) => key + 1)}
			/>
			<div style={{ flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 24 }}>
				<StatsCards
					filtered={visible.length}
					total={secrets.length}
					visibleVersions={versions(visible)}
					totalVersions={versions(secrets)}
					visiblePrunable={prunable(visible)}
					totalPrunable={prunable(secrets)}
				/>
				{error ? (
					<div style={{ marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.red30, backgroundColor: C.red10 }}>
						<T size={SM} color={C.red300}>{error}</T>
					</div>
				) : null}
				<div style={{ marginTop: 24, flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "row", gap: 16 }}>
					<div style={{ width: columns[0], flexShrink: 0, minHeight: 0 }}>
						{showPaths ? (
							<Navigator paths={getPathEntries(secrets)} pathFilter={pathFilter} onPathSelect={setPathFilter} totalSecrets={secrets.length} onCollapse={() => setShowPaths(false)} />
						) : (
							<PaneRail side="left" label="paths" onOpen={() => setShowPaths(true)} />
						)}
					</div>
					<div style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
						<Inventory
							secrets={visible}
							totalCount={secrets.length}
							loading={loading}
							selectedIds={selectedIds}
							onRowClick={(secret, index, event) => {
								const modifiers = event.modifiers;
								const next = getNextSelectionState(visible, selectedIds, lastClicked, secret, index, {
									shiftKey: modifiers?.shift ?? false,
									ctrlKey: modifiers?.ctrl ?? false,
									metaKey: modifiers?.cmd ?? false,
								});
								setSelectedIds(next.selectedSecretIds);
								setLastClicked(next.lastClickedIndex);
							}}
							onRowOpen={(secret) => openValues([secret])}
							onSelectAll={() => {
								const next = getSelectAllState(visible);
								setSelectedIds(next.selectedSecretIds);
								setLastClicked(next.lastClickedIndex);
							}}
							query={query}
							onQueryChange={setQuery}
							statusFilter={statusFilter}
							onStatusFilterChange={setStatusFilter}
							tagFilter={tagFilter}
							onTagFilterChange={setTagFilter}
							typeFilter={typeFilter}
							onTypeFilterChange={setTypeFilter}
							sortKey={sortKey}
							sortDirection={sortDirection}
							onSortChange={(key, direction) => {
								setSortKey(key);
								setSortDirection(direction);
							}}
						/>
					</div>
					<div style={{ width: columns[1], flexShrink: 0, minHeight: 0 }}>
						{showDetail ? (
							<DetailPanel secrets={selected} onView={() => openValues(selected)} onCollapse={() => setShowDetail(false)} />
						) : (
							<PaneRail side="right" label="detail" onOpen={() => setShowDetail(true)} />
						)}
					</div>
				</div>
			</div>
			{expanded ? <ValueModal title={expanded.title} values={expanded.values} onClose={() => setExpanded(null)} /> : null}
		</div>
	);
}

// Off macOS, tick() only polls for the last window closing, so the default 8 ms loop just burns idle CPU.
const CLOSE_POLL_MS = 250;

export function start() {
	const options = { title: "SCW Secrets — GPUIX POC", width: 1280, height: 800 };
	if (process.platform === "darwin") {
		render(<SecretsApp />, options);
		return;
	}
	const renderer = createRenderer();
	renderer.init(options);
	startFrameLoop(renderer, { frameMs: CLOSE_POLL_MS, onTerminated: () => process.exit(0) });
	render(<SecretsApp />, { renderer });
}

if (import.meta.main) start();
