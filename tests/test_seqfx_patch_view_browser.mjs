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

test("seqfx_shift_selection_disables_trigger_latched_stutter_slices_edit", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Stutter step 3", exact: true }).click();
    await page.getByRole("button", { name: "Stutter step 4", exact: true }).click({ modifiers: ["Shift"] });

    await page.locator('[data-role="seqfx-inspector"]').getByText("Stutter steps 3-4").waitFor();
    await page.locator('[data-role="seqfx-inspector"]').getByText("Slices").waitFor();
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

test("seqfx_right_edge_drag_resizes_a_block_without_retriggering_continuation_steps", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    const first = page.getByRole("button", { name: "Tape Stop step 1", exact: true });
    const fourth = page.getByRole("button", { name: "Tape Stop step 4", exact: true });
    await first.click();

    const resizeHandle = page.locator('[data-role="seqfx-block-resize"][data-lane="2"][data-start="0"]');
    await resizeHandle.waitFor();
    const handleBox = await resizeHandle.boundingBox();
    const fourthBox = await fourth.boundingBox();

    assert.ok(handleBox);
    assert.ok(fourthBox);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fourthBox.x + fourthBox.width - 2, fourthBox.y + fourthBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    const lastUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(lastUpload.activeSteps[2].slice(0, 4), [true, true, true, true]);
    assert.deepEqual(lastUpload.triggerSteps[2].slice(0, 4), [true, false, false, false]);
    assert.equal(await page.locator('[data-role="seqfx-param"][data-param="0"]').isDisabled(), false);

    const resizedBlockBox = await page.getByRole("button", { name: "Tape Stop block 1-4", exact: true }).boundingBox();
    const firstCellBox = await first.boundingBox();
    const secondCellBox = await page.getByRole("button", { name: "Tape Stop step 2", exact: true }).boundingBox();
    assert.ok(resizedBlockBox);
    assert.ok(firstCellBox);
    assert.ok(secondCellBox);
    const cellGap = secondCellBox.x - (firstCellBox.x + firstCellBox.width);
    assert.ok(
        Math.abs(resizedBlockBox.height - firstCellBox.height) <= 1,
        `expected resized block height ${resizedBlockBox.height} to match cell height ${firstCellBox.height}`,
    );
    assert.ok(
        Math.abs(resizedBlockBox.width - ((firstCellBox.width * 4) + (cellGap * 3))) <= 1,
        `expected resized block width ${resizedBlockBox.width} to span 4 cells of ${firstCellBox.width} with gap ${cellGap}`,
    );

    await page.locator('[data-role="seqfx-delete-block"]').click();
    const deleteUpload = patternUploads(await getHarnessSnapshot(page)).at(-1).value;
    assert.deepEqual(deleteUpload.activeSteps[2].slice(0, 4), [false, false, false, false]);

    await page.close();
});

test("seqfx_single_cell_blocks_keep_the_same_square_geometry_as_grid_cells", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();

    await page.getByRole("button", { name: "Crusher step 1", exact: true }).click();
    const blockBox = await page.getByRole("button", { name: "Crusher block 1", exact: true }).boundingBox();
    const cellBox = await page.getByRole("button", { name: "Crusher step 2", exact: true }).boundingBox();
    assert.ok(blockBox);
    assert.ok(cellBox);

    assert.ok(
        Math.abs(blockBox.width - cellBox.width) <= 1,
        `expected block width ${blockBox.width} to match cell width ${cellBox.width}`,
    );
    assert.ok(
        Math.abs(blockBox.height - cellBox.height) <= 1,
        `expected block height ${blockBox.height} to match cell height ${cellBox.height}`,
    );

    await page.close();
});

test("seqfx_double_click_deletes_the_clicked_block", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Stutter step 2", exact: true }).click();
    await page.getByRole("button", { name: "Stutter block 2", exact: true }).dblclick();

    const snapshot = await getHarnessSnapshot(page);
    const deleteUpload = patternUploads(snapshot).at(-1).value;
    assert.equal(deleteUpload.activeSteps[3][1], false);
    assert.equal(deleteUpload.triggerSteps[3][1], false);
    await page.locator('[data-role="seqfx-inspector"]').getByText("Select a cell").waitFor();

    await page.close();
});

test("seqfx_dragging_block_body_moves_the_block_without_resizing_it", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Filter step 2", exact: true }).click();
    const resizeHandle = page.locator('[data-role="seqfx-block-resize"][data-lane="0"][data-start="1"]');
    await resizeHandle.waitFor();
    const handleBox = await resizeHandle.boundingBox();
    const thirdCellBox = await page.getByRole("button", { name: "Filter step 4", exact: true }).boundingBox();
    assert.ok(handleBox);
    assert.ok(thirdCellBox);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(thirdCellBox.x + thirdCellBox.width - 2, thirdCellBox.y + thirdCellBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const movedBlock = page.getByRole("button", { name: "Filter block 2-4", exact: true });
    await movedBlock.waitFor();
    const movedBlockBox = await movedBlock.boundingBox();
    const targetCellBox = await page.getByRole("button", { name: "Filter step 7", exact: true }).boundingBox();
    assert.ok(movedBlockBox);
    assert.ok(targetCellBox);

    await page.mouse.move(movedBlockBox.x + movedBlockBox.width * 0.35, movedBlockBox.y + movedBlockBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetCellBox.x + targetCellBox.width * 0.35, targetCellBox.y + targetCellBox.height / 2, { steps: 10 });
    await page.mouse.up();

    const snapshot = await getHarnessSnapshot(page);
    const moveUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(moveUpload.activeSteps[0].slice(1, 4), [false, false, false]);
    assert.deepEqual(moveUpload.activeSteps[0].slice(6, 9), [true, true, true]);
    assert.deepEqual(moveUpload.triggerSteps[0].slice(6, 9), [true, false, false]);
    await page.getByRole("button", { name: "Filter block 7-9", exact: true }).waitFor();

    await page.close();
});

test("seqfx_option_drag_copies_a_block_to_each_valid_cell_dragged_over", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(DEV_SERVER_ORIGIN);
    await page.locator('[data-role="seqfx-root"]').waitFor();
    await page.evaluate(() => window.__SEQFX_HARNESS__?.clearEvents());

    await page.getByRole("button", { name: "Crusher step 1", exact: true }).click();
    const block = page.getByRole("button", { name: "Crusher block 1", exact: true });
    await block.waitFor();
    const blockBox = await block.boundingBox();
    const fourthCellBox = await page.getByRole("button", { name: "Crusher step 4", exact: true }).boundingBox();
    assert.ok(blockBox);
    assert.ok(fourthCellBox);

    await page.keyboard.down("Alt");
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })));
    await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fourthCellBox.x + fourthCellBox.width / 2, fourthCellBox.y + fourthCellBox.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" })));
    await page.keyboard.up("Alt");

    const snapshot = await getHarnessSnapshot(page);
    const copyUpload = patternUploads(snapshot).at(-1).value;
    assert.deepEqual(copyUpload.activeSteps[1].slice(0, 4), [true, true, true, true]);
    assert.deepEqual(copyUpload.triggerSteps[1].slice(0, 4), [true, true, true, true]);
    await page.getByRole("button", { name: "Crusher block 1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Crusher block 2", exact: true }).waitFor();
    await page.getByRole("button", { name: "Crusher block 3", exact: true }).waitFor();
    await page.getByRole("button", { name: "Crusher block 4", exact: true }).waitFor();

    await page.close();
});
