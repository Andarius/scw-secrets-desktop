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
	await expect(page.getByRole("heading", { name: "SCW Secrets" })).toBeVisible();
});

test("loads the mock inventory with the default selection", async ({ page }) => {
	await expect(inventoryRows(page)).toHaveCount(12);
	await expect(page.locator("tbody tr").filter({ hasText: "DATABASE_URL" })).toHaveCount(1);
	await expect(page.locator("header").getByText("webapp-api", { exact: true }).last()).toBeVisible();
	await expect(page.getByRole("button", { name: "View Secret Value" })).toBeVisible();
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

test("opens single-secret and batch value overlays", async ({ page }) => {
	await page.getByRole("button", { name: "View Secret Value" }).click();

	await expect(page.getByText("mock-value-placeholder", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByText("mock-value-placeholder", { exact: true })).toHaveCount(0);

	await page.getByRole("button", { name: "Select All" }).click();

	await expect(page.getByText("12 SELECTED")).toBeVisible();
	await page.getByRole("button", { name: "View All Values" }).click();

	await expect(page.getByText("12 Secrets", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Copy All as KEY=VALUE" })).toBeVisible();
});
