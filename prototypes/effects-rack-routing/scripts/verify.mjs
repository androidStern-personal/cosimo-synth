import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.env.PROTOTYPE_ORIGIN || "http://127.0.0.1:4173";
const artifactDirectory = new URL("../artifacts/", import.meta.url);

await mkdir(artifactDirectory, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1000, height: 960 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

await page.goto(origin, { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Cutoff modulation" }).click();
requireCondition(await page.locator(".filter-graph").isVisible(), "Opening Cutoff mappings displaced the focused Filter.");
requireCondition(await page.locator(".coherent-drawer").isVisible(), "Cutoff mappings did not open around the focused Filter.");
await page.locator(".mobile-prototype").screenshot({ path: new URL("filter-focus.png", artifactDirectory).pathname });

await page.getByRole("button", { name: "Close" }).click();
await page.locator(".mod-dock button.mseg").click();
requireCondition(await page.locator(".coherent-mseg-workspace").isVisible(), "Explicitly selecting MSEG 1 did not focus its editor.");
requireCondition(!(await page.locator(".filter-graph").isVisible()), "Filter remained in the main editor after explicitly selecting MSEG 1.");

await page.locator(".target-row button").filter({ hasText: "Filter · Cutoff" }).click();
requireCondition(await page.locator(".coherent-mseg-workspace").isVisible(), "Editing an MSEG target implicitly displaced the focused MSEG editor.");
await page.locator(".mobile-prototype").screenshot({ path: new URL("mseg-focus.png", artifactDirectory).pathname });

await page.locator(".rack-item").filter({ hasText: "Filter" }).locator(".rack-main").click();
requireCondition(await page.locator(".filter-graph").isVisible(), "Explicitly selecting Filter did not return focus to Filter.");
requireCondition(consoleErrors.length === 0, `Browser errors: ${consoleErrors.join(" | ")}`);

await browser.close();
console.log("Verified the Filter and MSEG focus invariants with no implicit editor switching or browser errors.");
