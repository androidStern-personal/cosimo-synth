export const BOUNCE_STATE_KEY = "bounce.v1";
export const BOUNCE_DOCUMENT_FORMAT = "cosimo.bounce";
export const BOUNCE_DOCUMENT_VERSION = 1;
export const BOUNCE_PATCH_DOCUMENT_FORMAT = "cosimo.patch-document";
export const BOUNCE_PATCH_DOCUMENT_VERSION = 1;

export const MODULATION_STATE_KEY = "modulation.v6";
export const LANE_STATE_KEY = "lane.v1";
export const ARTICULATIONS_STATE_KEY = "articulations.v4";

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonValue(value, field = "value") {
    if (value === null || typeof value === "boolean" || typeof value === "string") return value;
    if (typeof value === "number") {
        invariant(Number.isFinite(value), `${field} must be finite JSON data`);
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((entry, index) => cloneJsonValue(entry, `${field}[${index}]`));
    }
    invariant(isRecord(value), `${field} must be JSON-compatible`);
    return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, cloneJsonValue(value[key], `${field}.${key}`)]),
    );
}

function parseJsonDocument(value, field) {
    if (typeof value !== "string") return cloneJsonValue(value, field);
    try {
        return cloneJsonValue(JSON.parse(value), field);
    } catch (cause) {
        throw new Error(`${field} is not valid JSON: ${cause instanceof Error ? cause.message : cause}`);
    }
}

function preserveStoredEncoding(original, value) {
    return typeof original === "string" ? canonicalJsonStringify(value) : cloneJsonValue(value);
}

export function canonicalJsonStringify(value) {
    return JSON.stringify(cloneJsonValue(value));
}

export function createBouncePatchDocument({ parameters, storedState } = {}) {
    invariant(isRecord(parameters), "Bounce patch parameters must be an object");
    invariant(isRecord(storedState), "Bounce patch storedState must be an object");
    const normalizedParameters = {};
    for (const endpointID of Object.keys(parameters).sort()) {
        const value = parameters[endpointID];
        invariant(/^[A-Za-z_][A-Za-z0-9_]*$/.test(endpointID),
            `Invalid Bounce parameter endpoint ${endpointID}`);
        invariant(typeof value === "number" && Number.isFinite(value),
            `Bounce parameter ${endpointID} must be finite`);
        normalizedParameters[endpointID] = value;
    }
    return Object.freeze({
        format: BOUNCE_PATCH_DOCUMENT_FORMAT,
        version: BOUNCE_PATCH_DOCUMENT_VERSION,
        parameters: Object.freeze(normalizedParameters),
        storedState: Object.freeze(cloneJsonValue(storedState, "storedState")),
    });
}

export function parseBouncePatchDocument(value) {
    const parsed = parseJsonDocument(value, "Bounce patch document");
    invariant(isRecord(parsed)
        && parsed.format === BOUNCE_PATCH_DOCUMENT_FORMAT
        && parsed.version === BOUNCE_PATCH_DOCUMENT_VERSION,
    "Unsupported Bounce patch document");
    invariant(Object.keys(parsed).sort().join(",") === "format,parameters,storedState,version",
        "Bounce patch document has unexpected fields");
    return createBouncePatchDocument(parsed);
}

export function serializeBouncePatchDocument(document) {
    return canonicalJsonStringify(parseBouncePatchDocument(document));
}

function neutralizeModulation(value) {
    const document = parseJsonDocument(value, MODULATION_STATE_KEY);
    invariant(isRecord(document) && document.format === "cosimo.modulation"
        && document.version === 6 && Array.isArray(document.routes),
    `${MODULATION_STATE_KEY} is not a current modulation document`);
    return preserveStoredEncoding(value, { ...document, routes: [] });
}

function neutralizeLane(value) {
    const document = parseJsonDocument(value, LANE_STATE_KEY);
    invariant(isRecord(document) && document.format === "cosimo.lane"
        && document.version === 1 && isRecord(document.enabled),
    `${LANE_STATE_KEY} is not a current Effects Lane document`);
    return preserveStoredEncoding(value, {
        ...document,
        enabled: Object.fromEntries(Object.keys(document.enabled).sort().map((key) => [key, false])),
    });
}

function neutralizeArticulations(value) {
    const document = parseJsonDocument(value, ARTICULATIONS_STATE_KEY);
    invariant(isRecord(document) && document.format === "cosimo.articulations"
        && document.version === 4 && Array.isArray(document.slots),
    `${ARTICULATIONS_STATE_KEY} is not a current articulation document`);
    const slots = document.slots.map((slot, index) => {
        invariant(isRecord(slot) && isRecord(slot.overrides) && isRecord(slot.routeAmounts),
            `${ARTICULATIONS_STATE_KEY}.slots[${index}] is malformed`);
        const overrides = Object.fromEntries(
            Object.entries(slot.overrides).filter(([key]) => (
                key !== "filterMode" && key !== "filterCutoffHz" && key !== "filterQ"
            )),
        );
        return { ...slot, overrides, routeAmounts: {} };
    });
    return preserveStoredEncoding(value, { ...document, slots });
}

/**
 * Apply only the locked fresh-layer changes. Generator shapes/names and all
 * host parameters other than Source Mode + Filter Mode survive byte-for-byte
 * in the parsed document; oscillator controls remain present but runtime-inert.
 */
export function createNeutralBouncePatchDocument(documentInput) {
    const document = parseBouncePatchDocument(documentInput);
    invariant(Object.hasOwn(document.parameters, "sourceMode"),
        "Bounce patch document is missing sourceMode");
    invariant(Object.hasOwn(document.parameters, "filterMode"),
        "Bounce patch document is missing filterMode");
    for (const key of [MODULATION_STATE_KEY, LANE_STATE_KEY, ARTICULATIONS_STATE_KEY]) {
        invariant(Object.hasOwn(document.storedState, key),
            `Bounce patch document is missing ${key}`);
    }

    return createBouncePatchDocument({
        parameters: {
            ...document.parameters,
            filterMode: 0,
            sourceMode: 1,
        },
        storedState: {
            ...document.storedState,
            [MODULATION_STATE_KEY]: neutralizeModulation(document.storedState[MODULATION_STATE_KEY]),
            [LANE_STATE_KEY]: neutralizeLane(document.storedState[LANE_STATE_KEY]),
            [ARTICULATIONS_STATE_KEY]: neutralizeArticulations(
                document.storedState[ARTICULATIONS_STATE_KEY],
            ),
        },
    });
}

function readStoredBounceValue(patchDocument) {
    return patchDocument.storedState[BOUNCE_STATE_KEY] ?? null;
}

export function parseBounceDocument(value) {
    const parsed = parseJsonDocument(value, BOUNCE_STATE_KEY);
    invariant(isRecord(parsed)
        && parsed.format === BOUNCE_DOCUMENT_FORMAT
        && parsed.version === BOUNCE_DOCUMENT_VERSION,
    "Unsupported bounce.v1 document");
    const exactKeys = [
        "bankByteLength",
        "capture",
        "digest",
        "format",
        "generation",
        "revertRef",
        "roots",
        "segments",
        "version",
    ];
    invariant(Object.keys(parsed).sort().join(",") === exactKeys.sort().join(","),
        "bounce.v1 has unexpected fields");
    invariant(typeof parsed.digest === "string" && /^[0-9a-f]{64}$/.test(parsed.digest),
        "bounce.v1 digest must be lowercase SHA-256");
    invariant(Number.isInteger(parsed.generation) && parsed.generation > 0,
        "bounce.v1 generation must be positive");
    invariant(Number.isInteger(parsed.bankByteLength) && parsed.bankByteLength > 0,
        "bounce.v1 bankByteLength must be positive");
    invariant(Array.isArray(parsed.roots) && parsed.roots.length > 0
        && parsed.roots.every((root) => Number.isInteger(root) && root >= 0 && root <= 127),
    "bounce.v1 roots are invalid");
    invariant(Array.isArray(parsed.segments) && parsed.segments.length === parsed.roots.length,
        "bounce.v1 segments must match roots");
    let expectedOffset = 0;
    parsed.segments.forEach((segment, index) => {
        invariant(isRecord(segment)
            && segment.rootNote === parsed.roots[index]
            && segment.frameOffset === expectedOffset
            && Number.isInteger(segment.frameCount) && segment.frameCount > 0
            && Number.isInteger(segment.noteOffFrameOffset)
            && segment.noteOffFrameOffset > 0
            && segment.noteOffFrameOffset < segment.frameCount,
        `bounce.v1 segment ${index} is invalid`);
        expectedOffset += segment.frameCount;
    });
    invariant(isRecord(parsed.capture)
        && Number.isInteger(parsed.capture.sampleRate) && parsed.capture.sampleRate > 0
        && typeof parsed.capture.tempoBpm === "number" && parsed.capture.tempoBpm > 0
        && parsed.capture.velocity === 100
        && Number.isInteger(parsed.capture.holdFrames) && parsed.capture.holdFrames > 0
        && Number.isInteger(parsed.capture.tailCapFrames) && parsed.capture.tailCapFrames > 0,
    "bounce.v1 capture metadata is invalid");
    invariant(isRecord(parsed.revertRef), "bounce.v1 revertRef is invalid");
    const previousBankDigest = parsed.revertRef.bankDigest;
    invariant(previousBankDigest === null
        || (typeof previousBankDigest === "string" && /^[0-9a-f]{64}$/.test(previousBankDigest)),
    "bounce.v1 revert bank digest is invalid");
    const revertDocument = parseBouncePatchDocument(parsed.revertRef.patchDocument);

    return Object.freeze({
        ...cloneJsonValue(parsed),
        revertRef: Object.freeze({
            bankDigest: previousBankDigest,
            patchDocument: revertDocument,
        }),
    });
}

export function serializeBounceDocument(document) {
    return canonicalJsonStringify(parseBounceDocument(document));
}

export function readBounceDocumentFromPatch(documentInput) {
    const document = parseBouncePatchDocument(documentInput);
    const value = readStoredBounceValue(document);
    return value === null ? null : parseBounceDocument(value);
}

export function createBounceDocument(capture, preBouncePatchDocumentInput) {
    const preBouncePatchDocument = parseBouncePatchDocument(preBouncePatchDocumentInput);
    invariant(capture?.bytes instanceof Uint8Array && capture.bytes.byteLength > 0,
        "Bounce capture bytes are missing");
    invariant(typeof capture.digest === "string" && /^[0-9a-f]{64}$/.test(capture.digest),
        "Bounce capture digest is invalid");
    invariant(capture?.plan?.snapshot && Array.isArray(capture?.segments),
        "Bounce capture metadata is missing");
    const previousBounce = readBounceDocumentFromPatch(preBouncePatchDocument);
    const document = {
        format: BOUNCE_DOCUMENT_FORMAT,
        version: BOUNCE_DOCUMENT_VERSION,
        digest: capture.digest,
        bankByteLength: capture.bytes.byteLength,
        roots: [...capture.plan.roots],
        segments: capture.segments.map((segment) => ({
            rootNote: segment.rootNote,
            frameOffset: segment.frameOffset,
            frameCount: segment.frameCount,
            noteOffFrameOffset: segment.noteOffFrameOffset,
        })),
        capture: {
            sampleRate: capture.plan.snapshot.sampleRate,
            tempoBpm: capture.plan.snapshot.tempoBpm,
            velocity: capture.plan.captureVelocity,
            holdFrames: capture.plan.holdFrames,
            tailCapFrames: capture.plan.tailCapFrames,
        },
        generation: (previousBounce?.generation ?? 0) + 1,
        revertRef: {
            bankDigest: previousBounce?.digest ?? null,
            patchDocument: preBouncePatchDocument,
        },
    };
    return parseBounceDocument(document);
}

export function attachBounceDocument(patchDocumentInput, bounceDocumentInput) {
    const patchDocument = parseBouncePatchDocument(patchDocumentInput);
    const bounceDocument = parseBounceDocument(bounceDocumentInput);
    return createBouncePatchDocument({
        parameters: patchDocument.parameters,
        storedState: {
            ...patchDocument.storedState,
            [BOUNCE_STATE_KEY]: serializeBounceDocument(bounceDocument),
        },
    });
}
