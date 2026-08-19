/**
 * The Auto-preview loop-sync quantizer (T12B) — pure strike-time math.
 *
 * When a retrigger is due and an eligible looping MSEG is sounding, the strike
 * defers to the loop's grid instead of firing mid-cycle. MSEGs run per voice
 * and restart at note-on, so the loop's phase is anchored at a note-on time JS
 * observed itself; boundaries are anchor + k * period. Everything stateful
 * (which slot is eligible, anchor bookkeeping, timers, the kill-switch) lives
 * in the note layer — this module answers one question deterministically:
 * given a due strike, WHEN should it land?
 *
 * Contract (pinned by tests/test_auto_preview_sync.mjs):
 * - No source, an invalid period/anchor (non-finite, period <= 0, anchor in
 *   the future), or a period under minSyncPeriodMs: strike immediately (the
 *   loop is texture, not rhythm, and jitter would swamp "sync").
 * - The wait budget depends on the strike kind: leading strikes use
 *   waitBudgetLeadingMs (responsiveness dominates), in-motion and trailing
 *   strikes use waitBudgetOtherMs (rhythm dominates).
 * - Sweet band (period <= budget): defer to the next cycle boundary
 *   anchor + k * period at or after now. A strike exactly on a boundary fires
 *   immediately.
 * - Slow loops (period > budget) follow config.slowLoopPolicy:
 *   - "opportunistic": defer only when the next cycle boundary is within the
 *     budget; otherwise strike immediately.
 *   - "subdivision": quantize to the loop's binary grid period / 2^k, using
 *     the finest grid interval that fits the budget. If that interval would
 *     fall below minSubdivisionMs, fall back to opportunistic against the
 *     next-coarser grid (which exceeds the budget only when the boundary is
 *     far, exactly the case opportunistic handles).
 * - The returned time is always >= now, and never more than budget past now.
 */

export type AutoPreviewStrikeKind = "leading" | "inMotion" | "trailing";

export type LoopSyncSource = {
    /** Loop-region cycle period in ms: (endX - startX) * rate.seconds * 1000. */
    readonly periodMs: number;
    /** Note-on time (same clock as now) anchoring the sounding loop's phase. */
    readonly anchorMs: number;
};

export type StrikeQuantizerConfig = {
    readonly minSyncPeriodMs: number;
    readonly waitBudgetLeadingMs: number;
    readonly waitBudgetOtherMs: number;
    readonly minSubdivisionMs: number;
    readonly slowLoopPolicy: "opportunistic" | "subdivision";
};

/** T12B starting numbers; tuned on the phone alongside the T12 cadence. */
export const AUTO_PREVIEW_SYNC_CONFIG: StrikeQuantizerConfig = {
    minSyncPeriodMs: 120,
    waitBudgetLeadingMs: 150,
    waitBudgetOtherMs: 300,
    minSubdivisionMs: 120,
    slowLoopPolicy: "subdivision",
};

function nextGridBoundary(now: number, anchor: number, intervalMs: number): number {
    return anchor + (Math.ceil((now - anchor) / intervalMs) * intervalMs);
}

export function quantizeStrikeTime(input: {
    readonly now: number;
    readonly kind: AutoPreviewStrikeKind;
    readonly source: LoopSyncSource | null;
    readonly config: StrikeQuantizerConfig;
}): number {
    const { now, kind, source, config } = input;

    if (
        source === null
        || !Number.isFinite(source.periodMs)
        || !Number.isFinite(source.anchorMs)
        || source.periodMs < config.minSyncPeriodMs
        || source.anchorMs > now
    ) {
        return now;
    }

    const budget = kind === "leading" ? config.waitBudgetLeadingMs : config.waitBudgetOtherMs;

    if (source.periodMs <= budget) {
        return nextGridBoundary(now, source.anchorMs, source.periodMs);
    }

    if (config.slowLoopPolicy === "opportunistic") {
        const boundary = nextGridBoundary(now, source.anchorMs, source.periodMs);
        return boundary - now <= budget ? boundary : now;
    }

    // Subdivision: halve down to the finest binary grid still at or above the
    // floor; use it when it also fits the budget.
    let interval = source.periodMs;
    while (interval / 2 >= config.minSubdivisionMs) {
        interval /= 2;
    }
    if (interval <= budget) {
        return nextGridBoundary(now, source.anchorMs, interval);
    }

    // No grid fits both the budget and the floor: opportunistic against the
    // coarser grid that remained.
    const boundary = nextGridBoundary(now, source.anchorMs, interval);
    return boundary - now <= budget ? boundary : now;
}
