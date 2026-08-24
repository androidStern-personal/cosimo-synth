import {
    ALL_FORMATS,
    AudioBufferSink,
    BlobSource,
    CanvasSink,
    Input,
    MP4,
} from "mediabunny";

export type RendererSpikeVerification = {
    readonly durationSeconds: number;
    readonly videoTrackCount: number;
    readonly audioTrackCount: number;
    readonly videoCodec: string;
    readonly audioCodec: string;
    readonly decodedAudioRms: number;
    readonly decodedAudioFrameCount: number;
    readonly decodedFrameVariance: number;
    readonly decodedFrameDifference: number;
};

function requireCondition(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function decodedAudioWindowRms(audioTrack: Awaited<ReturnType<Input["getPrimaryAudioTrack"]>>): Promise<{
    readonly rms: number;
    readonly frameCount: number;
}> {
    requireCondition(audioTrack !== null, "The MP4 has no primary audio track.");
    const sink = new AudioBufferSink(audioTrack);
    let squareSum = 0;
    let sampleCount = 0;
    let frameCount = 0;
    for await (const { buffer } of sink.buffers(4.98, 5.28)) {
        frameCount += buffer.length;
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const values = buffer.getChannelData(channel);
            for (const value of values) {
                squareSum += value * value;
                sampleCount += 1;
            }
        }
    }
    requireCondition(sampleCount > 0, "The AAC track decoded no samples in the verification window.");
    return { rms: Math.sqrt(squareSum / sampleCount), frameCount };
}

function frameLuma(canvas: HTMLCanvasElement | OffscreenCanvas): Float32Array {
    const context = canvas.getContext("2d");
    requireCondition(context !== null, "The decoded video canvas has no 2D context.");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const luma = new Float32Array(canvas.width * canvas.height);
    for (let source = 0, target = 0; source < pixels.length; source += 4, target += 1) {
        luma[target] = pixels[source] * 0.2126 + pixels[source + 1] * 0.7152 + pixels[source + 2] * 0.0722;
    }
    return luma;
}

function variance(values: Float32Array): number {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function meanAbsoluteDifference(left: Float32Array, right: Float32Array): number {
    requireCondition(left.length === right.length, "Decoded video frames have different dimensions.");
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
        difference += Math.abs(left[index] - right[index]);
    }
    return difference / left.length;
}

export async function verifyRendererSpikeMp4(blob: Blob): Promise<RendererSpikeVerification> {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
        requireCondition(await input.getFormat() === MP4, "The renderer did not produce an MP4 container.");
        const [durationSeconds, videoTracks, audioTracks] = await Promise.all([
            input.computeDuration(),
            input.getVideoTracks(),
            input.getAudioTracks(),
        ]);
        requireCondition(durationSeconds >= 9.9 && durationSeconds <= 10.1,
            `Expected an approximately 10 second MP4, received ${durationSeconds}.`);
        requireCondition(videoTracks.length === 1,
            `Expected exactly one video track, received ${videoTracks.length}.`);
        requireCondition(audioTracks.length === 1,
            `Expected exactly one audio track, received ${audioTracks.length}.`);

        const [videoCodec, audioCodec] = await Promise.all([
            videoTracks[0].getCodec(),
            audioTracks[0].getCodec(),
        ]);
        requireCondition(videoCodec === "avc", `Expected H.264/AVC video, received ${String(videoCodec)}.`);
        requireCondition(audioCodec === "aac", `Expected AAC audio, received ${String(audioCodec)}.`);

        const decodedAudio = await decodedAudioWindowRms(audioTracks[0]);
        requireCondition(decodedAudio.rms > 0.02,
            `Expected a non-silent decoded AAC window, measured RMS ${decodedAudio.rms}.`);

        const canvasSink = new CanvasSink(videoTracks[0], {
            width: 160,
            height: 90,
            fit: "fill",
            poolSize: 2,
        });
        const [earlyFrame, lateFrame] = await Promise.all([
            canvasSink.getCanvas(1.2),
            canvasSink.getCanvas(7.2),
        ]);
        requireCondition(earlyFrame !== null && lateFrame !== null,
            "The H.264 track could not decode both verification frames.");
        const earlyLuma = frameLuma(earlyFrame.canvas);
        const lateLuma = frameLuma(lateFrame.canvas);
        const decodedFrameVariance = Math.min(variance(earlyLuma), variance(lateLuma));
        const decodedFrameDifference = meanAbsoluteDifference(earlyLuma, lateLuma);
        requireCondition(decodedFrameVariance > 80,
            `Decoded video is visually flat (variance ${decodedFrameVariance}).`);
        requireCondition(decodedFrameDifference > 1,
            `Decoded animation frames did not materially change (${decodedFrameDifference}).`);

        return {
            durationSeconds,
            videoTrackCount: videoTracks.length,
            audioTrackCount: audioTracks.length,
            videoCodec,
            audioCodec,
            decodedAudioRms: decodedAudio.rms,
            decodedAudioFrameCount: decodedAudio.frameCount,
            decodedFrameVariance,
            decodedFrameDifference,
        };
    } finally {
        input.dispose();
    }
}
