import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const bindingModulePromise = loadUIModule(repoRoot, "ui/shared/oscillator-binding.ts");
const articulationModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-image.ts");
const articulationStateModulePromise = loadUIModule(repoRoot, "ui/shared/articulations.ts");
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

test("the source contract permits only numeric oscillator control writes", async () => {
    const [bindingSource, hookSource] = await Promise.all([
        fs.readFile(path.join(repoRoot, "ui/shared/oscillator-binding.ts"), "utf8"),
        fs.readFile(path.join(repoRoot, "ui/shared/synth-hooks.ts"), "utf8"),
    ]);

    assert.match(bindingSource, /export type OscillatorControlWrite = \{[\s\S]*?readonly value: number;/);
    assert.match(bindingSource, /function projectSelectedOscillatorWrite\([\s\S]*?value: number,[\s\S]*?OscillatorControlWrite \{/);
    assert.match(hookSource, /const projectControlWrite = useCallback\(\([\s\S]*?value: number,[\s\S]*?OscillatorControlWrite =>/);
    assert.doesNotMatch(bindingSource, /OscillatorControlWrite<|projectSelectedOscillatorWrite</);
    assert.doesNotMatch(hookSource, /OscillatorControlWrite<|projectControlWrite = useCallback\(<TValue>/);
});

test("oscillator selection is session-local UI state", async () => {
    const binding = await bindingModulePromise;
    assert.equal(binding.DEFAULT_SELECTED_OSCILLATOR_ID, "A");
});

test("Init oscillator defaults agree across the UI contract, DSP declarations, and articulation fixtures", async () => {
    const [binding, articulations, descriptors, synthSource] = await Promise.all([
        bindingModulePromise,
        articulationStateModulePromise,
        targetDescriptorModulePromise,
        fs.readFile(path.join(repoRoot, "cmajor/WavetableSynth.cmajor"), "utf8"),
    ]);
    const endpointInit = (endpointID) => {
        const declaration = synthSource.match(new RegExp(
            `input value [^\\s]+ ${endpointID} \\[\\[[^\\]]*init:\\s*(-?[0-9]+(?:\\.[0-9]+)?)f?`,
        ));
        assert.ok(declaration, `Missing ${endpointID} init annotation`);
        return Number(declaration[1]);
    };

    assert.equal(binding.OSCILLATOR_DEFAULT_VOLUME_DB, 0);
    assert.equal(binding.OSCILLATOR_DEFAULT_VOLUME_NORMALIZED, 48 / 54);
    assert.deepEqual(binding.OSCILLATOR_DEFAULT_MUTE_BY_ID, { A: 0, B: 1, C: 1 });

    for (const oscillatorID of ["A", "B", "C"]) {
        assert.equal(endpointInit(`osc${oscillatorID}VolumeDb`), binding.OSCILLATOR_DEFAULT_VOLUME_DB);
        assert.equal(endpointInit(`osc${oscillatorID}Mute`), binding.getOscillatorDefaultMute(oscillatorID));
        const descriptor = descriptors.allTargetDescriptors().find(
            ({ targetId }) => targetId === `osc${oscillatorID}.volumeDb`,
        );
        assert.equal(descriptor?.initialValue, binding.OSCILLATOR_DEFAULT_VOLUME_NORMALIZED);
        assert.equal(descriptor?.defaultValue, binding.OSCILLATOR_DEFAULT_VOLUME_NORMALIZED);
    }

    assert.equal(
        articulations.createDefaultArticulationParameterSnapshot().volumeDb,
        binding.OSCILLATOR_DEFAULT_VOLUME_DB,
    );
    assert.deepEqual(
        articulations.createDisabledArticulationRuntimeUpload(0).volumeDbs,
        [0, 0, 0],
    );
});
