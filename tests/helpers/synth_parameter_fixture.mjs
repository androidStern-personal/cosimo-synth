import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadUIModule } from "./load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { synthParameterByEndpoint } = await loadUIModule(root, "ui/shared/synth-plugin-state.ts");
export const synthParameterEndpoints = Object.keys(synthParameterByEndpoint);
const metadata = new Map();

// Read the authored DSP annotations instead of maintaining a second range/default
// catalog. This intentionally accepts only literal numeric annotations and fails
// when a declared parameter needs a new fixture source or annotation form.
for (const file of ["cmajor/WavetableSynth.cmajor", "cmajor/EffectsRack.cmajor"]) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const [, endpoint, annotation] of source.matchAll(/input\s+value\s+float32\s+(\w+)\s*\[\[([^]*?)\]\]/g)) {
        if (!Object.hasOwn(synthParameterByEndpoint, endpoint)) continue;
        const number = (key, fallback) => {
            const literal = new RegExp(`\\b${key}:\\s*([^,]+)`).exec(annotation)?.[1]?.trim();
            if (literal === undefined && fallback !== undefined) return fallback;
            assert.match(literal ?? "", /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?f?$/i, `${endpoint}.${key} must be a numeric DSP annotation`);
            return Number(literal.replace(/f$/i, ""));
        };
        assert.equal(metadata.has(endpoint), false, `Ambiguous DSP metadata for ${endpoint}`);
        metadata.set(endpoint, { endpoint, min: number("min"), max: number("max"),
            step: number("step", 0), defaultValue: number("init") });
    }
}
assert.deepEqual([...metadata.keys()].sort(), [...synthParameterEndpoints].sort(), "every declared host parameter has DSP metadata");

export function createSynthParameterFixture(overrides = {}) {
    const values = new Map([...metadata].map(([endpoint, item]) => [endpoint, item.defaultValue]));
    for (const [endpoint, value] of Object.entries(overrides)) {
        assert.ok(metadata.has(endpoint), `Unknown fixture parameter ${endpoint}`);
        values.set(endpoint, value);
    }
    return { values, readParameter(endpoint) {
        assert.ok(metadata.has(endpoint), `Unexpected native parameter read ${endpoint}`);
        return { ...metadata.get(endpoint), value: values.get(endpoint) };
    } };
}
