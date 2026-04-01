type RGB = [number, number, number];

type WavetableTheme = {
    backgroundTop: string;
    backgroundBottom: string;
    backgroundRGB: RGB;
    frameColor: RGB;
    meshColor: RGB;
    highlightColor: RGB;
    guideColor: string;
    textColor: string;
};

const DEFAULT_WAVETABLE_THEME: WavetableTheme = {
    backgroundTop: "#04070f",
    backgroundBottom: "#04070f",
    backgroundRGB: [4, 7, 15],
    frameColor: [94, 118, 255],
    meshColor: [135, 215, 245],
    highlightColor: [245, 108, 182],
    guideColor: "rgba(129, 150, 255, 0.12)",
    textColor: "rgba(255, 216, 166, 0.94)",
};

const CAMERA_YAW = 15 * (Math.PI / 180);
const CAMERA_PITCH = 26 * (Math.PI / 180);
const CAMERA_DISTANCE = 8.9;
const CAMERA_FOCAL_LENGTH = 2.4;
const FRAME_DEPTH_EXTENT = 4.1;
const AMPLITUDE_SCALE = 0.42;
const FLOOR_Y = -0.64;

type Point3D = {
    x: number;
    y: number;
    z: number;
};

type Point2D = {
    x: number;
    y: number;
    cameraDepth: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, amount: number) {
    return start + ((end - start) * amount);
}

function mixRGB(from: RGB, to: RGB, amount: number): RGB {
    return [
        Math.round(lerp(from[0], to[0], amount)),
        Math.round(lerp(from[1], to[1], amount)),
        Math.round(lerp(from[2], to[2], amount)),
    ];
}

function toRGBA(rgb: RGB, alpha: number) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}

function assertFrames(frames: Float32Array[]) {
    if (!Array.isArray(frames) || frames.length === 0) {
        throw new Error("frames must be a non-empty array of Float32Array values");
    }

    const expectedLength = frames[0].length;
    for (const frame of frames) {
        if (!(frame instanceof Float32Array)) {
            throw new Error("every frame must be a Float32Array");
        }

        if (frame.length !== expectedLength) {
            throw new Error("all frames must have the same sample count");
        }
    }
}

function requestNextAnimationFrame(callback: FrameRequestCallback) {
    if (typeof globalThis.requestAnimationFrame === "function") {
        return globalThis.requestAnimationFrame(callback);
    }

    return setTimeout(() => callback(Date.now()), 0);
}

function cancelNextAnimationFrame(handle: number) {
    if (typeof globalThis.cancelAnimationFrame === "function") {
        globalThis.cancelAnimationFrame(handle);
        return;
    }

    clearTimeout(handle);
}

function decimateFrame(frame: Float32Array, targetPointCount: number) {
    const clampedPointCount = Math.max(2, Math.min(targetPointCount, frame.length));

    if (clampedPointCount >= frame.length) {
        return frame.slice();
    }

    const output = new Float32Array(clampedPointCount);
    const lastSourceIndex = frame.length - 1;

    for (let pointIndex = 0; pointIndex < clampedPointCount; pointIndex += 1) {
        const sampleIndex = Math.round((pointIndex * lastSourceIndex) / (clampedPointCount - 1));
        output[pointIndex] = frame[sampleIndex];
    }

    return output;
}

function subtractPoints(a: Point3D, b: Point3D): Point3D {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
    };
}

function crossProduct(a: Point3D, b: Point3D): Point3D {
    return {
        x: (a.y * b.z) - (a.z * b.y),
        y: (a.z * b.x) - (a.x * b.z),
        z: (a.x * b.y) - (a.y * b.x),
    };
}

function dotProduct(a: Point3D, b: Point3D) {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function normalizeVector(vector: Point3D): Point3D {
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

function createCamera() {
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
    const forward = normalizeVector(subtractPoints(target, position));
    const right = normalizeVector(crossProduct(worldUp, forward));
    const up = normalizeVector(crossProduct(forward, right));

    return {
        position,
        forward,
        right,
        up,
    };
}

function projectPoint(point: Point3D, camera: ReturnType<typeof createCamera>, width: number, height: number): Point2D {
    const relative = subtractPoints(point, camera.position);
    const cameraX = dotProduct(relative, camera.right);
    const cameraY = dotProduct(relative, camera.up);
    const cameraDepth = Math.max(0.001, dotProduct(relative, camera.forward));
    const perspective = CAMERA_FOCAL_LENGTH / cameraDepth;
    const projectedX = cameraX * perspective;
    const projectedY = cameraY * perspective;
    const scale = Math.min(width * 0.76, height * 0.98);

    return {
        x: (width * 0.52) + (projectedX * scale),
        y: (height * 0.57) - (projectedY * scale),
        cameraDepth,
    };
}

function buildInterpolatedFrame(lowFrame: Float32Array, highFrame: Float32Array, amount: number) {
    const output = new Float32Array(lowFrame.length);

    for (let sampleIndex = 0; sampleIndex < lowFrame.length; sampleIndex += 1) {
        output[sampleIndex] = lerp(lowFrame[sampleIndex], highFrame[sampleIndex], amount);
    }

    return output;
}

function createProjectedFrame(
    samples: Float32Array,
    frameIndex: number,
    frameCount: number,
    camera: ReturnType<typeof createCamera>,
    width: number,
    height: number,
) {
    const safeDenominator = Math.max(1, samples.length - 1);
    const depth = frameCount <= 1 ? 0 : (frameIndex / (frameCount - 1)) * FRAME_DEPTH_EXTENT;
    const points: Point2D[] = [];

    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
        const phase = sampleIndex / safeDenominator;
        const point = {
            x: lerp(-1, 1, phase),
            y: samples[sampleIndex] * AMPLITUDE_SCALE,
            z: depth,
        };
        points.push(projectPoint(point, camera, width, height));
    }

    return {
        frameIndex,
        depthNormalized: frameCount <= 1 ? 0 : frameIndex / (frameCount - 1),
        points,
    };
}

function tracePolyline(context: CanvasRenderingContext2D, points: Point2D[]) {
    points.forEach((point, index) => {
        if (index === 0) {
            context.moveTo(point.x, point.y);
        } else {
            context.lineTo(point.x, point.y);
        }
    });
}

function drawGuideFrame(
    context: CanvasRenderingContext2D,
    camera: ReturnType<typeof createCamera>,
    width: number,
    height: number,
    theme: WavetableTheme,
) {
    const frontFloor = [
        projectPoint({ x: -1, y: FLOOR_Y, z: 0 }, camera, width, height),
        projectPoint({ x: 1, y: FLOOR_Y, z: 0 }, camera, width, height),
    ];
    const backFloor = [
        projectPoint({ x: -1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT }, camera, width, height),
        projectPoint({ x: 1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT }, camera, width, height),
    ];
    const leftEdge = [
        projectPoint({ x: -1, y: FLOOR_Y, z: 0 }, camera, width, height),
        projectPoint({ x: -1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT }, camera, width, height),
    ];
    const rightEdge = [
        projectPoint({ x: 1, y: FLOOR_Y, z: 0 }, camera, width, height),
        projectPoint({ x: 1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT }, camera, width, height),
    ];

    context.save();
    context.strokeStyle = theme.guideColor;
    context.lineWidth = 1;
    [frontFloor, backFloor, leftEdge, rightEdge].forEach((guideLine) => {
        context.beginPath();
        tracePolyline(context, guideLine);
        context.stroke();
    });
    context.restore();
}

function drawFrameStack(
    context: CanvasRenderingContext2D,
    projectedFrames: Array<ReturnType<typeof createProjectedFrame>>,
    theme: WavetableTheme,
) {
    for (const projectedFrame of projectedFrames) {
        const alpha = lerp(0.08, 0.26, 1 - projectedFrame.depthNormalized);
        const colorMix = lerp(0.75, 0.15, 1 - projectedFrame.depthNormalized);
        const strokeColor = mixRGB(theme.frameColor, theme.backgroundRGB, colorMix);

        context.save();
        context.strokeStyle = toRGBA(strokeColor, alpha);
        context.lineWidth = lerp(0.8, 1.6, 1 - projectedFrame.depthNormalized);
        context.beginPath();
        tracePolyline(context, projectedFrame.points);
        context.stroke();
        context.restore();
    }
}

function drawMesh(
    context: CanvasRenderingContext2D,
    projectedFrames: Array<ReturnType<typeof createProjectedFrame>>,
    theme: WavetableTheme,
) {
    if (projectedFrames.length < 2) {
        return;
    }

    const step = clamp(Math.round(projectedFrames[0].points.length / 12), 6, 18);

    for (let sampleIndex = 0; sampleIndex < projectedFrames[0].points.length; sampleIndex += step) {
        context.save();
        context.strokeStyle = toRGBA(theme.meshColor, 0.12);
        context.lineWidth = 1;
        context.beginPath();

        projectedFrames.forEach((frame, frameIndex) => {
            const point = frame.points[sampleIndex];
            if (!point) {
                return;
            }

            if (frameIndex === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        });

        context.stroke();
        context.restore();
    }
}

function drawCurrentFrame(
    context: CanvasRenderingContext2D,
    frame: ReturnType<typeof createProjectedFrame>,
    frameIndexLabel: string,
    theme: WavetableTheme,
    width: number,
) {
    context.save();
    context.strokeStyle = toRGBA(theme.highlightColor, 0.98);
    context.lineWidth = 2.35;
    context.shadowBlur = 12;
    context.shadowColor = toRGBA(theme.highlightColor, 0.52);
    context.beginPath();
    tracePolyline(context, frame.points);
    context.stroke();
    context.restore();

    const anchor = frame.points[Math.floor(frame.points.length * 0.78)] ?? frame.points[frame.points.length - 1];
    if (!anchor) {
        return;
    }

    const labelX = clamp(anchor.x + 14, 18, width - 180);
    const labelY = clamp(anchor.y - 18, 24, 9999);

    context.save();
    context.fillStyle = toRGBA(theme.backgroundRGB, 0.78);
    context.fillRect(labelX - 10, labelY - 14, 154, 24);
    context.fillStyle = theme.textColor;
    context.font = "600 12px Avenir Next, Avenir, sans-serif";
    context.textAlign = "left";
    context.fillText(frameIndexLabel, labelX, labelY + 2);
    context.restore();
}

export class CanvasWavetableDisplay {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D | null;
    private readonly theme: WavetableTheme;
    private readonly requestAnimationFrameImpl: typeof requestNextAnimationFrame;
    private readonly cancelAnimationFrameImpl: typeof cancelNextAnimationFrame;

    private frames: Float32Array[] = [];
    private position = 0;
    private devicePixelRatio = 1;
    private cssWidth = 0;
    private cssHeight = 0;
    private pendingRenderHandle: number | null = null;

    constructor(
        canvas: HTMLCanvasElement,
        {
            theme = DEFAULT_WAVETABLE_THEME,
            requestAnimationFrame = requestNextAnimationFrame,
            cancelAnimationFrame = cancelNextAnimationFrame,
        }: {
            theme?: WavetableTheme;
            requestAnimationFrame?: typeof requestNextAnimationFrame;
            cancelAnimationFrame?: typeof cancelNextAnimationFrame;
        } = {},
    ) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.theme = theme;
        this.requestAnimationFrameImpl = requestAnimationFrame;
        this.cancelAnimationFrameImpl = cancelAnimationFrame;
    }

    setFrames(frames: Float32Array[]) {
        assertFrames(frames);
        this.frames = frames.map((frame) => frame.slice());
        this.queueRender();
    }

    setPosition(position: number) {
        this.position = clamp(Number(position) || 0, 0, 1);
        this.queueRender();
    }

    resize(width: number, height: number, devicePixelRatio = 1) {
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
        this.queueRender();
    }

    private queueRender() {
        if (this.pendingRenderHandle !== null) {
            return;
        }

        this.pendingRenderHandle = this.requestAnimationFrameImpl(() => {
            this.pendingRenderHandle = null;
            this.render();
        });
    }

    render() {
        if (this.pendingRenderHandle !== null) {
            this.cancelAnimationFrameImpl(this.pendingRenderHandle);
            this.pendingRenderHandle = null;
        }

        if (!this.context || this.canvas.width === 0 || this.canvas.height === 0) {
            return;
        }

        const width = this.cssWidth || this.canvas.clientWidth || Math.round(this.canvas.width / this.devicePixelRatio);
        const height = this.cssHeight || this.canvas.clientHeight || Math.round(this.canvas.height / this.devicePixelRatio);

        this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
        this.context.clearRect(0, 0, width, height);

        const gradient = this.context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, this.theme.backgroundTop);
        gradient.addColorStop(1, this.theme.backgroundBottom);
        this.context.fillStyle = gradient;
        this.context.fillRect(0, 0, width, height);

        if (this.frames.length === 0) {
            return;
        }

        const pointCount = clamp(Math.round(width / 4), 96, 256);
        const decimatedFrames = this.frames.map((frame) => decimateFrame(frame, pointCount));
        const camera = createCamera();
        const projectedFrames = decimatedFrames.map((frame, frameIndex) =>
            createProjectedFrame(frame, frameIndex, decimatedFrames.length, camera, width, height),
        );
        const currentFrameIndex = this.position * Math.max(0, decimatedFrames.length - 1);
        const frameLo = Math.floor(currentFrameIndex);
        const frameHi = Math.min(frameLo + 1, decimatedFrames.length - 1);
        const frameT = currentFrameIndex - frameLo;
        const blendedFrame = buildInterpolatedFrame(decimatedFrames[frameLo], decimatedFrames[frameHi], frameT);
        const currentFrame = createProjectedFrame(blendedFrame, currentFrameIndex, decimatedFrames.length, camera, width, height);

        drawGuideFrame(this.context, camera, width, height, this.theme);
        drawFrameStack(this.context, projectedFrames, this.theme);
        drawMesh(this.context, projectedFrames, this.theme);
        drawCurrentFrame(
            this.context,
            currentFrame,
            `Frame ${currentFrameIndex.toFixed(2)} / ${decimatedFrames.length - 1}`,
            this.theme,
            width,
        );
    }
}
