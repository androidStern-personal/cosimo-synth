export const BOUNCE_CAPTURE_SNAPSHOT_FORMAT = "cosimo.bounce-capture-snapshot";
export const BOUNCE_CAPTURE_SNAPSHOT_VERSION = 1;
export const BOUNCE_CAPTURE_PLAN_FORMAT = "cosimo.bounce-capture-plan";
export const BOUNCE_CAPTURE_PLAN_VERSION = 1;

export const BOUNCE_DEFAULT_ROOTS = Object.freeze(
    Array.from({ length: 19 }, (_, index) => 24 + (index * 4)),
);
export const BOUNCE_CAPTURE_VELOCITY = 100;
export const BOUNCE_DEFAULT_HOLD_SECONDS = 3;
export const BOUNCE_DEFAULT_TAIL_CAP_SECONDS = 6;
export const BOUNCE_SILENCE_THRESHOLD_DBFS = -80;
export const BOUNCE_SILENCE_THRESHOLD_LINEAR = 10 ** (BOUNCE_SILENCE_THRESHOLD_DBFS / 20);
export const BOUNCE_SILENCE_WINDOW_SECONDS = 0.05;
export const BOUNCE_TAIL_PADDING_SECONDS = 0.10;
export const BOUNCE_OFFLINE_BLOCK_FRAMES = 128;

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function isPlainObject(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function cloneWireValue(value, field = "value") {
    if (value === null || typeof value === "boolean" || typeof value === "string") return value;
    if (typeof value === "number") {
        invariant(Number.isFinite(value), `${field} must be finite`);
        return value;
    }
    if (ArrayBuffer.isView(value)) {
        invariant(!(value instanceof DataView), `${field} cannot be a DataView`);
        return value.slice();
    }
    if (value instanceof ArrayBuffer) return value.slice(0);
    if (Array.isArray(value)) {
        return value.map((entry, index) => cloneWireValue(entry, `${field}[${index}]`));
    }
    invariant(isPlainObject(value), `${field} must be structured-clone data`);
    return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, cloneWireValue(value[key], `${field}.${key}`)]),
    );
}

function normalizeEndpointID(endpointID, field) {
    invariant(typeof endpointID === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(endpointID),
        `${field} must be a Cmajor endpoint ID`);
    return endpointID;
}

function normalizeParameters(parameters) {
    const entries = Array.isArray(parameters)
        ? parameters.map((entry) => [entry?.endpointID, entry?.value])
        : Object.entries(parameters ?? {});
    const normalized = entries.map(([endpointID, value], index) => ({
        endpointID: normalizeEndpointID(endpointID, `parameters[${index}].endpointID`),
        value: cloneWireValue(value, `parameters.${endpointID}`),
    }));
    normalized.sort((left, right) => left.endpointID.localeCompare(right.endpointID));
    for (let index = 1; index < normalized.length; index += 1) {
        invariant(normalized[index - 1].endpointID !== normalized[index].endpointID,
            `Duplicate capture parameter ${normalized[index].endpointID}`);
    }
    return normalized;
}

function normalizeSetupEvents(events) {
    invariant(Array.isArray(events), "setupEvents must be an array");
    return events.map((entry, index) => {
        const advanceFrames = entry?.advanceFrames ?? 1;
        const sessionScoped = entry?.sessionScoped ?? false;
        invariant(Number.isInteger(advanceFrames) && advanceFrames >= 0,
            `setupEvents[${index}].advanceFrames must be a non-negative integer`);
        invariant(typeof sessionScoped === "boolean",
            `setupEvents[${index}].sessionScoped must be boolean`);
        return {
            endpointID: normalizeEndpointID(entry?.endpointID, `setupEvents[${index}].endpointID`),
            value: cloneWireValue(entry?.value, `setupEvents[${index}].value`),
            advanceFrames,
            sessionScoped,
        };
    });
}

/**
 * Capture snapshots are immutable recipes, not references to the live patch.
 * Every parameter and structured runtime event is cloned at button-press time,
 * so edits made while workers render cannot leak into the result.
 */
export function createBounceCaptureSnapshot({
    sampleRate,
    tempoBpm = 120,
    parameters = {},
    setupEvents = [],
    settleFrames = BOUNCE_OFFLINE_BLOCK_FRAMES,
    sourceGeneration = 0,
    sourceBankDigest = null,
} = {}) {
    invariant(Number.isInteger(sampleRate) && sampleRate >= 8_000 && sampleRate <= 384_000,
        "Capture sampleRate must be an integer from 8000 to 384000 Hz");
    invariant(typeof tempoBpm === "number" && Number.isFinite(tempoBpm) && tempoBpm > 0,
        "Capture tempoBpm must be positive and finite");
    invariant(Number.isInteger(settleFrames) && settleFrames >= 1,
        "Capture settleFrames must be a positive integer");
    invariant(Number.isInteger(sourceGeneration) && sourceGeneration >= 0,
        "Capture sourceGeneration must be a non-negative integer");
    invariant(sourceBankDigest === null || typeof sourceBankDigest === "string",
        "Capture sourceBankDigest must be null or a string");

    return Object.freeze({
        format: BOUNCE_CAPTURE_SNAPSHOT_FORMAT,
        version: BOUNCE_CAPTURE_SNAPSHOT_VERSION,
        sampleRate,
        tempoBpm,
        parameters: Object.freeze(normalizeParameters(parameters).map(Object.freeze)),
        setupEvents: Object.freeze(normalizeSetupEvents(setupEvents).map(Object.freeze)),
        settleFrames,
        sourceGeneration,
        sourceBankDigest,
    });
}

export function validateBounceCaptureSnapshot(snapshot) {
    invariant(snapshot?.format === BOUNCE_CAPTURE_SNAPSHOT_FORMAT
        && snapshot?.version === BOUNCE_CAPTURE_SNAPSHOT_VERSION,
    "Unsupported Bounce capture snapshot");
    // Re-normalization is intentional at worker boundaries: a structured clone
    // strips Object.freeze, and untrusted persisted recipes must be checked again.
    return createBounceCaptureSnapshot(snapshot);
}

function normalizeRoots(roots) {
    invariant(Array.isArray(roots) && roots.length > 0 && roots.length <= 19,
        "Capture roots must contain 1 to 19 MIDI notes");
    let previous = -1;
    return roots.map((note, index) => {
        invariant(Number.isInteger(note) && note >= 0 && note <= 127,
            `Capture root ${index} is not a MIDI note`);
        invariant(note > previous, "Capture roots must be strictly ascending");
        previous = note;
        return note;
    });
}

/** Build the platform-neutral, deterministic work list consumed by all drivers. */
export function createBounceCapturePlan(snapshotInput, {
    roots = BOUNCE_DEFAULT_ROOTS,
    holdSeconds = BOUNCE_DEFAULT_HOLD_SECONDS,
    tailCapSeconds = BOUNCE_DEFAULT_TAIL_CAP_SECONDS,
    captureVelocity = BOUNCE_CAPTURE_VELOCITY,
    blockFrames = BOUNCE_OFFLINE_BLOCK_FRAMES,
} = {}) {
    const snapshot = validateBounceCaptureSnapshot(snapshotInput);
    const normalizedRoots = normalizeRoots(roots);
    invariant(typeof holdSeconds === "number" && Number.isFinite(holdSeconds) && holdSeconds > 0,
        "Capture holdSeconds must be positive and finite");
    invariant(typeof tailCapSeconds === "number" && Number.isFinite(tailCapSeconds)
        && tailCapSeconds > 0 && tailCapSeconds <= BOUNCE_DEFAULT_TAIL_CAP_SECONDS,
    `Capture tailCapSeconds must be in (0, ${BOUNCE_DEFAULT_TAIL_CAP_SECONDS}]`);
    invariant(Number.isInteger(captureVelocity) && captureVelocity === BOUNCE_CAPTURE_VELOCITY,
        `Bounce V1 captures at velocity ${BOUNCE_CAPTURE_VELOCITY}`);
    invariant(Number.isInteger(blockFrames) && blockFrames >= 1 && blockFrames <= 128,
        "Offline blockFrames must be from 1 to 128");

    const holdFrames = Math.max(1, Math.round(holdSeconds * snapshot.sampleRate));
    const tailCapFrames = Math.max(1, Math.round(tailCapSeconds * snapshot.sampleRate));
    const silenceWindowFrames = Math.max(1,
        Math.round(BOUNCE_SILENCE_WINDOW_SECONDS * snapshot.sampleRate));
    const tailPaddingFrames = Math.max(silenceWindowFrames,
        Math.round(BOUNCE_TAIL_PADDING_SECONDS * snapshot.sampleRate));
    const jobs = normalizedRoots.map((rootNote, rootIndex) => Object.freeze({
        rootIndex,
        rootNote,
        // Stable across identical bounces, while remaining distinct per root.
        sessionID: 0x424000 + rootIndex,
    }));

    return Object.freeze({
        format: BOUNCE_CAPTURE_PLAN_FORMAT,
        version: BOUNCE_CAPTURE_PLAN_VERSION,
        snapshot,
        roots: Object.freeze(normalizedRoots),
        captureVelocity,
        holdFrames,
        tailCapFrames,
        silenceThresholdLinear: BOUNCE_SILENCE_THRESHOLD_LINEAR,
        silenceWindowFrames,
        tailPaddingFrames,
        blockFrames,
        jobs: Object.freeze(jobs),
    });
}

export function validateBounceCapturePlan(plan) {
    invariant(plan?.format === BOUNCE_CAPTURE_PLAN_FORMAT
        && plan?.version === BOUNCE_CAPTURE_PLAN_VERSION,
    "Unsupported Bounce capture plan");
    return createBounceCapturePlan(plan.snapshot, {
        roots: plan.roots,
        holdSeconds: plan.holdFrames / plan.snapshot.sampleRate,
        tailCapSeconds: plan.tailCapFrames / plan.snapshot.sampleRate,
        captureVelocity: plan.captureVelocity,
        blockFrames: plan.blockFrames,
    });
}
