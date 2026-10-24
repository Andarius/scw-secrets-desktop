import { expect as baseExpect, test, type Page } from "@playwright/test";

import { highlightExpect, patchHighlights } from "./highlights";

const recording = process.env.PW_VIDEO === "1";
const expect: typeof baseExpect = recording
	? Object.assign((target: unknown) => highlightExpect(target), { poll: baseExpect.poll }) as typeof baseExpect
	: baseExpect;

function inventoryRows(page: Page) {
	return page.locator("tbody tr");
}

test.beforeEach(async ({ page }) => {
	if (recording) {
		patchHighlights(page);
	}
	await page.goto("/");
	// generous timeout: parallel first loads on a cold vite server transform deps serially
	await expect(page.getByRole("heading", { name: "SCW Secrets" })).toBeVisible({ timeout: 20_000 });
});

test("loads the mock inventory with the default selection", async ({ page }) => {
	await expect(inventoryRows(page)).toHaveCount(12);
	await expect(page.locator("tbody tr").filter({ hasText: "DATABASE_URL" })).toHaveCount(1);
	await expect(page.locator("header").getByRole("button", { name: /^Project/ })).toContainText("webapp-api");
	await expect(page.getByRole("button", { name: "View & Edit Value" })).toBeVisible();
});

test("previews the desktop frontend in a browser without a Tauri bridge", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.goto("http://127.0.0.1:5198");
	await expect(page.getByRole("status")).toContainText("Preview · Sample data");
	await expect(inventoryRows(page)).toHaveCount(12);
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	await expect(page.getByText("gcp_credentials.type", { exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});

test("switches project from the header dropdown", async ({ page }) => {
	await page.locator("header").getByRole("button", { name: /^Project/ }).click();

	const listbox = page.getByRole("listbox");
	await expect(listbox.getByRole("option")).toHaveCount(3);

	await listbox.getByRole("option", { name: "data-pipeline" }).click();

	await expect(page.getByRole("listbox")).toBeHidden();
	await expect(page.locator("header").getByRole("button", { name: /^Project/ })).toContainText("data-pipeline");
});

test("settings show the selected profile and its API key limits", async ({ page }) => {
	await page.locator("header").getByRole("button", { name: /^Profile/ }).click();
	await page.getByRole("listbox").getByRole("option", { name: /staging/ }).click();
	await page.getByTitle("Settings").click();

	const account = page.getByRole("region", { name: "Account" });
	await expect(account).toContainText("staging");
	await expect(account).toContainText("SCW3J9L2QR5YBHD8KWXM");
	await expect(account).toContainText("(in 90 days)");
	await expect(account).toContainText("365 days");
});

test("filters the inventory by search term", async ({ page }) => {
	await page.getByPlaceholder("Filter by name or path").fill("auth");

	await expect(inventoryRows(page)).toHaveCount(2);
	await expect(page.locator("tbody tr").first()).toContainText("JWT_SECRET");
	await expect(page.locator("tbody tr").nth(1)).toContainText("OAUTH_CLIENT_SECRET");
});

test("filters the inventory by status and path", async ({ page }) => {
	await page.getByRole("button", { name: "ATTENTION" }).click();

	await expect(inventoryRows(page)).toHaveCount(1);
	await expect(page.locator("tbody tr").first()).toContainText("DEPRECATED_API_TOKEN");

	await page.getByRole("button", { name: "ALL", exact: true }).click();
	await page.locator('button[title="/services"]').click();

	await expect(inventoryRows(page)).toHaveCount(10);
});

test("sorts the inventory by secret name", async ({ page }) => {
	await page.getByRole("button", { name: "Sort by name ascending" }).click();

	await expect(page.locator("tbody tr").first()).toContainText("AWS_ACCESS_KEY_ID");

	await page.getByRole("button", { name: "Sort by name descending" }).click();

	await expect(page.locator("tbody tr").first()).toContainText("WEBHOOK_SIGNING_KEY");
});

test("opens spotlight search with Ctrl+P and finds by name", async ({ page }) => {
	await page.keyboard.press("Control+p");

	const searchInput = page.getByPlaceholder("Search secrets...");
	await expect(searchInput).toBeVisible();

	await searchInput.fill("STRIPE");
	await expect(page.locator("button").filter({ hasText: "STRIPE_SECRET_KEY" })).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(searchInput).toHaveCount(0);
});

test("spotlight search finds by id prefix", async ({ page }) => {
	await page.keyboard.press("Control+p");

	const searchInput = page.getByPlaceholder("Search secrets...");
	await searchInput.fill("id:d4e5f6a7");

	await expect(page.locator("button").filter({ hasText: "DATABASE_URL" })).toBeVisible();
	const badge = page.locator("button").filter({ hasText: "DATABASE_URL" }).locator("span").filter({ hasText: "id" });
	await expect(badge).toBeVisible();
});

test("spotlight search selects a secret and closes", async ({ page }) => {
	await page.keyboard.press("Control+p");

	const searchInput = page.getByPlaceholder("Search secrets...");
	await searchInput.fill("SENTRY");

	await page.keyboard.press("Enter");
	await expect(searchInput).toHaveCount(0);

	await expect(page.locator("tbody tr.bg-cyan-500\\/10").filter({ hasText: "SENTRY_DSN" })).toBeVisible();
});

test("filters the inventory by clicking a tag", async ({ page }) => {
	await page.locator("tbody tr").filter({ hasText: "DATABASE_URL" }).getByRole("button", { name: "prod" }).click();

	await expect(inventoryRows(page)).toHaveCount(2);
	await expect(page.locator("tbody tr").filter({ hasText: "DATABASE_URL" })).toHaveCount(1);
	await expect(page.locator("tbody tr").filter({ hasText: "REDIS_PASSWORD" })).toHaveCount(1);

	const tagsButton = page.getByRole("button", { name: "Tags" });
	await tagsButton.click();
	await tagsButton.locator("..").locator("button").filter({ hasText: "prod" }).click();

	await expect(inventoryRows(page)).toHaveCount(12);
});

test("opens single-secret and batch value overlays", async ({ page }) => {
	await page.getByRole("button", { name: "View & Edit Value" }).click();

	// table is the default view, and the first mode button
	await expect(page.getByText("gcp_credentials.type", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Table", exact: true })).toBeVisible();
	const modeButtons = page.getByRole("button", { name: /^(Table|Formatted|TOML|Raw)$/ });
	await expect(modeButtons.first()).toHaveText("Table");

	await page.getByRole("button", { name: "Formatted", exact: true }).click();
	await expect(page.getByText("JSON", { exact: true })).toBeVisible();
	await expect(page.getByText('"db.fr-par.scw.cloud"', { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "embedded JSON" }).click();
	await expect(page.getByText('"service_account"', { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "embedded TOML" }).click();
	await expect(page.getByText("beta_billing", { exact: true })).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(page.getByText('"db.fr-par.scw.cloud"', { exact: true })).toHaveCount(0);

	await page.getByRole("button", { name: "Select All" }).click();
	await expect(page.getByText("12 SELECTED")).toBeVisible();
	await page.getByRole("button", { name: "View & Edit Values" }).click();

	await expect(page.getByText("12 Secrets", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Copy All as KEY=VALUE" })).toBeVisible();
});

test("value viewer table mode sticks through edit, preview, and reload", async ({ page }) => {
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	await page.getByRole("button", { name: "Table", exact: true }).click();
	// dot-path rows only exist in table mode
	await expect(page.getByText("gcp_credentials.type", { exact: true })).toBeVisible();

	// entering edit with a table preference lands on the editable table
	await page.getByRole("button", { name: "Edit", exact: true }).first().click();
	const hostCell = page.locator('input[value="db.fr-par.scw.cloud"]').first();
	await expect(hostCell).toBeVisible();

	// edit a cell, check it lands in the raw draft
	await hostCell.fill("db.nl-ams.scw.cloud");
	await hostCell.press("Enter");
	await page.getByRole("button", { name: "Raw", exact: true }).click();
	await expect(page.locator("textarea")).toHaveValue(/db\.nl-ams\.scw\.cloud/);

	// preview keeps the sticky table mode
	await page.getByRole("button", { name: "Preview", exact: true }).click();
	await expect(page.getByText("gcp_credentials.type", { exact: true })).toBeVisible();

	await page.keyboard.press("Escape");
	await page.reload();
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	await expect(page.getByText("gcp_credentials.type", { exact: true })).toBeVisible();
});


test("filters the value viewer table by key or value", async ({ page }) => {
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	const filter = page.getByPlaceholder("Filter keys…");
	await expect(page.getByRole("cell", { name: "host", exact: true })).toBeVisible();

	await filter.fill("pass");
	await expect(page.getByRole("cell", { name: "password", exact: true })).toBeVisible();
	await expect(page.getByRole("cell", { name: "host", exact: true })).toHaveCount(0);

	// values match too
	await filter.fill("webapp");
	await expect(page.getByRole("cell", { name: "user", exact: true })).toBeVisible();

	await filter.fill("no-such-key");
	await expect(page.getByText("No keys match “no-such-key”.")).toBeVisible();
});

for (const [name, leave] of [
	["View toggle", (page: Page) => page.getByRole("button", { name: "View", exact: true }).click()],
	["Escape", (page: Page) => page.keyboard.press("Escape")],
] as const) {
	test(`asks before ${name} discards an unsaved draft`, async ({ page }) => {
		await page.getByRole("button", { name: "View & Edit Value" }).click();
		await page.getByRole("button", { name: "Edit", exact: true }).first().click();
		await page.getByRole("button", { name: "Raw", exact: true }).click();
		await page.locator("textarea").fill("draft");

		await leave(page);
		await expect(page.getByText("Unsaved changes — press again to discard")).toBeVisible();
		await expect(page.locator("textarea")).toHaveValue("draft");

		await leave(page);
		await expect(page.locator("textarea")).toHaveCount(0);
	});
}

test("double-clicking a value switches to edit mode", async ({ page }) => {
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	await page.getByRole("cell", { name: "host", exact: true }).dblclick();
	await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
});

test("typing in the value view filters keys", async ({ page }) => {
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	await expect(page.getByRole("cell", { name: "host", exact: true })).toBeVisible();
	await page.keyboard.type("pass");
	await expect(page.getByPlaceholder("Filter keys…")).toHaveValue("pass");
	await expect(page.getByRole("cell", { name: "host", exact: true })).toHaveCount(0);
});

test("Escape clears the key filter before closing the value view", async ({ page }) => {
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	const filter = page.getByPlaceholder("Filter keys…");
	await filter.fill("pass");

	await page.keyboard.press("Escape");
	await expect(filter).toHaveValue("");

	await page.keyboard.press("Escape");
	await expect(filter).toHaveCount(0);
});

test("the key filter survives switching to edit mode", async ({ page }) => {
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	await page.getByPlaceholder("Filter keys…").fill("pass");
	await page.getByRole("button", { name: "Edit", exact: true }).first().click();
	await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
	await expect(page.getByPlaceholder("Filter keys…")).toHaveValue("pass");
});

test("reclaimable count ignores versions already scheduled for deletion", async ({ page }) => {
	// 20 older revisions by version_count, minus DEPRECATED_API_TOKEN's 5 already scheduled for deletion
	await expect(page.getByText("15 older revisions", { exact: false })).toBeVisible();
});

for (const [type, secret, isKeyValue] of [
	["key_value", "AWS_ACCESS_KEY_ID", true],
	["opaque", "DATABASE_URL", false],
] as const) {
	async function editSecret(page: Page) {
		await page.locator("tbody tr").filter({ hasText: secret }).click();
		await page.getByRole("button", { name: "View & Edit Value" }).click();
		await page.getByRole("button", { name: "Edit", exact: true }).first().click();
		await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
	}

	test(`${type} secrets ${isKeyValue ? "hide" : "offer"} "add section" in the structure editor`, async ({ page }) => {
		await editSecret(page);
		await expect(page.getByText("add section")).toHaveCount(isKeyValue ? 0 : 1);
	});

	test(`${type} secrets ${isKeyValue ? "refuse" : "accept"} a null value on save`, async ({ page }) => {
		await editSecret(page);
		await page.getByRole("button", { name: "Raw", exact: true }).click();
		await page.locator("textarea").fill('{"A": "x", "Z": null}');
		await page.getByRole("button", { name: "Save", exact: true }).click();
		if (isKeyValue) {
			await expect(page.getByText("Key/Value secrets only accept string values: Z")).toBeVisible();
			await expect(page.locator("textarea")).toHaveValue('{"A": "x", "Z": null}');
		} else {
			await expect(page.locator("textarea")).toHaveCount(0);
		}
	});
}

test("copies share links and expires secret values through the native clipboard bridge", async ({ page }) => {
	await page.addInitScript(() => {
		const desktop = window as unknown as {
			isTauri: boolean;
			__clipboard: string;
			__TAURI_INTERNALS__: { invoke: (command: string, args?: { text: string }) => Promise<string | void> };
		};
		desktop.isTauri = true;
		desktop.__clipboard = "";
		desktop.__TAURI_INTERNALS__ = {
			invoke: async (command, args) => {
				if (command === "plugin:clipboard-manager|write_text") desktop.__clipboard = args!.text;
				else if (command === "plugin:clipboard-manager|read_text") return desktop.__clipboard;
				else throw new Error(`Unexpected command: ${command}`);
			},
		};
	});
	await page.reload();
	const clipboard = () => page.evaluate(() => (window as unknown as { __clipboard: string }).__clipboard);
	await page.getByRole("button", { name: "Share Secret" }).click();
	await expect.poll(clipboard).toMatch(/^https:\/\/console\.scaleway\.com\/secret-manager\/secrets\//);
	await page.getByRole("button", { name: "View & Edit Value" }).click();
	await page.clock.install();
	await page.getByRole("button", { name: "Copy value (clears after 45 seconds when clipboard access is available)", exact: true }).click();
	await expect.poll(clipboard).toContain("db.fr-par.scw.cloud");
	await page.clock.fastForward(45_000);
	await expect.poll(clipboard).toBe("");
});
