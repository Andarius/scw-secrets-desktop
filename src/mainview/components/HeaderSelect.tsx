import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string };

type HeaderSelectProps = {
	label: string;
	value: string;
	options: SelectOption[];
	onChange: (value: string) => void;
	disabled?: boolean;
	maxWidth?: string;
};

export function HeaderSelect({ label, value, options, onChange, disabled, maxWidth = "max-w-[200px]" }: HeaderSelectProps) {
	const [open, setOpen] = useState(false);
	const [highlighted, setHighlighted] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const selected = options.find((o) => o.value === value);

	useEffect(() => {
		if (!open) return;
		function handlePointerDown(e: MouseEvent) {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		listRef.current?.children[highlighted]?.scrollIntoView({ block: "nearest" });
	}, [open, highlighted]);

	function openMenu() {
		setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
		setOpen(true);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (!open) {
			if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
				e.preventDefault();
				openMenu();
			}
			return;
		}
		switch (e.key) {
			case "Escape":
				e.preventDefault();
				setOpen(false);
				break;
			case "ArrowDown":
				e.preventDefault();
				setHighlighted((i) => Math.min(i + 1, options.length - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlighted((i) => Math.max(i - 1, 0));
				break;
			case "Home":
				e.preventDefault();
				setHighlighted(0);
				break;
			case "End":
				e.preventDefault();
				setHighlighted(options.length - 1);
				break;
			case "Enter":
			case " ":
				e.preventDefault();
				if (options[highlighted]) {
					onChange(options[highlighted].value);
					setOpen(false);
				}
				break;
		}
	}

	return (
		<div ref={rootRef} className="relative min-w-0">
			<button
				type="button"
				disabled={disabled}
				onClick={() => (open ? setOpen(false) : openMenu())}
				onKeyDown={handleKeyDown}
				aria-haspopup="listbox"
				aria-expanded={open}
				className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors min-w-0 disabled:opacity-50 disabled:pointer-events-none"
			>
				<span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
				<span className={`text-sm text-white truncate ${maxWidth}`}>{selected?.label ?? "—"}</span>
				<ChevronDown className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open ? (
				<div
					ref={listRef}
					role="listbox"
					className="absolute left-0 top-full mt-1.5 z-50 min-w-full w-max max-w-[280px] max-h-[320px] overflow-y-auto bg-[#141414] border border-white/10 rounded-lg shadow-2xl p-1"
				>
					{options.map((option, i) => (
						<button
							key={option.value}
							type="button"
							role="option"
							aria-selected={option.value === value}
							onClick={() => {
								onChange(option.value);
								setOpen(false);
							}}
							onMouseEnter={() => setHighlighted(i)}
							className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors ${
								i === highlighted ? "bg-white/10" : ""
							} ${option.value === value ? "text-cyan-300" : "text-gray-200"}`}
						>
							<span className="truncate">{option.label}</span>
							{option.hint ? <span className="text-[10px] text-gray-500 uppercase tracking-wider shrink-0">{option.hint}</span> : null}
							{option.value === value ? <Check className="w-3.5 h-3.5 ml-auto shrink-0" /> : null}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
