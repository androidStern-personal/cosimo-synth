import { renderMediaOnWeb } from "@remotion/web-renderer";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import {
    RendererSpikeComposition,
    SPIKE_DURATION_FRAMES,
    SPIKE_DURATION_SECONDS,
    SPIKE_FPS,
    SPIKE_HEIGHT,
    SPIKE_WIDTH,
} from "./composition";
import { verifyRendererSpikeMp4, type RendererSpikeVerification } from "./verify";
import { createSpikeWav } from "./wav";

export type RendererSpikeReport = RendererSpikeVerification & {
    readonly blobBytes: number;
    readonly blobType: string;
    readonly renderMilliseconds: number;
    readonly sha256: string;
    readonly finalProgress: number;
};

type RendererSpikeApi = {
    run(): Promise<RendererSpikeReport>;
};

declare global {
    var __COSIMO_REMOTION_SPIKE__: RendererSpikeApi | undefined;
}

function hexDigest(bytes: ArrayBuffer): string {
    return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

let renderedMediaUrl: string | null = null;
let renderPromise: Promise<RendererSpikeReport> | null = null;

async function runRendererSpike(): Promise<RendererSpikeReport> {
    if (renderPromise !== null) {
        return renderPromise;
    }
    renderPromise = (async () => {
        const wavBlob = createSpikeWav(SPIKE_DURATION_SECONDS);
        const masterAudioUrl = URL.createObjectURL(wavBlob);
        let finalProgress = 0;
        const startedAt = performance.now();
        try {
            const { getBlob } = await renderMediaOnWeb({
                composition: {
                    id: "cosimo-remotion-web-renderer-spike",
                    component: RendererSpikeComposition,
                    durationInFrames: SPIKE_DURATION_FRAMES,
                    fps: SPIKE_FPS,
                    width: SPIKE_WIDTH,
                    height: SPIKE_HEIGHT,
                    defaultProps: { masterAudioUrl },
                },
                inputProps: { masterAudioUrl },
                container: "mp4",
                videoCodec: "h264",
                audioCodec: "aac",
                sampleRate: 48_000,
                videoBitrate: "low",
                audioBitrate: "medium",
                logLevel: "warn",
                onProgress: ({ progress }) => {
                    finalProgress = progress;
                },
            });
            const blob = await getBlob();
            const renderMilliseconds = performance.now() - startedAt;
            const [verification, digest] = await Promise.all([
                verifyRendererSpikeMp4(blob),
                crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
            ]);
            if (renderedMediaUrl !== null) {
                URL.revokeObjectURL(renderedMediaUrl);
            }
            renderedMediaUrl = URL.createObjectURL(blob);
            const video = document.querySelector<HTMLVideoElement>("#spike-output");
            const download = document.querySelector<HTMLAnchorElement>("#spike-download");
            if (video) video.src = renderedMediaUrl;
            if (download) {
                download.href = renderedMediaUrl;
                download.hidden = false;
            }
            return {
                ...verification,
                blobBytes: blob.size,
                blobType: blob.type,
                renderMilliseconds,
                sha256: hexDigest(digest),
                finalProgress,
            };
        } finally {
            URL.revokeObjectURL(masterAudioUrl);
        }
    })();
    return renderPromise;
}

globalThis.__COSIMO_REMOTION_SPIKE__ = { run: runRendererSpike };

function SpikePage(): React.JSX.Element {
    const [status, setStatus] = useState("Ready");
    return (
        <main style={{ background: "#0a0c13", color: "#eef4ff", fontFamily: "system-ui", minHeight: "100vh", padding: 32 }}>
            <h1>Remotion browser renderer spike</h1>
            <p>10 seconds · SVG + canvas + text + blob-URL WAV · MP4/H.264/AAC</p>
            <button
                type="button"
                onClick={() => {
                    setStatus("Rendering…");
                    void runRendererSpike().then(
                        (report) => setStatus(`Verified ${report.blobBytes.toLocaleString()} byte MP4`),
                        (error: unknown) => setStatus(error instanceof Error ? error.message : String(error)),
                    );
                }}
            >
                Run spike
            </button>
            <p id="spike-status">{status}</p>
            <video id="spike-output" controls style={{ display: "block", marginTop: 20, maxWidth: 640, width: "100%" }} />
            <a id="spike-download" download="cosimo-remotion-web-renderer-spike.mp4" hidden>Download verified MP4</a>
        </main>
    );
}

const root = document.querySelector("#root");
if (!root) {
    throw new Error("The Remotion spike root element is missing.");
}
createRoot(root).render(<SpikePage />);
