import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, Search, Trash2, X } from "lucide-react";

import {
	applyStructOp,
	buildStructure,
	detectFormat,
	unquoteDisplay,
	type StructureGroup,
	type StructureLeaf,
} from "../value-format";

const KIND_LABELS: Record<StructureLeaf["kind"], string> = {
	string: "str",
	number: "num",
	bool: "bool",
	null: "null",
	array: "array",
};

const INPUT_CLASS =
	"bg-white/[0.04] border border-transparent rounded-md px-2 py-0.5 font-mono text-sm focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] hover:border-white/10 transition-colors";

function ScalarInput({ leaf, onCommit }: { leaf: StructureLeaf; onCommit: (raw: string) => void }) {
	const [draft, setDraft] = useState(leaf.value);

	useEffect(() => {
		setDraft(leaf.value);
	}, [leaf.value]);

	function commit() {
		if (draft !== leaf.value) onCommit(draft);
	}

	if (leaf.value.includes("\n")) {
		return (
			<textarea
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						e.stopPropagation();
						setDraft(leaf.value);
					}
				}}
				rows={Math.min(draft.split("\n").length, 6)}
				spellCheck={false}
				className={`${INPUT_CLASS} w-full resize-y text-emerald-300 leading-relaxed`}
			/>
		);
	}

	const color = leaf.kind === "number" ? "text-amber-300" : leaf.kind === "null" ? "text-gray-400" : "text-emerald-300";
	return (
		<input
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					commit();
				} else if (e.key === "Escape") {
					e.stopPropagation();
					setDraft(leaf.value);
				}
			}}
			spellCheck={false}
			className={`${INPUT_CLASS} w-full ${color}`}
		/>
	);
}

function BoolToggle({ leaf, onCommit }: { leaf: StructureLeaf; onCommit: (raw: string) => void }) {
	const on = leaf.value === "true";
	return (
		<button
			type="button"
			onClick={() => onCommit(on ? "false" : "true")}
			className="flex items-center gap-2 font-mono text-sm"
			title="Toggle"
		>
			<span className={on ? "text-amber-300" : "text-gray-500"}>{leaf.value}</span>
			<span className={`relative inline-block w-7 h-4 rounded-full transition-colors ${on ? "bg-cyan-500/60" : "bg-white/10"}`}>
				<span
					className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`}
				/>
			</span>
		</button>
	);
}

function ArrayChips({ leaf, onCommit }: { leaf: StructureLeaf; onCommit: (items: string[]) => void }) {
	const [adding, setAdding] = useState(false);
	const [draft, setDraft] = useState("");
	const items = leaf.items ?? [];

	function quoteLike(text: string): string {
		const sample = items.find((item) => item.startsWith("'") || item.startsWith('"'));
		if (sample?.startsWith("'") && !text.includes("'")) return `'${text}'`;
		return JSON.stringify(text);
	}

	function commitAdd() {
		const trimmed = draft.trim();
		setAdding(false);
		setDraft("");
		if (!trimmed) return;
		const literal = /^(true|false|null|[+-]?\d+(\.\d+)?)$/.test(trimmed) ? trimmed : quoteLike(trimmed);
		onCommit([...items, literal]);
	}

	return (
		<span className="flex flex-wrap items-center gap-1.5">
			{items.map((item, i) => (
				<span
					key={`${item}-${i}`}
					className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-px font-mono text-xs text-emerald-300"
				>
					{unquoteDisplay(item)}
					<button
						type="button"
						title="Remove item"
						onClick={() => onCommit(items.filter((_, j) => j !== i))}
						className="text-gray-500 hover:text-red-400 transition-colors"
					>
						<X className="w-2.5 h-2.5" />
					</button>
				</span>
			))}
			{adding ? (
				<input
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commitAdd}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commitAdd();
						} else if (e.key === "Escape") {
							e.stopPropagation();
							setAdding(false);
							setDraft("");
						}
					}}
					spellCheck={false}
					className={`${INPUT_CLASS} w-32 text-xs text-emerald-300`}
				/>
			) : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-px font-mono text-xs text-gray-500 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
				>
					<Plus className="w-2.5 h-2.5" /> add
				</button>
			)}
		</span>
	);
}

function AddKeyRow({ group, onAdd }: { group: StructureGroup; onAdd: (key: string, raw: string) => void }) {
	const [open, setOpen] = useState(false);
	const [key, setKey] = useState("");
	const [val, setVal] = useState("");

	function reset() {
		setOpen(false);
		setKey("");
		setVal("");
	}

	function commit() {
		if (key.trim()) onAdd(key.trim(), val);
		reset();
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-1.5 pl-6 py-1 text-xs text-gray-500 hover:text-cyan-300 transition-colors"
			>
				<Plus className="w-3 h-3" /> add key{group.title ? <span className="font-mono text-cyan-300/70">to [{group.title}]</span> : null}
			</button>
		);
	}
	return (
		<div className="flex items-center gap-2 pl-6 py-1">
			<input
				autoFocus
				placeholder="key"
				value={key}
				onChange={(e) => setKey(e.target.value)}
				onKeyDown={(e) => e.key === "Escape" && reset()}
				spellCheck={false}
				className={`${INPUT_CLASS} w-40 text-cyan-300`}
			/>
			<span className="text-gray-600">=</span>
			<input
				placeholder="value"
				value={val}
				onChange={(e) => setVal(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") commit();
					else if (e.key === "Escape") reset();
				}}
				spellCheck={false}
				className={`${INPUT_CLASS} flex-1 text-emerald-300`}
			/>
			<button type="button" onClick={commit} title="Add" className="p-1 text-cyan-300 hover:bg-white/10 rounded">
				<Check className="w-3.5 h-3.5" />
			</button>
			<button type="button" onClick={reset} title="Cancel" className="p-1 text-gray-500 hover:bg-white/10 rounded">
				<X className="w-3.5 h-3.5" />
			</button>
		</div>
	);
}

function AddSectionRow({ onAdd }: { onAdd: (title: string) => void }) {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");

	function reset() {
		setOpen(false);
		setTitle("");
	}

	function commit() {
		if (title.trim()) onAdd(title.trim());
		reset();
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-1.5 py-1 text-xs text-gray-500 hover:text-amber-300 transition-colors"
			>
				<Plus className="w-3 h-3" /> add section
			</button>
		);
	}
	return (
		<div className="flex items-center gap-2 py-1">
			<span className="text-gray-600">[</span>
			<input
				autoFocus
				placeholder="section.name"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") commit();
					else if (e.key === "Escape") reset();
				}}
				spellCheck={false}
				className={`${INPUT_CLASS} w-56 text-amber-300`}
			/>
			<span className="text-gray-600">]</span>
			<button type="button" onClick={commit} title="Add section" className="p-1 text-cyan-300 hover:bg-white/10 rounded">
				<Check className="w-3.5 h-3.5" />
			</button>
			<button type="button" onClick={reset} title="Cancel" className="p-1 text-gray-500 hover:bg-white/10 rounded">
				<X className="w-3.5 h-3.5" />
			</button>
		</div>
	);
}

// Design D: structured tree editor — sections as collapsible groups, typed leaves,
// array chips, add/remove keys/sections, key filter. Mutations flow through applyStructOp.
export function ValueStructureEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	const groups = useMemo(() => buildStructure(value), [value]);
	const format = useMemo(() => detectFormat(value), [value]);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [filter, setFilter] = useState("");

	if (!groups || groups.length === 0) {
		return (
			<p className="text-xs text-gray-500 px-1 py-2">
				Not structured (JSON, TOML, or .env) — use the Raw tab to edit this value.
			</p>
		);
	}

	function toggle(title: string) {
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(title)) next.delete(title);
			else next.add(title);
			return next;
		});
	}

	const query = filter.trim().toLowerCase();
	const visibleGroups = query
		? groups
				.map((group) => ({
					...group,
					leaves: group.title.toLowerCase().includes(query)
						? group.leaves
						: group.leaves.filter(
								(leaf) =>
									leaf.key.toLowerCase().includes(query) || leaf.value.toLowerCase().includes(query),
							),
				}))
				.filter((group) => group.leaves.length > 0 || group.title.toLowerCase().includes(query))
		: groups;
	const totalLeaves = groups.reduce((sum, group) => sum + group.leaves.length, 0);

	return (
		<div className="space-y-1 font-mono text-sm">
			{totalLeaves >= 5 || (groups?.length ?? 0) >= 3 ? (
				<div className="flex items-center gap-2 mb-2 px-2 py-1 rounded-md border border-white/10 bg-white/[0.03] max-w-xs">
					<Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
					<input
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						placeholder="Filter keys…"
						spellCheck={false}
						className="w-full bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
					/>
					{filter ? (
						<button type="button" onClick={() => setFilter("")} className="text-gray-500 hover:text-gray-300">
							<X className="w-3 h-3" />
						</button>
					) : null}
				</div>
			) : null}
			{query && visibleGroups.length === 0 ? (
				<p className="text-xs text-gray-500 px-1 py-1">No keys match “{filter.trim()}”.</p>
			) : null}
			{visibleGroups.map((group) => {
				const isCollapsed = !query && collapsed.has(group.title);
				const Chevron = isCollapsed ? ChevronRight : ChevronDown;
				return (
					<div key={group.title || "(top)"}>
						<button
							type="button"
							onClick={() => toggle(group.title)}
							className="flex items-center gap-2 w-full text-left py-1 rounded hover:bg-white/[0.03] transition-colors"
						>
							<Chevron className="w-3.5 h-3.5 text-gray-500 shrink-0" />
							<span className="text-amber-300 font-semibold">{group.title ? `[${group.title}]` : "top level"}</span>
							{group.comment ? <span className="text-gray-600 italic text-xs truncate">{group.comment}</span> : null}
							<span className="ml-auto text-[11px] text-gray-600">{group.leaves.length} key{group.leaves.length === 1 ? "" : "s"}</span>
						</button>
						{isCollapsed ? null : (
							<div className="mb-2">
								{group.leaves.map((leaf) => (
									<div key={leaf.key} className="group/row flex items-start gap-3 pl-6 py-0.5">
										<span className="text-cyan-300 min-w-[140px] max-w-[280px] break-words pt-0.5">{leaf.key}</span>
										<span className="text-[9px] uppercase text-gray-600 border border-white/10 rounded px-1 mt-1.5 shrink-0">
											{KIND_LABELS[leaf.kind]}
										</span>
										<span className="flex-1 min-w-0 flex items-start gap-2">
											{leaf.kind === "array" ? (
												<ArrayChips
													leaf={leaf}
													onCommit={(items) => onChange(applyStructOp(value, leaf.path, { type: "setArrayItems", items }))}
												/>
											) : leaf.kind === "bool" ? (
												<BoolToggle
													leaf={leaf}
													onCommit={(raw) => onChange(applyStructOp(value, leaf.path, { type: "set", raw }))}
												/>
											) : (
												<ScalarInput
													leaf={leaf}
													onCommit={(raw) => onChange(applyStructOp(value, leaf.path, { type: "set", raw }))}
												/>
											)}
											{leaf.comment ? <span className="text-gray-600 italic text-xs pt-1 shrink-0">{leaf.comment}</span> : null}
										</span>
										<button
											type="button"
											title={`Remove ${leaf.key}`}
											onClick={() => onChange(applyStructOp(value, leaf.path, { type: "remove" }))}
											className="p-1 mt-0.5 rounded text-gray-600 opacity-0 group-hover/row:opacity-100 hover:text-red-400 hover:bg-white/5 transition-all"
										>
											<Trash2 className="w-3 h-3" />
										</button>
									</div>
								))}
								{query ? null : (
									<AddKeyRow
										group={group}
										onAdd={(key, raw) => onChange(applyStructOp(value, group.path, { type: "add", key, raw }))}
									/>
								)}
							</div>
						)}
					</div>
				);
			})}
			{!query && (format === "toml" || format === "json") ? (
				<AddSectionRow onAdd={(title) => onChange(applyStructOp(value, [], { type: "addSection", title }))} />
			) : null}
		</div>
	);
}
