import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModules } from "./helpers/load_ui_modules.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
// Loaded from files on disk, because the module resolves its icon URLs against its own location.
const [{ findRackModulationSource, RACK_MODULATION_SOURCE_PAGES }] = await loadUIModules(
    repoRoot,
    ["ui/shared/rack-modulation-sources.ts"],
);

test("Macro 4 is described with the macro family's name, icons, and accent", () => {
    const macro1 = findRackModulationSource("macro", 1);
    const macro4 = findRackModulationSource("macro", 4);

    assert.equal(macro4.sourceKind, "macro");
    assert.equal(macro4.sourceSlot, 4);
    assert.equal(macro4.label, "Macro 4");
    assert.equal(macro4.shortLabel, "MAC");
    assert.equal(macro4.iconUrl, macro1.iconUrl);
    assert.equal(macro4.identityIconUrl, macro1.identityIconUrl);
    assert.equal(macro4.accent, macro1.accent);
});

test("envelope slot 4 is the permanent Amp Envelope", () => {
    const envelope1 = findRackModulationSource("env", 1);
    const ampEnvelope = findRackModulationSource("env", 4);

    assert.equal(ampEnvelope.sourceSlot, 4);
    assert.equal(ampEnvelope.label, "Amp Envelope");
    assert.equal(ampEnvelope.shortLabel, "AMP");
    assert.equal(ampEnvelope.iconUrl, envelope1.iconUrl);
    assert.equal(ampEnvelope.accent, envelope1.accent);
});

test("a slot the synth does not have throws", () => {
    assert.throws(() => findRackModulationSource("mseg", 4), /Unknown rack modulation source: mseg 4/);
    assert.throws(() => findRackModulationSource("macro", 5), /Unknown rack modulation source: macro 5/);
    assert.throws(() => findRackModulationSource("env", 0), /Unknown rack modulation source: env 0/);
});

test("lookups return the same object the picker pages hold", () => {
    assert.equal(RACK_MODULATION_SOURCE_PAGES.length, 3);
    for (const [pageIndex, page] of RACK_MODULATION_SOURCE_PAGES.entries()) {
        for (const source of page) {
            assert.equal(source.sourceSlot, pageIndex + 1);
            assert.equal(findRackModulationSource(source.sourceKind, source.sourceSlot), source);
        }
    }
});
