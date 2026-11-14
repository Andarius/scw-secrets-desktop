import { launch } from "@gpuix/react/automation";

// Drives the sample-mode app; optionally pauses so the window can be captured.
const binary = process.env.APP_BINARY;
const app = await launch({ command: binary ?? "bun", args: binary ? [] : ["app.tsx"], env: { SCW_GPUIX_SAMPLE: "1" } });
const check = (ok: boolean, what: string) => {
	if (!ok) throw new Error(`FAIL: ${what}`);
	console.log(`ok: ${what}`);
};
const count = (id: string) => app.getByTestId(id).count();
const until = async (done: () => Promise<boolean>) => {
	const deadline = Date.now() + 5_000;
	while (!(await done()) && Date.now() < deadline) await Bun.sleep(100);
	return done();
};
try {
	await app.getByTestId("secret-DATABASE_URL").waitFor({ timeoutMs: 60_000 });
	check((await count("secret-SMTP_API_KEY")) === 1 && (await count("secret-WEBHOOK_SIGNING_KEY")) === 1, "lists the project's secrets");
	check((await app.getByTestId("detail-name").textContent()) === "DEPRECATED_API_TOKEN", "selects the first secret (most versions)");

	await app.getByTestId("path-/infra").click();
	check(await until(async () => (await count("secret-DATABASE_URL")) === 0 && (await count("secret-AWS_ACCESS_KEY_ID")) === 1), "path tree filters the inventory");
	await app.getByTestId("path-all").click();

	await app.getByTestId("search").fill("stripe");
	check(await until(async () => (await count("secret-SMTP_API_KEY")) === 0 && (await count("secret-STRIPE_SECRET_KEY")) === 1), "search filters the inventory");
	check(await until(async () => (await app.getByTestId("detail-name").textContent()) === "STRIPE_SECRET_KEY"), "detail follows the visible selection");

	// the button starts below the Detail panel fold at 1280x800
	await app.getByTestId("detail-name").wheel(0, -600);
	await until(async () => (await app.getByTestId("view-value").bounds()).y < 600);
	await app.getByTestId("view-value").click();
	await app.getByTestId("value-modal").waitFor({ timeoutMs: 5_000 });
	check((await app.getByTestId("value").textContent())?.includes("p4ss-Xk29") ?? false, "view value shows the decoded value");
	await app.getByTestId("close-value").click();
	check(await until(async () => (await count("value-modal")) === 0), "close dismisses the value view");
	if (process.env.HOLD) await Bun.sleep(Number(process.env.HOLD));
} finally {
	await app.close();
}
