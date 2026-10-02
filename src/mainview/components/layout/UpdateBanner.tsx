import { useState } from "react";
import { ArrowUpCircle, Check, Copy, ExternalLink, X } from "lucide-react";

import type { LatestRelease } from "../../../shared/models";
import { api } from "../../lib/rpc";
import { UPDATE_COMMAND } from "../../lib/update-check";

type UpdateBannerProps = {
	release: LatestRelease;
	currentVersion: string;
	onDismiss: () => void;
};

export function UpdateBanner({ release, currentVersion, onDismiss }: UpdateBannerProps) {
	const [copied, setCopied] = useState(false);

	function copyCommand() {
		void navigator.clipboard.writeText(UPDATE_COMMAND).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}

	return (
		<div className="flex items-center gap-3 px-6 py-2 bg-cyan-500/10 border-b border-cyan-500/20 text-xs">
			<ArrowUpCircle className="w-4 h-4 text-cyan-300 shrink-0" />
			<span className="text-cyan-100 shrink-0">
				Version {release.version} is available <span className="text-gray-400">(you have {currentVersion})</span>
			</span>
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
			<button
				type="button"
				onClick={() => void api.openExternal({ url: release.url })}
				className="flex items-center gap-1.5 px-2 py-1 shrink-0 text-cyan-300 hover:text-cyan-200 transition-colors"
			>
				<span>Release notes</span>
				<ExternalLink className="w-3 h-3" />
			</button>
			<button
				type="button"
				onClick={onDismiss}
				title="Dismiss until the next version"
				className="ml-auto p-1 shrink-0 hover:bg-white/10 rounded transition-colors"
			>
				<X className="w-3.5 h-3.5 text-gray-400" />
			</button>
		</div>
	);
}
