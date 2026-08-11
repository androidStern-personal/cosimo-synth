import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const modulationPromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");
const programPromise = loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");

test("macro is a first-class route source with four slots", async () => {
    const modulation = await modulationPromise;
    assert.equal(modulation.MODULATION_MACRO_SLOT_COUNT, 4);

    const macroOptions = modulation.MODULATION_SOURCE_OPTIONS.filter((option) => option.sourceKind === "macro");
    assert.deepEqual(macroOptions.map((option) => option.value), ["macro-1", "macro-2", "macro-3", "macro-4"]);
    assert.deepEqual(macroOptions.map((option) => option.sourceSlot), [1, 2, 3, 4]);
});

test("macro routes normalize, clamp their slot, and compile into the macro path", async () => {
    const [modulation, programModule] = await Promise.all([modulationPromise, programPromise]);
    const state = modulation.normalizeModulationState({
        format: "cosimo.modulation",
        version: 2,
        msegSlots: [],
        envelopeSlots: [],
        routes: [
            { id: "r1", enabled: true, sourceKind: "macro", sourceSlot: 2, polarity: "bipolar", targetKind: "filterCutoffOctaves", amount: 3 },
            { id: "r2", enabled: true, sourceKind: "macro", sourceSlot: 99, polarity: "unipolar", targetKind: "wavetablePosition", amount: 0.5 },
        ],
    });
    assert.equal(state.routes[0].sourceKind, "macro");
    assert.equal(state.routes[0].sourceSlot, 2);
    assert.equal(state.routes[1].sourceSlot, 4, "slots clamp to the four macro slots");

    const events = modulation.buildModulationRuntimeEvents(state);
    const programEvent = events.find((event) => event.endpointID === programModule.MODULATION_PROGRAM_ENDPOINT_ID);
    assert.notEqual(programEvent, undefined);
    assert.equal(programEvent.value.macroVoiceRouteCount, 2);
    assert.deepEqual(programEvent.value.macroVoiceRouteSources.slice(0, 2), [1, 3]);
});

test("macro names are stored, renameable, and default per ADR-010", async () => {
    const modulation = await modulationPromise;
    const fresh = modulation.createDefaultModulationState();
    assert.deepEqual(fresh.macroNames, ["Macro 1", "Macro 2", "Macro 3", "Macro 4"]);

    const renamed = modulation.normalizeModulationState({ ...fresh, macroNames: ["Shimmer", "", null, "  Grit  "] });
    assert.deepEqual(renamed.macroNames, ["Shimmer", "Macro 2", "Macro 3", "Grit"], "blank names fall back, real names trim");

    const roundtrip = modulation.deserializeModulationState(modulation.serializeModulationState(renamed));
    assert.deepEqual(roundtrip.macroNames, renamed.macroNames);

    const legacy = modulation.normalizeModulationState({ format: "cosimo.modulation", version: 2, msegSlots: [], envelopeSlots: [], routes: [] });
    assert.deepEqual(legacy.macroNames, ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], "stored state without names gets defaults");
});
