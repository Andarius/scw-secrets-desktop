import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Search, X } from "lucide-react";

import type { Secret } from "../../shared/models";

type SpotlightSearchProps = {
	secrets: Secret[];
	onSelect: (secretId: string) => void;
	onClose: () => void;
};

type MatchedSecret = {
	secret: Secret;
	matchField: string;
	matchValue: string;
};

function matchSecrets(secrets: Secret[], raw: string): MatchedSecret[] {
	const trimmed = raw.trim();
	if (!trimmed) return [];

	const colonIdx = trimmed.indexOf(":");
	let field: string | null = null;
	let query: string;

	if (colonIdx > 0) {
		const prefix = trimmed.slice(0, colonIdx).toLowerCase();
		if (["id", "name", "path", "tag", "type", "status"].includes(prefix)) {
			field = prefix;
			query = trimmed.slice(colonIdx + 1).trim().toLowerCase();
		} else {
			query = trimmed.toLowerCase();
		}
	} else {
		query = trimmed.toLowerCase();
	}

	if (!query) return [];

	const results: MatchedSecret[] = [];

	for (const secret of secrets) {
		if (field) {
			if (field === "id" && secret.id.toLowerCase().includes(query)) {
				results.push({ secret, matchField: "id", matchValue: secret.id });
			} else if (field === "name" && secret.name.toLowerCase().includes(query)) {
				results.push({ secret, matchField: "name", matchValue: secret.name });
			} else if (field === "path" && secret.path.toLowerCase().includes(query)) {
				results.push({ secret, matchField: "path", matchValue: secret.path });
			} else if (field === "tag") {
				const matchedTag = secret.tags.find((t) => t.toLowerCase().includes(query));
				if (matchedTag) {
					results.push({ secret, matchField: "tag", matchValue: matchedTag });
				}
			} else if (field === "type" && (secret.type ?? "").toLowerCase().includes(query)) {
				results.push({ secret, matchField: "type", matchValue: secret.type ?? "" });
			} else if (field === "status" && secret.status.toLowerCase().includes(query)) {
				results.push({ secret, matchField: "status", matchValue: secret.status });
			}
		} else {
			if (secret.name.toLowerCase().includes(query)) {
				results.push({ secret, matchField: "name", matchValue: secret.name });
			} else if (secret.id.toLowerCase().includes(query)) {
				results.push({ secret, matchField: "id", matchValue: secret.id });
			} else if (secret.path.toLowerCase().includes(query)) {
				results.push({ secret, matchField: "path", matchValue: secret.path });
			} else if (secret.tags.some((t) => t.toLowerCase().includes(query))) {
				const matchedTag = secret.tags.find((t) => t.toLowerCase().includes(query))!;
				results.push({ secret, matchField: "tag", matchValue: matchedTag });
			} else if ((secret.type ?? "").toLowerCase().includes(query)) {
				results.push({ secret, matchField: "type", matchValue: secret.type ?? "" });
			}
		}
	}

	return results.slice(0, 50);
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
	const lower = text.toLowerCase();
	const idx = lower.indexOf(query.toLowerCase());
	if (idx === -1) return <span>{text}</span>;

	return (
		<span>
			{text.slice(0, idx)}
			<span className="text-cyan-300 bg-cyan-500/20 rounded px-0.5">{text.slice(idx, idx + query.length)}</span>
			{text.slice(idx + query.length)}
		</span>
	);
}

function extractQuery(raw: string): string {
	const colonIdx = raw.indexOf(":");
	if (colonIdx > 0) {
		const prefix = raw.slice(0, colonIdx).toLowerCase();
		if (["id", "name", "path", "tag", "type", "status"].includes(prefix)) {
			return raw.slice(colonIdx + 1).trim();
		}
	}
	return raw.trim();
}

export function SpotlightSearch({ secrets, onSelect, onClose }: SpotlightSearchProps) {
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const results = useMemo(() => matchSecrets(secrets, query), [secrets, query]);
	const highlightQuery = extractQuery(query);

	useEffect(() => {
		setActiveIndex(0);
	}, [query]);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		const active = listRef.current?.children[activeIndex] as HTMLElement | undefined;
		active?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Escape") {
			onClose();
			return;
		}
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, results.length - 1));
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
			return;
		}
		if (e.key === "Enter" && results[activeIndex]) {
			onSelect(results[activeIndex].secret.id);
			onClose();
		}
	}

	const fieldColors: Record<string, string> = {
		name: "text-cyan-400 bg-cyan-500/15",
		id: "text-purple-400 bg-purple-500/15",
		path: "text-amber-400 bg-amber-500/15",
		tag: "text-emerald-400 bg-emerald-500/15",
		type: "text-pink-400 bg-pink-500/15",
		status: "text-blue-400 bg-blue-500/15",
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="w-[600px] max-h-[60vh] bg-[#141414] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden">
				<div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
					<Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search secrets... (id:, name:, path:, tag:, type:)"
						className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
					/>
					<button
						type="button"
						onClick={onClose}
						className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
					>
						<X className="w-4 h-4 text-gray-500" />
					</button>
				</div>

				<div ref={listRef} className="flex-1 overflow-y-auto">
					{query.trim() && results.length === 0 ? (
						<div className="px-4 py-8 text-center text-sm text-gray-500">
							No results
						</div>
					) : null}

					{results.map((match, idx) => (
						<button
							key={match.secret.id}
							type="button"
							onClick={() => {
								onSelect(match.secret.id);
								onClose();
							}}
							className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
								idx === activeIndex
									? "bg-white/10"
									: "hover:bg-white/5"
							}`}
						>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="text-sm text-white truncate">{match.secret.name}</span>
									<span className="text-xs text-gray-500 font-mono truncate">{match.secret.path}</span>
								</div>
								<div className="flex items-center gap-2 mt-0.5">
									<span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${fieldColors[match.matchField] ?? "text-gray-400 bg-white/10"}`}>
										{match.matchField}
									</span>
									<span className="text-xs text-gray-400 font-mono truncate">
										<HighlightMatch text={match.matchValue} query={highlightQuery} />
									</span>
								</div>
							</div>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									navigator.clipboard.writeText(match.secret.id);
								}}
								className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
								title="Copy ID"
							>
								<Copy className="w-3 h-3 text-gray-500" />
							</button>
						</button>
					))}

					{!query.trim() ? (
						<div className="px-4 py-6 text-center space-y-2">
							<div className="text-xs text-gray-500">
								Type to search across all secrets
							</div>
							<div className="flex flex-wrap justify-center gap-1.5">
								{["id:", "name:", "path:", "tag:", "type:"].map((prefix) => (
									<button
										key={prefix}
										type="button"
										onClick={() => {
											setQuery(prefix);
											inputRef.current?.focus();
										}}
										className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300 transition-colors font-mono"
									>
										{prefix}
									</button>
								))}
							</div>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
