// The canonical scenario set for offline-engine benchmarking and bit-identity
// A/B renders. Each scenario is a fully deterministic install spec plus a
// frame-indexed score (see offline-engine-driver.mjs).
//
// The set is chosen to cover every state transition the engine's costs hinge
// on: complete idleness, dense polyphony with full unison, the shared patch
// from the 2026-08 iPhone dropout report, a stress patch at the product's
// intended ceiling (3 oscillators x 8 unison, a 10-device lane with a split
// group, 12 modulation routes), and a transition gauntlet that reinstalls
// modulation programs and lane topologies mid-render, toggles mutes, and
// drains to silence before retriggering.

import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "../helpers/load_ui_module.mjs";
import { DRIVER_SAMPLE_RATE, packMidi } from "./offline-engine-driver.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const sharedPatchFixturePath = path.join(
    repoRoot, "tests", "fixtures", "perf", "dropout-share-patch.json",
);

const seconds = (value) => Math.round(value * DRIVER_SAMPLE_RATE);

const CHORD_NOTES = [48, 52, 55, 59, 62, 65, 69, 72];

function chordScore({ onFrame, offFrame, staggerFrames = 32 }) {
    return [
        ...CHORD_NOTES.map((note, index) => ({
            atFrame: onFrame + (index * staggerFrames),
            midi: [0x90, note, 100],
        })),
        ...CHORD_NOTES.map((note, index) => ({
            atFrame: offFrame + (index * staggerFrames),
            midi: [0x80, note, 0],
        })),
    ];
}

async function sharedPatchEnvelope() {
    return JSON.parse(await fs.readFile(sharedPatchFixturePath, "utf8"));
}

function sharedPatchModulationRoutes(envelope) {
    const stored = envelope.preset.storedState["modulation.v6"];
    return JSON.parse(stored).routes;
}

function sharedPatchLaneDocument(envelope) {
    return JSON.parse(envelope.supplementalStoredState["lane.v1"]);
}

async function buildStressSpec() {
    const [laneV1, laneV2, targets] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/lane-state.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-targets.ts"),
    ]);

    // All eight base devices with their product defaults, then two pool
    // clones, arranged as five trunk devices plus a three-band split whose
    // bands carry the rest: ten devices and a split group in one chain.
    const base = laneV2.upgradeLaneStateV1(laneV1.createDefaultLaneState());
    const devices = { ...base.devices };
    devices["distortion#2"] = { params: { ...devices["distortion#1"].params } };
    devices["chorus#2"] = { params: { ...devices["chorus#1"].params } };
    const device = (deviceId) => ({ kind: "device", deviceId, enabled: true });
    const laneDocument = {
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices,
        chain: [
            device("globalFilter#1"),
            device("distortion#1"),
            device("chorus#1"),
            device("flanger#1"),
            device("phaser#1"),
            {
                kind: "split",
                groupId: "split#1",
                enabled: true,
                xoverLowHz: 320,
                xoverHighHz: 2800,
                xoverLowKeyTrackEnabled: false,
                xoverLowKeyTrackOffsetSemitones: 0,
                xoverHighKeyTrackEnabled: false,
                xoverHighKeyTrackOffsetSemitones: 0,
                branches: [
                    [device("distortion#2"), device("ott#1")],
                    [device("delay#1")],
                    [device("reverb#1"), device("chorus#2")],
                ],
            },
        ],
    };

    const rackKind = (endpointFragment) => {
        const identity = targets.RACK_MODULATION_TARGET_IDENTITIES
            .find((candidate) => candidate.kind.includes(endpointFragment));
        if (!identity) {
            throw new Error(`No rack modulation target contains "${endpointFragment}"`);
        }
        return identity.kind;
    };

    const route = (id, sourceKind, sourceSlot, targetKind, amount, polarity = "unipolar") => ({
        id, enabled: true, sourceKind, sourceSlot, polarity, targetKind, amount, reducer: "max",
    });
    const modulationRoutes = [
        route("stress-1", "env", 1, "filterCutoffOctaves", 2.5),
        route("stress-2", "env", 2, "oscA.warpAmount", 0.5),
        route("stress-3", "env", 3, "oscB.wavetablePosition", 0.6),
        route("stress-4", "mseg", 1, "oscC.warpAmount", 0.4),
        route("stress-5", "mseg", 2, "filterQ", 3.0),
        route("stress-6", "mseg", 3, "oscA.pan", 0.8, "bipolar"),
        route("stress-7", "velocity", null, "oscB.ampGainDb", 6.0),
        route("stress-8", "slide", null, "oscC.unisonDetune", 0.3),
        route("stress-9", "macro", 1, rackKind("distortionDriveDb"), 12.0),
        route("stress-10", "macro", 2, rackKind("ottAmount"), 30.0),
        route("stress-11", "macro", 3, rackKind("chorusFeedback"), 0.3),
        route("stress-12", "macro", 4, "globalTuneSemitones", 2.0, "bipolar"),
    ];

    const parameters = {
        playMode: 0,
        oscAMute: 0, oscBMute: 0, oscCMute: 0,
        oscAUnisonVoices: 8, oscBUnisonVoices: 8, oscCUnisonVoices: 8,
        oscAUnisonDetune: 0.3, oscBUnisonDetune: 0.35, oscCUnisonDetune: 0.25,
        oscAWarpMode: 1, oscAWarpAmount: 0.35,
        oscBWarpMode: 2, oscBWarpAmount: 0.3,
        oscCWarpMode: 3, oscCWarpAmount: 0.25,
        oscBOctave: 1, oscCOctave: -1,
        filterMode: 1, filterCutoff: 900, filterQ: 2.5,
        voiceEnhancerAmount: 0.3,
        ampRelease: 0.6,
    };

    // Macros sweep stepwise (deterministic block-edge updates) while the
    // chord holds, exercising the macro -> rack fanout path continuously.
    const macroSweep = [];
    for (let step = 0; step <= 32; step += 1) {
        const value = step / 32;
        for (let macro = 1; macro <= 4; macro += 1) {
            macroSweep.push({
                atFrame: seconds(0.5) + (step * 1_024),
                parameter: `macro${macro}`,
                value: macro % 2 === 0 ? 1 - value : value,
            });
        }
    }

    return {
        spec: { parameters, modulationRoutes, laneDocument },
        score: [
            ...chordScore({ onFrame: 0, offFrame: seconds(2.5) }),
            ...macroSweep,
        ],
        totalFrames: seconds(4.5),
    };
}

async function buildTransitionArtifacts(envelope) {
    const [modulation, program] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/modulation.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts"),
    ]);
    const reducedRoutes = sharedPatchModulationRoutes(envelope)
        .slice(0, 2)
        .map((routeInput, index) => modulation.normalizeRoute(routeInput, index));
    const [reinstall] = program.buildModulationRuntimeProgramEvents(null, reducedRoutes);
    return { reinstallProgramValue: reinstall.value };
}

/** @returns scenario list: { name, spec, score, totalFrames, expectSound } */
export async function buildRenderScenarios() {
    const envelope = await sharedPatchEnvelope();
    const stress = await buildStressSpec();
    const { reinstallProgramValue } = await buildTransitionArtifacts(envelope);
    const sharedSpec = {
        parameters: envelope.preset.parameters,
        modulationRoutes: sharedPatchModulationRoutes(envelope),
        laneDocument: sharedPatchLaneDocument(envelope),
    };

    return [
        {
            name: "init-idle",
            spec: {},
            score: [],
            totalFrames: seconds(3),
            expectSound: false,
        },
        {
            name: "init-poly8",
            spec: {},
            score: chordScore({ onFrame: 0, offFrame: seconds(2) }),
            totalFrames: seconds(3.5),
            expectSound: true,
        },
        {
            name: "shared-patch",
            spec: sharedSpec,
            score: [
                { atFrame: 0, midi: [0x90, 48, 100] },
                { atFrame: seconds(0.5), midi: [0x90, 55, 96] },
                { atFrame: seconds(0.55), midi: [0x80, 48, 0] },
                { atFrame: seconds(1.8), midi: [0x80, 55, 0] },
            ],
            totalFrames: seconds(3.5),
            expectSound: true,
        },
        {
            name: "stress-3x8-lane10-routes12",
            ...stress,
            expectSound: true,
        },
        {
            name: "transitions",
            spec: sharedSpec,
            score: [
                { atFrame: 0, midi: [0x90, 48, 100] },
                {
                    atFrame: seconds(0.5),
                    event: "modulationProgram",
                    value: { ...reinstallProgramValue, dspSessionId: 7, deliverySerial: 2 },
                },
                { atFrame: seconds(0.7), parameter: "oscBMute", value: 1 },
                { atFrame: seconds(0.9), parameter: "oscBMute", value: 0 },
                { atFrame: seconds(1.0), midi: [0x80, 48, 0] },
                // 1.0s..2.6s decays through the amp release, the 180 ms rack
                // modulation gate release, and the renderer's FIR history.
                { atFrame: seconds(2.6), midi: [0x90, 60, 110] },
                { atFrame: seconds(3.0), midi: [0x80, 60, 0] },
                {
                    atFrame: seconds(3.2),
                    event: "laneTopology",
                    value: { chainLength: 0, slotIds: new Array(16).fill(0), enabledMask: 0 },
                },
            ],
            totalFrames: seconds(4.5),
            expectSound: true,
        },
    ];
}
