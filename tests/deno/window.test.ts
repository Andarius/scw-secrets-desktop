import { describe, expect, test } from "bun:test";

import { attachWindowLifecycle, type DesktopWindow, type Geometry } from "../../src/deno/window";

type Call = { type: string; args: unknown[] };

function fakeWindow(geo = { size: [800, 600] as [number, number], position: [10, 20] as [number, number] }) {
	const listeners = new Map<string, Array<() => void>>();
	const calls: Call[] = [];
	let closed = false;
	const win: DesktopWindow = {
		setSize: (width, height) => {
			calls.push({ type: "setSize", args: [width, height] });
			geo.size = [width, height];
		},
		setPosition: (x, y) => {
			calls.push({ type: "setPosition", args: [x, y] });
			geo.position = [x, y];
		},
		setTitle: (title) => calls.push({ type: "setTitle", args: [title] }),
		getSize: () => {
			if (closed) throw new Error("window gone");
			return geo.size;
		},
		getPosition: () => {
			if (closed) throw new Error("window gone");
			return geo.position;
		},
		close: () => {
			calls.push({ type: "close", args: [] });
			closed = true;
		},
		addEventListener: (type, listener) => {
			const bucket = listeners.get(type) ?? [];
			bucket.push(listener);
			listeners.set(type, bucket);
		},
	};
	return {
		win,
		calls,
		fire: (type: string) => {
			for (const listener of listeners.get(type) ?? []) listener();
		},
		has: (type: string) => (listeners.get(type)?.length ?? 0) > 0,
	};
}

function attach(win: DesktopWindow, overrides: Partial<Parameters<typeof attachWindowLifecycle>[1]> = {}) {
	const persisted: Geometry[] = [];
	let quits = 0;
	attachWindowLifecycle(win, {
		title: "Scw Secrets",
		defaultSize: [1440, 920],
		saved: {},
		persist: (geo) => persisted.push(geo),
		quit: () => {
			quits += 1;
		},
		// keep tests free of real timers
		persistDelayMs: 0,
		titleRetryDelaysMs: [],
		...overrides,
	});
	return { persisted, quits: () => quits };
}

describe("window close", () => {
	// Regression: under `deno desktop` the native close button only emits a `close`
	// event — the runtime takes no default action, so an unhandled event leaves the
	// window on screen (reported on macOS: clicking the top-left X did nothing).
	test("registers a close listener", () => {
		const { win, has } = fakeWindow();
		attach(win);
		expect(has("close")).toBe(true);
	});

	test("destroys the window and quits when the close button is pressed", () => {
		const { win, calls, fire } = fakeWindow();
		const { quits } = attach(win);

		fire("close");

		expect(calls.some((c) => c.type === "close")).toBe(true);
		expect(quits()).toBe(1);
	});

	test("quits even when destroying the window throws", () => {
		const { win, fire } = fakeWindow();
		win.close = () => {
			throw new Error("already gone");
		};
		const { quits } = attach(win);

		fire("close");

		expect(quits()).toBe(1);
	});

	test("persists the final geometry before the window is destroyed", () => {
		const { win, fire } = fakeWindow({ size: [1000, 700], position: [42, 84] });
		const { persisted } = attach(win, { saved: { width: 1000, height: 700, x: 42, y: 84 } });

		fire("close");

		expect(persisted).toEqual([{ width: 1000, height: 700, x: 42, y: 84 }]);
	});

	test("flushes a resize that is still within the debounce window", async () => {
		const { win, fire } = fakeWindow({ size: [1234, 567], position: [1, 2] });
		const { persisted } = attach(win, {
			saved: { width: 1234, height: 567, x: 1, y: 2 },
			persistDelayMs: 10_000,
		});

		fire("resize");
		fire("close");

		// no debounced write may land after the window is destroyed
		await Bun.sleep(20);
		expect(persisted).toEqual([{ width: 1234, height: 567, x: 1, y: 2 }]);
	});
});

describe("window geometry restore", () => {
	test("applies saved geometry", () => {
		const { win, calls } = fakeWindow();
		attach(win, { saved: { width: 1024, height: 768, x: 5, y: 6 } });

		expect(calls).toContainEqual({ type: "setSize", args: [1024, 768] });
		expect(calls).toContainEqual({ type: "setPosition", args: [5, 6] });
	});

	test("falls back to the default size on first run", () => {
		const { win, calls } = fakeWindow();
		attach(win, { saved: {} });

		expect(calls).toContainEqual({ type: "setSize", args: [1440, 920] });
		expect(calls.some((c) => c.type === "setPosition")).toBe(false);
	});

	test("persists geometry after a resize settles", async () => {
		const { win, fire } = fakeWindow({ size: [900, 500], position: [7, 8] });
		const { persisted } = attach(win, {
			saved: { width: 900, height: 500, x: 7, y: 8 },
			persistDelayMs: 5,
		});

		fire("resize");
		fire("move");
		await Bun.sleep(30);

		expect(persisted).toEqual([{ width: 900, height: 500, x: 7, y: 8 }]);
	});
});
