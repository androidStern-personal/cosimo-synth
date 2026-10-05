import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const { SeqFxSession, parseSeqFxMonitorEvent } = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-session.ts");
const {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANES,
    applySeqFxBlockCreate,
    createDefaultSeqFxState,
} = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");

/** A field control that records what the session asks of it, as the kit's control would receive it. */
function fakeControl(value, log, name) {
    return {
        state: { status: "idle", value },
        error: null,
        retry: null,
        setValue: async (next) => { log.push([name, "set", next]); return { kind: "accepted" }; },
        beginGesture: async () => { log.push([name, "begin"]); return { kind: "accepted" }; },
        endGesture: () => { log.push([name, "end"]); return Promise.resolve({ kind: "accepted" }); },
    };
}

function render(session, { state = createDefaultSeqFxState(), parameters = {}, history = {} } = {}) {
    const log = [];
    const values = { enabled: 1, mix: 1, selectedPattern: 0, clock: 0, manualBpm: 120, rate: 1, swing: 0, loopStart: 0, loopLength: 32, ...parameters };
    const controls = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, fakeControl(value, log, key)]));
    const sent = [];
    const endpointListeners = new Map();
    session.render({
        patterns: fakeControl(state, log, "patterns"),
        controls,
        editor: {
            edit: async (changes) => { log.push(["editor", "edit", changes]); return { kind: "accepted" }; },
            beginGesture: async (keys) => { log.push(["editor", "begin", keys]); return { kind: "accepted" }; },
            endGesture: () => { log.push(["editor", "end"]); return Promise.resolve({ kind: "accepted" }); },
        },
        history: {
            canUndo: false, canRedo: false, ...history,
            undo: async () => { log.push(["history", "undo"]); return { kind: "accepted" }; },
            redo: async () => { log.push(["history", "redo"]); return { kind: "accepted" }; },
        },
        connection: {
            sendEventOrValue: (endpoint, value) => sent.push([endpoint, value]),
            addEndpointListener: (endpoint, listener) => endpointListeners.set(endpoint, listener),
            removeEndpointListener: (endpoint) => endpointListeners.delete(endpoint),
        },
        state,
    });
    return { log, sent, endpointListeners };
}

const patternSets = (log) => log.filter(([name, action]) => name === "patterns" && action === "set").map(([, , value]) => value);

function monitorEvent(transportRunning) {
    return {
        stepIndex: 5,
        stepDurationMs: 125,
        transportRunning,
        auxCyclePhase: [0, 0.5, 1, 0],
        auxAmount: [0, 0.25, 1, 0],
        auxDurationMs: [0, 250, 500, 0],
    };
}

test("monitor frames are read only when the transport flag is an explicit wire token", () => {
    const expected = (running) => ({
        stepIndex: 5, stepDurationMs: 125, transportRunning: running,
        auxCyclePhase: [0, 0.5, 1, 0], auxAmount: [0, 0.25, 1, 0], auxDurationMs: [0, 250, 500, 0],
    });
    for (const token of [true, 1, "1", "true"]) assert.deepEqual(parseSeqFxMonitorEvent({ event: monitorEvent(token) }), expected(true));
    for (const token of [false, 0, "0", "false"]) assert.deepEqual(parseSeqFxMonitorEvent(monitorEvent(token)), expected(false));
    for (const token of [undefined, null, 2, -1, "", "false ", "TRUE", {}, []]) assert.equal(parseSeqFxMonitorEvent(monitorEvent(token)), null);
    assert.equal(parseSeqFxMonitorEvent(null), null);
    assert.equal(parseSeqFxMonitorEvent({ event: "not-an-event" }), null);
});

test("the monitor subscription delivers parsed frames until it is removed", () => {
    const session = new SeqFxSession();
    const { endpointListeners } = render(session);
    const received = [];
    const unsubscribe = session.subscribeMonitor((event) => received.push(event.transportRunning));
    endpointListeners.get("monitorOut")({ event: monitorEvent("1") });
    endpointListeners.get("monitorOut")(monitorEvent("TRUE"));
    endpointListeners.get("monitorOut")(monitorEvent(0));
    assert.deepEqual(received, [true, false]);
    unsubscribe();
    assert.equal(endpointListeners.has("monitorOut"), false);
});

test("an edit shows at once: the next edit in the same event builds on it", () => {
    const session = new SeqFxSession();
    const { log } = render(session);
    session.createBlock({ patternIndex: 0, lane: SEQFX_LANES.filter, startStep: 0, length: 2 });
    session.createBlock({ patternIndex: 0, lane: SEQFX_LANES.crusher, startStep: 4, length: 1 });
    const [first, second] = patternSets(log);
    assert.equal(first.patterns[0].lanes[SEQFX_LANES.filter].steps[0].active, true);
    assert.equal(second.patterns[0].lanes[SEQFX_LANES.filter].steps[0].active, true, "the second edit keeps the first");
    assert.equal(second.patterns[0].lanes[SEQFX_LANES.crusher].steps[4].active, true);
});

test("edits that change nothing send nothing, so they add no Undo entry", () => {
    const state = applySeqFxBlockCreate(createDefaultSeqFxState(), { patternIndex: 0, lane: SEQFX_LANES.filter, startStep: 4, length: 3 });
    const session = new SeqFxSession();
    const { log } = render(session, { state });
    session.resizeBlock({ patternIndex: 0, lane: SEQFX_LANES.filter, startStep: 4, length: 3 });
    session.moveBlock({ patternIndex: 0, lane: SEQFX_LANES.filter, startStep: 4, targetStartStep: 4 });
    assert.deepEqual(log, []);
    const empty = render(session);
    session.clearLoop();
    session.initPattern();
    assert.deepEqual(empty.log, []);
});

test("loop actions act on the selected pattern's loop with an in-memory clipboard", () => {
    let state = createDefaultSeqFxState();
    state = applySeqFxBlockCreate(state, { patternIndex: 0, lane: 0, startStep: 4, length: 3, effectType: SEQFX_EFFECT_TYPES.filter });
    state = applySeqFxBlockCreate(state, { patternIndex: 0, lane: 1, startStep: 10, length: 2, effectType: SEQFX_EFFECT_TYPES.crusher });
    state = applySeqFxBlockCreate(state, { patternIndex: 1, lane: 2, startStep: 7, length: 2, effectType: SEQFX_EFFECT_TYPES.tapeStop });
    const session = new SeqFxSession();
    let { log } = render(session, { state, parameters: { loopStart: 4, loopLength: 8 } });

    assert.equal(session.canPasteLoop(), false);
    session.copyLoop();
    assert.equal(session.canPasteLoop(), true);
    assert.deepEqual(log, [], "copying writes nothing");

    session.clearLoop();
    assert.equal(patternSets(log).length, 1);
    assert.equal(patternSets(log)[0].patterns[0].lanes.flatMap((lane) => lane.steps).some((step) => step.active), false);

    ({ log } = render(session, { state, parameters: { loopStart: 16, loopLength: 8 } }));
    session.pasteLoop();
    const pasted = patternSets(log)[0];
    assert.deepEqual(pasted.patterns[0].lanes[0].steps.slice(16, 19).map((step) => step.active), [true, true, true]);
    assert.deepEqual(pasted.patterns[0].lanes[1].steps.slice(22, 24).map((step) => step.active), [true, true]);

    ({ log } = render(session, { state }));
    session.initPattern();
    const initialized = patternSets(log)[0];
    assert.equal(initialized.patterns[0].lanes.flatMap((lane) => lane.steps).some((step) => step.active), false);
    assert.equal(initialized.patterns[1].lanes[2].steps[7].active, true, "Init leaves the other patterns alone");
});

test("a pointer drag in the inspector opens one gesture and closes it once", () => {
    const session = new SeqFxSession();
    const { log } = render(session);
    session.beginLiveEdit();
    session.beginLiveEdit();
    session.createBlock({ patternIndex: 0, lane: SEQFX_LANES.filter, startStep: 0, length: 1 });
    session.commitLiveEdit();
    session.commitLiveEdit();
    assert.deepEqual(log.map(([name, action]) => `${name} ${action}`), ["patterns begin", "patterns set", "patterns end"]);
});

test("loop start and stop move together as one gesture over both fields", () => {
    const session = new SeqFxSession();
    const { log } = render(session);
    session.beginLoopRangeGesture();
    session.setLoopRange(4, 12);
    session.setLoopRange(40, 2);
    session.endLoopRangeGesture();
    assert.deepEqual(log, [
        ["editor", "begin", ["loopStart", "loopLength"]],
        ["editor", "edit", { loopStart: 4, loopLength: 8 }],
        ["editor", "edit", { loopStart: 31, loopLength: 1 }],
        ["editor", "end"],
    ]);
});

test("global controls, pattern selection, transport and history go to their own owners", () => {
    const session = new SeqFxSession();
    const { log, sent } = render(session, { parameters: { loopStart: 28 }, history: { canUndo: true } });
    session.setGlobalControl("swing", 0.2);
    session.setGlobalControl("loopLength", 32);
    session.selectPattern(5);
    session.playInternal();
    session.resetInternal();
    session.stopInternal();
    assert.equal(session.canUndo(), true);
    session.undo();
    assert.deepEqual(log, [
        ["swing", "set", 0.2],
        ["loopLength", "set", 4],
        ["selectedPattern", "set", 5],
        ["history", "undo"],
    ]);
    assert.deepEqual(sent, [["internalPlay", 1], ["internalReset", 1], ["internalPlay", 0]]);
});
