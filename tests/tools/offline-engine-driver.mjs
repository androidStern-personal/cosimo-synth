// Deterministic driver for the generated offline Cosimo performer
// (cmaj_Cosimo_Synth.offline.js). One place owns engine setup — synthetic
// wavetables, parameters, a modulation.v6 route program, and a lane.v2
// document — plus frame-indexed note/parameter scores, so a benchmark and a
// bit-identity A/B comparison render EXACTLY the same event sequence.
//
// Everything is installed through the same product adapters the real UI uses
// (modulation-runtime-program.ts, lane-state-v2.ts), so a scenario here is a
// faithful replay of what the app sends, not a parallel test dialect.
//
// Determinism: a fixed sessionID and sample rate make the generated performer
// fully deterministic (engine randomness is seeded from processor.session),
// so two renders of one scenario are byte-identical unless the DSP changed.

import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadUIModule } from "../helpers/load_ui_module.mjs";

export const DRIVER_SESSION_ID = 7;
export const DRIVER_SAMPLE_RATE = 48_000;
export const DRIVER_BLOCK_FRAMES = 128;

const WAVETABLE_MIP_LEVEL_COUNT = 11;

export function packMidi(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function endpointMethod(performer, prefix, endpointID) {
    const method = performer[`${prefix}_${endpointID}`];
    if (typeof method !== "function") {
        throw new Error(`Offline performer is missing ${prefix}_${endpointID}()`);
    }
    return method.bind(performer);
}

// Same deterministic band-limited-ish shape the Bounce offline tests install.
function syntheticMipSamples(mipIndex) {
    const samplesPerFrame = 2_048;
    const samples = new Float32Array(samplesPerFrame * 3);
    const cycleLength = Math.min(2_048, Math.max(256, (1 << mipIndex) * 32));
    for (let index = 0; index < samplesPerFrame; index += 1) {
        const phase = (index % cycleLength) / cycleLength;
        samples[index] = (Math.sin(2 * Math.PI * phase)
            + (0.18 * Math.sin(4 * Math.PI * phase))) / 1.18;
    }
    return samples;
}

function advanceDiscard(performer, frameCount) {
    let remaining = frameCount;
    while (remaining > 0) {
        const count = Math.min(DRIVER_BLOCK_FRAMES, remaining);
        performer.advance(count);
        remaining -= count;
    }
}

export async function loadOfflineEngineClass(enginePath) {
    // A cache-busting query keeps two loads of the same path (or a rebuilt
    // file at one path) from aliasing in the ESM module cache.
    const url = `${pathToFileURL(path.resolve(enginePath)).href}?driver=${Date.now()}-${Math.random()}`;
    const module = await import(url);
    const EngineClass = module.default ?? module.WavetableSynth;
    if (typeof EngineClass !== "function") {
        throw new Error(`${enginePath} does not export the offline performer class.`);
    }
    return EngineClass;
}

async function uiModules() {
    const repoRoot = path.resolve(import.meta.dirname, "..", "..");
    const [modulation, program, laneV1, laneV2] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/modulation.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    ]);
    return { modulation, program, laneV1, laneV2 };
}

function installWavetables(performer) {
    const loadBegin = endpointMethod(performer, "sendInputEvent", "wavetableLoadBegin");
    const mipFrame = endpointMethod(performer, "sendInputEvent", "wavetableMipFrame");

    for (let oscillatorIndex = 0; oscillatorIndex < 3; oscillatorIndex += 1) {
        loadBegin({
            dspSessionId: DRIVER_SESSION_ID,
            oscillatorIndex,
            generation: 1,
            tableIndex: 0,
            frameCount: 1,
        });
        advanceDiscard(performer, DRIVER_BLOCK_FRAMES);
        for (let mipIndex = 0; mipIndex < WAVETABLE_MIP_LEVEL_COUNT; mipIndex += 1) {
            mipFrame({
                dspSessionId: DRIVER_SESSION_ID,
                oscillatorIndex,
                generation: 1,
                tableIndex: 0,
                mipIndex,
                frameIndexBase: 0,
                frameCount: 1,
                samples: syntheticMipSamples(mipIndex),
            });
            advanceDiscard(performer, DRIVER_BLOCK_FRAMES);
        }
        advanceDiscard(performer, DRIVER_BLOCK_FRAMES * 4);
    }
}

async function installModulation(performer, routes) {
    if (!routes || routes.length === 0) {
        return;
    }
    const { modulation, program } = await uiModules();
    const normalized = routes.map((route, index) => modulation.normalizeRoute(route, index));
    const events = program.buildModulationRuntimeProgramEvents(null, normalized);
    for (const event of events) {
        endpointMethod(performer, "sendInputEvent", event.endpointID)({
            ...event.value,
            dspSessionId: DRIVER_SESSION_ID,
            deliverySerial: 1,
        });
        advanceDiscard(performer, DRIVER_BLOCK_FRAMES);
    }
}

async function installLaneDocument(performer, laneDocument) {
    if (!laneDocument) {
        return;
    }
    const { laneV2 } = await uiModules();
    const outcome = laneV2.parseLaneStateV2Compat(laneDocument);
    if (outcome._tag !== "ok") {
        throw new Error(`Lane document rejected: ${outcome.message}`);
    }
    for (const event of laneV2.buildLaneRuntimeEventsV2(outcome.value)) {
        endpointMethod(performer, "sendInputEvent", event.endpointID)(event.value);
        advanceDiscard(performer, DRIVER_BLOCK_FRAMES);
    }
}

/**
 * Instantiates and fully installs one performer.
 *
 * @param {object} spec
 * @param {Function} spec.EngineClass  Generated offline performer class.
 * @param {Record<string, number>} [spec.parameters]  endpointID -> value. The
 *   three wavetable selectors are forced to table 0, where the synthetic
 *   deterministic table is installed.
 * @param {Array<object>} [spec.modulationRoutes]  modulation.v6 route objects.
 * @param {object|string} [spec.laneDocument]  lane v1/v2 document (object or JSON).
 */
export async function createInstalledPerformer(spec) {
    const performer = new spec.EngineClass();
    await performer.initialise(DRIVER_SESSION_ID, DRIVER_SAMPLE_RATE);

    const parameters = {
        ...spec.parameters,
        oscAWavetableSelect: 0,
        oscBWavetableSelect: 0,
        oscCWavetableSelect: 0,
    };
    for (const [endpointID, value] of Object.entries(parameters)) {
        endpointMethod(performer, "setInputValue", endpointID)(value, 0);
    }
    endpointMethod(performer, "sendInputEvent", "tempo")({ bpm: 120 });
    advanceDiscard(performer, DRIVER_BLOCK_FRAMES);

    installWavetables(performer);
    await installModulation(performer, spec.modulationRoutes);
    await installLaneDocument(
        performer,
        typeof spec.laneDocument === "string" ? JSON.parse(spec.laneDocument) : spec.laneDocument,
    );
    advanceDiscard(performer, DRIVER_BLOCK_FRAMES * 16);
    return performer;
}

/**
 * Renders a frame-indexed score. Score entries run when the render reaches
 * their frame (block-quantized send order is stable and deterministic):
 *   { atFrame, midi: [status, note, velocity] }
 *   { atFrame, parameter: endpointID, value }
 *   { atFrame, event: endpointID, value }  (value may be a factory function)
 *
 * @returns {{ samples: Float32Array, elapsedMilliseconds: number }} stereo
 *   interleaved output plus the wall-clock DSP time (excludes setup).
 */
export function renderScore(performer, score, totalFrames) {
    const ordered = [...score].sort((left, right) => left.atFrame - right.atFrame);
    const samples = new Float32Array(totalFrames * 2);
    const left = new Float32Array(DRIVER_BLOCK_FRAMES);
    const right = new Float32Array(DRIVER_BLOCK_FRAMES);
    const getOutput = performer.getOutputFrames_audioOut.bind(performer);
    let nextEntry = 0;
    let rendered = 0;
    const startedAt = performance.now();

    while (rendered < totalFrames) {
        while (nextEntry < ordered.length && ordered[nextEntry].atFrame <= rendered) {
            const entry = ordered[nextEntry];
            if (entry.midi) {
                endpointMethod(performer, "sendInputEvent", "midiIn")({
                    message: packMidi(...entry.midi),
                });
            } else if (entry.parameter) {
                endpointMethod(performer, "setInputValue", entry.parameter)(entry.value, 0);
            } else if (entry.event) {
                const value = typeof entry.value === "function" ? entry.value() : entry.value;
                endpointMethod(performer, "sendInputEvent", entry.event)(value);
            }
            nextEntry += 1;
        }

        const count = Math.min(DRIVER_BLOCK_FRAMES, totalFrames - rendered);
        performer.advance(count);
        getOutput([left, right], count, 0);
        for (let frame = 0; frame < count; frame += 1) {
            const target = (rendered + frame) * 2;
            samples[target] = left[frame];
            samples[target + 1] = right[frame];
        }
        rendered += count;
    }

    return { samples, elapsedMilliseconds: performance.now() - startedAt };
}

export function peakAbsolute(samples) {
    let peak = 0;
    for (let index = 0; index < samples.length; index += 1) {
        peak = Math.max(peak, Math.abs(samples[index]));
    }
    return peak;
}

export function firstSampleDifference(leftSamples, rightSamples) {
    if (leftSamples.length !== rightSamples.length) {
        return { index: -1, reason: `length ${leftSamples.length} vs ${rightSamples.length}` };
    }
    for (let index = 0; index < leftSamples.length; index += 1) {
        // Object.is: NaN equals NaN, +0 differs from -0 — a true bit check
        // for every value the engine can legally produce.
        if (!Object.is(leftSamples[index], rightSamples[index])) {
            return {
                index,
                frame: Math.floor(index / 2),
                channel: index % 2 === 0 ? "left" : "right",
                left: leftSamples[index],
                right: rightSamples[index],
            };
        }
    }
    return null;
}
