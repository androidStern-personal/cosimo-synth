import type { PatchConnectionLike } from "../kit/ui/cmajor-react";
import type { BouncePatchDocument } from "./document.mjs";

/** Stored-state keys captured atomically for a Bounce transaction. */
export const BOUNCE_PATCH_STORED_STATE_KEYS: readonly [
    "modulation.v6",
    "articulations.v4",
    "lane.v1",
    "bounce.v1",
];
/** Timeout applied to each live patch read operation. */
export const BOUNCE_PATCH_IO_TIMEOUT_MS: 8_000;

/** Parse the parameter endpoint IDs from a Cmajor status payload. */
export function parameterIDsFromPatchStatus(status: unknown): ReadonlyArray<string>;

/** Read every host parameter and structured document at one logical press time. */
export function captureLiveBouncePatchDocument(
    connection: PatchConnectionLike,
    options?: {
        readonly parameterIDs?: ReadonlyArray<string> | null;
        readonly storedStateKeys?: ReadonlyArray<string>;
        readonly storedStateDefaults?: Readonly<Record<string, unknown>>;
        readonly timeoutMilliseconds?: number;
    },
): Promise<BouncePatchDocument>;

/** Queue a complete document, writing Source Mode only after its dependencies. */
export function applyLiveBouncePatchDocument(
    connection: PatchConnectionLike,
    document: unknown,
): void;

/** Focused stored-state parser exposed for the plain-Node adapter tests. */
export const bouncePatchDocumentAdapterInternals: Readonly<{
    fullStoredStateValues(value: unknown): Readonly<Record<string, unknown>>;
}>;
