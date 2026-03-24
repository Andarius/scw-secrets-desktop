import type { ProfilesResponse, Project, Secret, SecretFilters, SecretVersion } from "./models";

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
			deleteSecret: {
				params: { secretId: string; profile?: string; projectId?: string };
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
