import { BrowserView, BrowserWindow, Updater, type RPCSchema } from "electrobun/bun";

import { accessSecretVersion, deleteSecret, getProfiles, getProjects, getSecrets, getSecretVersions, switchActiveProfile } from "./scw";
import type { SecretFilters } from "../shared/models";
import type { AppRPCContract } from "../shared/rpc";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

type AppRPC = {
	bun: RPCSchema<AppRPCContract["bun"]>;
	webview: RPCSchema<AppRPCContract["webview"]>;
};

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

const url = await getMainViewUrl();
const rpc = BrowserView.defineRPC<AppRPC>({
	maxRequestTime: 30000,
	handlers: {
		requests: {
			getProfiles: () => getProfiles(),
			switchProfile: ({ profile }: { profile: string }) => switchActiveProfile(profile),
			getProjects: ({ profile }: { profile?: string }) => getProjects(profile),
			getSecrets: (filters: SecretFilters) => getSecrets(filters),
			getSecretVersions: ({ secretId, profile, projectId }: { secretId: string; profile?: string; projectId?: string }) =>
				getSecretVersions(secretId, profile, projectId),
			getSecretValue: async ({ secretId, revision, profile, projectId }: { secretId: string; revision: string; profile?: string; projectId?: string }) => ({
				value: await accessSecretVersion(secretId, revision, profile, projectId),
			}),
			deleteSecret: async ({ secretId, profile, projectId }: { secretId: string; profile?: string; projectId?: string }) => {
				await deleteSecret(secretId, profile, projectId);
				return { ok: true };
			},
			openExternal: ({ url }: { url: string }) => {
				Bun.spawn(["xdg-open", url]);
				return { ok: true };
			},
		},
		messages: {},
	},
});

new BrowserWindow({
	title: "Scw Secrets",
	url,
	rpc,
	frame: {
		width: 1440,
		height: 920,
		x: 120,
		y: 80,
	},
});

console.log("Scw Secrets desktop started!");
