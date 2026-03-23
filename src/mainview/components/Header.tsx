import { Lock } from "lucide-react";

import type { ProfileSummary, Project } from "../../shared/models";

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
}: HeaderProps) {
	return (
		<header className="border-b border-white/10 bg-black/40 backdrop-blur-sm">
			<div className="px-6 py-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Lock className="w-4 h-4 text-cyan-400" />
						<h1 className="text-sm font-medium tracking-wide uppercase">
							SCW Secrets
						</h1>
					</div>

					<div className="flex items-center gap-3">
						<div>
							<label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
								Profile
							</label>
							<select
								value={selectedProfile}
								onChange={(e) => onProfileChange(e.target.value)}
								disabled={loadingProfiles || profiles.length === 0}
								className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors min-w-0 w-full max-w-[240px] text-sm appearance-none text-white disabled:opacity-50"
							>
								{profiles.map((profile) => (
									<option key={profile.name} value={profile.name}>
										{profile.name}
										{profile.isActive ? " (active)" : ""}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
								Project
							</label>
							<select
								value={selectedProjectId}
								onChange={(e) => onProjectChange(e.target.value)}
								disabled={loadingProjects || projects.length === 0}
								className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors min-w-0 w-full max-w-[240px] text-sm appearance-none text-white disabled:opacity-50"
							>
								{projects.map((project) => (
									<option key={project.id} value={project.id}>
										{project.name}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>

				<div className="mt-4 flex items-center gap-6 text-xs">
					<div>
						<span className="text-gray-400 uppercase tracking-wider">
							Project:{" "}
						</span>
						<span className="text-white font-medium">
							{selectedProject?.name ?? "none"}
						</span>
					</div>
					<span className="text-gray-600">&bull;</span>
					<div>
						<span className="text-gray-400 uppercase tracking-wider">
							Profile:{" "}
						</span>
						<span className="text-white">
							{selectedProfileSummary?.name ?? "none"}
							{syncingProfile ? " (syncing…)" : ""}
						</span>
					</div>
					<span className="text-gray-600">&bull;</span>
					<div>
						<span className="text-gray-400 uppercase tracking-wider">
							Project ID:{" "}
						</span>
						<span className="text-gray-500 font-mono">
							{selectedProject?.id ?? "—"}
						</span>
					</div>
					<span className="text-gray-600">&bull;</span>
					<div>
						<span className="text-gray-400 uppercase tracking-wider">
							Access:{" "}
						</span>
						<span className="text-gray-500 font-mono">
							{selectedProfileSummary?.accessKey || "Secret-key only"}
						</span>
					</div>
				</div>
			</div>
		</header>
	);
}
