import type { ReactNode } from "react";
import type { Secret } from "../../../src/shared/models";
import { Button, C, Icon, IconButton, StatusBadge, T, XS, SM, BASE, formatSecretType, panelHeaderStyle, panelStyle, type IconName } from "./theme";

function formatDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...(wide ? { width: "100%" } : { flexGrow: 1, flexBasis: 0 }) }}>
			<T size={XS} color={C.gray400}>{label.toUpperCase()}</T>
			{children}
		</div>
	);
}

// Copy needs a clipboard API that gpuix 0.10.0 does not expose to JS; the icon is kept for parity.
function CopyIcon() {
	return <Icon name="Copy" size={12} color={C.gray400} />;
}

function Action({ icon, color, label, onClick, primary, testId }: { icon: IconName; color: string; label: string; onClick?: () => void; primary?: boolean; testId?: string }) {
	return (
		<Button
			testId={testId}
			onClick={onClick}
			disabled={!onClick}
			style={{
				width: "100%",
				gap: 12,
				paddingLeft: 16,
				paddingRight: 16,
				paddingTop: primary ? 14 : 12,
				paddingBottom: primary ? 14 : 12,
				borderRadius: 8,
				borderWidth: 1,
				borderColor: primary ? C.cyan40 : C.w10,
				backgroundColor: primary ? C.cyan15 : C.w5,
			}}
			hover={primary ? { backgroundColor: C.cyan25 } : undefined}
		>
			<Icon name={icon} size={16} color={color} />
			<T size={SM} weight={primary ? 500 : undefined} color={primary ? C.cyan200 : C.white}>{label}</T>
		</Button>
	);
}

function PanelHeader({ badge, onCollapse }: { badge: ReactNode; onCollapse: () => void }) {
	return (
		<div style={panelHeaderStyle}>
			<div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
				<T size={SM} weight={500} color={C.gray400}>DETAIL</T>
				<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
					{badge}
					<IconButton name="PanelRightClose" size={14} padding={4} bordered={false} onClick={onCollapse} testId="collapse-detail" />
				</div>
			</div>
			<T size={BASE} weight={500}>Selection</T>
		</div>
	);
}

type DetailProps = { secrets: Secret[]; onView: () => void; onCollapse: () => void };

export function DetailPanel({ secrets, onView, onCollapse }: DetailProps) {
	if (secrets.length === 0) {
		return (
			<div style={{ ...panelStyle, alignItems: "center", justifyContent: "center", padding: 32 }}>
				<div style={{ position: "absolute", top: 12, right: 12 }}>
					<IconButton name="PanelRightClose" size={14} padding={4} bordered={false} onClick={onCollapse} />
				</div>
				<div style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.w5, alignItems: "center", justifyContent: "center", display: "flex", marginBottom: 16 }}>
					<Icon name="Key" size={32} color={C.gray600} />
				</div>
				<T size={SM} color={C.gray500}>Select a secret to view details</T>
			</div>
		);
	}

	if (secrets.length > 1) {
		return (
			<div style={panelStyle}>
				<PanelHeader
					onCollapse={onCollapse}
					badge={
						<div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, borderWidth: 1, borderColor: C.cyan30, backgroundColor: C.cyan20 }}>
							<T size={XS} weight={500} color={C.cyan300}>{`${secrets.length} SELECTED`}</T>
						</div>
					}
				/>
				<div style={{ flexGrow: 1, minHeight: 0, overflowY: "scroll", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						{secrets.map((secret) => (
							<div key={secret.id} style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: C.w5, backgroundColor: C.w5 }}>
								<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
									<T size={SM} truncate>{secret.name}</T>
									<T size={XS} color={C.gray500} mono truncate>{secret.path}</T>
								</div>
								<T size={XS} color={C.gray500}>{`${secret.version_count} versions`}</T>
							</div>
						))}
					</div>
					<div style={{ paddingTop: 16, borderTopWidth: 1, borderColor: C.w10 }}>
						<Action primary icon="Eye" color={C.cyan200} label="View Values" onClick={onView} testId="view-value" />
					</div>
				</div>
			</div>
		);
	}

	const [secret] = secrets;
	return (
		<div style={panelStyle}>
			<PanelHeader onCollapse={onCollapse} badge={<StatusBadge status={secret.status} strong />} />
			<div style={{ flexGrow: 1, minHeight: 0, overflowY: "scroll" }}>
				<div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 24 }}>
					<div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 8, borderWidth: 1, borderColor: C.cyan20, backgroundColor: C.cyan10 }}>
						<T size={SM} weight={500} color={C.cyan300} testId="detail-name">{secret.name}</T>
						<CopyIcon />
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						<Field label="Secret ID" wide>
							<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
								<T size={XS} color={C.gray300} mono>{secret.id}</T>
								<CopyIcon />
							</div>
						</Field>
						<div style={{ display: "flex", flexDirection: "row", gap: 16 }}>
							<Field label="Path">
								<div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
									<T size={SM} color={C.gray300} mono>{secret.path}</T>
									<CopyIcon />
								</div>
							</Field>
							<Field label="Type"><T size={SM} color={C.gray300}>{formatSecretType(secret.type)}</T></Field>
						</div>
						<div style={{ display: "flex", flexDirection: "row", gap: 16 }}>
							<Field label="Created"><T size={SM} color={C.gray300}>{formatDate(secret.created_at)}</T></Field>
							<Field label="Updated"><T size={SM} color={C.gray300}>{formatDate(secret.updated_at)}</T></Field>
						</div>
						<div style={{ display: "flex", flexDirection: "row", gap: 16 }}>
							<Field label="Versions"><T size={SM} color={C.gray300}>{String(secret.version_count)}</T></Field>
							<div style={{ flexGrow: 1, flexBasis: 0 }} />
						</div>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						<div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
							<T size={XS} color={C.gray400}>TAGS</T>
							<Icon name="Pencil" size={12} color={C.gray500} />
						</div>
						<div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
							{secret.tags.length > 0 ? (
								secret.tags.map((tag) => (
									<div key={tag} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, borderWidth: 1, borderColor: C.w10, backgroundColor: C.w5 }}>
										<T size={XS} color={C.gray300}>{tag}</T>
									</div>
								))
							) : (
								<T size={XS} color={C.gray500}>No tags</T>
							)}
						</div>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 16, borderTopWidth: 1, borderColor: C.w10 }}>
						<div style={{ paddingBottom: 12, marginBottom: 4, borderBottomWidth: 1, borderColor: C.w10 }}>
							<Action primary icon="Eye" color={C.cyan200} label="View Value" onClick={onView} testId="view-value" />
						</div>
						{/* writes and links are outside the POC's read-only slice */}
						<Action icon="Clock" color={C.purple400} label="Version History" />
						<Action icon="CopyPlus" color={C.teal400} label="Duplicate Secret" />
						<Action icon="Share2" color={C.blue400} label="Share Secret" />
						<Action icon="Globe" color={C.gray400} label="Open in Console" />
						<Action icon="Trash2" color={C.red400} label="Delete Secret" />
					</div>
				</div>
			</div>
		</div>
	);
}
