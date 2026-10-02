import { createContext, useContext, useState } from "react";
import { Search, X } from "lucide-react";

// Lets a parent keep one filter across views (e.g. view and edit mode of the same secret).
export const KeyFilterContext = createContext<[string, (value: string) => void] | null>(null);

export function useKeyFilter(): [string, (value: string) => void] {
	const shared = useContext(KeyFilterContext);
	const local = useState("");
	return shared ?? local;
}

// Search box filtering the keys (and values) of a structured secret value.
export function KeyFilterInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	return (
		<div className="flex items-center gap-2 mb-2 px-2 py-1 rounded-md border border-white/10 bg-white/[0.03] max-w-xs">
			<Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
			<input
				data-key-filter
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					// first Escape clears the filter; the next one reaches the dialog and closes it
					if (e.key === "Escape" && value) {
						e.stopPropagation();
						onChange("");
					}
				}}
				placeholder="Filter keys…"
				spellCheck={false}
				className="w-full bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
			/>
			{value ? (
				<button type="button" onClick={() => onChange("")} className="text-gray-500 hover:text-gray-300">
					<X className="w-3 h-3" />
				</button>
			) : null}
		</div>
	);
}
