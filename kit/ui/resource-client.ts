/** The resource-reading part of a Cmajor patch connection. */
export type PatchConnectionResourceSource = {
    getResourceAddress?: (path: string) => string | URL;
    readResource?: (path: string) => Promise<unknown>;
    readResourceAsAudioData?: (path: string, annotation?: unknown) => Promise<unknown>;
};

export type ResourceAudioData = {
    sampleRate: number;
    samples: Float32Array;
};

/** Reads files bundled with the patch, by path relative to the patch folder. */
export type ResourceClient = {
    readText(path: string): Promise<string>;
    readJSON<T>(path: string): Promise<T>;
    readBytes(path: string): Promise<Uint8Array>;
    /** Mono WAV only: 16-bit PCM or 32-bit float. */
    readAudio(path: string): Promise<ResourceAudioData>;
    getURL(path: string): URL | null;
};

function fail(message: string): never {
    throw new Error(message);
}

function readAscii(view: DataView, offset: number, length: number) {
    let text = "";
    for (let index = 0; index < length; index += 1) text += String.fromCharCode(view.getUint8(offset + index));
    return text;
}

// The native worker's JavaScript engine may lack TextDecoder and TextEncoder.
function decodeText(bytes: Uint8Array) {
    return typeof TextDecoder === "function" ? new TextDecoder().decode(bytes) : String.fromCharCode(...bytes);
}

function encodeText(text: string) {
    return typeof TextEncoder === "function" ? new TextEncoder().encode(text) : Uint8Array.from(text, character => character.charCodeAt(0));
}

function bytesFromPayload(path: string, payload: unknown): Uint8Array {
    if (typeof payload === "string") return encodeText(payload);
    if (payload instanceof ArrayBuffer) return new Uint8Array(payload.slice(0));
    if (ArrayBuffer.isView(payload)) return new Uint8Array(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength));
    if (Array.isArray(payload)) return Uint8Array.from(payload);
    return fail(`The host returned ${path} in a form this kit cannot read.`);
}

function parseMonoWave(path: string, buffer: ArrayBuffer): ResourceAudioData {
    const view = new DataView(buffer);
    if (view.byteLength < 12 || readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE")
        fail(`${path} is not a WAV file.`);
    let format = 0, channels = 0, sampleRate = 0, bitsPerSample = 0, dataOffset = -1, dataSize = 0;
    for (let cursor = 12; cursor + 8 <= view.byteLength;) {
        const chunk = readAscii(view, cursor, 4), size = view.getUint32(cursor + 4, true), body = cursor + 8;
        if (chunk === "fmt ") {
            format = view.getUint16(body, true);
            channels = view.getUint16(body + 2, true);
            sampleRate = view.getUint32(body + 4, true);
            bitsPerSample = view.getUint16(body + 14, true);
        } else if (chunk === "data") {
            dataOffset = body;
            dataSize = Math.min(size, view.byteLength - body);
        }
        cursor = body + size + (size % 2);
    }
    if (dataOffset < 0 || format === 0) fail(`${path} is missing its WAV format or data chunk.`);
    if (channels !== 1) fail(`${path} has ${channels} channels; readAudio reads mono WAV files only.`);
    const data = buffer.slice(dataOffset, dataOffset + dataSize);
    if (format === 3 && bitsPerSample === 32) return { sampleRate, samples: new Float32Array(data, 0, Math.floor(dataSize / 4)) };
    if (format === 1 && bitsPerSample === 16) {
        const pcm = new Int16Array(data, 0, Math.floor(dataSize / 2));
        return { sampleRate, samples: Float32Array.from(pcm, sample => sample / 32768) };
    }
    return fail(`${path} uses WAV format ${format} at ${bitsPerSample} bits; use 16-bit PCM or 32-bit float.`);
}

function decodedAudio(path: string, input: unknown): ResourceAudioData {
    const decoded = (input ?? {}) as { sampleRate?: unknown; frames?: ArrayLike<number | ArrayLike<number>> };
    const frames = decoded.frames;
    if (!frames || typeof frames.length !== "number") fail(`The host decoded ${path} without audio frames.`);
    const samples = new Float32Array(frames.length);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (typeof frame === "number") samples[index] = frame;
        else if (frame && frame.length === 1) samples[index] = Number(frame[0]) || 0;
        else fail(`${path} is not mono; readAudio reads mono audio only.`);
    }
    return { sampleRate: Number(decoded.sampleRate) || 0, samples };
}

/**
 * The folder the patch is served from: the page's origin, or this module's folder
 * where there is no page or the page's address cannot anchor a path, as in an
 * about:srcdoc frame.
 */
function defaultPatchRoot() {
    const page = globalThis.location?.href;
    if (typeof page === "string" && URL.canParse("/", page)) return new URL("/", page);
    const folder = new URL(import.meta.url);
    folder.pathname = folder.pathname.replace(/\/[^/]*$/, "/");
    return folder;
}

function resourceURL(path: string, address: string | URL | undefined, patchRoot: () => URL) {
    if (address instanceof URL) return address;
    if (typeof address === "string" && address.length > 0)
        return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(address) ? new URL(address) : new URL(address.replace(/^\//, ""), patchRoot());
    return new URL(path, patchRoot());
}

/**
 * A resource client over a patch connection. Text and bytes come through the
 * host's resource bridge when it has one; audio prefers a fetchable address, then
 * the host's decoder, then decoding the bytes here. `patchRoot` is the patch
 * folder, for a bundle that is not served from it.
 */
export function createPatchConnectionResourceClient(
    source: PatchConnectionResourceSource | null | undefined,
    options: { patchRoot?: URL } = {},
): ResourceClient {
    const host = source ?? {};
    // Found on the first relative read, so creating a client never depends on the page's address.
    let root = options.patchRoot;
    const patchRoot = () => root ??= defaultPatchRoot();
    const fetchBuffer = async (path: string, address = host.getResourceAddress?.(path)) => {
        if (typeof fetch !== "function") fail(`Cannot read ${path}: this host has neither a resource bridge nor fetch.`);
        const url = resourceURL(path, address, patchRoot);
        const response = await fetch(url.toString());
        if (!response.ok) fail(`Could not read ${path} from ${url} (HTTP ${response.status}).`);
        return response.arrayBuffer();
    };
    const readBytes = async (path: string) => host.readResource
        ? bytesFromPayload(path, await host.readResource(path)) : new Uint8Array(await fetchBuffer(path));
    return {
        async readText(path) {
            if (!host.readResource) return decodeText(new Uint8Array(await fetchBuffer(path)));
            const payload: unknown = await host.readResource(path);
            if (typeof payload === "string") return payload;
            if (typeof payload === "object" && payload !== null && "text" in payload && typeof payload.text === "function")
                return String(await payload.text());
            return decodeText(bytesFromPayload(path, payload));
        },
        async readJSON<T>(path: string) {
            // SAFETY: the caller names the JSON shape it expects; the file content is not checked against T.
            return JSON.parse(await this.readText(path)) as T;
        },
        readBytes,
        async readAudio(path) {
            const address = host.getResourceAddress?.(path);
            if (address !== undefined && address !== null && typeof fetch === "function") return parseMonoWave(path, await fetchBuffer(path, address));
            if (host.readResourceAsAudioData) return decodedAudio(path, await host.readResourceAsAudioData(path));
            return parseMonoWave(path, new Uint8Array(await readBytes(path)).buffer);
        },
        getURL(path) {
            return resourceURL(path, host.getResourceAddress?.(path), patchRoot);
        },
    };
}
