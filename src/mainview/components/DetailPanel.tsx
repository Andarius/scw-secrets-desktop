import { useEffect, useState } from "react";
import { Copy, Eye, Pencil, Clock, Key as KeyIcon, Settings, Loader2, ExternalLink, Trash2, Layers2 } from "lucide-react";

import { electrobun } from "../rpc";
import type { ProfileSummary, Project, Secret } from "../../shared/models";
import { planKeepLatestVersionOnly } from "../secret-versions";

const SECRET_MANAGER_REGION = "fr-par";

export type ValueEntry = { secretId: string; name: string; value: string };

type DetailPanelProps = {
	secrets: Secret[];
	selectedProject: Project | null;
	selectedProfileSummary: ProfileSummary | null;
	onViewValues: (title: string, values: ValueEntry[]) => void;
	onEditValue: (entry: ValueEntry) => void;
	onViewHistory: (secretId: string, secretName: string) => void;
	onRefresh: () => void;
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

function formatSecretType(type?: string): string {
	if (!type) {
		return "—";
	}

	const labels: Record<string, string> = {
		opaque: "Opaque",
		basic_credentials: "Basic Credentials",
		database_credentials: "Database Credentials",
		key_value: "Key/Value",
		ssh_key: "SSH Key",
	};

	return labels[type] ?? type.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

async function keepLatestVersionOnly(
	secretId: string,
	profile?: string,
	projectId?: string,
) {
	const versions = await electrobun.rpc!.request.getSecretVersions({
		secretId,
		profile,
		projectId,
	});
	for (const action of planKeepLatestVersionOnly(versions)) {
		if (action.type === "disable") {
			await electrobun.rpc!.request.disableSecretVersion({
				secretId,
				revision: action.revision,
				profile,
				projectId,
			});
			continue;
		}

		await electrobun.rpc!.request.destroySecretVersion({
			secretId,
			revision: action.revision,
			profile,
			projectId,
		});
	}
}

function SingleSecretDetail({
	secret,
	selectedProject,
	selectedProfileSummary,
	onViewValues,
	onEditValue,
	onViewHistory,
	onRefresh,
}: {
	secret: Secret;
	selectedProject: Project | null;
	selectedProfileSummary: ProfileSummary | null;
	onViewValues: (title: string, values: ValueEntry[]) => void;
	onEditValue: (entry: ValueEntry) => void;
	onViewHistory: (secretId: string, secretName: string) => void;
	onRefresh: () => void;
}) {
	const [loadingValue, setLoadingValue] = useState(false);
	const [valueError, setValueError] = useState<string | null>(null);

	const [loadingEdit, setLoadingEdit] = useState(false);
	const [editError, setEditError] = useState<string | null>(null);
	const [keepingLatest, setKeepingLatest] = useState(false);
	const [keepLatestError, setKeepLatestError] = useState<string | null>(null);
	const [confirmKeepLatest, setConfirmKeepLatest] = useState(false);
	const [deletingSecret, setDeletingSecret] = useState(false);
	const [deleteSecretError, setDeleteSecretError] = useState<string | null>(null);
	const [confirmDeleteSecret, setConfirmDeleteSecret] = useState(false);

	const secretId = secret.id;
	const [prevSecretId, setPrevSecretId] = useState<string>(secretId);
	if (secretId !== prevSecretId) {
		setPrevSecretId(secretId);
		setValueError(null);
		setEditError(null);
		setKeepLatestError(null);
		setConfirmKeepLatest(false);
		setDeleteSecretError(null);
		setConfirmDeleteSecret(false);
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
			onViewValues(secret.name, [{ secretId: secret.id, name: secret.name, value: response.value }]);
		} catch (reason) {
			setValueError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setLoadingValue(false);
		}
	}

	async function handleEditValue() {
		setLoadingEdit(true);
		setEditError(null);
		try {
			const response = await electrobun.rpc!.request.getSecretValue({
				secretId: secret.id,
				revision: "latest_enabled",
				profile: selectedProfileSummary?.name,
				projectId: selectedProject?.id,
			});
			onEditValue({ secretId: secret.id, name: secret.name, value: response.value });
		} catch (reason) {
			setEditError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setLoadingEdit(false);
		}
	}

	async function handleKeepLatest() {
		if (!confirmKeepLatest) {
			setConfirmKeepLatest(true);
			return;
		}

		setKeepingLatest(true);
		setKeepLatestError(null);
		try {
			await keepLatestVersionOnly(secret.id, selectedProfileSummary?.name, selectedProject?.id);
			setConfirmKeepLatest(false);
			onRefresh();
		} catch (reason) {
			setKeepLatestError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setKeepingLatest(false);
		}
	}

	async function handleDeleteSecret() {
		if (!confirmDeleteSecret) {
			setConfirmDeleteSecret(true);
			return;
		}

		setDeletingSecret(true);
		setDeleteSecretError(null);
		try {
			await electrobun.rpc!.request.deleteSecret({
				secretId: secret.id,
				profile: selectedProfileSummary?.name,
				projectId: selectedProject?.id,
			});
			setConfirmDeleteSecret(false);
			onRefresh();
		} catch (reason) {
			setDeleteSecretError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setDeletingSecret(false);
		}
	}

	function handleManageSecret() {
		const url = `https://console.scaleway.com/secret-manager/secrets/${SECRET_MANAGER_REGION}/${secret.id}/overview`;
		void electrobun.rpc!.request.openExternal({ url });
	}

	const isReady = secret.status === "ready";
	const canKeepLatest = secret.version_count > 1;

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
							Type
						</div>
						<div className="text-sm text-gray-300">
							{formatSecretType(secret.type)}
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
						onClick={() => void handleEditValue()}
						disabled={loadingEdit}
						className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
					>
						{loadingEdit ? (
							<Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
						) : (
							<Pencil className="w-4 h-4 text-amber-400" />
						)}
						<span>Edit Secret Value</span>
					</button>

					{editError ? (
						<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
							{editError}
						</div>
					) : null}

					<button
						type="button"
						onClick={() => onViewHistory(secret.id, secret.name)}
						className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm"
					>
						<Clock className="w-4 h-4 text-purple-400" />
						<span>Version History</span>
					</button>

					{canKeepLatest ? (
						<>
							<button
								type="button"
								onClick={() => void handleKeepLatest()}
								disabled={keepingLatest}
								className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors text-sm disabled:opacity-50 ${
									confirmKeepLatest
										? "bg-amber-500/20 border-amber-500/30 text-amber-200 hover:bg-amber-500/30"
										: "bg-white/5 border-white/10 hover:bg-white/10"
								}`}
							>
								{keepingLatest ? (
									<Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
								) : (
									<Layers2 className="w-4 h-4 text-amber-400" />
								)}
								<span>{confirmKeepLatest ? "Confirm Keep Latest" : "Keep Latest"}</span>
							</button>

							{confirmKeepLatest ? (
								<div className="px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-100 text-xs space-y-1">
									<div className="font-medium text-amber-200">Keep only the latest revision</div>
									<div>
										This will schedule deletion for every older version that is not already scheduled for deletion.
									</div>
									<div>
										The latest remaining revision is kept. Scheduled deletions stay recoverable during Scaleway&apos;s retention window.
									</div>
								</div>
							) : null}

							{confirmKeepLatest && !keepingLatest ? (
								<button
									type="button"
									onClick={() => setConfirmKeepLatest(false)}
									className="w-full flex items-center justify-center px-4 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
								>
									Cancel Keep Latest
								</button>
							) : null}

							{keepLatestError ? (
								<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
									{keepLatestError}
								</div>
							) : null}
						</>
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

					<button
						type="button"
						onClick={() => void handleDeleteSecret()}
						disabled={deletingSecret}
						className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors text-sm disabled:opacity-50 ${
							confirmDeleteSecret
								? "bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
								: "bg-white/5 border-white/10 hover:bg-white/10"
						}`}
					>
						{deletingSecret ? (
							<Loader2 className="w-4 h-4 text-red-400 animate-spin" />
						) : (
							<Trash2 className="w-4 h-4 text-red-400" />
						)}
						<span>{confirmDeleteSecret ? "Confirm Delete Secret" : "Delete Secret"}</span>
					</button>

					{confirmDeleteSecret && !deletingSecret ? (
						<button
							type="button"
							onClick={() => setConfirmDeleteSecret(false)}
							className="w-full flex items-center justify-center px-4 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
						>
							Cancel Delete
						</button>
					) : null}

					{deleteSecretError ? (
						<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
							{deleteSecretError}
						</div>
					) : null}
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
	onRefresh,
}: {
	secrets: Secret[];
	selectedProject: Project | null;
	selectedProfileSummary: ProfileSummary | null;
	onViewValues: (title: string, values: ValueEntry[]) => void;
	onRefresh: () => void;
}) {
	const [loadingValues, setLoadingValues] = useState(false);
	const [valuesError, setValuesError] = useState<string | null>(null);
	const [keepingLatest, setKeepingLatest] = useState(false);
	const [keepLatestError, setKeepLatestError] = useState<string | null>(null);
	const [confirmKeepLatest, setConfirmKeepLatest] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const selectionKey = secrets.map((secret) => secret.id).join("|");
	const prunableSecrets = secrets.filter((secret) => secret.version_count > 1);

	useEffect(() => {
		setConfirmKeepLatest(false);
		setKeepLatestError(null);
		setConfirmDelete(false);
		setDeleteError(null);
	}, [selectionKey]);

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
					return { secretId: secret.id, name: secret.name, value: response.value };
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
			onRefresh();
		} catch (reason) {
			setDeleteError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setDeleting(false);
		}
	}

	async function handleKeepLatest() {
		if (!confirmKeepLatest) {
			setConfirmKeepLatest(true);
			return;
		}

		setKeepingLatest(true);
		setKeepLatestError(null);
		try {
			for (const secret of prunableSecrets) {
				await keepLatestVersionOnly(secret.id, selectedProfileSummary?.name, selectedProject?.id);
			}

			setConfirmKeepLatest(false);
			onRefresh();
		} catch (reason) {
			setKeepLatestError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setKeepingLatest(false);
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
							<div className="text-xs text-gray-500">{secret.version_count} versions</div>
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

					{prunableSecrets.length > 0 ? (
						<>
							<button
								type="button"
								onClick={() => void handleKeepLatest()}
								disabled={keepingLatest || deleting}
								className={`w-full flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors text-sm disabled:opacity-50 ${
									confirmKeepLatest
										? "bg-amber-500/20 border-amber-500/30 text-amber-200 hover:bg-amber-500/30"
										: "bg-white/5 border-white/10 hover:bg-white/10"
								}`}
							>
								{keepingLatest ? (
									<Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
								) : (
									<Layers2 className="w-4 h-4 text-amber-400" />
								)}
								<span>
									{confirmKeepLatest
										? `Confirm Keep Latest for ${prunableSecrets.length} Secrets`
										: "Keep Latest"}
								</span>
							</button>

							{confirmKeepLatest ? (
								<div className="px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-100 text-xs space-y-1">
									<div className="font-medium text-amber-200">Keep only the latest revision</div>
									<div>
										This will schedule deletion for every older version that is not already scheduled for deletion.
									</div>
									<div>
										The latest remaining revision is kept for each eligible secret. Scheduled deletions stay recoverable during Scaleway&apos;s retention window.
									</div>
								</div>
							) : null}

							{confirmKeepLatest && !keepingLatest ? (
								<button
									type="button"
									onClick={() => setConfirmKeepLatest(false)}
									className="w-full flex items-center justify-center px-4 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
								>
									Cancel Keep Latest
								</button>
							) : null}

							{keepLatestError ? (
								<div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
									{keepLatestError}
								</div>
							) : null}
						</>
					) : null}

					<button
						type="button"
						onClick={() => void handleDeleteAll()}
						disabled={deleting || keepingLatest}
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
								? `Confirm Schedule Deletion for ${secrets.length} Secrets`
								: `Schedule Deletion for ${secrets.length} Secrets`}
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
	onEditValue,
	onViewHistory,
	onRefresh,
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
					onEditValue={onEditValue}
					onViewHistory={onViewHistory}
					onRefresh={onRefresh}
				/>
			) : (
				<MultiSecretDetail
					secrets={secrets}
					selectedProject={selectedProject}
					selectedProfileSummary={selectedProfileSummary}
					onViewValues={onViewValues}
					onRefresh={onRefresh}
				/>
			)}
		</div>
	);
}
