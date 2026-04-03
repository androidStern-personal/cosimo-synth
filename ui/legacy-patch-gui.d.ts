declare module "../../patch_gui/wavetable-bank.js" {
    export function loadFactoryBankCatalogFromPatch(patchConnection: unknown): Promise<{
        tables: Array<{
            tableId: string;
            name: string;
            frameCount: number;
            sourceWav: string;
        }>;
    }>;

    export function loadFactoryBankFramesFromPatch(
        patchConnection: unknown,
        options: { tableIndex: number },
    ): Promise<{
        frames: Float32Array[];
        frameCount: number;
        sampleRate: number;
        samples: Float32Array;
        sampleBlobPath: string;
    }>;
}

declare module "../../patch_gui/mseg-controller.js" {
    export class MsegController {
        constructor(
            patchConnection: unknown,
            options?: {
                onStateChange?: (state: unknown) => void;
            },
        );

        attach(): void;
        detach(): void;
        requestBootState(): void;
        getState(): {
            shape: {
                points: Array<{ x: number; y: number; curvePower: number }>;
            };
            playback: {
                rate: {
                    seconds: number;
                };
                loop: { startX: number; endX: number } | null;
            };
            depth: number;
        };
        setPlayback(nextPlayback: unknown): void;
        setDepth(nextDepth: unknown): void;
        addPoint(x: number, y: number): void;
        movePoint(pointIndex: number, x: number, y: number): void;
        deletePoint(pointIndex: number): void;
    }
}

declare module "../../patch_gui/mseg.js" {
    export const MSEG_EDITOR_HORIZONTAL_PADDING_PX: number;
    export const MSEG_EDITOR_VERTICAL_PADDING_PX: number;
    export const MSEG_POINT_RADIUS_PX: number;
    export const MSEG_SELECTED_POINT_RADIUS_PX: number;
    export const MSEG_RATE_MIN_SECONDS: number;
    export const MSEG_RATE_MAX_SECONDS: number;

    export function clampMsegRateSeconds(value: unknown): number;
    export function createMsegEditorMetrics(
        width: number,
        height: number,
        options?: {
            pointRadius?: number;
            horizontalPadding?: number;
            verticalPadding?: number;
            orientation?: "horizontal" | "vertical";
        },
    ): {
        plotLeft: number;
        plotRight: number;
        plotTop: number;
        plotBottom: number;
        plotWidth: number;
        plotHeight: number;
    };
    export function evaluateMsegShape(
        shape: { points: Array<{ x: number; y: number; curvePower: number }> },
        x: number,
    ): number;
    export function findMsegPointHitIndex(
        shape: { points: Array<{ x: number; y: number; curvePower: number }> },
        editorX: number,
        editorY: number,
        width: number,
        height: number,
        hitRadius?: number,
        editorOptions?: {
            pointRadius?: number;
            horizontalPadding?: number;
            verticalPadding?: number;
            orientation?: "horizontal" | "vertical";
        },
    ): number;
    export function msegEditorCoordinatesToPoint(
        editorX: number,
        editorY: number,
        width: number,
        height: number,
        options?: {
            pointRadius?: number;
            horizontalPadding?: number;
            verticalPadding?: number;
            orientation?: "horizontal" | "vertical";
        },
    ): { x: number; y: number };
    export function pointToMsegEditorCoordinates(
        point: { x: number; y: number },
        width: number,
        height: number,
        options?: {
            pointRadius?: number;
            horizontalPadding?: number;
            verticalPadding?: number;
            orientation?: "horizontal" | "vertical";
        },
    ): { x: number; y: number };
}

declare module "../../patch_gui/wavetable-display.js" {
    export class CanvasWavetableDisplay {
        constructor(canvas: HTMLCanvasElement);
        setFrames(frames: Float32Array[]): void;
        setPosition(position: number): void;
        setWarp(mode: number, amount: number): void;
        resize(width: number, height: number, devicePixelRatio: number): void;
    }
}
