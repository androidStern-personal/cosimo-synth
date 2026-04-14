import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import { chromium } from "playwright";

const DEV_SERVER_ORIGIN = "http://127.0.0.1:5175";

let serverProcess;
let browser;

async function waitForServer() {
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt < 20_000) {
        try {
            const response = await fetch(`${DEV_SERVER_ORIGIN}/__seqfx-dev-status`);
            if (response.ok) {
                return;
            }
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`SeqFX Vite dev server did not start: ${lastError?.message ?? "timeout"}`);
}

async function getHarnessSnapshot(page) {
    return page.evaluate(() => window.__SEQFX_HARNESS__?.getSnapshot());
}

function patternUploads(snapshot) {
    return snapshot.events.filter((entry) => entry.endpointID === "patternUpload");
}

before(async () => {
    serverProcess = spawn("npm", ["run", "seqfx:ui:dev"], {
        cwd: new URL("..", import.meta.url).pathname,
        stdio: ["ignore", "pipe", "pipe"],
    });

    await waitForServer();
    browser = await chromium.launch();
});

after(async () => {
    await browser?.close();

    if (serverProcess) {
        serverProcess.kill("SIGTERM");
    }
});

test("seqfx_grid_cell_and_inspector_edits_send_complete_pattern_uploads", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Filter step 1", exact: true }).click();
    await assert.rejects(
        page.locator('[data-role="seqfx-inspector"]').getByText("Select a cell").waitFor({ timeout: 400 }),
    );
    await assert.doesNotReject(
        page.locator('[data-role="seqfx-inspector"]').getByText("Filter step 1").waitFor({ timeout: 400 }),
    );

    const cutoffInput = page.locator('[data-role="seqfx-param"][data-param="1"]');
    await cutoffInput.fill("330");
    await cutoffInput.dispatchEvent("change");

    const snapshot = await getHarnessSnapshot(page);
    const uploads = patternUploads(snapshot);
    assert.ok(uploads.length >= 2);
    assert.equal(uploads.at(-1).value.activeSteps[0][0], true);
    assert.equal(uploads.at(-1).value.params[0][0][1], 330);

    await page.close();
});

test("seqfx_shift_selection_disables_trigger_latched_stutter_slice_edit", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Stutter step 3", exact: true }).click();
    await page.getByRole("button", { name: "Stutter step 4", exact: true }).click({ modifiers: ["Shift"] });

    await page.locator('[data-role="seqfx-inspector"]').getByText("Stutter steps 3-4").waitFor();
    await assert.doesNotReject(
        page.locator('[data-role="seqfx-param"][data-param="0"]').waitFor({ state: "attached" }),
    );
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="0"]').isDisabled(), true);

    await page.close();
});

test("seqfx_pattern_buttons_send_pattern_select_and_authoritative_upload", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.locator('[data-role="seqfx-pattern"][data-pattern="4"]').click();

    const snapshot = await getHarnessSnapshot(page);
    assert.equal(snapshot.events.some((entry) => entry.endpointID === "patternSelect" && entry.value === 4), true);
    assert.equal(patternUploads(snapshot).at(-1).value.patternIndex, 4);
    assert.equal(patternUploads(snapshot).at(-1).value.authoritative, true);

    await page.close();
});

test("seqfx_drag_paints_a_contiguous_lane_block", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const first = page.getByRole("button", { name: "Crusher step 1", exact: true });
    const fourth = page.getByRole("button", { name: "Crusher step 4", exact: true });
    const firstBox = await first.boundingBox();
    const fourthBox = await fourth.boundingBox();

    assert.ok(firstBox);
    assert.ok(fourthBox);

    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fourthBox.x + fourthBox.width / 2, fourthBox.y + fourthBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    const lastUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(lastUpload.activeSteps[1].slice(0, 4), [true, true, true, true]);

    await page.close();
});
