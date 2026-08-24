import { renderMediaOnWeb } from "@remotion/web-renderer";
import {
    ALL_FORMATS,
    AudioBufferSink,
    BlobSource,
    Input,
    MP4,
} from "mediabunny";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { encodeSpeedrunWav } from "../../../ui/speedrun/audio/master-track";
import {
    SpeedrunComposition,
    SpeedrunFrame,
    SPEEDRUN_VIDEO_HEIGHT,
    SPEEDRUN_VIDEO_WIDTH,
} from "../../../ui/speedrun/composition/composition";
import type { SpeedrunRecipe } from "../../../ui/speedrun/recipe";
import { assembleTimeline } from "../../../ui/speedrun/timeline";
import clickTrackRecipeJson from "./click-track.recipe.json";
import fixtureRecipeJson from "./effects-lane-recipe.golden.json";

const fixtureRecipe = fixtureRecipeJson as unknown as SpeedrunRecipe;
const fixtureTimeline = assembleTimeline(fixtureRecipe);
const clickTrackRecipe = clickTrackRecipeJson as unknown as SpeedrunRecipe;
const clickTrackTimeline = assembleTimeline(clickTrackRecipe, {
    pacing: { sectionMinimum: 100, tail: 24 },
});

const rootElement = document.querySelector<HTMLElement>("#root");
if (rootElement === null) throw new Error("The speedrun composition root is missing.");
const root = createRoot(rootElement);
let currentFrame = 0;

document.documentElement.style.background = "#07080c";
document.documentElement.style.height = `${SPEEDRUN_VIDEO_HEIGHT}px`;
document.documentElement.style.width = `${SPEEDRUN_VIDEO_WIDTH}px`;
document.body.style.height = `${SPEEDRUN_VIDEO_HEIGHT}px`;
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.width = `${SPEEDRUN_VIDEO_WIDTH}px`;
rootElement.style.height = `${SPEEDRUN_VIDEO_HEIGHT}px`;
rootElement.style.width = `${SPEEDRUN_VIDEO_WIDTH}px`;

function renderFixtureFrame(frame: number) {
    currentFrame = Math.min(Math.max(0, Math.floor(frame)), fixtureTimeline.durationInFrames - 1);
    flushSync(() => {
        root.render(
            <SpeedrunFrame
                recipe={fixtureRecipe}
                timeline={fixtureTimeline}
                patchLabel={fixtureRecipe.label}
                frame={currentFrame}
            />,
        );
    });
}

async function settleFrame(frame: number) {
    renderFixtureFrame(frame);
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function settleClickFrame(frame: number) {
    currentFrame = Math.min(Math.max(0, Math.floor(frame)), clickTrackTimeline.durationInFrames - 1);
    flushSync(() => {
        root.render(
            <SpeedrunFrame
                recipe={clickTrackRecipe}
                timeline={clickTrackTimeline}
                patchLabel={clickTrackRecipe.label}
                frame={currentFrame}
            />,
        );
    });
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function inspectFrame() {
    const frameElement = document.querySelector<HTMLElement>(".speedrun-video-frame");
    const phone = document.querySelector<HTMLElement>(".speedrun-phone");
    const captionPanel = document.querySelector<HTMLElement>(".speedrun-caption-panel");
    return {
        frame: currentFrame,
        renderedFrame: Number(frameElement?.dataset.frame ?? -1),
        workspace: phone?.dataset.workspace ?? null,
        section: captionPanel?.dataset.section ?? null,
        visibleCaptionLines: [...document.querySelectorAll<HTMLElement>(".speedrun-caption-panel li[data-visible=true]")]
            .map((element) => Number(element.dataset.line)),
        canvasCount: document.querySelectorAll("canvas").length,
        knobCount: document.querySelectorAll("[data-role=parameter-knob-artwork]").length,
        fingerDirection: document.querySelector<HTMLElement>(".speedrun-finger-layer")?.dataset.direction ?? null,
        endCard: document.querySelector(".speedrun-end-card") !== null,
    };
}

function createClickTrack() {
    const sampleRate = clickTrackTimeline.sampleRate;
    const frameCount = clickTrackTimeline.durationInFrames * clickTrackTimeline.samplesPerFrame;
    const samples = new Float32Array(frameCount * 2);
    const events = clickTrackTimeline.sections.flatMap((section) => section.captionEvents);
    const clickLength = Math.round(sampleRate * 0.012);
    for (const event of events) {
        const firstSample = event.atFrame * clickTrackTimeline.samplesPerFrame;
        for (let offset = 0; offset < clickLength && firstSample + offset < frameCount; offset += 1) {
            const envelope = Math.sin((offset / Math.max(1, clickLength - 1)) * Math.PI) ** 2;
            const value = Math.sin((offset / sampleRate) * Math.PI * 2 * 1_200) * envelope * 0.92;
            samples[(firstSample + offset) * 2] += value;
            samples[((firstSample + offset) * 2) + 1] += value;
        }
    }
    return { samples, events };
}

async function verifyAlignment(blob: Blob, expectedFrames: ReadonlyArray<number>) {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
        const [format, durationSeconds, videoTracks, audioTracks] = await Promise.all([
            input.getFormat(),
            input.computeDuration(),
            input.getVideoTracks(),
            input.getAudioTracks(),
        ]);
        if (format !== MP4 || videoTracks.length !== 1 || audioTracks.length !== 1) {
            throw new Error("The alignment render must contain one MP4 video track and one audio track.");
        }
        const [videoCodec, audioCodec] = await Promise.all([
            videoTracks[0].getCodec(),
            audioTracks[0].getCodec(),
        ]);
        const buffers = [];
        const sink = new AudioBufferSink(audioTracks[0]);
        for await (const wrapped of sink.buffers()) buffers.push(wrapped);
        const observed = expectedFrames.map((expectedFrame) => {
            const expectedSeconds = expectedFrame / clickTrackTimeline.fps;
            const radiusSeconds = 0.055;
            let peak = 0;
            let peakSeconds = Number.NaN;
            for (const wrapped of buffers) {
                const values = wrapped.buffer.getChannelData(0);
                const sampleRate = wrapped.buffer.sampleRate;
                for (let index = 0; index < values.length; index += 1) {
                    const seconds = wrapped.timestamp + (index / sampleRate);
                    if (seconds < expectedSeconds - radiusSeconds || seconds > expectedSeconds + radiusSeconds) continue;
                    const magnitude = Math.abs(values[index]);
                    if (magnitude > peak) {
                        peak = magnitude;
                        peakSeconds = seconds;
                    }
                }
            }
            const onsetThreshold = peak * 0.15;
            let onsetSeconds = Number.NaN;
            for (const wrapped of buffers) {
                const values = wrapped.buffer.getChannelData(0);
                const sampleRate = wrapped.buffer.sampleRate;
                for (let index = 0; index < values.length; index += 1) {
                    const seconds = wrapped.timestamp + (index / sampleRate);
                    if (seconds < expectedSeconds - radiusSeconds || seconds > expectedSeconds + radiusSeconds) continue;
                    if (Math.abs(values[index]) >= onsetThreshold) {
                        onsetSeconds = seconds;
                        break;
                    }
                }
                if (Number.isFinite(onsetSeconds)) break;
            }
            return {
                expectedFrame,
                observedFrame: onsetSeconds * clickTrackTimeline.fps,
                errorFrames: (onsetSeconds - expectedSeconds) * clickTrackTimeline.fps,
                peakFrame: peakSeconds * clickTrackTimeline.fps,
                peak,
            };
        });
        return {
            durationSeconds,
            videoTrackCount: videoTracks.length,
            audioTrackCount: audioTracks.length,
            videoCodec,
            audioCodec,
            observed,
        };
    } finally {
        input.dispose();
    }
}

async function renderAlignmentFixture() {
    const clickTrack = createClickTrack();
    const expectedFrames = clickTrack.events.map((event) => event.atFrame);
    const wav = encodeSpeedrunWav(clickTrack.samples);
    const wavBytes = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
    const masterAudioUrl = URL.createObjectURL(new Blob([wavBytes], { type: "audio/wav" }));
    let finalProgress = 0;
    try {
        const { getBlob } = await renderMediaOnWeb({
            composition: {
                id: "cosimo-speedrun-alignment",
                component: SpeedrunComposition,
                durationInFrames: clickTrackTimeline.durationInFrames,
                fps: clickTrackTimeline.fps,
                width: SPEEDRUN_VIDEO_WIDTH,
                height: SPEEDRUN_VIDEO_HEIGHT,
                defaultProps: {
                    recipe: clickTrackRecipe,
                    timeline: clickTrackTimeline,
                    masterAudioUrl,
                    patchLabel: clickTrackRecipe.label,
                },
            },
            inputProps: {
                recipe: clickTrackRecipe,
                timeline: clickTrackTimeline,
                masterAudioUrl,
                patchLabel: clickTrackRecipe.label,
            },
            container: "mp4",
            videoCodec: "h264",
            audioCodec: "aac",
            sampleRate: clickTrackTimeline.sampleRate,
            videoBitrate: "low",
            audioBitrate: "medium",
            logLevel: "warn",
            onProgress: ({ progress }) => {
                finalProgress = progress;
            },
        });
        const blob = await getBlob();
        return {
            ...(await verifyAlignment(blob, expectedFrames)),
            expectedFrames,
            blobBytes: blob.size,
            blobType: blob.type,
            finalProgress,
        };
    } finally {
        URL.revokeObjectURL(masterAudioUrl);
    }
}

const sectionBoundaries = fixtureTimeline.sections.map((section, index) => ({
    frame: section.startFrame,
    name: `section-${String(index).padStart(2, "0")}-${section.section.id}`,
    sectionId: section.section.id,
}));
const endCardFrame = fixtureTimeline.durationInFrames - 1;

declare global {
    interface Window {
        __COSIMO_SPEEDRUN_COMPOSITION__?: {
            readonly durationInFrames: number;
            readonly sectionBoundaries: typeof sectionBoundaries;
            readonly endCardFrame: number;
            readonly clickCaptionEvents: ReadonlyArray<{ readonly line: number; readonly atFrame: number }>;
            setFrame(frame: number): Promise<void>;
            setClickFrame(frame: number): Promise<void>;
            inspect(): ReturnType<typeof inspectFrame>;
            renderAlignment(): ReturnType<typeof renderAlignmentFixture>;
        };
    }
}

window.__COSIMO_SPEEDRUN_COMPOSITION__ = {
    durationInFrames: fixtureTimeline.durationInFrames,
    sectionBoundaries,
    endCardFrame,
    clickCaptionEvents: clickTrackTimeline.sections[0].captionEvents,
    setFrame: settleFrame,
    setClickFrame: settleClickFrame,
    inspect: inspectFrame,
    renderAlignment: renderAlignmentFixture,
};

await settleFrame(0);
