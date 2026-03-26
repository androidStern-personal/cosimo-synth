import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { computeResponsivePatchLayout } from "../patch_gui/responsive-layout.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadPatchManifest(fileName) {
    return JSON.parse(
        await fs.readFile(path.join(repoRoot, fileName), "utf8")
    );
}

test("iOS patch manifest keeps the synth graph but switches to the mobile editor entry point", async () => {
    const desktopManifest = await loadPatchManifest("WavetableSynth.cmajorpatch");
    const iosManifest = await loadPatchManifest("WavetableSynth.iOS.cmajorpatch");

    assert.equal(iosManifest.view.src, "patch_gui/index.ios.js");
    assert.equal(iosManifest.view.width, 376);
    assert.equal(iosManifest.view.height, 648);
    assert.equal(iosManifest.view.resizable, true);
    assert.deepEqual(iosManifest.source, desktopManifest.source);
    assert.deepEqual(iosManifest.resources, desktopManifest.resources);
    assert.deepEqual(iosManifest.externals, desktopManifest.externals);
});

test("phone portrait layout stacks the control rail and shrinks the keyboard to a playable mobile size", () => {
    const layout = computeResponsivePatchLayout({
        width: 390,
        height: 844,
        platform: "ios",
    });

    assert.equal(layout.isCompact, true);
    assert.equal(layout.headerStacks, true);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr)");
    assert.equal(layout.noteCount, 13);
    assert.equal(layout.knobSize, 112);
    assert.equal(layout.stageMinHeight, 210);
    assert.equal(layout.keyboardHeight, 98);
});

test("tablet landscape layout keeps a side control rail without carrying over the desktop canvas size", () => {
    const layout = computeResponsivePatchLayout({
        width: 1024,
        height: 768,
        platform: "ios",
    });

    assert.equal(layout.isCompact, false);
    assert.equal(layout.headerStacks, false);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr) 220px");
    assert.equal(layout.noteCount, 25);
    assert.equal(layout.knobSize, 140);
    assert.equal(layout.stageMinHeight, 260);
    assert.equal(layout.keyboardHeight, 118);
});

test("short landscape heights keep every interactive area above the minimum tap-safe size", () => {
    const layout = computeResponsivePatchLayout({
        width: 844,
        height: 390,
        platform: "ios",
    });

    assert.equal(layout.isCompact, false);
    assert.equal(layout.headerStacks, false);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr) 180px");
    assert.equal(layout.noteCount, 17);
    assert.equal(layout.knobSize, 108);
    assert.equal(layout.stageMinHeight, 180);
    assert.equal(layout.keyboardHeight, 92);
});
