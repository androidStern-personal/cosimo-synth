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
    assert.equal(iosManifest.view.width, 393);
    assert.equal(iosManifest.view.height, 648);
    assert.equal(iosManifest.view.resizable, true);
    assert.deepEqual(iosManifest.source, desktopManifest.source);
    assert.deepEqual(desktopManifest.source, [
        "cmajor/FixedFrameOscillator.cmajor",
        "cmajor/Mseg.cmajor",
        "cmajor/WavetableSynth.cmajor",
    ]);
    assert.deepEqual(desktopManifest.resources, []);
    assert.deepEqual(iosManifest.resources, []);
    assert.equal("externals" in desktopManifest, false);
    assert.equal("externals" in iosManifest, false);
});

test("shared patch GUI .js files are generated from the .mjs source modules", async () => {
    for (const moduleName of [
        "responsive-layout",
        "wavetable-bank",
        "wavetable-display",
        "mseg",
        "mseg-controller",
    ]) {
        const esmSource = await fs.readFile(
            path.join(repoRoot, "patch_gui", `${moduleName}.mjs`),
            "utf8"
        );
        const browserSource = await fs.readFile(
            path.join(repoRoot, "patch_gui", `${moduleName}.js`),
            "utf8"
        );

        assert.equal(browserSource, esmSource);
    }
});

test("generated factory bank catalog points at real bundled source wavetable files", async () => {
    const desktopManifest = await loadPatchManifest("WavetableSynth.cmajorpatch");
    const iosManifest = await loadPatchManifest("WavetableSynth.iOS.cmajorpatch");
    const catalog = JSON.parse(
        await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8")
    );

    assert.deepEqual(desktopManifest.resources, []);
    assert.deepEqual(iosManifest.resources, []);
    assert.equal("externals" in desktopManifest, false);
    assert.equal("externals" in iosManifest, false);
    assert.ok(Array.isArray(catalog.tables));
    assert.ok(catalog.tables.length >= 2);
    assert.equal("sampleBlob" in catalog, false);

    for (const table of catalog.tables) {
        assert.equal(typeof table.tableId, "string");
        assert.ok(table.tableId.length > 0);
        assert.equal(typeof table.name, "string");
        assert.ok(table.name.length > 0);
        assert.equal(typeof table.sourceWav, "string");
        assert.match(table.sourceWav, /^assets\/factory_sources\//);
        assert.equal(Number.isInteger(table.frameCount), true);
        assert.ok(table.frameCount > 0);
        assert.equal("sampleOffset" in table, false);

        const sourcePath = path.join(repoRoot, table.sourceWav);
        const sourceStats = await fs.stat(sourcePath);
        assert.equal(sourceStats.isFile(), true);
    }
});

test("phone portrait layout uses a full-width scan rail and a compact host-keyboard dock", () => {
    const layout = computeResponsivePatchLayout({
        width: 390,
        height: 844,
        platform: "ios",
    });

    assert.equal(layout.isCompact, true);
    assert.equal(layout.headerStacks, true);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr)");
    assert.equal(layout.controlStyle, "scan-rail");
    assert.equal(layout.noteCount, 13);
    assert.equal(layout.stageMinHeight, 224);
    assert.equal(layout.controlHeight, 54);
    assert.equal(layout.keyboardHeight, 108);
});

test("tablet landscape keeps the flatter iOS hierarchy while using a wider keyboard dock", () => {
    const layout = computeResponsivePatchLayout({
        width: 1024,
        height: 768,
        platform: "ios",
    });

    assert.equal(layout.isCompact, false);
    assert.equal(layout.headerStacks, false);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr)");
    assert.equal(layout.controlStyle, "scan-rail");
    assert.equal(layout.noteCount, 25);
    assert.equal(layout.stageMinHeight, 284);
    assert.equal(layout.controlHeight, 54);
    assert.equal(layout.keyboardHeight, 128);
});

test("short landscape heights keep every interactive area above the minimum tap-safe size", () => {
    const layout = computeResponsivePatchLayout({
        width: 844,
        height: 390,
        platform: "ios",
    });

    assert.equal(layout.isCompact, false);
    assert.equal(layout.headerStacks, false);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr)");
    assert.equal(layout.controlStyle, "scan-rail");
    assert.equal(layout.noteCount, 17);
    assert.equal(layout.stageMinHeight, 188);
    assert.equal(layout.controlHeight, 48);
    assert.equal(layout.keyboardHeight, 94);
});

test("iOS patch view uses safe-area insets instead of drawing a nested shell inside the phone screen", async () => {
    const source = await fs.readFile(path.join(repoRoot, "patch_gui", "index.js"), "utf8");

    assert.match(source, /env\(safe-area-inset-top\)/);
    assert.match(source, /env\(safe-area-inset-bottom\)/);
    assert.match(source, /env\(safe-area-inset-left\)/);
    assert.match(source, /env\(safe-area-inset-right\)/);
});
