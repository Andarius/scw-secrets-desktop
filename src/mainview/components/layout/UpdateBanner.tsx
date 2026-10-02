import { ArrowUpCircle, X } from "lucide-react";

import type { LatestRelease } from "../../../shared/models";
import { UpdateActions } from "./UpdateActions";

type UpdateBannerProps = {
	release: LatestRelease;
	currentVersion: string;
	onDismiss: () => void;
};

export function UpdateBanner({ release, currentVersion, onDismiss }: UpdateBannerProps) {
	return (
		<div className="flex items-center gap-3 px-6 py-2 bg-cyan-500/10 border-b border-cyan-500/20 text-xs">
			<ArrowUpCircle className="w-4 h-4 text-cyan-300 shrink-0" />
			<span className="text-cyan-100 shrink-0">
				Version {release.version} is available <span className="text-gray-400">(you have {currentVersion})</span>
			</span>
			<UpdateActions release={release} />
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
