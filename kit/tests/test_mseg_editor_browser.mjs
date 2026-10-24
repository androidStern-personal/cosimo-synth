import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";

import { build } from "esbuild";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "../..");
const view = `
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Mseg } from "./kit/index";
function View() {
    const [shape, setShape] = useState(Mseg.defaultCurve());
    window.shape = shape;
    window.gestures ??= [];
    return <Mseg.Editor value={shape} onValueChange={setShape} surfaceProps={{ "data-role": "mseg-editor" }}
        onGestureStart={() => window.gestures.push("start")}
        onGestureEnd={(cancelled) => window.gestures.push(cancelled ? "cancel" : "end")}
        style={{ width: 400, height: 180 }} />;
}
createRoot(document.querySelector("main")).render(<View />);
`;
// Vite's `?inline` CSS imports, as esbuild text.
const inlineCss = {
    name: "inline-css",
    setup(builder) {
        builder.onResolve({ filter: /\.css\?inline$/ }, (args) => ({ path: path.resolve(args.resolveDir, args.path.replace("?inline", "")), namespace: "css-text" }));
        builder.onLoad({ filter: /.*/, namespace: "css-text" }, async (args) => ({ contents: await readFile(args.path, "utf8"), loader: "text" }));
    },
};

let directory;
let server;
let browser;
let origin;

before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "kit-mseg-editor-"));
    await build({ stdin: { contents: view, resolveDir: root, loader: "tsx" }, outfile: path.join(directory, "app.js"), bundle: true,
        format: "esm", platform: "browser", jsx: "automatic", logLevel: "silent", plugins: [inlineCss] });
    await writeFile(path.join(directory, "index.html"), '<!doctype html><main></main><script type="module" src="/app.js"></script>');
    server = createServer(async (request, response) => {
        const file = request.url === "/app.js" ? "app.js" : "index.html";
        response.writeHead(200, { "content-type": file.endsWith(".js") ? "text/javascript" : "text/html" });
        response.end(await readFile(path.join(directory, file)));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (directory) await rm(directory, { recursive: true, force: true });
});

const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

test("Mseg.Editor adds, moves, bends and deletes points, and a cancelled drag keeps what was accepted", async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    try {
        await page.goto(origin);
        const surface = page.locator("[data-role=mseg-editor]");
        await surface.waitFor();
        await page.waitForFunction(() => window.shape?.points.length === 2);
        const box = await surface.boundingBox();

        // Click on empty space adds a point; dragging it moves it.
        await page.mouse.click(box.x + 180, box.y + 125);
        await page.waitForFunction(() => window.shape.points.length === 3);
        const point = page.locator('[data-point-index="1"]');
        let at = centre(await point.boundingBox());
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(box.x + 260, box.y + 55, { steps: 4 });
        await page.mouse.up();
        let shape = await page.evaluate(() => window.shape);
        assert.ok(shape.points[1].x > 0.6 && shape.points[1].y > 0.6);

        // Dragging a segment's midpoint bends its curve.
        const circles = await page.locator("[data-role=mseg-point]").evaluateAll((elements) => elements.map((element) => {
            const r = element.getBoundingClientRect();
            const s = element.closest("svg").getBoundingClientRect();
            return { x: r.x + r.width / 2 - s.x, y: r.y + r.height / 2 - s.y };
        }));
        const segment = { x: box.x + (circles[0].x + circles[1].x) / 2, y: box.y + (circles[0].y + circles[1].y) / 2 };
        await page.mouse.move(segment.x, segment.y);
        await page.mouse.down();
        await page.mouse.move(segment.x, segment.y + 24, { steps: 3 });
        await page.mouse.up();
        shape = await page.evaluate(() => window.shape);
        assert.ok(Math.abs(shape.points[0].curvePower) > 0.1);

        // Clicking a point deletes it.
        at = centre(await point.boundingBox());
        await page.mouse.click(at.x, at.y);
        await page.waitForFunction(() => window.shape.points.length === 2);

        // A cancelled drag keeps the movement already accepted and applies no release-only edit.
        const original = await page.evaluate(() => window.shape);
        at = centre(await page.locator('[data-point-index="1"]').boundingBox());
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(box.x + 380, box.y + 90, { steps: 3 });
        const accepted = await page.evaluate(() => window.shape);
        assert.notDeepEqual(accepted, original);
        await surface.dispatchEvent("pointercancel", { pointerId: 1 });
        await page.mouse.up();
        assert.deepEqual(await page.evaluate(() => window.shape), accepted);
        assert.ok((await page.evaluate(() => window.gestures)).includes("cancel"));
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});
