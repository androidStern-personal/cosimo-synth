import type { BounceCaptureResult } from "./capture.mjs";

/** JSON values preserved by Bounce patch documents. */
export type BounceJsonValue =
    | null
    | boolean
    | string
    | number
    | ReadonlyArray<BounceJsonValue>
    | { readonly [key: string]: BounceJsonValue };

/** Immutable complete patch snapshot used by Bounce transactions. */
export type BouncePatchDocument = {
    readonly format: "cosimo.patch-document";
    readonly version: 1;
    readonly parameters: Readonly<Record<string, number>>;
    readonly storedState: Readonly<Record<string, BounceJsonValue>>;
};

/** One root's persisted location and note-off boundary. */
export type BounceDocumentSegment = {
    readonly rootNote: number;
    readonly frameOffset: number;
    readonly frameCount: number;
    readonly noteOffFrameOffset: number;
};

/** Lightweight persisted reference to one content-addressed Bounce bank. */
export type BounceDocument = {
    readonly format: "cosimo.bounce";
    readonly version: 1;
    readonly digest: string;
    readonly bankByteLength: number;
    readonly roots: ReadonlyArray<number>;
    readonly segments: ReadonlyArray<BounceDocumentSegment>;
    readonly capture: {
        readonly sampleRate: number;
        readonly tempoBpm: number;
        readonly velocity: 100;
        readonly holdFrames: number;
        readonly tailCapFrames: number;
    };
    readonly generation: number;
    readonly revertRef: {
        readonly bankDigest: string | null;
        readonly patchDocument: BouncePatchDocument;
    };
};

/** Stored-state key that owns the lightweight Bounce reference. */
export const BOUNCE_STATE_KEY: "bounce.v1";
/** Bounce document wire-format identifier. */
export const BOUNCE_DOCUMENT_FORMAT: "cosimo.bounce";
/** Bounce document wire-format version. */
export const BOUNCE_DOCUMENT_VERSION: 1;
/** Full patch-document wire-format identifier. */
export const BOUNCE_PATCH_DOCUMENT_FORMAT: "cosimo.patch-document";
/** Full patch-document wire-format version. */
export const BOUNCE_PATCH_DOCUMENT_VERSION: 1;
/** Stored-state key for the current modulation document. */
export const MODULATION_STATE_KEY: "modulation.v6";
/** Stored-state key for the current Effects Lane document. */
export const LANE_STATE_KEY: "lane.v1";
/** Stored-state key for the current articulation document. */
export const ARTICULATIONS_STATE_KEY: "articulations.v4";

/** Canonically serialize validated JSON-compatible data. */
export function canonicalJsonStringify(value: unknown): string;

/** Construct and normalize an immutable complete patch document. */
export function createBouncePatchDocument(input: {
    readonly parameters: Readonly<Record<string, number>>;
    readonly storedState: Readonly<Record<string, unknown>>;
}): BouncePatchDocument;

/** Parse unknown input into the exact current patch-document contract. */
export function parseBouncePatchDocument(value: unknown): BouncePatchDocument;

/** Serialize an exact current patch document. */
export function serializeBouncePatchDocument(document: unknown): string;

/** Produce the post-Bounce neutralized patch while preserving unrelated state. */
export function createNeutralBouncePatchDocument(document: unknown): BouncePatchDocument;

/** Parse unknown input into the exact current bounce.v1 contract. */
export function parseBounceDocument(value: unknown): BounceDocument;

/** Serialize an exact current bounce.v1 document. */
export function serializeBounceDocument(document: unknown): string;

/** Read and parse bounce.v1 from a complete patch document. */
export function readBounceDocumentFromPatch(document: unknown): BounceDocument | null;

/** Build the next bounce.v1 reference from a verified capture. */
export function createBounceDocument(
    capture: BounceCaptureResult,
    preBouncePatchDocument: unknown,
): BounceDocument;

/** Attach a validated bounce.v1 reference to a complete patch document. */
export function attachBounceDocument(
    patchDocument: unknown,
    bounceDocument: unknown,
): BouncePatchDocument;
