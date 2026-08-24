import { getEncodableAudioCodecs } from "@remotion/web-renderer";
import { canEncodeVideo } from "mediabunny";

import { SPEEDRUN_VIDEO_HEIGHT, SPEEDRUN_VIDEO_WIDTH } from "../stage";

export type SpeedrunVideoContainer = "mp4" | "webm";

export type SpeedrunVideoFormat = {
    readonly container: SpeedrunVideoContainer;
    readonly videoCodec: "h264" | "vp9";
    readonly audioCodec: "aac" | "opus";
    readonly extension: "mp4" | "webm";
    readonly mimeType: "video/mp4" | "video/webm";
    readonly label: string;
};

export const SPEEDRUN_MP4_FORMAT: SpeedrunVideoFormat = Object.freeze({
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    extension: "mp4",
    mimeType: "video/mp4",
    label: "MP4 (H.264/AAC)",
});

export const SPEEDRUN_WEBM_FORMAT: SpeedrunVideoFormat = Object.freeze({
    container: "webm",
    videoCodec: "vp9",
    audioCodec: "opus",
    extension: "webm",
    mimeType: "video/webm",
    label: "WebM (VP9/Opus fallback)",
});

async function supports(format: SpeedrunVideoFormat) {
    if (typeof globalThis.VideoEncoder === "undefined" || typeof globalThis.AudioEncoder === "undefined") {
        return false;
    }
    const videoCodec = format.videoCodec === "h264" ? "avc" : "vp9";
    const [videoSupported, audioCodecs] = await Promise.all([
        canEncodeVideo(videoCodec, {
            width: SPEEDRUN_VIDEO_WIDTH,
            height: SPEEDRUN_VIDEO_HEIGHT,
            bitrate: 4_000_000,
        }),
        // Use the renderer's public capability path rather than querying
        // Mediabunny directly. Remotion registers its software AAC encoder
        // here when the host browser has no native AAC WebCodecs encoder.
        getEncodableAudioCodecs(format.container, { audioBitrate: 128_000 }),
    ]);
    return videoSupported && audioCodecs.includes(format.audioCodec);
}

export async function detectSpeedrunVideoFormat(
    preferred?: SpeedrunVideoContainer,
): Promise<SpeedrunVideoFormat | null> {
    if (preferred === "mp4") return await supports(SPEEDRUN_MP4_FORMAT) ? SPEEDRUN_MP4_FORMAT : null;
    if (preferred === "webm") return await supports(SPEEDRUN_WEBM_FORMAT) ? SPEEDRUN_WEBM_FORMAT : null;
    if (await supports(SPEEDRUN_MP4_FORMAT)) return SPEEDRUN_MP4_FORMAT;
    return await supports(SPEEDRUN_WEBM_FORMAT) ? SPEEDRUN_WEBM_FORMAT : null;
}
