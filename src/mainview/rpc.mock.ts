const mockRpc = {
	request: {
		getProfiles: async () => ({ active: null, profiles: [] }),
		switchProfile: async () => ({ active: "" }),
		getProjects: async () => [],
		getSecrets: async () => [],
		getSecretVersions: async () => [],
		getSecretValue: async () => ({ value: "mock-value-placeholder" }),
		prefetchSecretValues: async () => ({ values: {}, failed: [] }),
		getActiveVersionCounts: async () => ({ counts: {}, failed: [] }),
		deleteSecret: async () => ({ ok: true }),
		openExternal: async () => ({ ok: true }),
	},
};

export class Electroview {
	rpc = mockRpc;
	static defineRPC() { return mockRpc; }
	constructor(_opts?: unknown) {}
}

export default { Electroview };

export const electrobun = new Electroview();
