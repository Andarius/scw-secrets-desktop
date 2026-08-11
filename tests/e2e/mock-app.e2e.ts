import { expect as baseExpect, test, type Page } from "@playwright/test";

import { highlightExpect, patchHighlights } from "./highlights";

const recording = process.env.PW_VIDEO === "1";
const expect: typeof baseExpect = recording
	? ((target: unknown) => highlightExpect(target)) as typeof baseExpect
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
	await expect(page.getByRole("button", { name: "View Secret Value" })).toBeVisible();
});

test("switches project from the header dropdown", async ({ page }) => {
	await page.locator("header").getByRole("button", { name: /^Project/ }).click();

	const listbox = page.getByRole("listbox");
	await expect(listbox.getByRole("option")).toHaveCount(3);

	await listbox.getByRole("option", { name: "data-pipeline" }).click();

	await expect(page.getByRole("listbox")).toBeHidden();
	await expect(page.locator("header").getByRole("button", { name: /^Project/ })).toContainText("data-pipeline");
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
	await page.getByRole("button", { name: "View Secret Value" }).click();

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
	await page.getByRole("button", { name: "View All Values" }).click();

	await expect(page.getByText("12 Secrets", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Copy All as KEY=VALUE" })).toBeVisible();
});

test("value viewer table mode sticks through edit, preview, and reload", async ({ page }) => {
	await page.getByRole("button", { name: "View Secret Value" }).click();
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
	await page.getByRole("button", { name: "View Secret Value" }).click();
	await expect(page.getByText("gcp_credentials.type", { exact: true })).toBeVisible();
});

