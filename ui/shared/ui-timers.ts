/**
 * Decorative UI timeout seam.
 *
 * Product callers retain native browser timing. The scripted video iframe
 * installs a media-time driver for only these UI callbacks; global timers used
 * by Remotion, WebCodecs, and the encoder are never virtualized.
 */

export type UiTimeoutDriver = {
    setTimeout(callback: () => void, delayMilliseconds: number): number;
    /** Return true when the handle belongs to this driver. */
    clearTimeout(handle: number): boolean;
};

let activeDriver: UiTimeoutDriver | null = null;

export function installUiTimeoutDriver(driver: UiTimeoutDriver): () => void {
    const previous = activeDriver;
    activeDriver = driver;
    let restored = false;
    return () => {
        if (restored) return;
        restored = true;
        if (activeDriver === driver) activeDriver = previous;
    };
}

export function uiTimeout(callback: () => void, delayMilliseconds: number): number {
    if (activeDriver !== null) {
        return activeDriver.setTimeout(callback, delayMilliseconds);
    }
    return window.setTimeout(callback, delayMilliseconds);
}

export function clearUiTimeout(handle: number): void {
    if (activeDriver?.clearTimeout(handle)) return;
    window.clearTimeout(handle);
}
