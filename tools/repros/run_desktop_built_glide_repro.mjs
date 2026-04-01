import path from "node:path";
import { fileURLToPath } from "node:url";

import { webkit } from "playwright";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

const viteServer = await createServer({
    root: repoRoot,
    appType: "spa",
    logLevel: "error",
    server: {
        host: "127.0.0.1",
        port: 41740,
        strictPort: true,
        fs: { allow: [repoRoot] },
    },
});

await viteServer.listen();

const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

page.on("console", (message) => {
    console.log(`[console:${message.type()}] ${message.text()}`);
});
page.on("pageerror", (error) => {
    console.error(`[pageerror] ${error.stack ?? error.message}`);
});

try {
    await page.goto("http://127.0.0.1:41740/tools/repros/desktop-built-glide-repro.html");
    await page.waitForFunction(() => Boolean(window.__repro?.view?.shadowRoot), { timeout: 10_000 });

    const glideInput = page.locator('input[aria-label="Glide"]');
    await glideInput.waitFor({ state: "visible", timeout: 10_000 });

    const initialValue = await glideInput.inputValue();
    const box = await glideInput.boundingBox();

    if (!box) {
        throw new Error("Glide input has no bounding box.");
    }

    const x = box.x + (box.width / 2);
    const y = box.y + (box.height / 2);

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 60, { steps: 8 });
    await page.mouse.up();

    const afterDragValue = await glideInput.inputValue();

    await glideInput.click();
    await glideInput.fill("0.375");
    await glideInput.press("Enter");
    const afterTypeValue = await glideInput.inputValue();

    console.log(JSON.stringify({
        initialValue,
        afterDragValue,
        afterTypeValue,
        box,
    }, null, 2));
} finally {
    await browser.close();
    await viteServer.close();
}
