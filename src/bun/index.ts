import { BrowserView, BrowserWindow, Updater, type RPCSchema } from "electrobun/bun";
import { dlopen, FFIType, ptr as ffiPtr } from "bun:ffi";
import { join } from "path";

import { accessSecretVersion, createSecretVersion, deleteSecret, destroySecretVersion, disableSecretVersion, enableSecretVersion, getProfiles, getProjects, getSecrets, getSecretVersions, switchActiveProfile } from "./scw";
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
			updateSecretValue: async ({ secretId, value, profile, projectId }: { secretId: string; value: string; profile?: string; projectId?: string }) => {
				await createSecretVersion(secretId, value, profile, projectId);
				return { ok: true };
			},
			enableSecretVersion: async ({ secretId, revision, profile, projectId }: { secretId: string; revision: number; profile?: string; projectId?: string }) => {
				await enableSecretVersion(secretId, revision, profile, projectId);
				return { ok: true };
			},
			disableSecretVersion: async ({ secretId, revision, profile, projectId }: { secretId: string; revision: number; profile?: string; projectId?: string }) => {
				await disableSecretVersion(secretId, revision, profile, projectId);
				return { ok: true };
			},
			destroySecretVersion: async ({ secretId, revision, profile, projectId }: { secretId: string; revision: number; profile?: string; projectId?: string }) => {
				await destroySecretVersion(secretId, revision, profile, projectId);
				return { ok: true };
			},
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

const win = new BrowserWindow({
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

// Set window icon (not exposed in Electrobun's public API, calling FFI directly)
{
	const suffix = process.platform === "win32" ? "dll" : "so";
	const lib = dlopen(join(process.cwd(), `libNativeWrapper.${suffix}`), {
		setWindowIcon: { args: [FFIType.ptr, FFIType.cstring], returns: FFIType.void },
	});
	const iconBuf = Buffer.from(join(process.cwd(), "../Resources/appIcon.png") + "\0");
	lib.symbols.setWindowIcon(win.ptr, ffiPtr(iconBuf));
}

console.log("Scw Secrets desktop started!");
