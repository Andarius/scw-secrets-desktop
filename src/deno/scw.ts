import { decodeBase64, encodeBase64 } from "@std/encoding/base64";

import { HOME_DIR } from "./config.ts";
import type {
	HttpLog,
	ProfileSummary,
	ProfilesResponse,
	Project,
	Secret,
	SecretFilters,
	SecretVersion,
} from "../shared/models.ts";

const API_BASE = "https://api.scaleway.com";

// HTTP log collector
const MAX_LOGS = 500;
let logIdCounter = 0;
const httpLogs: HttpLog[] = [];

function recordLog(method: string, url: string, status: number, durationMs: number, error?: string) {
	httpLogs.push({
		id: ++logIdCounter,
		method,
		url,
		status,
		durationMs: Math.round(durationMs),
		timestamp: new Date().toISOString(),
		error,
	});
	if (httpLogs.length > MAX_LOGS) {
		httpLogs.splice(0, httpLogs.length - MAX_LOGS);
	}
}

export function getHttpLogs(): HttpLog[] {
	return [...httpLogs].reverse();
}

export function clearHttpLogs(): void {
	httpLogs.length = 0;
}

const SECRET_MANAGER_REGION = "fr-par";
const SCW_CONFIG_PATH = `${HOME_DIR}/.config/scw/config.yaml`;

type LoadedProfile = {
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
	const secretKey = Deno.env.get("SCW_SECRET_KEY")?.trim() ?? "";
	const projectId = Deno.env.get("SCW_PROJECT_ID")?.trim() ?? "";
	const organizationId = Deno.env.get("SCW_ORGANIZATION_ID")?.trim() ?? "";
	const accessKey = Deno.env.get("SCW_ACCESS_KEY")?.trim() ?? "";

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

function readConfigText(): string | null {
	try {
		return Deno.readTextFileSync(SCW_CONFIG_PATH);
	} catch {
		return null;
	}
}

function getConfigText(): string {
	const text = readConfigText();
	if (text === null) {
		throw new Error(`scw config not found at ${SCW_CONFIG_PATH}`);
	}
	return text;
}

function readActiveProfile(configText: string): string | null {
	for (const line of configText.split(/\r?\n/)) {
		if (line.startsWith("active_profile:")) {
			return line.split(":", 2)[1]?.trim() || null;
		}
	}
	return null;
}

function parseProfiles(configText: string): Record<string, LoadedProfile> {
	const profiles: Record<string, LoadedProfile> = {};
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
	const configText = readConfigText();
	if (configText !== null) {
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

	Deno.writeTextFileSync(SCW_CONFIG_PATH, `${rewritten.join("\n")}\n`);
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

	return selected;
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

async function apiRequest<T>(
	method: "GET" | "POST" | "PATCH" | "DELETE",
	pathname: string,
	profile: LoadedProfile,
	params: Record<string, string>,
	body?: unknown,
): Promise<T> {
	const url = new URL(pathname, API_BASE);
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			url.searchParams.set(key, value);
		}
	}

	const headers: Record<string, string> = { "X-Auth-Token": profile.secretKey };
	if (body !== undefined) {
		headers["Content-Type"] = "application/json";
	}

	const start = performance.now();
	const response = await fetch(url, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	const durationMs = performance.now() - start;

	try {
		const result = await parseJson<T>(response);
		recordLog(method, url.toString(), response.status, durationMs);
		return result;
	} catch (err) {
		recordLog(method, url.toString(), response.status, durationMs, err instanceof Error ? err.message : String(err));
		throw err;
	}
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
	const start = performance.now();
	const response = await fetch(url, {
		method: "DELETE",
		headers: { "X-Auth-Token": profile.secretKey },
	});
	const durationMs = performance.now() - start;

	if (!response.ok) {
		try {
			await parseJson(response);
		} catch (err) {
			recordLog("DELETE", url.toString(), response.status, durationMs, err instanceof Error ? err.message : String(err));
			throw err;
		}
	}
	await response.body?.cancel();
	recordLog("DELETE", url.toString(), response.status, durationMs);
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
		const data = await apiRequest<TResponse>("GET", pathname, profile, {
			...params,
			page: String(page),
			page_size: String(PAGE_SIZE),
		});
		const batch = extract(data);
		items.push(...batch);
		// empty page also stops: total_count can over-report if items vanish mid-listing
		if (batch.length === 0 || items.length >= data.total_count) break;
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
	const data = await apiRequest<{ data: string }>(
		"GET",
		secretManagerPath("secrets", secretId, "versions", revision, "access"),
		profile,
		{ project_id: projectId || profile.projectId },
	);
	return new TextDecoder().decode(decodeBase64(data.data));
}

const PREFETCH_CONCURRENCY = 8;
const PREFETCH_MAX_VALUE_BYTES = 64 * 1024;

function isVersionActive(status: string): boolean {
	return status !== "scheduled_for_deletion" && status !== "destroyed";
}

async function mapConcurrent(
	secretIds: string[],
	run: (secretId: string) => Promise<void>,
	onError: (secretId: string) => void,
): Promise<void> {
	let cursor = 0;

	async function worker(): Promise<void> {
		while (true) {
			const idx = cursor++;
			if (idx >= secretIds.length) return;
			const secretId = secretIds[idx];
			try {
				await run(secretId);
			} catch {
				onError(secretId);
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(PREFETCH_CONCURRENCY, secretIds.length) }, worker));
}

export async function getActiveVersionCounts(
	secretIds: string[],
	profileName?: string,
	projectId?: string,
): Promise<{ counts: Record<string, number>; failed: string[] }> {
	const counts: Record<string, number> = {};
	const failed: string[] = [];

	await mapConcurrent(
		secretIds,
		async (secretId) => {
			const versions = await getSecretVersions(secretId, profileName, projectId);
			counts[secretId] = versions.filter((v) => isVersionActive(v.status)).length;
		},
		(secretId) => failed.push(secretId),
	);
	return { counts, failed };
}

export async function prefetchSecretValues(
	secretIds: string[],
	profileName?: string,
	projectId?: string,
): Promise<{ values: Record<string, string>; failed: string[] }> {
	const values: Record<string, string> = {};
	const failed: string[] = [];

	await mapConcurrent(
		secretIds,
		async (secretId) => {
			const value = await accessSecretVersion(secretId, "latest_enabled", profileName, projectId);
			values[secretId] = value.length > PREFETCH_MAX_VALUE_BYTES ? value.slice(0, PREFETCH_MAX_VALUE_BYTES) : value;
		},
		(secretId) => failed.push(secretId),
	);
	return { values, failed };
}

export async function createSecretVersion(
	secretId: string,
	value: string,
	profileName?: string,
	projectId?: string,
): Promise<SecretVersion> {
	const profile = loadProfile(profileName);
	const encoded = encodeBase64(new TextEncoder().encode(value));
	return apiRequest<SecretVersion>(
		"POST",
		secretManagerPath("secrets", secretId, "versions"),
		profile,
		{ project_id: projectId || profile.projectId },
		{ data: encoded },
	);
}

export async function createSecret(
	name: string,
	path: string,
	type: string,
	tags: string[],
	profileName?: string,
	projectId?: string,
): Promise<Secret> {
	const profile = loadProfile(profileName);
	const body: {
		name: string;
		project_id: string;
		path?: string;
		type?: string;
		tags?: string[];
	} = {
		name,
		project_id: projectId || profile.projectId,
	};

	if (path && path !== "/") {
		body.path = path;
	}

	if (type && type !== "opaque") {
		body.type = type;
	}

	if (tags.length > 0) {
		body.tags = tags;
	}

	return apiRequest<Secret>("POST", secretManagerPath("secrets"), profile, {}, body);
}

export async function updateSecret(
	secretId: string,
	updates: { name?: string; tags?: string[] },
	profileName?: string,
	projectId?: string,
): Promise<Secret> {
	const profile = loadProfile(profileName);
	return apiRequest<Secret>(
		"PATCH",
		secretManagerPath("secrets", secretId),
		profile,
		{ project_id: projectId || profile.projectId },
		updates,
	);
}

export async function enableSecretVersion(
	secretId: string,
	revision: number,
	profileName?: string,
	projectId?: string,
): Promise<SecretVersion> {
	const profile = loadProfile(profileName);
	return apiRequest<SecretVersion>(
		"POST",
		secretManagerPath("secrets", secretId, "versions", String(revision), "enable"),
		profile,
		{ project_id: projectId || profile.projectId },
		{},
	);
}

export async function disableSecretVersion(
	secretId: string,
	revision: number,
	profileName?: string,
	projectId?: string,
): Promise<SecretVersion> {
	const profile = loadProfile(profileName);
	return apiRequest<SecretVersion>(
		"POST",
		secretManagerPath("secrets", secretId, "versions", String(revision), "disable"),
		profile,
		{ project_id: projectId || profile.projectId },
		{},
	);
}

export async function destroySecretVersion(
	secretId: string,
	revision: number,
	profileName?: string,
	projectId?: string,
): Promise<void> {
	const profile = loadProfile(profileName);
	await apiDelete(
		secretManagerPath("secrets", secretId, "versions", String(revision)),
		profile,
		{ project_id: projectId || profile.projectId },
	);
}

export async function deleteSecret(
	secretId: string,
	profileName?: string,
	projectId?: string,
): Promise<void> {
	const profile = loadProfile(profileName);
	await apiDelete(
		secretManagerPath("secrets", secretId),
		profile,
		{ project_id: projectId || profile.projectId },
	);
}
