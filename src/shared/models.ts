export type ProfileSummary = {
	name: string;
	accessKey: string;
	projectId: string;
	organizationId: string;
	isActive: boolean;
};

export type ProfilesResponse = {
	active: string | null;
	profiles: ProfileSummary[];
};

export type Project = {
	id: string;
	name: string;
	description: string;
	created_at: string;
	updated_at: string;
};

export type Secret = {
	id: string;
	name: string;
	path: string;
	type?: string;
	version_count: number;
	status: string;
	tags: string[];
	created_at: string;
	updated_at: string;
	ephemeral_policy?: EphemeralPolicy | null;
};

/** What Scaleway does to a version once it expires. */
export type EphemeralAction = "delete" | "disable" | "unknown_action";

/** Secret-level expiration rule applied to each new version; time_to_live is decimal seconds, e.g. "3600s". */
export type EphemeralPolicy = {
	time_to_live?: string | null;
	expires_once_accessed?: boolean | null;
	action: EphemeralAction;
};

/** Expiration of one version, derived from the secret's policy when the version was created. */
export type EphemeralProperties = {
	expires_at?: string | null;
	expires_once_accessed?: boolean | null;
	action: EphemeralAction;
};

export type SecretVersion = {
	revision: number;
	secret_id: string;
	status: string;
	created_at: string;
	updated_at: string;
	description: string;
	latest: boolean;
	ephemeral_properties?: EphemeralProperties | null;
};

export type HttpLog = {
	id: number;
	method: string;
	url: string;
	status: number;
	durationMs: number;
	timestamp: string;
	error?: string;
};

export type SecretFilters = {
	profile?: string;
	projectId?: string;
	query?: string;
	path?: string;
	status?: "all" | "ready" | "disabled";
};

export type LatestRelease = {
	/** Semver without the leading "v", e.g. "0.9.0". */
	version: string;
	/** GitHub release page. */
	url: string;
};
