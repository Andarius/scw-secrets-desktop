import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";

import { useNextRevision } from "../hooks/useNextRevision";
import { useSaveSecretValue } from "../hooks/useSaveSecretValue";
import { HighlightedTextarea } from "./HighlightedTextarea";
import { EditTabs, SaveHint, type EditTab } from "./ValueModal";
import { ValueStructureEditor } from "./ValueStructureEditor";
import { prefersTableMode, ValueViewer } from "./ValueViewer";

type EditModalProps = {
	secretId: string;
	name: string;
	initialValue: string;
	profile?: string;
	projectId?: string;
	autoKeepLatest?: boolean;
	onClose: () => void;
	onSaved: () => void;
};

function tryFormatJson(value: string): string | null {
	try {
		return JSON.stringify(JSON.parse(value), null, 2);
	} catch {
		return null;
	}
}

export function EditModal({
	secretId,
	name,
	initialValue,
	profile,
	projectId,
	autoKeepLatest,
	onClose,
	onSaved,
}: EditModalProps) {
	const formatted = useMemo(() => {
		return tryFormatJson(initialValue) ?? initialValue;
	}, [initialValue]);

	const [value, setValue] = useState(formatted);
	const [tab, setTab] = useState<EditTab>(() => (prefersTableMode() ? "table" : "raw"));
	const target = { secretId, profile, projectId, autoKeepLatest };
	const { save, saving, error } = useSaveSecretValue(target, onSaved);

	const hasChanges = value !== formatted;
	const revision = useNextRevision(target, hasChanges);
	const formattedJson = useMemo(() => tryFormatJson(value), [value]);
	const canFormatJson = formattedJson !== null && formattedJson !== value;

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault();
				if (hasChanges && !saving) {
					void save(value);
				}
			}
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose, hasChanges, saving, value]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[90%] max-h-[85vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<div>
						<h3 className="text-sm font-medium text-gray-300">Edit Secret Value</h3>
						<p className="text-xs text-gray-500 mt-0.5">{name}</p>
					</div>
					<div className="flex items-center gap-2">
						<EditTabs tab={tab} onChange={setTab} size="md" />
						<button
							type="button"
							onClick={() => {
								if (formattedJson) {
									setValue(formattedJson);
								}
							}}
							disabled={!canFormatJson || saving}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
						>
							<span>Format JSON</span>
						</button>
						<button
							type="button"
							onClick={() => void save(value)}
							disabled={!hasChanges || saving}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-500/20 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-cyan-300"
						>
							{saving ? (
								<Loader2 className="w-3 h-3 animate-spin" />
							) : (
								<Save className="w-3 h-3" />
							)}
							<span>Save</span>
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

				<div className="flex-1 overflow-y-auto p-5">
					{tab === "preview" ? (
						<div className="rounded-lg bg-black/30 border border-white/10 p-4">
							<ValueViewer value={value} />
						</div>
					) : tab === "table" ? (
						<div className="rounded-lg bg-black/30 border border-white/10 p-4">
							<ValueStructureEditor value={value} onChange={setValue} />
						</div>
					) : (
						<HighlightedTextarea
							value={value}
							onChange={setValue}
							rows={Math.min(Math.max(value.split("\n").length, 14), 30)}
						/>
					)}
				</div>

				{error ? (
					<div className="mx-5 mb-4 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
						{error}
					</div>
				) : null}

				<div className="px-5 pb-4">
					{hasChanges ? (
						<SaveHint revision={revision} autoKeepLatest={autoKeepLatest} />
					) : (
						<p className="text-xs text-gray-500">No changes yet. Ctrl+S to save.</p>
					)}
				</div>
			</div>
		</div>
	);
}
