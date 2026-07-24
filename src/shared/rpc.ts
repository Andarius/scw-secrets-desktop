import type { HttpLog, ProfilesResponse, Project, Secret, SecretFilters, SecretVersion } from "./models.ts";

// Backend API contract: each method is POST /api/<name> with a JSON params body.
export type ApiRequests = {
	getProfiles: {
		params: Record<string, never>;
		response: ProfilesResponse;
	};
	switchProfile: {
		params: { profile: string };
		response: { active: string };
	};
	getProjects: {
		params: { profile?: string };
		response: Project[];
	};
	getSecrets: {
		params: SecretFilters;
		response: Secret[];
	};
	getSecretVersions: {
		params: { secretId: string; profile?: string; projectId?: string };
		response: SecretVersion[];
	};
	getSecretValue: {
		params: { secretId: string; revision: string; profile?: string; projectId?: string };
		response: { value: string };
	};
	prefetchSecretValues: {
		params: { secretIds: string[]; profile?: string; projectId?: string };
		response: { values: Record<string, string>; failed: string[] };
	};
	getActiveVersionCounts: {
		params: { secretIds: string[]; profile?: string; projectId?: string };
		response: { counts: Record<string, number>; failed: string[] };
	};
	createSecret: {
		params: { name: string; path?: string; type?: string; value: string; tags?: string[]; profile?: string; projectId?: string };
		response: { secretId: string };
	};
	updateSecretValue: {
		params: { secretId: string; value: string; profile?: string; projectId?: string };
		response: { ok: boolean };
	};
	enableSecretVersion: {
		params: { secretId: string; revision: number; profile?: string; projectId?: string };
		response: { ok: boolean };
	};
	disableSecretVersion: {
		params: { secretId: string; revision: number; profile?: string; projectId?: string };
		response: { ok: boolean };
	};
	destroySecretVersion: {
		params: { secretId: string; revision: number; profile?: string; projectId?: string };
		response: { ok: boolean };
	};
	updateSecret: {
		params: { secretId: string; name?: string; tags?: string[]; profile?: string; projectId?: string };
		response: { ok: boolean };
	};
	duplicateSecret: {
		params: { secretId: string; name: string; path?: string; type?: string; tags?: string[]; profile?: string; projectId?: string };
		response: { secretId: string };
	};
	deleteSecret: {
		params: { secretId: string; profile?: string; projectId?: string };
		response: { ok: boolean };
	};
	getHttpLogs: {
		params: Record<string, never>;
		response: HttpLog[];
	};
	clearHttpLogs: {
		params: Record<string, never>;
		response: { ok: boolean };
	};
	openExternal: {
		params: { url: string };
		response: { ok: boolean };
	};
};

export type ApiMethod = keyof ApiRequests;

export type ApiClient = {
	[K in ApiMethod]: (params: ApiRequests[K]["params"]) => Promise<ApiRequests[K]["response"]>;
};
