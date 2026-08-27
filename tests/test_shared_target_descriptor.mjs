import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const catalogPromise = loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");
const rackCatalogPromise = loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts");
const modulationTargetsPromise = loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");

test("modulation-source assets deliberately contain no separate LFO family", async () => {
    const manifest = JSON.parse(await readFile(
        path.join(repoRoot, "ui/assets/modulation-sources/manifest.json"),
        "utf8",
    ));
    const identities = manifest.assets.map((asset) => asset.id);

    assert.equal(Object.prototype.hasOwnProperty.call(manifest.glyphSources, "lfo"), false);
    assert.equal(identities.some((identity) => /lfo/i.test(identity)), false);
    assert.deepEqual(
        identities.filter((identity) => /^(mseg|envelope|macro)-[1-3]$/.test(identity)).sort(),
        [
            "envelope-1", "envelope-2", "envelope-3",
            "macro-1", "macro-2", "macro-3",
            "mseg-1", "mseg-2", "mseg-3",
        ],
    );
});

const OSCILLATOR_MODULATION_TARGETS = [
    "framePosition",
    "warpAmount",
    "pitchSemitones",
    "volumeDb",
    "pan",
    "unisonDetune",
    "unisonBlend",
    "unisonWidth",
    "unisonWavetablePositionSpread",
    "unisonWarpSpread",
];

const EXPECTED_VOICE_BINDINGS = {
    ...Object.fromEntries(["A", "B", "C"].flatMap((oscillator) => (
        OSCILLATOR_MODULATION_TARGETS.map((target) => [
            `osc${oscillator}.${target}`,
            ["unbacked", "no-endpoint", null],
        ])
    ))),
    "voice-filter.cutoff": ["endpoint", "filterCutoff", "filterCutoffHz"],
    "voice-filter.resonance": ["endpoint", "filterQ", "filterQ"],
    "voice-filter.drive": ["unbacked", "no-endpoint", null],
};

test("the catalog is the complete eight-effect, Frequency Split, and voice surface", async () => {
    const catalog = await catalogPromise;
    const rackCatalog = await rackCatalogPromise;
    const modulationTargets = await modulationTargetsPromise;
    const all = catalog.allTargetDescriptors();
    const rackParameters = rackCatalog.allRackParameterDescriptors();
    const effectsTargets = all.filter((descriptor) => descriptor.workspace === "effects");
    const rackTargets = effectsTargets.filter((descriptor) => descriptor.moduleId !== "frequency-split");
    const frequencySplitTargets = effectsTargets.filter((descriptor) => descriptor.moduleId === "frequency-split");
    const voiceTargets = all.filter((descriptor) => descriptor.workspace === "voice");
    const describedVoiceModulationKinds = voiceTargets.flatMap((descriptor) => (
        descriptor.modulationTargetKind === null ? [] : [descriptor.modulationTargetKind]
    ));
    const canonicalVoiceModulationKinds = modulationTargets.VOICE_MODULATION_TARGET_IDENTITIES
        .map((identity) => identity.kind);

    assert.equal(rackCatalog.RACK_EFFECT_DESCRIPTORS.length, 8);
    assert.equal(rackTargets.length, rackParameters.length);
    assert.deepEqual(
        describedVoiceModulationKinds.toSorted(),
        canonicalVoiceModulationKinds.toSorted(),
    );
    assert.deepEqual(
        rackTargets.map((descriptor) => descriptor.targetId),
        rackParameters.map((parameter) => `${parameter.effectId}.${parameter.endpointID}`),
    );
    assert.deepEqual(
        frequencySplitTargets.map((descriptor) => descriptor.targetId),
        ["frequency-split.low", "frequency-split.high"],
    );
    assert.equal(new Set(all.map((descriptor) => descriptor.targetId)).size, all.length);
});

test("the authoritative rack parameter index is stable and allocation-free", async () => {
    const rackCatalog = await rackCatalogPromise;
    const firstRead = rackCatalog.allRackParameterDescriptors();
    const secondRead = rackCatalog.allRackParameterDescriptors();

    assert.equal(firstRead, secondRead);
    for (const descriptor of firstRead) {
        assert.equal(rackCatalog.getRackParameterDescriptor(descriptor.endpointID), descriptor);
    }
    assert.equal(rackCatalog.getRackParameterDescriptor("missingRackParameter"), null);
});

test("Distortion Type is a saved discrete control, not a modulation destination", async () => {
    const rackCatalog = await rackCatalogPromise;
    const type = rackCatalog.getRackParameterDescriptor("distortionType");

    assert.notEqual(type, null);
    assert.equal(type.initial, 1);
    assert.equal(type.step, 1);
    assert.equal(type.modulationTargetIndex, null);
    assert.deepEqual(type.choices, [
        { label: "Symmetric", value: 0 },
        { label: "Asymmetric", value: 1 },
        { label: "Wavefold", value: 2 },
    ]);
});

test("every rack target is bound to its real Cmajor endpoint", async () => {
    const catalog = await catalogPromise;
    const rackCatalog = await rackCatalogPromise;
    const targetById = new Map(catalog.allTargetDescriptors().map((descriptor) => [descriptor.targetId, descriptor]));

    for (const parameter of rackCatalog.allRackParameterDescriptors()) {
        const descriptor = targetById.get(`${parameter.effectId}.${parameter.endpointID}`);
        assert.notEqual(descriptor, undefined, parameter.endpointID);
        assert.equal(descriptor.binding._tag, "endpoint", parameter.endpointID);
        assert.equal(descriptor.binding.endpointId, parameter.endpointID, parameter.endpointID);
        assert.equal(descriptor.articulationParameterId, null, parameter.endpointID);
        assert.equal(descriptor.isQuick, parameter.quick, parameter.endpointID);
        assert.equal(
            descriptor.modulationTargetKind,
            parameter.modulationTargetIndex === null
                ? null
                : (await import("../patch_gui/modulation-targets.js")).laneBaseKindForRackEndpoint(
                    rackCatalog.rackModulationIdentityEndpointID(parameter),
                ),
            parameter.endpointID,
        );
        assert.ok(Math.abs(descriptor.binding.toEngine(descriptor.initialValue) - parameter.initial) < 1e-6);
    }
});

test("all bound endpoint conversions roundtrip across the normalized domain", async () => {
    const catalog = await catalogPromise;
    for (const descriptor of catalog.allTargetDescriptors()) {
        if (descriptor.binding._tag !== "endpoint") continue;
        fc.assert(fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (value) => {
            const engineValue = descriptor.binding.toEngine(value);
            assert.ok(Math.abs(descriptor.binding.fromEngine(engineValue) - value) < 1e-6, descriptor.targetId);
        }));
    }
});

test("voice bindings retain their shipped endpoint and articulation contract", async () => {
    const catalog = await catalogPromise;
    const descriptorById = new Map(
        catalog.allTargetDescriptors().map((descriptor) => [descriptor.targetId, descriptor]),
    );
    for (const [targetId, expected] of Object.entries(EXPECTED_VOICE_BINDINGS)) {
        const descriptor = descriptorById.get(targetId);
        assert.notEqual(descriptor, undefined, targetId);
        const [tag, detail, articulationParameterId] = expected;
        assert.equal(descriptor.binding._tag, tag, targetId);
        assert.equal(
            descriptor.binding._tag === "endpoint" ? descriptor.binding.endpointId : descriptor.binding.reason,
            detail,
            targetId,
        );
        assert.equal(descriptor.articulationParameterId, articulationParameterId, targetId);
    }
});

test("Phaser and Delay Free/Sync compounds have real mode, free-value, and division endpoints", async () => {
    const catalog = await catalogPromise;
    const byId = new Map(catalog.allTargetDescriptors().map((descriptor) => [descriptor.targetId, descriptor]));
    for (const targetId of [
        "phaser.phaserRateMode", "phaser.phaserRate", "phaser.phaserRateDivision",
        "delay.delayTimeMode", "delay.delayTime", "delay.delayDivision",
    ]) {
        assert.equal(byId.get(targetId)?.binding._tag, "endpoint", targetId);
    }
    assert.equal(byId.get("phaser.phaserRate")?.compound, "sync");
    assert.equal(byId.get("delay.delayTime")?.compound, "sync");
});

test("parseTargetId accepts exactly the live catalog surface", async () => {
    const catalog = await catalogPromise;
    for (const descriptor of catalog.allTargetDescriptors()) {
        const parsed = catalog.parseTargetId(descriptor.targetId);
        assert.equal(parsed._tag, "ok", descriptor.targetId);
        assert.equal(catalog.getTargetDescriptor(parsed.value), descriptor);
    }
    for (const bad of [
        "", "wavetable", "wavetable.index", "amp-pan.pan", "filter.cutoff", "chorusEnabled", "Filter.Cutoff",
    ]) {
        assert.equal(catalog.parseTargetId(bad)._tag, "err", bad);
    }
});
