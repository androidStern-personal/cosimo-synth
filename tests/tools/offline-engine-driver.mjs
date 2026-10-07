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

import { loadUIModule } from "../../kit/tests/helpers/load_ui_module.mjs";

export const DRIVER_SESSION_ID = 7;
export const DRIVER_SAMPLE_RATE = 48_000;
export const DRIVER_BLOCK_FRAMES = 128;

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

// One deterministic cycle with a little second harmonic: the synthetic table
// the driver installs on every oscillator.
function syntheticWavetableFrame() {
    return Float32Array.from({ length: 2_048 }, (_, index) => {
        const phase = index / 2_048;
        return (Math.sin(2 * Math.PI * phase) + (0.18 * Math.sin(4 * Math.PI * phase))) / 1.18;
    });
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
    const [modulation, program, laneV2] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/modulation.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    ]);
    return { modulation, program, laneV2 };
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
    const outcome = laneV2.parseLaneStateV2(laneDocument);
    if (outcome._tag !== "ok") {
        throw new Error(`Lane document rejected: ${outcome.message}`);
    }
    // The lane replay mixes event endpoints with value endpoints (each
    // device's Output Trim is a host parameter), as the product connection
    // delivers them.
    for (const event of laneV2.buildLaneRuntimeEventsV2(outcome.value)) {
        if (typeof performer[`setInputValue_${event.endpointID}`] === "function") {
            endpointMethod(performer, "setInputValue", event.endpointID)(event.value, 0);
        } else {
            endpointMethod(performer, "sendInputEvent", event.endpointID)(event.value);
        }
        advanceDiscard(performer, DRIVER_BLOCK_FRAMES);
    }
}

/**
 * Every host parameter at the value a Cmajor host sets when it loads the
 * patch (its init annotation). A generated performer starts every value at
 * zero, which is not the synth a host plays.
 */
function hostParameterDefaults(EngineClass) {
    return Object.fromEntries(EngineClass.prototype.getInputEndpoints()
        .filter(({ purpose }) => purpose === "parameter")
        .map(({ endpointID, annotation }) => [endpointID, annotation.init ?? annotation.min]));
}

/**
 * Instantiates and fully installs one performer the way a host loads the
 * synth. Returns the offline runtime: its `performer`, `prepareMseg` for
 * shared MSEG curves, and `dispose`, which the caller calls to release the
 * performer's shared engine memory.
 *
 * @param {object} spec
 * @param {Function} spec.EngineClass  Generated offline performer class.
 * @param {Record<string, number>} [spec.parameters]  endpointID -> value over
 *   the host defaults. The three wavetable selectors are forced to table 0,
 *   where the synthetic deterministic table is installed.
 * @param {Array<object>} [spec.modulationRoutes]  modulation.v6 route objects.
 * @param {object|string} [spec.laneDocument]  lane.v2 document (object or JSON).
 * @returns {Promise<{ performer: object, prepareMseg: Function, dispose: () => void }>}
 */
export async function createInstalledPerformer(spec) {
    const runtime = await spec.EngineClass.createOfflinePerformer(DRIVER_SESSION_ID, DRIVER_SAMPLE_RATE);
    const performer = runtime.performer;
    try {
        const parameters = {
            ...hostParameterDefaults(spec.EngineClass),
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

        await runtime.prepareWavetables([0, 1, 2].map((input) => ({
            input,
            generation: 1,
            tableIndex: 0,
            frames: [syntheticWavetableFrame()],
        })));
        advanceDiscard(performer, DRIVER_BLOCK_FRAMES);
        await installModulation(performer, spec.modulationRoutes);
        await installLaneDocument(
            performer,
            typeof spec.laneDocument === "string" ? JSON.parse(spec.laneDocument) : spec.laneDocument,
        );
        advanceDiscard(performer, DRIVER_BLOCK_FRAMES * 16);
        return runtime;
    } catch (error) {
        runtime.dispose();
        throw error;
    }
}

/**
 * Renders a frame-indexed score. Render blocks split at each score frame, so
 * entries run exactly at their requested frame in stable source order:
 *   { atFrame, midi: [status, note, velocity] }
 *   { atFrame, parameter: endpointID, value }
 *   { atFrame, event: endpointID, value }  (value may be a factory function)
 *
 * @returns {{ samples: Float32Array, elapsedMilliseconds: number }} stereo
 *   interleaved output plus the wall-clock DSP time (excludes setup).
 */
export function renderScore(performer, score, totalFrames) {
    const ordered = score
        .map((entry, order) => ({ entry, order }))
        .sort((left, right) => (
            left.entry.atFrame - right.entry.atFrame || left.order - right.order
        ))
        .map(({ entry }) => entry);
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

        const nextEventFrame = nextEntry < ordered.length
            ? Math.max(rendered, ordered[nextEntry].atFrame)
            : totalFrames;
        const count = Math.min(
            DRIVER_BLOCK_FRAMES,
            totalFrames - rendered,
            nextEventFrame - rendered,
        );
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
