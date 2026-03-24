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
};

export type SecretVersion = {
	revision: number;
	secret_id: string;
	status: string;
	created_at: string;
	updated_at: string;
	description: string;
	latest: boolean;
};

export type SecretFilters = {
	profile?: string;
	projectId?: string;
	query?: string;
	path?: string;
	status?: "all" | "ready" | "disabled";
};
