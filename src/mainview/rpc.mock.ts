import type { ApiClient } from "../shared/rpc";

// Exercises the value viewer: JSON with embedded JSON/TOML strings, long dot-path
// keys, array values, and a multi-line non-TOML string.
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

// Inert backend for mock mode (VITE_MOCK=1) — MockApp renders its own sample data.
export const mockApi: ApiClient = {
	getProfiles: async () => ({ active: null, profiles: [] }),
	switchProfile: async ({ profile }) => ({ active: profile }),
	getProjects: async () => [],
	getSecrets: async () => [],
	getSecretVersions: async () => [],
	// WEBHOOK_SIGNING_KEY (c5d6…) returns a top-level TOML value; everything else JSON
	getSecretValue: async ({ secretId }) => ({
		value: secretId?.startsWith("c5d6")
			? '# webhook config\n[signing]\nkey = "whsec_9f2aa61b"\nalgorithm = "sha256"\ntolerance_s = 300\n\n[endpoints]\nbilling = "https://api.webapp.dev/hooks/billing"\n'
			: MOCK_VALUE,
	}),
	prefetchSecretValues: async () => ({ values: {}, failed: [] }),
	getActiveVersionCounts: async () => ({ counts: {}, failed: [] }),
	createSecret: async () => ({ secretId: "mock-secret-id" }),
	updateSecretValue: async () => ({ ok: true }),
	enableSecretVersion: async () => ({ ok: true }),
	disableSecretVersion: async () => ({ ok: true }),
	destroySecretVersion: async () => ({ ok: true }),
	updateSecret: async () => ({ ok: true }),
	duplicateSecret: async () => ({ secretId: "mock-secret-id" }),
	deleteSecret: async () => ({ ok: true }),
	getHttpLogs: async () => [],
	clearHttpLogs: async () => ({ ok: true }),
	openExternal: async () => ({ ok: true }),
};
