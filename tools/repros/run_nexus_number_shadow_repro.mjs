import path from "node:path";
import { fileURLToPath } from "node:url";

import { webkit } from "playwright";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const htmlPath = path.join(repoRoot, "tools", "repros", "nexus-number-shadow-repro.html");

async function dragBox(page, box) {
    const x = box.x + (box.width / 2);
    const y = box.y + (box.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 50, { steps: 8 });
    await page.mouse.up();
}

const viteServer = await createServer({
    root: repoRoot,
    appType: "spa",
    logLevel: "error",
    server: {
        host: "127.0.0.1",
        port: 41739,
        strictPort: true,
    },
});

await viteServer.listen();

const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

page.on("console", (message) => {
    console.log(`[console:${message.type()}] ${message.text()}`);
});
page.on("pageerror", (error) => {
    console.error(`[pageerror] ${error.stack ?? error.message}`);
});
page.on("requestfailed", (request) => {
    console.error(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown error"}`);
});

try {
    await page.goto("http://127.0.0.1:41739/tools/repros/nexus-number-shadow-repro.html");
    await page.waitForFunction(() => Boolean(window.__repro), { timeout: 10_000 });

    const initialValues = await page.evaluate(() => window.__repro.values());
    const inputBoxes = await page.locator("#mount").evaluate(() => {
        const { plainInput, wrappedInput } = window.__repro;
        const plainRect = plainInput.getBoundingClientRect();
        const wrappedRect = wrappedInput.getBoundingClientRect();
        return {
            plain: { x: plainRect.x, y: plainRect.y, width: plainRect.width, height: plainRect.height },
            wrapped: { x: wrappedRect.x, y: wrappedRect.y, width: wrappedRect.width, height: wrappedRect.height },
        };
    });

    await dragBox(page, inputBoxes.plain);
    const afterPlainDrag = await page.evaluate(() => window.__repro.values());

    await dragBox(page, inputBoxes.wrapped);
    const afterWrappedDrag = await page.evaluate(() => window.__repro.values());

    console.log(JSON.stringify({
        htmlPath,
        initialValues,
        inputBoxes,
        afterPlainDrag,
        afterWrappedDrag,
    }, null, 2));
} finally {
    await browser.close();
    await viteServer.close();
}
