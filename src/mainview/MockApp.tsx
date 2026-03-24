import { useState, useDeferredValue, useEffect } from "react";

import type { ProfilesResponse, Project, Secret } from "../shared/models";
import { Header } from "./components/Header";
import { StatsCards } from "./components/StatsCards";
import { Navigator } from "./components/Navigator";
import { Inventory } from "./components/Inventory";
import { DetailPanel, type ValueEntry } from "./components/DetailPanel";
import { ValueView } from "./components/ValueModal";

type StatusFilter = "all" | "ready" | "attention";
type VersionSortDirection = "desc" | "asc";

const MOCK_PROFILES: ProfilesResponse = {
	active: "production",
	profiles: [
		{ name: "production", accessKey: "SCW8K2M4NP7XFGH3RVWT", projectId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", organizationId: "org-12345678", isActive: true },
		{ name: "staging", accessKey: "SCW3J9L2QR5YBHD8KWXM", projectId: "f9e8d7c6-b5a4-3210-fedc-ba0987654321", organizationId: "org-12345678", isActive: false },
		{ name: "development", accessKey: "SCW6T4P8VN2XMCS1FWYA", projectId: "11223344-5566-7788-99aa-bbccddeeff00", organizationId: "org-12345678", isActive: false },
	],
};

const MOCK_PROJECTS: Project[] = [
	{ id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", name: "webapp-api", description: "Main web application backend", created_at: "2025-01-15T10:00:00Z", updated_at: "2026-03-20T14:30:00Z" },
	{ id: "b2c3d4e5-f6a7-8901-bcde-f12345678901", name: "data-pipeline", description: "ETL and data processing", created_at: "2025-03-01T08:00:00Z", updated_at: "2026-03-18T09:15:00Z" },
	{ id: "c3d4e5f6-a7b8-9012-cdef-123456789012", name: "mobile-backend", description: "Mobile app API", created_at: "2025-06-10T12:00:00Z", updated_at: "2026-03-22T16:45:00Z" },
];

const MOCK_SECRETS: Secret[] = [
	{ id: "d4e5f6a7-b8c9-0123-defa-234567890123", name: "DATABASE_URL", path: "/services/api", type: "opaque", version_count: 5, status: "ready", tags: ["prod", "database"], created_at: "2025-02-10T08:00:00Z", updated_at: "2026-03-20T14:30:00Z" },
	{ id: "e5f6a7b8-c9d0-1234-efab-345678901234", name: "REDIS_PASSWORD", path: "/services/api", type: "opaque", version_count: 2, status: "ready", tags: ["prod"], created_at: "2025-02-10T08:05:00Z", updated_at: "2026-01-15T11:20:00Z" },
	{ id: "f6a7b8c9-d0e1-2345-fabc-456789012345", name: "JWT_SECRET", path: "/services/auth", type: "opaque", version_count: 3, status: "ready", tags: ["auth"], created_at: "2025-03-01T09:00:00Z", updated_at: "2026-03-10T08:45:00Z" },
	{ id: "a7b8c9d0-e1f2-3456-abcd-567890123456", name: "SMTP_API_KEY", path: "/services/notifications", type: "opaque", version_count: 1, status: "ready", tags: [], created_at: "2025-04-15T14:00:00Z", updated_at: "2025-04-15T14:00:00Z" },
	{ id: "b8c9d0e1-f2a3-4567-bcde-678901234567", name: "STRIPE_SECRET_KEY", path: "/services/billing", type: "opaque", version_count: 4, status: "ready", tags: ["billing", "sensitive"], created_at: "2025-05-01T10:30:00Z", updated_at: "2026-03-19T16:00:00Z" },
	{ id: "c9d0e1f2-a3b4-5678-cdef-789012345678", name: "AWS_ACCESS_KEY_ID", path: "/infra/cloud", type: "key_value", version_count: 2, status: "ready", tags: ["aws"], created_at: "2025-06-20T07:15:00Z", updated_at: "2026-02-28T12:30:00Z" },
	{ id: "d0e1f2a3-b4c5-6789-defa-890123456789", name: "AWS_SECRET_ACCESS_KEY", path: "/infra/cloud", type: "key_value", version_count: 2, status: "ready", tags: ["aws"], created_at: "2025-06-20T07:15:00Z", updated_at: "2026-02-28T12:30:00Z" },
	{ id: "e1f2a3b4-c5d6-7890-efab-901234567890", name: "SENTRY_DSN", path: "/services/monitoring", type: "opaque", version_count: 1, status: "ready", tags: [], created_at: "2025-07-10T11:00:00Z", updated_at: "2025-07-10T11:00:00Z" },
	{ id: "f2a3b4c5-d6e7-8901-fabc-012345678901", name: "DEPRECATED_API_TOKEN", path: "/services/legacy", type: "opaque", version_count: 6, status: "locked", tags: ["deprecated"], created_at: "2025-01-05T06:00:00Z", updated_at: "2026-03-01T09:00:00Z" },
	{ id: "a3b4c5d6-e7f8-9012-abcd-123456789abc", name: "OAUTH_CLIENT_SECRET", path: "/services/auth", type: "opaque", version_count: 2, status: "ready", tags: ["auth"], created_at: "2025-08-22T15:45:00Z", updated_at: "2026-03-15T10:20:00Z" },
	{ id: "b4c5d6e7-f8a9-0123-bcde-23456789abcd", name: "ENCRYPTION_MASTER_KEY", path: "/services/api", type: "opaque", version_count: 1, status: "ready", tags: ["sensitive"], created_at: "2025-09-01T09:30:00Z", updated_at: "2025-09-01T09:30:00Z" },
	{ id: "c5d6e7f8-a9b0-1234-cdef-3456789abcde", name: "WEBHOOK_SIGNING_KEY", path: "/services/billing", type: "key_value", version_count: 3, status: "ready", tags: ["billing"], created_at: "2025-10-12T13:00:00Z", updated_at: "2026-03-22T08:15:00Z" },
];

function MockApp() {
	const [selectedProfile, setSelectedProfile] = useState("production");
	const [selectedProjectId, setSelectedProjectId] = useState(MOCK_PROJECTS[0].id);
	const [selectedSecretIds, setSelectedSecretIds] = useState<Set<string>>(new Set([MOCK_SECRETS[0].id]));
	const [expandedValues, setExpandedValues] = useState<{ title: string; values: ValueEntry[] } | null>(null);
	const [query, setQuery] = useState("");
	const [pathFilter, setPathFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [versionSortDirection, setVersionSortDirection] = useState<VersionSortDirection>("desc");

	const deferredQuery = useDeferredValue(query);
	const profiles = MOCK_PROFILES.profiles;
	const selectedProfileSummary = profiles.find((p) => p.name === selectedProfile) ?? profiles[0];
	const selectedProject = MOCK_PROJECTS.find((p) => p.id === selectedProjectId) ?? MOCK_PROJECTS[0];

	const pathCounts = new Map<string, number>();
	for (const secret of MOCK_SECRETS) {
		pathCounts.set(secret.path, (pathCounts.get(secret.path) ?? 0) + 1);
	}
	const paths = Array.from(pathCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));

	const normalizedQuery = deferredQuery.trim().toLowerCase();
	const filteredSecrets = MOCK_SECRETS.filter((secret) => {
		if (pathFilter !== "all" && secret.path !== pathFilter) return false;
		if (statusFilter === "ready" && secret.status !== "ready") return false;
		if (statusFilter === "attention" && secret.status === "ready") return false;
		if (!normalizedQuery) return true;
		return `${secret.name} ${secret.path}`.toLowerCase().includes(normalizedQuery);
	});
	const visibleSecrets = [...filteredSecrets].sort((left, right) => {
		const direction = versionSortDirection === "desc" ? -1 : 1;
		const versionDiff = (left.version_count - right.version_count) * direction;
		if (versionDiff !== 0) return versionDiff;
		return left.name.localeCompare(right.name);
	});
	const visibleVersionCount = visibleSecrets.reduce((sum, secret) => sum + secret.version_count, 0);
	const totalVersionCount = MOCK_SECRETS.reduce((sum, secret) => sum + secret.version_count, 0);
	const visiblePrunableVersionCount = visibleSecrets.reduce(
		(sum, secret) => sum + Math.max(secret.version_count - 1, 0),
		0,
	);
	const totalPrunableVersionCount = MOCK_SECRETS.reduce(
		(sum, secret) => sum + Math.max(secret.version_count - 1, 0),
		0,
	);

	useEffect(() => {
		if (visibleSecrets.length === 0 && selectedSecretIds.size > 0) {
			setSelectedSecretIds(new Set());
			return;
		}
		const filteredIds = new Set(visibleSecrets.map((s) => s.id));
		const stillValid = [...selectedSecretIds].filter((id) => filteredIds.has(id));
		if (stillValid.length === 0 && visibleSecrets.length > 0) {
			setSelectedSecretIds(new Set([visibleSecrets[0].id]));
		}
	}, [visibleSecrets]);

	const selectedSecrets = visibleSecrets.filter((s) => selectedSecretIds.has(s.id));

	return (
		<div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
			<Header
				profiles={profiles}
				selectedProfile={selectedProfile}
				onProfileChange={setSelectedProfile}
				projects={MOCK_PROJECTS}
				selectedProjectId={selectedProjectId}
				onProjectChange={setSelectedProjectId}
				selectedProfileSummary={selectedProfileSummary}
				selectedProject={selectedProject}
				loadingProfiles={false}
				loadingProjects={false}
				syncingProfile={false}
				onRefresh={() => {}}
				refreshing={false}
			/>

				<div className="flex-1 flex flex-col px-6 py-6 min-h-0">
					<StatsCards
						filteredSecretsCount={filteredSecrets.length}
						totalSecretsCount={MOCK_SECRETS.length}
						visibleVersionCount={visibleVersionCount}
						totalVersionCount={totalVersionCount}
						visiblePrunableVersionCount={visiblePrunableVersionCount}
						totalPrunableVersionCount={totalPrunableVersionCount}
						pathCount={paths.length}
						currentPathFilter={pathFilter}
					/>

				{expandedValues ? (
					<div className="mt-6 flex-1 min-h-0">
						<ValueView
							title={expandedValues.title}
							values={expandedValues.values}
							onClose={() => setExpandedValues(null)}
						/>
					</div>
				) : (
					<div className="mt-6 flex-1 grid grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)] gap-4 min-h-0 min-w-0 overflow-hidden">
						<Navigator
							paths={paths}
							pathFilter={pathFilter}
							onPathSelect={setPathFilter}
							totalSecrets={MOCK_SECRETS.length}
						/>

						<Inventory
							secrets={visibleSecrets}
							selectedSecretIds={selectedSecretIds}
							onSelectionChange={setSelectedSecretIds}
							query={query}
							onQueryChange={setQuery}
							statusFilter={statusFilter}
							onStatusFilterChange={setStatusFilter}
							versionSortDirection={versionSortDirection}
							onVersionSortDirectionChange={setVersionSortDirection}
							loading={false}
							totalCount={MOCK_SECRETS.length}
						/>

						<DetailPanel
							secrets={selectedSecrets}
							selectedProject={selectedProject}
							selectedProfileSummary={selectedProfileSummary}
							onViewValues={(title, values) => setExpandedValues({ title, values })}
							onEditValue={() => {}}
							onViewHistory={() => {}}
							onRefresh={() => {}}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

export default MockApp;
