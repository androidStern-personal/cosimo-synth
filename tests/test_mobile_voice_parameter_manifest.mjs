import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestModulePromise = loadUIModule(repoRoot, "ui/shared/mobile-voice-parameter-manifest.ts");
const bindingModulePromise = loadUIModule(repoRoot, "ui/shared/oscillator-binding.ts");

test("manifest covers exactly the 22-control oscillator contract", async () => {
    const { MOBILE_VOICE_PARAMETER_MANIFEST } = await manifestModulePromise;
    const { OSCILLATOR_BINDING_CONTRACTS } = await bindingModulePromise;

    const contractIDs = OSCILLATOR_BINDING_CONTRACTS[0].controls.map((control) => control.controlID);
    const manifestIDs = MOBILE_VOICE_PARAMETER_MANIFEST.map((spec) => spec.controlID);

    assert.equal(contractIDs.length, 22);
    assert.equal(manifestIDs.length, 22);
    assert.equal(new Set(manifestIDs).size, 22, "each control appears exactly once");
    assert.deepEqual([...manifestIDs].sort(), [...contractIDs].sort());
});

test("the five toolbar pages hold the accepted cells in order", async () => {
    const { MOBILE_VOICE_PAGES, getMobileVoiceControlSpec } = await manifestModulePromise;

    assert.deepEqual(
        MOBILE_VOICE_PAGES.map((page) => page.name),
        ["Shape", "Tune", "Unison", "Phase", "Modes"],
    );
    assert.deepEqual(MOBILE_VOICE_PAGES.map((page) => page.cells.length), [4, 4, 4, 3, 2]);
    assert.deepEqual(
        [...MOBILE_VOICE_PAGES[0].cells],
        ["framePosition", "warpAmount", "volumeDb", "unisonDetune"],
    );
    assert.deepEqual([...MOBILE_VOICE_PAGES[1].cells], ["octave", "semitone", "fineCents", "pan"]);

    for (const page of MOBILE_VOICE_PAGES) {
        for (const controlID of page.cells) {
            const spec = getMobileVoiceControlSpec(controlID);
            assert.ok(spec.placements.includes("page"), `${controlID} declares page placement`);
            assert.ok(
                spec.interaction === "readout" || spec.interaction === "choice",
                `${controlID} is a toolbar cell kind`,
            );
        }
    }

    const pageCells = MOBILE_VOICE_PAGES.flatMap((page) => [...page.cells]);
    assert.equal(new Set(pageCells).size, pageCells.length, "no control sits on two pages");
});

test("intentional aliases and direct placements match the accepted layout", async () => {
    const { getMobileVoiceControlSpec } = await manifestModulePromise;

    assert.deepEqual(
        [...getMobileVoiceControlSpec("framePosition").placements],
        ["graph-axis-vertical", "page"],
        "Index is the graph Y axis plus a Shape alias",
    );
    assert.deepEqual(
        [...getMobileVoiceControlSpec("warpAmount").placements],
        ["graph-axis-horizontal", "page"],
        "Warp is the provisional graph X axis plus a Shape alias",
    );
    assert.deepEqual(
        [...getMobileVoiceControlSpec("semitone").placements],
        ["graph-overlay-bottom-right", "page"],
        "Semitone is the bottom-right graph overlay plus a Tune alias",
    );
    assert.deepEqual(
        [...getMobileVoiceControlSpec("unisonVoices").placements],
        ["graph-overlay-bottom-left"],
        "Voices is the bottom-left graph overlay",
    );
    assert.deepEqual([...getMobileVoiceControlSpec("solo").placements], ["tab-badge"]);
    assert.deepEqual([...getMobileVoiceControlSpec("mute").placements], ["tab-active-second-tap"]);
    assert.deepEqual([...getMobileVoiceControlSpec("wavetableSelect").placements], ["graph-overlay-top-left"]);
    assert.deepEqual([...getMobileVoiceControlSpec("warpMode").placements], ["graph-overlay-top-right"]);
});

test("MOD target references match the binding contract, with the aggregate Tune trio", async () => {
    const { MOBILE_VOICE_PARAMETER_MANIFEST } = await manifestModulePromise;
    const { OSCILLATOR_BINDING_CONTRACTS } = await bindingModulePromise;

    const contractKinds = new Set(
        OSCILLATOR_BINDING_CONTRACTS[0].modulationTargets.map((target) => target.parameterKind),
    );
    const tuneControls = [];
    const modulatable = [];
    for (const spec of MOBILE_VOICE_PARAMETER_MANIFEST) {
        if (spec.modulationParameterKind === null) {
            continue;
        }
        assert.ok(
            contractKinds.has(spec.modulationParameterKind),
            `${spec.controlID} references a real MOD parameter kind`,
        );
        modulatable.push(spec.controlID);
        if (spec.modulationParameterKind === "pitchSemitones") {
            tuneControls.push(spec.controlID);
        }
    }

    assert.deepEqual(tuneControls.sort(), ["fineCents", "octave", "semitone"]);
    assert.deepEqual(
        modulatable.sort(),
        [
            "fineCents", "framePosition", "octave", "pan", "semitone", "unisonBlend",
            "unisonDetune", "unisonWarpSpread", "unisonWavetablePositionSpread",
            "unisonWidth", "volumeDb", "warpAmount",
        ],
        "exactly the ten MOD destinations, with Tune shared by three cells",
    );
});

test("detents and non-modulatable controls are explicit", async () => {
    const { getMobileVoiceControlSpec } = await manifestModulePromise;

    for (const controlID of ["octave", "semitone", "unisonVoices"]) {
        assert.equal(getMobileVoiceControlSpec(controlID).detented, true, `${controlID} is detented`);
    }
    for (const controlID of ["phase", "phaseRandom", "unisonVoices"]) {
        assert.equal(
            getMobileVoiceControlSpec(controlID).modulationParameterKind,
            null,
            `${controlID} has no MOD destination`,
        );
    }
});
