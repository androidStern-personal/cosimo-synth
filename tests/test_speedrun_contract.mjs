import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const { buildSpeedrunContract } = await loadUIModule(repoRoot, "ui/speedrun/contract.ts");

const parameter = (endpointID, annotation) => ({ endpointID, purpose: "parameter", annotation });

test("the contract reads each parameter's type, range and text from its Cmajor annotation", () => {
    const contract = buildSpeedrunContract({
        effectID: "cosimo-synth",
        parameters: [
            parameter("filterCutoff", { min: 20, max: 20_000, init: 1_000 }),
            parameter("oscAMute", { boolean: true, init: false }),
            parameter("filterMode", { min: 0, max: 5, init: 0, discrete: true, step: 1, text: "LP|HP|BP|Notch|Peak|Comb" }),
        ],
    });

    assert.deepEqual(contract.parameters, [
        { endpointID: "filterCutoff", type: "number", defaultValue: 1_000, min: 20, max: 20_000 },
        { endpointID: "filterMode", type: "integer", defaultValue: 0, min: 0, max: 5, step: 1, discrete: true, text: "LP|HP|BP|Notch|Peak|Comb" },
        { endpointID: "oscAMute", type: "boolean", defaultValue: false },
    ]);
    assert.match(contract.hash, /^sha256:[0-9a-f]{64}$/);
});

test("the contract hash ignores parameter order and cosmetic labels", () => {
    const first = buildSpeedrunContract({
        effectID: "cosimo-synth",
        parameters: [
            parameter("filterMix", { name: "Mix", group: "Filter", min: 0, max: 1, init: 1 }),
            parameter("filterQ", { name: "Q", group: "Filter", min: 0.1, max: 20, init: 0.707107 }),
        ],
    });
    const second = buildSpeedrunContract({
        effectID: "cosimo-synth",
        parameters: [
            parameter("filterQ", { name: "Resonance", group: "Other", min: 0.1, max: 20, init: 0.707107 }),
            parameter("filterMix", { name: "Wet", group: "Main", min: 0, max: 1, init: 1 }),
        ],
    });

    assert.equal(second.hash, first.hash);
});

test("the contract hash changes with a parameter's ID, range or text, or a document's schema", () => {
    const build = ({ id = "filterMode", max = 5, text = "LP|HP|BP|Notch|Peak|Comb", schemaVersion = 6 } = {}) => buildSpeedrunContract({
        effectID: "cosimo-synth",
        parameters: [parameter(id, { min: 0, max, init: 0, discrete: true, step: 1, text })],
        storedState: [{ key: "modulation.v6", schemaVersion }],
    }).hash;
    const base = build();

    assert.deepEqual([
        build({ id: "filterType" }),
        build({ max: 6 }),
        build({ text: "A|B|C|D|E|F" }),
        build({ schemaVersion: 7 }),
    ].map((hash) => hash === base), [false, false, false, false]);
});

test("the contract refuses a parameter or document listed twice", () => {
    assert.throws(() => buildSpeedrunContract({
        effectID: "cosimo-synth",
        parameters: [parameter("filterMix", { min: 0, max: 1, init: 1 }), parameter("filterMix", { min: 0, max: 2, init: 1 })],
    }), /parameter "filterMix" twice/);
    assert.throws(() => buildSpeedrunContract({
        effectID: "cosimo-synth",
        parameters: [],
        storedState: [{ key: "bounce.v1", schemaVersion: 1 }, { key: "bounce.v1", schemaVersion: 2 }],
    }), /document "bounce.v1" twice/);
});
