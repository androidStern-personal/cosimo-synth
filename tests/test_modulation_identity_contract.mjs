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

    assert.equal(targets.MODULATION_SOURCE_COUNT, 13);
    assert.equal(targets.MODULATION_VOICE_TARGET_COUNT, 51);
    assert.equal(targets.MODULATION_RACK_TARGET_COUNT, 36);
    assert.equal(targets.MODULATION_LEGAL_PAIR_COUNT, 1131);

    for (const [group, count] of [["voice", 9], ["macro", 4]]) {
        const identities = targets.MODULATION_SOURCE_IDENTITIES.filter((identity) => identity.group === group);
        assert.equal(identities.length, count);
        assert.deepEqual(identities.map((identity) => identity.runtimeIndex).sort((a, b) => a - b),
            Array.from({ length: count }, (_, index) => index));
    }

    for (const [group, count] of [["voice", 51], ["rack", 36]]) {
        const identities = targets.MODULATION_TARGET_IDENTITIES.filter((identity) => identity.group === group);
        assert.equal(identities.length, count);
        assert.deepEqual(identities.map((identity) => identity.runtimeIndex).sort((a, b) => a - b),
            Array.from({ length: count }, (_, index) => index));
    }

    assert.equal(new Set(targets.MODULATION_SOURCE_IDENTITIES.map((identity) => identity.id)).size, 13);
    assert.equal(new Set(targets.MODULATION_TARGET_IDENTITIES.map((identity) => identity.kind)).size, 87);
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
});

test("legacy target aliases are absent and all 1131 canonical pairs are legal", async () => {
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
    assert.equal(pairs.length, 1131);
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
    assert.equal(modulation.MODULATION_TARGET_OPTIONS.length, 87);
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
    assert.equal(modulationDescriptors.length, 87);
    assert.equal(descriptorByKind.size, 87);
    for (const identity of targets.MODULATION_TARGET_IDENTITIES) {
        const descriptor = descriptorByKind.get(identity.kind);
        assert.notEqual(descriptor, undefined, identity.kind);
        assert.equal(descriptor.modulationTargetKind, identity.kind);
    }

    const generatorKinds = targets.VOICE_MODULATION_TARGET_KINDS.slice(32, 50);
    assert.equal(generatorKinds.length, 18);
    for (const targetKind of generatorKinds) {
        const descriptor = descriptorByKind.get(targetKind);
        assert.equal(descriptor.binding._tag, "endpoint", targetKind);
        assert.equal(descriptor.binding.endpointId, targetKind, targetKind);
        assert.equal(descriptor.workspace, "voice", targetKind);
        assert.notEqual(descriptor.modulationTargetKind, null, targetKind);
    }

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

    assert.equal(runtime.MODULATION_VOICE_TARGET_COUNT, 51);
    assert.equal(runtime.MODULATION_RACK_TARGET_COUNT, 36);
    assert.deepEqual(runtime.getModulationRuntimeCell(route("oscA.wavetablePosition")), {
        path: "voice", cellIndex: 0, sourceIndex: 0, targetIndex: 0, articulationCellIndex: 0,
    });
    assert.equal(runtime.getModulationRuntimeCell(route("oscB.wavetablePosition")).targetIndex, 10);
    assert.equal(runtime.getModulationRuntimeCell(route("oscC.wavetablePosition")).targetIndex, 20);
    assert.equal(runtime.getModulationRuntimeCell(route("filterQ")).targetIndex, 31);
    assert.equal(runtime.getModulationRuntimeCell(route("mseg1Morph")).targetIndex, 32);
    assert.equal(runtime.getModulationRuntimeCell(route("env3Release")).targetIndex, 49);
    assert.equal(runtime.getModulationRuntimeCell(route("filterMix")).targetIndex, 50);
});
