/**
 * The Auto-preview retrigger scheduler (T12) — pure timing policy, no notes.
 *
 * The engine layer feeds it three facts with explicit timestamps — "a canonical
 * parameter value actually changed under a user gesture", "the gesture ended",
 * "the interaction was cancelled" — plus deadline ticks, and it emits commands
 * saying WHEN to retrigger the preview and when to end it. What sounds (the
 * held chord or the remembered intentional pitch) is the engine's business.
 *
 * Locked behavior (TODOS T12, 2026-08-19):
 * - The first actual change retriggers immediately and the preview holds.
 * - While the rate window (minRetriggerIntervalMs) is closed, later changes
 *   mark one pending retrigger; it fires exactly when the window opens, which
 *   bounds continuous movement to one retrigger per window and guarantees the
 *   final changed value is heard no later than one window after its change.
 *   (The spec's movement-stopped timer is subsumed by this rule: a pending
 *   value can only exist while the window is closed, so firing at window-open
 *   always meets the trailing guarantee; movementStoppedMs stays in the config
 *   for tuning visibility.)
 * - Holding still schedules nothing further; resuming movement restarts the
 *   same cadence. A change arriving with the window open fires immediately.
 * - gestureEnded with nothing pending ends the preview. With a pending value,
 *   the trailing retrigger is preserved and fires at window-open as a
 *   self-releasing note capped at releaseNoteCapMs (no endPreview follows).
 * - cancelled ends the preview immediately, clears any pending trailing note,
 *   and leaves the scheduler reusable for the next gesture.
 *
 * Timing is caller-driven: after every call, read nextDeadline() and arrange
 * one wake-up; on wake, call tick(now). No wall clocks in here.
 */

export type AutoPreviewSchedulerConfig = {
    readonly minRetriggerIntervalMs: number;
    readonly movementStoppedMs: number;
    readonly releaseNoteCapMs: number;
};

export type AutoPreviewCommand =
    | {
        readonly kind: "retrigger";
        readonly at: number;
        /** null: hold until a later command; a number: self-release after capMs. */
        readonly capMs: number | null;
    }
    | { readonly kind: "endPreview"; readonly at: number };

export type AutoPreviewScheduler = {
    parameterChanged(now: number): ReadonlyArray<AutoPreviewCommand>;
    gestureEnded(now: number): ReadonlyArray<AutoPreviewCommand>;
    cancelled(now: number): ReadonlyArray<AutoPreviewCommand>;
    tick(now: number): ReadonlyArray<AutoPreviewCommand>;
    /** The next moment tick() must run, or null when nothing is scheduled. */
    nextDeadline(): number | null;
};

export function createAutoPreviewScheduler(config: AutoPreviewSchedulerConfig): AutoPreviewScheduler {
    type Phase = "idle" | "gesture" | "trailing";

    const noCommands: ReadonlyArray<AutoPreviewCommand> = [];
    let phase: Phase = "idle";
    // The rate window is global, not per-gesture: a new gesture starting inside
    // the previous preview's window must defer its first retrigger to window
    // open ("triggers immediately unless a prior preview is still inside the
    // rate-limit window"). A trailing capped note arms it like any retrigger.
    let lastRetriggerAt: number | null = null;
    let pendingDeadline: number | null = null;
    // Whether a held (uncapped) preview note is currently sounding, so
    // lifecycle events with nothing playing stay silent no-ops.
    let previewSounding = false;

    const windowClosed = (now: number) => (
        lastRetriggerAt !== null && now < lastRetriggerAt + config.minRetriggerIntervalMs
    );

    const retrigger = (at: number, capMs: number | null): AutoPreviewCommand => ({
        kind: "retrigger",
        at,
        capMs,
    });

    return {
        parameterChanged(now) {
            phase = "gesture";
            if (pendingDeadline !== null) {
                return noCommands;
            }
            if (windowClosed(now) && lastRetriggerAt !== null) {
                pendingDeadline = lastRetriggerAt + config.minRetriggerIntervalMs;
                return noCommands;
            }
            lastRetriggerAt = now;
            previewSounding = true;
            return [retrigger(now, null)];
        },

        gestureEnded(now) {
            if (pendingDeadline !== null) {
                phase = "trailing";
                return noCommands;
            }
            phase = "idle";
            if (!previewSounding) {
                return noCommands;
            }
            previewSounding = false;
            return [{ kind: "endPreview", at: now }];
        },

        cancelled(now) {
            phase = "idle";
            pendingDeadline = null;
            if (!previewSounding) {
                return noCommands;
            }
            previewSounding = false;
            return [{ kind: "endPreview", at: now }];
        },

        tick(now) {
            if (pendingDeadline === null || now < pendingDeadline) {
                return noCommands;
            }

            const retriggerAt = pendingDeadline;
            pendingDeadline = null;
            lastRetriggerAt = retriggerAt;

            if (phase === "trailing") {
                phase = "idle";
                // The capped note self-releases; nothing is left sounding.
                previewSounding = false;
                return [retrigger(retriggerAt, config.releaseNoteCapMs)];
            }

            previewSounding = true;
            return [retrigger(retriggerAt, null)];
        },

        nextDeadline() {
            return pendingDeadline;
        },
    };
}
