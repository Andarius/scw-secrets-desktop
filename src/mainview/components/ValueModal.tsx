import { useEffect } from "react";
import { Copy, X } from "lucide-react";

type ValueViewProps = {
	title: string;
	values: { name: string; value: string }[];
	onClose: () => void;
};

function CopyButton({ text }: { text: string }) {
	return (
		<button
			type="button"
			onClick={() => navigator.clipboard.writeText(text)}
			className="p-1.5 hover:bg-white/10 rounded transition-colors flex-shrink-0"
		>
			<Copy className="w-3.5 h-3.5 text-gray-400" />
		</button>
	);
}

export function ValueView({ title, values, onClose }: ValueViewProps) {
	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		>
			<div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl w-[90%] max-h-[85vh] flex flex-col overflow-hidden">
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
					<h3 className="text-sm font-medium text-gray-300">{title}</h3>
					<div className="flex items-center gap-2">
						{values.length > 1 ? (
							<button
								type="button"
								onClick={() => {
									const text = values.map((v) => `${v.name}=${v.value}`).join("\n");
									navigator.clipboard.writeText(text);
								}}
								className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
							>
								<Copy className="w-3 h-3 text-cyan-400" />
								<span>Copy All as KEY=VALUE</span>
							</button>
						) : null}
						<button
							type="button"
							onClick={onClose}
							className="p-1.5 hover:bg-white/10 rounded transition-colors"
						>
							<X className="w-4 h-4 text-gray-400" />
						</button>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-5 space-y-3">
					{values.map((entry) => (
						<div key={entry.name} className="rounded-lg bg-white/5 border border-white/5 p-4">
							<div className="flex items-center justify-between mb-2">
								<span className="text-xs text-gray-400 font-medium">{entry.name}</span>
								<CopyButton text={entry.value} />
							</div>
							<pre className="text-sm text-cyan-200 font-mono whitespace-pre-wrap break-all">
								{entry.value}
							</pre>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
