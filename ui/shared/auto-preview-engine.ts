/**
 * The Auto-preview engine (T12): connects the user-edit stream to the pure
 * retrigger scheduler and drives the preview callbacks.
 *
 * Responsibilities (the behavioral contract, pinned by
 * tests/test_auto_preview_engine.mjs):
 * - Only edits with `changed === true` reach the scheduler, and only while the
 *   engine is enabled. Unchanged writes (pointer motion inside one detent) and
 *   anything while disabled are ignored entirely.
 * - Gesture depth: gestureStarted/gestureEnded may nest (multi-pointer).
 *   scheduler.gestureEnded fires only when depth returns to zero.
 * - Stillness synthesis: an edit arriving at gesture depth zero (a control
 *   without begin/end brackets) arms a movementStoppedMs timer; if no further
 *   edit or gesture start arrives before it fires, the engine synthesizes
 *   scheduler.gestureEnded. Any edit or gestureStarted re-arms/cancels it.
 * - Timer discipline: the engine keeps exactly ONE armed deps.scheduleAt timer
 *   at min(stillness deadline, scheduler.nextDeadline()), re-arming after every
 *   event. When the timer fires it resolves a due stillness deadline FIRST
 *   (synthesizing scheduler.gestureEnded) and then a due scheduler deadline
 *   (scheduler.tick), so a gesture that stops exactly at window-open turns its
 *   pending strike into the self-releasing capped note rather than a held note
 *   ended in the same instant.
 * - Command dispatch: {kind:"retrigger", capMs} → deps.playPreview(capMs);
 *   {kind:"endPreview"} → deps.endPreview(). Command order is preserved.
 * - setEnabled(false) while anything is active cancels via
 *   scheduler.cancelled(now), dispatches its commands (ending any preview),
 *   and clears all timers. setEnabled(true) is a no-op beyond gating.
 * - dispose() behaves like setEnabled(false) and unsubscribes everything.
 * - No wall clocks: time comes only from deps.now(); timers only from
 *   deps.scheduleAt(atMs, cb) which returns a cancel function.
 */

import {
    type AutoPreviewCommand,
    type AutoPreviewScheduler,
} from "./auto-preview-scheduler";

export type AutoPreviewEngineDeps = {
    readonly scheduler: AutoPreviewScheduler;
    readonly movementStoppedMs: number;
    readonly now: () => number;
    readonly scheduleAt: (atMs: number, callback: () => void) => () => void;
    /** Strike the preview; capMs non-null means self-release after capMs. */
    readonly playPreview: (capMs: number | null) => void;
    /** End engine-owned preview notes (never user-held ones). */
    readonly endPreview: () => void;
};

export type AutoPreviewEngine = {
    setEnabled(enabled: boolean): void;
    parameterEdited(changed: boolean): void;
    gestureStarted(): void;
    gestureEnded(): void;
    dispose(): void;
};

/** Create the lifecycle and timer bridge around the pure preview scheduler. */
export function createAutoPreviewEngine(deps: AutoPreviewEngineDeps): AutoPreviewEngine {
    type ArmedTimer = {
        readonly token: object;
        readonly cancel: () => void;
    };

    let isEnabled = false;
    let isDisposed = false;
    let gestureDepth = 0;
    let stillnessDeadline: number | null = null;
    let armedTimer: ArmedTimer | null = null;

    const dispatch = (commands: ReadonlyArray<AutoPreviewCommand>): void => {
        for (const command of commands) {
            switch (command.kind) {
                case "retrigger":
                    deps.playPreview(command.capMs);
                    break;
                case "endPreview":
                    deps.endPreview();
                    break;
            }
        }
    };

    const cancelTimer = (): void => {
        const timer = armedTimer;
        if (timer === null) {
            return;
        }

        armedTimer = null;
        timer.cancel();
    };

    const nextTimerDeadline = (): number | null => {
        const schedulerDeadline = deps.scheduler.nextDeadline();
        if (stillnessDeadline === null) {
            return schedulerDeadline;
        }
        if (schedulerDeadline === null) {
            return stillnessDeadline;
        }
        return Math.min(stillnessDeadline, schedulerDeadline);
    };

    const timerFired = (): void => {
        if (!isEnabled || isDisposed) {
            return;
        }

        const now = deps.now();
        if (stillnessDeadline !== null && stillnessDeadline <= now) {
            stillnessDeadline = null;
            dispatch(deps.scheduler.gestureEnded(now));
        }

        const schedulerDeadline = deps.scheduler.nextDeadline();
        if (schedulerDeadline !== null && schedulerDeadline <= now) {
            dispatch(deps.scheduler.tick(now));
        }

        armTimer();
    };

    const armTimer = (): void => {
        cancelTimer();
        if (!isEnabled || isDisposed) {
            return;
        }

        const deadline = nextTimerDeadline();
        if (deadline === null) {
            return;
        }

        const token = {};
        const cancel = deps.scheduleAt(deadline, () => {
            if (armedTimer?.token !== token) {
                return;
            }
            armedTimer = null;
            timerFired();
        });
        armedTimer = { token, cancel };
    };

    const deactivate = (): void => {
        cancelTimer();
        stillnessDeadline = null;
        gestureDepth = 0;
        dispatch(deps.scheduler.cancelled(deps.now()));
    };

    return {
        setEnabled(enabled) {
            if (isDisposed || enabled === isEnabled) {
                return;
            }

            isEnabled = enabled;
            if (!enabled) {
                deactivate();
            }
        },

        parameterEdited(changed) {
            if (isDisposed || !isEnabled || !changed) {
                return;
            }

            const now = deps.now();
            stillnessDeadline = gestureDepth === 0
                ? now + deps.movementStoppedMs
                : null;
            dispatch(deps.scheduler.parameterChanged(now));
            armTimer();
        },

        gestureStarted() {
            if (isDisposed || !isEnabled) {
                return;
            }

            gestureDepth += 1;
            stillnessDeadline = null;
            armTimer();
        },

        gestureEnded() {
            if (isDisposed || !isEnabled) {
                return;
            }
            if (gestureDepth === 0) {
                armTimer();
                return;
            }

            gestureDepth -= 1;
            if (gestureDepth === 0) {
                stillnessDeadline = null;
                dispatch(deps.scheduler.gestureEnded(deps.now()));
            }
            armTimer();
        },

        dispose() {
            if (isDisposed) {
                return;
            }

            isDisposed = true;
            if (isEnabled) {
                isEnabled = false;
                deactivate();
                return;
            }

            cancelTimer();
            stillnessDeadline = null;
            gestureDepth = 0;
        },
    };
}
