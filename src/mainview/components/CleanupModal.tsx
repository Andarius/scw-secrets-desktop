import { useEffect, useMemo, useState } from "react";
import { Layers2, Loader2, Scissors, X } from "lucide-react";

import { electrobun } from "../rpc";
import type { Secret } from "../../shared/models";
import { planKeepLatestVersionOnly } from "../secret-versions";

type CleanupModalProps = {
	secrets: Secret[];
	storagePricePerVersionEur: number;
	profile?: string;
	projectId?: string;
	onClose: () => void;
	onSelectSecret: (secretId: string, secretName: string) => void;
	onRefresh?: () => void;
};

async function keepLatestVersionOnly(
	secretId: string,
	profile?: string,
	projectId?: string,
): Promise<void> {
	const versions = await electrobun.rpc!.request.getSecretVersions({ secretId, profile, projectId });
	for (const action of planKeepLatestVersionOnly(versions)) {
		if (action.type === "disable") {
			await electrobun.rpc!.request.disableSecretVersion({ secretId, revision: action.revision, profile, projectId });
			continue;
		}
		await electrobun.rpc!.request.destroySecretVersion({ secretId, revision: action.revision, profile, projectId });
	}
}

const euroFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "EUR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export function CleanupModal({
	secrets,
	storagePricePerVersionEur,
	profile,
	projectId,
	onClose,
	onSelectSecret,
	onRefresh,
}: CleanupModalProps) {
	const [activeCounts, setActiveCounts] = useState<Map<string, number> | null>(null);
	const [loading, setLoading] = useState(true);
	const [confirmReclaim, setConfirmReclaim] = useState(false);
	const [reclaiming, setReclaiming] = useState(false);
	const [reclaimProgress, setReclaimProgress] = useState(0);
	const [reclaimError, setReclaimError] = useState<string | null>(null);
	const [reclaimFailed, setReclaimFailed] = useState<string[]>([]);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const candidateIds = useMemo(
		() => secrets.filter((s) => s.version_count > 1).map((s) => s.id),
		[secrets],
	);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		void (async () => {
			try {
				if (candidateIds.length === 0) {
					if (!cancelled) setActiveCounts(new Map());
					return;
				}
				const response = await electrobun.rpc!.request.getActiveVersionCounts({
					secretIds: candidateIds,
					profile,
					projectId,
				});
				if (!cancelled) {
					setActiveCounts(new Map(Object.entries(response.counts).map(([k, v]) => [k, Number(v)])));
				}
			} catch (err) {
				if (!cancelled) {
					console.error("Failed to fetch active version counts", err);
					setActiveCounts(new Map());
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [candidateIds, profile, projectId]);

	const prunable = useMemo(() => {
		return secrets
			.filter((secret) => secret.version_count > 1)
			.map((secret) => {
				const active = activeCounts?.get(secret.id) ?? secret.version_count;
				return {
					secret,
					activeCount: active,
					prunableCount: Math.max(active - 1, 0),
				};
			})
			.filter((entry) => entry.prunableCount > 0)
			.sort((left, right) => right.prunableCount - left.prunableCount);
	}, [secrets, activeCounts]);

	const totalPrunable = prunable.reduce((sum, entry) => sum + entry.prunableCount, 0);
	const totalSavings = totalPrunable * storagePricePerVersionEur;

	async function handleReclaimAll() {
		if (!confirmReclaim) {
			setConfirmReclaim(true);
			return;
		}
		setReclaiming(true);
		setReclaimError(null);
		setReclaimFailed([]);
		setReclaimProgress(0);
		const failed: string[] = [];
		try {
			for (const { secret } of prunable) {
				try {
					await keepLatestVersionOnly(secret.id, profile, projectId);
				} catch {
					failed.push(secret.name);
				}
				setReclaimProgress((n) => n + 1);
			}
			setReclaimFailed(failed);
			setConfirmReclaim(false);
			onRefresh?.();
			if (failed.length === 0) {
				onClose();
			}
		} catch (err) {
			setReclaimError(err instanceof Error ? err.message : String(err));
		} finally {
			setReclaiming(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[96%] max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10 gap-3">
					<div className="min-w-0">
						<h3 className="text-sm font-medium text-gray-300">Cleanup Plan</h3>
						<p className="text-xs text-gray-500 mt-0.5">
							Revisions that would be scheduled for deletion by Keep Latest
						</p>
					</div>
					<div className="flex items-center gap-2 flex-shrink-0">
						{onRefresh && prunable.length > 0 ? (
							<button
								type="button"
								onClick={() => void handleReclaimAll()}
								disabled={reclaiming || loading}
								className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
									confirmReclaim
										? "bg-amber-500/20 border-amber-500/30 text-amber-200 hover:bg-amber-500/30"
										: "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
								}`}
							>
								{reclaiming ? (
									<Loader2 className="w-3 h-3 animate-spin text-amber-400" />
								) : (
									<Layers2 className="w-3 h-3 text-amber-400" />
								)}
								<span>
									{reclaiming
										? `Reclaiming ${reclaimProgress} / ${prunable.length}…`
										: confirmReclaim
											? `Confirm Reclaim (${prunable.length} secrets, ${totalPrunable} revisions)`
											: "Reclaim all"}
								</span>
							</button>
						) : null}
						<button
							type="button"
							onClick={onClose}
							className="p-1.5 hover:bg-white/10 rounded transition-colors"
						>
							<X className="w-4 h-4 text-gray-400" />
						</button>
					</div>
				</div>

				{reclaimError ? (
					<div className="mx-5 mt-3 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
						{reclaimError}
					</div>
				) : null}
				{reclaimFailed.length > 0 ? (
					<div className="mx-5 mt-3 px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">
						Could not reclaim {reclaimFailed.length} secret{reclaimFailed.length === 1 ? "" : "s"}: {reclaimFailed.join(", ")}
					</div>
				) : null}

				<div className="px-5 py-3 border-b border-white/10 bg-white/[0.03] flex items-center gap-6 text-xs">
					<div className="flex items-center gap-2">
						<Layers2 className="w-3.5 h-3.5 text-purple-400" />
						<span className="text-gray-400">Secrets affected</span>
						<span className="text-gray-200 font-medium">{prunable.length}</span>
					</div>
					<div className="flex items-center gap-2">
						<Scissors className="w-3.5 h-3.5 text-purple-400" />
						<span className="text-gray-400">Revisions to prune</span>
						<span className="text-gray-200 font-medium">{totalPrunable}</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-gray-400">Est. savings</span>
						<span className="text-rose-300 font-medium">
							-{euroFormatter.format(totalSavings)}/mo
						</span>
					</div>
					{loading ? (
						<div className="flex items-center gap-2 text-gray-500 ml-auto">
							<Loader2 className="w-3.5 h-3.5 animate-spin" />
							<span>Counting active revisions…</span>
						</div>
					) : null}
				</div>

				<div className="flex-1 overflow-y-auto">
					{loading && prunable.length === 0 ? (
						<div className="p-8 text-center text-sm text-gray-500">Loading…</div>
					) : prunable.length === 0 ? (
						<div className="p-8 text-center text-sm text-gray-500">
							No secret has revisions to prune.
						</div>
					) : (
						<table className="w-full text-xs">
							<thead className="sticky top-0 bg-[#141414]">
								<tr className="border-b border-white/10 text-purple-300">
									<th className="px-5 py-3 text-left font-medium">Secret</th>
									<th className="px-5 py-3 text-left font-medium">Path</th>
									<th className="px-5 py-3 text-right font-medium" title="Active revisions (excludes scheduled-for-deletion)">
										Active
									</th>
									<th className="px-5 py-3 text-right font-medium">Older revisions</th>
									<th className="px-5 py-3 text-right font-medium">Savings</th>
								</tr>
							</thead>
							<tbody>
								{prunable.map(({ secret, activeCount, prunableCount }) => (
									<tr
										key={secret.id}
										onClick={() => onSelectSecret(secret.id, secret.name)}
										className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
									>
										<td className="px-5 py-3 text-gray-200">{secret.name}</td>
										<td className="px-5 py-3 text-gray-500 font-mono">{secret.path}</td>
										<td className="px-5 py-3 text-right text-gray-400">
											{activeCount}
										</td>
										<td className="px-5 py-3 text-right text-purple-300 font-medium">
											{prunableCount}
										</td>
										<td className="px-5 py-3 text-right text-rose-300">
											-{euroFormatter.format(prunableCount * storagePricePerVersionEur)}/mo
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>

				<div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] text-[11px] text-gray-500">
					Click a row to inspect that secret&apos;s full revision history. Keep Latest disables enabled
					older revisions, then schedules them for deletion. Deletions remain recoverable during
					Scaleway&apos;s retention window — revisions already scheduled for deletion are not counted here.
				</div>
			</div>
		</div>
	);
}
