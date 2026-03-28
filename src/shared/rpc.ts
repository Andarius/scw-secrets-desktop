import type { HttpLog, ProfilesResponse, Project, Secret, SecretFilters, SecretVersion } from "./models";

export type AppRPCContract = {
	bun: {
		requests: {
			getProfiles: {
				params: {};
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
				params: {};
				response: HttpLog[];
			};
			clearHttpLogs: {
				params: {};
				response: { ok: boolean };
			};
			openExternal: {
				params: { url: string };
				response: { ok: boolean };
			};
		};
		messages: {};
	};
	webview: {
		requests: {};
		messages: {};
	};
};
