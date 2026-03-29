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
    assert.equal(layout.noteCount, 18);
    assert.equal(layout.stageMinHeight, 216);
    assert.equal(layout.controlHeight, 54);
    assert.equal(layout.keyboardHeight, 94);
    assert.equal(layout.keyboardNaturalNoteWidth, 22);
    assert.equal(layout.keyboardAccidentalWidth, 12);
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
    assert.equal(layout.noteCount, 18);
    assert.equal(layout.stageMinHeight, 252);
    assert.equal(layout.controlHeight, 54);
    assert.equal(layout.keyboardHeight, 102);
    assert.equal(layout.keyboardNaturalNoteWidth, 24);
    assert.equal(layout.keyboardAccidentalWidth, 13);
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
    assert.equal(layout.noteCount, 18);
    assert.equal(layout.stageMinHeight, 180);
    assert.equal(layout.controlHeight, 48);
    assert.equal(layout.keyboardHeight, 88);
    assert.equal(layout.keyboardNaturalNoteWidth, 20);
    assert.equal(layout.keyboardAccidentalWidth, 11);
});

test("iOS patch view uses safe-area insets instead of drawing a nested shell inside the phone screen", async () => {
    const source = await fs.readFile(path.join(repoRoot, "patch_gui", "index.js"), "utf8");

    assert.match(source, /env\(safe-area-inset-top\)/);
    assert.match(source, /env\(safe-area-inset-bottom\)/);
    assert.match(source, /env\(safe-area-inset-left\)/);
    assert.match(source, /env\(safe-area-inset-right\)/);
});

test("iOS patch view pins the keyboard footer and removes the separate hero and frame-scan sections", async () => {
    const source = await fs.readFile(path.join(repoRoot, "patch_gui", "index.js"), "utf8");

    assert.match(source, /grid-template-rows:\s*minmax\(0,\s*1fr\)\s*auto;/);
    assert.match(source, /\.ios-scroll\s*\{[\s\S]*overflow-y:\s*auto;/);
    assert.match(source, /class="keyboard-footer"/);
    assert.match(source, /class="octave-button octave-down"/);
    assert.match(source, /class="octave-button octave-up"/);
    assert.match(source, /class="wavetable-display-stack"/);
    assert.match(source, /class="bank-picker-trigger"/);
    assert.match(source, /class="table-select table-select-overlay"/);
    assert.match(source, /data-role="display-status"/);
    assert.match(source, /data-role="table-error-banner"/);
    assert.match(source, /Swipe \+ Drag/);
    assert.doesNotMatch(source, /<span class="position-label">Table<\/span>/);
    assert.doesNotMatch(source, /class="wavetable-meta"/);
    assert.doesNotMatch(source, /class="position-readout"/);
    assert.match(source, /background:\s*#04070f;/);
    assert.match(source, /\.wavetable-stage\s*\{[\s\S]*border-radius:\s*0;/);
    assert.match(source, /\.wavetable-stage\s*\{[\s\S]*background:\s*transparent;/);
    assert.match(source, /\.mseg-editor-shell\s*\{[\s\S]*border-radius:\s*0;/);
    assert.match(source, /\.mseg-editor-shell\s*\{[\s\S]*border:\s*0;/);
    assert.match(source, /\.mseg-editor-shell\s*\{[\s\S]*background:\s*transparent;/);
    assert.match(source, /class="mseg-rate-slider"/);
    assert.match(source, /data-role="mseg-rate-readout"/);
    assert.match(source, /class="mseg-loop-toggle"/);
    assert.doesNotMatch(source, /class="hero"/);
    assert.doesNotMatch(source, /class="scan-panel"/);
    assert.doesNotMatch(source, /class="scan-slider"/);
});

test("iOS keyboard defaults to a tighter one-and-a-half-octave span starting one octave lower than before", async () => {
    const source = await fs.readFile(path.join(repoRoot, "patch_gui", "index.js"), "utf8");
    const layoutSource = await fs.readFile(path.join(repoRoot, "patch_gui", "responsive-layout.mjs"), "utf8");

    assert.match(source, /this\.keyboardRootNote = 36;/);
    assert.match(source, /this\.keyboardMinRootNote = 12;/);
    assert.match(source, /this\.keyboardMaxRootNote = 72;/);
    assert.match(source, /this\.keyboard\.setAttribute\("note-count", `\$\{this\.currentLayout\.noteCount\}`\);/);
    assert.match(source, /attributeChangedCallback\(name, oldValue, newValue\)/);
    assert.match(source, /this\.refreshHTML\(\);/);
    assert.match(source, /return `\$\{formatNote\(startNote\)\} - \$\{formatNote\(lastNote\)\}`;/);
    assert.match(layoutSource, /noteCount:\s*18,/);
});
