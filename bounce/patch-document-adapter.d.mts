import type { PatchConnectionLike } from "../kit/ui/cmajor-react";
import type { PluginStateFields } from "../kit/ui/plugin-state-definition";
import type { BouncePatchDocument } from "./document.mjs";

/** The plugin's stored documents a Bounce transaction captures and restores. */
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

/**
 * Read every host parameter at the press and pair them with the plugin's
 * current stored documents, as one immutable patch document.
 */
export function captureLiveBouncePatchDocument(
    connection: PatchConnectionLike,
    options: {
        readonly storedState: Readonly<Record<string, unknown>>;
        readonly parameterIDs?: ReadonlyArray<string> | null;
        readonly timeoutMilliseconds?: number;
    },
): Promise<BouncePatchDocument>;

/**
 * The plugin-state edit that makes a patch document the current sound: every
 * declared parameter the document holds, and every declared stored field it
 * holds, parsed by that field's codec.
 */
export function bouncePatchDocumentChanges(
    definition: PluginStateFields,
    document: unknown,
): Record<string, unknown>;
