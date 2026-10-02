import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Eye, Loader2, Pencil, Save, Share2, X } from "lucide-react";
import { copySecret } from "../../lib/clipboard";
import { secretConsoleUrl } from "../../lib/console";
import { useNextRevision } from "../../hooks/useNextRevision";
import { useSaveSecretValue } from "../../hooks/useSaveSecretValue";
import { HighlightedTextarea } from "../inputs/HighlightedTextarea";
import { KeyFilterContext } from "../inputs/KeyFilterInput";
import { ValueStructureEditor } from "../secret-value/ValueStructureEditor";
import { prefersTableMode, ValueViewer } from "../secret-value/ValueViewer";

export type EditTab = "raw" | "table" | "preview";

export function EditTabs({ tab, onChange, size = "sm" }: { tab: EditTab; onChange: (tab: EditTab) => void; size?: "sm" | "md" }) {
	const tabs: [EditTab, string][] = [
		["table", "Structure"],
		["raw", "Raw"],
		["preview", "Preview"],
	];
	const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs";
	return (
		<div className={`flex rounded-md border border-white/10 overflow-hidden ${size === "md" ? "rounded-lg" : ""}`}>
			{tabs.map(([key, label]) => (
				<button
					key={key}
					type="button"
					onClick={() => onChange(key)}
					className={`${pad} transition-colors ${tab === key ? "bg-cyan-500/20 text-cyan-200" : "text-gray-400 hover:bg-white/5"}`}
				>
					{label}
				</button>
			))}
		</div>
	);
}

type ValueEntry = { secretId: string; name: string; path?: string; value: string };

// What a save will do — Scaleway versions are immutable, so there is no in-place edit.
export function SaveHint({ revision, autoKeepLatest }: { revision: number | null; autoKeepLatest?: boolean }) {
	return (
		<p className="text-xs text-gray-500">
			{revision === null ? "Saving creates a new version." : `Saving creates version ${revision}.`}
			{autoKeepLatest ? <span className="text-amber-300/80"> Older versions will be scheduled for deletion (Keep Latest is on).</span> : null}
		</p>
	);
}

type ValueViewProps = {
	title: string;
	values: ValueEntry[];
	profile?: string;
	projectId?: string;
	autoKeepLatest?: boolean;
	onClose: () => void;
	onSaved: () => void;
};

function CopyButton({ text }: { text: string }) {
	const [failed, setFailed] = useState(false);
	return (
		<button
			type="button"
			onClick={() => { void copySecret(text).then(() => setFailed(false), () => setFailed(true)); }}
			title={failed ? "Copy failed" : "Copy value (clears after 45 seconds when clipboard access is available)"}
			className="p-1.5 hover:bg-white/10 rounded transition-colors flex-shrink-0"
		>
			<Copy className="w-3.5 h-3.5 text-gray-400" />
			{failed ? <span className="text-xs text-red-300">Copy failed</span> : null}
		</button>
	);
}

function tryFormatJson(value: string): string | null {
	try {
		return JSON.stringify(JSON.parse(value), null, 2);
	} catch {
		return null;
	}
}

function EditableEntry({
	entry,
	profile,
	projectId,
	autoKeepLatest,
	isOnlyEntry,
	onSaved,
	onDirtyChange,
}: {
	entry: ValueEntry;
	profile?: string;
	projectId?: string;
	autoKeepLatest?: boolean;
	isOnlyEntry: boolean;
	onSaved: () => void;
	onDirtyChange: (secretId: string, dirty: boolean) => void;
}) {
	const formatted = useMemo(() => tryFormatJson(entry.value) ?? entry.value, [entry.value]);
	const [value, setValue] = useState(formatted);
	const [tab, setTab] = useState<EditTab>(() => (prefersTableMode() ? "table" : "raw"));
	const target = { secretId: entry.secretId, profile, projectId, autoKeepLatest };
	const { save, saving, error } = useSaveSecretValue(target, onSaved);
	const hasChanges = value !== formatted;
	const revision = useNextRevision(target, hasChanges);
	useEffect(() => onDirtyChange(entry.secretId, hasChanges), [entry.secretId, hasChanges]);
	const formattedJson = useMemo(() => tryFormatJson(value), [value]);
	const canFormatJson = formattedJson !== null && formattedJson !== value;
	const containerRef = useRef<HTMLDivElement>(null);

	// Ctrl/Cmd+S saves this entry when it is the only one, or when focus is inside it.
	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (!(e.ctrlKey || e.metaKey) || e.key !== "s") return;
			if (!isOnlyEntry && !containerRef.current?.contains(document.activeElement)) return;
			e.preventDefault();
			if (hasChanges && !saving) void save(value);
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [isOnlyEntry, hasChanges, saving, value]);

	return (
		<div ref={containerRef} className="rounded-lg bg-white/5 border border-white/5 p-4">
			<div className="flex items-center justify-between mb-2">
				<EntryLabel entry={entry} />
				<div className="flex items-center gap-1">
					<div className="mr-1.5">
						<EditTabs tab={tab} onChange={setTab} />
					</div>
					<button
						type="button"
						onClick={() => { if (formattedJson) setValue(formattedJson); }}
						disabled={!canFormatJson || saving}
						className="px-2 py-0.5 text-[11px] bg-white/5 border border-white/10 rounded-md hover:bg-white/10 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
					>
						Format JSON
					</button>
					<button
						type="button"
						onClick={() => void save(value)}
						title="Save (Ctrl+S)"
						disabled={!hasChanges || saving}
						className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-cyan-500/20 border border-cyan-500/30 rounded-md hover:bg-cyan-500/30 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed text-cyan-300"
					>
						{saving ? (
							<Loader2 className="w-3 h-3 animate-spin" />
						) : (
							<Save className="w-3 h-3" />
						)}
						<span>Save</span>
					</button>
					<CopyButton text={value} />
				</div>
			</div>
			{tab === "preview" ? (
				<div className="rounded-lg bg-black/30 border border-white/10 p-3">
					<ValueViewer value={value} />
				</div>
			) : tab === "table" ? (
				<div className="rounded-lg bg-black/30 border border-white/10 p-3">
					<ValueStructureEditor value={value} onChange={setValue} />
				</div>
			) : (
				<HighlightedTextarea value={value} onChange={setValue} />
			)}
			{error ? (
				<div className="mt-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
					{error}
				</div>
			) : null}
			{hasChanges ? (
				<div className="mt-2">
					<SaveHint revision={revision} autoKeepLatest={autoKeepLatest} />
				</div>
			) : null}
		</div>
	);
}

function EntryLabel({ entry }: { entry: ValueEntry }) {
	return (
		<div className="flex items-baseline gap-2 min-w-0">
			<span className="text-xs text-gray-400 font-medium">{entry.name}</span>
			{entry.path ? (
				<span className="text-[11px] text-gray-500 font-mono truncate" title={entry.path}>{entry.path}</span>
			) : null}
		</div>
	);
}

function ReadOnlyEntry({ entry, onEdit }: { entry: ValueEntry; onEdit: () => void }) {
	return (
		<div className="rounded-lg bg-white/5 border border-white/5 p-4">
			<div className="flex items-center justify-between mb-2">
				<EntryLabel entry={entry} />
				<CopyButton text={entry.value} />
			</div>
			{/* the viewer's own controls (mode buttons, key filter) keep their double-click */}
			<div
				title="Double-click to edit"
				onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("input, button")) onEdit(); }}
			>
				<ValueViewer value={entry.value} />
			</div>
		</div>
	);
}

// Typing with no field focused and no text selected starts filtering keys.
function focusKeyFilterOnType(e: KeyboardEvent, dialog: HTMLElement | null) {
	if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
	if ((e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]")) return;
	if (!window.getSelection()?.isCollapsed) return;
	// focusing during keydown lets the typed character land in the filter
	dialog?.querySelector<HTMLInputElement>("input[data-key-filter]")?.focus();
}

export function ValueView({ title, values, profile, projectId, autoKeepLatest, onClose, onSaved }: ValueViewProps) {
	const [editing, setEditing] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);
	// per secret, so a filter survives switching between view and edit mode
	const [filters, setFilters] = useState<Record<string, string>>({});
	const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
	const [confirmDiscard, setConfirmDiscard] = useState(false);
	const askDiscard = confirmDiscard && dirtyIds.size > 0;

	function handleDirtyChange(secretId: string, dirty: boolean) {
		setDirtyIds((ids) => {
			if (ids.has(secretId) === dirty) return ids;
			const next = new Set(ids);
			if (dirty) next.add(secretId);
			else next.delete(secretId);
			return next;
		});
	}

	// Leaving edit mode drops unsaved drafts, so the first attempt only asks for confirmation.
	function discardingDrafts(action: () => void) {
		if (dirtyIds.size > 0 && !confirmDiscard) {
			setConfirmDiscard(true);
			return;
		}
		setConfirmDiscard(false);
		setDirtyIds(new Set());
		action();
	}
	const [copyFailed, setCopyFailed] = useState(false);
	const [shareCopied, setShareCopied] = useState(false);

	function handleShare() {
		void navigator.clipboard.writeText(secretConsoleUrl(values[0].secretId));
		setShareCopied(true);
		setTimeout(() => setShareCopied(false), 2000);
	}

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") discardingDrafts(onClose);
			else focusKeyFilterOnType(e, dialogRef.current);
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose, dirtyIds, confirmDiscard]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) discardingDrafts(onClose); }}
		>
			<div ref={dialogRef} className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[90%] max-h-[85vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<div className="flex items-baseline gap-3 min-w-0">
						<h3 className="text-sm font-medium text-gray-300 shrink-0">{title}</h3>
						{values.length === 1 && values[0].path ? (
							<span className="text-xs text-gray-500 font-mono truncate" title={values[0].path}>{values[0].path}</span>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						{askDiscard ? (
							<span className="text-xs text-amber-300/80">Unsaved changes — press again to discard</span>
						) : null}
						{values.length > 1 ? (
							<button
								type="button"
								onClick={() => {
									const text = values.map((v) => `${v.name}=${v.value}`).join("\n");
									void copySecret(text).then(() => setCopyFailed(false), () => setCopyFailed(true));
								}}
								className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
							>
								<Copy className="w-3 h-3 text-cyan-400" />
								<span>{copyFailed ? "Copy failed" : "Copy All as KEY=VALUE"}</span>
							</button>
						) : null}
						{values.length === 1 ? (
							<button
								type="button"
								onClick={handleShare}
								title="Copy console link"
								className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-gray-300"
							>
								{shareCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3 text-blue-400" />}
								<span>{shareCopied ? "Copied" : "Share"}</span>
							</button>
						) : null}
						<button
							type="button"
							onClick={() => (editing ? discardingDrafts(() => setEditing(false)) : setEditing(true))}
							className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors ${
								editing
									? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
									: "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
							}`}
						>
							{editing ? <Eye className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
							<span>{editing ? "View" : "Edit"}</span>
						</button>
						<button
							type="button"
							onClick={() => discardingDrafts(onClose)}
							className="p-1.5 hover:bg-white/10 rounded transition-colors"
						>
							<X className="w-4 h-4 text-gray-400" />
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-5 space-y-3">
					{values.map((entry) => (
						<KeyFilterContext.Provider
							key={entry.secretId}
							value={[filters[entry.secretId] ?? "", (filter) => setFilters((f) => ({ ...f, [entry.secretId]: filter }))]}
						>
							{editing ? (
								<EditableEntry
									entry={entry}
									profile={profile}
									projectId={projectId}
									autoKeepLatest={autoKeepLatest}
									isOnlyEntry={values.length === 1}
									onSaved={onSaved}
									onDirtyChange={handleDirtyChange}
								/>
							) : (
								<ReadOnlyEntry entry={entry} onEdit={() => setEditing(true)} />
							)}
						</KeyFilterContext.Provider>
					))}
				</div>
			</div>
		</div>
	);
}
