import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
	detectEmbedded,
	detectFormat,
	flattenEnv,
	flattenJson,
	envToJson,
	flattenToml,
	jsonToToml,
	parseJsonContainer,
	tomlToJson,
	tokenizeLines,
	type FlatRow,
	type Token,
	type ValueFormat,
} from "../value-format";

export const TOKEN_CLASSES: Record<Token["type"], string> = {
	comment: "text-gray-600 italic",
	section: "text-amber-300 font-semibold",
	key: "text-cyan-300",
	punct: "text-gray-500",
	string: "text-emerald-300",
	number: "text-amber-300",
	bool: "text-amber-300",
	text: "text-gray-300",
};

function TokenSpans({ tokens }: { tokens: Token[] }) {
	return (
		<>
			{tokens.map((token, i) => (
				<span key={i} className={TOKEN_CLASSES[token.type]}>
					{token.text}
				</span>
			))}
		</>
	);
}

function HighlightedLines({ value, format }: { value: string; format: "toml" | "env" }) {
	const lines = useMemo(() => tokenizeLines(value, format), [value, format]);
	return (
		<>
			{lines.map((tokens, i) => (
				<span key={i}>
					<TokenSpans tokens={tokens} />
					{"\n"}
				</span>
			))}
		</>
	);
}

type EmbeddedChipProps = {
	format: "json" | "toml";
	expanded: boolean;
	onToggle: () => void;
};

function EmbeddedChip({ format, expanded, onToggle }: EmbeddedChipProps) {
	const Chevron = expanded ? ChevronDown : ChevronRight;
	return (
		<button
			type="button"
			onClick={onToggle}
			className="inline-flex items-center gap-1 align-middle px-1.5 py-px rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
		>
			<Chevron className="w-2.5 h-2.5" />
			embedded {format.toUpperCase()}
		</button>
	);
}

type JsonNodesCtx = {
	expanded: Set<string>;
	toggle: (path: string) => void;
};

function jsonScalar(node: unknown): ReactNode {
	if (typeof node === "string") {
		return <span className={TOKEN_CLASSES.string}>{JSON.stringify(node)}</span>;
	}
	if (typeof node === "number" || typeof node === "boolean" || node === null) {
		return <span className={TOKEN_CLASSES.number}>{String(node)}</span>;
	}
	return null;
}

function renderJsonString(
	value: string,
	indent: string,
	path: string,
	ctx: JsonNodesCtx,
	trailing: ReactNode,
): ReactNode {
	const embedded = detectEmbedded(value);
	if (!embedded) {
		return (
			<>
				{jsonScalar(value)}
				{trailing}
			</>
		);
	}
	const expanded = ctx.expanded.has(path);
	const chip = (
		<EmbeddedChip format={embedded} expanded={expanded} onToggle={() => ctx.toggle(path)} />
	);
	if (!expanded) {
		return (
			<>
				{chip}
				{trailing}
			</>
		);
	}
	const inner =
		embedded === "json" ? (
			renderJsonNode(parseJsonContainer(value), `${indent}  `, `${path}!`, ctx, null)
		) : (
			<HighlightedLines value={value.replace(/\n$/, "")} format="toml" />
		);
	return (
		<>
			{chip}
			{trailing}
			{"\n"}
			<span className="inline-block border-l-2 border-cyan-500/30 pl-3 ml-1 align-top">
				{embedded === "toml" ? inner : <>{indent}  {inner}</>}
			</span>
		</>
	);
}

function renderJsonNode(
	node: unknown,
	indent: string,
	path: string,
	ctx: JsonNodesCtx,
	trailing: ReactNode = null,
): ReactNode {
	if (typeof node === "string") {
		return renderJsonString(node, indent, path, ctx, trailing);
	}
	if (typeof node !== "object" || node === null) {
		return (
			<>
				{jsonScalar(node)}
				{trailing}
			</>
		);
	}

	const inner = `${indent}  `;
	const comma = <span className={TOKEN_CLASSES.punct}>,</span>;
	if (Array.isArray(node)) {
		if (node.length === 0) {
			return (
				<>
					<span className={TOKEN_CLASSES.punct}>[]</span>
					{trailing}
				</>
			);
		}
		return (
			<>
				<span className={TOKEN_CLASSES.punct}>[</span>
				{"\n"}
				{node.map((item, i) => (
					<span key={i}>
						{inner}
						{renderJsonNode(item, inner, `${path}[${i}]`, ctx, i < node.length - 1 ? comma : null)}
						{"\n"}
					</span>
				))}
				{indent}
				<span className={TOKEN_CLASSES.punct}>]</span>
				{trailing}
			</>
		);
	}

	const entries = Object.entries(node as Record<string, unknown>);
	if (entries.length === 0) {
		return (
			<>
				<span className={TOKEN_CLASSES.punct}>{"{}"}</span>
				{trailing}
			</>
		);
	}
	return (
		<>
			<span className={TOKEN_CLASSES.punct}>{"{"}</span>
			{"\n"}
			{entries.map(([key, item], i) => (
				<span key={key}>
					{inner}
					<span className={TOKEN_CLASSES.key}>{JSON.stringify(key)}</span>
					<span className={TOKEN_CLASSES.punct}>: </span>
					{renderJsonNode(item, inner, `${path}.${key}`, ctx, i < entries.length - 1 ? comma : null)}
					{"\n"}
				</span>
			))}
			{indent}
			<span className={TOKEN_CLASSES.punct}>{"}"}</span>
			{trailing}
		</>
	);
}

const KIND_CLASSES: Record<FlatRow["kind"], string> = {
	string: "text-emerald-300",
	number: "text-amber-300",
	bool: "text-amber-300",
	null: "text-gray-500",
};

function flattenValue(value: string, format: ValueFormat): FlatRow[] {
	if (format === "json") return flattenJson(parseJsonContainer(value));
	if (format === "toml") return flattenToml(value);
	if (format === "env") return flattenEnv(value);
	return [];
}

function TableView({ rows }: { rows: FlatRow[] }) {
	return (
		<table className="w-full table-fixed text-sm font-mono">
			<colgroup>
				<col className="w-[36%]" />
				<col />
			</colgroup>
			<tbody>
				{rows.map((row, i) => (
					<tr key={`${row.key}-${i}`} className="border-b border-white/5 last:border-0">
						<td className="py-1 pr-4 text-cyan-300 align-top break-words">{row.key}</td>
						<td className={`py-1 break-all whitespace-pre-wrap ${KIND_CLASSES[row.kind]}`}>{row.value}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

type ViewMode = "formatted" | "table" | "json" | "toml" | "raw";

// Sticky across entries, edit toggles, and reopens — a Table person stays in Table.
const MODE_KEY = "scw-secrets-value-view-mode";

export function prefersTableMode(): boolean {
	return loadPreferredMode() === "table";
}

function loadPreferredMode(): ViewMode {
	try {
		const stored = localStorage.getItem(MODE_KEY);
		if (stored === "table" || stored === "json" || stored === "toml" || stored === "raw") return stored;
	} catch {
		// ignore
	}
	return "formatted";
}

export function ValueViewer({ value }: { value: string }) {
	const format = useMemo(() => detectFormat(value), [value]);
	const [mode, setModeState] = useState<ViewMode>(loadPreferredMode);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	function setMode(next: ViewMode) {
		setModeState(next);
		try {
			localStorage.setItem(MODE_KEY, next);
		} catch {
			// ignore
		}
	}

	if (format === "plain") {
		return (
			<pre className="text-sm text-cyan-200 font-mono whitespace-pre-wrap break-all">{value}</pre>
		);
	}

	const ctx: JsonNodesCtx = {
		expanded,
		toggle: (path) =>
			setExpanded((current) => {
				const next = new Set(current);
				if (next.has(path)) next.delete(path);
				else next.add(path);
				return next;
			}),
	};

	// the conversion tab is whichever format the value is NOT
	const modes: [ViewMode, string][] = [
		["formatted", "Formatted"],
		["table", "Table"],
		...(format === "json"
			? ([["toml", "TOML"]] as [ViewMode, string][])
			: ([["json", "JSON"]] as [ViewMode, string][])),
		["raw", "Raw"],
	];
	const effectiveMode =
		(mode === "toml" && format !== "json") || (mode === "json" && format === "json")
			? "formatted"
			: mode;

	return (
		<div>
			<div className="flex items-center gap-2 mb-2">
				<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
					{format.toUpperCase()}
				</span>
				<div className="ml-auto flex text-[11px] rounded-md border border-white/10 overflow-hidden">
					{modes.map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => setMode(key)}
							className={`px-2 py-0.5 transition-colors ${effectiveMode === key ? "bg-cyan-500/20 text-cyan-200" : "text-gray-400 hover:bg-white/5"}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>
			{effectiveMode === "table" ? (
				<TableView rows={flattenValue(value, format)} />
			) : (
				<pre className="text-sm font-mono whitespace-pre-wrap break-all leading-relaxed">
					{effectiveMode === "raw" ? (
						<span className="text-cyan-200">{value}</span>
					) : effectiveMode === "toml" ? (
						<HighlightedLines value={jsonToToml(value).replace(/\n$/, "")} format="toml" />
					) : effectiveMode === "json" ? (
						renderJsonNode(format === "toml" ? tomlToJson(value) : envToJson(value), "", "$", ctx)
					) : format === "json" ? (
						renderJsonNode(parseJsonContainer(value), "", "$", ctx)
					) : (
						<HighlightedLines value={value.replace(/\n$/, "")} format={format} />
					)}
				</pre>
			)}
		</div>
	);
}
