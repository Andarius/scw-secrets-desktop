import { useLayoutEffect, useMemo, useRef } from "react";

import { detectFormat, tokenizeJsonishLine, tokenizeLines } from "../value-format";
import { TOKEN_CLASSES } from "./ValueViewer";

type HighlightedTextareaProps = {
	value: string;
	onChange: (value: string) => void;
	/** Minimum height in lines; the editor grows with its content beyond that. */
	rows?: number;
};

// Syntax-highlighted editor: a transparent textarea over a highlighted <pre>.
// Both share metrics (font, padding, wrapping) so the caret lines up. The textarea grows to
// fit its content (wrapped lines included), like the Structure and Preview tabs.
const SHARED = "p-3 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed";

export function HighlightedTextarea({ value, onChange, rows = 6 }: HighlightedTextareaProps) {
	const preRef = useRef<HTMLPreElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const format = useMemo(() => detectFormat(value), [value]);
	const lines = useMemo(() => {
		if (format === "json") return value.split(/\r?\n/).map(tokenizeJsonishLine);
		if (format === "toml" || format === "env") return tokenizeLines(value, format);
		return null;
	}, [value, format]);

	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const fitContent = () => {
			// reset first so the height can shrink back down to the rows minimum
			textarea.style.height = "auto";
			textarea.style.height = `${textarea.scrollHeight}px`;
		};
		fitContent();
		// wrapping, hence height, changes with the width
		window.addEventListener("resize", fitContent);
		return () => window.removeEventListener("resize", fitContent);
	}, [value]);

	return (
		<div className="relative w-full rounded-lg bg-white/5 border border-white/10 focus-within:border-cyan-500/50 focus-within:bg-white/[0.07] transition-colors overflow-hidden">
			<pre
				ref={preRef}
				aria-hidden
				className={`${SHARED} absolute inset-0 m-0 overflow-hidden pointer-events-none ${lines ? "" : "text-cyan-200"}`}
			>
				{lines
					? lines.map((tokens, i) => (
							<span key={i}>
								{tokens.map((token, j) => (
									<span key={j} className={TOKEN_CLASSES[token.type]}>
										{token.text}
									</span>
								))}
								{"\n"}
							</span>
						))
					: `${value}\n`}
			</pre>
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				rows={rows}
				spellCheck={false}
				className={`${SHARED} relative block w-full bg-transparent text-transparent caret-cyan-300 resize-none overflow-hidden focus:outline-none`}
			/>
		</div>
	);
}
