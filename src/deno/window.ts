// Desktop window lifecycle: restore saved geometry, keep the title stable, persist
// geometry as it changes, and shut down when the window is closed.
//
// Deliberately free of Deno globals — all I/O is injected so the logic is unit-testable
// (see tests/deno/window.test.ts).

export type Geometry = { width?: number; height?: number; x?: number; y?: number };

/** The slice of `Deno.BrowserWindow` this module uses. */
export interface DesktopWindow {
	setSize(width: number, height: number): void;
	setPosition(x: number, y: number): void;
	setTitle(title: string): void;
	getSize(): [number, number];
	getPosition(): [number, number];
	close(): void;
	addEventListener(type: string, listener: () => void): void;
}

export interface WindowLifecycleOptions {
	title: string;
	defaultSize: readonly [number, number];
	/** Geometry loaded from disk; empty on first run. */
	saved: Geometry;
	/** Write geometry to disk. Called on the close path, so it must be synchronous. */
	persist: (geo: Geometry) => void;
	/** Terminate the process once the window is gone. */
	quit: () => void;
	/** Debounce for resize/move writes. */
	persistDelayMs?: number;
	/** macOS resets the title to the binary name at unpredictable points after webview init. */
	titleRetryDelaysMs?: readonly number[];
}

const TITLE_RETRIES_MS = [300, 1200, 4000] as const;

// Window handles go stale once the window is destroyed; every call can throw.
function ignoringErrors(fn: () => void): void {
	try {
		fn();
	} catch {
		// window gone, or unsupported on this backend
	}
}

export function attachWindowLifecycle(win: DesktopWindow, opts: WindowLifecycleOptions): void {
	const { title, defaultSize, saved, persist, quit } = opts;
	const persistDelayMs = opts.persistDelayMs ?? 400;
	const titleRetriesMs = opts.titleRetryDelaysMs ?? TITLE_RETRIES_MS;

	// ctor opts may not apply when adopting the auto-opened window — enforce explicitly
	if (saved.width && saved.height) win.setSize(saved.width, saved.height);
	else win.setSize(defaultSize[0], defaultSize[1]);
	if (saved.x != null && saved.y != null) win.setPosition(saved.x, saved.y);
	win.setTitle(title);

	const titleTimers = new Set<ReturnType<typeof setTimeout>>();
	for (const ms of titleRetriesMs) {
		const timer = setTimeout(() => {
			titleTimers.delete(timer);
			ignoringErrors(() => win.setTitle(title));
		}, ms);
		titleTimers.add(timer);
	}
	ignoringErrors(() => win.addEventListener("focus", () => ignoringErrors(() => win.setTitle(title))));

	const readGeometry = (): Geometry | undefined => {
		try {
			const [width, height] = win.getSize();
			const [x, y] = win.getPosition();
			return { width, height, x, y };
		} catch {
			return undefined; // window gone
		}
	};

	let pending: ReturnType<typeof setTimeout> | undefined;
	const schedulePersist = () => {
		clearTimeout(pending);
		pending = setTimeout(() => {
			pending = undefined;
			const geo = readGeometry();
			if (geo) persist(geo);
		}, persistDelayMs);
	};
	win.addEventListener("resize", schedulePersist);
	win.addEventListener("move", schedulePersist);

	// The native close button only emits this event — `deno desktop` takes no default
	// action, so without a handler the window stays on screen and the process lives on
	// (macOS: clicking the top-left X did nothing). Cmd+Q is unaffected; it quits via
	// the app menu.
	win.addEventListener("close", () => {
		clearTimeout(pending);
		pending = undefined;
		for (const timer of titleTimers) clearTimeout(timer);
		titleTimers.clear();
		// must read before the window is destroyed, and flushes a resize that is
		// still sitting in the debounce window
		const geo = readGeometry();
		if (geo) persist(geo);
		ignoringErrors(() => win.close());
		quit();
	});
}
