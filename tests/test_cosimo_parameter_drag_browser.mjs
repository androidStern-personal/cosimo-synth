import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import { createWebServer } from "../web/server.mjs";

test("real Cosimo parameter drags never replay older values during dragging or after release", { timeout: 90000 }, async () => {
    const remote = process.env.COSIMO_WEB_BASE_URL || undefined;
    const server = remote ? undefined : createWebServer(process.env.COSIMO_WEB_ROOT ?? "build/web");
    if (server) await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
    try {
        const page = await browser.newPage({ viewport: { width: 430, height: 950 } });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(new URL("synth.html?test=1", remote ?? `http://127.0.0.1:${server.address().port}/`).href);
        await page.waitForFunction(() => window.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready");
        await page.locator("#cosimo-start-overlay").click();
        await page.evaluate(() => {
            for (const note of [48, 52, 55, 60]) window.__COSIMO_WEB_POC__.noteOn(note, 0.7);
        });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        // Observe actual DOM changes rather than only the eventual settled value.
        // Listening to the real channel measures overhead; it substitutes no behavior.
        await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            const slider = view.shadowRoot.querySelector('[data-role="mobile-voice-cell-framePosition"]');
            window.dragTrace = { values: [], frames: [], messages: 0, bytes: 0, phase: "idle" };
            const record = () => window.dragTrace.values.push({ value: Number(slider.getAttribute("aria-valuenow")), phase: window.dragTrace.phase });
            window.dragObserver = new MutationObserver(record);
            window.dragObserver.observe(slider, { attributes: true, attributeFilter: ["aria-valuenow"] });
            record();
            view.patchConnection.addEventListener("kit_state", message => {
                if (window.dragTrace.phase === "idle") return;
                window.dragTrace.messages++;
                window.dragTrace.bytes += JSON.stringify(message).length;
            });
            let previous;
            const frame = now => {
                if (previous !== undefined && window.dragTrace.phase === "drag") window.dragTrace.frames.push(now - previous);
                previous = now;
                window.dragFrame = requestAnimationFrame(frame);
            };
            window.dragFrame = requestAnimationFrame(frame);
        });
        const slider = page.locator('[data-role="mobile-voice-cell-framePosition"]');
        const box = await slider.boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.evaluate(() => { window.dragTrace.phase = "drag"; });
        for (let step = 1; step <= 50; step++) await page.mouse.move(x + step * 3, y);
        await page.mouse.up();
        await page.evaluate(() => { window.dragTrace.phase = "released"; });
        await page.waitForTimeout(600); // Include delayed worklet observations after pointer-up.
        const report = await page.evaluate(() => {
            window.dragObserver.disconnect();
            cancelAnimationFrame(window.dragFrame);
            const trace = window.dragTrace;
            const reversals = trace.values.flatMap((entry, index) => index && entry.value < trace.values[index - 1].value - 0.001
                ? [{ before: trace.values[index - 1].value, after: entry.value, phase: entry.phase }] : []);
            const frames = trace.frames.sort((a, b) => a - b);
            return { reversals, final: trace.values.at(-1).value, messages: trace.messages, bytes: trace.bytes,
                frameMedianMs: frames[Math.floor(frames.length * 0.5)], frameP95Ms: frames[Math.floor(frames.length * 0.95)] };
        });
        console.log("Cosimo drag:", JSON.stringify(report));
        if (process.env.COSIMO_DRAG_REPORT) await fs.writeFile(process.env.COSIMO_DRAG_REPORT, JSON.stringify(report, null, 2));
        assert.ok(report.final > 0.5, "the actual pointer drag must move the parameter");
        assert.deepEqual(report.reversals, [], "old engine observations must never rewind a forward drag");
        assert.ok(report.messages <= 115, `50 edits must not produce redundant snapshots (${report.messages})`);
        // The user's second path: pull cutoff down using the graph, including
        // its pointer-up handoff, not a simulated parameter setter.
        const graph = await page.locator('[data-role="filter-response-graph"]').boundingBox();
        let handle = await page.locator('[data-role="filter-response-handle-hit-target"]').boundingBox();
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(graph.x + graph.width * 0.85, handle.y + handle.height / 2, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        await page.evaluate(() => {
            const view = document.querySelector("cosimo-desktop-react-view");
            const handle = view.shadowRoot.querySelector('[data-role="filter-response-handle"]');
            window.filterTrace = [Number(handle.getAttribute("cx"))];
            window.filterObserver = new MutationObserver(() => window.filterTrace.push(Number(handle.getAttribute("cx"))));
            window.filterObserver.observe(handle, { attributes: true, attributeFilter: ["cx"] });
        });
        handle = await page.locator('[data-role="filter-response-handle-hit-target"]').boundingBox();
        const filterX = handle.x + handle.width / 2, filterY = handle.y + handle.height / 2;
        await page.mouse.move(filterX, filterY);
        await page.mouse.down();
        for (let step = 1; step <= 40; step++) await page.mouse.move(filterX - graph.width * 0.65 * step / 40, filterY);
        await page.mouse.up();
        await page.waitForTimeout(600);
        const filterTrace = await page.evaluate(() => { window.filterObserver.disconnect(); return window.filterTrace; });
        assert.ok(filterTrace[0] - filterTrace.at(-1) > 100, "the filter graph must actually move");
        assert.deepEqual(filterTrace.flatMap((value, index) => index && value > filterTrace[index - 1] + 0.01
            ? [{ before: filterTrace[index - 1], after: value }] : []), [], "filter cutoff must not jump back during or after the drag");
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        if (server) await new Promise(resolve => server.close(resolve));
    }
});
