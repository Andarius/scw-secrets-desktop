import { PanelLeftOpen, PanelRightOpen } from "lucide-react";

type PaneRailProps = {
	side: "left" | "right";
	label: string;
	onOpen: () => void;
};

// Slim rail left in place of a folded pane — the restore control stays where the pane is.
export function PaneRail({ side, label, onOpen }: PaneRailProps) {
	const Icon = side === "left" ? PanelLeftOpen : PanelRightOpen;
	return (
		<button
			type="button"
			onClick={onOpen}
			title={`Show ${label} ( ${side === "left" ? "[" : "]"} )`}
			className="h-full w-7 rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 hover:border-cyan-500/30 transition-colors flex flex-col items-center gap-3 pt-3 group"
		>
			<Icon className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 shrink-0" />
			<span
				className="text-[10px] uppercase tracking-widest text-gray-600 group-hover:text-gray-400"
				style={{ writingMode: "vertical-rl" }}
			>
				{label}
			</span>
		</button>
	);
}
