import { useEffect, useState } from "react";
import { Loader2, Power, PowerOff, Bomb, X, RefreshCw } from "lucide-react";

import { electrobun } from "../rpc";
import type { SecretVersion } from "../../shared/models";

type HistoryModalProps = {
	secretId: string;
	secretName: string;
	profile?: string;
	projectId?: string;
	onClose: () => void;
	onChanged: () => void;
};

function formatDateTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function VersionStatusBadge({ status }: { status: string }) {
	const styles: Record<string, string> = {
		enabled: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
		disabled: "bg-amber-500/20 text-amber-300 border-amber-500/30",
		scheduled_for_deletion: "bg-rose-500/20 text-rose-300 border-rose-500/30",
		destroyed: "bg-red-500/20 text-red-300 border-red-500/30",
	};
	const label = status.split("_").join(" ");

	return (
		<span
			className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${styles[status] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
		>
			{label}
		</span>
	);
}

export function HistoryModal({
	secretId,
	secretName,
	profile,
	projectId,
	onClose,
	onChanged,
}: HistoryModalProps) {
	const [versions, setVersions] = useState<SecretVersion[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	async function fetchVersions() {
		setLoading(true);
		setError(null);
		try {
			const response = await electrobun.rpc!.request.getSecretVersions({
				secretId,
				profile,
				projectId,
			});
			setVersions(response);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void fetchVersions();
	}, [secretId]);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	async function handleAction(
		action: "enable" | "disable" | "delete",
		version: SecretVersion,
	) {
		const key = `${action}-${version.revision}`;
		setActionLoading(key);
		setActionError(null);
		try {
			const params = { secretId, revision: version.revision, profile, projectId };
			if (action === "enable") {
				await electrobun.rpc!.request.enableSecretVersion(params);
			} else if (action === "disable") {
				await electrobun.rpc!.request.disableSecretVersion(params);
			} else {
				if (version.status === "enabled") {
					await electrobun.rpc!.request.disableSecretVersion(params);
				}
				await electrobun.rpc!.request.destroySecretVersion(params);
			}
			const response = await electrobun.rpc!.request.getSecretVersions({
				secretId,
				profile,
				projectId,
			});
			setVersions(response);
			onChanged();
		} catch (reason) {
			setActionError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setActionLoading(null);
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[96%] max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<div>
						<h3 className="text-sm font-medium text-gray-300">Version History</h3>
						<p className="text-xs text-gray-500 mt-0.5">{secretName}</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => void fetchVersions()}
							disabled={loading}
							className="p-1.5 hover:bg-white/10 rounded transition-colors"
						>
							<RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
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

				<div className="px-5 py-3 border-b border-white/10 bg-white/[0.03] text-xs text-gray-400">
					Deleting a version schedules deletion first. It remains recoverable during Scaleway&apos;s retention window.
				</div>

				<div className="flex-1 overflow-y-auto">
					{loading && versions.length === 0 ? (
						<div className="p-8 text-center">
							<Loader2 className="w-5 h-5 text-purple-400 animate-spin mx-auto mb-2" />
							<p className="text-sm text-gray-500">Loading versions…</p>
						</div>
					) : error ? (
						<div className="p-5">
							<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
								{error}
							</div>
						</div>
					) : (
						<table className="w-full text-xs">
							<thead className="sticky top-0 bg-[#141414]">
								<tr className="border-b border-white/10 text-purple-300">
									<th className="px-5 py-3 text-left font-medium">Revision</th>
									<th className="px-5 py-3 text-left font-medium">Status</th>
									<th className="px-5 py-3 text-left font-medium">Created</th>
									<th className="px-5 py-3 text-left font-medium">Updated</th>
									<th className="px-5 py-3 text-right font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{versions.map((version) => {
									const isDeleted =
										version.status === "scheduled_for_deletion" || version.status === "destroyed";
									const isEnabled = version.status === "enabled";
									return (
										<tr
											key={version.revision}
											className="border-t border-white/5 hover:bg-white/5"
										>
											<td className="px-5 py-3 font-mono text-gray-300">
												<span className="text-sm">{version.revision}</span>
												{version.latest ? (
													<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
														latest
													</span>
												) : null}
											</td>
											<td className="px-5 py-3">
												<VersionStatusBadge status={version.status} />
											</td>
											<td className="px-5 py-3 text-gray-400">
												{formatDateTime(version.created_at)}
											</td>
											<td className="px-5 py-3 text-gray-400">
												{formatDateTime(version.updated_at)}
											</td>
											<td className="px-5 py-3 text-right">
												{!isDeleted ? (
													<div className="flex items-center justify-end gap-1">
														{isEnabled ? (
															<button
																type="button"
																title="Disable version"
																disabled={actionLoading !== null}
																onClick={() => void handleAction("disable", version)}
																className="p-1.5 hover:bg-amber-500/20 rounded transition-colors disabled:opacity-50"
															>
																{actionLoading === `disable-${version.revision}` ? (
																	<Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
																) : (
																	<PowerOff className="w-3.5 h-3.5 text-amber-400" />
																)}
															</button>
														) : (
															<button
																type="button"
																title="Enable version"
																disabled={actionLoading !== null}
																onClick={() => void handleAction("enable", version)}
																className="p-1.5 hover:bg-emerald-500/20 rounded transition-colors disabled:opacity-50"
															>
																{actionLoading === `enable-${version.revision}` ? (
																	<Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
																) : (
																	<Power className="w-3.5 h-3.5 text-emerald-400" />
																)}
															</button>
														)}
														<button
															type="button"
															title="Schedule version deletion"
															disabled={actionLoading !== null}
															onClick={() => void handleAction("delete", version)}
															className="p-1.5 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
														>
															{actionLoading === `delete-${version.revision}` ? (
																<Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
															) : (
																<Bomb className="w-3.5 h-3.5 text-red-400" />
															)}
														</button>
													</div>
												) : (
													<span className="text-gray-600">—</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					)}
				</div>

				{actionError ? (
					<div className="px-5 py-3 border-t border-red-500/30 bg-red-500/10 text-red-300 text-xs">
						{actionError}
					</div>
				) : null}
			</div>
		</div>
	);
}
