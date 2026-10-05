import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const { definePluginState, parameter, storedValue, soundFieldKeys, savedInProject } = await loadUIModule(repoRoot, "kit/ui/plugin-state-definition.ts");
const { presets, presetFileText, parsePresetFile, sameSoundValue } = await loadUIModule(repoRoot, "kit/ui/presets.ts");
const { snapshots } = await loadUIModule(repoRoot, "kit/ui/snapshots.ts");

const modeCodec = {
    parse: input => input === "clean" || input === "warm" ? { kind: "ok", value: input } : { kind: "error", message: "Expected clean or warm." },
    encode: value => value,
    equals: Object.is,
};
const sound = () => ({ gain: parameter("gainIn"), mode: storedValue({ initial: "clean", codec: modeCodec }) });
const factory = [
    { id: "quiet", name: "Quiet", values: { gain: -12, mode: "clean" } },
    { id: "hot", name: "Hot", values: { gain: 6, mode: "warm" } },
];

test("sound fields are every field except the kit's own and those declared preset: false", () => {
    const definition = definePluginState({
        ...sound(),
        meter: parameter("meterIn", { preset: false }),
        panel: storedValue({ initial: "clean", codec: modeCodec, lifetime: "instance", preset: false }),
        ...presets({ factory }),
        ...snapshots(),
    });
    assert.deepEqual(soundFieldKeys(definition), ["gain", "mode"]);
    assert.equal(definition.presetLibrary.lifetime, "user");
    assert.equal(savedInProject(definition.presetLibrary), false, "the user library is never written into a project");
    for (const key of ["activePreset", "snapshotSlots", "activeSnapshot"]) assert.equal(savedInProject(definition[key]), true, key);
    assert.equal(definition.activePreset.history, undefined, "recalling a preset is undoable");
    assert.equal(definition.snapshotSlots.history, false, "slot contents are library data");
});

test("definePluginState checks every factory preset against the sound fields", () => {
    const define = presetList => () => definePluginState({ ...sound(), ...presets({ factory: presetList }) });
    assert.doesNotThrow(define(factory));
    assert.throws(define([{ id: "x", name: "Extra", values: { gain: 0, mode: "clean", drive: 1 } }]),
        /Factory preset "Extra" sets "drive", which is not a sound field/);
    assert.throws(define([{ id: "x", name: "Partial", values: { gain: 0 } }]),
        /Factory preset "Partial" is missing "mode"\. Give it a value, or declare the field with preset: false\./);
    assert.throws(define([factory[0], { ...factory[1], id: "quiet" }]), /Factory preset id "quiet" is used twice/);
    assert.throws(define([{ id: "x", name: "Loud", values: { gain: "max", mode: "clean" } }]),
        /Factory preset "Loud" has an invalid value for "gain": Expected a finite number\./);
    assert.throws(define([{ id: "x", name: "Odd", values: { gain: 0, mode: "fuzzy" } }]),
        /Factory preset "Odd" has an invalid value for "mode": Expected clean or warm\./);
    assert.throws(() => definePluginState({ ...sound(), meter: parameter("meterIn", { preset: false }),
        ...presets({ factory: [{ id: "x", name: "Metered", values: { gain: 0, mode: "clean", meter: 1 } }] }) }),
    /sets "meter", which is not a sound field/, "a field declared preset: false is not part of a preset");
});

test("the library and active-preset codecs accept only well-formed presets", () => {
    const { presetLibrary, activePreset } = presets();
    const library = { version: 1, presets: [{ id: "user-1", name: "Mine", values: { gain: 1, mode: "warm" } }] };
    const parsed = presetLibrary.codec.parse(library);
    assert.deepEqual(parsed, { kind: "ok", value: library });
    assert.ok(Object.isFrozen(parsed.value.presets[0].values), "accepted values are immutable");
    assert.equal(presetLibrary.codec.equals(parsed.value, { version: 1, presets: [{ name: "Mine", values: { mode: "warm", gain: 1 }, id: "user-1" }] }), true,
        "equality ignores key order");
    for (const invalid of [
        { version: 2, presets: [] },
        { version: 1, presets: [{ id: "", name: "Nameless id", values: {} }] },
        { version: 1, presets: [{ id: "a", name: " ", values: {} }] },
        { version: 1, presets: [{ id: "a", name: "A", values: { gain: Number.NaN } }] },
        { version: 1, presets: [{ id: "a", name: "A", values: {} }, { id: "a", name: "B", values: {} }] },
    ]) assert.equal(presetLibrary.codec.parse(invalid).kind, "error", JSON.stringify(invalid));
    assert.deepEqual(activePreset.codec.parse(null), { kind: "ok", value: null });
    assert.equal(activePreset.codec.parse({ id: "a", name: "A", values: [] }).kind, "error");
});

test("snapshot codecs tolerate slots a plugin update added or removed", () => {
    const { snapshotSlots, activeSnapshot } = snapshots({ slots: ["A", "B"] });
    assert.deepEqual(snapshotSlots.initial, { kind: "ok", value: { A: null, B: null } });
    assert.deepEqual(snapshotSlots.codec.parse({ A: { values: { gain: 1 } }, Z: { values: {} } }),
        { kind: "ok", value: { A: { values: { gain: 1 } }, B: null } });
    assert.equal(snapshotSlots.codec.parse({ A: { values: [1] } }).kind, "error");
    assert.deepEqual(activeSnapshot.codec.parse("B"), { kind: "ok", value: "B" });
    assert.deepEqual(activeSnapshot.codec.parse("Z"), { kind: "ok", value: null });
    assert.equal(activeSnapshot.codec.parse(3).kind, "error");
    assert.throws(() => snapshots({ slots: ["A", "A"] }), /distinct, non-empty names/);
    assert.deepEqual(snapshots().snapshotSlots.slots, ["A", "B", "C", "D", "E", "F", "G"]);
});

test("a preset file imports only into the same plugin and only sets sound fields", () => {
    const definition = definePluginState({ ...sound(), meter: parameter("meterIn", { preset: false }), ...presets(), ...snapshots() });
    const text = presetFileText("com.example.gain", { name: "Hot", values: { gain: 6, mode: "warm" } });
    assert.deepEqual(JSON.parse(text), { kind: "builder-kit.preset", version: 1, plugin: "com.example.gain", name: "Hot", values: { gain: 6, mode: "warm" } });
    assert.deepEqual(parsePresetFile(text, "com.example.gain", definition), { kind: "ok", value: { name: "Hot", values: { gain: 6, mode: "warm" } } });
    assert.deepEqual(parsePresetFile(presetFileText("com.example.gain", { name: "Half", values: { gain: 1 } }), "com.example.gain", definition),
        { kind: "ok", value: { name: "Half", values: { gain: 1 } } }, "a preset may leave fields unchanged");
    const rejects = (input, message) => assert.deepEqual(parsePresetFile(input, "com.example.gain", definition), { kind: "error", message });
    rejects("{", "This is not a preset file: it is not valid JSON.");
    rejects(JSON.stringify({ kind: "another-app.preset", version: 2 }), "This is not a Builder Kit preset file.");
    rejects(presetFileText("com.example.other", { name: "Hot", values: {} }), 'This preset is for the plugin "com.example.other", not "com.example.gain".');
    rejects(presetFileText("com.example.gain", { name: "Metered", values: { meter: 1 } }), 'The preset sets "meter", which this plugin does not keep in presets.');
    rejects(presetFileText("com.example.gain", { name: "Library", values: { presetLibrary: {} } }), 'The preset sets "presetLibrary", which this plugin does not keep in presets.');
    rejects(presetFileText("com.example.gain", { name: "Odd", values: { mode: "fuzzy" } }), 'The preset has an invalid value for "mode": Expected clean or warm.');
    rejects(presetFileText("com.example.gain", { name: " ", values: {} }), "The preset file has no name.");
});

test("a parameter restored by the host as a 32-bit float still matches its preset", () => {
    const gain = parameter("gainIn");
    assert.equal(sameSoundValue(gain, 0.71, Math.fround(0.71)), true);
    assert.equal(sameSoundValue(gain, 0.71, 0.72), false);
    const mode = storedValue({ initial: "clean", codec: modeCodec });
    assert.equal(sameSoundValue(mode, "warm", "warm"), true);
    assert.equal(sameSoundValue(mode, "fuzzy", "warm"), false, "an unreadable saved value never matches");
});
