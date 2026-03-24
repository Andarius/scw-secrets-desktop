import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { electrobun } from "./rpc";
import type { ProfilesResponse, Project, Secret } from "../shared/models";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { Navigator } from "./components/Navigator";
import { Inventory } from "./components/Inventory";
import { DetailPanel, type ValueEntry } from "./components/DetailPanel";
import { ValueView } from "./components/ValueModal";
import { EditModal } from "./components/EditModal";
import { HistoryModal } from "./components/HistoryModal";

type StatusFilter = "all" | "ready" | "attention";

function App() {
	const [profilesResponse, setProfilesResponse] = useState<ProfilesResponse | null>(null);
	const [selectedProfile, setSelectedProfile] = useState("");
	const [projects, setProjects] = useState<Project[]>([]);
	const [selectedProjectId, setSelectedProjectId] = useState("");
	const [secrets, setSecrets] = useState<Secret[]>([]);
	const [selectedSecretIds, setSelectedSecretIds] = useState<Set<string>>(new Set());
	const [expandedValues, setExpandedValues] = useState<{ title: string; values: ValueEntry[] } | null>(null);
	const [editingEntry, setEditingEntry] = useState<ValueEntry | null>(null);
	const [historyTarget, setHistoryTarget] = useState<{ secretId: string; secretName: string } | null>(null);
	const [query, setQuery] = useState("");
	const [pathFilter, setPathFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [error, setError] = useState<string | null>(null);
	const [loadingProfiles, setLoadingProfiles] = useState(true);
	const [loadingProjects, setLoadingProjects] = useState(false);
	const [loadingSecrets, setLoadingSecrets] = useState(false);
	const [syncingProfile, setSyncingProfile] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	const deferredQuery = useDeferredValue(query);

	const profiles = profilesResponse?.profiles ?? [];
	const selectedProfileSummary =
		profiles.find((profile) => profile.name === selectedProfile) ?? profiles[0] ?? null;
	const selectedProject =
		projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;

	useEffect(() => {
		let cancelled = false;
		setLoadingProfiles(true);

		void (async () => {
			try {
				const response = await electrobun.rpc!.request.getProfiles({});
				if (cancelled) {
					return;
				}

				const initialProfile = response.active ?? response.profiles[0]?.name ?? "";
				startTransition(() => {
					setProfilesResponse(response);
					setSelectedProfile(initialProfile);
					setError(null);
				});
			} catch (reason) {
				if (!cancelled) {
					setError(reason instanceof Error ? reason.message : String(reason));
				}
			} finally {
				if (!cancelled) {
					setLoadingProfiles(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!selectedProfile) {
			return;
		}

		let cancelled = false;
		setLoadingProjects(true);

		void (async () => {
			try {
				const response = await electrobun.rpc!.request.getProjects({
					profile: selectedProfile,
				});
				if (cancelled) {
					return;
				}

				const preferredProjectId = selectedProfileSummary?.projectId ?? response[0]?.id ?? "";
				startTransition(() => {
					setProjects(response);
					setSelectedProjectId((current) => {
						if (response.some((project: Project) => project.id === current)) {
							return current;
						}
						return preferredProjectId;
					});
					setError(null);
				});
			} catch (reason) {
				if (!cancelled) {
					setError(reason instanceof Error ? reason.message : String(reason));
					setProjects([]);
					setSelectedProjectId("");
				}
			} finally {
				if (!cancelled) {
					setLoadingProjects(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selectedProfile, selectedProfileSummary?.projectId]);

	useEffect(() => {
		if (!selectedProfile || !selectedProjectId) {
			setSecrets([]);
			setSelectedSecretIds(new Set());
			return;
		}

		let cancelled = false;
		setLoadingSecrets(true);

		void (async () => {
			try {
				const response = await electrobun.rpc!.request.getSecrets({
					profile: selectedProfile,
					projectId: selectedProjectId,
				});
				if (cancelled) {
					return;
				}

				startTransition(() => {
					setSecrets(response);
					setSelectedSecretIds((current) => {
						const valid = new Set([...current].filter((id) => response.some((s: Secret) => s.id === id)));
						return valid.size > 0 ? valid : new Set(response[0] ? [response[0].id] : []);
					});
					setPathFilter("all");
					setError(null);
				});
			} catch (reason) {
				if (!cancelled) {
					setError(reason instanceof Error ? reason.message : String(reason));
					setSecrets([]);
					setSelectedSecretIds(new Set());
				}
			} finally {
				if (!cancelled) {
					setLoadingSecrets(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selectedProfile, selectedProjectId, refreshKey]);

	const pathCounts = new Map<string, number>();
	for (const secret of secrets) {
		pathCounts.set(secret.path, (pathCounts.get(secret.path) ?? 0) + 1);
	}
	const paths = Array.from(pathCounts.entries()).sort((left, right) =>
		left[0].localeCompare(right[0]),
	);

	const normalizedQuery = deferredQuery.trim().toLowerCase();
	const filteredSecrets = secrets.filter((secret) => {
		if (pathFilter !== "all" && secret.path !== pathFilter) {
			return false;
		}

		if (statusFilter === "ready" && secret.status !== "ready") {
			return false;
		}

		if (statusFilter === "attention" && secret.status === "ready") {
			return false;
		}

		if (!normalizedQuery) {
			return true;
		}

		const searchable = `${secret.name} ${secret.path}`.toLowerCase();
		return searchable.includes(normalizedQuery);
	});

	useEffect(() => {
		if (filteredSecrets.length === 0) {
			if (selectedSecretIds.size > 0) {
				setSelectedSecretIds(new Set());
			}
			return;
		}

		const filteredIds = new Set(filteredSecrets.map((s) => s.id));
		const stillValid = [...selectedSecretIds].filter((id) => filteredIds.has(id));
		if (stillValid.length === 0) {
			setSelectedSecretIds(new Set([filteredSecrets[0].id]));
		} else if (stillValid.length !== selectedSecretIds.size) {
			setSelectedSecretIds(new Set(stillValid));
		}
	}, [filteredSecrets, selectedSecretIds]);

	const selectedSecrets = filteredSecrets.filter((s) => selectedSecretIds.has(s.id));

	async function handleProfileChange(nextProfile: string) {
		setSelectedProfile(nextProfile);
		setProfilesResponse((current) => {
			if (!current) {
				return current;
			}

			return {
				active: nextProfile,
				profiles: current.profiles.map((profile) => ({
					...profile,
					isActive: profile.name === nextProfile,
				})),
			};
		});
		setError(null);

		if (!nextProfile || nextProfile === "env") {
			return;
		}

		setSyncingProfile(true);
		try {
			const response = await electrobun.rpc!.request.switchProfile({
				profile: nextProfile,
			});
			startTransition(() => {
				setProfilesResponse((current) => {
					if (!current) {
						return current;
					}

					return {
						active: response.active,
						profiles: current.profiles.map((profile) => ({
							...profile,
							isActive: profile.name === response.active,
						})),
					};
				});
				setError(null);
			});
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : String(reason));
		} finally {
			setSyncingProfile(false);
		}
	}

	const activeSummary =
		profiles.find((profile) => profile.name === profilesResponse?.active) ?? selectedProfileSummary;

	return (
		<div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
			<Header
				profiles={profiles}
				selectedProfile={selectedProfile}
				onProfileChange={(profile) => void handleProfileChange(profile)}
				projects={projects}
				selectedProjectId={selectedProjectId}
				onProjectChange={setSelectedProjectId}
				selectedProfileSummary={selectedProfileSummary}
				selectedProject={selectedProject}
				loadingProfiles={loadingProfiles}
				loadingProjects={loadingProjects}
				syncingProfile={syncingProfile}
				onRefresh={() => setRefreshKey((k) => k + 1)}
				refreshing={loadingSecrets}
			/>

			<div className="flex-1 flex flex-col px-6 py-6 min-h-0">
				<StatsCards
					profileCount={profiles.length}
					activeSourceName={activeSummary?.name ?? ""}
					projectCount={projects.length}
					selectedProjectName={selectedProject?.name ?? ""}
					filteredSecretsCount={filteredSecrets.length}
					totalSecretsCount={secrets.length}
					pathCount={paths.length}
					currentPathFilter={pathFilter}
				/>

				{error ? (
					<div className="mt-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
						{error}
					</div>
				) : null}

				<div className="mt-6 flex-1 grid grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)] gap-4 min-h-0 min-w-0 overflow-hidden">
						<Navigator
							paths={paths}
							pathFilter={pathFilter}
							onPathSelect={setPathFilter}
							totalSecrets={secrets.length}
						/>

						<Inventory
							secrets={filteredSecrets}
							selectedSecretIds={selectedSecretIds}
							onSelectionChange={setSelectedSecretIds}
							query={query}
							onQueryChange={setQuery}
							statusFilter={statusFilter}
							onStatusFilterChange={setStatusFilter}
							loading={loadingSecrets}
							totalCount={secrets.length}
						/>

						<DetailPanel
							secrets={selectedSecrets}
							selectedProject={selectedProject}
							selectedProfileSummary={selectedProfileSummary}
							onViewValues={(title, values) => setExpandedValues({ title, values })}
							onEditValue={(entry) => setEditingEntry(entry)}
							onViewHistory={(secretId, secretName) => setHistoryTarget({ secretId, secretName })}
							onRefresh={() => setRefreshKey((k) => k + 1)}
						/>
					</div>

				{expandedValues ? (
					<ValueView
						title={expandedValues.title}
						values={expandedValues.values}
						onClose={() => setExpandedValues(null)}
					/>
				) : null}

				{editingEntry ? (
					<EditModal
						secretId={editingEntry.secretId}
						name={editingEntry.name}
						initialValue={editingEntry.value}
						profile={selectedProfileSummary?.name}
						projectId={selectedProject?.id}
						onClose={() => setEditingEntry(null)}
						onSaved={() => {
							setEditingEntry(null);
							setRefreshKey((k) => k + 1);
						}}
					/>
				) : null}

				{historyTarget ? (
					<HistoryModal
						secretId={historyTarget.secretId}
						secretName={historyTarget.secretName}
						profile={selectedProfileSummary?.name}
						projectId={selectedProject?.id}
						onClose={() => setHistoryTarget(null)}
						onChanged={() => setRefreshKey((k) => k + 1)}
					/>
				) : null}
			</div>
		</div>
	);
}

export default App;
