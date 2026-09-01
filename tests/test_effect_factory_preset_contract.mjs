import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const cmajorIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Endpoints that exist on an effect surface but must never be stored in or
// applied from a preset, on top of anything a plugin annotates hidden: true.
const alwaysHiddenEndpointIDs = new Set(["hostSlot0Guard"]);

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

async function readHiddenCmajorEndpointIDs(pluginDirectory) {
    const pluginRoot = path.join(repoRoot, "fx", pluginDirectory);
    const hidden = new Set();

    for (const entry of await fs.readdir(pluginRoot)) {
        if (!entry.endsWith(".cmajor")) {
            continue;
        }

        const source = await fs.readFile(path.join(pluginRoot, entry), "utf8");

        for (const match of source.matchAll(/\binput\s+value\s+(?:bool|float32|float64|int32|int64)\s+([A-Za-z_][A-Za-z0-9_]*)\s+\[\[([^\]]*)\]\]/g)) {
            if (/hidden\s*:\s*true/.test(match[2])) {
                hidden.add(match[1]);
            }
        }
    }

    return hidden;
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
