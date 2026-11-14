import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, C, Icon, IconButton, T, XS, SM, BASE, panelHeaderStyle, panelStyle } from "./theme";

type PathNode = { segment: string; fullPath: string; exactCount: number | null; totalCount: number; children: PathNode[] };

// Same tree as src/mainview/components/panels/Navigator.tsx.
function buildPathTree(paths: [string, number][]): PathNode[] {
	const root: PathNode[] = [];
	for (const [path, count] of paths) {
		let level = root;
		let current = "";
		let target: PathNode | null = null;
		for (const segment of path.split("/").filter(Boolean)) {
			current = `${current}/${segment}`;
			let node = level.find((entry) => entry.segment === segment);
			if (!node) {
				node = { segment, fullPath: current, exactCount: null, totalCount: 0, children: [] };
				level.push(node);
			}
			target = node;
			level = node.children;
		}
		if (target) target.exactCount = count;
	}
	const finalize = (nodes: PathNode[]): PathNode[] =>
		nodes
			.map((node) => {
				const children = finalize(node.children);
				return { ...node, children, totalCount: (node.exactCount ?? 0) + children.reduce((sum, child) => sum + child.totalCount, 0) };
			})
			.sort((left, right) => left.fullPath.localeCompare(right.fullPath));
	return finalize(root);
}

function CountBadge({ count, selected }: { count: number; selected: boolean }) {
	return (
		<div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, backgroundColor: selected ? C.cyan30 : C.w10 }}>
			<T size={XS} color={selected ? C.cyan300 : C.gray400}>{String(count)}</T>
		</div>
	);
}

type NavigatorProps = { paths: [string, number][]; pathFilter: string; onPathSelect: (path: string) => void; totalSecrets: number; onCollapse: () => void };

export function Navigator({ paths, pathFilter, onPathSelect, totalSecrets, onCollapse }: NavigatorProps) {
	const tree = useMemo(() => buildPathTree(paths), [paths]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	useEffect(() => {
		setExpanded((current) => {
			const next = new Set(current);
			if (current.size === 0) for (const node of tree) next.add(node.fullPath);
			if (pathFilter !== "all") {
				let path = "";
				for (const segment of pathFilter.split("/").filter(Boolean)) next.add((path = `${path}/${segment}`));
			}
			return next;
		});
	}, [tree, pathFilter]);

	const toggle = (path: string) =>
		setExpanded((current) => {
			const next = new Set(current);
			if (!next.delete(path)) next.add(path);
			return next;
		});

	const renderNodes = (nodes: PathNode[], depth = 0): ReactNode[] =>
		nodes.map((node) => {
			const hasChildren = node.children.length > 0;
			const selected = pathFilter === node.fullPath;
			const open = expanded.has(node.fullPath);
			return (
				<div key={node.fullPath} style={{ display: "flex", flexDirection: "column" }}>
					<div
						style={{
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							gap: 4,
							paddingLeft: 12 + depth * 18,
							borderRadius: 8,
							borderWidth: 1,
							borderColor: selected ? C.cyan30 : "transparent",
							backgroundColor: selected ? C.cyan20 : undefined,
							hover: selected ? undefined : { backgroundColor: C.w5 },
						}}
					>
						<Button
							onClick={() => (hasChildren ? toggle(node.fullPath) : onPathSelect(node.fullPath))}
							style={{ width: 28, height: 36, justifyContent: "center", borderRadius: 6 }}
							hover={{ backgroundColor: C.w5 }}
						>
							{hasChildren ? <Icon name={open ? "ChevronDown" : "ChevronRight"} size={14} color={selected ? C.cyan400 : C.gray500} /> : <div style={{ width: 14 }} />}
						</Button>
						<Button
							testId={`path-${node.fullPath}`}
							onClick={() => onPathSelect(node.fullPath)}
							style={{ flexGrow: 1, minWidth: 0, justifyContent: "space-between", gap: 12, paddingTop: 10, paddingBottom: 10, paddingRight: 12 }}
							hover={{ backgroundColor: "transparent" }}
						>
							<T size={SM} mono truncate weight={selected ? 500 : undefined} color={selected ? C.cyan300 : C.gray300}>
								{depth === 0 ? node.fullPath : node.segment}
							</T>
							<CountBadge count={node.totalCount} selected={selected} />
						</Button>
					</div>
					{hasChildren && open ? renderNodes(node.children, depth + 1) : null}
				</div>
			);
		});

	const allSelected = pathFilter === "all";
	return (
		<div style={panelStyle}>
			<div style={panelHeaderStyle}>
				<div style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 16 }}>
					<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
						<Icon name="FolderTree" size={14} color={C.gray500} />
						<T size={XS} color={C.gray500}>{String(paths.length)}</T>
					</div>
					<IconButton name="PanelLeftClose" size={14} padding={4} bordered={false} onClick={onCollapse} testId="collapse-paths" />
				</div>
				<T size={BASE} weight={500}>Paths</T>
			</div>
			<div style={{ flexGrow: 1, minHeight: 0, overflowY: "scroll" }}>
				<div style={{ display: "flex", flexDirection: "column", padding: 8 }}>
					<Button
						testId="path-all"
						onClick={() => onPathSelect("all")}
						style={{
							justifyContent: "space-between",
							paddingLeft: 12,
							paddingRight: 12,
							paddingTop: 10,
							paddingBottom: 10,
							borderRadius: 8,
							borderWidth: 1,
							borderColor: allSelected ? C.cyan30 : "transparent",
							backgroundColor: allSelected ? C.cyan20 : undefined,
						}}
						hover={allSelected ? { backgroundColor: C.cyan20 } : { backgroundColor: C.w5 }}
					>
						<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Icon name={allSelected ? "ChevronDown" : "ChevronRight"} size={14} color={allSelected ? C.cyan400 : C.gray500} />
							<T size={SM} weight={allSelected ? 500 : undefined} color={allSelected ? C.cyan300 : C.gray300}>All paths</T>
						</div>
						<CountBadge count={totalSecrets} selected={allSelected} />
					</Button>
					{renderNodes(tree)}
				</div>
			</div>
		</div>
	);
}

