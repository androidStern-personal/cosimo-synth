declare module "../../patch_gui/wavetable-display.js" {
    export class CanvasWavetableDisplay {
        constructor(
            canvas: HTMLCanvasElement,
            options?: {
                theme?: unknown;
                requestAnimationFrame?: (callback: FrameRequestCallback) => number;
                cancelAnimationFrame?: (handle: number) => void;
            },
        );
        invalidateStaticScene(): void;
        setFrames(frames: ArrayLike<ArrayLike<number>>): void;
        setPosition(position: number): void;
        resize(width?: number, height?: number, devicePixelRatio?: number): void;
        getStaticScene(width: number, height: number): unknown;
        queueRender(): void;
        render(): void;
    }
}
