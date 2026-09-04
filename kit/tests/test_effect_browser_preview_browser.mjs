import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import { createServer } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../..");
let fixtureRoot;
let server;
let browser;
let origin;

before(async () => {
    // Fail before starting Vite if this npm install needs a browser download.
    browser = await chromium.launch({ headless: true });
    // Only shipped project inputs are used. This suite also runs unchanged
    // inside an export with its own npm install and no monorepo access.
    fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kit-browser-preview-"));
    await fs.mkdir(path.join(fixtureRoot, "fx"));
    for (const relative of ["kit", "fx/enhancer_lite", "product-owner.json", "package.json"]) {
        await fs.cp(path.join(repoRoot, relative), path.join(fixtureRoot, relative), { recursive: true, verbatimSymlinks: true });
    }
    // npm packages only: no toolchain, compiled runtime, or Cmajor sources
    // from another worktree are needed for the silent UI route.
    await fs.symlink(path.join(repoRoot, "node_modules"), path.join(fixtureRoot, "node_modules"));
    const { scaffoldPlugin } = await import(pathToFileURL(path.join(fixtureRoot, "kit/scripts/new_plugin.mjs")));
    scaffoldPlugin("preview_probe");
    scaffoldPlugin("custom_probe");
    scaffoldPlugin("linked_probe");
    await fs.writeFile(path.join(fixtureRoot, "fx/custom_probe/view/harness.html"),
        '<!doctype html><html><body><main id="custom-harness">Existing custom harness</main></body></html>');
    await fs.writeFile(path.join(fixtureRoot, "outside-fx.html"), "Must not be served by the harness route.");
    await fs.symlink(path.join(fixtureRoot, "outside-fx.html"), path.join(fixtureRoot, "fx/linked_probe/view/harness.html"));
    assert.equal(existsSync(path.join(fixtureRoot, "fx/enhancer_lite/view/harness.html")), false);
    assert.equal(existsSync(path.join(fixtureRoot, "fx/preview_probe/view/harness.html")), false);
    assert.equal(existsSync(path.join(fixtureRoot, "build")), false);
    server = await createServer({
        configFile: path.join(fixtureRoot, "kit/fx/vite.config.mjs"),
        logLevel: "error",
        server: { host: "127.0.0.1", port: 0, open: false },
    });
    await server.listen();
    origin = `http://127.0.0.1:${server.httpServer.address().port}`;
});

after(async () => {
    await browser?.close();
    await server?.close();
    if (fixtureRoot) await fs.rm(fixtureRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

async function openPreview(directory) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    const response = await page.goto(`${origin}/fx/${directory}/view/harness.html`);
    assert.equal(response.status(), 200);
    await page.locator("#plugin-preview > *").waitFor();
    assert.equal(await page.locator("#preview-error").isVisible(), false);
    assert.match(await page.locator("aside").innerText(), /No audio engine, DAW connection, or live analyzer audio/u);
    return { page, errors, requests };
}

async function saveProof(page, name) {
    if (!process.env.KIT_BROWSER_PROOF_DIR) return;
    const directory = path.resolve(process.env.KIT_BROWSER_PROOF_DIR);
    await fs.mkdir(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

test("documented included-example route initializes the production UI and normal preset bindings", async () => {
    const { page, errors, requests } = await openPreview("enhancer_lite");
    try {
        assert.match(await page.locator("#preview-title").innerText(), /Cosimo Enhancer Lite — UI preview/u);
        const view = page.locator("cosimo-enhancer-lite-view");
        assert.equal(await view.locator("[data-readout='frequency']").textContent(), "130 Hz");
        assert.equal(await view.locator("[data-readout='q']").textContent(), "0.71");
        assert.equal(await view.locator("cosimo-snapshot-bar [data-slot]").count(), 7);
        const amount = view.locator("[data-readout-control='primary-amount']");
        await amount.focus();
        await page.keyboard.press("ArrowUp");
        assert.ok(Number(await amount.getAttribute("aria-valuenow")) > 0, "a real UI gesture must round-trip through parameter listeners");
        await view.locator("cosimo-preset-bar [data-action='toggle-flyout']").click();
        await view.locator("[data-preset-key='factory:enhancer-lite.vocal-presence']").click();
        assert.equal(await view.locator("[data-readout='frequency']").textContent(), "3.20 kHz", "the real preset bar must apply the sound using host-status metadata");
        assert.ok(requests.includes("/fx/enhancer_lite/view/source.ts"));
        assert.ok(!requests.some((request) => request.includes("module_test_shell") || request.includes("/build/")));
        assert.deepEqual(errors, []);
        await saveProof(page, "included-example");
    } finally {
        await page.close();
    }
});

test("ordinary kit:new starter works at its documented route without a custom harness or UI build", async () => {
    const { page, errors, requests } = await openPreview("preview_probe");
    try {
        const view = page.locator("preview-probe-view");
        const gain = view.locator("input[type=range]");
        assert.equal(await gain.inputValue(), "0");
        assert.equal(await view.locator("[data-readout]").textContent(), "+0.0 dB");
        await gain.focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await gain.inputValue(), "0.1");
        assert.equal(await view.locator("[data-readout]").textContent(), "+0.1 dB");
        assert.ok(requests.includes("/fx/preview_probe/view/source.ts"));
        assert.deepEqual(errors, []);
        await saveProof(page, "generated-starter");
    } finally {
        await page.close();
    }
});

test("custom harnesses remain intact and unknown plugin routes fail instead of showing a substitute", async () => {
    const custom = await fetch(`${origin}/fx/custom_probe/view/harness.html`);
    assert.equal(custom.status, 200);
    assert.match(await custom.text(), /id="custom-harness"/u);
    const absent = await fetch(`${origin}/fx/not_a_plugin/view/harness.html`);
    assert.equal(absent.status, 404);
    for (const route of [
        "/fx/%zz/view/harness.html",
        "/fx/%2e%2e%2f%2e%2e%2fmissing/view/harness.html",
        "/fx/linked_probe/view/harness.html",
    ]) {
        const forbidden = await fetch(`${origin}${route}`);
        assert.equal(forbidden.status, 403, route);
    }
});
