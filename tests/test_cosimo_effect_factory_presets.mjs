import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

// Each lab declares its state through the kit. Loading state.ts runs
// definePluginState, which rejects a factory preset that misses a sound
// field, sets one that is not a sound field, or repeats an id.
const plugins = [
    { directory: "fx/chorus_lab", dsp: "ChorusLab.cmajor", onOffSwitch: "chorusEnabled" },
    { directory: "fx/ott_lab", dsp: "OttLab.cmajor", onOffSwitch: "bypass" },
];

for (const plugin of plugins) {
    plugin.definition = (await loadUIModule(repoRoot, `${plugin.directory}/state.ts`)).default;
    plugin.inputs = await readParameterInputs(path.join(repoRoot, plugin.directory, plugin.dsp));
}

/** Each `input value` parameter the DSP declares, with the annotation values the host reports. */
async function readParameterInputs(dspPath) {
    const source = await fs.readFile(dspPath, "utf8");
    const number = (annotation, key) => {
        const match = annotation.match(new RegExp(`\\b${key}\\s*:\\s*(-?[\\d.]+)f?\\b`));
        return match ? Number(match[1]) : undefined;
    };
    return [...source.matchAll(/^\s*input value (bool|float32) (\w+)\s*\[\[([^\]]*)\]\]/gm)].map(([, type, endpoint, annotation]) => ({
        endpoint,
        hidden: /\bhidden\s*:\s*true\b/.test(annotation),
        boolean: type === "bool",
        discrete: /\bdiscrete\s*:\s*true\b/.test(annotation),
        min: number(annotation, "min"),
        max: number(annotation, "max"),
    }));
}

const parameterFields = (definition) => Object.entries(definition).filter(([, field]) => field.kind === "parameter");

for (const { directory, definition, inputs, onOffSwitch } of plugins) {
    test(`${directory} declares every visible DSP parameter as state, keyed by its endpoint, and no hidden one`, () => {
        const declared = parameterFields(definition);
        for (const [key, field] of declared) assert.equal(field.endpoint, key);
        assert.deepEqual(declared.map(([key]) => key), inputs.filter(input => !input.hidden).map(input => input.endpoint));
    });

    test(`${directory} keeps its on/off switch out of presets and snapshots`, () => {
        assert.equal(definition[onOffSwitch].preset, false);
        const others = parameterFields(definition).filter(([key]) => key !== onOffSwitch);
        assert.ok(others.every(([, field]) => field.preset === undefined), "every other parameter is part of the sound");
    });

    test(`${directory} factory presets set each sound parameter to a value its DSP input accepts`, () => {
        const presets = definition.presetLibrary.factory;
        assert.ok(presets.length >= 2, "the lab ships its factory presets");
        for (const preset of presets) {
            for (const [key, value] of Object.entries(preset.values)) {
                const input = inputs.find(({ endpoint }) => endpoint === key);
                const where = `${preset.name}: ${key} = ${value}`;
                if (input.boolean) {
                    assert.ok(value === 0 || value === 1, `${where} must be 0 or 1`);
                    continue;
                }
                assert.ok(Number.isFinite(value) && value >= input.min && value <= input.max, `${where} is outside ${input.min}..${input.max}`);
                if (input.discrete) assert.ok(Number.isInteger(value), `${where} must select one choice`);
            }
        }
    });
}
