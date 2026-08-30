import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const LANDED_VOICE_ENHANCER_PARAMETERS = [
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
    {
        endpointID: "voiceEnhancerKeyTrackOffsetSemitones",
        type: "number",
        min: -12,
        max: 60,
        defaultValue: 0,
    },
];

const T74_POLISH_PARAMETERS = [
    { endpointID: "polishEnhancerAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
    { endpointID: "polishCompressionClipAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
    { endpointID: "polishOutputTrimDb", type: "number", min: -24, max: 12, defaultValue: 0 },
    { endpointID: "polishSafeBassAmount", type: "number", min: 0, max: 1, defaultValue: 0 },
    ...[
        "polishSafeBassBypass",
        "polishEnhancerBypass",
        "polishCompressionClipBypass",
        "polishOutputTrimBypass",
    ].map((endpointID) => ({
        endpointID,
        type: "integer",
        min: 0,
        max: 1,
        step: 1,
        defaultValue: 0,
        discrete: true,
        text: "Active|Bypassed",
    })),
];

async function loadModules() {
    const [share, contract, preset, migrations] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/sound-share-link.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-preset-v2.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/synth-preset-migrations.ts"),
    ]);
    return { share, contract, preset, migrations };
}

async function deflateFragment(text, version = 2) {
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
            ...LANDED_VOICE_ENHANCER_PARAMETERS,
            ...T74_POLISH_PARAMETERS,
        ],
        storedState: [
            { key: "bounce.v1", schemaVersion: 1, required: true },
            { key: "modulation.v6", schemaVersion: 6, required: true },
        ],
    });
}

function envelopeWithExactByteLength(byteLength) {
    const envelope = {
        format: "cosimo.soundShare",
        version: 2,
        preset: { padding: "" },
        supplementalStoredState: {},
    };
    const emptyLength = Buffer.byteLength(JSON.stringify(envelope));
    assert.ok(byteLength >= emptyLength);
    envelope.preset.padding = "x".repeat(byteLength - emptyLength);
    assert.equal(Buffer.byteLength(JSON.stringify(envelope)), byteLength);
    return envelope;
}

const soundDocumentArbitrary = fc.record({
    wavetable: fc.integer({ min: 0, max: 238 }),
    filterMix: fc.integer({ min: 0, max: 1_000 }).map((value) => value / 1_000),
    ampAttack: fc.integer({ min: 1, max: 10_000 }).map((value) => value / 1_000),
    ampDecay: fc.integer({ min: 1, max: 10_000 }).map((value) => value / 1_000),
    ampSustain: fc.integer({ min: 0, max: 1_000 }).map((value) => value / 1_000),
    ampRelease: fc.integer({ min: 5, max: 10_000 }).map((value) => value / 1_000),
    globalTune: fc.integer({ min: -2_400, max: 2_400 }).map((value) => value / 100),
    polishEnhancerAmount: fc.integer({ min: 0, max: 1_000 }).map((value) => value / 1_000),
    polishCompressionClipAmount: fc.integer({ min: 0, max: 1_000 }).map((value) => value / 1_000),
    polishOutputTrimDb: fc.integer({ min: -2_400, max: 1_200 }).map((value) => value / 100),
    polishSafeBassAmount: fc.integer({ min: 0, max: 1_000 }).map((value) => value / 1_000),
    polishSafeBassBypass: fc.integer({ min: 0, max: 1 }),
    polishEnhancerBypass: fc.integer({ min: 0, max: 1 }),
    polishCompressionClipBypass: fc.integer({ min: 0, max: 1 }),
    polishOutputTrimBypass: fc.integer({ min: 0, max: 1 }),
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
                voiceEnhancerFrequency: 130,
                voiceEnhancerQ: 0.71,
                voiceEnhancerAmount: 0,
                voiceEnhancerKeyTrackEnabled: 0,
                voiceEnhancerKeyTrackOffsetSemitones: 0,
                polishEnhancerAmount: document.polishEnhancerAmount,
                polishCompressionClipAmount: document.polishCompressionClipAmount,
                polishOutputTrimDb: document.polishOutputTrimDb,
                polishSafeBassAmount: document.polishSafeBassAmount,
                polishSafeBassBypass: document.polishSafeBassBypass,
                polishEnhancerBypass: document.polishEnhancerBypass,
                polishCompressionClipBypass: document.polishCompressionClipBypass,
                polishOutputTrimBypass: document.polishOutputTrimBypass,
            },
            storedState: {
                "bounce.v1": null,
                "modulation.v6": { routes: document.routes },
            },
        }, { currentContract: soundContract });
        const envelope = {
            format: "cosimo.soundShare",
            version: 2,
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

test("a decoded pre-Polish shared sound has no compatibility path into the current contract", async () => {
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
            ...T74_POLISH_PARAMETERS,
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
        version: 2,
        preset: legacyPreset,
        supplementalStoredState: { "lane.v1": { version: 2, order: [] } },
    });
    assert.equal(encoded.ok, true, encoded.ok ? undefined : encoded.error.message);
    const decoded = await share.decodeSoundShareFragment(encoded.value);
    assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);

    assert.throws(
        () => preset.normalizeEffectPresetV2(decoded.value.preset, {
            currentContract: nextContract,
            migrations: migrations.buildSynthPresetMigrations(nextContract),
        }),
        /No migration is registered/,
    );
});

test("a decoded three-control Polish sound cannot enter the T74 contract", async () => {
    const { share, contract, preset, migrations } = await loadModules();
    const t74Contract = currentContract(contract.buildCanonicalPluginStateContract);
    const t74EndpointIDs = new Set([
        "polishSafeBassAmount",
        "polishSafeBassBypass",
        "polishEnhancerBypass",
        "polishCompressionClipBypass",
        "polishOutputTrimBypass",
    ]);
    const threeControlContract = contract.buildCanonicalPluginStateContract({
        effectID: t74Contract.effectID,
        parameters: t74Contract.parameters.filter(
            ({ endpointID }) => !t74EndpointIDs.has(endpointID),
        ),
        storedState: t74Contract.storedState,
    });
    const previousPreset = {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: threeControlContract.effectID,
        presetID: "user.three-control-polish",
        label: "Three-control Polish",
        contract: threeControlContract,
        parameters: Object.fromEntries(threeControlContract.parameters.map(
            ({ endpointID, defaultValue }) => [endpointID, defaultValue],
        )),
        storedState: {
            "bounce.v1": null,
            "modulation.v6": { routes: [] },
        },
    };
    const encoded = await share.encodeSoundShareFragment({
        format: "cosimo.soundShare",
        version: 2,
        preset: previousPreset,
        supplementalStoredState: {},
    });
    assert.equal(encoded.ok, true, encoded.ok ? undefined : encoded.error.message);
    assert.match(encoded.value, /^#p=2\./);

    const decoded = await share.decodeSoundShareFragment(encoded.value);
    assert.equal(decoded.ok, true, decoded.ok ? undefined : decoded.error.message);
    assert.throws(
        () => preset.normalizeEffectPresetV2(decoded.value.preset, {
            currentContract: t74Contract,
            migrations: migrations.buildSynthPresetMigrations(t74Contract),
        }),
        /No migration is registered/,
    );
});

test("malformed, corrupt, oversized, and unsupported fragments are rejected as values", async () => {
    const { share } = await loadModules();
    const invalidJSON = await deflateFragment("not-json");
    const duplicateKeys = await deflateFragment(
        '{"format":"cosimo.soundShare","format":"cosimo.soundShare","version":2,"preset":{},"supplementalStoredState":{}}',
    );
    const cases = [
        ["#p=", "InvalidFragment"],
        ["#p=2.!", "InvalidFragment"],
        ["#p=2.AAAA", "DecompressionFailed"],
        [invalidJSON, "InvalidEnvelope"],
        [duplicateKeys, "InvalidEnvelope"],
        ["#p=1.AAAA", "UnsupportedVersion"],
        ["#p=3.AAAA", "UnsupportedVersion"],
        [`#p=2.${"A".repeat(128_001)}`, "PayloadTooLarge"],
    ];

    for (const [fragment, expectedTag] of cases) {
        const result = await share.decodeSoundShareFragment(fragment);
        assert.equal(result.ok, false, fragment.slice(0, 24));
        assert.equal(result.error._tag, expectedTag, fragment.slice(0, 24));
    }
    assert.deepEqual(await share.decodeSoundShareFragment("#section=voice"), { ok: true, value: null });
});

test("measured URL policy has exact warning and refusal boundaries", async () => {
    const { share } = await loadModules();
    assert.equal(share.classifySoundShareURLLength(8_000), "normal");
    assert.equal(share.classifySoundShareURLLength(8_001), "warning");
    assert.equal(share.classifySoundShareURLLength(128_000), "warning");
    assert.equal(share.classifySoundShareURLLength(128_001), "refused");
});

test("the measured generated maximum fits the decompressed cap and one byte over is refused", async () => {
    const { share } = await loadModules();
    assert.equal(share.SOUND_SHARE_DECOMPRESSED_MAX_BYTES, 3_250_000);

    const generatedMaximum = envelopeWithExactByteLength(3_110_089);
    const accepted = await share.encodeSoundShareFragment(generatedMaximum);
    assert.equal(accepted.ok, true, accepted.ok ? undefined : accepted.error.message);
    const restored = await share.decodeSoundShareFragment(accepted.value);
    assert.equal(restored.ok, true, restored.ok ? undefined : restored.error.message);
    assert.deepEqual(restored.value, generatedMaximum);

    const overCap = envelopeWithExactByteLength(3_250_001);
    const refusedEncode = await share.encodeSoundShareFragment(overCap);
    assert.equal(refusedEncode.ok, false);
    assert.equal(refusedEncode.error._tag, "PayloadTooLarge");
    const refusedDecode = await share.decodeSoundShareFragment(
        await deflateFragment(JSON.stringify(overCap)),
    );
    assert.equal(refusedDecode.ok, false);
    assert.equal(refusedDecode.error._tag, "PayloadTooLarge");
});

test("the envelope boundary rejects extra fields, non-JSON values, and invalid encode callers", async () => {
    const { share } = await loadModules();
    for (const envelope of [
        {
            format: "cosimo.soundShare",
            version: 2,
            preset: {},
            supplementalStoredState: {},
            unexpected: true,
        },
        {
            format: "cosimo.soundShare",
            version: 2,
            preset: { invalid: undefined },
            supplementalStoredState: {},
        },
    ]) {
        const result = await share.encodeSoundShareFragment(envelope);
        assert.equal(result.ok, false);
        assert.equal(result.error._tag, "InvalidEnvelope");
    }
});
