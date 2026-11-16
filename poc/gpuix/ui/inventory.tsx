import type { ReactNode } from "react";
import type { EventPayload } from "@gpuix/react";
import type { Secret } from "../../../src/shared/models";
import type { InventorySortDirection, InventorySortKey, StatusFilter } from "../../../src/mainview/lib/secret-list";
import { Button, C, Icon, Pill, StatusBadge, T, XS, SM, BASE, formatSecretType, panelHeaderStyle, panelStyle } from "./theme";

const COLUMNS = { name: 300, path: 230, type: 120, status: 110, tags: 180, versions: 110, updated: 110 };
const TABLE_WIDTH = Object.values(COLUMNS).reduce((sum, width) => sum + width, 0);

const FILTERS: { key: StatusFilter; label: string }[] = [
	{ key: "all", label: "ALL" },
	{ key: "ready", label: "READY" },
	{ key: "attention", label: "ATTENTION" },
];

function compactDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Cell({ width, children }: { width: number; children: ReactNode }) {
	return <div style={{ width, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}>{children}</div>;
}

type InventoryProps = {
	secrets: Secret[];
	totalCount: number;
	loading: boolean;
	selectedIds: Set<string>;
	onRowClick: (secret: Secret, index: number, event: EventPayload) => void;
	onRowOpen: (secret: Secret) => void;
	onSelectAll: () => void;
	query: string;
	onQueryChange: (query: string) => void;
	statusFilter: StatusFilter;
	onStatusFilterChange: (filter: StatusFilter) => void;
	tagFilter: Set<string>;
	onTagFilterChange: (tags: Set<string>) => void;
	typeFilter: string;
	onTypeFilterChange: (type: string) => void;
	sortKey: InventorySortKey;
	sortDirection: InventorySortDirection;
	onSortChange: (key: InventorySortKey, direction: InventorySortDirection) => void;
};

export function Inventory(props: InventoryProps) {
	const { secrets, totalCount, loading, selectedIds, query, statusFilter, tagFilter, typeFilter, sortKey, sortDirection } = props;
	const allSelected = secrets.length > 0 && secrets.every((secret) => selectedIds.has(secret.id));

	const sort = (key: InventorySortKey) =>
		props.onSortChange(key, sortKey === key ? (sortDirection === "desc" ? "asc" : "desc") : key === "name" ? "asc" : "desc");

	const header = (label: string, width: number, key?: InventorySortKey) => (
		<Cell width={width}>
			<Button testId={key ? `sort-${key}` : undefined} onClick={key ? () => sort(key) : undefined} style={{ gap: 4 }} hover={{ backgroundColor: "transparent" }}>
				<T size={XS} weight={500} color={key && sortKey === key ? C.cyan300 : C.gray400}>{label.toUpperCase()}</T>
				{key && sortKey === key ? <Icon name={sortDirection === "desc" ? "ChevronDown" : "ChevronUp"} size={14} color={C.cyan300} /> : null}
			</Button>
		</Cell>
	);

	return (
		<div style={panelStyle}>
			<div style={panelHeaderStyle}>
				<div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
					<T size={SM} weight={500} color={C.gray400}>INVENTORY</T>
					<T size={XS} color={C.gray500}>{loading ? "Refreshing…" : `${secrets.length} visible of ${totalCount}`}</T>
				</div>
				<div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
					<T size={BASE} weight={500}>Secrets</T>
					<Button
						testId="select-all"
						onClick={props.onSelectAll}
						disabled={secrets.length === 0 || allSelected}
						style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 6, borderWidth: 1, borderColor: C.w10, backgroundColor: C.w5 }}
					>
						<T size={XS} weight={500} color={C.gray300}>Select All</T>
					</Button>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 12, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: C.w10, backgroundColor: C.w5 }}>
						<Icon name="Search" size={16} color={C.gray400} />
						<input
							testId="search"
							value={query}
							placeholder="Filter by name or path"
							onChange={(event) => props.onQueryChange(event.value ?? "")}
							style={{ flexGrow: 1, fontSize: SM, color: C.white }}
						/>
					</div>
					<div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
						{FILTERS.map((filter) => (
							<Pill key={filter.key} testId={`filter-${filter.key}`} active={statusFilter === filter.key} onClick={() => props.onStatusFilterChange(filter.key)}>
								<T size={XS} weight={500} color={statusFilter === filter.key ? C.cyan300 : C.gray400}>{filter.label}</T>
							</Pill>
						))}
						<Pill active={false} onClick={() => props.onTagFilterChange(new Set())} testId="tags">
							<Icon name="Tag" size={12} color={tagFilter.size > 0 ? C.emerald300 : C.gray400} />
							<T size={XS} weight={500} color={tagFilter.size > 0 ? C.emerald300 : C.gray400}>{tagFilter.size > 0 ? `Tags ${tagFilter.size}` : "Tags"}</T>
						</Pill>
						{typeFilter !== "all" ? (
							<Pill active onClick={() => props.onTypeFilterChange("all")}>
								<T size={XS} weight={500} color={C.cyan300}>{`Type: ${formatSecretType(typeFilter)}`}</T>
								<Icon name="X" size={12} color={C.cyan300} />
							</Pill>
						) : null}
					</div>
				</div>
			</div>

			{loading || secrets.length === 0 ? (
				<div style={{ padding: 32, alignItems: "center", display: "flex", flexDirection: "column" }}>
					<T size={SM} color={C.gray500}>{loading ? "Fetching the current project inventory…" : "No secrets match this view."}</T>
				</div>
			) : (
				<div style={{ flexGrow: 1, minHeight: 0, overflowX: "scroll" }}>
					<div style={{ width: TABLE_WIDTH, height: "100%", display: "flex", flexDirection: "column" }}>
						<div style={{ display: "flex", flexDirection: "row", backgroundColor: C.tableHead, borderBottomWidth: 1, borderColor: C.w10 }}>
							{header("Name", COLUMNS.name, "name")}
							{header("Path", COLUMNS.path)}
							{header("Type", COLUMNS.type)}
							{header("Status", COLUMNS.status)}
							{header("Tags", COLUMNS.tags)}
							{header("Versions", COLUMNS.versions, "version_count")}
							{header("Updated", COLUMNS.updated, "updated_at")}
						</div>
						<div style={{ flexGrow: 1, minHeight: 0, overflowY: "scroll" }}>
							{secrets.map((secret, index) => {
								const selected = selectedIds.has(secret.id);
								return (
									<div
										key={secret.id}
										testId={`secret-${secret.name}`}
										onClick={(event) => (event.clickCount === 2 ? props.onRowOpen(secret) : props.onRowClick(secret, index, event))}
										style={{
											display: "flex",
											flexDirection: "row",
											cursor: "pointer",
											userSelect: "none",
											borderBottomWidth: 1,
											borderColor: C.w5,
											backgroundColor: selected ? C.cyan10 : undefined,
											hover: selected ? undefined : { backgroundColor: C.w5 },
										}}
									>
										{selected ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, backgroundColor: C.cyan400 }} /> : null}
										<Cell width={COLUMNS.name}>
											<T size={SM} weight={500} truncate>{secret.name}</T>
											<T size={XS} color={C.gray500} mono truncate>{secret.id}</T>
										</Cell>
										<Cell width={COLUMNS.path}>
											<T size={SM} color={C.gray300} mono truncate>{secret.path}</T>
										</Cell>
										<Cell width={COLUMNS.type}>
											<Button
												onClick={() => props.onTypeFilterChange(typeFilter === (secret.type ?? "") ? "all" : (secret.type ?? ""))}
												style={{ alignSelf: "flex-start", paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, borderWidth: 1, ...(typeFilter === (secret.type ?? "") ? { borderColor: C.cyan30, backgroundColor: C.cyan20 } : { borderColor: C.w10, backgroundColor: C.w5 }) }}
											>
												<T size={XS} color={typeFilter === (secret.type ?? "") ? C.cyan300 : C.gray300}>{formatSecretType(secret.type)}</T>
											</Button>
										</Cell>
										<Cell width={COLUMNS.status}>
											<div style={{ alignSelf: "flex-start" }}>
												<StatusBadge status={secret.status} />
											</div>
										</Cell>
										<Cell width={COLUMNS.tags}>
											<div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
												{secret.tags.length > 0 ? (
													secret.tags.map((tag) => (
														<Button
															key={tag}
															onClick={() => props.onTagFilterChange(new Set(tagFilter).add(tag))}
															style={{
																paddingLeft: 6,
																paddingRight: 6,
																paddingTop: 2,
																paddingBottom: 2,
																borderRadius: 4,
																borderWidth: 1,
																borderColor: tagFilter.has(tag) ? C.emerald30 : C.w10,
																backgroundColor: tagFilter.has(tag) ? C.emerald20 : C.w10,
															}}
															hover={{ backgroundColor: C.w15 }}
														>
															<T size={10} color={tagFilter.has(tag) ? C.emerald300 : C.gray300}>{tag}</T>
														</Button>
													))
												) : (
													<T size={XS} color={C.gray600}>—</T>
												)}
											</div>
										</Cell>
										<Cell width={COLUMNS.versions}>
											<T size={SM} color={C.gray300}>{String(secret.version_count)}</T>
										</Cell>
										<Cell width={COLUMNS.updated}>
											<T size={SM} color={C.gray300}>{compactDate(secret.updated_at)}</T>
										</Cell>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
