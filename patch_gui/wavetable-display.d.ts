export class CanvasWavetableDisplay {
    constructor(canvas: HTMLCanvasElement);
    setFrames(frames: Float32Array[] | null): void;
    setPosition(position: number): void;
    resize(width: number, height: number, devicePixelRatio: number): void;
}
