import { useMemo, useState } from "react";
import {
	detectFormat,
	flattenEnv,
	flattenJson,
	flattenToml,
	jsonToToml,
	parseJsonContainer,
	tomlToJson,
	envToJson,
	type FlatRow,
	type ValueFormat,
} from "../../../src/mainview/lib/value-format";
import { Button, C, Icon, IconButton, T, XS, SM, MONO } from "./theme";

export type ValueEntry = { secretId: string; name: string; path: string; value: string };
type Mode = "table" | "formatted" | "toml" | "json" | "raw";

const KIND_COLORS: Record<FlatRow["kind"], string> = { string: C.emerald300, number: C.amber300, bool: C.amber300, null: C.gray500 };

function flatten(value: string, format: ValueFormat): FlatRow[] {
	if (format === "json") return flattenJson(parseJsonContainer(value));
	if (format === "toml") return flattenToml(value);
	if (format === "env") return flattenEnv(value);
	return [];
}

// Same threshold as the app: a filter only pays off on longer values.
const FILTER_MIN_ROWS = 5;
// Lilex advance at 14px; GPUI has no auto-width table columns.
const MONO_CHAR_WIDTH = 8.4;

function TableView({ rows }: { rows: FlatRow[] }) {
	const [filter, setFilter] = useState("");
	const query = filter.trim().toLowerCase();
	const visible = query ? rows.filter((row) => row.key.toLowerCase().includes(query) || row.value.toLowerCase().includes(query)) : rows;
	const keyWidth = Math.max(0, ...rows.map((row) => row.key.length)) * MONO_CHAR_WIDTH + 16;
	return (
		<div style={{ display: "flex", flexDirection: "column" }}>
			{rows.length >= FILTER_MIN_ROWS ? (
				<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 320, marginBottom: 8, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6, borderWidth: 1, borderColor: C.w10, backgroundColor: "rgba(255, 255, 255, 0.03)" }}>
					<Icon name="Search" size={14} color={C.gray500} />
					<input testId="key-filter" value={filter} placeholder="Filter keys…" onChange={(event) => setFilter(event.value ?? "")} style={{ flexGrow: 1, fontSize: XS, color: C.gray200 }} />
				</div>
			) : null}
			{query && visible.length === 0 ? <T size={XS} color={C.gray500}>{`No keys match “${filter.trim()}”.`}</T> : null}
			<div testId="value" style={{ display: "flex", flexDirection: "column" }}>
				{visible.map((row, index) => (
					<div key={`${row.key}-${index}`} style={{ display: "flex", flexDirection: "row", paddingTop: 4, paddingBottom: 4, borderBottomWidth: index === visible.length - 1 ? 0 : 1, borderColor: C.w5 }}>
						<T size={SM} mono color={C.cyan300} style={{ width: keyWidth, flexShrink: 0 }}>{row.key}</T>
						<T size={SM} mono color={KIND_COLORS[row.kind]} style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}>{row.value}</T>
					</div>
				))}
			</div>
		</div>
	);
}

function Code({ code, language }: { code: string; language: string }) {
	return <code code={code} language={language} style={{ fontFamily: MONO, fontSize: SM, color: C.cyan200 }} />;
}

function ValueViewer({ value }: { value: string }) {
	const format = useMemo(() => detectFormat(value), [value]);
	const [mode, setMode] = useState<Mode>("table");
	if (format === "plain") return <T size={SM} mono color={C.cyan200}>{value}</T>;

	const modes: [Mode, string][] = [["table", "Table"], ["formatted", "Formatted"], format === "json" ? ["toml", "TOML"] : ["json", "JSON"], ["raw", "Raw"]];
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
			<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
				<div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 999, borderWidth: 1, borderColor: C.cyan20, backgroundColor: C.cyan10 }}>
					<T size={10} weight={600} color={C.cyan300}>{format.toUpperCase()}</T>
				</div>
				<div style={{ flexGrow: 1 }} />
				<div style={{ display: "flex", flexDirection: "row", borderRadius: 6, borderWidth: 1, borderColor: C.w10, overflow: "hidden" }}>
					{modes.map(([key, label]) => (
						<Button
							key={key}
							testId={`mode-${key}`}
							onClick={() => setMode(key)}
							style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, backgroundColor: mode === key ? C.cyan20 : undefined }}
							hover={{ backgroundColor: mode === key ? C.cyan20 : C.w5 }}
						>
							<T size={11} color={mode === key ? C.cyan200 : C.gray400}>{label}</T>
						</Button>
					))}
				</div>
			</div>
			{mode === "table" ? (
				<TableView rows={flatten(value, format)} />
			) : mode === "raw" ? (
				<T size={SM} mono color={C.cyan200}>{value}</T>
			) : mode === "toml" ? (
				<Code code={jsonToToml(value).replace(/\n$/, "")} language="toml" />
			) : mode === "json" ? (
				<Code code={JSON.stringify(format === "toml" ? tomlToJson(value) : envToJson(value), null, 2)} language="json" />
			) : (
				<Code code={format === "json" ? JSON.stringify(parseJsonContainer(value), null, 2) : value.replace(/\n$/, "")} language={format === "json" ? "json" : format === "toml" ? "toml" : "bash"} />
			)}
		</div>
	);
}

export function ValueModal({ title, values, onClose }: { title: string; values: ValueEntry[]; onClose: () => void }) {
	return (
		<div
			style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 0.7)" }}
		>
			<div
				testId="value-modal"
				style={{ width: "90%", maxHeight: "85%", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 12, borderWidth: 1, borderColor: C.w10, backgroundColor: C.modal }}
			>
				<div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: C.w10 }}>
					<div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 12, minWidth: 0 }}>
						<T size={SM} weight={500} color={C.gray300}>{title}</T>
						{values.length === 1 ? <T size={XS} color={C.gray500} mono truncate>{values[0].path}</T> : null}
					</div>
					<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
						{/* share and edit are outside the POC's read-only slice */}
						{(["Share2", "Pencil"] as const).map((icon) => (
							<Button key={icon} disabled style={{ gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: C.w10, backgroundColor: C.w5 }}>
								<Icon name={icon} size={12} color={icon === "Share2" ? C.blue400 : C.gray300} />
								<T size={XS} color={C.gray300}>{icon === "Share2" ? "Share" : "Edit"}</T>
							</Button>
						))}
						<IconButton name="X" size={16} padding={6} bordered={false} onClick={onClose} testId="close-value" />
					</div>
				</div>
				<div style={{ flexGrow: 1, minHeight: 0, overflowY: "scroll" }}>
					<div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
						{values.map((entry) => (
							<div key={entry.secretId} style={{ padding: 16, borderRadius: 8, borderWidth: 1, borderColor: C.w5, backgroundColor: C.w5, display: "flex", flexDirection: "column", gap: 8 }}>
								<div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
									<T size={XS} weight={500} color={C.gray400}>{entry.name}</T>
									{values.length > 1 ? <T size={11} color={C.gray500} mono truncate>{entry.path}</T> : null}
									<div style={{ flexGrow: 1 }} />
									<Icon name="Copy" size={14} color={C.gray400} />
								</div>
								<ValueViewer value={entry.value} />
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
