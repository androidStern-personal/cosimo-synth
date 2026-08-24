import {
    parseSoundShareEnvelope,
    parseSoundShareEnvelopeText,
    SoundShareError,
    type SoundShareErrorTag,
    type SoundShareEnvelopeV1,
    type SoundShareResult,
} from "./sound-share-envelope";

export const SOUND_SHARE_FRAGMENT_VERSION = 1;
export const SOUND_SHARE_URL_WARNING_LENGTH = 2_000;
export const SOUND_SHARE_URL_MAX_LENGTH = 8_000;
export const SOUND_SHARE_DECOMPRESSED_MAX_BYTES = 1_000_000;
export const SOUND_SHARE_FRAGMENT_MAX_LENGTH = SOUND_SHARE_URL_MAX_LENGTH;

const SOUND_SHARE_FRAGMENT_PREFIX = `#p=${SOUND_SHARE_FRAGMENT_VERSION}.`;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type SoundShareURLLengthClass = "normal" | "warning" | "refused";

export type CreatedSoundShareURL = {
    readonly url: string;
    readonly length: number;
    readonly lengthClass: Exclude<SoundShareURLLengthClass, "refused">;
};

function errorResult<T>(error: SoundShareError): SoundShareResult<T> {
    return { ok: false, error };
}

function errorMessage(cause: unknown, fallback: string) {
    return cause instanceof Error && cause.message.length > 0 ? cause.message : fallback;
}

function bytesToBase64URL(bytes: Uint8Array) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64URLToBytes(encoded: string): SoundShareResult<Uint8Array> {
    if (encoded.length === 0 || !BASE64URL_PATTERN.test(encoded) || encoded.length % 4 === 1) {
        return errorResult(new SoundShareError("InvalidFragment", "Shared sound link payload is not valid base64url."));
    }
    try {
        const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/")
            .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), "=");
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return { ok: true, value: bytes };
    } catch (cause) {
        return errorResult(new SoundShareError(
            "InvalidFragment",
            "Shared sound link payload is not valid base64url.",
            { cause },
        ));
    }
}

async function readStreamBytes(
    stream: ReadableStream<Uint8Array>,
    maximumBytes: number,
    failure: {
        readonly tag: Extract<SoundShareErrorTag, "CompressionFailed" | "DecompressionFailed">;
        readonly fallbackMessage: string;
    },
): Promise<SoundShareResult<Uint8Array>> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            const next = await reader.read();
            if (next.done) {
                break;
            }
            total += next.value.byteLength;
            if (total > maximumBytes) {
                await reader.cancel("Shared sound payload exceeds its decompressed byte limit.");
                return errorResult(new SoundShareError(
                    "PayloadTooLarge",
                    `Shared sound payload expands beyond ${maximumBytes.toLocaleString()} bytes.`,
                ));
            }
            chunks.push(next.value);
        }
    } catch (cause) {
        return errorResult(new SoundShareError(
            failure.tag,
            errorMessage(cause, failure.fallbackMessage),
            { cause },
        ));
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return { ok: true, value: bytes };
}

function compressionStream(kind: "compress" | "decompress"): SoundShareResult<TransformStream<Uint8Array, Uint8Array>> {
    const StreamConstructor = kind === "compress"
        ? globalThis.CompressionStream
        : globalThis.DecompressionStream;
    if (typeof StreamConstructor !== "function") {
        return errorResult(new SoundShareError(
            "CompressionUnavailable",
            "Sound links require this browser's native deflate support.",
        ));
    }
    try {
        return { ok: true, value: new StreamConstructor("deflate") };
    } catch (cause) {
        return errorResult(new SoundShareError(
            "CompressionUnavailable",
            "Sound links require this browser's native deflate support.",
            { cause },
        ));
    }
}

export function classifySoundShareURLLength(length: number): SoundShareURLLengthClass {
    if (length > SOUND_SHARE_URL_MAX_LENGTH) {
        return "refused";
    }
    return length > SOUND_SHARE_URL_WARNING_LENGTH ? "warning" : "normal";
}

export async function encodeSoundShareFragment(
    envelope: SoundShareEnvelopeV1,
): Promise<SoundShareResult<string>> {
    const parsed = parseSoundShareEnvelope(envelope);
    if (!parsed.ok) {
        return parsed;
    }
    const streamResult = compressionStream("compress");
    if (!streamResult.ok) {
        return streamResult;
    }
    try {
        const input = new TextEncoder().encode(JSON.stringify(parsed.value));
        if (input.byteLength > SOUND_SHARE_DECOMPRESSED_MAX_BYTES) {
            return errorResult(new SoundShareError(
                "PayloadTooLarge",
                `Shared sound payload exceeds ${SOUND_SHARE_DECOMPRESSED_MAX_BYTES.toLocaleString()} bytes.`,
            ));
        }
        const compressed = await readStreamBytes(
            new Blob([input]).stream().pipeThrough(streamResult.value),
            SOUND_SHARE_DECOMPRESSED_MAX_BYTES,
            {
                tag: "CompressionFailed",
                fallbackMessage: "Shared sound payload could not be compressed.",
            },
        );
        if (!compressed.ok) {
            return compressed;
        }
        return { ok: true, value: `${SOUND_SHARE_FRAGMENT_PREFIX}${bytesToBase64URL(compressed.value)}` };
    } catch (cause) {
        return errorResult(new SoundShareError(
            "CompressionFailed",
            errorMessage(cause, "Shared sound payload could not be compressed."),
            { cause },
        ));
    }
}

export async function decodeSoundShareFragment(
    fragment: string,
): Promise<SoundShareResult<SoundShareEnvelopeV1 | null>> {
    try {
        if (!fragment.startsWith("#p=")) {
            return { ok: true, value: null };
        }
        if (fragment.length > SOUND_SHARE_FRAGMENT_MAX_LENGTH) {
            return errorResult(new SoundShareError(
                "PayloadTooLarge",
                `Shared sound link fragment exceeds ${SOUND_SHARE_FRAGMENT_MAX_LENGTH.toLocaleString()} characters.`,
            ));
        }
        const versionMatch = /^#p=([0-9]+)\./u.exec(fragment);
        if (versionMatch === null) {
            return errorResult(new SoundShareError("InvalidFragment", "Shared sound link fragment is malformed."));
        }
        if (Number(versionMatch[1]) !== SOUND_SHARE_FRAGMENT_VERSION) {
            return errorResult(new SoundShareError(
                "UnsupportedVersion",
                `Shared sound link version \"${versionMatch[1]}\" is not supported.`,
            ));
        }
        if (!fragment.startsWith(SOUND_SHARE_FRAGMENT_PREFIX)) {
            return errorResult(new SoundShareError("InvalidFragment", "Shared sound link fragment is malformed."));
        }
        const compressed = base64URLToBytes(fragment.slice(SOUND_SHARE_FRAGMENT_PREFIX.length));
        if (!compressed.ok) {
            return compressed;
        }
        const streamResult = compressionStream("decompress");
        if (!streamResult.ok) {
            return streamResult;
        }
        const decompressed = await readStreamBytes(
            new Blob([compressed.value]).stream().pipeThrough(streamResult.value),
            SOUND_SHARE_DECOMPRESSED_MAX_BYTES,
            {
                tag: "DecompressionFailed",
                fallbackMessage: "Shared sound payload could not be decompressed.",
            },
        );
        if (!decompressed.ok) {
            return decompressed;
        }
        const text = new TextDecoder("utf-8", { fatal: true }).decode(decompressed.value);
        const parsed = parseSoundShareEnvelopeText(text);
        return parsed.ok ? parsed : errorResult(parsed.error);
    } catch (cause) {
        return errorResult(new SoundShareError(
            "DecompressionFailed",
            errorMessage(cause, "Shared sound payload could not be decompressed."),
            { cause },
        ));
    }
}

export async function createSoundShareURL(
    envelope: SoundShareEnvelopeV1,
    baseURL: string,
): Promise<SoundShareResult<CreatedSoundShareURL>> {
    let url: URL;
    try {
        url = new URL(baseURL);
    } catch (cause) {
        return errorResult(new SoundShareError("InvalidURL", "Cannot create a sound link from this page URL.", { cause }));
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return errorResult(new SoundShareError("InvalidURL", "Sound links are available from the browser app only."));
    }
    const fragment = await encodeSoundShareFragment(envelope);
    if (!fragment.ok) {
        return fragment;
    }
    url.hash = fragment.value.slice(1);
    const value = url.toString();
    const lengthClass = classifySoundShareURLLength(value.length);
    if (lengthClass === "refused") {
        return errorResult(new SoundShareError(
            "URLTooLong",
            `This sound link is ${value.length.toLocaleString()} characters; links over ${SOUND_SHARE_URL_MAX_LENGTH.toLocaleString()} cannot be copied.`,
        ));
    }
    return { ok: true, value: { url: value, length: value.length, lengthClass } };
}

export function stripSoundShareFragment({
    history = globalThis.history,
    location = globalThis.location,
}: {
    readonly history?: History;
    readonly location?: Location;
} = {}): SoundShareResult<undefined> {
    try {
        const cleanURL = new URL(location.href);
        cleanURL.hash = "";
        history.replaceState(history.state, "", cleanURL);
        return { ok: true, value: undefined };
    } catch (cause) {
        return errorResult(new SoundShareError(
            "HistoryUpdateFailed",
            "The shared sound loaded, but its URL fragment could not be removed.",
            { cause },
        ));
    }
}
