declare module "../../patch_gui/wavetable-display.js" {
    export class CanvasWavetableDisplay {
        constructor(
            canvas: HTMLCanvasElement,
            options?: {
                theme?: unknown;
                requestAnimationFrame?: (callback: FrameRequestCallback) => number;
                cancelAnimationFrame?: (handle: number) => void;
                paintBackground?: boolean;
                showSliceCaption?: boolean;
            },
        );
        invalidateStaticScene(): void;
        setFrames(frames: ArrayLike<ArrayLike<number>>): void;
        setPosition(position: number): void;
        setWarp(mode: number, amount: number): void;
        setDrawableInsets(insets?: { top?: number; right?: number; bottom?: number; left?: number }): void;
        resize(width?: number, height?: number, devicePixelRatio?: number): void;
        getStaticScene(width: number, height: number): unknown;
        queueRender(): void;
        render(): void;
    }
}
