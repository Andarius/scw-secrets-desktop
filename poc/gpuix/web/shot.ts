// Drives the WASM build and screenshots it: bun web/shot.ts <outdir> [click:x,y | dbl:x,y | type:text | wait:ms | shot:name]...
import { chromium } from "playwright-core";

const [outdir, ...steps] = process.argv.slice(2);
const exe = "/snap/chromium/current/usr/lib/chromium-browser/chrome";
const browser = await chromium.launch({
	executablePath: (await Bun.file(exe).exists()) ? exe : undefined,
	args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.log(`[error] ${m.text()}`));
await page.goto(process.env.URL ?? "http://127.0.0.1:5299/");
await page.waitForTimeout(3000);
for (const step of steps.length ? steps : ["shot:home"]) {
	const [action, arg] = [step.slice(0, step.indexOf(":")), step.slice(step.indexOf(":") + 1)];
	const [x, y] = arg.split(",").map(Number);
	if (action === "click") await page.mouse.click(x, y);
	else if (action === "dbl") await page.mouse.dblclick(x, y);
	else if (action === "type") await page.keyboard.type(arg, { delay: 30 });
	else if (action === "wait") await page.waitForTimeout(Number(arg));
	else if (action === "shot") await page.screenshot({ path: `${outdir}/${arg}.png` });
	await page.waitForTimeout(400);
}
await browser.close();
