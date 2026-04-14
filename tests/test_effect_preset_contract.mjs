import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const cmajorIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const expectedChorusPresetEndpoints = [
    "chorusEnabled",
    "chorusMix",
    "chorusMotionMode",
    "chorusBloomMode",
    "chorusTone",
    "chorusFeedback",
    "chorusRingAmount",
    "chorusRingOffsetMode",
    "chorusRingFineSemitones",
];
const expectedOttPresetEndpoints = [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
];

async function loadSchemaModule() {
    return await loadUIModule(repoRoot, "ui/shared/effects/effect-preset-schema.ts");
}

async function loadDescriptorModule() {
    return await loadUIModule(repoRoot, "ui/shared/effects/effect-preset-descriptors.ts");
}

function descriptorParams(descriptor) {
    return Object.keys(descriptor.params ?? {});
}

function sorted(values) {
    return [...values].sort();
}

function factoryPresetList(factoryPresetsByEffect) {
    return Object.entries(factoryPresetsByEffect).flatMap(([effectID, presets]) => {
        assert.equal(Array.isArray(presets), true, `${effectID} factory presets must be an array`);
        assert.equal(presets.length > 0, true, `${effectID} must ship at least one factory preset`);
        return presets.map((preset) => ({ effectID, preset }));
    });
}

async function readCmajorEndpointIDs(relativePath) {
    const source = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
    return new Set([...source.matchAll(/\binput\s+value\s+(?:bool|float32|float64|int32|int64)\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)]
        .map((match) => match[1]));
}

async function readCmajorEndpointAnnotations(relativePath) {
    const source = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
    const endpoints = new Map();

    for (const match of source.matchAll(/\binput\s+value\s+(?:bool|float32|float64|int32|int64)\s+([A-Za-z_][A-Za-z0-9_]*)\s+\[\[([^\]]*)\]\]/g)) {
        endpoints.set(match[1], match[2]);
    }

    return {
        source,
        endpoints,
    };
}

test("factory_presets_have_unique_ids_and_valid_values", async () => {
    const { normalizeEffectPreset } = await loadSchemaModule();
    const {
        EFFECT_FACTORY_PRESETS,
        EFFECT_PRESET_DESCRIPTORS,
    } = await loadDescriptorModule();
    const seenPresetIDs = new Set();

    assert.deepEqual(sorted(Object.keys(EFFECT_PRESET_DESCRIPTORS)), ["chorus", "ott"]);
    assert.deepEqual(sorted(Object.keys(EFFECT_FACTORY_PRESETS)), ["chorus", "ott"]);

    for (const { effectID, preset } of factoryPresetList(EFFECT_FACTORY_PRESETS)) {
        const expectedValueKeys = sorted(descriptorParams(EFFECT_PRESET_DESCRIPTORS[effectID]));

        assert.equal(preset.effectID, effectID);
        assert.match(preset.presetID, /^[a-z][a-z0-9.-]*$/);
        assert.equal(seenPresetIDs.has(preset.presetID), false, `Duplicate factory preset ID: ${preset.presetID}`);
        seenPresetIDs.add(preset.presetID);
        assert.deepEqual(sorted(Object.keys(preset.values ?? {})), expectedValueKeys, `${preset.presetID} must store every preset-addressable ${effectID} endpoint`);

        assert.deepEqual(normalizeEffectPreset(preset, EFFECT_PRESET_DESCRIPTORS), preset);
    }
});

test("factory_presets_use_only_cmajor_identifier_endpoint_ids", async () => {
    const {
        EFFECT_FACTORY_PRESETS,
    } = await loadDescriptorModule();

    for (const { preset } of factoryPresetList(EFFECT_FACTORY_PRESETS)) {
        for (const endpointID of Object.keys(preset.values ?? {})) {
            assert.match(endpointID, cmajorIdentifierPattern);
            assert.notEqual(endpointID, "hostSlot0Guard");
            assert.equal(endpointID.includes("."), false);
        }
    }
});

test("chorus_descriptor_endpoints_exist_in_standalone_and_embedded_cmajor_surfaces", async () => {
    const {
        EFFECT_PRESET_DESCRIPTORS,
    } = await loadDescriptorModule();
    const expectedEndpoints = descriptorParams(EFFECT_PRESET_DESCRIPTORS.chorus);

    assert.deepEqual(sorted(expectedEndpoints), sorted(expectedChorusPresetEndpoints));

    for (const surfacePath of [
        "fx/chorus_lab/ChorusLab.cmajor",
        "cmajor/WavetableSynth.cmajor",
    ]) {
        const surfaceEndpoints = await readCmajorEndpointIDs(surfacePath);
        assert.deepEqual(expectedEndpoints.filter((endpointID) => !surfaceEndpoints.has(endpointID)), [], `${surfacePath} is missing shared chorus endpoints`);
    }
});

test("ott_descriptor_endpoints_exist_in_standalone_and_embedded_cmajor_surfaces", async () => {
    const {
        EFFECT_PRESET_DESCRIPTORS,
    } = await loadDescriptorModule();
    const expectedEndpoints = descriptorParams(EFFECT_PRESET_DESCRIPTORS.ott);

    assert.deepEqual(sorted(expectedEndpoints), sorted(expectedOttPresetEndpoints));

    for (const surfacePath of [
        "fx/ott_lab/OttLab.cmajor",
        "cmajor/WavetableSynth.cmajor",
    ]) {
        const surfaceEndpoints = await readCmajorEndpointIDs(surfacePath);
        assert.deepEqual(expectedEndpoints.filter((endpointID) => !surfaceEndpoints.has(endpointID)), [], `${surfacePath} is missing shared OTT endpoints`);
    }
});

test("descriptor_endpoint_ids_are_globally_unique_across_effects", async () => {
    const {
        EFFECT_PRESET_DESCRIPTORS,
    } = await loadDescriptorModule();
    const seen = new Map();

    for (const [effectID, descriptor] of Object.entries(EFFECT_PRESET_DESCRIPTORS)) {
        for (const endpointID of descriptorParams(descriptor)) {
            assert.match(endpointID, cmajorIdentifierPattern);
            assert.equal(seen.has(endpointID), false, `${endpointID} is used by both ${seen.get(endpointID)} and ${effectID}`);
            seen.set(endpointID, effectID);
        }
    }
});

test("hidden_and_host_guard_endpoints_are_not_preset_addressable", async () => {
    const {
        EFFECT_FACTORY_PRESETS,
        EFFECT_PRESET_DESCRIPTORS,
    } = await loadDescriptorModule();
    const hiddenEndpointIDs = new Set(["hostSlot0Guard"]);

    for (const [effectID, descriptor] of Object.entries(EFFECT_PRESET_DESCRIPTORS)) {
        for (const endpointID of descriptorParams(descriptor)) {
            assert.equal(hiddenEndpointIDs.has(endpointID), false, `${effectID} exposes hidden endpoint ${endpointID}`);
        }
    }

    for (const { preset } of factoryPresetList(EFFECT_FACTORY_PRESETS)) {
        for (const endpointID of Object.keys(preset.values ?? {})) {
            assert.equal(hiddenEndpointIDs.has(endpointID), false, `${preset.presetID} stores hidden endpoint ${endpointID}`);
        }
    }
});

test("standalone_descriptor_endpoints_are_real_visible_controls_without_sentinel_selection", async () => {
    const {
        EFFECT_PRESET_DESCRIPTORS,
    } = await loadDescriptorModule();
    const surfaces = [
        {
            effectID: "chorus",
            path: "fx/chorus_lab/ChorusLab.cmajor",
        },
        {
            effectID: "ott",
            path: "fx/ott_lab/OttLab.cmajor",
        },
    ];

    for (const surface of surfaces) {
        const { source, endpoints } = await readCmajorEndpointAnnotations(surface.path);

        for (const endpointID of descriptorParams(EFFECT_PRESET_DESCRIPTORS[surface.effectID])) {
            const annotation = endpoints.get(endpointID);

            assert.notEqual(annotation, undefined, `${surface.path} is missing ${endpointID}`);
            assert.equal(/hidden\s*:\s*true/.test(annotation), false, `${surface.path} exposes ${endpointID} as a hidden preset overlay`);
            assert.equal(/init\s*:\s*-(?:1|999)(?:\.0f)?\b/.test(annotation), false, `${surface.path} gives ${endpointID} a sentinel init value`);
            assert.equal(/min\s*:\s*-(?:1|999)(?:\.0f)?\b/.test(annotation), false, `${surface.path} gives ${endpointID} a sentinel minimum`);
        }

        for (const endpointID of descriptorParams(EFFECT_PRESET_DESCRIPTORS[surface.effectID])) {
            assert.equal(
                new RegExp(`${endpointID}\\s*>=\\s*0\\.0f\\s*\\?`).test(source),
                false,
                `${surface.path} uses ${endpointID} as a hidden/sentinel override instead of the real control`,
            );
            assert.equal(
                new RegExp(`${endpointID}\\s*>\\s*-900\\.0f`).test(source),
                false,
                `${surface.path} uses ${endpointID} as a hidden/sentinel override instead of the real control`,
            );
        }
    }
});
