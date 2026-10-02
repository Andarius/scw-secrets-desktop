import { afterEach, describe, expect, test } from "bun:test";

// Minimal localStorage polyfill for Bun test environment
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => { store.set(key, value); },
	removeItem: (key: string) => { store.delete(key); },
	clear: () => { store.clear(); },
	get length() { return store.size; },
	key: (index: number) => [...store.keys()][index] ?? null,
} as Storage });

// Import after localStorage is available
const { loadSettings, saveSettings } = await import("../../src/mainview/lib/settings");

afterEach(() => {
	localStorage.clear();
});

describe("loadSettings", () => {
	test("returns defaults when nothing is stored", () => {
		const settings = loadSettings();
		expect(settings).toEqual({ autoKeepLatest: false, checkForUpdates: true });
	});

	test("returns stored values", () => {
		localStorage.setItem("scw-secrets-settings", JSON.stringify({ autoKeepLatest: true, checkForUpdates: false }));
		const settings = loadSettings();
		expect(settings).toEqual({ autoKeepLatest: true, checkForUpdates: false });
	});

	test("merges with defaults for partial data", () => {
		localStorage.setItem("scw-secrets-settings", JSON.stringify({}));
		const settings = loadSettings();
		expect(settings).toEqual({ autoKeepLatest: false, checkForUpdates: true });
	});

	test("returns defaults for invalid JSON", () => {
		localStorage.setItem("scw-secrets-settings", "not-json");
		const settings = loadSettings();
		expect(settings).toEqual({ autoKeepLatest: false, checkForUpdates: true });
	});
});

describe("saveSettings", () => {
	test("persists settings to localStorage", () => {
		saveSettings({ autoKeepLatest: true, checkForUpdates: true });
		const raw = localStorage.getItem("scw-secrets-settings");
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!)).toEqual({ autoKeepLatest: true, checkForUpdates: true });
	});

	test("roundtrips through load", () => {
		saveSettings({ autoKeepLatest: true, checkForUpdates: true });
		expect(loadSettings()).toEqual({ autoKeepLatest: true, checkForUpdates: true });

		saveSettings({ autoKeepLatest: false, checkForUpdates: false });
		expect(loadSettings()).toEqual({ autoKeepLatest: false, checkForUpdates: false });
	});
});
