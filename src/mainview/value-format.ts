import { parse as parseTomlStrict } from "smol-toml";

export type ValueFormat = "json" | "toml" | "env" | "plain";
export type EmbeddedFormat = "json" | "toml" | null;

export type Token = {
	type: "comment" | "section" | "key" | "punct" | "string" | "number" | "bool" | "text";
	text: string;
};

// JSON only counts as JSON when it's an object/array — a bare "42" stays plain.
export function parseJsonContainer(value: string): unknown | undefined {
	const trimmed = value.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
		return undefined;
	}
	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return undefined;
	}
}

const TOML_SECTION_RE = /^\[[^\]]+\]\s*(#.*)?$/;
const TOML_KV_RE = /^[A-Za-z0-9_.-]+(\s*\.\s*[A-Za-z0-9_.-]+)*\s*=\s*\S.*$/;
const ENV_LINE_RE = /^(export\s+)?[A-Za-z_][A-Za-z0-9_]*=.*$/;

function contentLines(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"));
}

// Conservative: every content line must fit the grammar, and there must be a
// section header or a spaced `key = value` so plain KEY=VALUE stays env.
export function looksLikeToml(value: string): boolean {
	const lines = contentLines(value);
	if (lines.length === 0) {
		return false;
	}
	let sections = 0;
	let spacedKv = 0;
	for (const line of lines) {
		if (TOML_SECTION_RE.test(line)) {
			sections++;
			continue;
		}
		if (!TOML_KV_RE.test(line)) {
			return false;
		}
		if (/^[^=]*\s=\s/.test(line)) {
			spacedKv++;
		}
	}
	return sections > 0 || spacedKv > 0;
}

export function looksLikeEnv(value: string): boolean {
	const lines = contentLines(value);
	return lines.length > 0 && lines.every((line) => ENV_LINE_RE.test(line));
}

export function detectFormat(value: string): ValueFormat {
	if (parseJsonContainer(value) !== undefined) {
		return "json";
	}
	if (looksLikeToml(value)) {
		return "toml";
	}
	if (looksLikeEnv(value)) {
		return "env";
	}
	return "plain";
}

// A JSON string field can itself hold JSON (service-account keys) or TOML (config
// blobs); embedded TOML needs at least one newline so short strings stay strings.
export function detectEmbedded(value: string): EmbeddedFormat {
	if (parseJsonContainer(value) !== undefined) {
		return "json";
	}
	if (value.includes("\n") && looksLikeToml(value)) {
		return "toml";
	}
	return null;
}

const VALUE_TOKEN_RE =
	/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\btrue\b|\bfalse\b)|([+-]?(?:\d[\d_]*)(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?(?:[-:TZ.\d]*)?)|([[\]{},=])|(\s+)|([^"'\s[\]{},=]+)/g;

function tokenizeRhs(rhs: string): Token[] {
	const tokens: Token[] = [];
	for (const match of rhs.matchAll(VALUE_TOKEN_RE)) {
		const [, str, bool, num, punct, space, rest] = match;
		if (str !== undefined) tokens.push({ type: "string", text: str });
		else if (bool !== undefined) tokens.push({ type: "bool", text: bool });
		else if (num !== undefined) tokens.push({ type: "number", text: num });
		else if (punct !== undefined) tokens.push({ type: "punct", text: punct });
		else if (space !== undefined) tokens.push({ type: "text", text: space });
		else if (rest !== undefined) tokens.push({ type: "text", text: rest });
	}
	return tokens;
}

function splitTrailingComment(line: string): [string, string | null] {
	// good enough for highlighting: a # outside quotes starts a comment
	let inString: string | null = null;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inString) {
			if (ch === "\\") i++;
			else if (ch === inString) inString = null;
		} else if (ch === '"' || ch === "'") {
			inString = ch;
		} else if (ch === "#") {
			return [line.slice(0, i), line.slice(i)];
		}
	}
	return [line, null];
}

export function tokenizeTomlLine(line: string): Token[] {
	const trimmed = line.trim();
	if (!trimmed) {
		return [{ type: "text", text: "" }];
	}
	if (trimmed.startsWith("#")) {
		return [{ type: "comment", text: line }];
	}
	const indent = line.slice(0, line.length - line.trimStart().length);
	const tokens: Token[] = indent ? [{ type: "text", text: indent }] : [];
	const [code, comment] = splitTrailingComment(line.trimStart());

	const sectionMatch = code.trim().match(/^(\[+)([^\]]+)(\]+)$/);
	if (sectionMatch) {
		tokens.push(
			{ type: "punct", text: sectionMatch[1] },
			{ type: "section", text: sectionMatch[2] },
			{ type: "punct", text: sectionMatch[3] },
		);
	} else {
		const eq = code.indexOf("=");
		if (eq > 0) {
			tokens.push(
				{ type: "key", text: code.slice(0, eq) },
				{ type: "punct", text: "=" },
				...tokenizeRhs(code.slice(eq + 1)),
			);
		} else {
			tokens.push({ type: "text", text: code });
		}
	}
	if (comment) {
		tokens.push({ type: "comment", text: ` ${comment.trim()}` });
	}
	return tokens.filter((token) => token.text.length > 0);
}

export function tokenizeEnvLine(line: string): Token[] {
	const trimmed = line.trim();
	if (!trimmed) {
		return [{ type: "text", text: "" }];
	}
	if (trimmed.startsWith("#")) {
		return [{ type: "comment", text: line }];
	}
	const eq = line.indexOf("=");
	if (eq <= 0) {
		return [{ type: "text", text: line }];
	}
	return [
		{ type: "key", text: line.slice(0, eq) },
		{ type: "punct", text: "=" },
		{ type: "string", text: line.slice(eq + 1) },
	];
}

export function tokenizeLines(value: string, format: "toml" | "env"): Token[][] {
	const tokenize = format === "toml" ? tokenizeTomlLine : tokenizeEnvLine;
	return value.split(/\r?\n/).map(tokenize);
}

// Regex-based JSON highlighter that survives invalid input (mid-edit drafts).
const JSONISH_TOKEN_RE =
	/("(?:[^"\\]|\\.)*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])|(\s+)|([^"{}[\],:\s]+)/g;

export function tokenizeJsonishLine(line: string): Token[] {
	const tokens: Token[] = [];
	for (const match of line.matchAll(JSONISH_TOKEN_RE)) {
		const [, str, colon, keyword, num, punct, space, rest] = match;
		if (str !== undefined) {
			tokens.push({ type: colon ? "key" : "string", text: str });
			if (colon) tokens.push({ type: "punct", text: colon });
		} else if (keyword !== undefined) tokens.push({ type: "bool", text: keyword });
		else if (num !== undefined) tokens.push({ type: "number", text: num });
		else if (punct !== undefined) tokens.push({ type: "punct", text: punct });
		else if (space !== undefined) tokens.push({ type: "text", text: space });
		else if (rest !== undefined) tokens.push({ type: "text", text: rest });
	}
	return tokens;
}

export type FlatRow = {
	key: string;
	value: string;
	kind: "string" | "number" | "bool" | "null";
};

// Dot-path rows for the table view; embedded JSON strings flatten in place.
export function flattenJson(node: unknown, prefix = ""): FlatRow[] {
	if (node === null || node === undefined) {
		return [{ key: prefix, value: "null", kind: "null" }];
	}
	if (typeof node === "string") {
		const embedded = parseJsonContainer(node);
		if (embedded !== undefined) {
			return flattenJson(embedded, prefix);
		}
		if (node.includes("\n") && looksLikeToml(node)) {
			return flattenToml(node).map((row) => ({ ...row, key: `${prefix}.${row.key}` }));
		}
		return [{ key: prefix, value: node, kind: "string" }];
	}
	if (typeof node === "number") {
		return [{ key: prefix, value: String(node), kind: "number" }];
	}
	if (typeof node === "boolean") {
		return [{ key: prefix, value: String(node), kind: "bool" }];
	}
	if (Array.isArray(node)) {
		if (node.length === 0) {
			return [{ key: prefix, value: "[]", kind: "null" }];
		}
		return node.flatMap((item, i) => flattenJson(item, `${prefix}[${i}]`));
	}
	const entries = Object.entries(node as Record<string, unknown>);
	if (entries.length === 0) {
		return [{ key: prefix, value: "{}", kind: "null" }];
	}
	return entries.flatMap(([key, item]) => flattenJson(item, prefix ? `${prefix}.${key}` : key));
}

function scalarKind(rhs: string): FlatRow["kind"] {
	if (/^(true|false)$/.test(rhs)) return "bool";
	if (/^[+-]?\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?$/.test(rhs)) return "number";
	return "string";
}

function unquote(value: string): string {
	const match = value.match(/^"(.*)"$/s) ?? value.match(/^'(.*)'$/s);
	return match ? match[1] : value;
}

export function unquoteDisplay(value: string): string {
	return unquote(value.trim());
}

export function flattenToml(value: string): FlatRow[] {
	const rows: FlatRow[] = [];
	let section = "";
	for (const raw of value.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const sectionMatch = line.match(/^\[+([^\]]+)\]+/);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			continue;
		}
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim();
		const [rhs] = splitTrailingComment(line.slice(eq + 1).trim());
		const trimmed = rhs.trim();
		rows.push({
			key: section ? `${section}.${key}` : key,
			value: unquote(trimmed),
			kind: scalarKind(trimmed),
		});
	}
	return rows;
}

// Editable rows: like FlatRow but with the path needed to write a new value back,
// crossing embedded-JSON/TOML string boundaries.
export type PathSeg = string | number | { embedded: "json" | "toml" };
export type EditableRow = FlatRow & { path: PathSeg[] };

function flattenJsonEditable(node: unknown, prefix: string, path: PathSeg[]): EditableRow[] {
	if (node === null || node === undefined) {
		return [{ key: prefix, value: "null", kind: "null", path }];
	}
	if (typeof node === "string") {
		const embedded = parseJsonContainer(node);
		if (embedded !== undefined) {
			return flattenJsonEditable(embedded, prefix, [...path, { embedded: "json" }]);
		}
		if (node.includes("\n") && looksLikeToml(node)) {
			return flattenToml(node).map((row) => ({
				...row,
				key: `${prefix}.${row.key}`,
				path: [...path, { embedded: "toml" }, row.key],
			}));
		}
		return [{ key: prefix, value: node, kind: "string", path }];
	}
	if (typeof node === "number") {
		return [{ key: prefix, value: String(node), kind: "number", path }];
	}
	if (typeof node === "boolean") {
		return [{ key: prefix, value: String(node), kind: "bool", path }];
	}
	if (Array.isArray(node)) {
		if (node.length === 0) {
			return [{ key: prefix, value: "[]", kind: "null", path }];
		}
		return node.flatMap((item, i) => flattenJsonEditable(item, `${prefix}[${i}]`, [...path, i]));
	}
	const entries = Object.entries(node as Record<string, unknown>);
	if (entries.length === 0) {
		return [{ key: prefix, value: "{}", kind: "null", path }];
	}
	return entries.flatMap(([key, item]) =>
		flattenJsonEditable(item, prefix ? `${prefix}.${key}` : key, [...path, key]),
	);
}

export function flattenEditable(value: string): EditableRow[] {
	const format = detectFormat(value);
	if (format === "json") {
		return flattenJsonEditable(parseJsonContainer(value), "", []);
	}
	if (format === "toml") {
		return flattenToml(value).map((row) => ({ ...row, path: [row.key] }));
	}
	if (format === "env") {
		return flattenEnv(value).map((row) => ({ ...row, path: [row.key] }));
	}
	return [];
}

// Keep the original scalar type when the edited text still fits it.
function coerceScalar(raw: string, original: unknown): unknown {
	const trimmed = raw.trim();
	if (typeof original === "number") {
		const n = Number(trimmed);
		return trimmed !== "" && Number.isFinite(n) ? n : raw;
	}
	if (typeof original === "boolean") {
		if (trimmed === "true") return true;
		if (trimmed === "false") return false;
		return raw;
	}
	if (original === null && trimmed === "null") {
		return null;
	}
	return raw;
}

function quoteTomlValue(raw: string, originalRhs: string): string {
	const trimmed = originalRhs.trim();
	if (trimmed.startsWith("'")) return `'${raw}'`;
	if (trimmed.startsWith('"')) return JSON.stringify(raw);
	// unquoted original (number/bool/date): keep unquoted while it still parses as one
	if (/^(true|false)$/.test(raw.trim()) || /^[+-]?\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?$/.test(raw.trim())) {
		return raw.trim();
	}
	return JSON.stringify(raw);
}

// Rewrite one `key = value` line in place — formatting, comments, and other lines untouched.
function tomlSetRhs(value: string, flatKey: string, render: (originalRhs: string) => string): string {
	const lines = value.split(/\r?\n/);
	let section = "";
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith("#")) continue;
		const sectionMatch = line.match(/^\[+([^\]]+)\]+/);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			continue;
		}
		const eq = lines[i].indexOf("=");
		if (eq <= 0) continue;
		const key = lines[i].slice(0, eq).trim();
		if ((section ? `${section}.${key}` : key) !== flatKey) continue;
		const rhs = lines[i].slice(eq + 1);
		const [code, comment] = splitTrailingComment(rhs);
		const leading = code.match(/^\s*/)?.[0] ?? " ";
		lines[i] = `${lines[i].slice(0, eq + 1)}${leading}${render(code)}${comment ? ` ${comment.trim()}` : ""}`;
		return lines.join("\n");
	}
	return value;
}

export function setTomlValue(value: string, flatKey: string, raw: string): string {
	return tomlSetRhs(value, flatKey, (code) => quoteTomlValue(raw, code));
}

export function setTomlArrayItems(value: string, flatKey: string, items: string[]): string {
	return tomlSetRhs(value, flatKey, () => `[${items.join(", ")}]`);
}

export function tomlRemoveKey(value: string, flatKey: string): string {
	const lines = value.split(/\r?\n/);
	let section = "";
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith("#")) continue;
		const sectionMatch = line.match(/^\[+([^\]]+)\]+/);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			continue;
		}
		const eq = lines[i].indexOf("=");
		if (eq <= 0) continue;
		const key = lines[i].slice(0, eq).trim();
		if ((section ? `${section}.${key}` : key) !== flatKey) continue;
		lines.splice(i, 1);
		return lines.join("\n");
	}
	return value;
}

function renderTomlRhs(raw: string): string {
	const trimmed = raw.trim();
	if (/^(true|false)$/.test(trimmed)) return trimmed;
	if (/^[+-]?\d[\d_]*(\.[\d_]*)?([eE][+-]?\d+)?$/.test(trimmed)) return trimmed;
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
	return JSON.stringify(raw);
}

// Insert `key = value` at the end of a section ("" = before the first section header).
export function tomlAddKey(value: string, section: string, key: string, raw: string): string {
	const lines = value.split(/\r?\n/);
	const rendered = `${key} = ${renderTomlRhs(raw)}`;

	if (!section) {
		let idx = lines.findIndex((line) => /^\[/.test(line.trim()));
		if (idx === -1) idx = lines.length;
		while (idx > 0 && !lines[idx - 1].trim()) idx--;
		lines.splice(idx, 0, rendered);
		return lines.join("\n");
	}

	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		const sectionMatch = lines[i].trim().match(/^\[+([^\]]+)\]+/);
		if (!sectionMatch) continue;
		if (start !== -1) {
			// first header after the target section — insert before it, above blank spacing
			let idx = i;
			while (idx > start + 1 && !lines[idx - 1].trim()) idx--;
			lines.splice(idx, 0, rendered);
			return lines.join("\n");
		}
		if (sectionMatch[1].trim() === section) start = i;
	}
	if (start === -1) {
		return `${value.replace(/\n$/, "")}\n\n[${section}]\n${rendered}\n`;
	}
	let idx = lines.length;
	while (idx > start + 1 && !lines[idx - 1].trim()) idx--;
	lines.splice(idx, 0, rendered);
	return lines.join("\n");
}

// Append an empty [section] header (no-op if the section already exists).
export function tomlAddSection(value: string, title: string): string {
	const exists = value.split(/\r?\n/).some((line) => {
		const match = line.trim().match(/^\[+([^\]]+)\]+/);
		return match?.[1].trim() === title;
	});
	if (exists) return value;
	return `${value.replace(/\n+$/, "")}\n\n[${title}]\n`;
}

export function envRemoveKey(value: string, flatKey: string): string {
	const lines = value.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith("#")) continue;
		const eq = lines[i].indexOf("=");
		if (eq <= 0) continue;
		if (lines[i].slice(0, eq).trim().replace(/^export\s+/, "") === flatKey) {
			lines.splice(i, 1);
			return lines.join("\n");
		}
	}
	return value;
}

export function setEnvValue(value: string, flatKey: string, raw: string): string {
	const lines = value.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith("#")) continue;
		const eq = lines[i].indexOf("=");
		if (eq <= 0) continue;
		if (lines[i].slice(0, eq).trim().replace(/^export\s+/, "") !== flatKey) continue;
		lines[i] = `${lines[i].slice(0, eq + 1)}${raw}`;
		return lines.join("\n");
	}
	return value;
}

function applyAtPath(node: unknown, path: PathSeg[], raw: string): unknown {
	if (path.length === 0) {
		return coerceScalar(raw, node);
	}
	const [seg, ...rest] = path;
	if (typeof seg === "object") {
		if (seg.embedded === "json") {
			const inner = JSON.parse(node as string) as unknown;
			return JSON.stringify(applyAtPath(inner, rest, raw));
		}
		return setTomlValue(node as string, rest[0] as string, raw);
	}
	if (Array.isArray(node)) {
		const copy = [...node];
		copy[seg as number] = applyAtPath(copy[seg as number], rest, raw);
		return copy;
	}
	const copy = { ...(node as Record<string, unknown>) };
	copy[seg as string] = applyAtPath(copy[seg as string], rest, raw);
	return copy;
}

// Structure model for the tree editor: groups (TOML sections / JSON object paths)
// holding typed leaves. Leaf/group paths feed applyStructOp for write-back.
export type StructureLeaf = {
	key: string; // short key within its group
	kind: "string" | "number" | "bool" | "null" | "array";
	value: string; // display text for scalars (or JSON text fallback)
	items?: string[]; // raw item texts for scalar arrays
	comment?: string;
	path: PathSeg[];
};

export type StructureGroup = {
	title: string; // "" = top level
	comment?: string;
	path: PathSeg[]; // container path — target for "add"
	leaves: StructureLeaf[];
};

export type StructOp =
	| { type: "set"; raw: string }
	| { type: "setArrayItems"; items: string[] }
	| { type: "remove" }
	| { type: "add"; key: string; raw: string }
	| { type: "addSection"; title: string };

function buildTomlStructure(text: string, basePath: PathSeg[], titlePrefix: string): StructureGroup[] {
	const groups: StructureGroup[] = [];
	let current: StructureGroup = { title: titlePrefix, path: [...basePath, ""], leaves: [] };
	groups.push(current);
	let section = "";

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith("#")) {
			if (current.leaves.length === 0 && !current.comment) current.comment = line;
			continue;
		}
		const sectionMatch = line.match(/^\[+([^\]]+)\]+\s*(#.*)?$/);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			current = {
				title: titlePrefix ? `${titlePrefix}.${section}` : section,
				comment: sectionMatch[2],
				path: [...basePath, section],
				leaves: [],
			};
			groups.push(current);
			continue;
		}
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim();
		const flatKey = section ? `${section}.${key}` : key;
		const [rhs, comment] = splitTrailingComment(line.slice(eq + 1).trim());
		const trimmed = rhs.trim();
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			current.leaves.push({
				key,
				kind: "array",
				value: trimmed,
				items: splitTopLevel(trimmed.slice(1, -1)).map((item) => item.trim()).filter(Boolean),
				comment: comment ?? undefined,
				path: [...basePath, flatKey],
			});
		} else {
			current.leaves.push({
				key,
				kind: scalarKind(trimmed),
				value: unquote(trimmed),
				comment: comment ?? undefined,
				path: [...basePath, flatKey],
			});
		}
	}
	return groups.filter((group) => group.leaves.length > 0 || group.title !== titlePrefix || group.comment);
}

function jsonLeafKind(node: unknown): StructureLeaf["kind"] {
	if (typeof node === "number") return "number";
	if (typeof node === "boolean") return "bool";
	if (node === null) return "null";
	return "string";
}

function buildJsonStructure(
	node: Record<string, unknown>,
	title: string,
	basePath: PathSeg[],
	out: StructureGroup[],
): void {
	const group: StructureGroup = { title, path: basePath, leaves: [] };
	out.push(group);
	const nested: (() => void)[] = [];

	for (const [key, item] of Object.entries(node)) {
		const path = [...basePath, key];
		const childTitle = title ? `${title}.${key}` : key;
		if (typeof item === "string") {
			const embedded = parseJsonContainer(item);
			if (embedded !== undefined && isPlainObject(embedded)) {
				nested.push(() => buildJsonStructure(embedded, childTitle, [...path, { embedded: "json" }], out));
				continue;
			}
			if (item.includes("\n") && looksLikeToml(item)) {
				nested.push(() => out.push(...buildTomlStructure(item, [...path, { embedded: "toml" }], childTitle)));
				continue;
			}
			group.leaves.push({ key, kind: "string", value: item, path });
			continue;
		}
		if (isPlainObject(item)) {
			nested.push(() => buildJsonStructure(item, childTitle, path, out));
			continue;
		}
		if (Array.isArray(item) && item.every((entry) => typeof entry !== "object" || entry === null)) {
			group.leaves.push({
				key,
				kind: "array",
				value: JSON.stringify(item),
				items: item.map((entry) => JSON.stringify(entry)),
				path,
			});
			continue;
		}
		if (Array.isArray(item)) {
			// mixed / object arrays — edit as JSON text
			group.leaves.push({ key, kind: "string", value: JSON.stringify(item), path });
			continue;
		}
		group.leaves.push({ key, kind: jsonLeafKind(item), value: String(item), path });
	}
	nested.forEach((run) => run());
}

export function buildStructure(value: string): StructureGroup[] | null {
	const format = detectFormat(value);
	if (format === "json") {
		const root = parseJsonContainer(value);
		if (!isPlainObject(root)) return null;
		const out: StructureGroup[] = [];
		buildJsonStructure(root, "", [], out);
		return out;
	}
	if (format === "toml") {
		return buildTomlStructure(value, [], "");
	}
	if (format === "env") {
		return [
			{
				title: "",
				path: [],
				leaves: flattenEnv(value).map((row) => ({
					key: row.key,
					kind: "string" as const,
					value: row.value,
					path: [row.key],
				})),
			},
		];
	}
	return null;
}

function parseJsonRaw(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (trimmed === "null") return null;
	if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return Number(trimmed);
	if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
		try {
			return JSON.parse(trimmed) as unknown;
		} catch {
			return raw;
		}
	}
	// chips pass JSON literals ("x"); bare text stays text
	if (trimmed.startsWith('"')) {
		try {
			return JSON.parse(trimmed) as unknown;
		} catch {
			return raw;
		}
	}
	return raw;
}

function applyTomlOpText(text: string, rest: PathSeg[], op: StructOp): string {
	const key = typeof rest[0] === "string" ? rest[0] : "";
	switch (op.type) {
		case "set":
			return setTomlValue(text, key, op.raw);
		case "setArrayItems":
			return setTomlArrayItems(text, key, op.items);
		case "remove":
			return tomlRemoveKey(text, key);
		case "add":
			return tomlAddKey(text, key, op.key, op.raw);
		case "addSection":
			return tomlAddSection(text, op.title);
	}
}

function applyJsonOp(node: unknown, path: PathSeg[], op: StructOp): unknown {
	if (path.length === 0) {
		if (op.type === "add" && isPlainObject(node)) {
			return { ...node, [op.key]: parseJsonRaw(op.raw) };
		}
		if (op.type === "addSection" && isPlainObject(node)) {
			return { ...node, [op.title]: {} };
		}
		if (op.type === "set") {
			if (typeof node === "object" && node !== null) return parseJsonRaw(op.raw);
			return coerceScalar(op.raw, node);
		}
		if (op.type === "setArrayItems") {
			return op.items.map(parseJsonRaw);
		}
		return node;
	}
	const [seg, ...rest] = path;
	if (typeof seg === "object") {
		if (seg.embedded === "json") {
			const inner = JSON.parse(node as string) as unknown;
			return JSON.stringify(applyJsonOp(inner, rest, op));
		}
		return applyTomlOpText(node as string, rest, op);
	}
	if (rest.length === 0 && op.type === "remove") {
		if (Array.isArray(node)) {
			const copy = [...node];
			copy.splice(seg as number, 1);
			return copy;
		}
		const copy = { ...(node as Record<string, unknown>) };
		delete copy[seg as string];
		return copy;
	}
	if (Array.isArray(node)) {
		const copy = [...node];
		copy[seg as number] = applyJsonOp(copy[seg as number], rest, op);
		return copy;
	}
	const copy = { ...(node as Record<string, unknown>) };
	copy[seg as string] = applyJsonOp(copy[seg as string], rest, op);
	return copy;
}

// One entry point for all tree-editor mutations, returning the new draft text.
export function applyStructOp(value: string, path: PathSeg[], op: StructOp): string {
	const format = detectFormat(value);
	if (format === "json") {
		const root = parseJsonContainer(value);
		return JSON.stringify(applyJsonOp(root, path, op), null, 2);
	}
	if (format === "toml") {
		return applyTomlOpText(value, path, op);
	}
	if (format === "env") {
		const key = typeof path[0] === "string" ? path[0] : "";
		switch (op.type) {
			case "set":
				return setEnvValue(value, key, op.raw);
			case "remove":
				return envRemoveKey(value, key);
			case "add":
				return `${value.replace(/\n$/, "")}\n${op.key}=${op.raw}\n`;
			default:
				return value;
		}
	}
	return value;
}

// New draft text with one flattened row's value replaced. TOML/env edit their line in
// place; JSON round-trips through the tree (draft is pretty-printed anyway).
export function setValueAtRow(value: string, row: EditableRow, raw: string): string {
	const format = detectFormat(value);
	if (format === "json") {
		const root = parseJsonContainer(value);
		return JSON.stringify(applyAtPath(root, row.path, raw), null, 2);
	}
	if (format === "toml") {
		return setTomlValue(value, row.key, raw);
	}
	if (format === "env") {
		return setEnvValue(value, row.key, raw);
	}
	return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tomlKey(key: string): string {
	return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function tomlScalar(value: unknown): string {
	if (typeof value === "string") {
		if (value.includes("\n") && !value.includes('"""')) {
			return `"""\n${value.replace(/\\/g, "\\\\")}\n"""`;
		}
		return JSON.stringify(value);
	}
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return `[${value.map(tomlScalar).join(", ")}]`;
	return '""'; // TOML has no null
}

// Splice an embedded TOML string under a key prefix: its own sections get prefixed,
// leading key/values land in a [prefix] section. Comments and formatting survive.
function prefixTomlText(text: string, prefix: string, out: string[]): void {
	const lines = text.replace(/\n$/, "").split(/\r?\n/);
	let sawSection = false;
	let openedRoot = false;
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue; // collapse blanks — sections bring their own spacing
		const sectionMatch = trimmed.match(/^(\[+)([^\]]+)(\]+)\s*(#.*)?$/);
		if (sectionMatch) {
			sawSection = true;
			out.push("", `${sectionMatch[1]}${prefix}.${sectionMatch[2].trim()}${sectionMatch[3]}${sectionMatch[4] ? ` ${sectionMatch[4]}` : ""}`);
			continue;
		}
		if (!sawSection && !openedRoot) {
			out.push("", `[${prefix}]`);
			openedRoot = true;
		}
		out.push(line);
	}
}

function emitToml(obj: Record<string, unknown>, prefix: string, out: string[]): void {
	const scalars: [string, unknown][] = [];
	const sections: [string, Record<string, unknown>][] = [];
	const tomlBlobs: [string, string][] = [];
	const tableArrays: [string, Record<string, unknown>[]][] = [];

	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === "string") {
			const embedded = parseJsonContainer(value);
			if (embedded !== undefined && isPlainObject(embedded)) {
				sections.push([key, embedded]);
				continue;
			}
			if (value.includes("\n") && looksLikeToml(value)) {
				tomlBlobs.push([key, value]);
				continue;
			}
		}
		if (isPlainObject(value)) {
			sections.push([key, value]);
		} else if (Array.isArray(value) && value.length > 0 && value.every(isPlainObject)) {
			tableArrays.push([key, value as Record<string, unknown>[]]);
		} else {
			scalars.push([key, value]);
		}
	}

	for (const [key, value] of scalars) {
		out.push(`${tomlKey(key)} = ${tomlScalar(value)}`);
	}
	for (const [key, value] of sections) {
		const path = prefix ? `${prefix}.${tomlKey(key)}` : tomlKey(key);
		out.push("", `[${path}]`);
		emitToml(value, path, out);
	}
	for (const [key, blob] of tomlBlobs) {
		prefixTomlText(blob, prefix ? `${prefix}.${tomlKey(key)}` : tomlKey(key), out);
	}
	for (const [key, items] of tableArrays) {
		const path = prefix ? `${prefix}.${tomlKey(key)}` : tomlKey(key);
		for (const item of items) {
			out.push("", `[[${path}]]`);
			emitToml(item, path, out);
		}
	}
}

function splitTopLevel(text: string): string[] {
	const parts: string[] = [];
	let current = "";
	let depth = 0;
	let quote: string | null = null;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quote) {
			current += ch;
			if (ch === "\\" && quote === '"') {
				current += text[++i] ?? "";
			} else if (ch === quote) {
				quote = null;
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === "[" || ch === "{") depth++;
		if (ch === "]" || ch === "}") depth--;
		if (ch === "," && depth === 0) {
			parts.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	if (current.trim()) parts.push(current);
	return parts;
}

function parseTomlScalar(rhs: string): unknown {
	const t = rhs.trim();
	if (t.startsWith('"')) {
		try {
			return JSON.parse(t) as unknown;
		} catch {
			return unquote(t);
		}
	}
	if (t.startsWith("'")) return unquote(t);
	if (t === "true") return true;
	if (t === "false") return false;
	if (/^[+-]?\d[\d_]*(\.[\d_]+)?([eE][+-]?\d+)?$/.test(t)) return Number(t.replace(/_/g, ""));
	if (t.startsWith("[") && t.endsWith("]")) {
		return splitTopLevel(t.slice(1, -1)).map(parseTomlScalar);
	}
	return t; // dates, inline tables, anything exotic — keep as text
}

function ensurePath(obj: Record<string, unknown>, segs: string[]): Record<string, unknown> {
	let current = obj;
	for (const seg of segs) {
		const existing = current[seg];
		if (Array.isArray(existing) && existing.length > 0 && isPlainObject(existing[existing.length - 1])) {
			current = existing[existing.length - 1] as Record<string, unknown>;
			continue;
		}
		if (!isPlainObject(existing)) {
			current[seg] = {};
		}
		current = current[seg] as Record<string, unknown>;
	}
	return current;
}

function parseKeySegs(key: string): string[] {
	return key.split(".").map((seg) => unquote(seg.trim()));
}

function normalizeTomlValue(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(normalizeTomlValue);
	if (isPlainObject(value)) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeTomlValue(item)]));
	}
	return value;
}

// Display-only JSON object from a TOML document. Strict spec handling (multiline
// strings, dates, inline tables) comes from smol-toml; the line-based fallback
// covers toml-ish content the strict parser rejects.
export function tomlToJson(text: string): Record<string, unknown> {
	try {
		return normalizeTomlValue(parseTomlStrict(text)) as Record<string, unknown>;
	} catch {
		return tomlToJsonFallback(text);
	}
}

function tomlToJsonFallback(text: string): Record<string, unknown> {
	const root: Record<string, unknown> = {};
	let current = root;
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const tableArray = line.match(/^\[\[([^\]]+)\]\]/);
		if (tableArray) {
			const segs = parseKeySegs(tableArray[1]);
			const parent = ensurePath(root, segs.slice(0, -1));
			const key = segs[segs.length - 1];
			if (!Array.isArray(parent[key])) parent[key] = [];
			const item: Record<string, unknown> = {};
			(parent[key] as unknown[]).push(item);
			current = item;
			continue;
		}
		const section = line.match(/^\[([^\]]+)\]/);
		if (section) {
			current = ensurePath(root, parseKeySegs(section[1]));
			continue;
		}
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		const segs = parseKeySegs(line.slice(0, eq));
		const [rhs] = splitTrailingComment(line.slice(eq + 1));
		const target = ensurePath(current, segs.slice(0, -1));
		target[segs[segs.length - 1]] = parseTomlScalar(rhs);
	}
	return root;
}

export function envToJson(text: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const row of flattenEnv(text)) {
		result[row.key] = row.value;
	}
	return result;
}

// Display-only TOML rendering of a JSON value: nested objects and embedded
// JSON/TOML strings become (prefixed) sections.
export function jsonToToml(value: string): string {
	const root = parseJsonContainer(value);
	if (!isPlainObject(root)) {
		return "";
	}
	const out: string[] = [];
	emitToml(root, "", out);
	while (out[0] === "") out.shift();
	return `${out.join("\n")}\n`;
}

export function flattenEnv(value: string): FlatRow[] {
	const rows: FlatRow[] = [];
	for (const raw of value.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		rows.push({
			key: line.slice(0, eq).replace(/^export\s+/, ""),
			value: line.slice(eq + 1),
			kind: "string",
		});
	}
	return rows;
}
