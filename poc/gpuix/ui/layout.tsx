import { Select, SelectContent, SelectItem, SelectTrigger } from "@gpuix/react";
import type { ProfileSummary, Project } from "../../../src/shared/models";
import { Button, C, Icon, IconButton, T, XS, SM, BASE } from "./theme";

type Option = { value: string; label: string; hint?: string };

function HeaderSelect({ label, value, options, onChange, testId }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; testId: string }) {
	const selected = options.find((option) => option.value === value);
	return (
		<Select value={value} onValueChange={onChange} disabled={options.length === 0}>
			<SelectTrigger
				testId={testId}
				style={({ open }) => ({
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					paddingLeft: 12,
					paddingRight: 12,
					paddingTop: 8,
					paddingBottom: 8,
					borderRadius: 8,
					borderWidth: 1,
					borderColor: C.w10,
					backgroundColor: open ? C.w10 : C.w5,
					cursor: "pointer",
					hover: { backgroundColor: C.w10 },
				})}
			>
				<T size={10} color={C.gray500} upper>{label}</T>
				<T size={SM} truncate style={{ maxWidth: 180 }}>{selected?.label ?? "—"}</T>
				<Icon name="ChevronDown" size={14} color={C.gray500} />
			</SelectTrigger>
			<SelectContent
				sideOffset={6}
				style={{ minWidth: 180, maxWidth: 280, maxHeight: 320, padding: 4, borderRadius: 8, borderWidth: 1, borderColor: C.w10, backgroundColor: C.modal }}
			>
				{options.map((option) => (
					<SelectItem
						key={option.value}
						value={option.value}
						testId={`${testId}-${option.label}`}
						style={({ highlighted }) => ({
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							gap: 8,
							paddingLeft: 12,
							paddingRight: 12,
							paddingTop: 6,
							paddingBottom: 6,
							borderRadius: 6,
							cursor: "pointer",
							backgroundColor: highlighted ? C.w10 : undefined,
						})}
					>
						<T size={SM} color={option.value === value ? C.cyan300 : C.gray200} truncate>{option.label}</T>
						{option.hint ? <T size={10} color={C.gray500} upper>{option.hint}</T> : null}
						<div style={{ flexGrow: 1 }} />
						{option.value === value ? <Icon name="Check" size={14} color={C.cyan300} /> : null}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

type HeaderProps = {
	profiles: ProfileSummary[];
	profile: string;
	onProfileChange: (profile: string) => void;
	projects: Project[];
	project: Project | null;
	onProjectChange: (projectId: string) => void;
	onRefresh: () => void;
};

export function Header({ profiles, profile, onProfileChange, projects, project, onProjectChange, onRefresh }: HeaderProps) {
	const summary = profiles.find((entry) => entry.name === profile) ?? null;
	return (
		<div style={{ display: "flex", flexDirection: "column", borderBottomWidth: 1, borderColor: C.w10, backgroundColor: C.panel }}>
			<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}>
				<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
					<Icon name="Lock" size={16} color={C.cyan400} />
					<T size={SM} weight={500}>SCW SECRETS</T>
				</div>
				<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
					<HeaderSelect
						label="Profile"
						testId="profile"
						value={profile}
						onChange={onProfileChange}
						options={profiles.map((entry) => ({ value: entry.name, label: entry.name, hint: entry.isActive ? "active" : undefined }))}
					/>
					<T color={C.gray600}>/</T>
					<HeaderSelect
						label="Project"
						testId="project"
						value={project?.id ?? ""}
						onChange={onProjectChange}
						options={projects.map((entry) => ({ value: entry.id, label: entry.name }))}
					/>
				</div>
				<div style={{ flexGrow: 1 }} />
				<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
					<IconButton name="RefreshCw" onClick={onRefresh} testId="refresh" />
					<IconButton name="Settings" />
				</div>
			</div>
			<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 24, paddingLeft: 24, paddingRight: 24, paddingBottom: 10 }}>
				<div style={{ display: "flex", flexDirection: "row" }}>
					<T size={XS} color={C.gray400}>PROJECT ID: </T>
					<T size={XS} color={C.gray500} mono>{project?.id ?? "—"}</T>
				</div>
				<T size={XS} color={C.gray600}>•</T>
				<div style={{ display: "flex", flexDirection: "row" }}>
					<T size={XS} color={C.gray400}>ACCESS: </T>
					<T size={XS} color={C.gray500} mono>{summary?.accessKey || "Secret-key only"}</T>
				</div>
			</div>
		</div>
	);
}

const STORAGE_PRICE_PER_VERSION_EUR = 0.04;
const API_CALLS_PRICE_PER_10K_EUR = 0.03;
const euro = (value: number) => `€${value.toFixed(2)}`;

function Tile({ value, label, sub, accent }: { value: string; label: string; sub: string; accent?: boolean }) {
	return (
		<div
			style={{
				flexGrow: 1,
				flexBasis: 0,
				minWidth: 0,
				display: "flex",
				flexDirection: "column",
				paddingLeft: 14,
				paddingRight: 14,
				paddingTop: 8,
				paddingBottom: 8,
				borderRadius: 8,
				borderWidth: 1,
				borderColor: accent ? C.cyan30 : C.w10,
				backgroundColor: accent ? C.cyan7 : "rgba(255, 255, 255, 0.03)",
			}}
		>
			<div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
				<T size={BASE} weight={700} color={accent ? C.cyan300 : C.white}>{value}</T>
				<T size={XS} color={C.gray400} style={{ paddingBottom: 2 }}>{label}</T>
				{accent ? <div style={{ flexGrow: 1 }} /> : null}
				{accent ? <Icon name="Scissors" size={12} color={C.cyan300} style={{ marginBottom: 4 }} /> : null}
			</div>
			<T size={10.5} color={C.gray500} truncate>{sub}</T>
		</div>
	);
}

type StatsProps = { filtered: number; total: number; visibleVersions: number; totalVersions: number; visiblePrunable: number; totalPrunable: number };

export function StatsCards({ filtered, total, visibleVersions, totalVersions, visiblePrunable, totalPrunable }: StatsProps) {
	return (
		<div style={{ display: "flex", flexDirection: "row", gap: 10, minWidth: 0 }}>
			<Tile value={String(filtered)} label="secrets" sub={`${total} fetched from the selected project`} />
			<Tile value={String(visibleVersions)} label="versions" sub={`${totalVersions} stored revisions in the selected project`} />
			<Tile
				value={String(visiblePrunable)}
				label="reclaimable"
				sub={`${totalPrunable} older revisions · storage ${euro(totalVersions * STORAGE_PRICE_PER_VERSION_EUR)}/mo at ${euro(STORAGE_PRICE_PER_VERSION_EUR)}/version-mo · Keep Latest saves ${euro(totalPrunable * STORAGE_PRICE_PER_VERSION_EUR)}/mo (API ${euro(API_CALLS_PRICE_PER_10K_EUR)}/10k)`}
				accent={totalPrunable > 0}
			/>
		</div>
	);
}

export function PaneRail({ side, label, onOpen }: { side: "left" | "right"; label: string; onOpen: () => void }) {
	return (
		<Button
			testId={`rail-${label}`}
			onClick={onOpen}
			style={{ height: "100%", width: 28, flexDirection: "column", gap: 12, paddingTop: 12, borderRadius: 12, borderWidth: 1, borderColor: C.w10, backgroundColor: C.panel }}
			hover={{ backgroundColor: C.w5, borderColor: C.cyan30 }}
		>
			<Icon name={side === "left" ? "PanelLeftOpen" : "PanelRightOpen"} size={16} color={C.gray500} />
			{/* no vertical writing mode in GPUI: one letter per line */}
			<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
				{label.toUpperCase().split("").map((letter, index) => (
					<T key={index} size={10} color={C.gray600}>{letter}</T>
				))}
			</div>
		</Button>
	);
}
