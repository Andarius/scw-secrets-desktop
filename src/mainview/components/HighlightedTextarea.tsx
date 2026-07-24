import { useMemo, useRef } from "react";

import { detectFormat, tokenizeJsonishLine, tokenizeLines } from "../value-format";
import { TOKEN_CLASSES } from "./ValueViewer";

type HighlightedTextareaProps = {
	value: string;
	onChange: (value: string) => void;
	rows?: number;
};

// Syntax-highlighted editor: a transparent textarea over a highlighted <pre>.
// Both share metrics (font, padding, wrapping) so the caret lines up.
const SHARED = "p-3 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed";

export function HighlightedTextarea({ value, onChange, rows = 6 }: HighlightedTextareaProps) {
	const preRef = useRef<HTMLPreElement>(null);
	const format = useMemo(() => detectFormat(value), [value]);
	const lines = useMemo(() => {
		if (format === "json") return value.split(/\r?\n/).map(tokenizeJsonishLine);
		if (format === "toml" || format === "env") return tokenizeLines(value, format);
		return null;
	}, [value, format]);

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
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onScroll={(e) => {
					if (preRef.current) preRef.current.scrollTop = e.currentTarget.scrollTop;
				}}
				rows={rows}
				spellCheck={false}
				className={`${SHARED} relative block w-full bg-transparent text-transparent caret-cyan-300 resize-y focus:outline-none`}
			/>
		</div>
	);
}
