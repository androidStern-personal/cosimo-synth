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
    { endpointID: "filterQ", type: "number", min: 0.1, max: 20, defaultValue: 0.707107 },
    { endpointID: "ampRelease", type: "number", min: 0.005, max: 10, defaultValue: 0.2 },
];

const AMP_STAGE_PARAMETERS = [
    { endpointID: "ampAttack", type: "number", min: 0.001, max: 10, defaultValue: 0.01 },
    { endpointID: "ampDecay", type: "number", min: 0.001, max: 10, defaultValue: 0.001 },
    { endpointID: "ampSustain", type: "number", min: 0, max: 1, defaultValue: 1 },
];

const KEY_TRACK_PARAMETERS = [
    { endpointID: "filterCutoffKeyTrackEnabled", type: "number", min: 0, max: 1, defaultValue: 0 },
    { endpointID: "filterCutoffKeyTrackOffsetSemitones", type: "number", min: -60, max: 60, defaultValue: 0 },
];

test("the derived synth migration applies a pre-Mix preset with filterMix at fully wet", async () => {
    const { contractModule, presetModule, migrationsModule } = await loadModules();
    const legacyContract = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: LEGACY_PARAMETERS,
    });
    const currentContract = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [
            ...LEGACY_PARAMETERS,
            { endpointID: "filterMix", type: "number", min: 0, max: 1, defaultValue: 1 },
            { endpointID: "globalTune", type: "number", min: -24, max: 24, defaultValue: 0 },
            ...AMP_STAGE_PARAMETERS,
            ...KEY_TRACK_PARAMETERS,
        ],
        storedState: [{ key: "bounce.v1", schemaVersion: 1, required: true }],
    });
    const legacyPreset = {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "wavetable-synth",
        presetID: "user.pre-mix",
        label: "Pre-Mix",
        contract: legacyContract,
        parameters: { filterMode: 1, filterCutoff: 2_400, filterQ: 4, ampRelease: 1.7 },
        storedState: {},
    };
    const writes = [];

    const normalized = presetModule.applyEffectPresetV2({
        preset: legacyPreset,
        currentContract,
        patchConnection: {
            sendEventOrValue(endpointID, value) {
                writes.push({ endpointID, value });
            },
        },
        migrations: migrationsModule.buildSynthPresetMigrations(currentContract),
    });

    assert.equal(normalized.parameters.filterMix, 1);
    assert.equal(normalized.parameters.globalTune, 0);
    assert.equal(normalized.parameters.filterCutoffKeyTrackEnabled, 0);
    assert.equal(normalized.parameters.filterCutoffKeyTrackOffsetSemitones, 0);
    assert.deepEqual(
        writes.filter(({ endpointID }) => endpointID === "filterMix"),
        [{ endpointID: "filterMix", value: 1 }],
    );
    // The migrated preset keeps every stored legacy value.
    assert.equal(normalized.parameters.filterCutoff, 2_400);
    assert.equal(normalized.parameters.filterQ, 4);
    assert.equal(normalized.parameters.ampRelease, 1.7);
    assert.equal(normalized.storedState["bounce.v1"], null);
});

test("the derived synth migration adds an oscillator-mode bounce reference to pre-Bounce presets", async () => {
    const { contractModule, presetModule, migrationsModule } = await loadModules();
    const parameters = [
        ...LEGACY_PARAMETERS,
        { endpointID: "filterMix", type: "number", min: 0, max: 1, defaultValue: 1 },
    ];
    const legacyContract = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters,
    });
    const currentContract = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [
            ...parameters,
            { endpointID: "globalTune", type: "number", min: -24, max: 24, defaultValue: 0 },
            ...AMP_STAGE_PARAMETERS,
            ...KEY_TRACK_PARAMETERS,
        ],
        storedState: [{ key: "bounce.v1", schemaVersion: 1, required: true }],
    });
    const normalized = presetModule.normalizeEffectPresetV2({
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "wavetable-synth",
        presetID: "user.pre-bounce",
        label: "Pre-Bounce",
        contract: legacyContract,
        parameters: {
            filterMode: 1,
            filterCutoff: 2_400,
            filterQ: 4,
            ampRelease: 0.83,
            filterMix: 0.5,
        },
        storedState: {},
    }, {
        currentContract,
        migrations: migrationsModule.buildSynthPresetMigrations(currentContract),
    });

    assert.equal(normalized.storedState["bounce.v1"], null);
    assert.equal(normalized.parameters.filterMix, 0.5);
    assert.equal(normalized.parameters.globalTune, 0);
    assert.equal(normalized.parameters.ampRelease, 0.83);
});

test("the newest synth migration restores pre-Global-Tune presets at neutral zero", async () => {
    const { contractModule, presetModule, migrationsModule } = await loadModules();
    const previousParameters = [
        ...LEGACY_PARAMETERS,
        { endpointID: "filterMix", type: "number", min: 0, max: 1, defaultValue: 1 },
    ];
    const storedState = [{ key: "bounce.v1", schemaVersion: 1, required: true }];
    const previousContract = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: previousParameters,
        storedState,
    });
    const currentContract = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [
            ...previousParameters,
            { endpointID: "globalTune", type: "number", min: -24, max: 24, defaultValue: 0 },
            ...AMP_STAGE_PARAMETERS,
            ...KEY_TRACK_PARAMETERS,
        ],
        storedState,
    });
    const normalized = presetModule.normalizeEffectPresetV2({
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "wavetable-synth",
        presetID: "user.pre-global-tune",
        label: "Pre Global Tune",
        contract: previousContract,
        parameters: {
            filterMode: 1,
            filterCutoff: 2_400,
            filterQ: 4,
            ampRelease: 0.61,
            filterMix: 0.63,
        },
        storedState: { "bounce.v1": null },
    }, {
        currentContract,
        migrations: migrationsModule.buildSynthPresetMigrations(currentContract),
    });

    assert.equal(normalized.parameters.globalTune, 0);
    assert.equal(normalized.parameters.filterMix, 0.63);
    assert.equal(normalized.parameters.ampAttack, 0.01);
    assert.equal(normalized.parameters.ampDecay, 0.001);
    assert.equal(normalized.parameters.ampSustain, 1);
    assert.equal(normalized.parameters.ampRelease, 0.61);
});

test("the migration builder rejects a contract that lacks the filterMix parameter", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const contractWithoutMix = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [
            ...LEGACY_PARAMETERS,
            { endpointID: "globalTune", type: "number", min: -24, max: 24, defaultValue: 0 },
            ...AMP_STAGE_PARAMETERS,
            ...KEY_TRACK_PARAMETERS,
        ],
        storedState: [{ key: "bounce.v1", schemaVersion: 1, required: true }],
    });

    assert.throws(
        () => migrationsModule.buildSynthPresetMigrations(contractWithoutMix),
        /filterMix/,
    );
});

test("the migration builder rejects a contract that lacks Global Tune", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const contractWithoutGlobalTune = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [
            ...LEGACY_PARAMETERS,
            { endpointID: "filterMix", type: "number", min: 0, max: 1, defaultValue: 1 },
            ...AMP_STAGE_PARAMETERS,
            ...KEY_TRACK_PARAMETERS,
        ],
        storedState: [{ key: "bounce.v1", schemaVersion: 1, required: true }],
    });

    assert.throws(
        () => migrationsModule.buildSynthPresetMigrations(contractWithoutGlobalTune),
        /globalTune/,
    );
});

test("the migration builder rejects a contract that lacks one appended Amp Envelope stage", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const contractWithoutSustain = contractModule.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [
            ...LEGACY_PARAMETERS,
            { endpointID: "filterMix", type: "number", min: 0, max: 1, defaultValue: 1 },
            { endpointID: "globalTune", type: "number", min: -24, max: 24, defaultValue: 0 },
            ...AMP_STAGE_PARAMETERS.filter(({ endpointID }) => endpointID !== "ampSustain"),
        ],
        storedState: [{ key: "bounce.v1", schemaVersion: 1, required: true }],
    });

    assert.throws(
        () => migrationsModule.buildSynthPresetMigrations(contractWithoutSustain),
        /all three appended Amp Envelope parameters/,
    );
});
