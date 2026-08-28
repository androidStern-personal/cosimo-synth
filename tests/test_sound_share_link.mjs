import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadModules() {
    const [share, contract, preset, migrations] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/sound-share-link.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-preset-v2.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/synth-preset-migrations.ts"),
    ]);
    return { share, contract, preset, migrations };
}

async function deflateFragment(text, version = 1) {
    const bytes = new TextEncoder().encode(text);
    const compressed = new Uint8Array(await new Response(
        new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer());
    return `#p=${version}.${Buffer.from(compressed).toString("base64url")}`;
}

function currentContract(buildCanonicalPluginStateContract) {
    return buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [
            { endpointID: "sourceMode", type: "number", min: 0, max: 1, defaultValue: 0 },
            { endpointID: "oscAWavetableSelect", type: "number", min: 0, max: 238, defaultValue: 35 },
            { endpointID: "filterMix", type: "number", min: 0, max: 1, defaultValue: 1 },
            { endpointID: "ampRelease", type: "number", min: 0.005, max: 10, defaultValue: 0.2 },
            { endpointID: "globalTune", type: "number", min: -24, max: 24, defaultValue: 0 },
            { endpointID: "voiceEnabled", type: "boolean", defaultValue: true },
            { endpointID: "ampAttack", type: "number", min: 0.001, max: 10, defaultValue: 0.01 },
            { endpointID: "ampDecay", type: "number", min: 0.001, max: 10, defaultValue: 0.001 },
            { endpointID: "ampSustain", type: "number", min: 0, max: 1, defaultValue: 1 },
        ],
        storedState: [
            { key: "bounce.v1", schemaVersion: 1, required: true },
            { key: "modulation.v6", schemaVersion: 6, required: true },
        ],
    });
}

const soundDocumentArbitrary = fc.record({
    wavetable: fc.integer({ min: 0, max: 238 }),
    filterMix: fc.integer({ min: 0, max: 1_000 }).map((value) => value / 1_000),
    ampAttack: fc.integer({ min: 1, max: 10_000 }).map((value) => value / 1_000),
    ampDecay: fc.integer({ min: 1, max: 10_000 }).map((value) => value / 1_000),
    ampSustain: fc.integer({ min: 0, max: 1_000 }).map((value) => value / 1_000),
    ampRelease: fc.integer({ min: 5, max: 10_000 }).map((value) => value / 1_000),
    globalTune: fc.integer({ min: -2_400, max: 2_400 }).map((value) => value / 100),
    voiceEnabled: fc.boolean(),
    routes: fc.array(fc.record({
        id: fc.string({ minLength: 1, maxLength: 16 }),
        amount: fc.integer({ min: -1_000, max: 1_000 }).map((value) => value / 1_000),
        target: fc.constantFrom("oscA.framePosition", "voice-filter.cutoff", "chorus.mix", "voice.globalTune"),
    }), { maxLength: 8 }),
    laneOrder: fc.shuffledSubarray(["distortion", "chorus", "delay", "reverb"], {
        minLength: 4,
        maxLength: 4,
    }),
});

test("random valid complete sounds survive deflate/base64url round trips exactly", async () => {
    const { share, contract, preset } = await loadModules();
    const soundContract = currentContract(contract.buildCanonicalPluginStateContract);

    await fc.assert(fc.asyncProperty(soundDocumentArbitrary, async (document) => {
        const validPreset = preset.normalizeEffectPresetV2({
            kind: "cosimo.effectPreset",
            version: 2,
            effectID: soundContract.effectID,
            presetID: "cosimo.share.property",
            label: "Property Sound",
            contract: soundContract,
            parameters: {
                sourceMode: 0,
                oscAWavetableSelect: document.wavetable,
                filterMix: document.filterMix,
                ampRelease: document.ampRelease,
                globalTune: document.globalTune,
                voiceEnabled: document.voiceEnabled,
                ampAttack: document.ampAttack,
                ampDecay: document.ampDecay,
                ampSustain: document.ampSustain,
            },
            storedState: {
                "bounce.v1": null,
                "modulation.v6": { routes: document.routes },
            },
        }, { currentContract: soundContract });
        const envelope = {
            format: "cosimo.soundShare",
            version: 1,
            preset: validPreset,
            supplementalStoredState: {
                "lane.v1": {
                    version: 2,
                    order: document.laneOrder,
                    selectedDeviceId: document.laneOrder[0],
                },
            },
        };

        const encoded = await share.encodeSoundShareFragment(envelope);
        assert.equal(encoded.ok, true, encoded.ok ? undefined : encoded.error.message);
        const decoded = await share.decodeSoundShareFragment(encoded.value);
        assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);
        assert.deepEqual(decoded.value, JSON.parse(JSON.stringify(envelope)));
    }), { numRuns: 150 });
});

test("version skew uses the existing synth preset migrations after link decode", async () => {
    const { share, contract, preset, migrations } = await loadModules();
    const legacyParameters = [
        { endpointID: "sourceMode", type: "number", min: 0, max: 1, defaultValue: 0 },
        { endpointID: "oscAWavetableSelect", type: "number", min: 0, max: 237, defaultValue: 0 },
        { endpointID: "ampRelease", type: "number", min: 0.005, max: 10, defaultValue: 0.2 },
        { endpointID: "voiceEnabled", type: "boolean", defaultValue: true },
    ];
    const legacyContract = contract.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: legacyParameters,
        storedState: [{ key: "modulation.v6", schemaVersion: 6, required: true }],
    });
    const nextContract = contract.buildCanonicalPluginStateContract({
        effectID: "wavetable-synth",
        parameters: [
            ...legacyParameters,
            { endpointID: "filterMix", type: "number", min: 0, max: 1, defaultValue: 1 },
            { endpointID: "globalTune", type: "number", min: -24, max: 24, defaultValue: 0 },
            { endpointID: "ampAttack", type: "number", min: 0.001, max: 10, defaultValue: 0.01 },
            { endpointID: "ampDecay", type: "number", min: 0.001, max: 10, defaultValue: 0.001 },
            { endpointID: "ampSustain", type: "number", min: 0, max: 1, defaultValue: 1 },
            { endpointID: "filterCutoffKeyTrackEnabled", type: "number", min: 0, max: 1, defaultValue: 0 },
            { endpointID: "filterCutoffKeyTrackOffsetSemitones", type: "number", min: -60, max: 60, defaultValue: 0 },
            { endpointID: "voiceEnhancerFrequency", type: "number", min: 20, max: 20_000, defaultValue: 130 },
            { endpointID: "voiceEnhancerQ", type: "number", min: 0.1, max: 10, defaultValue: 0.71 },
            { endpointID: "voiceEnhancerAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
            { endpointID: "voiceEnhancerKeyTrackEnabled", type: "number", min: 0, max: 1, defaultValue: 0 },
            { endpointID: "voiceEnhancerKeyTrackOffsetSemitones", type: "number", min: -12, max: 60, defaultValue: 0 },
        ],
        storedState: [
            { key: "modulation.v6", schemaVersion: 6, required: true },
            { key: "bounce.v1", schemaVersion: 1, required: true },
        ],
    });
    const legacyPreset = {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: legacyContract.effectID,
        presetID: "user.pre-mix-and-bounce",
        label: "Older Shared Sound",
        contract: legacyContract,
        parameters: { sourceMode: 0, oscAWavetableSelect: 93, ampRelease: 1.73, voiceEnabled: false },
        storedState: { "modulation.v6": { routes: [{ id: "legacy-route" }] } },
    };
    const encoded = await share.encodeSoundShareFragment({
        format: "cosimo.soundShare",
        version: 1,
        preset: legacyPreset,
        supplementalStoredState: { "lane.v1": { version: 2, order: [] } },
    });
    assert.equal(encoded.ok, true, encoded.ok ? undefined : encoded.error.message);
    const decoded = await share.decodeSoundShareFragment(encoded.value);
    assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);

    const normalized = preset.normalizeEffectPresetV2(decoded.value.preset, {
        currentContract: nextContract,
        migrations: migrations.buildSynthPresetMigrations(nextContract),
    });
    assert.equal(normalized.parameters.filterMix, 1);
    assert.equal(normalized.parameters.globalTune, 0);
    assert.equal(normalized.parameters.ampAttack, 0.01);
    assert.equal(normalized.parameters.ampDecay, 0.001);
    assert.equal(normalized.parameters.ampSustain, 1);
    assert.equal(normalized.parameters.ampRelease, 1.73);
    assert.equal(normalized.parameters.filterCutoffKeyTrackEnabled, 0);
    assert.equal(normalized.parameters.filterCutoffKeyTrackOffsetSemitones, 0);
    assert.equal(normalized.parameters.voiceEnhancerFrequency, 130);
    assert.equal(normalized.parameters.voiceEnhancerQ, 0.71);
    assert.equal(normalized.parameters.voiceEnhancerAmount, 0);
    assert.equal(normalized.parameters.voiceEnhancerKeyTrackEnabled, 0);
    assert.equal(normalized.parameters.voiceEnhancerKeyTrackOffsetSemitones, 0);
    assert.equal(normalized.storedState["bounce.v1"], null);
    assert.deepEqual(normalized.storedState["modulation.v6"], legacyPreset.storedState["modulation.v6"]);
});

test("malformed, corrupt, oversized, and unsupported fragments are rejected as values", async () => {
    const { share } = await loadModules();
    const invalidJSON = await deflateFragment("not-json");
    const duplicateKeys = await deflateFragment(
        '{"format":"cosimo.soundShare","format":"cosimo.soundShare","version":1,"preset":{},"supplementalStoredState":{}}',
    );
    const cases = [
        ["#p=", "InvalidFragment"],
        ["#p=1.!", "InvalidFragment"],
        ["#p=1.AAAA", "DecompressionFailed"],
        [invalidJSON, "InvalidEnvelope"],
        [duplicateKeys, "InvalidEnvelope"],
        ["#p=2.AAAA", "UnsupportedVersion"],
        [`#p=1.${"A".repeat(8_001)}`, "PayloadTooLarge"],
    ];

    for (const [fragment, expectedTag] of cases) {
        const result = await share.decodeSoundShareFragment(fragment);
        assert.equal(result.ok, false, fragment.slice(0, 24));
        assert.equal(result.error._tag, expectedTag, fragment.slice(0, 24));
    }
    assert.deepEqual(await share.decodeSoundShareFragment("#section=voice"), { ok: true, value: null });
});

test("URL length policy has exact warning and refusal boundaries", async () => {
    const { share } = await loadModules();
    assert.equal(share.classifySoundShareURLLength(2_000), "normal");
    assert.equal(share.classifySoundShareURLLength(2_001), "warning");
    assert.equal(share.classifySoundShareURLLength(8_000), "warning");
    assert.equal(share.classifySoundShareURLLength(8_001), "refused");
});

test("the envelope boundary rejects extra fields, non-JSON values, and invalid encode callers", async () => {
    const { share } = await loadModules();
    for (const envelope of [
        {
            format: "cosimo.soundShare",
            version: 1,
            preset: {},
            supplementalStoredState: {},
            unexpected: true,
        },
        {
            format: "cosimo.soundShare",
            version: 1,
            preset: { invalid: undefined },
            supplementalStoredState: {},
        },
    ]) {
        const result = await share.encodeSoundShareFragment(envelope);
        assert.equal(result.ok, false);
        assert.equal(result.error._tag, "InvalidEnvelope");
    }
});
