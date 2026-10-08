import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const { animateLiveNumber } = await loadUIModule(repoRoot, "kit/ui/live-value.ts");

/**
 * A stand-in for the browser's animation frames. Frames run only when the test
 * calls step(), and each step advances time by one 16 ms frame.
 */
function createFrameClock() {
    let nextId = 0;
    let time = 0;
    const pending = new Map();

    const view = {
        requestAnimationFrame(callback) {
            nextId += 1;
            pending.set(nextId, callback);
            return nextId;
        },
        cancelAnimationFrame(id) {
            pending.delete(id);
        },
    };

    function step() {
        time += 16;
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks) {
            callback(time);
        }
    }

    return { view, step, pendingCount: () => pending.size };
}

/** A live number the test sets by hand, with the getSnapshot/subscribe shape the module reads. */
function createLiveNumber(initialValue) {
    let value = initialValue;
    const listeners = new Set();

    return {
        getSnapshot: () => value,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        set(nextValue) {
            value = nextValue;
            for (const listener of listeners) {
                listener();
            }
        },
        listenerCount: () => listeners.size,
    };
}

test("many indicators share one frame and unsubscribe/stop on final detach", () => {
    const frames = createFrameClock();
    const signal = createLiveNumber(0);
    const firstOutput = [];
    const secondOutput = [];

    const stopFirst = animateLiveNumber(frames.view, signal, (value) => value, 0, (position) => firstOutput.push(position));
    const stopSecond = animateLiveNumber(frames.view, signal, (value) => value * 2, 0, (position) => secondOutput.push(position));

    // Several reports within one frame request a single frame and only the last value is drawn.
    signal.set(0.2);
    signal.set(0.4);
    signal.set(0.8);
    assert.equal(frames.pendingCount(), 1);

    frames.step();
    assert.deepEqual(firstOutput, [0.8]);
    assert.deepEqual(secondOutput, [1.6]);
    assert.equal(frames.pendingCount(), 0);

    // Detaching the last indicator unsubscribes and cancels the frame it had requested.
    signal.set(1);
    stopFirst();
    stopSecond();
    assert.equal(signal.listenerCount(), 0);
    assert.equal(frames.pendingCount(), 0);

    signal.set(0);
    assert.equal(frames.pendingCount(), 0);
});

test("smoothing converges and stops; inactive/invalid values hide and break continuity", () => {
    const frames = createFrameClock();
    const signal = createLiveNumber(0.2);
    const output = [];

    const stop = animateLiveNumber(frames.view, signal, (value) => value, 45, (position) => output.push(position));

    // The first value is drawn as is; there is nothing to smooth from.
    frames.step();
    assert.equal(output.at(-1), 0.2);

    // A new value is approached over several frames.
    signal.set(0.8);
    frames.step();
    assert.ok(output.at(-1) > 0.2 && output.at(-1) < 0.8);

    // It settles exactly on the target and stops requesting frames.
    for (let frame = 0; frame < 80 && frames.pendingCount() > 0; frame += 1) {
        frames.step();
    }
    assert.equal(output.at(-1), 0.8);
    assert.equal(frames.pendingCount(), 0);

    // An inactive value hides the indicator.
    signal.set(null);
    frames.step();
    assert.equal(output.at(-1), null);

    // The next value jumps straight there instead of smoothing from the old position.
    signal.set(0.1);
    frames.step();
    assert.equal(output.at(-1), 0.1);

    // A value that is not a finite number hides the indicator too.
    signal.set(NaN);
    frames.step();
    assert.equal(output.at(-1), null);

    stop();
});

test("detaching during a pending smoothed update cannot write afterward", () => {
    const frames = createFrameClock();
    const signal = createLiveNumber(0.2);
    const output = [];

    const stop = animateLiveNumber(frames.view, signal, (value) => value, 100, (position) => output.push(position));

    frames.step();
    signal.set(0.9);
    frames.step();
    const writesBeforeDetach = output.length;

    stop();
    for (let frame = 0; frame < 20; frame += 1) {
        frames.step();
    }
    assert.equal(output.length, writesBeforeDetach);
    assert.equal(signal.listenerCount(), 0);
    assert.equal(frames.pendingCount(), 0);
});
