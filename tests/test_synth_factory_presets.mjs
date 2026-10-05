import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const [state, factory, kitPresets, kitDefinition, shareLink, modulation, laneState, articulation] = await Promise.all([
    loadUIModule(repoRoot, "ui/shared/synth-plugin-state.ts"),
    loadUIModule(repoRoot, "ui/shared/synth-factory-presets.ts"),
    loadUIModule(repoRoot, "kit/ui/presets.ts"),
    loadUIModule(repoRoot, "kit/ui/plugin-state-definition.ts"),
    loadUIModule(repoRoot, "ui/shared/sound-share-link.ts"),
    loadUIModule(repoRoot, "ui/shared/modulation.ts"),
    loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    loadUIModule(repoRoot, "ui/shared/articulation-image.ts"),
]);
const definition = state.synthPluginState;
const init = factory.synthFactoryPresets.find((preset) => preset.id === "init");
const documentKeys = ["modulation.v6", "lane.v1", "articulations.v4"];

/** Every `input value float32 <name> [[ ... init: <value> ... ]]` in a Cmajor source. */
async function cmajorInitValues(relativePath) {
    const source = await readFile(path.join(repoRoot, relativePath), "utf8");
    const values = {};
    for (const match of source.matchAll(/input value float32 (\w+) \[\[([^\]]*)\]\]/g)) {
        const init = /init:\s*(-?[0-9.]+)f?/.exec(match[2]);
        if (init) values[match[1]] = Number(init[1]);
    }
    return values;
}

test("the synth ships one factory preset, Init", () => {
    assert.deepEqual(factory.synthFactoryPresets.map(({ id, name }) => ({ id, name })), [{ id: "init", name: "Init" }]);
    assert.equal(definition.presetLibrary.factory.length, 1);
    assert.equal(definition.presetLibrary.factory[0].id, "init");
});

test("Init sets every synth parameter to its init value in the Cmajor source", async () => {
    const declared = {
        ...await cmajorInitValues("cmajor/WavetableSynth.cmajor"),
        ...await cmajorInitValues("cmajor/EffectsRack.cmajor"),
    };
    const parameterKeys = Object.keys(definition).filter((key) => definition[key].kind === "parameter" && definition[key].preset !== false);
    assert.equal(parameterKeys.length, 154);
    for (const key of parameterKeys) {
        assert.equal(typeof declared[key], "number", `${key} has an init value in the Cmajor source`);
        assert.equal(Math.fround(init.values[key]), Math.fround(declared[key]), `Init ${key}`);
    }
});

test("Init starts the modulation, effects rack and articulation documents from their defaults", () => {
    const encode = (key, value) => definition[key].codec.encode(definition[key].codec.parse(value).value);
    assert.equal(encode("modulation.v6", init.values["modulation.v6"]), encode("modulation.v6", modulation.createDefaultModulationState()));
    assert.equal(encode("lane.v1", init.values["lane.v1"]), encode("lane.v1", laneState.createDefaultLaneStateV2()));
    assert.equal(encode("articulations.v4", init.values["articulations.v4"]), encode("articulations.v4", articulation.createEmptyArticulationsState()));
});

test("presets and snapshots recall every parameter and document except the source mode", () => {
    const sound = kitDefinition.soundFieldKeys(definition);
    assert.equal(sound.includes("sourceMode"), false, "Bounce owns the source mode");
    for (const key of documentKeys) assert.equal(sound.includes(key), true, `${key} is part of the sound`);
    for (const key of ["presetLibrary", "activePreset", "snapshotSlots", "activeSnapshot"]) {
        assert.equal(sound.includes(key), false, `${key} is preset bookkeeping, not sound`);
    }
    assert.deepEqual(Object.keys(init.values).sort(), [...sound].sort());
});

test("the preset library belongs to the user; the active preset and snapshots belong to the project", () => {
    assert.equal(definition.presetLibrary.lifetime, "user");
    assert.equal(definition.presetLibrary.history, false);
    assert.equal(definition.activePreset.lifetime, undefined);
    assert.equal(definition.activeSnapshot.lifetime, undefined);
    assert.equal(definition.snapshotSlots.lifetime, undefined);
    assert.deepEqual(definition.snapshotSlots.slots, ["A", "B", "C", "D", "E", "F", "G"]);
});

test("sound links name the synth's manifest ID", async () => {
    for (const manifest of ["WavetableSynth.cmajorpatch", "WavetableSynth.iOS.cmajorpatch"]) {
        const { ID } = JSON.parse(await readFile(path.join(repoRoot, manifest), "utf8"));
        assert.equal(shareLink.SYNTH_PLUGIN_ID, ID, manifest);
    }
});

test("a synth preset file round-trips and refuses the source mode or another plugin", () => {
    const values = Object.fromEntries(Object.entries(init.values).map(([key, value]) => {
        const field = definition[key];
        return [key, field.kind === "parameter" ? value : field.codec.encode(field.codec.parse(value).value)];
    }));
    const text = kitPresets.presetFileText(shareLink.SYNTH_PLUGIN_ID, { name: "Shared Init", values });
    const parsed = kitPresets.parsePresetFile(text, shareLink.SYNTH_PLUGIN_ID, definition);
    assert.equal(parsed.kind, "ok", parsed.message);
    assert.equal(parsed.value.name, "Shared Init");
    assert.deepEqual(parsed.value.values, values);

    const withSourceMode = kitPresets.presetFileText(shareLink.SYNTH_PLUGIN_ID, { name: "Bounced", values: { ...values, sourceMode: 1 } });
    const refused = kitPresets.parsePresetFile(withSourceMode, shareLink.SYNTH_PLUGIN_ID, definition);
    assert.equal(refused.kind, "error");
    assert.match(refused.message, /sourceMode/);

    const otherPlugin = kitPresets.parsePresetFile(text, "dev.cosimo.chorus-lab", definition);
    assert.equal(otherPlugin.kind, "error");
    assert.match(otherPlugin.message, /dev\.cosimo\.wavetable-synth/);
});
