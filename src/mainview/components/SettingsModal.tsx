import { useEffect } from "react";
import { ScrollText, X } from "lucide-react";

import type { AppSettings } from "../settings";

type SettingsModalProps = {
	settings: AppSettings;
	onChange: (settings: AppSettings) => void;
	onClose: () => void;
	onOpenLogs: () => void;
};

export function SettingsModal({ settings, onChange, onClose, onOpenLogs }: SettingsModalProps) {
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
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[480px] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<h3 className="text-sm font-medium text-gray-300">Settings</h3>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 hover:bg-white/10 rounded transition-colors"
					>
						<X className="w-4 h-4 text-gray-400" />
					</button>
				</div>

				<div className="p-5 space-y-6">
					<div>
						<div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Versions</div>
						<label className="flex items-start gap-3 cursor-pointer group">
							<input
								type="checkbox"
								checked={settings.autoKeepLatest}
								onChange={(e) => onChange({ ...settings, autoKeepLatest: e.target.checked })}
								className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/30 focus:ring-offset-0 cursor-pointer accent-cyan-500"
							/>
							<div>
								<div className="text-sm text-white group-hover:text-cyan-200 transition-colors">
									Auto-delete older versions on edit
								</div>
								<div className="text-xs text-gray-500 mt-1">
									When saving a new secret value, automatically schedule deletion of all older versions (keep only the latest). Deletions remain recoverable during Scaleway's retention window.
								</div>
							</div>
						</label>
					</div>

					<div className="border-t border-white/10 pt-5">
						<div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Diagnostics</div>
						<button
							type="button"
							onClick={() => {
								onClose();
								onOpenLogs();
							}}
							className="flex items-center gap-3 px-4 py-3 w-full bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm text-left"
						>
							<ScrollText className="w-4 h-4 text-gray-400 flex-shrink-0" />
							<div>
								<div className="text-white">HTTP Logs</div>
								<div className="text-xs text-gray-500 mt-0.5">View all API calls made to Scaleway</div>
							</div>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
