/** Media-time seam for UI smoothing that must be reproducible in captures. */

export type UiMediaClock = {
    now(): number;
    /** Driver handles are negative so they can never collide with native rAF handles. */
    requestAnimationFrame(callback: (timestamp: number) => void): number;
    /** Return true when the handle belongs to this clock. */
    cancelAnimationFrame(handle: number): boolean;
};

let activeClock: UiMediaClock | null = null;

export function installUiMediaClock(clock: UiMediaClock): () => void {
    const previous = activeClock;
    activeClock = clock;
    let restored = false;
    return () => {
        if (restored) return;
        restored = true;
        if (activeClock === clock) activeClock = previous;
    };
}

export function hasUiMediaClock(): boolean {
    return activeClock !== null;
}

export function uiMediaTimeNow(): number {
    return activeClock?.now() ?? performance.now();
}

export function uiMediaRequestAnimationFrame(
    callback: (timestamp: number) => void,
): number {
    return activeClock?.requestAnimationFrame(callback)
        ?? window.requestAnimationFrame(callback);
}

export function uiMediaCancelAnimationFrame(handle: number): void {
    if (activeClock?.cancelAnimationFrame(handle)) return;
    window.cancelAnimationFrame(handle);
}
