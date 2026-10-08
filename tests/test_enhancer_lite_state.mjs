import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
// definePluginState checks every factory preset against the sound fields, so
// loading state.ts fails if a preset misses or misnames one.
const { default: definition } = await loadUIModule(repoRoot, "fx/enhancer_lite/state.ts");
const { factoryPresets } = await loadUIModule(repoRoot, "fx/enhancer_lite/view/factory-presets.ts");
const { browserPreviewParameters } = await loadUIModule(repoRoot, "fx/enhancer_lite/view/source.tsx");

test("state.ts declares the factory presets, each with its own id", () => {
    assert.ok(factoryPresets.length > 0, "the example ships factory presets");
    assert.deepEqual(definition.presetLibrary.factory, factoryPresets);
    assert.equal(new Set(factoryPresets.map(({ id }) => id)).size, factoryPresets.length);
});

test("every sound control is a host parameter the view declares a range for", () => {
    const declared = new Set(browserPreviewParameters.map(({ endpointID }) => endpointID));
    for (const key of Object.keys(factoryPresets[0].values)) {
        assert.equal(definition[key]?.kind, "parameter", `${key} is a host parameter`);
        assert.ok(declared.has(definition[key].endpoint), `the view declares ${definition[key].endpoint}`);
    }
});

test("factory preset values stay inside each control's declared range or choices", () => {
    const parameterFor = (key) => browserPreviewParameters.find(({ endpointID }) => endpointID === definition[key].endpoint);
    for (const preset of factoryPresets) {
        for (const [key, value] of Object.entries(preset.values)) {
            const { min, max, discrete } = parameterFor(key);
            assert.ok(Number.isFinite(value) && value >= min && value <= max, `${preset.name}: ${key} = ${value} is outside ${min}..${max}`);
            if (discrete) assert.ok(Number.isInteger(value), `${preset.name}: ${key} must select one choice`);
        }
    }
});
