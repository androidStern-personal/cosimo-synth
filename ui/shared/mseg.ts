/**
 * Cosimo's MSEG: the persisted identifiers, the playback settings the synth
 * sends to its engine, and the serialized forms stored in patches. Curve math,
 * editing and geometry come from the kit.
 */
import * as mseg from "../../kit/ui/mseg";
export * from "../../kit/ui/mseg";

export const MSEG_DEFAULT_DEPTH = 1.0;
export const MSEG_RATE_MIN_SECONDS = 0.0;
export const MSEG_RATE_MAX_SECONDS = 2.0;
export const MSEG_RATE_KIND_SECONDS = 0;
export const MSEG_NOTE_OFF_POLICY_FINISH_LOOP = 0;
export const MSEG_NOTE_OFF_POLICY_IMMEDIATE = 1;
export const MSEG_NOTE_OFF_POLICY_IGNORE = 2;

export type MsegShape = Omit<mseg.MsegShape, "format"> & { format: "cosimo.mseg.shape" };

export type MsegPlaybackLoop = {
    startX: number;
    endX: number;
};

export type MsegPlayback = {
    format: "cosimo.mseg.playback";
    version: 1;
    rate: {
        kind: "seconds";
        seconds: number;
    };
    loop: MsegPlaybackLoop | null;
    noteOffPolicy: "finish_loop" | "immediate" | "ignore";
    legatoRestarts: boolean;
    holdFinalValue: boolean;
};

/** The engine's MSEG playback configuration event. */
export type MsegPlaybackConfigEvent = {
    seconds: number;
    holdFinalValue: boolean;
    rateKind: number;
    loopEnabled: boolean;
    loopStart: number;
    loopEnd: number;
    noteOffPolicy: number;
    legatoRestarts: boolean;
};

export type MsegState = {
    shape: MsegShape;
    shapeA?: MsegShape;
    shapeB?: MsegShape;
    referenceShape?: MsegShape;
    editShapeIndex?: 0 | 1;
    morph?: number;
    playback: MsegPlayback;
    depth: number;
};

function objectFields(value: unknown): Record<string, unknown> {
    // SAFETY: this refines only property access on an object, never a domain value.
    return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function createDefaultMsegShape(...args: Parameters<typeof mseg.createDefaultMsegShape>): MsegShape {
    return { ...mseg.createDefaultMsegShape(...args), format: "cosimo.mseg.shape" };
}

export function normalizeMsegShape(...args: Parameters<typeof mseg.normalizeMsegShape>): MsegShape {
    return { ...mseg.normalizeMsegShape(...args), format: "cosimo.mseg.shape" };
}

export function addMsegPoint(...args: Parameters<typeof mseg.addMsegPoint>): MsegShape {
    return { ...mseg.addMsegPoint(...args), format: "cosimo.mseg.shape" };
}

export function moveMsegPoint(...args: Parameters<typeof mseg.moveMsegPoint>): MsegShape {
    return { ...mseg.moveMsegPoint(...args), format: "cosimo.mseg.shape" };
}

export function deleteMsegPoint(...args: Parameters<typeof mseg.deleteMsegPoint>): MsegShape {
    return { ...mseg.deleteMsegPoint(...args), format: "cosimo.mseg.shape" };
}

export function setMsegSegmentCurvePower(...args: Parameters<typeof mseg.setMsegSegmentCurvePower>): MsegShape {
    return { ...mseg.setMsegSegmentCurvePower(...args), format: "cosimo.mseg.shape" };
}

export function serializeMsegShape(shape: unknown): string {
    return JSON.stringify(normalizeMsegShape(shape));
}

/** Stored shapes that are missing or malformed load as the default shape. */
export function deserializeMsegShape(value: unknown): MsegShape {
    if (typeof value !== "string" || !value.trim()) {
        return createDefaultMsegShape();
    }

    try {
        return normalizeMsegShape(JSON.parse(value));
    } catch {
        return createDefaultMsegShape();
    }
}

export function msegShapesEqual(left: unknown, right: unknown) {
    return serializeMsegShape(left) === serializeMsegShape(right);
}

export function clampMsegDepth(value: number) {
    return clamp(Number.isFinite(value) ? value : 0.0, -1.0, 1.0);
}

export function deserializeMsegDepth(value: unknown) {
    const numericValue = Number(value);
    return clampMsegDepth(Number.isFinite(numericValue) ? numericValue : MSEG_DEFAULT_DEPTH);
}

export function clampMsegRateSeconds(value: number) {
    const numericValue = Number(value);
    return clamp(
        Number.isFinite(numericValue) ? numericValue : 1.0,
        MSEG_RATE_MIN_SECONDS,
        MSEG_RATE_MAX_SECONDS,
    );
}

export function createDefaultMsegPlayback(): MsegPlayback {
    return {
        format: "cosimo.mseg.playback",
        version: 1,
        rate: {
            kind: "seconds",
            seconds: 1.0,
        },
        loop: { startX: 0.0, endX: 1.0 },
        noteOffPolicy: "finish_loop",
        legatoRestarts: false,
        holdFinalValue: true,
    };
}

/** A zero-length loop means no loop; a reversed loop is put back in order. */
function normalizeMsegLoop(loop: unknown): MsegPlaybackLoop | null {
    if (!loop || typeof loop !== "object") {
        return null;
    }

    const nextLoop = objectFields(loop);
    const startX = mseg.clamp01(Number(nextLoop.startX));
    const endX = mseg.clamp01(Number(nextLoop.endX));

    if (Math.abs(startX - endX) <= 1e-12) {
        return null;
    }

    return endX < startX ? { startX: endX, endX: startX } : { startX, endX };
}

export function normalizeMsegPlayback(playback: unknown = createDefaultMsegPlayback()): MsegPlayback {
    const next = objectFields(playback);
    const rate = objectFields(next.rate);
    const seconds = Number(rate.seconds);
    const noteOffPolicyCandidate = next.noteOffPolicy;
    const noteOffPolicy = (noteOffPolicyCandidate === "finish_loop" || noteOffPolicyCandidate === "immediate" || noteOffPolicyCandidate === "ignore")
        ? noteOffPolicyCandidate
        : "finish_loop";

    return {
        format: "cosimo.mseg.playback",
        version: 1,
        rate: {
            kind: "seconds",
            seconds: clampMsegRateSeconds(Number.isFinite(seconds) ? seconds : 1.0),
        },
        loop: normalizeMsegLoop(next.loop),
        noteOffPolicy,
        legatoRestarts: Boolean(next.legatoRestarts),
        holdFinalValue: next.holdFinalValue !== false,
    };
}

export function serializeMsegPlayback(playback: unknown): string {
    return JSON.stringify(normalizeMsegPlayback(playback));
}

/** Stored playback that is missing or malformed loads as the default playback. */
export function deserializeMsegPlayback(value: unknown): MsegPlayback {
    if (typeof value !== "string" || !value.trim()) {
        return createDefaultMsegPlayback();
    }

    try {
        return normalizeMsegPlayback(JSON.parse(value));
    } catch {
        return createDefaultMsegPlayback();
    }
}

export function msegPlaybacksEqual(left: unknown, right: unknown) {
    return serializeMsegPlayback(left) === serializeMsegPlayback(right);
}

export function toMsegPlaybackConfigEvent(playback: unknown): MsegPlaybackConfigEvent {
    const normalizedPlayback = normalizeMsegPlayback(playback);

    return {
        seconds: normalizedPlayback.rate.seconds,
        holdFinalValue: normalizedPlayback.holdFinalValue,
        rateKind: MSEG_RATE_KIND_SECONDS,
        loopEnabled: normalizedPlayback.loop !== null,
        loopStart: normalizedPlayback.loop?.startX ?? 0.0,
        loopEnd: normalizedPlayback.loop?.endX ?? 0.0,
        noteOffPolicy:
            normalizedPlayback.noteOffPolicy === "immediate"
                ? MSEG_NOTE_OFF_POLICY_IMMEDIATE
                : normalizedPlayback.noteOffPolicy === "ignore"
                    ? MSEG_NOTE_OFF_POLICY_IGNORE
                    : MSEG_NOTE_OFF_POLICY_FINISH_LOOP,
        legatoRestarts: normalizedPlayback.legatoRestarts,
    };
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
    return p1 + (0.5 * t * (
        (p2 - p0) + (t * (
            ((2.0 * p0) - (5.0 * p1) + (4.0 * p2) - p3) + (t * (-p0 + (3.0 * p1) - (3.0 * p2) + p3))
        ))
    ));
}

/** Reads a rendered curve at x the way the engine does: Catmull-Rom between padded samples. */
export function sampleRenderedMsegBuffer(paddedBuffer: Float32Array, x: number) {
    if (!(paddedBuffer instanceof Float32Array) || paddedBuffer.length !== mseg.MSEG_PADDED_SAMPLES) {
        throw new Error(`Rendered MSEG buffers must be a Float32Array with ${mseg.MSEG_PADDED_SAMPLES} samples`);
    }

    const clampedX = mseg.clamp01(Number(x));
    const scaled = clampedX * (mseg.MSEG_BODY_SAMPLES - 1);
    const sampleIndex = Math.floor(scaled);
    const fractional = scaled - sampleIndex;
    return catmullRom(
        paddedBuffer[sampleIndex],
        paddedBuffer[sampleIndex + 1],
        paddedBuffer[sampleIndex + 2],
        paddedBuffer[sampleIndex + 3],
        fractional,
    );
}
