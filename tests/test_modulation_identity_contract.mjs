import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const targetsModulePromise = loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
const modulationModulePromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");
const runtimeModulePromise = loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");
const descriptorModulePromise = loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");

test("the canonical modulation domain has stable collision-free source and target indexes", async () => {
    const targets = await targetsModulePromise;

    assert.equal(targets.MODULATION_SOURCE_COUNT, 14);
    assert.equal(targets.MODULATION_VOICE_TARGET_COUNT, 59);
    assert.equal(targets.MODULATION_RACK_TARGET_COUNT, 47);
    assert.equal(targets.MODULATION_LEGAL_PAIR_COUNT, 1484);

    for (const [group, count] of [["voice", 10], ["macro", 4]]) {
        const identities = targets.MODULATION_SOURCE_IDENTITIES.filter((identity) => identity.group === group);
        assert.equal(identities.length, count);
        assert.deepEqual(identities.map((identity) => identity.runtimeIndex).sort((a, b) => a - b),
            Array.from({ length: count }, (_, index) => index));
    }

    for (const [group, count] of [["voice", 59], ["rack", 47]]) {
        const identities = targets.MODULATION_TARGET_IDENTITIES.filter((identity) => identity.group === group);
        assert.equal(identities.length, count);
        assert.deepEqual(identities.map((identity) => identity.runtimeIndex).sort((a, b) => a - b),
            Array.from({ length: count }, (_, index) => index));
    }

    assert.equal(new Set(targets.MODULATION_SOURCE_IDENTITIES.map((identity) => identity.id)).size, 14);
    assert.equal(new Set(targets.MODULATION_TARGET_IDENTITIES.map((identity) => identity.kind)).size, 106);
    assert.equal(targets.parseModulationSourceIdentity("amp-envelope").runtimeIndex, 9);
    assert.equal(targets.getVoiceModulationTargetIndex("oscA.wavetablePosition"), 0);
    assert.equal(targets.getVoiceModulationTargetIndex("oscB.wavetablePosition"), 10);
    assert.equal(targets.getVoiceModulationTargetIndex("oscC.wavetablePosition"), 20);
    assert.equal(targets.getVoiceModulationTargetIndex("filterCutoffOctaves"), 30);
    assert.equal(targets.getVoiceModulationTargetIndex("filterQ"), 31);
    assert.deepEqual(
        targets.VOICE_MODULATION_TARGET_KINDS.slice(32, 50),
        [
            "mseg1Morph", "mseg2Morph", "mseg3Morph",
            "mseg1Rate", "mseg2Rate", "mseg3Rate",
            "env1Attack", "env1Decay", "env1Sustain", "env1Release",
            "env2Attack", "env2Decay", "env2Sustain", "env2Release",
            "env3Attack", "env3Decay", "env3Sustain", "env3Release",
        ],
    );
    assert.equal(targets.getVoiceModulationTargetIndex("mseg1Morph"), 32);
    assert.equal(targets.getVoiceModulationTargetIndex("mseg3Rate"), 37);
    assert.equal(targets.getVoiceModulationTargetIndex("env3Release"), 49);
    assert.equal(targets.getVoiceModulationTargetIndex("filterMix"), 50);
    assert.equal(targets.getVoiceModulationTargetIndex("globalTuneSemitones"), 51);
    assert.deepEqual(targets.VOICE_MODULATION_TARGET_KINDS.slice(52, 56), [
        "ampAttack", "ampDecay", "ampSustain", "ampRelease",
    ]);
    assert.deepEqual(targets.VOICE_MODULATION_TARGET_KINDS.slice(56), [
        "voiceEnhancerFrequencyOctaves", "voiceEnhancerQ", "voiceEnhancerAmount",
    ]);
});

test("legacy target aliases are absent and all 1484 canonical pairs are legal", async () => {
    const targets = await targetsModulePromise;
    const legacyAliases = [
        "wavetablePosition",
        "warpAmount",
        "pitchSemitones",
        "ampGainDb",
        "pan",
        "unisonDetune",
        "unisonBlend",
        "unisonWidth",
        "unisonWavetablePositionSpread",
        "unisonWarpSpread",
    ];

    for (const alias of legacyAliases) {
        assert.equal(targets.parseModulationTargetKind(alias), null, `${alias} remained as an alias`);
    }

    const pairs = targets.MODULATION_SOURCE_IDENTITIES.flatMap((source) => (
        targets.MODULATION_TARGET_IDENTITIES.map((target) => [source.id, target.kind])
    ));
    assert.equal(pairs.length, 1484);
    assert.equal(pairs.every(([sourceId, targetKind]) => targets.isLegalModulationPair(sourceId, targetKind)), true);
});

test("identity records carry indexes while target descriptors retain presentation policy", async () => {
    const [targets, modulation, descriptors] = await Promise.all([
        targetsModulePromise,
        modulationModulePromise,
        descriptorModulePromise,
    ]);

    for (const identity of targets.MODULATION_SOURCE_IDENTITIES) {
        assert.deepEqual(
            Object.keys(identity).sort(),
            ["group", "id", "runtimeIndex", "sourceKind", "sourceSlot"],
        );
    }
    for (const identity of targets.MODULATION_TARGET_IDENTITIES) {
        assert.deepEqual(Object.keys(identity).sort(), ["group", "kind", "runtimeIndex"]);
    }
    assert.equal(modulation.MODULATION_TARGET_OPTIONS.length, 106);
    assert.equal(modulation.MODULATION_TARGET_OPTIONS.every((option) => option.label.length > 0), true);

    const wavetableDescriptor = descriptors.allTargetDescriptors()
        .find((descriptor) => descriptor.modulationTargetKind === "oscA.wavetablePosition");
    assert.notEqual(wavetableDescriptor, undefined);
    assert.equal(wavetableDescriptor.label, "Index");
    assert.equal(wavetableDescriptor.format.kind, "percent");
    assert.equal(wavetableDescriptor.modAmount.unit, "%");
    assert.equal(descriptors.getModulationTargetDisplayLabel("oscB.wavetablePosition"), "B INDEX");

    const modulationDescriptors = descriptors.allTargetDescriptors().filter(
        (descriptor) => descriptor.modulationTargetKind !== null,
    );
    const descriptorByKind = new Map(modulationDescriptors.map((descriptor) => (
        [descriptor.modulationTargetKind, descriptor]
    )));
    assert.equal(modulationDescriptors.length, 106);
    assert.equal(descriptorByKind.size, 106);
    for (const identity of targets.MODULATION_TARGET_IDENTITIES) {
        const descriptor = descriptorByKind.get(identity.kind);
        assert.notEqual(descriptor, undefined, identity.kind);
        assert.equal(descriptor.modulationTargetKind, identity.kind);
    }

    const generatorKinds = [
        ...targets.VOICE_MODULATION_TARGET_KINDS.slice(32, 50),
        ...targets.VOICE_MODULATION_TARGET_KINDS.slice(52, 56),
    ];
    assert.equal(generatorKinds.length, 22);
    for (const targetKind of generatorKinds) {
        const descriptor = descriptorByKind.get(targetKind);
        assert.equal(descriptor.binding._tag, "endpoint", targetKind);
        assert.equal(descriptor.binding.endpointId, targetKind, targetKind);
        assert.equal(descriptor.workspace, "voice", targetKind);
        assert.notEqual(descriptor.modulationTargetKind, null, targetKind);
    }

    const globalTuneDescriptor = descriptorByKind.get("globalTuneSemitones");
    assert.notEqual(globalTuneDescriptor, undefined);
    assert.equal(globalTuneDescriptor.targetId, "voice.globalTune");
    assert.equal(globalTuneDescriptor.moduleId, "voice");
    assert.equal(globalTuneDescriptor.binding._tag, "endpoint");
    assert.equal(globalTuneDescriptor.binding.endpointId, "globalTune");
    assert.equal(globalTuneDescriptor.binding.toEngine(globalTuneDescriptor.initialValue), 0);

    assert.deepEqual(
        [
            ["voiceEnhancerFrequencyOctaves", "voice-enhancer.frequency", "voiceEnhancerFrequency"],
            ["voiceEnhancerQ", "voice-enhancer.q", "voiceEnhancerQ"],
            ["voiceEnhancerAmount", "voice-enhancer.amount", "voiceEnhancerAmount"],
        ].map(([kind, targetId, endpointId]) => {
            const descriptor = descriptorByKind.get(kind);
            return [
                descriptor?.targetId,
                descriptor?.moduleId,
                descriptor?.binding._tag === "endpoint" ? descriptor.binding.endpointId : null,
                targetId,
                endpointId,
            ];
        }),
        [
            ["voice-enhancer.frequency", "voice-enhancer", "voiceEnhancerFrequency", "voice-enhancer.frequency", "voiceEnhancerFrequency"],
            ["voice-enhancer.q", "voice-enhancer", "voiceEnhancerQ", "voice-enhancer.q", "voiceEnhancerQ"],
            ["voice-enhancer.amount", "voice-enhancer", "voiceEnhancerAmount", "voice-enhancer.amount", "voiceEnhancerAmount"],
        ],
    );

    assert.deepEqual(
        ["A", "B", "C"].map((oscillator) => {
            const descriptor = descriptorByKind.get(`osc${oscillator}.wavetablePosition`);
            return [descriptor.targetId, descriptor.moduleId, descriptor.binding];
        }),
        [
            ["oscA.framePosition", "oscA", { _tag: "unbacked", reason: "no-endpoint" }],
            ["oscB.framePosition", "oscB", { _tag: "unbacked", reason: "no-endpoint" }],
            ["oscC.framePosition", "oscC", { _tag: "unbacked", reason: "no-endpoint" }],
        ],
    );
});

test("the sparse runtime consumes the same canonical voice indexes", async () => {
    const [modulation, runtime] = await Promise.all([modulationModulePromise, runtimeModulePromise]);
    const route = (targetKind) => modulation.createDefaultRoute({ id: targetKind, targetKind });

    assert.equal(runtime.MODULATION_VOICE_TARGET_COUNT, 59);
    assert.equal(runtime.MODULATION_RACK_TARGET_COUNT, 47);
    assert.deepEqual(runtime.getModulationRuntimeCell(route("oscA.wavetablePosition")), {
        path: "voice", cellIndex: 0, sourceIndex: 0, targetIndex: 0, articulationCellIndex: 0,
    });
    assert.equal(runtime.getModulationRuntimeCell(route("oscB.wavetablePosition")).targetIndex, 10);
    assert.equal(runtime.getModulationRuntimeCell(route("oscC.wavetablePosition")).targetIndex, 20);
    assert.equal(runtime.getModulationRuntimeCell(route("filterQ")).targetIndex, 31);
    assert.equal(runtime.getModulationRuntimeCell(route("mseg1Morph")).targetIndex, 32);
    assert.equal(runtime.getModulationRuntimeCell(route("env3Release")).targetIndex, 49);
    assert.equal(runtime.getModulationRuntimeCell(route("filterMix")).targetIndex, 50);
    assert.equal(runtime.getModulationRuntimeCell(route("globalTuneSemitones")).targetIndex, 51);
    assert.equal(runtime.getModulationRuntimeCell(route("ampAttack")).targetIndex, 52);
    assert.equal(runtime.getModulationRuntimeCell(route("ampRelease")).targetIndex, 55);
    assert.equal(runtime.getModulationRuntimeCell(route("voiceEnhancerFrequencyOctaves")).targetIndex, 56);
    assert.equal(runtime.getModulationRuntimeCell(route("voiceEnhancerQ")).targetIndex, 57);
    assert.equal(runtime.getModulationRuntimeCell(route("voiceEnhancerAmount")).targetIndex, 58);
});
