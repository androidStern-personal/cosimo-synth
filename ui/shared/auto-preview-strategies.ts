/**
 * Dev-build auto-preview strategy engine: the alternative retrigger feels the
 * performance tuning page can swap in for the shipped T12 engine. Exposes the
 * exact AutoPreviewEngine surface so the note layer, manual-hold tracking, and
 * suspension wiring in synth-hooks drive it unchanged.
 *
 * The strategies share one model: a preview note is struck from the remembered
 * group and HELD — engine voices read modulation state live, so a held note
 * already morphs as the user drags. They differ only in when they restrike:
 * - morph: never; one living note per burst of editing.
 * - settle: when the value has rested for settleMs (a trailing debounce);
 *   movement cancels a deferred restrike so nothing lands behind the finger.
 * - wrap: at the sounding loop's next cycle boundary (settle fallback when no
 *   routed looping MSEG is eligible).
 * - paced: while moving, at most one restrike per minGapMs, plus a settle
 *   restrike at rest.
 * All of them release the held note after holdMs with no further activity,
 * since unbracketed edit streams (MSEG dots) never report finger-up. At most
 * one future strike ever exists, and a strike always sounds the live state.
 *
 * Timing is caller-driven like the shipped scheduler: deps.now/scheduleAt
 * only, one armed timer, deterministic under test.
 */

import { type AutoPreviewEngine } from "./auto-preview-engine";
import { type AutoPreviewStrikeKind } from "./auto-preview-sync";

export type PreviewStrategyAlgorithm = "morph" | "settle" | "wrap" | "paced";

export type PreviewStrategyParams = {
    readonly settleMs: number;
    readonly minGapMs: number;
    readonly holdMs: number;
    readonly loopSync: boolean;
};

export type PreviewStrategyEngineDeps = {
    readonly algorithm: PreviewStrategyAlgorithm;
    /** Live tuning values; read at use time so sliders apply immediately. */
    readonly params: () => PreviewStrategyParams;
    readonly now: () => number;
    readonly scheduleAt: (atMs: number, callback: () => void) => () => void;
    /** Choke the previous preview group and strike the remembered one, held. */
    readonly strike: () => void;
    /** Release the engine-owned preview group. */
    readonly release: () => void;
    /** T12B quantizer against the live loop source; returns a time >= now. */
    readonly quantizeStrike: (nowMs: number, kind: AutoPreviewStrikeKind) => number;
    /** Next cycle boundary of the eligible loop, or null when none. */
    readonly nextLoopBoundary: (nowMs: number) => number | null;
};

export function createPreviewStrategyEngine(deps: PreviewStrategyEngineDeps): AutoPreviewEngine {
    type ArmedTimer = { readonly token: object; readonly cancel: () => void };

    let isEnabled = false;
    let isDisposed = false;
    let manualHoldActive = false;
    let sounding = false;
    let dirty = false;
    let lastEditMs = 0;
    let lastStrikeMs = 0;
    let deferredStrikeAt: number | null = null;
    let armedTimer: ArmedTimer | null = null;

    const cancelTimer = (): void => {
        const timer = armedTimer;
        if (timer === null) {
            return;
        }
        armedTimer = null;
        timer.cancel();
    };

    const stopEverything = (): void => {
        cancelTimer();
        deferredStrikeAt = null;
        dirty = false;
        if (sounding) {
            sounding = false;
            deps.release();
        }
    };

    const doStrike = (nowMs: number): void => {
        deferredStrikeAt = null;
        dirty = false;
        lastStrikeMs = nowMs;
        sounding = true;
        deps.strike();
    };

    /** Strike now, or defer to the loop grid when sync applies. */
    const strikeOrDefer = (nowMs: number, kind: AutoPreviewStrikeKind): void => {
        const at = deps.params().loopSync ? deps.quantizeStrike(nowMs, kind) : nowMs;
        if (at <= nowMs) {
            doStrike(nowMs);
            return;
        }
        deferredStrikeAt = at;
        dirty = false;
    };

    /** The rest deadline that makes a dirty value strike (settle/paced/wrap fallback). */
    const dirtyStrikeDeadline = (): number | null => {
        if (!sounding || !dirty) {
            return null;
        }
        const params = deps.params();
        if (deps.algorithm === "morph") {
            return null;
        }
        const settleAt = lastEditMs + params.settleMs;
        if (deps.algorithm === "paced") {
            return Math.min(settleAt, lastStrikeMs + params.minGapMs);
        }
        return settleAt;
    };

    const holdEndDeadline = (): number | null => (
        sounding && !dirty && deferredStrikeAt === null
            ? Math.max(lastEditMs, lastStrikeMs) + deps.params().holdMs
            : null
    );

    const nextDeadline = (): number | null => {
        const candidates = [deferredStrikeAt, dirtyStrikeDeadline(), holdEndDeadline()]
            .filter((value): value is number => value !== null);
        return candidates.length > 0 ? Math.min(...candidates) : null;
    };

    const timerFired = (): void => {
        if (!isEnabled || isDisposed || manualHoldActive) {
            return;
        }
        const nowMs = deps.now();

        if (deferredStrikeAt !== null && deferredStrikeAt <= nowMs) {
            doStrike(nowMs);
        } else {
            const strikeDue = dirtyStrikeDeadline();
            if (strikeDue !== null && strikeDue <= nowMs) {
                const params = deps.params();
                const resting = nowMs - lastEditMs >= params.settleMs;
                strikeOrDefer(nowMs, resting ? "trailing" : "inMotion");
            } else {
                const holdEnd = holdEndDeadline();
                if (holdEnd !== null && holdEnd <= nowMs) {
                    stopEverything();
                }
            }
        }

        armTimer();
    };

    const armTimer = (): void => {
        cancelTimer();
        if (!isEnabled || isDisposed || manualHoldActive) {
            return;
        }
        const deadline = nextDeadline();
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

    return {
        setEnabled(enabled) {
            if (isDisposed || enabled === isEnabled) {
                return;
            }
            isEnabled = enabled;
            if (!enabled) {
                stopEverything();
            }
        },

        parameterEdited(changed) {
            if (isDisposed || !isEnabled || manualHoldActive || !changed) {
                return;
            }
            const nowMs = deps.now();
            lastEditMs = nowMs;

            if (!sounding) {
                strikeOrDefer(nowMs, "leading");
                // A deferred leading strike still owns the burst: mark sounding
                // so further edits shape the pending strike instead of stacking
                // a second leading one.
                sounding = true;
            } else {
                switch (deps.algorithm) {
                    case "morph":
                        break;
                    case "settle":
                        dirty = true;
                        // Movement cancels a deferred restrike — nothing may
                        // land behind a finger that started moving again.
                        deferredStrikeAt = null;
                        break;
                    case "paced":
                        dirty = true;
                        break;
                    case "wrap":
                        if (!dirty && deferredStrikeAt === null) {
                            dirty = true;
                            const boundary = deps.nextLoopBoundary(nowMs);
                            if (boundary !== null && boundary > nowMs) {
                                deferredStrikeAt = boundary;
                                dirty = false;
                            }
                            // No eligible loop: the settle fallback deadline
                            // (dirty + settleMs) carries the restrike.
                        }
                        break;
                }
            }

            armTimer();
        },

        // Gesture brackets carry no extra information for these strategies —
        // the changed-edit stream is the activity signal on every control.
        gestureStarted() {},
        gestureEnded() {},

        manualHoldStarted() {
            if (isDisposed || manualHoldActive) {
                return;
            }
            manualHoldActive = true;
            if (isEnabled) {
                stopEverything();
            }
        },

        manualHoldEnded() {
            if (isDisposed || !manualHoldActive) {
                return;
            }
            manualHoldActive = false;
        },

        dispose() {
            if (isDisposed) {
                return;
            }
            if (isEnabled) {
                isEnabled = false;
                stopEverything();
            }
            cancelTimer();
            isDisposed = true;
        },
    };
}
