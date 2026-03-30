import { afterEach, describe, expect, test } from "bun:test";

// Minimal localStorage polyfill for Bun test environment
const store = new Map<string, string>();
globalThis.localStorage = {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => { store.set(key, value); },
	removeItem: (key: string) => { store.delete(key); },
	clear: () => { store.clear(); },
	get length() { return store.size; },
	key: (index: number) => [...store.keys()][index] ?? null,
} as Storage;

// Import after localStorage is available
const { loadSettings, saveSettings } = await import("../../src/mainview/settings");

afterEach(() => {
	localStorage.clear();
});

describe("loadSettings", () => {
	test("returns defaults when nothing is stored", () => {
		const settings = loadSettings();
		expect(settings).toEqual({ autoKeepLatest: false });
	});

	test("returns stored values", () => {
		localStorage.setItem("scw-secrets-settings", JSON.stringify({ autoKeepLatest: true }));
		const settings = loadSettings();
		expect(settings).toEqual({ autoKeepLatest: true });
	});

	test("merges with defaults for partial data", () => {
		localStorage.setItem("scw-secrets-settings", JSON.stringify({}));
		const settings = loadSettings();
		expect(settings).toEqual({ autoKeepLatest: false });
	});

	test("returns defaults for invalid JSON", () => {
		localStorage.setItem("scw-secrets-settings", "not-json");
		const settings = loadSettings();
		expect(settings).toEqual({ autoKeepLatest: false });
	});
});

describe("saveSettings", () => {
	test("persists settings to localStorage", () => {
		saveSettings({ autoKeepLatest: true });
		const raw = localStorage.getItem("scw-secrets-settings");
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!)).toEqual({ autoKeepLatest: true });
	});

	test("roundtrips through load", () => {
		saveSettings({ autoKeepLatest: true });
		expect(loadSettings()).toEqual({ autoKeepLatest: true });

		saveSettings({ autoKeepLatest: false });
		expect(loadSettings()).toEqual({ autoKeepLatest: false });
	});
});
