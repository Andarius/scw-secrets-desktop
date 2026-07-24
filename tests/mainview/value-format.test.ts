import { describe, expect, test } from "bun:test";

import {
	applyStructOp,
	buildStructure,
	detectEmbedded,
	detectFormat,
	envToJson,
	flattenEditable,
	jsonToToml,
	tomlToJson,
	flattenEnv,
	flattenJson,
	flattenToml,
	parseJsonContainer,
	setEnvValue,
	setTomlValue,
	setValueAtRow,
	tokenizeEnvLine,
	tokenizeJsonishLine,
	tokenizeTomlLine,
} from "../../src/mainview/value-format";

const TOML_SAMPLE = `# config
[database]
host = "db.fr-par.scw.cloud"
port = 5432

[features]
beta = true
`;

const ENV_SAMPLE = `DATABASE_URL=postgres://x
export API_KEY=abc123
`;

describe("detectFormat", () => {
	const cases: [string, string, ReturnType<typeof detectFormat>][] = [
		["json object", `{"a": 1}`, "json"],
		["json array", `[1, 2]`, "json"],
		["json with whitespace", `  {"a": {"b": []}}  `, "json"],
		["bare number is not json", "42", "plain"],
		["bare string is not json", "hello world", "plain"],
		["invalid json object", `{"a": }`, "plain"],
		["toml with sections", TOML_SAMPLE, "toml"],
		["toml without section but spaced kv", `host = "x"\nport = 5432`, "toml"],
		["env lines", ENV_SAMPLE, "env"],
		["single env line", "API_KEY=abc", "env"],
		["prose is plain", "just some secret text\nwith lines", "plain"],
		["empty is plain", "", "plain"],
		["mixed toml and prose is plain", "[section]\nnot a kv line at all!", "plain"],
	];

	for (const [name, value, expected] of cases) {
		test(name, () => {
			expect(detectFormat(value)).toBe(expected);
		});
	}
});

describe("parseJsonContainer", () => {
	test("parses objects", () => {
		expect(parseJsonContainer(`{"a": 1}`)).toEqual({ a: 1 });
	});

	test("rejects scalars even if valid JSON", () => {
		expect(parseJsonContainer("42")).toBeUndefined();
		expect(parseJsonContainer(`"str"`)).toBeUndefined();
	});
});

describe("detectEmbedded", () => {
	test("finds json in a string field", () => {
		expect(detectEmbedded(`{"type":"service_account","project_id":"x"}`)).toBe("json");
	});

	test("finds toml in a multi-line string field", () => {
		expect(detectEmbedded(TOML_SAMPLE)).toBe("toml");
	});

	test("single-line toml-ish strings stay plain", () => {
		expect(detectEmbedded(`key = "value"`)).toBeNull();
	});

	test("ordinary strings stay plain", () => {
		expect(detectEmbedded("postgres://user:pass@host/db")).toBeNull();
	});
});

describe("tokenizeTomlLine", () => {
	test("highlights section headers", () => {
		expect(tokenizeTomlLine("[database]")).toEqual([
			{ type: "punct", text: "[" },
			{ type: "section", text: "database" },
			{ type: "punct", text: "]" },
		]);
	});

	test("highlights key, string, and comment", () => {
		const tokens = tokenizeTomlLine(`host = "db.local" # main`);
		expect(tokens.find((t) => t.type === "key")?.text).toBe("host ");
		expect(tokens.find((t) => t.type === "string")?.text).toBe(`"db.local"`);
		expect(tokens.find((t) => t.type === "comment")?.text).toContain("# main");
	});

	test("highlights numbers and booleans", () => {
		expect(tokenizeTomlLine("port = 5432").find((t) => t.type === "number")?.text).toBe("5432");
		expect(tokenizeTomlLine("beta = true").find((t) => t.type === "bool")?.text).toBe("true");
	});

	test("does not treat # inside quotes as a comment", () => {
		const tokens = tokenizeTomlLine(`secret = "a#b"`);
		expect(tokens.find((t) => t.type === "comment")).toBeUndefined();
		expect(tokens.find((t) => t.type === "string")?.text).toBe(`"a#b"`);
	});
});

describe("flattenJson", () => {
	test("flattens nested objects to dot paths", () => {
		expect(flattenJson({ a: { b: 1 }, c: "x" })).toEqual([
			{ key: "a.b", value: "1", kind: "number" },
			{ key: "c", value: "x", kind: "string" },
		]);
	});

	test("flattens arrays with indices", () => {
		expect(flattenJson({ hosts: ["a", "b"] })).toEqual([
			{ key: "hosts[0]", value: "a", kind: "string" },
			{ key: "hosts[1]", value: "b", kind: "string" },
		]);
	});

	test("flattens embedded JSON strings in place", () => {
		expect(flattenJson({ creds: `{"type":"sa"}` })).toEqual([
			{ key: "creds.type", value: "sa", kind: "string" },
		]);
	});

	test("flattens embedded TOML strings in place", () => {
		expect(flattenJson({ config: '[db]\nhost = "x"\nport = 5432\n' })).toEqual([
			{ key: "config.db.host", value: "x", kind: "string" },
			{ key: "config.db.port", value: "5432", kind: "number" },
		]);
	});

	test("keeps null and empty containers visible", () => {
		expect(flattenJson({ a: null, b: {}, c: [] })).toEqual([
			{ key: "a", value: "null", kind: "null" },
			{ key: "b", value: "{}", kind: "null" },
			{ key: "c", value: "[]", kind: "null" },
		]);
	});
});

describe("flattenToml", () => {
	test("prefixes keys with their section", () => {
		expect(flattenToml(TOML_SAMPLE)).toEqual([
			{ key: "database.host", value: "db.fr-par.scw.cloud", kind: "string" },
			{ key: "database.port", value: "5432", kind: "number" },
			{ key: "features.beta", value: "true", kind: "bool" },
		]);
	});

	test("strips trailing comments", () => {
		expect(flattenToml(`key = "v" # note`)).toEqual([
			{ key: "key", value: "v", kind: "string" },
		]);
	});
});

describe("flattenEnv", () => {
	test("splits on the first equals and drops export", () => {
		expect(flattenEnv(ENV_SAMPLE)).toEqual([
			{ key: "DATABASE_URL", value: "postgres://x", kind: "string" },
			{ key: "API_KEY", value: "abc123", kind: "string" },
		]);
	});
});

function rowByKey(value: string, key: string) {
	const row = flattenEditable(value).find((r) => r.key === key);
	if (!row) throw new Error(`no row ${key}`);
	return row;
}

describe("setValueAtRow", () => {
	const JSON_VALUE = JSON.stringify(
		{
			host: "db.local",
			port: 5432,
			ssl: true,
			pool: { min: 2 },
			creds: JSON.stringify({ type: "sa", project: "x" }),
			config: '[db]\nhost = "old"\nport = 5432\n',
		},
		null,
		2,
	);

	test("sets a top-level string", () => {
		const next = setValueAtRow(JSON_VALUE, rowByKey(JSON_VALUE, "host"), "db.remote");
		expect(JSON.parse(next).host).toBe("db.remote");
	});

	test("keeps number and bool types when text still fits", () => {
		let next = setValueAtRow(JSON_VALUE, rowByKey(JSON_VALUE, "port"), "5433");
		expect(JSON.parse(next).port).toBe(5433);
		next = setValueAtRow(JSON_VALUE, rowByKey(JSON_VALUE, "ssl"), "false");
		expect(JSON.parse(next).ssl).toBe(false);
	});

	test("falls back to string when a number no longer parses", () => {
		const next = setValueAtRow(JSON_VALUE, rowByKey(JSON_VALUE, "port"), "not-a-port");
		expect(JSON.parse(next).port).toBe("not-a-port");
	});

	test("sets nested keys", () => {
		const next = setValueAtRow(JSON_VALUE, rowByKey(JSON_VALUE, "pool.min"), "4");
		expect(JSON.parse(next).pool.min).toBe(4);
	});

	test("writes through an embedded JSON string", () => {
		const next = setValueAtRow(JSON_VALUE, rowByKey(JSON_VALUE, "creds.type"), "user");
		const creds = JSON.parse(JSON.parse(next).creds);
		expect(creds).toEqual({ type: "user", project: "x" });
	});

	test("writes through an embedded TOML string", () => {
		const next = setValueAtRow(JSON_VALUE, rowByKey(JSON_VALUE, "config.db.host"), "new");
		const config = JSON.parse(next).config as string;
		expect(config).toContain('host = "new"');
		expect(config).toContain("port = 5432");
	});

	test("edits only the target line of a top-level TOML value", () => {
		const toml = '# note\n[db]\nhost = "old" # main\nport = 5432\n';
		const next = setValueAtRow(toml, rowByKey(toml, "db.host"), "new");
		expect(next).toBe('# note\n[db]\nhost = "new" # main\nport = 5432\n');
	});

	test("edits an env line after the first equals", () => {
		const env = "A=1\nexport B=two=three\n";
		const next = setValueAtRow(env, rowByKey(env, "B"), "changed");
		expect(next).toBe("A=1\nexport B=changed\n");
	});
});

describe("jsonToToml", () => {
	test("renders scalars, arrays, and nested sections", () => {
		const value = JSON.stringify({
			host: "db.local",
			port: 5432,
			ssl: true,
			replicas: ["a", "b"],
			pool: { min: 2, max: 10 },
		});
		expect(jsonToToml(value)).toBe(
			[
				'host = "db.local"',
				"port = 5432",
				"ssl = true",
				'replicas = ["a", "b"]',
				"",
				"[pool]",
				"min = 2",
				"max = 10",
				"",
			].join("\n"),
		);
	});

	test("expands embedded JSON strings into sections", () => {
		const value = JSON.stringify({ creds: JSON.stringify({ type: "sa", project: "x" }) });
		expect(jsonToToml(value)).toBe('[creds]\ntype = "sa"\nproject = "x"\n');
	});

	test("splices embedded TOML under a prefixed section, keeping comments", () => {
		const value = JSON.stringify({
			config: '# note\nlimit = 100\n\n[db]\nhost = "x" # main\n',
		});
		expect(jsonToToml(value)).toBe(
			["[config]", "# note", "limit = 100", "", "[config.db]", 'host = "x" # main', ""].join("\n"),
		);
	});

	test("renders arrays of objects as table arrays", () => {
		const value = JSON.stringify({ users: [{ name: "a" }, { name: "b" }] });
		expect(jsonToToml(value)).toBe('[[users]]\nname = "a"\n\n[[users]]\nname = "b"\n');
	});

	test("quotes non-bare keys", () => {
		expect(jsonToToml(JSON.stringify({ "my key": 1 }))).toBe('"my key" = 1\n');
	});

	test("renders multi-line strings as triple-quoted", () => {
		expect(jsonToToml(JSON.stringify({ pem: "line1\nline2" }))).toBe(
			'pem = """\nline1\nline2\n"""\n',
		);
	});

	test("returns empty for non-object roots", () => {
		expect(jsonToToml("[1, 2]")).toBe("");
		expect(jsonToToml("plain")).toBe("");
	});
});

describe("tomlToJson", () => {
	test("parses sections, scalars, and arrays", () => {
		expect(
			tomlToJson('# c\nname = "app"\n\n[db]\nhost = "x" # main\nport = 5432\nssl = true\nreplicas = ["a", \'b\']\n'),
		).toEqual({
			name: "app",
			db: { host: "x", port: 5432, ssl: true, replicas: ["a", "b"] },
		});
	});

	test("parses dotted sections and dotted keys", () => {
		expect(tomlToJson("[role.developers]\nschemas.ro = ['x']\nlimit = 1_00\n")).toEqual({
			role: { developers: { schemas: { ro: ["x"] }, limit: 100 } },
		});
	});

	test("parses table arrays", () => {
		expect(tomlToJson('[[users]]\nname = "a"\n\n[[users]]\nname = "b"\n')).toEqual({
			users: [{ name: "a" }, { name: "b" }],
		});
	});

	test("parses dates to ISO strings via smol-toml", () => {
		expect(tomlToJson("date = 2026-07-23T00:00:00Z")).toEqual({ date: "2026-07-23T00:00:00.000Z" });
	});

	test("falls back to the line parser for non-strict toml", () => {
		// bare (unquoted) string rhs is invalid TOML — strict parser throws
		expect(tomlToJson("mode = fast\n[db]\nhost = 'x'")).toEqual({
			mode: "fast",
			db: { host: "x" },
		});
	});

	test("does not split on commas inside quoted array items", () => {
		expect(tomlToJson(`list = ["a,b", 'c']`)).toEqual({ list: ["a,b", "c"] });
	});
});

describe("envToJson", () => {
	test("maps lines to string values", () => {
		expect(envToJson(ENV_SAMPLE)).toEqual({
			DATABASE_URL: "postgres://x",
			API_KEY: "abc123",
		});
	});
});

const STRUCT_TOML = `# top note
limit = 10

[role.grafana]
password = 'q4Ju'
allow_idle = false
search_path = ['a', 'b']  # keep 'analytics' out

[role.n8n]
limit = 5
`;

describe("buildStructure", () => {
	test("toml: groups per section with short keys and array items", () => {
		const groups = buildStructure(STRUCT_TOML)!;
		expect(groups.map((g) => g.title)).toEqual(["", "role.grafana", "role.n8n"]);
		const grafana = groups[1];
		expect(grafana.leaves.map((l) => l.key)).toEqual(["password", "allow_idle", "search_path"]);
		expect(grafana.leaves[1].kind).toBe("bool");
		expect(grafana.leaves[2].items).toEqual(["'a'", "'b'"]);
		expect(grafana.leaves[2].comment).toContain("analytics");
	});

	test("json: nested objects and embedded json become groups", () => {
		const value = JSON.stringify({
			host: "x",
			pool: { min: 2 },
			creds: JSON.stringify({ type: "sa" }),
		});
		const groups = buildStructure(value)!;
		expect(groups.map((g) => g.title)).toEqual(["", "pool", "creds"]);
		expect(groups[0].leaves.map((l) => l.key)).toEqual(["host"]);
	});

	test("json: scalar arrays become chip leaves", () => {
		const groups = buildStructure(JSON.stringify({ hosts: ["a", "b"] }))!;
		expect(groups[0].leaves[0].kind).toBe("array");
		expect(groups[0].leaves[0].items).toEqual(['"a"', '"b"']);
	});
});

function leafAt(value: string, groupTitle: string, key: string) {
	const groups = buildStructure(value)!;
	const group = groups.find((g) => g.title === groupTitle)!;
	return group.leaves.find((l) => l.key === key)!;
}

describe("applyStructOp", () => {
	test("toml: remove deletes only the key line", () => {
		const next = applyStructOp(STRUCT_TOML, leafAt(STRUCT_TOML, "role.grafana", "password").path, { type: "remove" });
		expect(next).not.toContain("password");
		expect(next).toContain("allow_idle = false");
		expect(next).toContain("# top note");
	});

	test("toml: setArrayItems rewrites the rhs, keeps the comment", () => {
		const leaf = leafAt(STRUCT_TOML, "role.grafana", "search_path");
		const next = applyStructOp(STRUCT_TOML, leaf.path, { type: "setArrayItems", items: ["'a'", "'b'", "'c'"] });
		expect(next).toContain("search_path = ['a', 'b', 'c'] # keep 'analytics' out");
	});

	test("toml: add inserts at the end of the section", () => {
		const groups = buildStructure(STRUCT_TOML)!;
		const next = applyStructOp(STRUCT_TOML, groups[1].path, { type: "add", key: "schemas", raw: "[]" });
		const lines = next.split("\n");
		const idx = lines.indexOf("schemas = []");
		expect(idx).toBeGreaterThan(lines.indexOf("search_path = ['a', 'b']  # keep 'analytics' out"));
		expect(idx).toBeLessThan(lines.indexOf("[role.n8n]"));
	});

	test("toml: add to top level lands before the first section", () => {
		const groups = buildStructure(STRUCT_TOML)!;
		const next = applyStructOp(STRUCT_TOML, groups[0].path, { type: "add", key: "mode", raw: "fast" });
		const lines = next.split("\n");
		expect(lines.indexOf('mode = "fast"')).toBeLessThan(lines.indexOf("[role.grafana]"));
	});

	test("json: add and remove keys", () => {
		const value = JSON.stringify({ a: 1, pool: { min: 2 } });
		const groups = buildStructure(value)!;
		const added = applyStructOp(value, groups.find((g) => g.title === "pool")!.path, {
			type: "add",
			key: "max",
			raw: "10",
		});
		expect(JSON.parse(added).pool).toEqual({ min: 2, max: 10 });
		const removed = applyStructOp(value, leafAt(value, "", "a").path, { type: "remove" });
		expect(JSON.parse(removed)).toEqual({ pool: { min: 2 } });
	});

	test("json: setArrayItems parses literals", () => {
		const value = JSON.stringify({ hosts: ["a"] });
		const next = applyStructOp(value, leafAt(value, "", "hosts").path, {
			type: "setArrayItems",
			items: ['"a"', '"b"', "3"],
		});
		expect(JSON.parse(next).hosts).toEqual(["a", "b", 3]);
	});

	test("json: ops write through embedded json", () => {
		const value = JSON.stringify({ creds: JSON.stringify({ type: "sa" }) });
		const groups = buildStructure(value)!;
		const next = applyStructOp(value, groups.find((g) => g.title === "creds")!.path, {
			type: "add",
			key: "project",
			raw: "x",
		});
		expect(JSON.parse(JSON.parse(next).creds)).toEqual({ type: "sa", project: "x" });
	});

	test("json: ops write through embedded toml", () => {
		const value = JSON.stringify({ config: "[db]\nhost = 'x'\n" });
		const next = applyStructOp(value, leafAt(value, "config.db", "host").path, { type: "set", raw: "y" });
		expect(JSON.parse(next).config).toContain("host = 'y'");
	});

	test("toml: addSection appends a header, no-op when it exists", () => {
		const next = applyStructOp(STRUCT_TOML, [], { type: "addSection", title: "role.metabase" });
		expect(next.endsWith("\n[role.metabase]\n")).toBe(true);
		expect(applyStructOp(next, [], { type: "addSection", title: "role.metabase" })).toBe(next);
	});

	test("json: addSection creates an empty object shown as a group", () => {
		const value = JSON.stringify({ a: 1 });
		const next = applyStructOp(value, [], { type: "addSection", title: "pool" });
		expect(JSON.parse(next)).toEqual({ a: 1, pool: {} });
		expect(buildStructure(next)!.map((g) => g.title)).toEqual(["", "pool"]);
	});

	test("env: add and remove", () => {
		const value = "A=1\nB=2\n";
		expect(applyStructOp(value, ["B"], { type: "remove" })).toBe("A=1\n");
		expect(applyStructOp(value, [], { type: "add", key: "C", raw: "3" })).toBe("A=1\nB=2\nC=3\n");
	});
});

describe("setTomlValue quoting", () => {
	test("keeps unquoted numbers unquoted", () => {
		expect(setTomlValue("port = 5432", "port", "5433")).toBe("port = 5433");
	});

	test("quotes when a former number becomes text", () => {
		expect(setTomlValue("port = 5432", "port", "many")).toBe('port = "many"');
	});

	test("preserves single-quote style", () => {
		expect(setTomlValue("name = 'old'", "name", "new")).toBe("name = 'new'");
	});
});

describe("setEnvValue", () => {
	test("returns input unchanged for a missing key", () => {
		expect(setEnvValue("A=1", "B", "x")).toBe("A=1");
	});
});

describe("tokenizeJsonishLine", () => {
	test("distinguishes keys from string values", () => {
		const tokens = tokenizeJsonishLine(`  "host": "db.local",`);
		expect(tokens.find((t) => t.type === "key")?.text).toBe(`"host"`);
		expect(tokens.find((t) => t.type === "string")?.text).toBe(`"db.local"`);
	});

	test("survives invalid json mid-edit", () => {
		const tokens = tokenizeJsonishLine(`{"broken": tru`);
		expect(tokens.length).toBeGreaterThan(0);
		expect(tokens.map((t) => t.text).join("")).toBe(`{"broken": tru`);
	});
});

describe("tokenizeEnvLine", () => {
	test("splits key and value", () => {
		expect(tokenizeEnvLine("API_KEY=abc=def")).toEqual([
			{ type: "key", text: "API_KEY" },
			{ type: "punct", text: "=" },
			{ type: "string", text: "abc=def" },
		]);
	});

	test("keeps comments", () => {
		expect(tokenizeEnvLine("# note")).toEqual([{ type: "comment", text: "# note" }]);
	});
});
