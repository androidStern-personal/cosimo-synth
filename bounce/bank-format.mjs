const MAGIC = "CSBNK001";
const FIXED_HEADER_BYTES = 32;
const ROOT_RECORD_BYTES = 16;

export const BOUNCE_BANK_VERSION = 1;
export const BOUNCE_BANK_MAX_ROOTS = 19;
// Must remain in lockstep with wt::bounceBankFrameCapacity. This is the
// atomic per-slot residency ceiling, not a recommendation for capture length.
export const BOUNCE_BANK_FRAME_CAPACITY = 5_472_000;

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function asBytes(value) {
    if (value instanceof Uint8Array) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new TypeError("Bounce bank bytes must be an ArrayBuffer or typed array");
}

function writeAscii(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
        view.setUint8(offset + index, text.charCodeAt(index));
    }
}

function readAscii(view, offset, length) {
    let value = "";
    for (let index = 0; index < length; index += 1) {
        value += String.fromCharCode(view.getUint8(offset + index));
    }
    return value;
}

function validateRootNote(note, index) {
    invariant(Number.isInteger(note) && note >= 0 && note <= 127,
        `Bounce root ${index} has an invalid MIDI note`);
}

export function quantizeFloatToInt16(sample) {
    const finite = Number.isFinite(sample) ? sample : 0;
    const clamped = Math.max(-1, Math.min(1, finite));
    return Math.max(-32_768, Math.min(32_767, Math.round(clamped * 32_768)));
}

export function buildBounceBank({ sampleRate, roots }) {
    invariant(Number.isInteger(sampleRate) && sampleRate > 0,
        "Bounce bank sampleRate must be a positive integer");
    invariant(Array.isArray(roots) && roots.length > 0,
        "Bounce bank must contain at least one root");
    invariant(roots.length <= BOUNCE_BANK_MAX_ROOTS,
        `Bounce bank cannot contain more than ${BOUNCE_BANK_MAX_ROOTS} roots`);

    let previousNote = -1;
    let totalFrameCount = 0;
    const normalizedRoots = roots.map((root, index) => {
        validateRootNote(root?.note, index);
        invariant(root.note > previousNote, "Bounce roots must be strictly ascending");
        previousNote = root.note;

        const samples = root.samples;
        invariant(samples instanceof Int16Array,
            `Bounce root ${root.note} samples must be interleaved Int16 PCM`);
        invariant(samples.length > 0 && samples.length % 2 === 0,
            `Bounce root ${root.note} must contain complete stereo frames`);

        const frameCount = samples.length / 2;
        const noteOffFrameOffset = root.noteOffFrameOffset ?? 0;
        invariant(Number.isInteger(noteOffFrameOffset)
            && noteOffFrameOffset >= 0
            && (noteOffFrameOffset === 0 || noteOffFrameOffset < frameCount),
        `Bounce root ${root.note} has an invalid note-off offset`);
        const normalized = Object.freeze({
            note: root.note,
            frameOffset: totalFrameCount,
            frameCount,
            noteOffFrameOffset,
        });
        totalFrameCount += frameCount;
        invariant(totalFrameCount <= BOUNCE_BANK_FRAME_CAPACITY,
            `Bounce bank exceeds the ${BOUNCE_BANK_FRAME_CAPACITY}-frame live capacity`);
        return normalized;
    });

    const pcm = new Int16Array(totalFrameCount * 2);
    let sampleOffset = 0;
    for (const root of roots) {
        pcm.set(root.samples, sampleOffset);
        sampleOffset += root.samples.length;
    }

    return Object.freeze({
        version: BOUNCE_BANK_VERSION,
        sampleRate,
        roots: Object.freeze(normalizedRoots),
        totalFrameCount,
        pcm,
    });
}

export function encodeBounceBank(bank) {
    invariant(bank?.version === BOUNCE_BANK_VERSION,
        `Unsupported bounce bank version ${bank?.version}`);
    invariant(Number.isInteger(bank.sampleRate) && bank.sampleRate > 0,
        "Bounce bank sampleRate must be a positive integer");
    invariant(Array.isArray(bank.roots) && bank.roots.length > 0
        && bank.roots.length <= BOUNCE_BANK_MAX_ROOTS,
    "Bounce bank has an invalid root count");
    invariant(bank.pcm instanceof Int16Array, "Bounce bank PCM must be Int16Array");
    invariant(Number.isInteger(bank.totalFrameCount)
        && bank.totalFrameCount === bank.pcm.length / 2,
    "Bounce bank totalFrameCount does not match its PCM");

    const headerByteLength = FIXED_HEADER_BYTES + (bank.roots.length * ROOT_RECORD_BYTES);
    const bytes = new Uint8Array(headerByteLength + bank.pcm.byteLength);
    const view = new DataView(bytes.buffer);
    writeAscii(view, 0, MAGIC);
    view.setUint32(8, headerByteLength, true);
    view.setUint32(12, BOUNCE_BANK_VERSION, true);
    view.setUint32(16, bank.sampleRate, true);
    view.setUint32(20, bank.roots.length, true);
    view.setUint32(24, bank.totalFrameCount, true);
    view.setUint32(28, 0, true);

    let expectedFrameOffset = 0;
    let previousNote = -1;
    for (let index = 0; index < bank.roots.length; index += 1) {
        const root = bank.roots[index];
        validateRootNote(root?.note, index);
        invariant(root.note > previousNote, "Bounce roots must be strictly ascending");
        invariant(root.frameOffset === expectedFrameOffset,
            "Bounce root frames must be contiguous and ordered");
        invariant(Number.isInteger(root.frameCount) && root.frameCount > 0,
            `Bounce root ${root.note} has an invalid frame count`);
        invariant(Number.isInteger(root.noteOffFrameOffset)
            && root.noteOffFrameOffset >= 0
            && (root.noteOffFrameOffset === 0 || root.noteOffFrameOffset < root.frameCount),
        `Bounce root ${root.note} has an invalid note-off offset`);

        const offset = FIXED_HEADER_BYTES + (index * ROOT_RECORD_BYTES);
        view.setInt32(offset, root.note, true);
        view.setUint32(offset + 4, root.frameOffset, true);
        view.setUint32(offset + 8, root.frameCount, true);
        // V1 reserved this word as zero. A non-zero value now preserves the
        // logical capture note-off so sampled playback can distinguish an
        // early user release from the already-baked release in the PCM.
        view.setUint32(offset + 12, root.noteOffFrameOffset, true);
        expectedFrameOffset += root.frameCount;
        previousNote = root.note;
    }
    invariant(expectedFrameOffset === bank.totalFrameCount,
        "Bounce root frame counts do not cover the PCM payload");

    const pcmBytes = new Uint8Array(bank.pcm.buffer, bank.pcm.byteOffset, bank.pcm.byteLength);
    bytes.set(pcmBytes, headerByteLength);
    return bytes;
}

export function decodeBounceBank(value) {
    const input = asBytes(value);
    invariant(input.byteLength >= FIXED_HEADER_BYTES, "Bounce bank header is truncated");
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    invariant(readAscii(view, 0, MAGIC.length) === MAGIC, "Bounce bank magic is invalid");

    const headerByteLength = view.getUint32(8, true);
    const version = view.getUint32(12, true);
    const sampleRate = view.getUint32(16, true);
    const rootCount = view.getUint32(20, true);
    const totalFrameCount = view.getUint32(24, true);
    invariant(version === BOUNCE_BANK_VERSION, `Unsupported bounce bank version ${version}`);
    invariant(sampleRate > 0, "Bounce bank sample rate is invalid");
    invariant(rootCount > 0 && rootCount <= BOUNCE_BANK_MAX_ROOTS,
        "Bounce bank root count is invalid");
    invariant(headerByteLength === FIXED_HEADER_BYTES + (rootCount * ROOT_RECORD_BYTES),
        "Bounce bank header length is invalid");
    invariant(headerByteLength + (totalFrameCount * 4) === input.byteLength,
        "Bounce bank PCM length does not match its header");

    const roots = [];
    let expectedFrameOffset = 0;
    let previousNote = -1;
    for (let index = 0; index < rootCount; index += 1) {
        const offset = FIXED_HEADER_BYTES + (index * ROOT_RECORD_BYTES);
        const note = view.getInt32(offset, true);
        const frameOffset = view.getUint32(offset + 4, true);
        const frameCount = view.getUint32(offset + 8, true);
        const noteOffFrameOffset = view.getUint32(offset + 12, true);
        validateRootNote(note, index);
        invariant(note > previousNote, "Bounce roots must be strictly ascending");
        invariant(frameOffset === expectedFrameOffset && frameCount > 0,
            "Bounce root ranges must be non-empty, contiguous, and ordered");
        invariant(frameOffset + frameCount <= totalFrameCount,
            "Bounce root range exceeds the PCM payload");
        invariant(noteOffFrameOffset === 0 || noteOffFrameOffset < frameCount,
            "Bounce root note-off offset exceeds its PCM range");
        roots.push(Object.freeze({ note, frameOffset, frameCount, noteOffFrameOffset }));
        expectedFrameOffset += frameCount;
        previousNote = note;
    }
    invariant(expectedFrameOffset === totalFrameCount,
        "Bounce root ranges do not cover the PCM payload");

    const pcmBytes = input.slice(headerByteLength);
    const pcm = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2);
    const packedFrames = new Int32Array(pcmBytes.buffer, pcmBytes.byteOffset, totalFrameCount);
    return Object.freeze({
        version,
        sampleRate,
        roots: Object.freeze(roots),
        totalFrameCount,
        pcm,
        packedFrames,
    });
}
