import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";

import { electrobun } from "../rpc";

type EditModalProps = {
	secretId: string;
	name: string;
	initialValue: string;
	profile?: string;
	projectId?: string;
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
	onClose,
	onSaved,
}: EditModalProps) {
	const formatted = useMemo(() => {
		return tryFormatJson(initialValue) ?? initialValue;
	}, [initialValue]);

	const [value, setValue] = useState(formatted);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const hasChanges = value !== formatted;
	const formattedJson = useMemo(() => tryFormatJson(value), [value]);
	const canFormatJson = formattedJson !== null && formattedJson !== value;

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault();
				if (hasChanges && !saving) {
					void handleSave();
				}
			}
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose, hasChanges, saving]);

	async function handleSave() {
		setSaving(true);
		setError(null);
		try {
			await electrobun.rpc!.request.updateSecretValue({
				secretId,
				value,
				profile,
				projectId,
			});
			onSaved();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[90%] max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<div>
						<h3 className="text-sm font-medium text-gray-300">Edit Secret Value</h3>
						<p className="text-xs text-gray-500 mt-0.5">{name}</p>
					</div>
					<div className="flex items-center gap-2">
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
							onClick={() => void handleSave()}
							disabled={!hasChanges || saving}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-500/20 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-cyan-300"
						>
							{saving ? (
								<Loader2 className="w-3 h-3 animate-spin" />
							) : (
								<Save className="w-3 h-3" />
							)}
							<span>Save as new version</span>
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
					<textarea
						value={value}
						onChange={(e) => setValue(e.target.value)}
						spellCheck={false}
						className="w-full h-full min-h-[300px] bg-white/5 border border-white/10 rounded-lg p-4 text-sm text-cyan-200 font-mono resize-y focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-colors"
					/>
				</div>

				{error ? (
					<div className="mx-5 mb-4 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
						{error}
					</div>
				) : null}

				{!hasChanges ? (
					<div className="px-5 pb-4">
						<p className="text-xs text-gray-500">No changes yet. Ctrl+S to save.</p>
					</div>
				) : null}
			</div>
		</div>
	);
}
