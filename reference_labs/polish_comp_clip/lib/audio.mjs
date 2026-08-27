import { createHash } from "node:crypto";

export function sha256(data) {
    return createHash("sha256").update(data).digest("hex");
}

export function encodeFloat32Wav(channels, sampleRate) {
    if (!Array.isArray(channels) || channels.length < 1) throw new Error("WAV requires channels");
    const frameCount = channels[0].length;
    if (channels.some((channel) => channel.length !== frameCount)) throw new Error("WAV channels differ in length");
    const channelCount = channels.length;
    const bytesPerSample = 4;
    const blockAlign = channelCount * bytesPerSample;
    const dataBytes = frameCount * blockAlign;
    const result = Buffer.alloc(44 + dataBytes);
    result.write("RIFF", 0, "ascii");
    result.writeUInt32LE(36 + dataBytes, 4);
    result.write("WAVE", 8, "ascii");
    result.write("fmt ", 12, "ascii");
    result.writeUInt32LE(16, 16);
    result.writeUInt16LE(3, 20); // IEEE float
    result.writeUInt16LE(channelCount, 22);
    result.writeUInt32LE(sampleRate, 24);
    result.writeUInt32LE(sampleRate * blockAlign, 28);
    result.writeUInt16LE(blockAlign, 32);
    result.writeUInt16LE(32, 34);
    result.write("data", 36, "ascii");
    result.writeUInt32LE(dataBytes, 40);
    let offset = 44;
    for (let frame = 0; frame < frameCount; frame += 1) {
        for (let channel = 0; channel < channelCount; channel += 1) {
            result.writeFloatLE(channels[channel][frame], offset);
            offset += bytesPerSample;
        }
    }
    return result;
}

export function decodeFloat32Wav(data) {
    if (data.subarray(0, 4).toString("ascii") !== "RIFF" || data.subarray(8, 12).toString("ascii") !== "WAVE") {
        throw new Error("Not a RIFF/WAVE file");
    }
    if (data.subarray(12, 16).toString("ascii") !== "fmt " || data.readUInt32LE(16) !== 16) {
        throw new Error("Reference WAV must have a canonical 16-byte fmt chunk");
    }
    if (data.readUInt16LE(20) !== 3 || data.readUInt16LE(34) !== 32) {
        throw new Error("Reference WAV must be 32-bit IEEE float");
    }
    if (data.subarray(36, 40).toString("ascii") !== "data") throw new Error("Reference WAV lacks canonical data chunk");
    const channelCount = data.readUInt16LE(22);
    const sampleRate = data.readUInt32LE(24);
    const dataBytes = data.readUInt32LE(40);
    const frameCount = dataBytes / (channelCount * 4);
    if (!Number.isInteger(frameCount) || 44 + dataBytes !== data.length) throw new Error("Reference WAV length is invalid");
    const channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount));
    let offset = 44;
    for (let frame = 0; frame < frameCount; frame += 1) {
        for (let channel = 0; channel < channelCount; channel += 1) {
            channels[channel][frame] = data.readFloatLE(offset);
            offset += 4;
        }
    }
    return { channels, sampleRate, frameCount };
}

function db(value) {
    return 20 * Math.log10(Math.max(value, 1e-30));
}

export function measureAudio(channels, startFrame = 0) {
    const frameCount = channels[0]?.length ?? 0;
    const endFrame = frameCount;
    const measuredFrames = Math.max(0, endFrame - startFrame);
    let power = 0;
    let peak = 0;
    let sampleCount = 0;
    const means = new Float64Array(channels.length);

    for (let channel = 0; channel < channels.length; channel += 1) {
        for (let frame = startFrame; frame < endFrame; frame += 1) {
            const sample = channels[channel][frame];
            power += sample * sample;
            peak = Math.max(peak, Math.abs(sample));
            means[channel] += sample;
            sampleCount += 1;
        }
        means[channel] /= Math.max(measuredFrames, 1);
    }

    const rms = Math.sqrt(power / Math.max(sampleCount, 1));
    let correlation = 1;
    if (channels.length === 2 && measuredFrames > 0) {
        let cross = 0;
        let leftPower = 0;
        let rightPower = 0;
        for (let frame = startFrame; frame < endFrame; frame += 1) {
            const left = channels[0][frame] - means[0];
            const right = channels[1][frame] - means[1];
            cross += left * right;
            leftPower += left * left;
            rightPower += right * right;
        }
        correlation = cross / Math.sqrt(Math.max(leftPower * rightPower, 1e-30));
    }

    return {
        measuredFrames,
        samplePeak: peak,
        samplePeakDbfs: db(peak),
        rms,
        rmsDbfs: db(rms),
        crestDb: db(peak / Math.max(rms, 1e-30)),
        channelDc: Array.from(means),
        stereoCorrelation: correlation,
    };
}

export function levelMatch(reference, candidate, startFrame = 0) {
    const referenceMeasurement = measureAudio(reference, startFrame);
    const candidateMeasurement = measureAudio(candidate, startFrame);
    const gain = referenceMeasurement.rms / Math.max(candidateMeasurement.rms, 1e-30);
    const channels = candidate.map((channel) => Float32Array.from(channel, (sample) => sample * gain));
    const matchedMeasurement = measureAudio(channels, startFrame);
    return {
        channels,
        gain,
        gainDb: db(gain),
        rmsDeltaDb: matchedMeasurement.rmsDbfs - referenceMeasurement.rmsDbfs,
        referenceMeasurement,
        candidateMeasurement,
        matchedMeasurement,
    };
}
