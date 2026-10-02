import { useLayoutEffect, useRef, useState } from "react";

// Tallest height the element has reached, to use as its min-height so switching between
// shorter and taller views (tabs) never makes the surrounding layout shrink and jump.
// Starts over whenever resetKey changes (e.g. a different value is shown).
export function useStableMinHeight<T extends HTMLElement>(resetKey: string) {
	const [peak, setPeak] = useState({ key: resetKey, height: 0 });
	const ref = useRef<T>(null);
	const minHeight = peak.key === resetKey ? peak.height : 0;

	/**
	 *  Observes the element and raises the stored peak each time it grows past it; a peak
	 *  recorded for another resetKey counts as 0. Re-subscribes when resetKey changes.
	 */
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) =>
			setPeak((current) => {
				const base = current.key === resetKey ? current.height : 0;
				return entry.contentRect.height > base ? { key: resetKey, height: entry.contentRect.height } : current;
			}),
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [resetKey]);

	return { ref, minHeight };
}
