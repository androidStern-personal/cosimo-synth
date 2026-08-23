function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new TypeError("WAV bytes must be an ArrayBuffer or typed array");
}

function readAscii(view, offset, length) {
    let value = "";
    for (let index = 0; index < length; index += 1) {
        value += String.fromCharCode(view.getUint8(offset + index));
    }
    return value;
}

function readPcmSample(view, offset, bitsPerSample) {
    if (bitsPerSample === 8) return (view.getUint8(offset) - 128) / 128;
    if (bitsPerSample === 16) return view.getInt16(offset, true) / 32_768;
    if (bitsPerSample === 24) {
        let value = view.getUint8(offset)
            | (view.getUint8(offset + 1) << 8)
            | (view.getUint8(offset + 2) << 16);
        if ((value & 0x800000) !== 0) value |= 0xff000000;
        return value / 8_388_608;
    }
    if (bitsPerSample === 32) return view.getInt32(offset, true) / 2_147_483_648;
    throw new Error(`Unsupported PCM WAV bit depth ${bitsPerSample}`);
}

export function decodeWaveToStereoFloat(value) {
    const bytes = asBytes(value);
    invariant(bytes.byteLength >= 12, "WAV header is truncated");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    invariant(readAscii(view, 0, 4) === "RIFF", "Expected a RIFF WAV file");
    invariant(readAscii(view, 8, 4) === "WAVE", "Expected a RIFF WAV file");

    let audioFormat = 0;
    let channelCount = 0;
    let sampleRate = 0;
    let blockAlign = 0;
    let bitsPerSample = 0;
    let dataOffset = -1;
    let dataByteLength = 0;
    let cursor = 12;

    while (cursor + 8 <= view.byteLength) {
        const chunkID = readAscii(view, cursor, 4);
        const declaredSize = view.getUint32(cursor + 4, true);
        const chunkOffset = cursor + 8;
        invariant(chunkOffset + declaredSize <= view.byteLength,
            `WAV ${chunkID} chunk is truncated`);

        if (chunkID === "fmt ") {
            invariant(declaredSize >= 16, "WAV fmt chunk is truncated");
            audioFormat = view.getUint16(chunkOffset, true);
            channelCount = view.getUint16(chunkOffset + 2, true);
            sampleRate = view.getUint32(chunkOffset + 4, true);
            blockAlign = view.getUint16(chunkOffset + 12, true);
            bitsPerSample = view.getUint16(chunkOffset + 14, true);
            if (audioFormat === 0xfffe) {
                invariant(declaredSize >= 40, "WAV extensible fmt chunk is truncated");
                audioFormat = view.getUint16(chunkOffset + 24, true);
            }
        } else if (chunkID === "data" && dataOffset < 0) {
            dataOffset = chunkOffset;
            dataByteLength = declaredSize;
        }

        cursor = chunkOffset + declaredSize + (declaredSize & 1);
    }

    invariant(audioFormat === 1 || audioFormat === 3,
        `Unsupported WAV encoding ${audioFormat}; expected integer PCM or IEEE float`);
    invariant(channelCount > 0 && sampleRate > 0, "WAV format metadata is invalid");
    invariant(dataOffset >= 0, "WAV file is missing a data chunk");
    const bytesPerSample = bitsPerSample / 8;
    invariant(Number.isInteger(bytesPerSample) && bytesPerSample > 0,
        "WAV bit depth is invalid");
    invariant(blockAlign >= channelCount * bytesPerSample && blockAlign > 0,
        "WAV block alignment is invalid");
    invariant(dataByteLength % blockAlign === 0, "WAV data ends within a sample frame");
    if (audioFormat === 3) {
        invariant(bitsPerSample === 32 || bitsPerSample === 64,
            `Unsupported IEEE float WAV bit depth ${bitsPerSample}`);
    } else {
        invariant([8, 16, 24, 32].includes(bitsPerSample),
            `Unsupported PCM WAV bit depth ${bitsPerSample}`);
    }

    const frameCount = dataByteLength / blockAlign;
    invariant(frameCount > 0, "WAV contains no audio frames");
    const samples = new Float32Array(frameCount * 2);
    for (let frame = 0; frame < frameCount; frame += 1) {
        const frameOffset = dataOffset + (frame * blockAlign);
        const readChannel = (channel) => {
            const offset = frameOffset + (channel * bytesPerSample);
            if (audioFormat === 1) return readPcmSample(view, offset, bitsPerSample);
            return bitsPerSample === 32
                ? view.getFloat32(offset, true)
                : view.getFloat64(offset, true);
        };
        const left = readChannel(0);
        samples[frame * 2] = Number.isFinite(left) ? left : 0;
        if (channelCount === 1) {
            samples[(frame * 2) + 1] = samples[frame * 2];
        } else {
            const right = readChannel(1);
            samples[(frame * 2) + 1] = Number.isFinite(right) ? right : 0;
        }
    }

    return Object.freeze({ sampleRate, channelCount, frameCount, samples });
}

