import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const cmajorIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Endpoints that exist on an effect surface but must never be stored in or
// applied from a preset, on top of anything a plugin annotates hidden: true.
const alwaysHiddenEndpointIDs = new Set(["hostSlot0Guard"]);

// Effects that also ship embedded in the Cosimo synth as lane devices. Their
// preset-addressable endpoint sets are wire format twice over (standalone
// preset files AND the synth lane layout), so both the exact set and the lane
// coverage are pinned here.
const synthEmbeddedPresetEndpoints = {
    chorus: [
        "chorusBloomMode",
        "chorusFeedback",
        "chorusMix",
        "chorusMotionMode",
        "chorusRingAmount",
        "chorusRingFineSemitones",
        "chorusRingOffsetMode",
        "chorusTone",
    ],
    ott: [
        "ottAmount",
        "ottBandDrive",
        "ottEnvelopeMatch",
        "ottMix",
        "ottTimePercent",
    ],
};

async function discoverFactoryPresetInventories() {
    const fxRoot = path.join(repoRoot, "fx");
    const inventories = [];

    for (const entry of await fs.readdir(fxRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }

        const relativeModulePath = path.posix.join("fx", entry.name, "view", "factory-presets.js");

        try {
            await fs.access(path.join(repoRoot, relativeModulePath));
        } catch {
            continue;
        }

        const module = await loadUIModule(repoRoot, relativeModulePath);

        for (const [exportName, registry] of Object.entries(module)) {
            if (registry === null || typeof registry !== "object" || Array.isArray(registry)) {
                continue;
            }

            for (const [effectID, presets] of Object.entries(registry)) {
                assert.equal(Array.isArray(presets), true, `${relativeModulePath} ${exportName}.${effectID} must be an array`);
                assert.equal(presets.length > 0, true, `${relativeModulePath} ${exportName}.${effectID} must ship at least one factory preset`);
                inventories.push({
                    pluginDirectory: entry.name,
                    modulePath: relativeModulePath,
                    effectID,
                    presets,
                });
            }
        }
    }

    assert.equal(inventories.length > 0, true, "no fx/*/view/factory-presets.js inventories were discovered");
    return inventories;
}

async function readCmajorEndpointSurface(pluginDirectory) {
    const pluginRoot = path.join(repoRoot, "fx", pluginDirectory);
    const endpointIDs = new Set();
    const valueEndpointDeclarations = new Map();

    for (const entry of await fs.readdir(pluginRoot)) {
        if (!entry.endsWith(".cmajor")) {
            continue;
        }

        const source = await fs.readFile(path.join(pluginRoot, entry), "utf8");

        for (const match of source.matchAll(/\binput\s+value\s+(bool|float32|float64|int32|int64)\s+([A-Za-z_][A-Za-z0-9_]*)\s+\[\[([^\]]*)\]\]/g)) {
            const endpointID = match[2];
            endpointIDs.add(endpointID);
            const declarations = valueEndpointDeclarations.get(endpointID) ?? [];
            declarations.push({
                declaredType: match[1],
                annotationText: match[3],
            });
            valueEndpointDeclarations.set(endpointID, declarations);
        }

        // Endpoints a graph re-exports from a child processor.
        for (const match of source.matchAll(/\binput\s+[A-Za-z_][A-Za-z0-9_]*\.([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
            endpointIDs.add(match[1]);
        }
    }

    return { endpointIDs, valueEndpointDeclarations };
}

async function readHiddenCmajorEndpointIDs(pluginDirectory) {
    const { valueEndpointDeclarations } = await readCmajorEndpointSurface(pluginDirectory);
    const hidden = new Set();

    for (const [endpointID, declarations] of valueEndpointDeclarations) {
        if (declarations.some((declaration) => /hidden\s*:\s*true/.test(declaration.annotationText))) {
            hidden.add(endpointID);
        }
    }

    return hidden;
}

function readAnnotationNumber(annotationText, key) {
    const match = annotationText.match(new RegExp(`\\b${key}\\s*:\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+))f?\\b`));
    return match ? Number(match[1]) : undefined;
}

function readAnnotationBoolean(annotationText, key) {
    const match = annotationText.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)\\b`));
    return match ? match[1] === "true" : undefined;
}

/**
 * Rebuild the parameter contract the live plugin derives from its Cmajor
 * status, from the .cmajor annotation text, so factory preset values can be
 * validated statically through the same normalizeEffectPresetV2 path the
 * runtime uses.
 */
function annotationToParameterContract(endpointID, { declaredType, annotationText }) {
    const discrete = /\bdiscrete\s*:\s*true\b/.test(annotationText);
    const boolean = declaredType === "bool" || /\bboolean\b(?!\s*:\s*false)/.test(annotationText);
    const init = boolean
        ? readAnnotationBoolean(annotationText, "init") ?? false
        : readAnnotationNumber(annotationText, "init");
    const parameter = { endpointID, init };

    if (discrete) {
        parameter.discrete = true;
    }

    if (boolean) {
        parameter.boolean = true;
    }

    for (const key of ["min", "max", "step"]) {
        const value = readAnnotationNumber(annotationText, key);

        if (value !== undefined) {
            parameter[key] = value;
        }
    }

    return parameter;
}

test("factory_preset_endpoint_ids_are_cmajor_identifiers_and_globally_unique_across_effects", async () => {
    const inventories = await discoverFactoryPresetInventories();
    const endpointOwners = new Map();
    const seenPresetIDs = new Map();

    for (const { modulePath, effectID, presets } of inventories) {
        for (const preset of presets) {
            assert.equal(preset.effectID, effectID, `${modulePath} files ${preset.presetID} under "${effectID}"`);
            assert.match(preset.presetID, /^[a-z][a-z0-9.-]*$/);
            assert.equal(seenPresetIDs.has(preset.presetID), false, `Duplicate factory preset ID: ${preset.presetID} (${seenPresetIDs.get(preset.presetID)} and ${modulePath})`);
            seenPresetIDs.set(preset.presetID, modulePath);

            for (const endpointID of Object.keys(preset.values ?? {})) {
                assert.match(endpointID, cmajorIdentifierPattern);
                assert.equal(endpointID.includes("."), false);

                const owner = endpointOwners.get(endpointID);
                assert.equal(owner === undefined || owner === effectID, true, `${endpointID} is used by both ${owner} and ${effectID}`);
                endpointOwners.set(endpointID, effectID);
            }
        }
    }
});

test("hidden_and_host_guard_endpoints_are_not_preset_addressable", async () => {
    const inventories = await discoverFactoryPresetInventories();

    for (const { pluginDirectory, effectID, presets } of inventories) {
        const hiddenEndpointIDs = new Set([
            ...alwaysHiddenEndpointIDs,
            ...await readHiddenCmajorEndpointIDs(pluginDirectory),
        ]);

        for (const preset of presets) {
            for (const endpointID of Object.keys(preset.values ?? {})) {
                assert.equal(hiddenEndpointIDs.has(endpointID), false, `${preset.presetID} stores hidden ${effectID} endpoint ${endpointID}`);
            }
        }
    }
});

test("factory_preset_value_keys_exist_as_endpoints_on_the_plugin_cmajor_surface", async () => {
    const inventories = await discoverFactoryPresetInventories();

    for (const { pluginDirectory, modulePath, effectID, presets } of inventories) {
        const { endpointIDs } = await readCmajorEndpointSurface(pluginDirectory);
        assert.equal(endpointIDs.size > 0, true, `fx/${pluginDirectory} declares no Cmajor input endpoints`);

        for (const preset of presets) {
            for (const endpointID of Object.keys(preset.values ?? {})) {
                assert.equal(endpointIDs.has(endpointID), true, `${modulePath} ${preset.presetID} stores "${endpointID}", which is not an endpoint on the ${effectID} .cmajor surface`);
            }
        }
    }
});

test("synth_embedded_factory_preset_endpoints_match_the_lane_layout", async () => {
    const inventories = await discoverFactoryPresetInventories();
    const { laneDeviceParamEndpoints } = await loadUIModule(repoRoot, "ui/shared/lane-slot-params.ts");
    const coveredEffectIDs = new Set();

    for (const { effectID, presets } of inventories) {
        const expectedEndpoints = synthEmbeddedPresetEndpoints[effectID];

        if (!expectedEndpoints) {
            continue;
        }

        coveredEffectIDs.add(effectID);

        // The embedded synth carries these as lane record fields since the B3
        // parameter cut, not as host endpoints.
        const laneEndpoints = new Set(laneDeviceParamEndpoints(effectID));

        for (const preset of presets) {
            const valueKeys = [...Object.keys(preset.values ?? {})].sort();
            assert.deepEqual(valueKeys, expectedEndpoints, `${preset.presetID} must store exactly the pinned ${effectID} preset endpoints`);
            assert.deepEqual(valueKeys.filter((endpointID) => !laneEndpoints.has(endpointID)), [], `the lane layout is missing shared ${effectID} endpoints stored by ${preset.presetID}`);
        }
    }

    assert.deepEqual([...coveredEffectIDs].sort(), Object.keys(synthEmbeddedPresetEndpoints).sort(), "a synth-embedded effect's factory preset inventory was not discovered");
});

test("factory_presets_store_the_complete_addressable_set_and_round_trip_v2_normalization", async () => {
    const inventories = await discoverFactoryPresetInventories();
    const { buildCanonicalPluginStateContract, clonePluginStateContract } = await loadUIModule(repoRoot, "kit/ui/effects/effect-state-contract.ts");
    const {
        EFFECT_PRESET_V2_KIND,
        EFFECT_PRESET_V2_SCHEMA_VERSION,
        normalizeEffectPresetV2,
    } = await loadUIModule(repoRoot, "kit/ui/effects/effect-preset-v2.ts");
    const {
        EFFECT_PRESET_KIND,
        EFFECT_PRESET_SCHEMA_VERSION,
    } = await loadUIModule(repoRoot, "kit/ui/effects/effect-preset-shared.ts");
    const { defaultParameterValues } = await loadUIModule(repoRoot, "kit/ui/effects/standalone-effect-presets.ts");

    for (const { pluginDirectory, modulePath, effectID, presets } of inventories) {
        const { valueEndpointDeclarations } = await readCmajorEndpointSurface(pluginDirectory);

        // Every preset of one effect must store the same, complete
        // preset-addressable endpoint set: presets are whole-state documents,
        // not sparse overlays.
        const addressableEndpointIDs = [...Object.keys(presets[0].values ?? {})].sort();

        for (const preset of presets) {
            assert.deepEqual(
                [...Object.keys(preset.values ?? {})].sort(),
                addressableEndpointIDs,
                `${preset.presetID} must store the complete addressable ${effectID} endpoint set`,
            );
        }

        const parameters = addressableEndpointIDs.map((endpointID) => {
            const declarations = valueEndpointDeclarations.get(endpointID) ?? [];
            assert.equal(declarations.length, 1, `fx/${pluginDirectory} must declare "${endpointID}" as exactly one annotated value endpoint (found ${declarations.length})`);
            return annotationToParameterContract(endpointID, declarations[0]);
        });
        const contract = buildCanonicalPluginStateContract({ effectID, parameters });

        // Mirror the controller's legacy factory-preset upgrade path so a
        // typo'd endpoint, wrong type, or out-of-range value fails here, not
        // when a user first loads the view.
        for (const preset of presets) {
            assert.equal(preset.kind, EFFECT_PRESET_KIND, `${modulePath} ${preset.presetID} must use the v1 factory envelope`);
            assert.equal(preset.version, EFFECT_PRESET_SCHEMA_VERSION, `${modulePath} ${preset.presetID} must use the v1 factory schema version`);

            const normalized = normalizeEffectPresetV2({
                kind: EFFECT_PRESET_V2_KIND,
                version: EFFECT_PRESET_V2_SCHEMA_VERSION,
                effectID: preset.effectID,
                presetID: preset.presetID,
                label: preset.label,
                contract: clonePluginStateContract(contract),
                parameters: {
                    ...defaultParameterValues(contract),
                    ...preset.values,
                },
                storedState: {},
            }, { currentContract: contract });

            assert.deepEqual(normalized.parameters, { ...preset.values }, `${preset.presetID} values must survive v2 normalization unchanged`);
        }
    }
});
