import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, Loader2, Pencil, Save, Share2, X } from "lucide-react";

import { api } from "../rpc";
import { secretConsoleUrl } from "../console";
import { planKeepLatestVersionOnly } from "../secret-versions";
import { HighlightedTextarea } from "./HighlightedTextarea";
import { ValueStructureEditor } from "./ValueStructureEditor";
import { prefersTableMode, ValueViewer } from "./ValueViewer";

export type EditTab = "raw" | "table" | "preview";

export function EditTabs({ tab, onChange, size = "sm" }: { tab: EditTab; onChange: (tab: EditTab) => void; size?: "sm" | "md" }) {
	const tabs: [EditTab, string][] = [
		["raw", "Raw"],
		["table", "Structure"],
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
	return (
		<button
			type="button"
			onClick={() => navigator.clipboard.writeText(text)}
			className="p-1.5 hover:bg-white/10 rounded transition-colors flex-shrink-0"
		>
			<Copy className="w-3.5 h-3.5 text-gray-400" />
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
	onSaved,
}: {
	entry: ValueEntry;
	profile?: string;
	projectId?: string;
	autoKeepLatest?: boolean;
	onSaved: () => void;
}) {
	const formatted = useMemo(() => tryFormatJson(entry.value) ?? entry.value, [entry.value]);
	const [value, setValue] = useState(formatted);
	const [saving, setSaving] = useState(false);
	const [tab, setTab] = useState<EditTab>(() => (prefersTableMode() ? "table" : "raw"));
	const [error, setError] = useState<string | null>(null);

	const hasChanges = value !== formatted;
	const initialRows = Math.min(Math.max(formatted.split("\n").length, 6), 25);

	async function handleSave() {
		setSaving(true);
		setError(null);
		try {
			await api.updateSecretValue({
				secretId: entry.secretId,
				value,
				profile,
				projectId,
			});

			if (autoKeepLatest) {
				const versions = await api.getSecretVersions({
					secretId: entry.secretId,
					profile,
					projectId,
				});
				for (const action of planKeepLatestVersionOnly(versions)) {
					if (action.type === "disable") {
						await api.disableSecretVersion({
							secretId: entry.secretId,
							revision: action.revision,
							profile,
							projectId,
						});
					} else {
						await api.destroySecretVersion({
							secretId: entry.secretId,
							revision: action.revision,
							profile,
							projectId,
						});
					}
				}
			}

			onSaved();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="rounded-lg bg-white/5 border border-white/5 p-4">
			<div className="flex items-center justify-between mb-2">
				<EntryLabel entry={entry} />
				<div className="flex items-center gap-1">
					<div className="mr-1.5">
						<EditTabs tab={tab} onChange={setTab} />
					</div>
					<button
						type="button"
						onClick={() => void handleSave()}
						disabled={!hasChanges || saving}
						className="p-1.5 hover:bg-white/10 rounded transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
					>
						{saving ? (
							<Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
						) : (
							<Save className="w-3.5 h-3.5 text-cyan-400" />
						)}
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
				<HighlightedTextarea value={value} onChange={setValue} rows={initialRows} />
			)}
			{error ? (
				<div className="mt-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
					{error}
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

function ReadOnlyEntry({ entry }: { entry: ValueEntry }) {
	return (
		<div className="rounded-lg bg-white/5 border border-white/5 p-4">
			<div className="flex items-center justify-between mb-2">
				<EntryLabel entry={entry} />
				<CopyButton text={entry.value} />
			</div>
			<ValueViewer value={entry.value} />
		</div>
	);
}

export function ValueView({ title, values, profile, projectId, autoKeepLatest, onClose, onSaved }: ValueViewProps) {
	const [editing, setEditing] = useState(false);
	const [shareCopied, setShareCopied] = useState(false);

	function handleShare() {
		void navigator.clipboard.writeText(secretConsoleUrl(values[0].secretId));
		setShareCopied(true);
		setTimeout(() => setShareCopied(false), 2000);
	}

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[90%] max-h-[85vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<div className="flex items-baseline gap-3 min-w-0">
						<h3 className="text-sm font-medium text-gray-300 shrink-0">{title}</h3>
						{values.length === 1 && values[0].path ? (
							<span className="text-xs text-gray-500 font-mono truncate" title={values[0].path}>{values[0].path}</span>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						{values.length > 1 ? (
							<button
								type="button"
								onClick={() => {
									const text = values.map((v) => `${v.name}=${v.value}`).join("\n");
									navigator.clipboard.writeText(text);
								}}
								className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
							>
								<Copy className="w-3 h-3 text-cyan-400" />
								<span>Copy All as KEY=VALUE</span>
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
							onClick={() => setEditing(!editing)}
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
							onClick={onClose}
							className="p-1.5 hover:bg-white/10 rounded transition-colors"
						>
							<X className="w-4 h-4 text-gray-400" />
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-5 space-y-3">
					{values.map((entry) =>
						editing ? (
							<EditableEntry
								key={entry.secretId}
								entry={entry}
								profile={profile}
								projectId={projectId}
								autoKeepLatest={autoKeepLatest}
								onSaved={onSaved}
							/>
						) : (
							<ReadOnlyEntry key={entry.secretId} entry={entry} />
						),
					)}
				</div>
			</div>
		</div>
	);
}
