import { useState } from "react";
import { Copy, Eye, Clock, Key as KeyIcon, Settings, Loader2, ExternalLink, Trash2 } from "lucide-react";

import { electrobun } from "../rpc";
import type { ProfileSummary, Project, Secret, SecretVersion } from "../../shared/models";

const SECRET_MANAGER_REGION = "fr-par";

export type ValueEntry = { name: string; value: string };

type DetailPanelProps = {
	secrets: Secret[];
	selectedProject: Project | null;
	selectedProfileSummary: ProfileSummary | null;
	onViewValues: (title: string, values: ValueEntry[]) => void;
};

function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

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

function CopyButton({ text }: { text: string }) {
	return (
		<button
			type="button"
			onClick={() => navigator.clipboard.writeText(text)}
			className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
		>
			<Copy className="w-3 h-3 text-gray-400" />
		</button>
	);
}

function VersionStatusBadge({ status }: { status: string }) {
	const styles: Record<string, string> = {
		enabled: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
		disabled: "bg-amber-500/20 text-amber-300 border-amber-500/30",
		destroyed: "bg-red-500/20 text-red-300 border-red-500/30",
	};

	return (
		<span
			className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${styles[status] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
		>
			{status}
		</span>
	);
}

function SingleSecretDetail({
	secret,
	selectedProject,
	selectedProfileSummary,
	onViewValues,
}: {
	secret: Secret;
	selectedProject: Project | null;
	selectedProfileSummary: ProfileSummary | null;
	onViewValues: (title: string, values: ValueEntry[]) => void;
}) {
	const [loadingValue, setLoadingValue] = useState(false);
	const [valueError, setValueError] = useState<string | null>(null);

	const [versions, setVersions] = useState<SecretVersion[]>([]);
	const [versionsVisible, setVersionsVisible] = useState(false);
	const [loadingVersions, setLoadingVersions] = useState(false);
	const [versionsError, setVersionsError] = useState<string | null>(null);

	const secretId = secret.id;
	const [prevSecretId, setPrevSecretId] = useState<string>(secretId);
	if (secretId !== prevSecretId) {
		setPrevSecretId(secretId);
		setValueError(null);
		setVersions([]);
		setVersionsVisible(false);
		setVersionsError(null);
	}

	async function handleViewValue() {
		setLoadingValue(true);
		setValueError(null);
		try {
			const response = await electrobun.rpc!.request.getSecretValue({
				secretId: secret.id,
				revision: "latest_enabled",
				profile: selectedProfileSummary?.name,
				projectId: selectedProject?.id,
			});
			onViewValues(secret.name, [{ name: secret.name, value: response.value }]);
		} catch (reason) {
			setValueError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setLoadingValue(false);
		}
	}

	async function handleViewVersions() {
		if (versionsVisible && versions.length > 0) {
			setVersionsVisible(false);
			return;
		}

		if (versions.length > 0) {
			setVersionsVisible(true);
			return;
		}

		setLoadingVersions(true);
		setVersionsError(null);
		try {
			const response = await electrobun.rpc!.request.getSecretVersions({
				secretId: secret.id,
				profile: selectedProfileSummary?.name,
				projectId: selectedProject?.id,
			});
			setVersions(response);
			setVersionsVisible(true);
		} catch (reason) {
			setVersionsError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setLoadingVersions(false);
		}
	}

	function handleManageSecret() {
		const url = `https://console.scaleway.com/secret-manager/secrets/${SECRET_MANAGER_REGION}/${secret.id}/overview`;
		void electrobun.rpc!.request.openExternal({ url });
	}

	const isReady = secret.status === "ready";

	return (
		<>
			<div className="p-4 border-b border-white/10">
				<div className="flex items-center justify-between mb-2">
					<h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
						Detail
					</h2>
					<div
						className={`text-xs px-2 py-1 rounded font-medium border ${
							isReady
								? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
								: "bg-amber-500/20 text-amber-300 border-amber-500/30"
						}`}
					>
						{secret.status.toUpperCase()}
					</div>
				</div>
				<div className="text-base font-medium">Selection</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-6">
				<div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-cyan-300">
							{secret.name}
						</span>
						<CopyButton text={secret.name} />
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">
							Secret ID
						</div>
						<div className="flex items-center gap-2">
							<div className="text-xs text-gray-300 font-mono break-all">
								{secret.id}
							</div>
							<CopyButton text={secret.id} />
						</div>
					</div>

					<div>
						<div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">
							Versions
						</div>
						<div className="text-sm text-gray-300">
							{secret.version_count}
						</div>
					</div>

					<div>
						<div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">
							Path
						</div>
						<div className="text-sm text-gray-300 font-mono">
							{secret.path}
						</div>
					</div>

					<div>
						<div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">
							Created
						</div>
						<div className="text-sm text-gray-300">
							{formatDate(secret.created_at)}
						</div>
					</div>

					<div>
						<div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">
							Updated
						</div>
						<div className="text-sm text-gray-300">
							{formatDate(secret.updated_at)}
						</div>
					</div>
				</div>

				<div className="pt-4 border-t border-white/10 space-y-2">
					<button
						type="button"
						onClick={() => void handleViewValue()}
						disabled={loadingValue}
						className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
					>
						{loadingValue ? (
							<Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
						) : (
							<Eye className="w-4 h-4 text-cyan-400" />
						)}
						<span>View Secret Value</span>
					</button>

					{valueError ? (
						<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
							{valueError}
						</div>
					) : null}

					<button
						type="button"
						onClick={() => void handleViewVersions()}
						disabled={loadingVersions}
						className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
					>
						{loadingVersions ? (
							<Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
						) : (
							<Clock className="w-4 h-4 text-purple-400" />
						)}
						<span>{versionsVisible ? "Hide Version History" : "View Version History"}</span>
					</button>

					{versionsError ? (
						<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
							{versionsError}
						</div>
					) : null}

					{versionsVisible && versions.length > 0 ? (
						<div className="rounded-lg border border-purple-500/20 overflow-hidden">
							<table className="w-full text-xs">
								<thead>
									<tr className="bg-purple-500/10 text-purple-300">
										<th className="px-3 py-2 text-left font-medium">Rev</th>
										<th className="px-3 py-2 text-left font-medium">Status</th>
										<th className="px-3 py-2 text-left font-medium">Created</th>
									</tr>
								</thead>
								<tbody>
									{versions.map((version) => (
										<tr
											key={version.revision}
											className="border-t border-white/5 hover:bg-white/5"
										>
											<td className="px-3 py-2 font-mono text-gray-300">
												{version.revision}
												{version.latest ? (
													<span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
														latest
													</span>
												) : null}
											</td>
											<td className="px-3 py-2">
												<VersionStatusBadge status={version.status} />
											</td>
											<td className="px-3 py-2 text-gray-400">
												{formatDateTime(version.created_at)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}

					<button
						type="button"
						onClick={handleManageSecret}
						className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm"
					>
						<Settings className="w-4 h-4 text-gray-400" />
						<span>Manage Secret</span>
						<ExternalLink className="w-3 h-3 text-gray-500 ml-auto" />
					</button>
				</div>
			</div>
		</>
	);
}

function MultiSecretDetail({
	secrets,
	selectedProject,
	selectedProfileSummary,
	onViewValues,
}: {
	secrets: Secret[];
	selectedProject: Project | null;
	selectedProfileSummary: ProfileSummary | null;
	onViewValues: (title: string, values: ValueEntry[]) => void;
}) {
	const [loadingValues, setLoadingValues] = useState(false);
	const [valuesError, setValuesError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	async function handleViewAllValues() {
		setLoadingValues(true);
		setValuesError(null);
		try {
			const results = await Promise.all(
				secrets.map(async (secret) => {
					const response = await electrobun.rpc!.request.getSecretValue({
						secretId: secret.id,
						revision: "latest_enabled",
						profile: selectedProfileSummary?.name,
						projectId: selectedProject?.id,
					});
					return { name: secret.name, value: response.value };
				}),
			);
			onViewValues(`${secrets.length} Secrets`, results);
		} catch (reason) {
			setValuesError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setLoadingValues(false);
		}
	}

	async function handleDeleteAll() {
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}

		setDeleting(true);
		setDeleteError(null);
		try {
			await Promise.all(
				secrets.map((secret) =>
					electrobun.rpc!.request.deleteSecret({
						secretId: secret.id,
						profile: selectedProfileSummary?.name,
						projectId: selectedProject?.id,
					}),
				),
			);
			setConfirmDelete(false);
		} catch (reason) {
			setDeleteError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setDeleting(false);
		}
	}

	return (
		<>
			<div className="p-4 border-b border-white/10">
				<div className="flex items-center justify-between mb-2">
					<h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
						Batch Actions
					</h2>
					<div className="text-xs px-2 py-1 rounded font-medium border bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
						{secrets.length} SELECTED
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				<div className="space-y-1">
					{secrets.map((secret) => (
						<div
							key={secret.id}
							className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5"
						>
							<div className="min-w-0">
								<div className="text-sm text-white truncate">{secret.name}</div>
								<div className="text-xs text-gray-500 font-mono">{secret.path}</div>
							</div>
						</div>
					))}
				</div>

				<div className="pt-4 border-t border-white/10 space-y-2">
					<button
						type="button"
						onClick={() => void handleViewAllValues()}
						disabled={loadingValues}
						className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
					>
						{loadingValues ? (
							<Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
						) : (
							<Eye className="w-4 h-4 text-cyan-400" />
						)}
						<span>View All Values</span>
					</button>

					{valuesError ? (
						<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
							{valuesError}
						</div>
					) : null}

					<button
						type="button"
						onClick={() => void handleDeleteAll()}
						disabled={deleting}
						className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors text-sm disabled:opacity-50 ${
							confirmDelete
								? "bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
								: "bg-white/5 border-white/10 hover:bg-white/10"
						}`}
					>
						{deleting ? (
							<Loader2 className="w-4 h-4 text-red-400 animate-spin" />
						) : (
							<Trash2 className="w-4 h-4 text-red-400" />
						)}
						<span>
							{confirmDelete
								? `Confirm Delete ${secrets.length} Secrets`
								: `Delete ${secrets.length} Secrets`}
						</span>
					</button>

					{confirmDelete && !deleting ? (
						<button
							type="button"
							onClick={() => setConfirmDelete(false)}
							className="w-full flex items-center justify-center px-4 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
						>
							Cancel
						</button>
					) : null}

					{deleteError ? (
						<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
							{deleteError}
						</div>
					) : null}
				</div>
			</div>
		</>
	);
}

export function DetailPanel({
	secrets,
	selectedProject,
	selectedProfileSummary,
	onViewValues,
}: DetailPanelProps) {
	if (secrets.length === 0) {
		return (
			<div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-8 flex items-center justify-center h-full">
				<div className="text-center">
					<div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
						<KeyIcon className="w-8 h-8 text-gray-600" />
					</div>
					<p className="text-sm text-gray-500">
						Select a secret to view details
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden flex flex-col h-full">
			{secrets.length === 1 ? (
				<SingleSecretDetail
					secret={secrets[0]}
					selectedProject={selectedProject}
					selectedProfileSummary={selectedProfileSummary}
					onViewValues={onViewValues}
				/>
			) : (
				<MultiSecretDetail
					secrets={secrets}
					selectedProject={selectedProject}
					selectedProfileSummary={selectedProfileSummary}
					onViewValues={onViewValues}
				/>
			)}
		</div>
	);
}
