import type { EffectPresetV2 } from "./effects/effect-preset-v2";
import { assertNoDuplicateJsonKeys } from "./effects/effect-preset-schema";

export const SOUND_SHARE_ENVELOPE_FORMAT = "cosimo.soundShare";
export const SOUND_SHARE_ENVELOPE_VERSION = 2;

export type SoundShareErrorTag =
    | "InvalidEnvelope"
    | "InvalidFragment"
    | "UnsupportedVersion"
    | "CompressionUnavailable"
    | "CompressionFailed"
    | "DecompressionFailed"
    | "PayloadTooLarge"
    | "URLTooLong"
    | "UnavailableWavetable"
    | "InvalidURL"
    | "HistoryUpdateFailed";

export class SoundShareError extends Error {
    constructor(
        readonly _tag: SoundShareErrorTag,
        message: string,
        options: { readonly cause?: unknown } = {},
    ) {
        super(message, options);
        this.name = "SoundShareError";
    }
}

export type SoundShareResult<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: SoundShareError };

export type SoundShareEnvelopeV2<TPreset = unknown> = {
    readonly format: typeof SOUND_SHARE_ENVELOPE_FORMAT;
    readonly version: typeof SOUND_SHARE_ENVELOPE_VERSION;
    /** The preset-v2 carrier owns public parameters, contract identity, and
        the stored-state documents already covered by that contract. */
    readonly preset: TPreset;
    /** Sound documents intentionally outside preset-v2 (currently lane.v2 in
        the historical `lane.v1` slot). The owning synth adapter parses them. */
    readonly supplementalStoredState: Readonly<Record<string, unknown>>;
};

type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

const ENVELOPE_KEYS = ["format", "preset", "supplementalStoredState", "version"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function parseJSONValue(value: unknown, field: string): JSONValue {
    if (value === null || typeof value === "boolean" || typeof value === "string") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new SoundShareError("InvalidEnvelope", `${field} must contain only finite JSON numbers.`);
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((entry, index) => parseJSONValue(entry, `${field}[${index}]`));
    }
    if (!isPlainObject(value)) {
        throw new SoundShareError("InvalidEnvelope", `${field} must contain only JSON data.`);
    }
    return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, parseJSONValue(value[key], `${field}.${key}`)]),
    );
}

function errorFromUnknown(cause: unknown): SoundShareError {
    if (cause instanceof SoundShareError) {
        return cause;
    }
    return new SoundShareError(
        "InvalidEnvelope",
        cause instanceof Error ? cause.message : "Shared sound payload is invalid.",
        { cause },
    );
}

/** Parse the versioned carrier only. The preset and supplemental documents
    remain boundary values until the live synth contract/adapters parse them. */
export function parseSoundShareEnvelope(value: unknown): SoundShareResult<SoundShareEnvelopeV2> {
    try {
        if (!isPlainObject(value)) {
            throw new SoundShareError("InvalidEnvelope", "Shared sound payload must be an object.");
        }
        if (Object.keys(value).sort().join("\n") !== ENVELOPE_KEYS.join("\n")) {
            throw new SoundShareError("InvalidEnvelope", "Shared sound payload has unexpected fields.");
        }
        if (value.format !== SOUND_SHARE_ENVELOPE_FORMAT) {
            throw new SoundShareError("InvalidEnvelope", `Shared sound format must be \"${SOUND_SHARE_ENVELOPE_FORMAT}\".`);
        }
        if (value.version !== SOUND_SHARE_ENVELOPE_VERSION) {
            throw new SoundShareError(
                "UnsupportedVersion",
                `Shared sound version \"${String(value.version)}\" is not supported.`,
            );
        }
        if (!isPlainObject(value.preset)) {
            throw new SoundShareError("InvalidEnvelope", "Shared sound preset must be an object.");
        }
        if (!isPlainObject(value.supplementalStoredState)) {
            throw new SoundShareError("InvalidEnvelope", "Shared sound supplementalStoredState must be an object.");
        }

        return {
            ok: true,
            value: {
                format: SOUND_SHARE_ENVELOPE_FORMAT,
                version: SOUND_SHARE_ENVELOPE_VERSION,
                preset: parseJSONValue(value.preset, "preset"),
                supplementalStoredState: parseJSONValue(
                    value.supplementalStoredState,
                    "supplementalStoredState",
                ) as Readonly<Record<string, unknown>>,
            },
        };
    } catch (cause) {
        return { ok: false, error: errorFromUnknown(cause) };
    }
}

export function parseSoundShareEnvelopeText(text: string): SoundShareResult<SoundShareEnvelopeV2> {
    try {
        assertNoDuplicateJsonKeys(text);
        const value: unknown = JSON.parse(text);
        return parseSoundShareEnvelope(value);
    } catch (cause) {
        return { ok: false, error: errorFromUnknown(cause) };
    }
}

/** Smart constructor for a fully captured, current-contract sound. */
export function createSoundShareEnvelope({
    preset,
    supplementalStoredState,
}: {
    readonly preset: EffectPresetV2;
    readonly supplementalStoredState: Readonly<Record<string, unknown>>;
}): SoundShareEnvelopeV2<EffectPresetV2> {
    const parsed = parseSoundShareEnvelope({
        format: SOUND_SHARE_ENVELOPE_FORMAT,
        version: SOUND_SHARE_ENVELOPE_VERSION,
        preset,
        supplementalStoredState,
    });
    if (!parsed.ok) {
        throw parsed.error;
    }
    return parsed.value as SoundShareEnvelopeV2<EffectPresetV2>;
}
