import type { ReactNode } from "react";
import type { EventPayload, StyleDesc } from "@gpuix/react";
import {
	Check,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Clock,
	Copy,
	CopyPlus,
	Eye,
	FolderTree,
	Globe,
	Key,
	Lock,
	PanelLeftClose,
	PanelLeftOpen,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	RefreshCw,
	Scissors,
	Search,
	Settings,
	Share2,
	Tag,
	Trash2,
	X,
} from "lucide-static";

// Tailwind colours used by src/mainview, as GPUI has no class names.
export const C = {
	page: "#0a0a0a",
	panel: "rgba(0, 0, 0, 0.4)",
	tableHead: "#0d0d0d",
	modal: "#141414",
	white: "#ffffff",
	w5: "rgba(255, 255, 255, 0.05)",
	w10: "rgba(255, 255, 255, 0.1)",
	w15: "rgba(255, 255, 255, 0.15)",
	gray200: "#e5e7eb",
	gray300: "#d1d5db",
	gray400: "#9ca3af",
	gray500: "#6b7280",
	gray600: "#4b5563",
	cyan200: "#a5f3fc",
	cyan300: "#67e8f9",
	cyan400: "#22d3ee",
	cyan10: "rgba(6, 182, 212, 0.1)",
	cyan15: "rgba(6, 182, 212, 0.15)",
	cyan20: "rgba(6, 182, 212, 0.2)",
	cyan25: "rgba(6, 182, 212, 0.25)",
	cyan30: "rgba(6, 182, 212, 0.3)",
	cyan40: "rgba(6, 182, 212, 0.4)",
	cyan7: "rgba(6, 182, 212, 0.07)",
	emerald300: "#6ee7b7",
	emerald10: "rgba(16, 185, 129, 0.1)",
	emerald20: "rgba(16, 185, 129, 0.2)",
	emerald30: "rgba(16, 185, 129, 0.3)",
	amber300: "#fcd34d",
	amber10: "rgba(245, 158, 11, 0.1)",
	amber20: "rgba(245, 158, 11, 0.2)",
	amber30: "rgba(245, 158, 11, 0.3)",
	red300: "#fca5a5",
	red400: "#f87171",
	red10: "rgba(239, 68, 68, 0.1)",
	red30: "rgba(239, 68, 68, 0.3)",
	purple400: "#c084fc",
	teal400: "#2dd4bf",
	blue400: "#60a5fa",
};

// The app asks for Space Grotesk, then IBM Plex Sans; GPUI ships IBM Plex Sans and Lilex.
export const SANS = "IBM Plex Sans";
export const MONO = "Lilex";

export const XS = 12;
export const SM = 14;
export const BASE = 16;

type TextProps = {
	children: ReactNode;
	size?: number;
	color?: string;
	mono?: boolean;
	weight?: number;
	upper?: boolean;
	truncate?: boolean;
	style?: StyleDesc;
	testId?: string;
};

// GPUI does not inherit text colour, so every run of text goes through here.
export function T({ children, size = SM, color = C.white, mono, weight, upper, truncate, style, testId }: TextProps) {
	const content = upper && typeof children === "string" ? children.toUpperCase() : children;
	return (
		<text
			testId={testId}
			style={{
				fontSize: size,
				fontFamily: mono ? MONO : SANS,
				color,
				...(weight ? { fontWeight: weight } : {}),
				...(truncate ? { whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", minWidth: 0 } : {}),
				...style,
			}}
		>
			{content}
		</text>
	);
}

// Named imports keep the other lucide icons out of the bundle.
const icons = { Check, ChevronDown, ChevronRight, ChevronUp, Clock, Copy, CopyPlus, Eye, FolderTree, Globe, Key, Lock, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pencil, RefreshCw, Scissors, Search, Settings, Share2, Tag, Trash2, X };
export type IconName = keyof typeof icons;

export function Icon({ name, size = 16, color = C.gray400, style }: { name: IconName; size?: number; color?: string; style?: StyleDesc }) {
	return <svg source={icons[name]} style={{ width: size, height: size, flexShrink: 0, color, ...style }} />;
}

export const panelStyle: StyleDesc = {
	display: "flex",
	flexDirection: "column",
	height: "100%",
	minHeight: 0,
	minWidth: 0,
	overflow: "hidden",
	borderRadius: 12,
	borderWidth: 1,
	borderColor: C.w10,
	backgroundColor: C.panel,
};

export const panelHeaderStyle: StyleDesc = { padding: 16, borderBottomWidth: 1, borderColor: C.w10 };

type ButtonProps = {
	children: ReactNode;
	onClick?: (event: EventPayload) => void;
	disabled?: boolean;
	style?: StyleDesc;
	hover?: StyleDesc;
	testId?: string;
};

// gpuix 0.10.0 has no <button>; a clickable div with the app's hover/disabled states.
export function Button({ children, onClick, disabled, style, hover, testId }: ButtonProps) {
	return (
		<div
			testId={testId}
			onClick={disabled ? undefined : onClick}
			style={{
				display: "flex",
				flexDirection: "row",
				alignItems: "center",
				cursor: disabled ? "default" : "pointer",
				...(disabled ? { opacity: 0.5 } : {}),
				...style,
				...(disabled ? {} : { hover: { backgroundColor: C.w10, ...hover } }),
			}}
		>
			{children}
		</div>
	);
}

export function IconButton({ name, onClick, size = 16, padding = 8, bordered = true, testId }: { name: IconName; onClick?: () => void; size?: number; padding?: number; bordered?: boolean; testId?: string }) {
	return (
		<Button
			testId={testId}
			onClick={onClick}
			style={{
				padding,
				borderRadius: bordered ? 8 : 4,
				...(bordered ? { backgroundColor: C.w5, borderWidth: 1, borderColor: C.w10 } : {}),
			}}
		>
			<Icon name={name} size={size} color={bordered ? C.gray400 : C.gray500} />
		</Button>
	);
}

export function Pill({ children, active, onClick, testId }: { children: ReactNode; active: boolean; onClick?: () => void; testId?: string }) {
	return (
		<Button
			testId={testId}
			onClick={onClick}
			style={{
				gap: 4,
				paddingLeft: 12,
				paddingRight: 12,
				paddingTop: 6,
				paddingBottom: 6,
				borderRadius: 6,
				borderWidth: 1,
				backgroundColor: active ? C.cyan20 : C.w5,
				borderColor: active ? C.cyan30 : C.w10,
			}}
			hover={active ? { backgroundColor: C.cyan20 } : undefined}
		>
			{children}
		</Button>
	);
}

export function formatSecretType(type?: string): string {
	if (!type) return "—";
	const labels: Record<string, string> = {
		opaque: "Opaque",
		basic_credentials: "Basic Creds",
		database_credentials: "DB Creds",
		key_value: "Key/Value",
		ssh_key: "SSH Key",
	};
	return labels[type] ?? type.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function StatusBadge({ status, strong }: { status: string; strong?: boolean }) {
	const ready = status === "ready";
	return (
		<div
			style={{
				paddingLeft: 8,
				paddingRight: 8,
				paddingTop: 4,
				paddingBottom: 4,
				borderRadius: 4,
				borderWidth: 1,
				borderColor: ready ? C.emerald30 : C.amber30,
				backgroundColor: ready ? (strong ? C.emerald20 : C.emerald10) : strong ? C.amber20 : C.amber10,
			}}
		>
			<T size={XS} weight={500} color={ready ? C.emerald300 : C.amber300}>{status.toUpperCase()}</T>
		</div>
	);
}
