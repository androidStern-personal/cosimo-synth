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

const VOICE_ENHANCER_PARAMETERS = [
    { endpointID: "voiceEnhancerFrequency", type: "number", min: 20, max: 20_000, defaultValue: 130 },
    { endpointID: "voiceEnhancerQ", type: "number", min: 0.1, max: 10, defaultValue: 0.71 },
    { endpointID: "voiceEnhancerAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
    {
        endpointID: "voiceEnhancerKeyTrackEnabled",
        type: "integer",
        min: 0,
        max: 1,
        step: 1,
        defaultValue: 0,
        discrete: true,
        text: "Off|On",
    },
    { endpointID: "voiceEnhancerKeyTrackOffsetSemitones", type: "number", min: -12, max: 60, defaultValue: 0 },
];

const POLISH_PARAMETERS = [
    { endpointID: "polishEnhancerAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
    { endpointID: "polishCompressionClipAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
    { endpointID: "polishOutputTrimDb", type: "number", min: -24, max: 12, defaultValue: 0 },
];

const REAL_STYLE_VOICE_ENHANCER_ENDPOINTS = [
    {
        endpointID: "voiceEnhancerFrequency",
        purpose: "parameter",
        annotation: { min: 20, max: 20_000, init: 130, unit: "Hz" },
    },
    {
        endpointID: "voiceEnhancerQ",
        purpose: "parameter",
        annotation: { min: 0.1, max: 10, init: 0.71 },
    },
    {
        endpointID: "voiceEnhancerAmount",
        purpose: "parameter",
        annotation: { min: 0, max: 1, init: 0 },
    },
    {
        endpointID: "voiceEnhancerKeyTrackEnabled",
        purpose: "parameter",
        annotation: {
            min: 0,
            max: 1,
            init: 0,
            discrete: true,
            step: 1,
            text: "Off|On",
        },
    },
    {
        endpointID: "voiceEnhancerKeyTrackOffsetSemitones",
        purpose: "parameter",
        annotation: { min: -12, max: 60, init: 0, unit: "st" },
    },
];

const GENERATED_FLOAT32_VOICE_ENHANCER_ENDPOINTS = REAL_STYLE_VOICE_ENHANCER_ENDPOINTS.map(
    (endpoint) => endpoint.endpointID === "voiceEnhancerQ"
        ? {
            ...endpoint,
            annotation: {
                ...endpoint.annotation,
                min: Math.fround(0.1),
                init: Math.fround(0.71),
            },
        }
        : endpoint,
);

function buildCurrentContract(buildCanonicalPluginStateContract, {
    voiceEnhancerParameters = VOICE_ENHANCER_PARAMETERS,
    polishParameters = POLISH_PARAMETERS,
} = {}) {
    return buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [...LEGACY_PARAMETERS, ...voiceEnhancerParameters, ...polishParameters],
        storedState: [{ key: "lane.v1", schemaVersion: 2, required: true }],
    });
}

test("the complete-sound cut registers no migration from a pre-Polish contract", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const currentContract = buildCurrentContract(contractModule.buildCanonicalPluginStateContract);

    assert.deepEqual(migrationsModule.buildSynthPresetMigrations(currentContract), []);
});

test("the current guard accepts the real-style discrete T62 endpoint contract", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const currentContract = buildCurrentContract(contractModule.buildCanonicalPluginStateContract, {
        voiceEnhancerParameters: REAL_STYLE_VOICE_ENHANCER_ENDPOINTS,
    });
    const keyTrack = currentContract.parameters.find(
        ({ endpointID }) => endpointID === "voiceEnhancerKeyTrackEnabled",
    );

    assert.deepEqual(keyTrack, {
        endpointID: "voiceEnhancerKeyTrackEnabled",
        type: "integer",
        min: 0,
        max: 1,
        step: 1,
        defaultValue: 0,
        discrete: true,
        text: "Off|On",
    });
    assert.deepEqual(migrationsModule.buildSynthPresetMigrations(currentContract), []);
});

test("the current guard accepts Cmajor's exact float32 forms of authored numeric annotations", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const currentContract = buildCurrentContract(contractModule.buildCanonicalPluginStateContract, {
        voiceEnhancerParameters: GENERATED_FLOAT32_VOICE_ENHANCER_ENDPOINTS,
    });
    const q = currentContract.parameters.find(({ endpointID }) => endpointID === "voiceEnhancerQ");

    assert.equal(q.min, 0.10000000149011612);
    assert.equal(q.defaultValue, 0.7099999785423279);
    assert.deepEqual(migrationsModule.buildSynthPresetMigrations(currentContract), []);
});

test("the current guard rejects numeric values near but not equal to the authored or float32 forms", async () => {
    const { contractModule, migrationsModule } = await loadModules();
    const qIndex = REAL_STYLE_VOICE_ENHANCER_ENDPOINTS.findIndex(
        ({ endpointID }) => endpointID === "voiceEnhancerQ",
    );
    const generatedQ = GENERATED_FLOAT32_VOICE_ENHANCER_ENDPOINTS[qIndex];
    const wrongAnnotations = [
        { ...generatedQ.annotation, min: Math.fround(0.1) + 1e-12 },
        { ...generatedQ.annotation, init: Math.fround(0.71) + 1e-12 },
    ];

    for (const annotation of wrongAnnotations) {
        const endpoints = GENERATED_FLOAT32_VOICE_ENHANCER_ENDPOINTS.with(qIndex, {
            ...generatedQ,
            annotation,
        });
        assert.throws(
            () => migrationsModule.buildSynthPresetMigrations(buildCurrentContract(
                contractModule.buildCanonicalPluginStateContract,
                { voiceEnhancerParameters: endpoints },
            )),
            /voiceEnhancerQ/,
        );
    }
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
            voiceEnhancerFrequency: 180,
            voiceEnhancerQ: 0.82,
            voiceEnhancerAmount: 0.38,
            voiceEnhancerKeyTrackEnabled: 1,
            voiceEnhancerKeyTrackOffsetSemitones: 7.5,
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

test("the current-format guard rejects every missing or wrong T62 endpoint", async () => {
    const { contractModule, migrationsModule } = await loadModules();

    for (const expectedParameter of VOICE_ENHANCER_PARAMETERS) {
        const missing = VOICE_ENHANCER_PARAMETERS.filter(
            ({ endpointID }) => endpointID !== expectedParameter.endpointID,
        );
        assert.throws(
            () => migrationsModule.buildSynthPresetMigrations(buildCurrentContract(
                contractModule.buildCanonicalPluginStateContract,
                { voiceEnhancerParameters: missing },
            )),
            new RegExp(expectedParameter.endpointID),
        );

        const wrong = VOICE_ENHANCER_PARAMETERS.map((parameter) => (
            parameter.endpointID === expectedParameter.endpointID
                ? { ...parameter, defaultValue: parameter.defaultValue + 0.25 }
                : parameter
        ));
        assert.throws(
            () => migrationsModule.buildSynthPresetMigrations(buildCurrentContract(
                contractModule.buildCanonicalPluginStateContract,
                { voiceEnhancerParameters: wrong },
            )),
            new RegExp(expectedParameter.endpointID),
        );
    }

    const enabledIndex = VOICE_ENHANCER_PARAMETERS.findIndex(
        ({ endpointID }) => endpointID === "voiceEnhancerKeyTrackEnabled",
    );
    for (const wrongEnabled of [
        {
            endpointID: "voiceEnhancerKeyTrackEnabled",
            type: "number",
            min: 0,
            max: 1,
            defaultValue: 0,
        },
        {
            ...VOICE_ENHANCER_PARAMETERS[enabledIndex],
            text: "No|Yes",
        },
    ]) {
        const wrong = VOICE_ENHANCER_PARAMETERS.with(enabledIndex, wrongEnabled);
        assert.throws(
            () => migrationsModule.buildSynthPresetMigrations(buildCurrentContract(
                contractModule.buildCanonicalPluginStateContract,
                { voiceEnhancerParameters: wrong },
            )),
            /voiceEnhancerKeyTrackEnabled/,
        );
    }
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
                { polishParameters: parameters },
            )),
            expected,
        );
    }
});
