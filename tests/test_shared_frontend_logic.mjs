import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadRuntimeTableStateModule() {
    return await loadUIModule(repoRoot, "ui/shared/runtime-table-state.ts");
}

async function loadDisplayGestureModule() {
    return await loadUIModule(repoRoot, "ui/shared/display-gesture.ts");
}

async function loadKeyboardGeometryModule() {
    return await loadUIModule(repoRoot, "ui/shared/keyboard-geometry.ts");
}

test("display position matching ignores float noise after clamping but still rejects a real movement", async () => {
    const { displayPositionsMatch } = await loadRuntimeTableStateModule();

    assert.equal(displayPositionsMatch(0.5, 0.5000004), true);
    assert.equal(displayPositionsMatch(-4, 0), true);
    assert.equal(displayPositionsMatch(3, 1), true);
    assert.equal(displayPositionsMatch(0.5, 0.50002), false);
});

test("display drag mapping follows upward finger motion and clamps at the ends", async () => {
    const { mapDisplayDragToPosition } = await loadRuntimeTableStateModule();

    assert.equal(mapDisplayDragToPosition(0.25, 200, 120, 200), 0.65);
    assert.equal(mapDisplayDragToPosition(0.9, 200, -100, 120), 1);
    assert.equal(mapDisplayDragToPosition(0.1, 200, 500, 120), 0);
    assert.equal(mapDisplayDragToPosition(0.4, 100, 99, 0), 1);
});

test("effective wavetable position normalization accepts wrapped payloads and rejects malformed ones", async () => {
    const { normalizeEffectiveWavetablePositionMessage } = await loadRuntimeTableStateModule();

    assert.deepEqual(normalizeEffectiveWavetablePositionMessage(0.75), {
        voiceGeneration: 0,
        position: 0.75,
    });
    assert.deepEqual(normalizeEffectiveWavetablePositionMessage({
        event: {
            voiceGeneration: 3.9,
            position: 1.2,
        },
    }), {
        voiceGeneration: 3,
        position: 1,
    });
    assert.equal(normalizeEffectiveWavetablePositionMessage({ event: { voiceGeneration: 2 } }), null);
    assert.equal(normalizeEffectiveWavetablePositionMessage(null), null);
});

test("observed wavetable position state keeps the newest voice generation only", async () => {
    const { selectObservedWavetablePositionState } = await loadRuntimeTableStateModule();
    const previousState = {
        voiceGeneration: 5,
        position: 0.4,
    };

    assert.deepEqual(
        selectObservedWavetablePositionState(previousState, {
            event: {
                voiceGeneration: 4,
                position: 0.9,
            },
        }),
        previousState,
    );
    assert.deepEqual(
        selectObservedWavetablePositionState(previousState, {
            event: {
                voiceGeneration: 6,
                position: 0.9,
            },
        }),
        {
            voiceGeneration: 6,
            position: 0.9,
        },
    );
    assert.deepEqual(
        selectObservedWavetablePositionState(null, 0.33),
        {
            voiceGeneration: 0,
            position: 0.33,
        },
    );
});

test("runtime table presentation falls back cleanly when no runtime state exists", async () => {
    const { resolveRuntimeTablePresentation } = await loadRuntimeTableStateModule();

    assert.deepEqual(resolveRuntimeTablePresentation(null, 7), {
        desiredTableIndex: 7,
        presentedTableIndex: 7,
        activeTableIndex: null,
        activeGeneration: null,
        loadingTableIndex: null,
        loadingGeneration: null,
        isPendingSelection: false,
        isRetryableFailure: false,
        failureMessage: null,
    });
});

test("runtime table presentation keeps the audible table visible while another desired table is pending", async () => {
    const { resolveRuntimeTablePresentation } = await loadRuntimeTableStateModule();

    assert.deepEqual(resolveRuntimeTablePresentation({
        event: {
            desiredTableIndex: 5,
            desiredIntentSerial: 9,
            serviceState: 1,
            hasActive: true,
            activeTableIndex: 2,
            activeGeneration: 11,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 0,
            failureReasonCode: 0,
        },
    }), {
        desiredTableIndex: 5,
        presentedTableIndex: 2,
        activeTableIndex: 2,
        activeGeneration: 11,
        loadingTableIndex: null,
        loadingGeneration: null,
        isPendingSelection: true,
        isRetryableFailure: false,
        failureMessage: null,
    });
});

test("runtime table presentation exposes retryable desired-table failures with the right message", async () => {
    const { resolveRuntimeTablePresentation, describeRuntimeTableFailureDetails } = await loadRuntimeTableStateModule();
    const failureState = {
        event: {
            desiredTableIndex: 3,
            desiredIntentSerial: 4,
            serviceState: 1,
            hasActive: false,
            activeTableIndex: 0,
            activeGeneration: 0,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: true,
            failedTableIndex: 3,
            failedGeneration: 9,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        },
    };

    assert.deepEqual(resolveRuntimeTablePresentation(failureState), {
        desiredTableIndex: 3,
        presentedTableIndex: 3,
        activeTableIndex: null,
        activeGeneration: null,
        loadingTableIndex: null,
        loadingGeneration: null,
        isPendingSelection: false,
        isRetryableFailure: true,
        failureMessage: "Wavetable load timed out.",
    });
    assert.equal(
        describeRuntimeTableFailureDetails(failureState.event, "BS2 - Acid"),
        "BS2 - Acid failed during mip transfer (committed load, generation 9, timeout).",
    );
});

test("display gesture axis stays pending until motion crosses the lock threshold", async () => {
    const { resolveDisplayGestureAxis } = await loadDisplayGestureModule();

    assert.equal(resolveDisplayGestureAxis(4, 5), "pending");
    assert.equal(resolveDisplayGestureAxis(16, 8), "horizontal");
    assert.equal(resolveDisplayGestureAxis(7, 18), "vertical");
});

test("horizontal swipe targeting advances one table and clamps at either edge", async () => {
    const { resolveHorizontalSwipeTarget } = await loadDisplayGestureModule();

    assert.deepEqual(resolveHorizontalSwipeTarget(3, -64, 8), {
        direction: 1,
        targetTableIndex: 4,
        hasTarget: true,
    });
    assert.deepEqual(resolveHorizontalSwipeTarget(3, 64, 8), {
        direction: -1,
        targetTableIndex: 2,
        hasTarget: true,
    });
    assert.deepEqual(resolveHorizontalSwipeTarget(0, 64, 8), {
        direction: -1,
        targetTableIndex: 0,
        hasTarget: false,
    });
    assert.deepEqual(resolveHorizontalSwipeTarget(7, -64, 8), {
        direction: 1,
        targetTableIndex: 7,
        hasTarget: false,
    });
});

test("horizontal swipe commit threshold uses the greater of the minimum distance and stage ratio", async () => {
    const { shouldCommitHorizontalSwipe } = await loadDisplayGestureModule();

    assert.equal(shouldCommitHorizontalSwipe(47, 100), false);
    assert.equal(shouldCommitHorizontalSwipe(48, 100), true);
    assert.equal(shouldCommitHorizontalSwipe(107, 600), false);
    assert.equal(shouldCommitHorizontalSwipe(108, 600), true);
});

test("keyboard geometry counts natural notes across the visible range and never returns zero", async () => {
    const { countNaturalNotesInRange } = await loadKeyboardGeometryModule();

    assert.equal(countNaturalNotesInRange(24, 12), 7);
    assert.equal(countNaturalNotesInRange(25, 12), 7);
    assert.equal(countNaturalNotesInRange(25, 1), 1);
});

test("keyboard geometry clamps natural width and derives the accidental width from it", async () => {
    const { computeKeyboardDimensions } = await loadKeyboardGeometryModule();

    assert.deepEqual(
        Object.fromEntries(
            Object.entries(computeKeyboardDimensions({
                rootNote: 24,
                noteCount: 12,
                availableWidth: 180,
            })).map(([key, value]) => [key, typeof value === "number" ? Number(value.toFixed(3)) : value]),
        ),
        {
            naturalCount: 7,
            naturalWidth: 25.571,
            accidentalWidth: 14.831,
        },
    );
    assert.deepEqual(
        Object.fromEntries(
            Object.entries(computeKeyboardDimensions({
                rootNote: 24,
                noteCount: 12,
                availableWidth: 50,
            })).map(([key, value]) => [key, typeof value === "number" ? Number(value.toFixed(3)) : value]),
        ),
        {
            naturalCount: 7,
            naturalWidth: 18,
            accidentalWidth: 10.44,
        },
    );
});
