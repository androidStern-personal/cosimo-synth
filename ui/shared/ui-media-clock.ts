/** Media-time seam for UI smoothing that must be reproducible in captures. */

export type UiMediaClock = {
    now(): number;
    requestAnimationFrame(callback: (timestamp: number) => void): number;
    cancelAnimationFrame(handle: number): void;
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
    if (activeClock !== null) {
        activeClock.cancelAnimationFrame(handle);
        return;
    }
    window.cancelAnimationFrame(handle);
}
