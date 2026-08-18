import { Loader2, Lock, Plus, RefreshCw, Settings } from "lucide-react";

import type { ProfileSummary, Project } from "../../shared/models";
import { HeaderSelect } from "./HeaderSelect";

type HeaderProps = {
	profiles: ProfileSummary[];
	selectedProfile: string;
	onProfileChange: (profile: string) => void;
	projects: Project[];
	selectedProjectId: string;
	onProjectChange: (projectId: string) => void;
	selectedProfileSummary: ProfileSummary | null;
	selectedProject: Project | null;
	loadingProfiles: boolean;
	loadingProjects: boolean;
	syncingProfile: boolean;
	onCreateSecret?: () => void;
	onRefresh: () => void;
	refreshing: boolean;
	onOpenSettings: () => void;
};

export function Header({
	profiles,
	selectedProfile,
	onProfileChange,
	projects,
	selectedProjectId,
	onProjectChange,
	selectedProfileSummary,
	selectedProject,
	loadingProfiles,
	loadingProjects,
	syncingProfile,
	onCreateSecret,
	onRefresh,
	refreshing,
	onOpenSettings,
}: HeaderProps) {
	return (
		<header className="relative z-40 border-b border-white/10 bg-black/40 backdrop-blur-sm">
			<div className="px-6 py-3 flex items-center gap-4">
				<div className="flex items-center gap-2 shrink-0">
					<Lock className="w-4 h-4 text-cyan-400" />
					<h1 className="text-sm font-medium tracking-wide uppercase">SCW Secrets</h1>
				</div>

				<div className="flex items-center gap-2 min-w-0">
					<HeaderSelect
						label="Profile"
						value={selectedProfile}
						onChange={onProfileChange}
						disabled={loadingProfiles || profiles.length === 0}
						maxWidth="max-w-[180px]"
						options={profiles.map((profile) => ({
							value: profile.name,
							label: profile.name,
							hint: profile.isActive ? "active" : undefined,
						}))}
					/>
					<span className="text-gray-600">/</span>
					<HeaderSelect
						label="Project"
						value={selectedProjectId}
						onChange={onProjectChange}
						disabled={loadingProjects || projects.length === 0}
						options={projects.map((project) => ({ value: project.id, label: project.name }))}
					/>
					{syncingProfile ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" /> : null}
				</div>

				<div className="ml-auto flex items-center gap-1.5 shrink-0">
					{onCreateSecret ? (
						<button
							type="button"
							onClick={onCreateSecret}
							disabled={loadingProjects || !selectedProject}
							className="flex items-center gap-2 px-3 py-2 bg-cyan-500/15 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/25 transition-colors disabled:opacity-50 text-cyan-200 text-sm"
						>
							<Plus className="w-4 h-4" />
							<span>New Secret</span>
						</button>
					) : null}
					<button
						type="button"
						onClick={onRefresh}
						disabled={refreshing}
						title="Refresh secrets"
						className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
					>
						<RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
					</button>
					<button
						type="button"
						onClick={onOpenSettings}
						title="Settings"
						className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
					>
						<Settings className="w-4 h-4 text-gray-400" />
					</button>
				</div>
			</div>

			<div className="px-6 pb-2.5 flex items-center gap-6 text-xs">
				<div>
					<span className="text-gray-400 uppercase tracking-wider">Project ID: </span>
					<span className="text-gray-500 font-mono">{selectedProject?.id ?? "—"}</span>
				</div>
				<span className="text-gray-600">&bull;</span>
				<div>
					<span className="text-gray-400 uppercase tracking-wider">Access: </span>
					<span className="text-gray-500 font-mono">
						{selectedProfileSummary?.accessKey || "Secret-key only"}
					</span>
				</div>
			</div>
		</header>
	);
}
