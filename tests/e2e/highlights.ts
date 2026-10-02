import { expect as baseExpect, type Expect, type Locator, type Page } from "@playwright/test";

const HIGHLIGHT_DURATION = 400;

async function showHighlight(
	page: Page,
	bbox: { x: number; y: number; width: number; height: number },
	color: string,
	elemId = "pw-highlight",
) {
	await page.evaluate(
		({ bbox, color, duration, elemId }) => {
			const prev = document.getElementById(elemId);
			if (prev) prev.remove();

			const el = document.createElement("div");
			el.id = elemId;
			el.style.cssText = `
				position: fixed;
				left: ${bbox.x}px; top: ${bbox.y}px;
				width: ${bbox.width}px; height: ${bbox.height}px;
				border: 2px solid ${color};
				background-color: ${color}20;
				pointer-events: none;
				z-index: 99999;
				border-radius: 4px;
			`;
			document.body.appendChild(el);
			setTimeout(() => el.remove(), duration);
		},
		{ bbox, color, duration: HIGHLIGHT_DURATION, elemId },
	);
}

async function highlightLocator(locator: Locator, color: string, elemId?: string) {
	try {
		const bbox = await locator.boundingBox({ timeout: 2000 });
		if (bbox) {
			await showHighlight(locator.page(), bbox, color, elemId);
		}
	} catch {
		// element may not be visible yet
	}
}

// Removes the box once the action is done, so it never outlives the element (e.g. a closed dialog).
async function withHighlight<T>(locator: Locator, color: string, elemId: string, action: () => Promise<T>): Promise<T> {
	await highlightLocator(locator, color, elemId);
	try {
		return await action();
	} finally {
		await locator.page().evaluate((id) => document.getElementById(id)?.remove(), elemId).catch(() => {});
	}
}

export function patchHighlights(page: Page) {
	const LocatorProto = page.locator("body").constructor.prototype;

	if (LocatorProto._pw_patched) return;
	LocatorProto._pw_patched = true;

	const origClick = LocatorProto.click;
	LocatorProto.click = async function (this: Locator, ...args: unknown[]) {
		return withHighlight(this, "red", "pw-click-highlight", () => origClick.apply(this, args));
	};

	const origFill = LocatorProto.fill;
	LocatorProto.fill = async function (this: Locator, ...args: unknown[]) {
		return withHighlight(this, "blue", "pw-fill-highlight", () => origFill.apply(this, args));
	};

	const origCheck = LocatorProto.check;
	LocatorProto.check = async function (this: Locator, ...args: unknown[]) {
		return withHighlight(this, "orange", "pw-check-highlight", () => origCheck.apply(this, args));
	};

	const origUncheck = LocatorProto.uncheck;
	LocatorProto.uncheck = async function (this: Locator, ...args: unknown[]) {
		return withHighlight(this, "orange", "pw-check-highlight", () => origUncheck.apply(this, args));
	};

	const origSelectOption = LocatorProto.selectOption;
	LocatorProto.selectOption = async function (this: Locator, ...args: unknown[]) {
		return withHighlight(this, "blue", "pw-select-highlight", () => origSelectOption.apply(this, args));
	};
}

function isLocator(value: unknown): value is Locator {
	return typeof value === "object" && value !== null && "boundingBox" in value && "page" in value;
}

type HighlightRule = { color: string; elemId: string };

const assertionHighlights: Record<string, HighlightRule> = {
	toBeVisible: { color: "green", elemId: "pw-visible-highlight" },
	toContainText: { color: "#22d3ee", elemId: "pw-text-highlight" },
	toHaveText: { color: "#22d3ee", elemId: "pw-text-highlight" },
};

export function highlightExpect(target: unknown): ReturnType<Expect> {
	const result = baseExpect(target);
	if (!isLocator(target)) return result;

	const locator = target;

	return new Proxy(result, {
		get(obj, prop, receiver) {
			const original = Reflect.get(obj, prop, receiver);
			if (typeof prop !== "string" || typeof original !== "function") return original;

			const rule = assertionHighlights[prop];
			if (!rule) return original;

			return async (...args: unknown[]) => {
				return withHighlight(locator, rule.color, rule.elemId, () =>
					(original as (...a: unknown[]) => Promise<unknown>).apply(obj, args),
				);
			};
		},
	});
}
