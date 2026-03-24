import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import type {
	ProfileSummary,
	ProfilesResponse,
	Project,
	Secret,
	SecretFilters,
	SecretVersion,
} from "../shared/models";

const API_BASE = "https://api.scaleway.com";
const SECRET_MANAGER_REGION = "fr-par";
const HOME_DIR = Bun.env.HOME ?? Bun.env.USERPROFILE ?? "";
const SCW_CONFIG_PATH = HOME_DIR ? join(HOME_DIR, ".config", "scw", "config.yaml") : "";

type LoadedProfile = {
	accessKey: string;
	secretKey: string;
	projectId: string;
	organizationId: string;
};

type MutableProfile = {
	accessKey: string;
	secretKey: string;
	projectId: string;
	organizationId: string;
};

type ProjectsResponse = {
	total_count: number;
	projects?: Project[];
};

type SecretsResponse = {
	total_count: number;
	secrets?: Secret[];
};

type VersionsResponse = {
	total_count: number;
	versions?: SecretVersion[];
};

function getEnvProfile(): LoadedProfile | null {
	const secretKey = Bun.env.SCW_SECRET_KEY?.trim() ?? "";
	const projectId = Bun.env.SCW_PROJECT_ID?.trim() ?? "";
	const organizationId = Bun.env.SCW_ORGANIZATION_ID?.trim() ?? "";
	const accessKey = Bun.env.SCW_ACCESS_KEY?.trim() ?? "";

	if (!secretKey || !projectId) {
		return null;
	}

	return {
		accessKey,
		secretKey,
		projectId,
		organizationId,
	};
}

function getConfigText(): string {
	if (!SCW_CONFIG_PATH || !existsSync(SCW_CONFIG_PATH)) {
		throw new Error(
			`scw config not found at ${SCW_CONFIG_PATH || "~/.config/scw/config.yaml"}`,
		);
	}

	return readFileSync(SCW_CONFIG_PATH, "utf8");
}

function readActiveProfile(configText: string): string | null {
	for (const line of configText.split(/\r?\n/)) {
		if (line.startsWith("active_profile:")) {
			return line.split(":", 2)[1]?.trim() || null;
		}
	}
	return null;
}

function parseProfiles(configText: string): Record<string, MutableProfile> {
	const profiles: Record<string, MutableProfile> = {};
	let inProfiles = false;
	let currentProfile: string | null = null;

	for (const line of configText.split(/\r?\n/)) {
		const stripped = line.trim();

		if (stripped === "profiles:") {
			inProfiles = true;
			currentProfile = null;
			continue;
		}

		if (!inProfiles) {
			continue;
		}

		if (!stripped) {
			continue;
		}

		if (!line.startsWith(" ") && !line.startsWith("\t")) {
			break;
		}

		const indent = line.length - line.trimStart().length;
		if (indent === 2 && stripped.endsWith(":") && !stripped.startsWith("#")) {
			currentProfile = stripped.slice(0, -1);
			profiles[currentProfile] = {
				accessKey: "",
				secretKey: "",
				projectId: "",
				organizationId: "",
			};
			continue;
		}

		if (!currentProfile) {
			continue;
		}

		if (stripped.startsWith("access_key:")) {
			profiles[currentProfile].accessKey = stripped.split(":", 2)[1]?.trim() ?? "";
			continue;
		}

		if (stripped.startsWith("secret_key:")) {
			profiles[currentProfile].secretKey = stripped.split(":", 2)[1]?.trim() ?? "";
			continue;
		}

		if (stripped.startsWith("default_project_id:")) {
			profiles[currentProfile].projectId = stripped.split(":", 2)[1]?.trim() ?? "";
			continue;
		}

		if (stripped.startsWith("default_organization_id:")) {
			profiles[currentProfile].organizationId = stripped.split(":", 2)[1]?.trim() ?? "";
		}
	}

	return profiles;
}

export function getProfiles(): ProfilesResponse {
	const envProfile = getEnvProfile();
	const summaries: ProfileSummary[] = [];

	let active = envProfile ? "env" : null;
	if (SCW_CONFIG_PATH && existsSync(SCW_CONFIG_PATH)) {
		const configText = getConfigText();
		const configProfiles = parseProfiles(configText);
		const configActive = readActiveProfile(configText);
		if (!envProfile) {
			active = configActive;
		}

		for (const name of Object.keys(configProfiles).sort((left, right) => left.localeCompare(right))) {
			const profile = configProfiles[name];
			summaries.push({
				name,
				accessKey: profile.accessKey,
				projectId: profile.projectId,
				organizationId: profile.organizationId,
				isActive: !envProfile && name === configActive,
			});
		}
	}

	if (envProfile) {
		summaries.unshift({
			name: "env",
			accessKey: envProfile.accessKey,
			projectId: envProfile.projectId,
			organizationId: envProfile.organizationId,
			isActive: true,
		});
	}

	return { active, profiles: summaries };
}

export function switchActiveProfile(profile: string): { active: string } {
	if (profile === "env") {
		throw new Error("the env profile is derived from environment variables and cannot be persisted");
	}

	const configText = getConfigText();
	const availableProfiles = Object.keys(parseProfiles(configText));
	if (!availableProfiles.includes(profile)) {
		throw new Error(
			`profile '${profile}' not found (available: ${availableProfiles.join(", ")})`,
		);
	}

	const lines = configText.split(/\r?\n/);
	let updated = false;
	const rewritten = lines.map((line) => {
		if (line.startsWith("active_profile:")) {
			updated = true;
			return `active_profile: ${profile}`;
		}
		return line;
	});

	if (!updated) {
		throw new Error("active_profile key not found in scw config");
	}

	writeFileSync(SCW_CONFIG_PATH, `${rewritten.join("\n")}\n`, "utf8");
	return { active: profile };
}

function loadProfile(profile?: string): LoadedProfile {
	const envProfile = getEnvProfile();
	if (!profile && envProfile) {
		return envProfile;
	}
	if (profile === "env" && envProfile) {
		return envProfile;
	}

	const configText = getConfigText();
	const profiles = parseProfiles(configText);
	const resolvedProfile = profile ?? readActiveProfile(configText) ?? "default";
	const selected = profiles[resolvedProfile];

	if (!selected) {
		throw new Error(`profile '${resolvedProfile}' not found in ${SCW_CONFIG_PATH}`);
	}
	if (!selected.secretKey) {
		throw new Error(`secret_key not found in scw profile '${resolvedProfile}'`);
	}
	if (!selected.projectId) {
		throw new Error(`default_project_id not found in scw profile '${resolvedProfile}'`);
	}

	return {
		accessKey: selected.accessKey,
		secretKey: selected.secretKey,
		projectId: selected.projectId,
		organizationId: selected.organizationId,
	};
}

async function parseJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.text();
		let detail = `${response.status} ${response.statusText}`;
		try {
			const parsed = JSON.parse(body) as Record<string, unknown>;
			const message = parsed.message;
			if (typeof message === "string" && message) {
				detail = message;
			}
		} catch {
			if (body) {
				detail = body;
			}
		}
		throw new Error(detail);
	}

	return (await response.json()) as T;
}

async function apiGet<T>(
	pathname: string,
	profile: LoadedProfile,
	params: Record<string, string>,
): Promise<T> {
	const url = new URL(pathname, API_BASE);
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			url.searchParams.set(key, value);
		}
	}

	const response = await fetch(url, {
		headers: {
			"X-Auth-Token": profile.secretKey,
		},
	});

	return parseJson<T>(response);
}

async function apiPost<T>(
	pathname: string,
	profile: LoadedProfile,
	body: unknown,
	params: Record<string, string> = {},
): Promise<T> {
	const url = new URL(pathname, API_BASE);
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			url.searchParams.set(key, value);
		}
	}
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"X-Auth-Token": profile.secretKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	return parseJson<T>(response);
}

async function apiDelete(
	pathname: string,
	profile: LoadedProfile,
	params: Record<string, string> = {},
): Promise<void> {
	const url = new URL(pathname, API_BASE);
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			url.searchParams.set(key, value);
		}
	}
	const response = await fetch(url, {
		method: "DELETE",
		headers: {
			"X-Auth-Token": profile.secretKey,
		},
	});

	if (!response.ok) {
		await parseJson(response);
	}
}

const PAGE_SIZE = 100;

async function apiGetAllPages<TResponse extends { total_count: number }, TItem>(
	pathname: string,
	profile: LoadedProfile,
	params: Record<string, string>,
	extract: (response: TResponse) => TItem[],
): Promise<TItem[]> {
	const items: TItem[] = [];
	let page = 1;

	for (;;) {
		const data = await apiGet<TResponse>(pathname, profile, {
			...params,
			page: String(page),
			page_size: String(PAGE_SIZE),
		});
		items.push(...extract(data));
		if (items.length >= data.total_count) break;
		page++;
	}

	return items;
}

function secretManagerPath(...parts: string[]): string {
	return [
		"/secret-manager/v1beta1/regions",
		SECRET_MANAGER_REGION,
		...parts,
	].join("/");
}

export async function getProjects(profileName?: string): Promise<Project[]> {
	const profile = loadProfile(profileName);
	const projects = await apiGetAllPages<ProjectsResponse, Project>(
		"/account/v3/projects",
		profile,
		{ organization_id: profile.organizationId },
		(data) => data.projects ?? [],
	);

	return projects.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getSecrets(filters: SecretFilters): Promise<Secret[]> {
	const profile = loadProfile(filters.profile);
	const allSecrets = await apiGetAllPages<SecretsResponse, Secret>(
		secretManagerPath("secrets"),
		profile,
		{ project_id: filters.projectId || profile.projectId },
		(data) => data.secrets ?? [],
	);

	const query = filters.query?.trim().toLowerCase() ?? "";
	const pathFilter = filters.path && filters.path !== "all" ? filters.path : "";
	const statusFilter = filters.status && filters.status !== "all" ? filters.status : "";

	return allSecrets
		.filter((secret) => {
			if (query) {
				const haystack = `${secret.name} ${secret.path}`.toLowerCase();
				if (!haystack.includes(query)) {
					return false;
				}
			}

			if (pathFilter && secret.path !== pathFilter) {
				return false;
			}

			if (statusFilter === "ready" && secret.status !== "ready") {
				return false;
			}

			if (statusFilter === "disabled" && secret.status === "ready") {
				return false;
			}

			return true;
		})
		.sort((left, right) => {
			const pathOrder = left.path.localeCompare(right.path);
			if (pathOrder !== 0) {
				return pathOrder;
			}
			return left.name.localeCompare(right.name);
		});
}

export async function getSecretVersions(
	secretId: string,
	profileName?: string,
	projectId?: string,
): Promise<SecretVersion[]> {
	const profile = loadProfile(profileName);
	const versions = await apiGetAllPages<VersionsResponse, SecretVersion>(
		secretManagerPath("secrets", secretId, "versions"),
		profile,
		{ project_id: projectId || profile.projectId },
		(data) => data.versions ?? [],
	);
	return versions.sort((left, right) => right.revision - left.revision);
}

export async function accessSecretVersion(
	secretId: string,
	revision: string,
	profileName?: string,
	projectId?: string,
): Promise<string> {
	const profile = loadProfile(profileName);
	const data = await apiGet<{ data: string }>(
		secretManagerPath("secrets", secretId, "versions", revision, "access"),
		profile,
		{ project_id: projectId || profile.projectId },
	);
	return atob(data.data);
}

export async function createSecretVersion(
	secretId: string,
	value: string,
	profileName?: string,
	projectId?: string,
): Promise<SecretVersion> {
	const profile = loadProfile(profileName);
	const encoded = btoa(value);
	return apiPost<SecretVersion>(
		secretManagerPath("secrets", secretId, "versions"),
		profile,
		{ data: encoded },
		{ project_id: projectId || profile.projectId },
	);
}

export async function enableSecretVersion(
	secretId: string,
	revision: number,
	profileName?: string,
	projectId?: string,
): Promise<SecretVersion> {
	const profile = loadProfile(profileName);
	return apiPost<SecretVersion>(
		secretManagerPath("secrets", secretId, "versions", String(revision), "enable"),
		profile,
		{},
		{ project_id: projectId || profile.projectId },
	);
}

export async function disableSecretVersion(
	secretId: string,
	revision: number,
	profileName?: string,
	projectId?: string,
): Promise<SecretVersion> {
	const profile = loadProfile(profileName);
	return apiPost<SecretVersion>(
		secretManagerPath("secrets", secretId, "versions", String(revision), "disable"),
		profile,
		{},
		{ project_id: projectId || profile.projectId },
	);
}

export async function destroySecretVersion(
	secretId: string,
	revision: number,
	profileName?: string,
	projectId?: string,
): Promise<SecretVersion> {
	const profile = loadProfile(profileName);
	await apiDelete(
		secretManagerPath("secrets", secretId, "versions", String(revision)),
		profile,
		{ project_id: projectId || profile.projectId },
	);
	return {
		revision,
		secret_id: secretId,
		status: "scheduled_for_deletion",
		created_at: "",
		updated_at: "",
		description: "",
		latest: false,
	};
}

export async function deleteSecret(
	secretId: string,
	profileName?: string,
	projectId?: string,
): Promise<void> {
	const profile = loadProfile(profileName);
	const url = new URL(secretManagerPath("secrets", secretId), API_BASE);
	if (projectId || profile.projectId) {
		url.searchParams.set("project_id", projectId || profile.projectId);
	}
	await apiDelete(url.pathname, profile, Object.fromEntries(url.searchParams.entries()));
}
