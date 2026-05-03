import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Pencil, Save, X } from "lucide-react";

import { electrobun } from "../rpc";
import { planKeepLatestVersionOnly } from "../secret-versions";

type ValueEntry = { secretId: string; name: string; value: string };

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

function FormattedValue({ value }: { value: string }) {
	const formatted = useMemo(() => tryFormatJson(value), [value]);

	return (
		<pre className="text-sm text-cyan-200 font-mono whitespace-pre-wrap break-all">
			{formatted ?? value}
		</pre>
	);
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
	const [error, setError] = useState<string | null>(null);

	const hasChanges = value !== formatted;

	async function handleSave() {
		setSaving(true);
		setError(null);
		try {
			await electrobun.rpc!.request.updateSecretValue({
				secretId: entry.secretId,
				value,
				profile,
				projectId,
			});

			if (autoKeepLatest) {
				const versions = await electrobun.rpc!.request.getSecretVersions({
					secretId: entry.secretId,
					profile,
					projectId,
				});
				for (const action of planKeepLatestVersionOnly(versions)) {
					if (action.type === "disable") {
						await electrobun.rpc!.request.disableSecretVersion({
							secretId: entry.secretId,
							revision: action.revision,
							profile,
							projectId,
						});
					} else {
						await electrobun.rpc!.request.destroySecretVersion({
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
				<span className="text-xs text-gray-400 font-medium">{entry.name}</span>
				<div className="flex items-center gap-1">
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
			<textarea
				value={value}
				onChange={(e) => setValue(e.target.value)}
				spellCheck={false}
				className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-cyan-200 font-mono resize-y focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-colors"
			/>
			{error ? (
				<div className="mt-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
					{error}
				</div>
			) : null}
		</div>
	);
}

function ReadOnlyEntry({ entry }: { entry: ValueEntry }) {
	return (
		<div className="rounded-lg bg-white/5 border border-white/5 p-4">
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs text-gray-400 font-medium">{entry.name}</span>
				<CopyButton text={entry.value} />
			</div>
			<FormattedValue value={entry.value} />
		</div>
	);
}

export function ValueView({ title, values, profile, projectId, autoKeepLatest, onClose, onSaved }: ValueViewProps) {
	const [editing, setEditing] = useState(false);

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
					<h3 className="text-sm font-medium text-gray-300">{title}</h3>
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
						<button
							type="button"
							onClick={() => setEditing(!editing)}
							className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors ${
								editing
									? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
									: "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
							}`}
						>
							<Pencil className="w-3 h-3" />
							<span>Edit</span>
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
