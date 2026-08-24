const SAMPLE_RATE_HZ = 48_000;
const CHANNEL_COUNT = 2;
const BYTES_PER_SAMPLE = 2;

function writeAscii(view: DataView, offset: number, value: string): void {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
    }
}

function pulseSample(timeSeconds: number): number {
    const pulsePosition = timeSeconds % 1;
    if (pulsePosition >= 0.24) {
        return 0;
    }
    const attack = Math.min(1, pulsePosition / 0.008);
    const release = Math.min(1, (0.24 - pulsePosition) / 0.03);
    const envelope = attack * release;
    const frequencyHz = 220 + (Math.floor(timeSeconds) % 4) * 110;
    return Math.sin(2 * Math.PI * frequencyHz * timeSeconds) * envelope * 0.32;
}

/** A deterministic stereo PCM16 WAV with one audible pulse at every second. */
export function createSpikeWav(durationSeconds: number): Blob {
    const frameCount = Math.round(durationSeconds * SAMPLE_RATE_HZ);
    const dataByteLength = frameCount * CHANNEL_COUNT * BYTES_PER_SAMPLE;
    const bytes = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(bytes);

    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataByteLength, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, CHANNEL_COUNT, true);
    view.setUint32(24, SAMPLE_RATE_HZ, true);
    view.setUint32(28, SAMPLE_RATE_HZ * CHANNEL_COUNT * BYTES_PER_SAMPLE, true);
    view.setUint16(32, CHANNEL_COUNT * BYTES_PER_SAMPLE, true);
    view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataByteLength, true);

    let byteOffset = 44;
    for (let frame = 0; frame < frameCount; frame += 1) {
        const sample = Math.round(pulseSample(frame / SAMPLE_RATE_HZ) * 32_767);
        view.setInt16(byteOffset, sample, true);
        view.setInt16(byteOffset + BYTES_PER_SAMPLE, sample, true);
        byteOffset += CHANNEL_COUNT * BYTES_PER_SAMPLE;
    }

    return new Blob([bytes], { type: "audio/wav" });
}
