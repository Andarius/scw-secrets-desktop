import { useState } from "react";
import { Check, Copy, Download, ExternalLink, Loader2 } from "lucide-react";

import type { LatestRelease } from "../../../shared/models";
import { useInstallUpdate } from "../../hooks/useInstallUpdate";
import { api } from "../../lib/rpc";
import { UPDATE_COMMAND } from "../../lib/update-check";

// Install & restart when this install can update itself, otherwise the update command with
// Copy; plus a link to the release notes. Shared by the update banner and the Settings check.
export function UpdateActions({ release }: { release: LatestRelease }) {
	const [copied, setCopied] = useState(false);
	const { canInstall, installing, error, install } = useInstallUpdate();

	function copyCommand() {
		void navigator.clipboard.writeText(UPDATE_COMMAND).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}

	return (
		<>
			{canInstall ? (
				<button
					type="button"
					onClick={() => void install(release.version)}
					disabled={installing}
					className="flex items-center gap-1.5 px-2.5 py-1 shrink-0 bg-cyan-500/20 border border-cyan-500/40 rounded-md hover:bg-cyan-500/30 transition-colors text-cyan-200 font-medium disabled:opacity-60"
				>
					{installing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
					<span>{installing ? "Installing…" : "Install & restart"}</span>
				</button>
			) : null}
			{!canInstall || error ? (
				<>
					<code className="min-w-0 truncate px-2 py-0.5 rounded bg-black/30 border border-white/10 font-mono text-gray-300" title={UPDATE_COMMAND}>
						{UPDATE_COMMAND}
					</code>
					<button
						type="button"
						onClick={copyCommand}
						className="flex items-center gap-1.5 px-2 py-1 shrink-0 bg-white/5 border border-white/10 rounded-md hover:bg-white/10 transition-colors text-gray-300"
					>
						{copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
						<span>{copied ? "Copied" : "Copy"}</span>
					</button>
				</>
			) : null}
			{error ? <span className="min-w-0 truncate text-red-300" title={error}>Install failed: {error}</span> : null}
			<button
				type="button"
				onClick={() => void api.openExternal({ url: release.url })}
				className="flex items-center gap-1.5 px-2 py-1 shrink-0 text-cyan-300 hover:text-cyan-200 transition-colors"
			>
				<span>Release notes</span>
				<ExternalLink className="w-3 h-3" />
			</button>
		</>
	);
}
