import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadModules() {
    const [contractModule, presetModule, migrationsModule] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-preset-v2.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/synth-preset-migrations.ts"),
    ]);
    return { contractModule, presetModule, migrationsModule };
}

const LEGACY_PARAMETERS = [
    { endpointID: "filterMode", type: "number", min: 0, max: 5, defaultValue: 0 },
    { endpointID: "filterCutoff", type: "number", min: 20, max: 20_000, defaultValue: 1_000 },
];

const POLISH_PARAMETERS = [
    { endpointID: "polishEnhancerAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
    { endpointID: "polishCompressionClipAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
    { endpointID: "polishOutputTrimDb", type: "number", min: -24, max: 12, defaultValue: 0 },
];

function buildCurrentContract(buildCanonicalPluginStateContract, polishParameters = POLISH_PARAMETERS) {
    return buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [...LEGACY_PARAMETERS, ...polishParameters],
        storedState: [{ key: "lane.v1", schemaVersion: 2, required: true }],
    });
}

test("the complete-sound cut registers no migration from a pre-Polish contract", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const currentContract = buildCurrentContract(contractModule.buildCanonicalPluginStateContract);

    assert.deepEqual(migrationsModule.buildSynthPresetMigrations(currentContract), []);
});

test("a pre-Polish preset is rejected atomically before parameter or stored-state writes", async () => {
    const { contractModule, presetModule, migrationsModule } = await loadModules();
    const legacyContract = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: LEGACY_PARAMETERS,
        storedState: [{ key: "lane.v1", schemaVersion: 2, required: true }],
    });
    const currentContract = buildCurrentContract(contractModule.buildCanonicalPluginStateContract);
    const writes = [];

    assert.throws(
        () => presetModule.applyEffectPresetV2({
            preset: {
                kind: "cosimo.effectPreset",
                version: 2,
                effectID: "wavetable-synth",
                presetID: "user.pre-polish",
                label: "Pre-Polish",
                contract: legacyContract,
                parameters: { filterMode: 1, filterCutoff: 2_400 },
                storedState: { "lane.v1": { version: 2, chain: [] } },
            },
            currentContract,
            patchConnection: {
                sendEventOrValue(endpointID, value) {
                    writes.push({ kind: "parameter", endpointID, value });
                },
                sendStoredStateValue(key, value) {
                    writes.push({ kind: "stored-state", key, value });
                },
            },
            migrations: migrationsModule.buildSynthPresetMigrations(currentContract),
        }),
        /No migration is registered/,
    );
    assert.deepEqual(writes, []);
});

test("a current Polish preset keeps all three saved values exact", async () => {
    const { contractModule, presetModule, migrationsModule } = await loadModules();
    const currentContract = buildCurrentContract(contractModule.buildCanonicalPluginStateContract);
    const normalized = presetModule.normalizeEffectPresetV2({
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "wavetable-synth",
        presetID: "user.current-polish",
        label: "Current Polish",
        contract: currentContract,
        parameters: {
            filterMode: 2,
            filterCutoff: 4_800,
            polishEnhancerAmount: 0.42,
            polishCompressionClipAmount: 0.73,
            polishOutputTrimDb: -3.5,
        },
        storedState: { "lane.v1": { version: 2, chain: [] } },
    }, {
        currentContract,
        migrations: migrationsModule.buildSynthPresetMigrations(currentContract),
    });

    assert.deepEqual(
        Object.fromEntries(POLISH_PARAMETERS.map(({ endpointID }) => [endpointID, normalized.parameters[endpointID]])),
        {
            polishEnhancerAmount: 0.42,
            polishCompressionClipAmount: 0.73,
            polishOutputTrimDb: -3.5,
        },
    );
});

test("the migration boundary rejects missing, duplicate, or non-neutral Polish contracts", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const cases = [
        {
            parameters: POLISH_PARAMETERS.filter(({ endpointID }) => endpointID !== "polishEnhancerAmount"),
            expected: /neutral polishEnhancerAmount/,
        },
        {
            parameters: [...POLISH_PARAMETERS, POLISH_PARAMETERS[0]],
            expected: /Duplicate parameter endpointID "polishEnhancerAmount"/,
        },
        {
            parameters: POLISH_PARAMETERS.map((parameter) => (
                parameter.endpointID === "polishCompressionClipAmount"
                    ? { ...parameter, defaultValue: 0.25 }
                    : parameter
            )),
            expected: /neutral polishCompressionClipAmount/,
        },
        {
            parameters: POLISH_PARAMETERS.map((parameter) => (
                parameter.endpointID === "polishOutputTrimDb"
                    ? { ...parameter, min: -12 }
                    : parameter
            )),
            expected: /neutral polishOutputTrimDb/,
        },
    ];

    for (const { parameters, expected } of cases) {
        assert.throws(
            () => migrationsModule.buildSynthPresetMigrations(buildCurrentContract(
                contractModule.buildCanonicalPluginStateContract,
                parameters,
            )),
            expected,
        );
    }
});
