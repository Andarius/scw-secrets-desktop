import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Trash2, X } from "lucide-react";

import { electrobun } from "../rpc";
import type { HttpLog } from "../../shared/models";

type LogsModalProps = {
	onClose: () => void;
};

function formatTime(timestamp: string): string {
	const date = new Date(timestamp);
	const time = date.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const ms = String(date.getMilliseconds()).padStart(3, "0");
	return `${time}.${ms}`;
}

function shortenUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname.replace(/\/secret-manager\/v1beta1\/regions\/[^/]+/, "/sm");
		const params = parsed.search;
		return `${path}${params}`;
	} catch {
		return url;
	}
}

const methodColors: Record<string, string> = {
	GET: "text-cyan-400 bg-cyan-500/15",
	POST: "text-emerald-400 bg-emerald-500/15",
	PATCH: "text-amber-400 bg-amber-500/15",
	DELETE: "text-red-400 bg-red-500/15",
};

function statusColor(status: number): string {
	if (status >= 200 && status < 300) return "text-emerald-400";
	if (status >= 400 && status < 500) return "text-amber-400";
	return "text-red-400";
}

function durationColor(ms: number): string {
	if (ms < 200) return "text-emerald-400";
	if (ms < 500) return "text-amber-400";
	return "text-red-400";
}

export function LogsModal({ onClose }: LogsModalProps) {
	const [logs, setLogs] = useState<HttpLog[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("");

	async function fetchLogs() {
		setLoading(true);
		try {
			const result = await electrobun.rpc!.request.getHttpLogs({});
			setLogs(result);
		} finally {
			setLoading(false);
		}
	}

	async function handleClear() {
		await electrobun.rpc!.request.clearHttpLogs({});
		setLogs([]);
	}

	useEffect(() => {
		void fetchLogs();
	}, []);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const normalizedFilter = filter.trim().toLowerCase();
	const filtered = normalizedFilter
		? logs.filter((log) => {
			const haystack = `${log.method} ${log.url} ${log.status} ${log.error ?? ""}`.toLowerCase();
			return haystack.includes(normalizedFilter);
		})
		: logs;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[90%] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<div className="flex items-center gap-3">
						<h3 className="text-sm font-medium text-gray-300">HTTP Logs</h3>
						<span className="text-xs text-gray-500">{filtered.length} entries</span>
					</div>
					<div className="flex items-center gap-2">
						<input
							type="text"
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder="Filter..."
							className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 w-48"
						/>
						<button
							type="button"
							onClick={() => void fetchLogs()}
							disabled={loading}
							title="Refresh logs"
							className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
						>
							<RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${loading ? "animate-spin" : ""}`} />
						</button>
						<button
							type="button"
							onClick={() => void handleClear()}
							title="Clear logs"
							className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
						>
							<Trash2 className="w-3.5 h-3.5 text-gray-400" />
						</button>
						<button
							type="button"
							onClick={onClose}
							className="p-1.5 hover:bg-white/10 rounded transition-colors"
						>
							<X className="w-4 h-4 text-gray-400" />
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					{loading && logs.length === 0 ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
						</div>
					) : filtered.length === 0 ? (
						<div className="py-12 text-center text-sm text-gray-500">
							{logs.length === 0 ? "No HTTP calls recorded yet" : "No logs match filter"}
						</div>
					) : (
						<table className="w-full text-xs">
							<thead className="sticky top-0 bg-[#141414] border-b border-white/10">
								<tr className="text-left text-gray-500 uppercase tracking-wider">
									<th className="px-4 py-2.5 w-16">Time</th>
									<th className="px-4 py-2.5 w-16">Method</th>
									<th className="px-4 py-2.5">URL</th>
									<th className="px-4 py-2.5 w-16 text-right">Status</th>
									<th className="px-4 py-2.5 w-20 text-right">Duration</th>
								</tr>
							</thead>
							<tbody>
								{filtered.map((log) => (
									<tr
										key={log.id}
										className={`border-b border-white/5 hover:bg-white/5 transition-colors ${log.error ? "bg-red-500/5" : ""}`}
										title={log.error ? `Error: ${log.error}` : log.url}
									>
										<td className="px-4 py-2 text-gray-500 font-mono whitespace-nowrap">
											{formatTime(log.timestamp)}
										</td>
										<td className="px-4 py-2">
											<span className={`px-1.5 py-0.5 rounded font-medium ${methodColors[log.method] ?? "text-gray-400 bg-white/10"}`}>
												{log.method}
											</span>
										</td>
										<td className="px-4 py-2 font-mono text-gray-300 truncate max-w-0">
											<span title={log.url}>{shortenUrl(log.url)}</span>
											{log.error ? (
												<span className="ml-2 text-red-400">{log.error}</span>
											) : null}
										</td>
										<td className={`px-4 py-2 text-right font-mono ${statusColor(log.status)}`}>
											{log.status}
										</td>
										<td className={`px-4 py-2 text-right font-mono ${durationColor(log.durationMs)}`}>
											{log.durationMs}ms
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>
		</div>
	);
}
