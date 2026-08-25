import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserAudioLifecycle } from "../web/browser-audio-lifecycle.mjs";

const settleOperations = () => new Promise((resolve) => setImmediate(resolve));

function createDeferred() {
    let resolve;
    const promise = new Promise((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
}

class ControlledAudioContext {
    state = "running";
    suspendCalls = 0;
    resumeCalls = 0;
    resumeOutcomes = [];

    suspend() {
        this.suspendCalls += 1;
        this.state = "suspended";
        return Promise.resolve();
    }

    resume() {
        this.resumeCalls += 1;
        const outcome = this.resumeOutcomes.shift()?.() ?? Promise.resolve();
        return outcome.then(() => {
            this.state = "running";
        });
    }
}

test("repeated leave signals re-run input panic without stopping background audio", async () => {
    const context = new ControlledAudioContext();
    const releasedReasons = [];
    const lifecycle = createBrowserAudioLifecycle({
        context,
        canRecover: () => true,
        onLeave: (reason) => releasedReasons.push(reason),
    });

    assert.equal(lifecycle.leave("visibility-hidden"), true);
    assert.equal(lifecycle.leave("pagehide"), false);
    await Promise.resolve();

    assert.deepEqual(lifecycle.getSnapshot(), {
        attemptCount: 0,
        lastFailure: null,
        lastReason: "visibility-hidden",
        phase: "away",
        revision: 1,
    });
    assert.equal(context.suspendCalls, 0);
    assert.equal(context.resumeCalls, 0);
    assert.deepEqual(releasedReasons, ["visibility-hidden", "pagehide"]);
});

test("return performs one suspend-resume edge and becomes active", async () => {
    const context = new ControlledAudioContext();
    const recoveredReasons = [];
    const lifecycle = createBrowserAudioLifecycle({
        context,
        canRecover: () => true,
        onLeave: () => {},
        onRecovered: (reason) => recoveredReasons.push(reason),
    });

    lifecycle.leave("visibility-hidden");
    assert.equal(lifecycle.returnToPage("visibility-visible"), true);
    assert.equal(lifecycle.returnToPage("pageshow"), false);
    await settleOperations();

    assert.deepEqual(lifecycle.getSnapshot(), {
        attemptCount: 1,
        lastFailure: null,
        lastReason: "visibility-visible",
        phase: "active",
        revision: 2,
    });
    assert.equal(context.suspendCalls, 1);
    assert.equal(context.resumeCalls, 1);
    assert.deepEqual(recoveredReasons, ["visibility-visible"]);
});

test("a blocked automatic return is retried by the next gesture", async () => {
    const context = new ControlledAudioContext();
    context.resumeOutcomes.push(() => Promise.reject(new DOMException(
        "A fresh gesture is required.",
        "NotAllowedError",
    )));
    const lifecycle = createBrowserAudioLifecycle({
        context,
        canRecover: () => true,
        onLeave: () => {},
    });

    lifecycle.leave("visibility-hidden");
    lifecycle.returnToPage("visibility-visible");
    await settleOperations();
    assert.equal(lifecycle.getSnapshot().phase, "blocked");
    assert.equal(lifecycle.getSnapshot().lastFailure, "NotAllowedError");

    assert.equal(lifecycle.retryFromGesture("gesture"), true);
    await settleOperations();

    assert.deepEqual(lifecycle.getSnapshot(), {
        attemptCount: 2,
        lastFailure: null,
        lastReason: "gesture",
        phase: "active",
        revision: 3,
    });
    assert.equal(context.suspendCalls, 2);
    assert.equal(context.resumeCalls, 2);
});

test("an interrupted session stays away until recovery becomes eligible", async () => {
    const context = new ControlledAudioContext();
    let eligible = false;
    const lifecycle = createBrowserAudioLifecycle({
        context,
        canRecover: () => eligible,
        onLeave: () => {},
    });

    lifecycle.leave("audio-session-interrupted");
    assert.equal(lifecycle.returnToPage("window-focus"), false);
    assert.equal(lifecycle.retryFromGesture("gesture"), false);
    assert.equal(lifecycle.getSnapshot().phase, "away");
    assert.equal(lifecycle.getSnapshot().attemptCount, 0);
    assert.equal(context.resumeCalls, 0);

    eligible = true;
    assert.equal(lifecycle.returnToPage("audio-session-active"), true);
    await settleOperations();
    assert.equal(lifecycle.getSnapshot().phase, "active");
    assert.equal(context.resumeCalls, 1);
});

test("a gesture supersedes a pending automatic recovery", async () => {
    const pendingAutomaticResume = createDeferred();
    const context = new ControlledAudioContext();
    context.resumeOutcomes.push(() => pendingAutomaticResume.promise);
    const lifecycle = createBrowserAudioLifecycle({
        context,
        canRecover: () => true,
        onLeave: () => {},
    });

    lifecycle.leave("window-blur");
    lifecycle.returnToPage("window-focus");
    assert.equal(lifecycle.getSnapshot().phase, "recovering");

    assert.equal(lifecycle.retryFromGesture("gesture"), true);
    await settleOperations();
    assert.equal(lifecycle.getSnapshot().phase, "active");

    pendingAutomaticResume.resolve();
    await settleOperations();
    assert.deepEqual(lifecycle.getSnapshot(), {
        attemptCount: 2,
        lastFailure: null,
        lastReason: "gesture",
        phase: "active",
        revision: 3,
    });
});

test("an older recovery cannot erase a newer leave", async () => {
    const pendingResume = createDeferred();
    const context = new ControlledAudioContext();
    const recoveredReasons = [];
    context.resumeOutcomes.push(() => pendingResume.promise);
    const lifecycle = createBrowserAudioLifecycle({
        context,
        canRecover: () => true,
        onLeave: () => {},
        onRecovered: (reason) => recoveredReasons.push(reason),
    });

    lifecycle.leave("window-blur");
    lifecycle.returnToPage("window-focus");
    lifecycle.leave("pagehide");
    pendingResume.resolve();
    await settleOperations();

    assert.deepEqual(lifecycle.getSnapshot(), {
        attemptCount: 1,
        lastFailure: null,
        lastReason: "pagehide",
        phase: "away",
        revision: 3,
    });
    assert.deepEqual(recoveredReasons, []);
});
