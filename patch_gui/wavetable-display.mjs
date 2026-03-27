const CAMERA_YAW = 15 * (Math.PI / 180);
const CAMERA_PITCH = 26 * (Math.PI / 180);
const CAMERA_DISTANCE = 10.5;
const CAMERA_FOCAL_LENGTH = 2.4;
const FRAME_DEPTH_EXTENT = 3.6;
const AMPLITUDE_SCALE = 0.3;
const DISCONTINUITY_THRESHOLD = 0.5;
const FLOOR_Y = -0.64;
const GUIDE_TOP_Y = 0.28;

export const DEFAULT_WAVETABLE_THEME = {
    backgroundTop: "#04070f",
    backgroundBottom: "#04070f",
    backgroundRGB: [4, 7, 15],
    panelStroke: "rgba(132, 149, 255, 0.12)",
    frameColor: [94, 118, 255],
    meshColor: [102, 224, 255],
    highlightColor: [245, 108, 182],
    guideColor: "rgba(129, 150, 255, 0.12)",
    textColor: "rgba(255, 219, 166, 0.94)",
    shadowColor: "rgba(7, 11, 28, 0.36)",
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function requestNextAnimationFrame(callback) {
    if (typeof globalThis.requestAnimationFrame === "function") {
        return globalThis.requestAnimationFrame(callback);
    }

    return setTimeout(() => callback(Date.now()), 0);
}

function cancelNextAnimationFrame(handle) {
    if (typeof globalThis.cancelAnimationFrame === "function") {
        globalThis.cancelAnimationFrame(handle);
        return;
    }

    clearTimeout(handle);
}

function lerp(start, end, amount) {
    return start + ((end - start) * amount);
}

function mixRGB(from, to, amount) {
    return [
        Math.round(lerp(from[0], to[0], amount)),
        Math.round(lerp(from[1], to[1], amount)),
        Math.round(lerp(from[2], to[2], amount)),
    ];
}

function toRGBA(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}

function assertFrames(frames) {
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

function getFrameDepth(frameIndex, frameCount) {
    if (frameCount <= 1) {
        return 0;
    }

    return (frameIndex / (frameCount - 1)) * FRAME_DEPTH_EXTENT;
}

function getSceneDepth(frameIndex, frameCount) {
    return getFrameDepth(frameIndex, frameCount);
}

function getBackness(frameIndex, frameCount) {
    if (frameCount <= 1) {
        return 0;
    }

    return frameIndex / (frameCount - 1);
}

function getSceneDepthAt(frameIndex, frameCount) {
    if (frameCount <= 1) {
        return FRAME_DEPTH_EXTENT * 0.5;
    }

    return (frameIndex / (frameCount - 1)) * FRAME_DEPTH_EXTENT;
}

function getBacknessAt(frameIndex, frameCount) {
    if (frameCount <= 1) {
        return 0;
    }

    return frameIndex / (frameCount - 1);
}

function subtractPoints(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
    };
}

function crossProduct(a, b) {
    return {
        x: (a.y * b.z) - (a.z * b.y),
        y: (a.z * b.x) - (a.x * b.z),
        z: (a.x * b.y) - (a.y * b.x),
    };
}

function dotProduct(a, b) {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function normaliseVector(vector) {
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

function createViewportPadding(width, height) {
    return {
        left: clamp(width * 0.06, 22, 48),
        right: clamp(width * 0.06, 22, 48),
        top: clamp(height * 0.1, 20, 56),
        bottom: clamp(height * 0.09, 20, 52),
    };
}

function projectWorldPoint(point, camera) {
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

function projectToScreen(projectedPoint, projection) {
    return {
        x: projection.centerX + ((projectedPoint.projectedX - projection.projectedCenterX) * projection.scale),
        y: projection.centerY - ((projectedPoint.projectedY - projection.projectedCenterY) * projection.scale),
        cameraDepth: projectedPoint.cameraDepth,
        perspective: projectedPoint.perspective,
    };
}

function createProjection(points, width, height) {
    const padding = createViewportPadding(width, height);
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
        (width - padding.left - padding.right) / spanX,
        (height - padding.top - padding.bottom) / spanY
    );

    return {
        width,
        height,
        scale,
        padding,
        projectedCenterX: (minX + maxX) * 0.5,
        projectedCenterY: (minY + maxY) * 0.5,
        centerX: width * 0.5,
        centerY: height * 0.46,
    };
}

function getSurfacePointCount(width, sampleCount) {
    return clamp(Math.round(width / 10), 64, Math.min(128, sampleCount));
}

function getContourPointCount(width, sampleCount) {
    return clamp(Math.round(width / 4), 128, Math.min(256, sampleCount));
}

function createObjectPoints(samples, depth) {
    const points = new Array(samples.length);
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

function createProjectedFrame(samples, frameIndex, frameCount, camera, projection) {
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

function createGuideLine(pointList, camera, projection) {
    return pointList.map((point) => {
        const projectedPoint = projectWorldPoint(point, camera);

        return projectToScreen(projectedPoint, projection);
    });
}

function createGuideLines(camera, projection) {
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

function buildProjectionFromFrames(contourSamples, width, height, frameCount) {
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
        projection: createProjection(projectedAnchors, width, height),
    };
}

function getSparseContourIndices(frameCount, frameState) {
    const contourIndices = new Set([0, frameCount - 1, frameState.frameLo, frameState.frameHi]);

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 4) {
        contourIndices.add(frameIndex);
    }

    return [...contourIndices].sort((left, right) => left - right);
}

function createContourDescriptors(projectedFrames, frameState) {
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

function createSurfaceBands(projectedFrames) {
    const bands = [];

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

function createSurfaceRibs(projectedFrames) {
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

function createPolylineSegments(points, samples, threshold = DISCONTINUITY_THRESHOLD) {
    if (points.length <= 1) {
        return [];
    }

    const segments = [];
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

function createInterpolatedSurfaceSlices(sourceFrames, camera, projection) {
    const frameCount = sourceFrames.length;

    if (frameCount === 0) {
        return [];
    }

    const sliceCount = clamp((frameCount * 3) - 2, 17, 41);
    const slices = [];

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

function buildInterpolatedFrame(lowFrame, highFrame, amount) {
    const output = new Float32Array(lowFrame.length);

    for (let sampleIndex = 0; sampleIndex < lowFrame.length; sampleIndex += 1) {
        output[sampleIndex] = lerp(lowFrame[sampleIndex], highFrame[sampleIndex], amount);
    }

    return output;
}

function createCurrentSlice(staticScene, frameState) {
    const lowFrame = staticScene.contourFrames[frameState.frameLo];
    const highFrame = staticScene.contourFrames[frameState.frameHi];
    const blendedSamples = buildInterpolatedFrame(lowFrame.samples, highFrame.samples, frameState.frameT);
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
        text: `Frame ${frameState.frameIndex.toFixed(2)} / ${staticScene.frameCount - 1}`,
        x: clamp(labelAnchor.x + 14, 18, staticScene.width - 180),
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

export function createFrameState(frameCount, position) {
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
    };
}

export function decimateFrame(frame, targetPointCount) {
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
}) {
    assertFrames(frames);

    const safeWidth = Math.max(180, Math.floor(width || 0));
    const safeHeight = Math.max(140, Math.floor(height || 0));
    const frameCount = frames.length;
    const contourPointCount = getContourPointCount(safeWidth, frames[0].length);
    const surfacePointCount = getSurfacePointCount(safeWidth, frames[0].length);
    const contourSamples = frames.map((frame) => decimateFrame(frame, contourPointCount));
    const surfaceSamples = frames.map((frame) => decimateFrame(frame, surfacePointCount));
    const { camera, projection } = buildProjectionFromFrames(contourSamples, safeWidth, safeHeight, frameCount);
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
    width = 640,
    height = 320,
    pixelRatio = 1,
    staticScene = null,
}) {
    const scene = staticScene ?? buildWavetableStaticScene({
        frames,
        width,
        height,
        pixelRatio,
    });
    const frameState = createFrameState(scene.frameCount, position);

    return {
        ...scene,
        frameState,
        contours: createContourDescriptors(scene.contourFrames, frameState),
        currentSlice: createCurrentSlice(scene, frameState),
    };
}

function tracePath(context, points) {
    points.forEach((point, pointIndex) => {
        if (pointIndex === 0) {
            context.moveTo(point.x, point.y);
        } else {
            context.lineTo(point.x, point.y);
        }
    });
}

function strokePolylineSegments(context, segments) {
    for (const segment of segments) {
        if (segment.length < 2) {
            continue;
        }

        context.beginPath();
        tracePath(context, segment);
        context.stroke();
    }
}

export function drawWavetableModel(context, model, theme = DEFAULT_WAVETABLE_THEME) {
    const meshColour = mixRGB(theme.meshColor, [214, 246, 255], 0.34);
    const gradient = context.createLinearGradient?.(0, 0, 0, model.height);

    if (gradient) {
        gradient.addColorStop(0, theme.backgroundTop);
        gradient.addColorStop(1, theme.backgroundBottom);
        context.fillStyle = gradient;
    } else {
        context.fillStyle = theme.backgroundBottom;
    }

    context.clearRect(0, 0, model.width, model.height);
    context.fillRect(0, 0, model.width, model.height);

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
        context.fillStyle = toRGBA(bandColour, alpha);
        context.beginPath();
        tracePath(context, band.points);
        context.closePath?.();
        context.fill();
        context.restore();
    }

    for (const slice of model.surfaceSlices) {
        context.save();
        context.strokeStyle = toRGBA(meshColour, Math.min(0.46, slice.alpha * 2.05));
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
        context.strokeStyle = toRGBA(strokeColour, contour.alpha);
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

    context.save();
    context.fillStyle = toRGBA(theme.backgroundRGB, 0.74);
    context.fillRect(model.currentSlice.label.x - 10, model.currentSlice.label.y - 14, 154, 24);
    context.fillStyle = theme.textColor;
    context.font = "600 12px Avenir Next, Avenir, sans-serif";
    context.textAlign = "left";
    context.fillText(model.currentSlice.label.text, model.currentSlice.label.x, model.currentSlice.label.y + 2);
    context.restore();
}

export class CanvasWavetableDisplay {
    constructor(
        canvas,
        {
            theme = DEFAULT_WAVETABLE_THEME,
            requestAnimationFrame = requestNextAnimationFrame,
            cancelAnimationFrame = cancelNextAnimationFrame,
        } = {}
    ) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.theme = theme;
        this.requestAnimationFrame = requestAnimationFrame;
        this.cancelAnimationFrame = cancelAnimationFrame;
        this.frames = [];
        this.position = 0;
        this.devicePixelRatio = 1;
        this.cssWidth = 0;
        this.cssHeight = 0;
        this.staticScene = null;
        this.staticKey = "";
        this.pendingRenderHandle = null;
    }

    invalidateStaticScene() {
        this.staticScene = null;
        this.staticKey = "";
    }

    setFrames(frames) {
        assertFrames(frames);
        this.frames = frames.map((frame) =>
            frame instanceof Float32Array ? frame.slice() : Float32Array.from(frame)
        );
        this.invalidateStaticScene();
        this.queueRender();
    }

    setPosition(position) {
        this.position = clamp(Number(position) || 0, 0, 1);
        this.queueRender();
    }

    resize(width, height, devicePixelRatio = 1) {
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

    getStaticScene(width, height) {
        const nextKey = [
            this.frames.length,
            this.frames[0]?.length ?? 0,
            width,
            height,
            this.devicePixelRatio,
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
        });

        return this.staticScene;
    }

    queueRender() {
        if (this.pendingRenderHandle !== null) {
            return;
        }

        this.pendingRenderHandle = this.requestAnimationFrame(() => {
            this.pendingRenderHandle = null;
            this.render();
        });
    }

    render() {
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
        });

        drawWavetableModel(this.context, model, this.theme);
    }
}
