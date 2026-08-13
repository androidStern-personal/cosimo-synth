import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const bindingModulePromise = loadUIModule(repoRoot, "ui/shared/oscillator-binding.ts");
const articulationModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-image.ts");
const patchValuesModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-runtime-base.ts");
const targetDescriptorModulePromise = loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");

const expectedEndpointSuffixes = new Map([
    ["wavetableSelect", "WavetableSelect"],
    ["framePosition", "WavetablePosition"],
    ["pan", "Pan"],
    ["octave", "Octave"],
    ["semitone", "Semitone"],
    ["fineCents", "FineCents"],
    ["phase", "Phase"],
    ["phaseRandom", "PhaseRandom"],
    ["retrigger", "Retrigger"],
    ["volumeDb", "VolumeDb"],
    ["mute", "Mute"],
    ["solo", "Solo"],
    ["warpMode", "WarpMode"],
    ["warpAmount", "WarpAmount"],
    ["unisonVoices", "UnisonVoices"],
    ["unisonDetune", "UnisonDetune"],
    ["unisonBlend", "UnisonBlend"],
    ["unisonWidth", "UnisonWidth"],
    ["unisonDetuneMode", "UnisonDetuneMode"],
    ["unisonStackMode", "UnisonStackMode"],
    ["unisonWavetablePositionSpread", "UnisonPositionSpread"],
    ["unisonWarpSpread", "UnisonWarpSpread"],
]);

test("A/B/C contracts preserve runtime, table, control, MOD v4, and ART v4 identity", async () => {
    const [binding, articulations, descriptors] = await Promise.all([
        bindingModulePromise,
        articulationModulePromise,
        targetDescriptorModulePromise,
    ]);
    const descriptorByID = new Map(
        descriptors.allTargetDescriptors().map((descriptor) => [descriptor.targetId, descriptor]),
    );

    assert.deepEqual(
        binding.OSCILLATOR_BINDING_CONTRACTS.map((contract) => [contract.id, contract.oscillatorIndex]),
        [["A", 0], ["B", 1], ["C", 2]],
    );

    const allEndpoints = [];
    for (const contract of binding.OSCILLATOR_BINDING_CONTRACTS) {
        assert.deepEqual(contract.tableStatus, {
            endpointID: "runtimeState",
            oscillatorIndex: contract.oscillatorIndex,
        });
        assert.equal(contract.controls.length, expectedEndpointSuffixes.size);

        for (const control of contract.controls) {
            assert.equal(
                control.endpointID,
                `osc${contract.id}${expectedEndpointSuffixes.get(control.controlID)}`,
            );
            assert.equal(control.oscillatorIndex, contract.oscillatorIndex);
            assert.equal(
                control.articulationParameterID,
                control.controlID === "wavetableSelect" ? null : `osc${contract.id}.${control.controlID}`,
            );
            allEndpoints.push(control.endpointID);
        }

        assert.deepEqual(
            contract.articulationParameterIDs,
            articulations.OSCILLATOR_ARTICULATION_PARAMETER_IDS.map(
                (parameterID) => `osc${contract.id}.${parameterID}`,
            ),
        );
        assert.deepEqual(
            contract.modulationTargets.map((target) => target.runtimeTargetIndex),
            Array.from({ length: 10 }, (_, localIndex) => (contract.oscillatorIndex * 10) + localIndex),
        );

        for (const target of contract.modulationTargets) {
            assert.equal(target.targetKind, `osc${contract.id}.${target.parameterKind}`);
            assert.equal(target.oscillatorIndex, contract.oscillatorIndex);
            assert.equal(descriptorByID.get(target.uiTargetID)?.modulationTargetKind, target.targetKind);
        }
    }

    assert.equal(new Set(allEndpoints).size, allEndpoints.length);
});

test("the public write projection addresses only the selected oscillator", async () => {
    const binding = await bindingModulePromise;

    for (const selected of ["A", "B", "C"]) {
        const siblingEndpoints = binding.OSCILLATOR_BINDING_CONTRACTS
            .filter((contract) => contract.id !== selected)
            .flatMap((contract) => contract.controls.map((control) => control.endpointID));

        for (const [controlID, endpointSuffix] of expectedEndpointSuffixes) {
            const values = new Map(
                binding.OSCILLATOR_BINDING_CONTRACTS.flatMap((contract) => (
                    contract.controls.map((control) => [control.endpointID, 0])
                )),
            );
            const write = binding.projectSelectedOscillatorWrite(selected, controlID, 0.75);
            values.set(write.endpointID, write.value);

            assert.deepEqual(write, {
                oscillatorID: selected,
                oscillatorIndex: ["A", "B", "C"].indexOf(selected),
                controlID,
                endpointID: `osc${selected}${endpointSuffix}`,
                value: 0.75,
            });
            assert.ok(siblingEndpoints.every((endpointID) => values.get(endpointID) === 0));
            assert.equal([...values.values()].filter((value) => value !== 0).length, 1);
        }
    }
});

test("the shared contract accepts no oscillator or control aliases", async () => {
    const binding = await bindingModulePromise;

    assert.throws(() => binding.getOscillatorBindingContract("a"));
    assert.throws(() => binding.getOscillatorBindingContract("oscA"));
    assert.throws(() => binding.getOscillatorControlAddress("A", "wavetablePosition"));
});

test("oscillator selection stays outside uiPatchValues.v2", async () => {
    const [binding, patchValues] = await Promise.all([
        bindingModulePromise,
        patchValuesModulePromise,
    ]);

    assert.equal(binding.DEFAULT_SELECTED_OSCILLATOR_ID, "A");
    assert.equal(Object.hasOwn(patchValues.createDefaultUiPatchValues(), "selectedOscillatorID"), false);
    assert.throws(() => patchValues.deserializeUiPatchValues({
        ...patchValues.createDefaultUiPatchValues(),
        selectedOscillatorID: 1,
    }));
});
