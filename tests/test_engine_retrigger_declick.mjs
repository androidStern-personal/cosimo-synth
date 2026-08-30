// Retrigger behavior contracts on the generated engine (build/web must be
// current): rapid retriggering is bit-deterministic, a hard (re)trigger of
// a sounding voice fades instead of truncating, and the MSEG legatoRestarts
// playback flag actually governs legato retunes.
//
// The renders are exact (fixed session id, synthetic wavetable), so the
// thresholds below sit far from both the passing and the failing regimes:
// before the steal fade, cutting a sounding tail produced a one-sample step
// of roughly the tail's whole level (~0.4); with the fade, per-sample
// motion stays at the signal's own slope (~0.02).
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
    loadOfflineEngineClass,
    createInstalledPerformer,
    renderScore,
    firstSampleDifference,
    DRIVER_BLOCK_FRAMES,
    DRIVER_SESSION_ID,
} from "./tools/offline-engine-driver.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const enginePath = path.join(repoRoot, "build", "web", "cmaj_Cosimo_Synth.offline.js");
const EngineClass = await loadOfflineEngineClass(enginePath);

const noteOn = (atFrame, note = 60, velocity = 100) => ({ atFrame, midi: [0x90, note, velocity] });
const noteOff = (atFrame, note = 60) => ({ atFrame, midi: [0x80, note, 64] });

function maxAbsoluteDiff(left, right, fromFrame, toFrame) {
    let max = 0;
    for (let n = fromFrame; n < toFrame; n += 1) {
        max = Math.max(max, Math.abs(left[n * 2] - right[n * 2]));
    }
    return max;
}

function maxDiffStep(left, right, fromFrame, toFrame) {
    let max = 0;
    for (let n = Math.max(1, fromFrame); n < toFrame; n += 1) {
        const now = left[n * 2] - right[n * 2];
        const previous = left[(n - 1) * 2] - right[(n - 1) * 2];
        max = Math.max(max, Math.abs(now - previous));
    }
    return max;
}

test("rapid retriggering renders bit-identically on identical input", async () => {
    const render = async () => {
        const performer = await createInstalledPerformer({
            EngineClass,
            parameters: { playMode: 1, ampAttack: 0.001, ampDecay: 0.03, ampSustain: 0.8, ampRelease: 0.4 },
        });
        const score = [];
        for (let index = 0; index < 8; index += 1) {
            const frame = 2560 + (index * DRIVER_BLOCK_FRAMES * 15);
            score.push(noteOn(frame, index % 2 === 0 ? 60 : 63), noteOff(frame + DRIVER_BLOCK_FRAMES * 7, index % 2 === 0 ? 60 : 63));
        }
        return renderScore(performer, score, 64_000).samples;
    };

    assert.equal(firstSampleDifference(await render(), await render()), null);
});

test("a hard retrigger of a sounding voice fades instead of truncating", async () => {
    // Mono, slow attack (so the new note's own rise is gentle), loud recent
    // tail: the 6th note lands on the 5th's release. Before the steal fade
    // this cut the tail in one sample (diff step ~= tail level ~0.45).
    const build = async (noteCount) => {
        const performer = await createInstalledPerformer({
            EngineClass,
            parameters: { playMode: 1, ampAttack: 0.01, ampDecay: 0.05, ampSustain: 0.9, ampRelease: 0.8 },
        });
        const score = [];
        for (let index = 0; index < noteCount; index += 1) {
            const frame = 2560 + (index * DRIVER_BLOCK_FRAMES * 16);
            const note = index % 2 === 0 ? 60 : 63;
            score.push(noteOn(frame, note), noteOff(frame + DRIVER_BLOCK_FRAMES * 12, note));
        }
        return renderScore(performer, score, 2560 + 8 * DRIVER_BLOCK_FRAMES * 16 + 24_000).samples;
    };

    const control = await build(5);
    const retriggered = await build(6);
    const onset = 2560 + (5 * DRIVER_BLOCK_FRAMES * 16);

    assert.equal(maxAbsoluteDiff(control, retriggered, 0, onset), 0, "determinism before the retrigger");

    const window = 1024;
    const changed = maxAbsoluteDiff(control, retriggered, onset, onset + window);
    const worstStep = maxDiffStep(control, retriggered, onset, onset + window);
    assert.ok(changed > 0.2, `retrigger must audibly change the render (changed ${changed})`);
    assert.ok(worstStep < 0.05, `no one-sample cut may remain (worst step ${worstStep})`);
});

test("legatoRestarts governs whether a legato retune restarts the MSEG", async () => {
    const msegPositionAfterLegato = async (legatoRestarts) => {
        const performer = await createInstalledPerformer({
            EngineClass,
            parameters: { playMode: 2, ampAttack: 0.001, ampSustain: 1.0, mseg1Rate: 2.0 },
            modulationRoutes: [{
                id: "declick-legato", sourceKind: "mseg", sourceSlot: 1,
                targetKind: "oscA.wavetablePosition", amount: 0.5, polarity: "unipolar",
            }],
        });
        performer.resetOutputEventCount_runtimeInstallAck();
        const send = (endpointID, value) => performer[`sendInputEvent_${endpointID}`](value);
        const body = Array.from({ length: 2048 }, (_, index) => index / 2047);
        const buffer = [body[0], ...body, 1, 1];
        send("modulationMsegBuffer", { dspSessionId: DRIVER_SESSION_ID, deliverySerial: 2, slot: 1, shapeIndex: 0, buffer });
        performer.advance(DRIVER_BLOCK_FRAMES);
        send("modulationMsegBuffer", { dspSessionId: DRIVER_SESSION_ID, deliverySerial: 3, slot: 1, shapeIndex: 1, buffer });
        performer.advance(DRIVER_BLOCK_FRAMES);
        send("modulationMsegPlayback", {
            dspSessionId: DRIVER_SESSION_ID, deliverySerial: 4,
            slot: 1, holdFinalValue: true, rateKind: 0,
            loopEnabled: false, loopStart: 0, loopEnd: 1,
            noteOffPolicy: 0, legatoRestarts,
        });
        performer.advance(DRIVER_BLOCK_FRAMES);

        // Legato: hold the first key while striking the second. The monitor
        // FIFO is drained every block — it is small, and only the newest
        // value matters.
        let latestMseg = null;
        const drainLatest = () => {
            const count = performer.getOutputEventCount_effectiveModSourceState();
            for (let index = 0; index < count; index += 1) {
                latestMseg = performer.getOutputEvent_effectiveModSourceState(index).event.values[0];
            }
            performer.resetOutputEventCount_effectiveModSourceState();
        };

        send("midiIn", { message: (0x90 << 16) | (60 << 8) | 100 });
        for (let block = 0; block < 150; block += 1) { // ~0.4s into a 2s ramp
            performer.advance(DRIVER_BLOCK_FRAMES);
            drainLatest();
        }
        send("midiIn", { message: (0x90 << 16) | (64 << 8) | 100 });
        for (let block = 0; block < 8; block += 1) {
            performer.advance(DRIVER_BLOCK_FRAMES);
            drainLatest();
        }
        return latestMseg;
    };

    const continued = await msegPositionAfterLegato(false);
    const restarted = await msegPositionAfterLegato(true);

    assert.ok(continued !== null && restarted !== null);
    // 0.4s into a 2s ramp is ~0.2; a restart just after the legato note is
    // near the ramp's origin.
    assert.ok(continued > 0.15, `legatoRestarts=false must keep position (${continued})`);
    assert.ok(restarted < 0.1, `legatoRestarts=true must restart playback (${restarted})`);
});
