import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadContractModule() {
    return await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
}

function parameter(endpointID, annotation = {}) {
    return {
        endpointID,
        purpose: "parameter",
        annotation,
    };
}

function eventEndpoint(endpointID) {
    return {
        endpointID,
        purpose: "event",
        annotation: {},
    };
}

function status(inputs) {
    return {
        details: {
            inputs,
        },
    };
}

function parseCmajorInputValues(relativePath) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    const endpointIDs = [];
    const pattern = /^\s*input\s+value\s+\S+\s+([A-Za-z_][A-Za-z0-9_]*)\s+\[\[(.*?)\]\];/gm;
    let match;

    while ((match = pattern.exec(source)) !== null) {
        const annotationText = match[2];
        endpointIDs.push({
            endpointID: match[1],
            hidden: /\bhidden\s*:\s*true\b/.test(annotationText),
        });
    }

    return endpointIDs;
}

test("exports_visible_parameter_contract_from_cmajor_status_and_excludes_hidden_guard", async () => {
    const {
        buildPluginStateContract,
    } = await loadContractModule();

    const contract = buildPluginStateContract({
        effectID: "ott",
        status: status([
            parameter("hostSlot0Guard", { hidden: true, min: 0, max: 1, init: 0 }),
            parameter("bypass", { boolean: true, init: false }),
            parameter("ottMix", { min: 0, max: 100, init: 100 }),
            parameter("detectorMode", { min: 0, max: 1, init: 0, discrete: true, step: 1, text: "RMS|Peak" }),
            eventEndpoint("patternUpload"),
        ]),
    });

    assert.deepEqual(contract.parameters.map((param) => param.endpointID), [
        "bypass",
        "detectorMode",
        "ottMix",
    ]);
    assert.equal(contract.parameters.find((param) => param.endpointID === "bypass").type, "boolean");
    assert.equal(contract.parameters.find((param) => param.endpointID === "detectorMode").type, "integer");
    assert.equal(contract.parameters.find((param) => param.endpointID === "detectorMode").text, "RMS|Peak");
    assert.equal(contract.parameters.some((param) => param.endpointID === "hostSlot0Guard"), false);
    assert.match(contract.hash, /^sha256:[0-9a-f]{64}$/);
});

test("ott_runtime_contract_matches_all_visible_OttLab_cmajor_parameters", async () => {
    const {
        buildPluginStateContract,
    } = await loadContractModule();
    const parsed = parseCmajorInputValues("fx/ott_lab/OttLab.cmajor");
    const fakeStatus = status(parsed.map(({ endpointID, hidden }) => parameter(endpointID, {
        hidden,
        min: 0,
        max: 100,
        init: 0,
    })));
    const expectedVisibleIDs = parsed
        .filter(({ hidden }) => !hidden)
        .map(({ endpointID }) => endpointID)
        .sort();

    const contract = buildPluginStateContract({
        effectID: "ott",
        status: fakeStatus,
    });

    assert.deepEqual(contract.parameters.map((param) => param.endpointID), expectedVisibleIDs);
    assert.equal(contract.parameters.some((param) => param.endpointID === "envelopeBoostClampDb"), true);
    assert.equal(contract.parameters.some((param) => param.endpointID === "hostSlot0Guard"), false);
});

test("seqfx_runtime_contract_contains_parameters_but_not_matrix_cells", async () => {
    const {
        buildPluginStateContract,
    } = await loadContractModule();
    const parsed = parseCmajorInputValues("fx/seqfx/SeqFx.cmajor");
    const fakeStatus = status(parsed.map(({ endpointID, hidden }) => parameter(endpointID, {
        hidden,
        min: 0,
        max: endpointID === "patternSelect" ? 11 : 1,
        init: 0,
        discrete: ["patternSelect", "clockMode", "rate", "loopStart", "loopLength"].includes(endpointID),
        step: 1,
    })));

    const contract = buildPluginStateContract({
        effectID: "seqfx",
        status: fakeStatus,
    });

    assert.deepEqual(contract.parameters.map((param) => param.endpointID), [
        "clockMode",
        "enabled",
        "globalMix",
        "loopLength",
        "loopStart",
        "manualBpm",
        "patternSelect",
        "rate",
        "swing",
    ]);
    assert.equal(contract.parameters.some((param) => param.endpointID.includes("step")), false);
    assert.equal(contract.parameters.some((param) => param.endpointID.includes("matrix")), false);
});

test("contract_hash_is_order_independent_and_ignores_cosmetic_labels", async () => {
    const {
        buildPluginStateContract,
    } = await loadContractModule();
    const first = buildPluginStateContract({
        effectID: "ott",
        status: status([
            parameter("ottMix", { name: "Mix", group: "Output", min: 0, max: 100, init: 100 }),
            parameter("ottAmount", { name: "Amount", group: "Output", min: 0, max: 100, init: 100 }),
        ]),
    });
    const second = buildPluginStateContract({
        effectID: "ott",
        status: status([
            parameter("ottAmount", { name: "Depth", group: "Other", min: 0, max: 100, init: 100 }),
            parameter("ottMix", { name: "Wet Mix", group: "Main", min: 0, max: 100, init: 100 }),
        ]),
    });

    assert.equal(second.hash, first.hash);
});

test("contract_hash_changes_for_endpoint_id_range_type_text_or_stored_state_schema", async () => {
    const {
        buildPluginStateContract,
    } = await loadContractModule();
    const base = buildPluginStateContract({
        effectID: "seqfx",
        status: status([
            parameter("patternSelect", { min: 0, max: 11, init: 0, discrete: true, step: 1 }),
            parameter("rate", { min: 0, max: 2, init: 1, discrete: true, step: 1, text: "1/8|1/16|1/32" }),
        ]),
        storedState: [{ key: "seqfx.v1", schemaVersion: 1, required: true }],
    });

    const variants = [
        buildPluginStateContract({
            effectID: "seqfx",
            status: status([
                parameter("selectedPattern", { min: 0, max: 11, init: 0, discrete: true, step: 1 }),
                parameter("rate", { min: 0, max: 2, init: 1, discrete: true, step: 1, text: "1/8|1/16|1/32" }),
            ]),
            storedState: [{ key: "seqfx.v1", schemaVersion: 1, required: true }],
        }),
        buildPluginStateContract({
            effectID: "seqfx",
            status: status([
                parameter("patternSelect", { min: 0, max: 12, init: 0, discrete: true, step: 1 }),
                parameter("rate", { min: 0, max: 2, init: 1, discrete: true, step: 1, text: "1/8|1/16|1/32" }),
            ]),
            storedState: [{ key: "seqfx.v1", schemaVersion: 1, required: true }],
        }),
        buildPluginStateContract({
            effectID: "seqfx",
            status: status([
                parameter("patternSelect", { min: 0, max: 11, init: 0, discrete: true, step: 1 }),
                parameter("rate", { min: 0, max: 2, init: 1, discrete: true, step: 1, text: "Slow|Medium|Fast" }),
            ]),
            storedState: [{ key: "seqfx.v1", schemaVersion: 1, required: true }],
        }),
        buildPluginStateContract({
            effectID: "seqfx",
            status: status([
                parameter("patternSelect", { min: 0, max: 11, init: 0, discrete: true, step: 1 }),
                parameter("rate", { min: 0, max: 2, init: 1, discrete: true, step: 1, text: "1/8|1/16|1/32" }),
            ]),
            storedState: [{ key: "seqfx.v1", schemaVersion: 2, required: true }],
        }),
    ];

    assert.deepEqual(variants.map((variant) => variant.hash === base.hash), [
        false,
        false,
        false,
        false,
    ]);
});

test("contract_exporter_rejects_duplicate_endpoint_ids", async () => {
    const {
        buildPluginStateContract,
    } = await loadContractModule();

    assert.throws(() => buildPluginStateContract({
        effectID: "ott",
        status: status([
            parameter("ottMix", { min: 0, max: 100, init: 100 }),
            parameter("ottMix", { min: 0, max: 1, init: 1 }),
        ]),
    }), /duplicate.*ottMix/i);
});
