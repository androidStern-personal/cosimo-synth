export type CanvasWavetableDisplayOptions = {
    theme?: unknown;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
    /** ADR-024 compact seams; both default true to preserve the desktop drawing. */
    paintBackground?: boolean;
    showSliceCaption?: boolean;
};

export class CanvasWavetableDisplay {
    constructor(canvas: HTMLCanvasElement, options?: CanvasWavetableDisplayOptions);
    setFrames(frames: Float32Array[] | null): void;
    setPosition(position: number): void;
    setWarp(mode: number, amount: number): void;
    setDrawableInsets(insets?: { top?: number; right?: number; bottom?: number; left?: number }): void;
    resize(width: number, height: number, devicePixelRatio: number): void;
}
