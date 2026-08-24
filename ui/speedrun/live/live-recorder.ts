/**
 * Record the live stage from the real compositor: Region Capture crops the
 * user's own-tab capture to the stage element; the playing master audio's
 * captureStream is muxed into the same MediaRecorder so A/V sync is the user
 * agent's, not ours.
 */

type CropTargetLike = { fromElement(element: Element): Promise<unknown> };
type CroppableTrack = MediaStreamTrack & { cropTo(target: unknown): Promise<void> };

const RECORDER_MIME_CANDIDATES = [
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm",
] as const;

export function liveCaptureSupport(): { supported: boolean; reason: string | null } {
    const cropTarget = (globalThis as { CropTarget?: CropTargetLike }).CropTarget;
    if (!navigator.mediaDevices?.getDisplayMedia) {
        return { supported: false, reason: "This browser cannot capture the screen (getDisplayMedia is unavailable)." };
    }
    if (typeof cropTarget?.fromElement !== "function") {
        return { supported: false, reason: "This browser cannot crop a capture to the stage (Region Capture is unavailable). Use a current Chromium-based browser." };
    }
    if (typeof MediaRecorder === "undefined") {
        return { supported: false, reason: "This browser cannot encode a recording (MediaRecorder is unavailable)." };
    }
    return { supported: true, reason: null };
}

export type LiveStageRecorder = {
    readonly mimeType: string;
    /** Begin encoding; call when the performance is about to start. */
    begin(audioElement: HTMLMediaElement | null): void;
    /** Resolves with the finished recording; call once the performance ends. */
    stop(): Promise<Blob>;
    /** Immediate teardown without a usable recording. */
    cancel(): void;
};

/**
 * Acquire the capture up front — getDisplayMedia consumes the user's click
 * activation, so it must run before the seconds-long iframe boot — and start
 * encoding later via begin(), once the performance is ready to play.
 */
export async function acquireLiveStageRecorder({
    stage,
    preferredContainer,
}: {
    readonly stage: HTMLElement;
    readonly preferredContainer?: "mp4" | "webm";
}): Promise<LiveStageRecorder> {
    const support = liveCaptureSupport();
    if (!support.supported) throw new Error(support.reason ?? "Live capture is unsupported.");

    const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60 } },
        audio: false,
        // Chromium extensions to steer the picker at the user's own tab.
        ...({ preferCurrentTab: true, selfBrowserSurface: "include" } as object),
    });
    const [videoTrack] = display.getVideoTracks();
    const cropTarget = (globalThis as unknown as { CropTarget: CropTargetLike }).CropTarget;
    if (typeof (videoTrack as CroppableTrack).cropTo !== "function") {
        for (const track of display.getTracks()) track.stop();
        throw new Error("The captured surface does not support Region Capture — pick \"This Tab\" in the share dialog.");
    }
    await (videoTrack as CroppableTrack).cropTo(await cropTarget.fromElement(stage));

    const candidates = preferredContainer === "webm"
        ? [...RECORDER_MIME_CANDIDATES].sort((left, right) => (
            Number(right.startsWith("video/webm")) - Number(left.startsWith("video/webm"))
        ))
        : RECORDER_MIME_CANDIDATES;
    const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
        for (const track of display.getTracks()) track.stop();
        throw new Error("No supported MediaRecorder container (mp4 or webm) is available.");
    }

    let recorder: MediaRecorder | null = null;
    let captureAudio: MediaStream | null = null;
    const chunks: BlobPart[] = [];
    let failure: unknown = null;
    let sharingEnded = false;
    let stopRequested = false;
    videoTrack.addEventListener("ended", () => {
        // Ending the share after the performance finished is not a failure.
        if (!stopRequested) sharingEnded = true;
    });

    const teardown = () => {
        for (const track of display.getTracks()) track.stop();
        for (const track of captureAudio?.getTracks() ?? []) track.stop();
    };

    return {
        mimeType,
        begin(audioElement) {
            if (recorder !== null) return;
            captureAudio = audioElement && "captureStream" in audioElement
                ? (audioElement as HTMLMediaElement & { captureStream(): MediaStream }).captureStream()
                : null;
            recorder = new MediaRecorder(
                new MediaStream([videoTrack, ...(captureAudio?.getAudioTracks() ?? [])]),
                {
                    mimeType,
                    videoBitsPerSecond: 12_000_000,
                    audioBitsPerSecond: 192_000,
                },
            );
            recorder.addEventListener("dataavailable", (event) => {
                if (event.data.size > 0) chunks.push(event.data);
            });
            recorder.addEventListener("error", (event) => {
                failure = (event as unknown as { error?: unknown }).error ?? new Error("MediaRecorder failed.");
            });
            recorder.start(1_000);
        },
        stop() {
            stopRequested = true;
            return new Promise<Blob>((resolve, reject) => {
                if (recorder === null) {
                    teardown();
                    reject(new Error("The live recording was never begun."));
                    return;
                }
                recorder.addEventListener("stop", () => {
                    teardown();
                    if (failure) {
                        reject(failure instanceof Error ? failure : new Error(String(failure)));
                        return;
                    }
                    if (sharingEnded) {
                        reject(new DOMException("Screen sharing ended before the performance finished.", "AbortError"));
                        return;
                    }
                    resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
                }, { once: true });
                recorder.stop();
            });
        },
        cancel() {
            try {
                recorder?.stop();
            } catch {
                // Already inactive.
            }
            teardown();
        },
    };
}
