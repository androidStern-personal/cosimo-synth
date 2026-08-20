import { createDefaultWavetableTheme, type RGBColor, type WavetableTheme } from "./theme";

type Vec3 = { x: number; y: number; z: number };

type Camera = {
    position: Vec3;
    target: Vec3;
    forward: Vec3;
    right: Vec3;
    up: Vec3;
};

type ViewportPadding = { left: number; right: number; top: number; bottom: number };

type DrawableViewport = { x: number; y: number; width: number; height: number };

export type WavetableDrawableInsets = { top?: number; right?: number; bottom?: number; left?: number };

type Projection = {
    width: number;
    height: number;
    drawable: DrawableViewport;
    scale: number;
    scaleX: number;
    scaleY: number;
    padding: ViewportPadding;
    projectedCenterX: number;
    projectedCenterY: number;
    centerX: number;
    centerY: number;
};

type ProjectedPoint = { projectedX: number; projectedY: number; cameraDepth: number; perspective: number };

type ScreenPoint = { x: number; y: number; cameraDepth: number; perspective: number };

type ProjectedFramePoint = ScreenPoint & { objectPoint: Vec3 };

type ProjectedFrame = {
    frameIndex: number;
    depth: number;
    depthNormalized: number;
    samples: Float32Array;
    objectPoints: Vec3[];
    points: ProjectedFramePoint[];
    averageCameraDepth: number;
};

type GuideLine = { kind: "frame" | "guide"; strength: number; points: ScreenPoint[] };

type ContourDescriptor = {
    frameIndex: number;
    depthNormalized: number;
    points: ProjectedFramePoint[];
    segments: ProjectedFramePoint[][];
    samples: Float32Array;
    averageCameraDepth: number;
    lineWidth: number;
    alpha: number;
    colourMix: number;
};

type SurfaceBand = {
    frameLo: number;
    frameHi: number;
    sampleIndex: number;
    points: ProjectedFramePoint[];
    averageCameraDepth: number;
    depthNormalized: number;
    slopeLight: number;
    ridgeAmount: number;
};

type SurfaceRib = { sampleIndex: number; points: ProjectedFramePoint[]; averageDepth: number; alpha: number };

type SurfaceSlice = {
    frameIndex: number;
    depthNormalized: number;
    samples: Float32Array;
    points: ScreenPoint[];
    segments: ScreenPoint[][];
    averageDepth: number;
    alpha: number;
};

export type WavetableFrameState = {
    frameCount: number;
    position: number;
    frameIndex: number;
    frameLo: number;
    frameHi: number;
    frameT: number;
    warpMode: number;
    warpAmount: number;
};

type CurrentSlice = {
    frameState: WavetableFrameState;
    samples: Float32Array;
    points: ScreenPoint[];
    segments: ScreenPoint[][];
    floorPoints: ScreenPoint[];
    label: { text: string; x: number; y: number };
    lineWidth: number;
    glowBlur: number;
};

export type WavetableFrameInput = Float32Array | number[];

export type WavetableStaticScene = {
    width: number;
    height: number;
    pixelRatio: number;
    drawableInsets: WavetableDrawableInsets;
    frameCount: number;
    camera: Camera;
    contourPointCount: number;
    surfacePointCount: number;
    projection: Projection;
    contourFrames: ProjectedFrame[];
    surfaceFrames: ProjectedFrame[];
    surfaceBands: SurfaceBand[];
    surfaceRibs: SurfaceRib[];
    surfaceSlices: SurfaceSlice[];
    guideLines: GuideLine[];
};

export type WavetableRenderModel = WavetableStaticScene & {
    frameState: WavetableFrameState;
    contours: ContourDescriptor[];
    currentSlice: CurrentSlice;
};

/**
 * T02C: the selected source's possible Index travel, shaded onto the graphic.
 * Positions use the Index parameter's normalized 0..1 axis; the caller owns
 * the canonical route projection (mobile-voice-rail-projection) and passes
 * only its already-clamped result.
 */
export type WavetableModulationRangeOverlay = {
    readonly lowPosition: number;
    readonly highPosition: number;
    readonly color: RGBColor;
};

export type WavetableDrawOptions = {
    paintBackground?: boolean;
    showSliceCaption?: boolean;
    modulationRange?: WavetableModulationRangeOverlay | null;
};

export type WavetableRenderContext = {
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    shadowBlur: number;
    shadowColor: string;
    font: string;
    textAlign: CanvasTextAlign;
    clearRect(x: number, y: number, width: number, height: number): void;
    fillRect(x: number, y: number, width: number, height: number): void;
    save(): void;
    restore(): void;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    fill(): void;
    fillText(text: string, x: number, y: number): void;
    createLinearGradient?(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
    strokeRect?(x: number, y: number, width: number, height: number): void;
    closePath?(): void;
};

export type CanvasWavetableDisplayOptions = {
    theme?: WavetableTheme;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
    paintBackground?: boolean;
    showSliceCaption?: boolean;
};

const CAMERA_YAW = 15 * (Math.PI / 180);
const CAMERA_PITCH = 26 * (Math.PI / 180);
const CAMERA_DISTANCE = 10.5;
const CAMERA_FOCAL_LENGTH = 2.4;
const FRAME_DEPTH_EXTENT = 3.6;
const STAGE_FIT_X_SCALE = 1.3;
const AMPLITUDE_SCALE = 0.3;
const DISCONTINUITY_THRESHOLD = 0.5;
const FLOOR_Y = -0.64;
const GUIDE_TOP_Y = 0.28;
const WARP_MODE_OFF = 0;
const WARP_MODE_BEND = 1;
const WARP_MODE_PWM = 2;
const WARP_MODE_ASYM = 3;
const WARP_MODE_MIRROR = 4;

export const DEFAULT_WAVETABLE_THEME = createDefaultWavetableTheme();

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function requestNextAnimationFrame(callback: FrameRequestCallback): number {
    if (typeof globalThis.requestAnimationFrame === "function") {
        return globalThis.requestAnimationFrame(callback);
    }

    return setTimeout(() => callback(Date.now()), 0);
}

function cancelNextAnimationFrame(handle: number): void {
    if (typeof globalThis.cancelAnimationFrame === "function") {
        globalThis.cancelAnimationFrame(handle);
        return;
    }

    clearTimeout(handle);
}

function lerp(start: number, end: number, amount: number): number {
    return start + ((end - start) * amount);
}

/**
 * T02C tint strengths: a hue shift only, strong enough to read on thin
 * low-alpha lines while the depth fade and lighting stay untouched.
 */
const MODULATION_OVERLAY_LINE_MIX = 0.6;
const MODULATION_OVERLAY_SKIN_MIX = 0.55;
const MODULATION_OVERLAY_EPSILON = 1e-6;

function mixRGB(from: RGBColor, to: RGBColor, amount: number): RGBColor {
    return [
        Math.round(lerp(from[0], to[0], amount)),
        Math.round(lerp(from[1], to[1], amount)),
        Math.round(lerp(from[2], to[2], amount)),
    ];
}

function toRGBA(rgb: RGBColor, alpha: number): string {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}

function assertFrames(frames: WavetableFrameInput[] | null | undefined): asserts frames is WavetableFrameInput[] {
    if (!Array.isArray(frames) || frames.length === 0) {
        throw new Error("frames must be a non-empty array of sample arrays");
    }

    const expectedLength = frames[0].length;

    for (const frame of frames) {
        if (!(frame instanceof Float32Array) && !Array.isArray(frame)) {
            throw new Error("every frame must be an array-like set of samples");
        }

        if (frame.length !== expectedLength) {
            throw new Error("all frames must have the same sample count");
        }
    }
}

function resolveWarpMode(rawMode: number): number {
    return clamp(Math.round(Number(rawMode) || 0), WARP_MODE_OFF, WARP_MODE_MIRROR);
}

function isIdentityWarp(warpMode: number, warpAmount: number): boolean {
    const clampedAmount = clamp(Number(warpAmount) || 0, 0, 1);

    if (warpMode <= WARP_MODE_OFF) {
        return true;
    }

    if (warpMode === WARP_MODE_BEND) {
        return Math.abs(clampedAmount - 0.5) <= 0.000001;
    }

    if (warpMode === WARP_MODE_PWM) {
        return clampedAmount <= 0.000001;
    }

    if (warpMode === WARP_MODE_ASYM) {
        return Math.abs(clampedAmount - 0.5) <= 0.000001;
    }

    if (warpMode === WARP_MODE_MIRROR) {
        return false;
    }

    return true;
}

function curvedWarpRight(phase: number, amount: number): number {
    const clampedPhase = clamp(Number(phase) || 0, 0, 1);
    const clampedAmount = clamp(Number(amount) || 0, 0, 1);
    const exponent = Math.pow(2, 4 * clampedAmount);
    return Math.pow(clampedPhase, exponent);
}

function curvedWarpLeft(phase: number, amount: number): number {
    const clampedPhase = clamp(Number(phase) || 0, 0, 1);
    const clampedAmount = clamp(Number(amount) || 0, 0, 1);
    const exponent = Math.pow(2, 4 * clampedAmount);
    return 1 - Math.pow(1 - clampedPhase, exponent);
}

function curvedAsymSigned(phase: number, dial: number): number {
    const clampedDial = clamp(Number(dial) || 0, 0, 1);
    const signedAmount = (2 * clampedDial) - 1;
    const magnitude = Math.abs(signedAmount);
    return signedAmount >= 0
        ? curvedWarpRight(phase, magnitude)
        : curvedWarpLeft(phase, magnitude);
}

function linearSkewSigned(phase: number, dial: number): number {
    const clampedPhase = clamp(Number(phase) || 0, 0, 1);
    const clampedDial = clamp(Number(dial) || 0, 0, 1);
    const signedAmount = (2 * clampedDial) - 1;
    const split = clamp(0.5 + (0.48 * signedAmount), 0.02, 0.98);

    if (clampedPhase < split) {
        return 0.5 * (clampedPhase / split);
    }

    return 0.5 + (0.5 * ((clampedPhase - split) / (1 - split)));
}

function mirrorBasePhase(phase: number): number {
    const clampedPhase = clamp(Number(phase) || 0, 0, 1);

    if (clampedPhase < 0.5) {
        return clampedPhase * 2;
    }

    return 2 - (2 * clampedPhase);
}

function pwmActivePortion(amount: number): number {
    const clampedAmount = clamp(Number(amount) || 0, 0, 1);
    return 1 - ((1 - 0.02) * clampedAmount);
}

function resolveDisplayWarpPhase(warpMode: number, warpAmount: number, phase: number): { shouldLookup: boolean; phase: number } {
    const clampedPhase = clamp(Number(phase) || 0, 0, 1);
    const result = {
        shouldLookup: true,
        phase: clampedPhase,
    };

    if (warpMode <= WARP_MODE_OFF || clampedPhase >= 1) {
        return result;
    }

    const clampedAmount = clamp(Number(warpAmount) || 0, 0, 1);

    if (warpMode === WARP_MODE_BEND) {
        const invertedDial = 1 - clampedAmount;

        if (clampedPhase < 0.5) {
            result.phase = 0.5 * curvedAsymSigned(clampedPhase * 2, invertedDial);
        } else {
            result.phase = 1 - (0.5 * curvedAsymSigned(2 - (2 * clampedPhase), invertedDial));
        }

        return result;
    }

    if (warpMode === WARP_MODE_PWM) {
        const activePortion = pwmActivePortion(clampedAmount);

        if (clampedPhase < activePortion) {
            result.phase = clampedPhase / activePortion;
        } else {
            result.phase = 1;
        }

        return result;
    }

    if (warpMode === WARP_MODE_ASYM) {
        result.phase = linearSkewSigned(clampedPhase, clampedAmount);
        return result;
    }

    if (warpMode === WARP_MODE_MIRROR) {
        result.phase = linearSkewSigned(mirrorBasePhase(clampedPhase), clampedAmount);
        return result;
    }

    return result;
}

function sampleDisplayFrame(frame: Float32Array, phase: number): number {
    const safePhase = clamp(Number(phase) || 0, 0, 1);
    const frameLength = frame.length;

    if (frameLength === 0) {
        return 0;
    }

    if (frameLength === 1 || safePhase >= 1) {
        return frame[frameLength - 1];
    }

    const samplePosition = safePhase * (frameLength - 1);
    const sampleIndex = Math.floor(samplePosition);
    const sampleT = samplePosition - sampleIndex;
    const nextIndex = Math.min(sampleIndex + 1, frameLength - 1);
    return lerp(frame[sampleIndex], frame[nextIndex], sampleT);
}

function buildWarpedFrame(lowFrame: Float32Array, highFrame: Float32Array, amount: number, warpMode: number, warpAmount: number): Float32Array {
    const output = new Float32Array(lowFrame.length);
    const denominator = Math.max(1, lowFrame.length - 1);

    for (let sampleIndex = 0; sampleIndex < lowFrame.length; sampleIndex += 1) {
        const phase = sampleIndex / denominator;
        const warpedPhase = resolveDisplayWarpPhase(warpMode, warpAmount, phase);

        if (!warpedPhase.shouldLookup) {
            output[sampleIndex] = 0;
            continue;
        }

        const lowSample = sampleDisplayFrame(lowFrame, warpedPhase.phase);
        const highSample = sampleDisplayFrame(highFrame, warpedPhase.phase);
        output[sampleIndex] = lerp(lowSample, highSample, amount);
    }

    return output;
}

function getFrameDepth(frameIndex: number, frameCount: number): number {
    if (frameCount <= 1) {
        return 0;
    }

    return (frameIndex / (frameCount - 1)) * FRAME_DEPTH_EXTENT;
}

function getSceneDepth(frameIndex: number, frameCount: number): number {
    return getFrameDepth(frameIndex, frameCount);
}

function getBackness(frameIndex: number, frameCount: number): number {
    if (frameCount <= 1) {
        return 0;
    }

    return frameIndex / (frameCount - 1);
}

function getSceneDepthAt(frameIndex: number, frameCount: number): number {
    if (frameCount <= 1) {
        return FRAME_DEPTH_EXTENT * 0.5;
    }

    return (frameIndex / (frameCount - 1)) * FRAME_DEPTH_EXTENT;
}

function getBacknessAt(frameIndex: number, frameCount: number): number {
    if (frameCount <= 1) {
        return 0;
    }

    return frameIndex / (frameCount - 1);
}

function subtractPoints(a: Vec3, b: Vec3): Vec3 {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
    };
}

function crossProduct(a: Vec3, b: Vec3): Vec3 {
    return {
        x: (a.y * b.z) - (a.z * b.y),
        y: (a.z * b.x) - (a.x * b.z),
        z: (a.x * b.y) - (a.y * b.x),
    };
}

function dotProduct(a: Vec3, b: Vec3): number {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function normaliseVector(vector: Vec3): Vec3 {
    const magnitude = Math.hypot(vector.x, vector.y, vector.z);

    if (magnitude < 0.00001) {
        return { x: 0, y: 1, z: 0 };
    }

    return {
        x: vector.x / magnitude,
        y: vector.y / magnitude,
        z: vector.z / magnitude,
    };
}

function createCamera(): Camera {
    const target = {
        x: 0,
        y: FLOOR_Y,
        z: FRAME_DEPTH_EXTENT * 0.5,
    };
    const horizontalDistance = Math.cos(CAMERA_PITCH) * CAMERA_DISTANCE;
    const position = {
        x: target.x + (Math.sin(CAMERA_YAW) * horizontalDistance),
        y: target.y + (Math.sin(CAMERA_PITCH) * CAMERA_DISTANCE),
        z: target.z - (Math.cos(CAMERA_YAW) * horizontalDistance),
    };
    const worldUp = { x: 0, y: 1, z: 0 };
    const forward = normaliseVector(subtractPoints(target, position));
    const right = normaliseVector(crossProduct(worldUp, forward));
    const up = normaliseVector(crossProduct(forward, right));

    return {
        position,
        target,
        forward,
        right,
        up,
    };
}

function createViewportPadding(width: number, height: number): ViewportPadding {
    return {
        left: clamp(width * 0.06, 22, 48),
        right: clamp(width * 0.06, 22, 48),
        top: clamp(height * 0.1, 20, 56),
        bottom: clamp(height * 0.09, 20, 52),
    };
}

function createDrawableViewport(width: number, height: number, insets: WavetableDrawableInsets = {}): DrawableViewport {
    const left = clamp(Number(insets.left) || 0, 0, width - 1);
    const right = clamp(Number(insets.right) || 0, 0, width - left - 1);
    const top = clamp(Number(insets.top) || 0, 0, height - 1);
    const bottom = clamp(Number(insets.bottom) || 0, 0, height - top - 1);

    return {
        x: left,
        y: top,
        width: Math.max(1, width - left - right),
        height: Math.max(1, height - top - bottom),
    };
}

function projectWorldPoint(point: Vec3, camera: Camera): ProjectedPoint {
    const relative = subtractPoints(point, camera.position);
    const cameraX = dotProduct(relative, camera.right);
    const cameraY = dotProduct(relative, camera.up);
    const cameraDepth = Math.max(0.001, dotProduct(relative, camera.forward));
    const perspective = CAMERA_FOCAL_LENGTH / cameraDepth;

    return {
        projectedX: cameraX * perspective,
        projectedY: cameraY * perspective,
        cameraDepth,
        perspective,
    };
}

function projectToScreen(projectedPoint: ProjectedPoint, projection: Projection): ScreenPoint {
    const scaleX = projection.scaleX ?? projection.scale;
    const scaleY = projection.scaleY ?? projection.scale;

    return {
        x: projection.centerX + ((projectedPoint.projectedX - projection.projectedCenterX) * scaleX),
        y: projection.centerY - ((projectedPoint.projectedY - projection.projectedCenterY) * scaleY),
        cameraDepth: projectedPoint.cameraDepth,
        perspective: projectedPoint.perspective,
    };
}

function createProjection(points: ProjectedPoint[], width: number, height: number, drawableInsets: WavetableDrawableInsets = {}): Projection {
    const drawable = createDrawableViewport(width, height, drawableInsets);
    const padding = createViewportPadding(drawable.width, drawable.height);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const point of points) {
        minX = Math.min(minX, point.projectedX);
        maxX = Math.max(maxX, point.projectedX);
        minY = Math.min(minY, point.projectedY);
        maxY = Math.max(maxY, point.projectedY);
    }

    const spanX = Math.max(0.001, maxX - minX);
    const spanY = Math.max(0.001, maxY - minY);
    const scale = Math.min(
        (drawable.width - padding.left - padding.right) / spanX,
        (drawable.height - padding.top - padding.bottom) / spanY
    );

    return {
        width,
        height,
        drawable,
        scale,
        scaleX: scale * STAGE_FIT_X_SCALE,
        scaleY: scale,
        padding,
        projectedCenterX: (minX + maxX) * 0.5,
        projectedCenterY: (minY + maxY) * 0.5,
        centerX: drawable.x + (drawable.width * 0.5),
        centerY: drawable.y + (drawable.height * 0.5),
    };
}

function getSurfacePointCount(width: number, sampleCount: number): number {
    return clamp(Math.round(width / 10), 64, Math.min(128, sampleCount));
}

function getContourPointCount(width: number, sampleCount: number): number {
    return clamp(Math.round(width / 4), 128, Math.min(256, sampleCount));
}

function createObjectPoints(samples: Float32Array, depth: number): Vec3[] {
    const points: Vec3[] = new Array(samples.length);
    const denominator = Math.max(1, samples.length - 1);

    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
        const phase = sampleIndex / denominator;

        points[sampleIndex] = {
            x: lerp(-1, 1, phase),
            y: samples[sampleIndex] * AMPLITUDE_SCALE,
            z: depth,
        };
    }

    return points;
}

function createProjectedFrame(samples: Float32Array, frameIndex: number, frameCount: number, camera: Camera, projection: Projection): ProjectedFrame {
    const depth = getSceneDepth(frameIndex, frameCount);
    const objectPoints = createObjectPoints(samples, depth);
    const points = objectPoints.map((point) => {
        const projectedPoint = projectWorldPoint(point, camera);

        return {
            ...projectToScreen(projectedPoint, projection),
            objectPoint: point,
        };
    });

    return {
        frameIndex,
        depth,
        depthNormalized: getBackness(frameIndex, frameCount),
        samples,
        objectPoints,
        points,
        averageCameraDepth:
            points.reduce((total, point) => total + point.cameraDepth, 0) / Math.max(points.length, 1),
    };
}

function createGuideLine(pointList: Vec3[], camera: Camera, projection: Projection): ScreenPoint[] {
    return pointList.map((point) => {
        const projectedPoint = projectWorldPoint(point, camera);

        return projectToScreen(projectedPoint, projection);
    });
}

function createGuideLines(camera: Camera, projection: Projection): GuideLine[] {
    const frontFloor = [
        { x: -1, y: FLOOR_Y, z: 0 },
        { x: 1, y: FLOOR_Y, z: 0 },
    ];
    const backFloor = [
        { x: -1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
        { x: 1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
    ];
    const leftEdge = [
        { x: -1, y: FLOOR_Y, z: 0 },
        { x: -1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
    ];
    const rightEdge = [
        { x: 1, y: FLOOR_Y, z: 0 },
        { x: 1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
    ];
    const centreDepth = [
        { x: 0, y: FLOOR_Y, z: 0 },
        { x: 0, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
    ];
    const zeroPlane = [
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
    ];
    const topFront = [
        { x: -1, y: GUIDE_TOP_Y, z: 0 },
        { x: 1, y: GUIDE_TOP_Y, z: 0 },
    ];
    const topBack = [
        { x: -1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT },
        { x: 1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT },
    ];
    const topLeft = [
        { x: -1, y: GUIDE_TOP_Y, z: 0 },
        { x: -1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT },
    ];
    const topRight = [
        { x: 1, y: GUIDE_TOP_Y, z: 0 },
        { x: 1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT },
    ];

    return [
        { kind: "frame", strength: 0.78, points: createGuideLine(frontFloor, camera, projection) },
        { kind: "frame", strength: 0.7, points: createGuideLine(backFloor, camera, projection) },
        { kind: "frame", strength: 0.52, points: createGuideLine(leftEdge, camera, projection) },
        { kind: "frame", strength: 0.52, points: createGuideLine(rightEdge, camera, projection) },
        { kind: "guide", strength: 0.28, points: createGuideLine(centreDepth, camera, projection) },
        { kind: "guide", strength: 0.36, points: createGuideLine(zeroPlane, camera, projection) },
        { kind: "frame", strength: 0.28, points: createGuideLine(topFront, camera, projection) },
        { kind: "frame", strength: 0.2, points: createGuideLine(topBack, camera, projection) },
        { kind: "frame", strength: 0.18, points: createGuideLine(topLeft, camera, projection) },
        { kind: "frame", strength: 0.18, points: createGuideLine(topRight, camera, projection) },
    ];
}

function buildProjectionFromFrames(contourSamples: Float32Array[], width: number, height: number, frameCount: number, drawableInsets: WavetableDrawableInsets = {}): { camera: Camera; projection: Projection } {
    const camera = createCamera();
    const stableWorldPoints = [
        { x: -1, y: FLOOR_Y, z: 0 },
        { x: 1, y: FLOOR_Y, z: 0 },
        { x: -1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
        { x: 1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: FRAME_DEPTH_EXTENT },
        { x: 1, y: 0, z: FRAME_DEPTH_EXTENT },
        { x: -1, y: GUIDE_TOP_Y, z: 0 },
        { x: 1, y: GUIDE_TOP_Y, z: 0 },
        { x: -1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT },
        { x: 1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT },
    ];
    const projectedAnchors = stableWorldPoints.map((point) => projectWorldPoint(point, camera));

    return {
        camera,
        projection: createProjection(projectedAnchors, width, height, drawableInsets),
    };
}

function getSparseContourIndices(frameCount: number, frameState: WavetableFrameState): number[] {
    const contourIndices = new Set([0, frameCount - 1, frameState.frameLo, frameState.frameHi]);

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 4) {
        contourIndices.add(frameIndex);
    }

    return [...contourIndices].sort((left, right) => left - right);
}

function createContourDescriptors(projectedFrames: ProjectedFrame[], frameState: WavetableFrameState): ContourDescriptor[] {
    return getSparseContourIndices(projectedFrames.length, frameState).map((frameIndex) => {
        const frame = projectedFrames[frameIndex];
        const distance = Math.abs(frameState.frameIndex - frameIndex);
        const proximity = Math.max(0, 1 - (distance / 5.5));
        const frontFactor = 1 - frame.depthNormalized;

        return {
            frameIndex,
            depthNormalized: frame.depthNormalized,
            points: frame.points,
            segments: createPolylineSegments(frame.points, frame.samples),
            samples: frame.samples,
            averageCameraDepth: frame.averageCameraDepth,
            lineWidth: lerp(0.45, 0.9, frontFactor) + (proximity * 0.1),
            alpha: lerp(0.03, 0.09, frontFactor) * lerp(0.84, 1.0, proximity),
            colourMix: lerp(0.58, 0.9, frame.depthNormalized) - (proximity * 0.04),
        };
    });
}

function createSurfaceBands(projectedFrames: ProjectedFrame[]): SurfaceBand[] {
    const bands: SurfaceBand[] = [];

    for (let frameIndex = 0; frameIndex < projectedFrames.length - 1; frameIndex += 1) {
        const frontFrame = projectedFrames[frameIndex];
        const backFrame = projectedFrames[frameIndex + 1];

        for (let sampleIndex = 0; sampleIndex < frontFrame.points.length - 1; sampleIndex += 1) {
            const frontJump = Math.abs(frontFrame.samples[sampleIndex + 1] - frontFrame.samples[sampleIndex]);
            const backJump = Math.abs(backFrame.samples[sampleIndex + 1] - backFrame.samples[sampleIndex]);

            if (frontJump > DISCONTINUITY_THRESHOLD || backJump > DISCONTINUITY_THRESHOLD) {
                continue;
            }

            const quad = [
                frontFrame.points[sampleIndex],
                frontFrame.points[sampleIndex + 1],
                backFrame.points[sampleIndex + 1],
                backFrame.points[sampleIndex],
            ];
            const objectQuad = [
                frontFrame.objectPoints[sampleIndex],
                frontFrame.objectPoints[sampleIndex + 1],
                backFrame.objectPoints[sampleIndex + 1],
                backFrame.objectPoints[sampleIndex],
            ];
            const surfaceNormal = normaliseVector(
                crossProduct(
                    subtractPoints(objectQuad[1], objectQuad[0]),
                    subtractPoints(objectQuad[3], objectQuad[0])
                )
            );
            const lightDirection = normaliseVector({ x: -0.2, y: 0.95, z: -0.5 });
            const averageCameraDepth =
                quad.reduce((total, point) => total + point.cameraDepth, 0) / quad.length;
            const depthNormalized = (frontFrame.depthNormalized + backFrame.depthNormalized) * 0.5;
            const slopeLight = clamp((dotProduct(surfaceNormal, lightDirection) + 1) * 0.5, 0, 1);
            const ridgeAmount = clamp(
                (Math.abs(frontFrame.samples[sampleIndex + 1] - frontFrame.samples[sampleIndex]) * 0.95) +
                    (Math.abs(backFrame.samples[sampleIndex + 1] - backFrame.samples[sampleIndex]) * 0.95),
                0,
                1
            );

            bands.push({
                frameLo: frontFrame.frameIndex,
                frameHi: backFrame.frameIndex,
                sampleIndex,
                points: quad,
                averageCameraDepth,
                depthNormalized,
                slopeLight,
                ridgeAmount,
            });
        }
    }

    bands.sort((left, right) => right.averageCameraDepth - left.averageCameraDepth);

    return bands;
}

function createSurfaceRibs(projectedFrames: ProjectedFrame[]): SurfaceRib[] {
    const sampleCount = projectedFrames[0]?.points.length ?? 0;

    if (sampleCount < 3) {
        return [];
    }

    const desiredRibCount = clamp(Math.round(sampleCount / 10), 8, 14);
    const selectedColumns = new Set([0, sampleCount - 1]);

    for (let ribIndex = 1; ribIndex < desiredRibCount - 1; ribIndex += 1) {
        selectedColumns.add(
            Math.round((ribIndex * (sampleCount - 1)) / (desiredRibCount - 1))
        );
    }

    return [...selectedColumns]
        .sort((left, right) => left - right)
        .map((sampleIndex) => {
            const points = projectedFrames.map((frame) => frame.points[sampleIndex]);
            const averageDepth =
                points.reduce((total, point) => total + point.cameraDepth, 0) / Math.max(points.length, 1);
            const frontness = 1 - (
                projectedFrames.reduce((total, frame) => total + frame.depthNormalized, 0) /
                Math.max(projectedFrames.length, 1)
            );

            return {
                sampleIndex,
                points,
                averageDepth,
                alpha: lerp(0.05, 0.12, frontness),
            };
        });
}

function createPolylineSegments<PointType>(points: PointType[], samples: ArrayLike<number>, threshold = DISCONTINUITY_THRESHOLD): PointType[][] {
    if (points.length <= 1) {
        return [];
    }

    const segments: PointType[][] = [];
    let startIndex = 0;

    for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
        if (Math.abs(samples[pointIndex + 1] - samples[pointIndex]) > threshold) {
            if ((pointIndex - startIndex) >= 1) {
                segments.push(points.slice(startIndex, pointIndex + 1));
            }

            startIndex = pointIndex + 1;
        }
    }

    if ((points.length - 1 - startIndex) >= 1) {
        segments.push(points.slice(startIndex));
    }

    return segments;
}

function createInterpolatedSurfaceSlices(sourceFrames: ProjectedFrame[], camera: Camera, projection: Projection): SurfaceSlice[] {
    const frameCount = sourceFrames.length;

    if (frameCount === 0) {
        return [];
    }

    const sliceCount = clamp((frameCount * 3) - 2, 17, 41);
    const slices: SurfaceSlice[] = [];

    for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
        const framePosition = (sliceIndex * (frameCount - 1)) / Math.max(1, sliceCount - 1);
        const frameLo = Math.floor(framePosition);
        const frameHi = Math.min(frameLo + 1, frameCount - 1);
        const frameT = framePosition - frameLo;
        const samples = buildInterpolatedFrame(
            sourceFrames[frameLo].samples,
            sourceFrames[frameHi].samples,
            frameT
        );
        const depth = getSceneDepthAt(framePosition, frameCount);
        const objectPoints = createObjectPoints(samples, depth);
        const points = objectPoints.map((point) =>
            projectToScreen(projectWorldPoint(point, camera), projection)
        );
        const averageDepth =
            points.reduce((total, point) => total + point.cameraDepth, 0) / Math.max(points.length, 1);

        slices.push({
            frameIndex: framePosition,
            depthNormalized: getBacknessAt(framePosition, frameCount),
            samples,
            points,
            segments: createPolylineSegments(points, samples),
            averageDepth,
            alpha: lerp(0.07, 0.16, 1 - getBacknessAt(framePosition, frameCount)),
        });
    }

    return slices;
}

function buildInterpolatedFrame(lowFrame: Float32Array, highFrame: Float32Array, amount: number): Float32Array {
    const output = new Float32Array(lowFrame.length);

    for (let sampleIndex = 0; sampleIndex < lowFrame.length; sampleIndex += 1) {
        output[sampleIndex] = lerp(lowFrame[sampleIndex], highFrame[sampleIndex], amount);
    }

    return output;
}

function createCurrentSlice(staticScene: WavetableStaticScene, frameState: WavetableFrameState): CurrentSlice {
    const lowFrame = staticScene.contourFrames[frameState.frameLo];
    const highFrame = staticScene.contourFrames[frameState.frameHi];
    const warpMode = resolveWarpMode(frameState.warpMode);
    const warpAmount = clamp(Number(frameState.warpAmount) || 0, 0, 1);
    const blendedSamples = isIdentityWarp(warpMode, warpAmount)
        ? buildInterpolatedFrame(lowFrame.samples, highFrame.samples, frameState.frameT)
        : buildWarpedFrame(lowFrame.samples, highFrame.samples, frameState.frameT, warpMode, warpAmount);
    const depth = getSceneDepth(frameState.frameIndex, staticScene.frameCount);
    const objectPoints = createObjectPoints(blendedSamples, depth);
    const floorObjectPoints = objectPoints.map((point) => ({ x: point.x, y: FLOOR_Y, z: point.z }));
    const points = objectPoints.map((point) =>
        projectToScreen(projectWorldPoint(point, staticScene.camera), staticScene.projection)
    );
    const floorPoints = floorObjectPoints.map((point) =>
        projectToScreen(projectWorldPoint(point, staticScene.camera), staticScene.projection)
    );
    const labelAnchor = points[Math.floor(points.length * 0.78)] ?? points[points.length - 1];
    const label = {
        text: buildCurrentSliceLabel(frameState, staticScene.frameCount),
        x: clamp(labelAnchor.x + 14, 18, staticScene.width - 236),
        y: clamp(labelAnchor.y - 18, 24, staticScene.height - 24),
    };

    return {
        frameState,
        samples: blendedSamples,
        points,
        segments: [points],
        floorPoints,
        label,
        lineWidth: 2.35,
        glowBlur: 12,
    };
}

function buildCurrentSliceLabel(frameState: WavetableFrameState, frameCount: number): string {
    const warpMode = resolveWarpMode(frameState.warpMode);
    const warpAmount = clamp(Number(frameState.warpAmount) || 0, 0, 1);
    const baseLabel = `Frame ${frameState.frameIndex.toFixed(2)} / ${frameCount - 1}`;

    if (isIdentityWarp(warpMode, warpAmount)) {
        return baseLabel;
    }

    if (warpMode === WARP_MODE_BEND) {
        const signedAmount = Math.round((warpAmount - 0.5) * 200);
        return `${baseLabel} · Bend ${signedAmount > 0 ? "+" : ""}${signedAmount}%`;
    }

    if (warpMode === WARP_MODE_PWM) {
        return `${baseLabel} · PWM ${Math.round(warpAmount * 100)}%`;
    }

    if (warpMode === WARP_MODE_ASYM) {
        const signedAmount = Math.round((warpAmount - 0.5) * 200);
        return `${baseLabel} · Asym ${signedAmount > 0 ? "+" : ""}${signedAmount}%`;
    }

    if (warpMode === WARP_MODE_MIRROR) {
        const signedAmount = Math.round((warpAmount - 0.5) * 200);
        return `${baseLabel} · Mirror ${signedAmount > 0 ? "+" : ""}${signedAmount}%`;
    }

    return baseLabel;
}

export function createFrameState(frameCount: number, position: number, warpMode = 0, warpAmount = 0): WavetableFrameState {
    const safeFrameCount = Math.max(1, Number(frameCount) || 0);
    const clampedPosition = clamp(Number(position) || 0, 0, 1);
    const frameIndex = clampedPosition * (safeFrameCount - 1);
    const frameLo = Math.floor(frameIndex);
    const frameHi = Math.min(frameLo + 1, safeFrameCount - 1);
    const frameT = frameIndex - frameLo;

    return {
        frameCount: safeFrameCount,
        position: clampedPosition,
        frameIndex,
        frameLo,
        frameHi,
        frameT,
        warpMode: resolveWarpMode(warpMode),
        warpAmount: clamp(Number(warpAmount) || 0, 0, 1),
    };
}

export function decimateFrame(frame: ArrayLike<number>, targetPointCount: number): Float32Array {
    const source = frame instanceof Float32Array ? frame : Float32Array.from(frame);
    const clampedPointCount = Math.max(2, Math.floor(targetPointCount || source.length));

    if (clampedPointCount >= source.length) {
        return source.slice();
    }

    const output = new Float32Array(clampedPointCount);
    const lastSourceIndex = source.length - 1;

    for (let pointIndex = 0; pointIndex < clampedPointCount; pointIndex += 1) {
        const sampleIndex = Math.round((pointIndex * lastSourceIndex) / (clampedPointCount - 1));
        output[pointIndex] = source[sampleIndex];
    }

    return output;
}

export function buildWavetableStaticScene({
    frames,
    width = 640,
    height = 320,
    pixelRatio = 1,
    drawableInsets = {},
}: { frames: WavetableFrameInput[] | null | undefined; width?: number; height?: number; pixelRatio?: number; drawableInsets?: WavetableDrawableInsets }): WavetableStaticScene {
    assertFrames(frames);

    const safeWidth = Math.max(180, Math.floor(width || 0));
    const safeHeight = Math.max(140, Math.floor(height || 0));
    const frameCount = frames.length;
    const contourPointCount = getContourPointCount(safeWidth, frames[0].length);
    const surfacePointCount = getSurfacePointCount(safeWidth, frames[0].length);
    const contourSamples = frames.map((frame) => decimateFrame(frame, contourPointCount));
    const surfaceSamples = frames.map((frame) => decimateFrame(frame, surfacePointCount));
    const { camera, projection } = buildProjectionFromFrames(contourSamples, safeWidth, safeHeight, frameCount, drawableInsets);
    const contourFrames = contourSamples.map((samples, frameIndex) =>
        createProjectedFrame(samples, frameIndex, frameCount, camera, projection)
    );
    const surfaceFrames = surfaceSamples.map((samples, frameIndex) =>
        createProjectedFrame(samples, frameIndex, frameCount, camera, projection)
    );

    return {
        width: safeWidth,
        height: safeHeight,
        pixelRatio: Math.max(1, Number(pixelRatio) || 1),
        drawableInsets,
        frameCount,
        camera,
        contourPointCount,
        surfacePointCount,
        projection,
        contourFrames,
        surfaceFrames,
        surfaceBands: createSurfaceBands(surfaceFrames),
        surfaceRibs: createSurfaceRibs(surfaceFrames),
        surfaceSlices: createInterpolatedSurfaceSlices(contourFrames, camera, projection),
        guideLines: createGuideLines(camera, projection),
    };
}

export function buildWavetableRenderModel({
    frames = null,
    position = 0,
    warpMode = 0,
    warpAmount = 0,
    width = 640,
    height = 320,
    pixelRatio = 1,
    drawableInsets = {},
    staticScene = null,
}: { frames?: WavetableFrameInput[] | null; position?: number; warpMode?: number; warpAmount?: number; width?: number; height?: number; pixelRatio?: number; drawableInsets?: WavetableDrawableInsets; staticScene?: WavetableStaticScene | null }): WavetableRenderModel {
    const scene = staticScene ?? buildWavetableStaticScene({
        frames,
        width,
        height,
        pixelRatio,
        drawableInsets,
    });
    const frameState = createFrameState(scene.frameCount, position, warpMode, warpAmount);

    return {
        ...scene,
        frameState,
        contours: createContourDescriptors(scene.contourFrames, frameState),
        currentSlice: createCurrentSlice(scene, frameState),
    };
}

function tracePath(context: WavetableRenderContext, points: { x: number; y: number }[]): void {
    points.forEach((point, pointIndex) => {
        if (pointIndex === 0) {
            context.moveTo(point.x, point.y);
        } else {
            context.lineTo(point.x, point.y);
        }
    });
}

function strokePolylineSegments(context: WavetableRenderContext, segments: { x: number; y: number }[][]): void {
    for (const segment of segments) {
        if (segment.length < 2) {
            continue;
        }

        context.beginPath();
        tracePath(context, segment);
        context.stroke();
    }
}

export function drawWavetableModel(context: WavetableRenderContext, model: WavetableRenderModel, theme: WavetableTheme = DEFAULT_WAVETABLE_THEME, options: WavetableDrawOptions = {}): void {
    // ADR-024 compact cutover seams. Defaults preserve the established
    // desktop drawing exactly: an opaque painted background and the
    // in-canvas frame/warp caption. The compact mobile Voice unit disables
    // both so one page-owned gradient can run behind the graph AND its
    // parameter strip, and because the cutover removes any permanent
    // Frame/Index display. The retained artwork is identical either way.
    const { paintBackground = true, showSliceCaption = true, modulationRange = null } = options;
    const meshColour = mixRGB(theme.meshColor, [214, 246, 255], 0.34);
    // T02C: map the overlay's normalized positions through the same frame-state
    // law the current slice uses, then tint colours only — every alpha, glow,
    // and geometry stays exactly the untinted draw's.
    const overlayLowIndex = modulationRange === null
        ? 0
        : createFrameState(model.frameCount, modulationRange.lowPosition).frameIndex;
    const overlayHighIndex = modulationRange === null
        ? 0
        : createFrameState(model.frameCount, modulationRange.highPosition).frameIndex;
    const overlayLineTint = (frameIndex: number): number => (
        modulationRange !== null
            && frameIndex >= overlayLowIndex - MODULATION_OVERLAY_EPSILON
            && frameIndex <= overlayHighIndex + MODULATION_OVERLAY_EPSILON
            ? MODULATION_OVERLAY_LINE_MIX
            : 0
    );
    const overlaySkinTint = (frameLo: number, frameHi: number): number => {
        if (modulationRange === null) {
            return 0;
        }
        const overlap = Math.min(frameHi, overlayHighIndex) - Math.max(frameLo, overlayLowIndex);
        return overlap > MODULATION_OVERLAY_EPSILON
            ? MODULATION_OVERLAY_SKIN_MIX * (overlap / (frameHi - frameLo))
            : 0;
    };
    const tintColour = (colour: RGBColor, tint: number): RGBColor => (
        tint > 0 && modulationRange !== null ? mixRGB(colour, modulationRange.color, tint) : colour
    );

    context.clearRect(0, 0, model.width, model.height);

    if (paintBackground) {
        const gradient = context.createLinearGradient?.(0, 0, 0, model.height);

        if (gradient) {
            gradient.addColorStop(0, "#4b164f");
            gradient.addColorStop(1, "#1f4f5c");
            context.fillStyle = gradient;
        } else {
            context.fillStyle = "#4b164f";
        }

        context.fillRect(0, 0, model.width, model.height);
    }

    context.save();
    context.strokeStyle = theme.panelStroke;
    context.lineWidth = 1;
    context.strokeRect?.(0.5, 0.5, model.width - 1, model.height - 1);
    context.restore();

    context.save();
    context.strokeStyle = theme.guideColor;
    context.lineWidth = 1;

    for (const guideLine of model.guideLines) {
        context.beginPath();
        context.strokeStyle = toRGBA(theme.frameColor, guideLine.strength * 0.22);
        context.lineWidth = guideLine.kind === "frame" ? 1.15 : 0.9;
        tracePath(context, guideLine.points);
        context.stroke();
    }

    context.restore();

    for (const band of model.surfaceBands) {
        const alpha = lerp(0.085, 0.024, band.depthNormalized) + (band.ridgeAmount * 0.018);
        const bandColour = mixRGB(
            mixRGB(theme.frameColor, theme.highlightColor, band.slopeLight * 0.24),
            theme.backgroundRGB,
            lerp(0.08, 0.68, band.depthNormalized) - (band.slopeLight * 0.06)
        );

        context.save();
        context.fillStyle = toRGBA(tintColour(bandColour, overlaySkinTint(band.frameLo, band.frameHi)), alpha);
        context.beginPath();
        tracePath(context, band.points);
        context.closePath?.();
        context.fill();
        context.restore();
    }

    for (const slice of model.surfaceSlices) {
        context.save();
        context.strokeStyle = toRGBA(tintColour(meshColour, overlayLineTint(slice.frameIndex)), Math.min(0.46, slice.alpha * 2.05));
        context.lineWidth = 1.15;
        context.shadowBlur = 8;
        context.shadowColor = toRGBA(theme.meshColor, 0.2);
        strokePolylineSegments(context, slice.segments);
        context.restore();
    }

    for (const rib of model.surfaceRibs) {
        context.save();
        context.strokeStyle = toRGBA(meshColour, Math.min(0.42, rib.alpha * 1.95));
        context.lineWidth = 1.1;
        context.shadowBlur = 7;
        context.shadowColor = toRGBA(theme.meshColor, 0.18);
        context.beginPath();
        tracePath(context, rib.points);
        context.stroke();
        context.restore();
    }

    for (const contour of model.contours) {
        const strokeColour = mixRGB(theme.frameColor, theme.backgroundRGB, clamp(contour.colourMix, 0, 0.92));

        context.save();
        context.strokeStyle = toRGBA(tintColour(strokeColour, overlayLineTint(contour.frameIndex)), contour.alpha);
        context.lineWidth = contour.lineWidth;
        strokePolylineSegments(context, contour.segments);
        context.restore();
    }

    context.save();
    context.strokeStyle = toRGBA(theme.highlightColor, 0.98);
    context.lineWidth = model.currentSlice.lineWidth;
    context.shadowBlur = model.currentSlice.glowBlur + 4;
    context.shadowColor = toRGBA(theme.highlightColor, 0.52);
    strokePolylineSegments(context, model.currentSlice.segments);
    context.restore();

    if (showSliceCaption) {
        context.save();
        context.fillStyle = toRGBA(theme.backgroundRGB, 0.74);
        context.fillRect(model.currentSlice.label.x - 10, model.currentSlice.label.y - 14, 210, 24);
        context.fillStyle = theme.textColor;
        context.font = "400 12px Departure Mono, IBM Plex Mono, monospace";
        context.textAlign = "left";
        context.fillText(model.currentSlice.label.text, model.currentSlice.label.x, model.currentSlice.label.y + 2);
        context.restore();
    }
}

export class CanvasWavetableDisplay {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D | null;
    theme: WavetableTheme;
    paintBackground: boolean;
    showSliceCaption: boolean;
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame: (handle: number) => void;
    frames: Float32Array[];
    position: number;
    warpMode: number;
    warpAmount: number;
    devicePixelRatio: number;
    cssWidth: number;
    cssHeight: number;
    drawableInsets: { top: number; right: number; bottom: number; left: number };
    modulationRange: WavetableModulationRangeOverlay | null;
    staticScene: WavetableStaticScene | null;
    staticKey: string;
    pendingRenderHandle: number | null;

    constructor(
        canvas: HTMLCanvasElement,
        {
            theme = DEFAULT_WAVETABLE_THEME,
            requestAnimationFrame = requestNextAnimationFrame,
            cancelAnimationFrame = cancelNextAnimationFrame,
            paintBackground = true,
            showSliceCaption = true,
        }: CanvasWavetableDisplayOptions = {}
    ) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.theme = theme;
        this.paintBackground = paintBackground;
        this.showSliceCaption = showSliceCaption;
        this.requestAnimationFrame = requestAnimationFrame;
        this.cancelAnimationFrame = cancelAnimationFrame;
        this.frames = [];
        this.position = 0;
        this.warpMode = 0;
        this.warpAmount = 0;
        this.devicePixelRatio = 1;
        this.cssWidth = 0;
        this.cssHeight = 0;
        this.drawableInsets = { top: 0, right: 0, bottom: 0, left: 0 };
        this.modulationRange = null;
        this.staticScene = null;
        this.staticKey = "";
        this.pendingRenderHandle = null;
    }

    invalidateStaticScene(): void {
        this.staticScene = null;
        this.staticKey = "";
    }

    setFrames(frames: WavetableFrameInput[]): void {
        assertFrames(frames);
        this.frames = frames.map((frame) =>
            frame instanceof Float32Array ? frame.slice() : Float32Array.from(frame)
        );
        this.invalidateStaticScene();
        this.queueRender();
    }

    setPosition(position: number): void {
        this.position = clamp(Number(position) || 0, 0, 1);
        this.queueRender();
    }

    setWarp(mode: number, amount: number): void {
        this.warpMode = resolveWarpMode(mode);
        this.warpAmount = clamp(Number(amount) || 0, 0, 1);
        this.queueRender();
    }

    setModulationRange(overlay: WavetableModulationRangeOverlay | null): void {
        const current = this.modulationRange;
        if (
            current !== null
            && overlay !== null
            && current.lowPosition === overlay.lowPosition
            && current.highPosition === overlay.highPosition
            && current.color[0] === overlay.color[0]
            && current.color[1] === overlay.color[1]
            && current.color[2] === overlay.color[2]
        ) {
            return;
        }
        if (current === null && overlay === null) {
            return;
        }

        this.modulationRange = overlay;
        this.queueRender();
    }

    setDrawableInsets(insets: WavetableDrawableInsets = {}): void {
        const nextInsets = {
            top: Math.max(0, Number(insets.top) || 0),
            right: Math.max(0, Number(insets.right) || 0),
            bottom: Math.max(0, Number(insets.bottom) || 0),
            left: Math.max(0, Number(insets.left) || 0),
        };

        if (
            nextInsets.top === this.drawableInsets.top &&
            nextInsets.right === this.drawableInsets.right &&
            nextInsets.bottom === this.drawableInsets.bottom &&
            nextInsets.left === this.drawableInsets.left
        ) {
            return;
        }

        this.drawableInsets = nextInsets;
        this.invalidateStaticScene();
        this.queueRender();
    }

    resize(width?: number, height?: number, devicePixelRatio = 1): void {
        const nextWidth = Math.max(1, Math.floor(width || this.canvas.clientWidth || 1));
        const nextHeight = Math.max(1, Math.floor(height || this.canvas.clientHeight || 1));
        const nextRatio = Math.max(1, Number(devicePixelRatio) || 1);

        this.cssWidth = nextWidth;
        this.cssHeight = nextHeight;
        this.devicePixelRatio = nextRatio;
        this.canvas.width = Math.max(1, Math.round(nextWidth * nextRatio));
        this.canvas.height = Math.max(1, Math.round(nextHeight * nextRatio));
        this.canvas.style.width = `${nextWidth}px`;
        this.canvas.style.height = `${nextHeight}px`;
        this.invalidateStaticScene();
        this.queueRender();
    }

    getStaticScene(width: number, height: number): WavetableStaticScene {
        const nextKey = [
            this.frames.length,
            this.frames[0]?.length ?? 0,
            width,
            height,
            this.devicePixelRatio,
            this.drawableInsets.top,
            this.drawableInsets.right,
            this.drawableInsets.bottom,
            this.drawableInsets.left,
        ].join(":");

        if (this.staticScene && this.staticKey === nextKey) {
            return this.staticScene;
        }

        this.staticKey = nextKey;
        this.staticScene = buildWavetableStaticScene({
            frames: this.frames,
            width,
            height,
            pixelRatio: this.devicePixelRatio,
            drawableInsets: this.drawableInsets,
        });

        return this.staticScene;
    }

    queueRender(): void {
        if (this.pendingRenderHandle !== null) {
            return;
        }

        this.pendingRenderHandle = this.requestAnimationFrame(() => {
            this.pendingRenderHandle = null;
            this.render();
        });
    }

    render(): void {
        if (this.pendingRenderHandle !== null) {
            this.cancelAnimationFrame(this.pendingRenderHandle);
            this.pendingRenderHandle = null;
        }

        if (!this.context || this.canvas.width === 0 || this.canvas.height === 0) {
            return;
        }

        const width =
            this.cssWidth || this.canvas.clientWidth || Math.round(this.canvas.width / this.devicePixelRatio);
        const height =
            this.cssHeight || this.canvas.clientHeight || Math.round(this.canvas.height / this.devicePixelRatio);

        this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);

        if (this.frames.length === 0) {
            this.context.clearRect(0, 0, width, height);
            return;
        }

        const model = buildWavetableRenderModel({
            staticScene: this.getStaticScene(width, height),
            position: this.position,
            warpMode: this.warpMode,
            warpAmount: this.warpAmount,
        });

        drawWavetableModel(this.context, model, this.theme, {
            paintBackground: this.paintBackground,
            showSliceCaption: this.showSliceCaption,
            modulationRange: this.modulationRange,
        });
    }
}
