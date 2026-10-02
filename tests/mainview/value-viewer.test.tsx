import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ValueViewer } from "../../src/mainview/components/secret-value/ValueViewer";
import { buildStructure, flattenEditable, flattenJson, jsonToToml, parseJsonContainer } from "../../src/mainview/lib/value-format";

describe("untrusted value rendering", () => {
	test("deep JSON remains available as raw text without recursive conversion", () => {
		const value = '['.repeat(2000) + '1' + ']'.repeat(2000);
		expect(parseJsonContainer(value)).toBeUndefined();
		expect(flattenEditable(value)).toEqual([]);
		expect(buildStructure(value)).toBeNull();
		expect(jsonToToml(value)).toBe("");
		expect(flattenJson(JSON.parse(value))[0].value).toContain("Nesting limit");
		expect(renderToStaticMarkup(<ValueViewer value={value} />)).toContain(value);
	});

	test("deep dotted TOML renders its JSON view without overflowing", () => {
		const original = globalThis.localStorage;
		Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "json" } });
		try {
			const value = `${"a.".repeat(2000)}a = 1`;
			expect(renderToStaticMarkup(<ValueViewer value={value} />)).toContain("Nesting limit");
		} finally {
			Object.defineProperty(globalThis, "localStorage", { configurable: true, value: original });
		}
	});

	test("HTML in secrets is escaped", () => {
		expect(renderToStaticMarkup(<ValueViewer value={'<img src=x onerror="alert(1)">'} />)).not.toContain("<img");
	});
});
