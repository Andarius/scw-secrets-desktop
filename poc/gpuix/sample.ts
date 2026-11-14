import type { ReadApi } from "./api";
import type { ProfilesResponse, Project, Secret } from "../../src/shared/models";

// Same sample data as the app's mock mode (src/mainview/mock).
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

const MOCK_VALUE = JSON.stringify({
	host: "db.fr-par.scw.cloud",
	port: 5432,
	user: "webapp",
	password: "p4ss-Xk29",
	ssl: true,
	gcp_credentials: JSON.stringify({ type: "service_account", project_id: "webapp-api" }),
	deploy_config: [
		"# deploy config",
		"[database]",
		'host = "db.fr-par.scw.cloud"',
		"port = 5432",
		"",
		"[features]",
		"beta_billing = true",
		"",
		"[role.developers]",
		"password = 'q4JuWaCNa_NgP5z3'",
		"limit = 100",
		"search_path = ['general_fra', 'billing_fra', 'meta_fra', 'utils', 'public', 'notifications']  # 'analytics' ?",
		"schemas.ro = ['general_fra', 'billing_fra', 'meta_fra', 'utils', 'public', 'notifications', 'information_schema']",
	].join("\n"),
	tls_key: "-----BEGIN PRIVATE KEY-----\nMIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAx7fJ\nq2v9pLxWn3T8eKzR5mYd0aBcD1eFgH2iJkLmN4oPqRsT6uVwXyZ\n-----END PRIVATE KEY-----",
});

const WEBHOOK_VALUE =
	'# webhook config\n[signing]\nkey = "whsec_9f2aa61b"\nalgorithm = "sha256"\ntolerance_s = 300\n\n[endpoints]\nbilling = "https://api.webapp.dev/hooks/billing"\n';

// Inert sample backend; mirrors the read-only native slice.
export const sampleApi: ReadApi = {
	getProfiles: async () => MOCK_PROFILES,
	getProjects: async () => MOCK_PROJECTS,
	getSecrets: async ({ projectId }) => (projectId === MOCK_PROJECTS[0].id ? MOCK_SECRETS : []),
	getSecretValue: async ({ secretId }) => ({ value: secretId.startsWith("c5d6") ? WEBHOOK_VALUE : MOCK_VALUE }),
	// DEPRECATED_API_TOKEN (f2a3…) has 6 versions, 5 already scheduled for deletion
	getActiveVersionCounts: async ({ secretIds }) => ({
		counts: Object.fromEntries(secretIds.filter((id) => id.startsWith("f2a3")).map((id) => [id, 1])),
		failed: [],
	}),
};
