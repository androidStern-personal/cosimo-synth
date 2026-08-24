import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import {
    SYNTH_COMPACT_CONTROL_CHROME_CLASS,
    SYNTH_COMPACT_CONTROL_TEXT_CLASS,
} from "../shared/synth-components";
import type {
    IntegratedVideoBounceModule,
    IntegratedVideoBounceSession,
    VideoBounceAudioArtifact,
    VideoBounceContainer,
    VideoBounceQuality,
    VideoBounceVideoArtifact,
} from "../speedrun/integrated-contract";

declare global {
    // The browser host owns this optional capability. Native/plugin builds do
    // not ship the browser-only renderer or pay its startup cost.
    // eslint-disable-next-line no-var
    var __COSIMO_VIDEO_BOUNCE_MODULE_URL__: string | undefined;
}

type VideoBounceStage = "loading" | "ready" | "audio" | "video";

type SelectOption<T extends string> = {
    readonly value: T;
    readonly label: string;
};

const CONTAINER_OPTIONS: ReadonlyArray<SelectOption<VideoBounceContainer>> = [
    { value: "auto", label: "Auto" },
    { value: "mp4", label: "MP4" },
    { value: "webm", label: "WebM" },
];

const QUALITY_OPTIONS: ReadonlyArray<SelectOption<VideoBounceQuality>> = [
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
    { value: "very-low", label: "Very Low" },
];

function moduleURL() {
    const value = globalThis.__COSIMO_VIDEO_BOUNCE_MODULE_URL__;
    if (typeof value !== "string" || value.length === 0) {
        return null;
    }
    try {
        return new URL(value, globalThis.location.href).href;
    } catch {
        return null;
    }
}

export function isVideoBounceAvailable() {
    return moduleURL() !== null;
}

async function loadVideoBounceModule(): Promise<IntegratedVideoBounceModule> {
    const url = moduleURL();
    if (url === null) {
        throw new Error("Bounce Video is available in the browser app.");
    }
    const imported = await import(/* @vite-ignore */ url) as unknown;
    if (
        typeof imported !== "object"
        || imported === null
        || !("createVideoBounceSession" in imported)
        || typeof imported.createVideoBounceSession !== "function"
    ) {
        throw new Error("The Bounce Video renderer did not load correctly.");
    }
    return imported as IntegratedVideoBounceModule;
}

function errorMessage(error: unknown) {
    return error instanceof Error && error.message.length > 0
        ? error.message
        : "Bounce Video failed.";
}

function megabytes(bytes: number) {
    return `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 1 : 2)} MB`;
}

function seconds(value: number) {
    return `${value.toFixed(value >= 10 ? 1 : 2)} s`;
}

function SelectChip<T extends string>({
    label,
    value,
    options,
    onChange,
    disabled,
}: {
    readonly label: string;
    readonly value: T;
    readonly options: ReadonlyArray<SelectOption<T>>;
    readonly onChange: (value: T) => void;
    readonly disabled: boolean;
}) {
    const selected = options.find((option) => option.value === value)?.label ?? value;
    return (
        <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[8px] uppercase tracking-[0.13em] text-[var(--cosimo-ink-muted)]">
                {label}
            </span>
            <span className="relative block h-7 min-w-0">
                <span className={`flex h-full items-center ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} px-2 pr-6 ${SYNTH_COMPACT_CONTROL_TEXT_CLASS} cosimo-control-value`}>
                    {selected}
                </span>
                <svg
                    viewBox="0 0 10 6"
                    aria-hidden="true"
                    className="pointer-events-none absolute right-2 top-1/2 h-1.5 w-2.5 -translate-y-1/2 text-[var(--section-accent)] opacity-70"
                >
                    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                <select
                    className="cosimo-wavetable-native-select absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
                    value={value}
                    aria-label={label}
                    disabled={disabled}
                    onChange={(event) => onChange(event.currentTarget.value as T)}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </span>
        </label>
    );
}

export function VideoBounceFlow({
    patchInput,
    onClose,
}: {
    readonly patchInput: unknown;
    readonly onClose: () => void;
}) {
    const sessionRef = useRef<IntegratedVideoBounceSession | null>(null);
    const [stage, setStage] = useState<VideoBounceStage>("loading");
    const [session, setSession] = useState<IntegratedVideoBounceSession | null>(null);
    const [audio, setAudio] = useState<VideoBounceAudioArtifact | null>(null);
    const [video, setVideo] = useState<VideoBounceVideoArtifact | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [container, setContainer] = useState<VideoBounceContainer>("auto");
    const [quality, setQuality] = useState<VideoBounceQuality>("high");

    useEffect(() => {
        let live = true;
        void loadVideoBounceModule()
            .then((runtime) => runtime.createVideoBounceSession(patchInput))
            .then((nextSession) => {
                if (!live) {
                    nextSession.dispose();
                    return;
                }
                sessionRef.current = nextSession;
                setSession(nextSession);
                setStage("ready");
            })
            .catch((cause) => {
                if (live) {
                    setError(errorMessage(cause));
                    setStage("ready");
                }
            });

        return () => {
            live = false;
            sessionRef.current?.dispose();
            sessionRef.current = null;
        };
    }, [patchInput]);

    const renderAudio = useCallback(async () => {
        if (session === null) return;
        setStage("audio");
        setError(null);
        setProgress(0);
        setVideo(null);
        try {
            const nextAudio = await session.renderAudio(setProgress);
            setAudio(nextAudio);
            setProgress(1);
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setStage("ready");
        }
    }, [session]);

    const renderVideo = useCallback(async () => {
        if (session === null || audio === null) return;
        setStage("video");
        setError(null);
        setProgress(0);
        try {
            const nextVideo = await session.renderVideo({
                container,
                quality,
                onProgress: setProgress,
            });
            setVideo(nextVideo);
            setProgress(1);
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setStage("ready");
        }
    }, [audio, container, quality, session]);

    const busy = stage === "loading" || stage === "audio" || stage === "video";
    const status = stage === "loading"
        ? "Loading renderer"
        : stage === "audio"
            ? "Rendering audio"
            : stage === "video"
                ? "Rendering video"
                : video
                    ? "Video ready"
                    : audio
                        ? "Audio ready"
                        : session
                            ? "Ready"
                            : "Unavailable";

    return (
        <section
            data-role="video-bounce-flow"
            data-stage={stage}
            className="absolute inset-0 z-[90] flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-[rgb(var(--cosimo-ground-rgb))] p-2.5 text-[var(--cosimo-ink)] [--section-accent:var(--cosimo-accent-cyan)] [--section-accent-glow:rgb(var(--cosimo-accent-cyan-rgb)/0.3)]"
        >
            <header className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-1.5">
                <span className="cosimo-section-title">Bounce Video</span>
                <button
                    type="button"
                    aria-label="Close Bounce Video"
                    className="cosimo-button grid h-7 w-7 place-items-center rounded-[7px] text-[12px] text-[var(--cosimo-ink-muted)]"
                    onClick={onClose}
                >
                    ×
                </button>
            </header>

            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 pt-2">
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-[9px] border border-white/[0.05] bg-white/[0.025] px-3 py-2">
                    <div className="min-w-0">
                        <span className="block text-[8px] uppercase tracking-[0.14em] text-[var(--cosimo-ink-muted)]">Current patch</span>
                        <strong className="block truncate text-[11px] font-medium text-[var(--cosimo-ink)]">
                            {session?.prepared.label ?? "Preparing…"}
                        </strong>
                    </div>
                    {session ? (
                        <span className="shrink-0 text-right text-[8px] uppercase tracking-[0.10em] text-[var(--cosimo-ink-muted)]">
                            {session.prepared.sectionCount} steps · {seconds(session.prepared.durationSeconds)}
                        </span>
                    ) : null}
                </div>

                <div className="flex min-h-0 flex-col justify-center rounded-[12px] border border-white/[0.06] bg-black/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.13em]">
                        <span className="text-[var(--cosimo-ink-muted)]">{status}</span>
                        {busy ? <span className="tabular-nums text-[var(--section-accent)]">{Math.round(progress * 100)}%</span> : null}
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                            data-role="video-bounce-progress"
                            className="h-full bg-[var(--section-accent)] transition-[width] duration-150"
                            style={{ width: `${busy ? Math.max(1, progress * 100) : video || audio ? 100 : 0}%` }}
                        />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Bounce Video steps">
                        {([
                            { label: "Audio", complete: audio !== null, active: audio === null },
                            { label: "Video", complete: video !== null, active: audio !== null && video === null },
                            { label: "Download", complete: video !== null, active: false },
                        ] as const).map((step, index) => (
                            <div
                                key={step.label}
                                className={`rounded-[7px] border px-2 py-1.5 text-[8px] uppercase tracking-[0.11em] ${
                                    step.complete
                                        ? "border-cyan-200/20 bg-cyan-300/[0.06] text-cyan-100"
                                        : step.active
                                            ? "border-white/[0.10] bg-white/[0.035] text-[var(--cosimo-ink)]"
                                            : "border-white/[0.05] text-[var(--cosimo-ink-faint)]"
                                }`}
                            >
                                <span className="mr-1.5 text-[var(--section-accent)]">{index + 1}</span>
                                {step.label}
                            </div>
                        ))}
                    </div>
                    {error ? (
                        <p data-role="video-bounce-error" className="mb-0 mt-2 text-[9px] leading-snug text-rose-200/90" role="alert">
                            {error}
                        </p>
                    ) : null}
                    {audio ? (
                        <div className="mt-2 flex min-w-0 items-center gap-2">
                            <audio className="h-8 min-w-0 flex-1" src={audio.url} controls preload="metadata" />
                            <span className="shrink-0 text-[8px] text-[var(--cosimo-ink-muted)]">{megabytes(audio.bytes)}</span>
                        </div>
                    ) : null}
                    {video ? (
                        <div className="mt-2 flex min-w-0 items-center justify-between gap-3 rounded-[8px] border border-cyan-200/15 bg-cyan-300/[0.04] px-2.5 py-2">
                            <div className="min-w-0">
                                <strong className="block truncate text-[9px] font-medium">{video.fileName}</strong>
                                <span className="text-[8px] text-[var(--cosimo-ink-muted)]">{video.formatLabel} · {megabytes(video.bytes)}</span>
                            </div>
                            <a
                                data-role="video-bounce-download"
                                className="cosimo-button shrink-0 rounded-[7px] px-3 py-2 text-[8px] uppercase tracking-[0.12em] text-cyan-100"
                                href={video.url}
                                download={video.fileName}
                            >
                                Download
                            </a>
                        </div>
                    ) : null}
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex min-w-0 flex-1 gap-2">
                        <SelectChip label="Format" value={container} options={CONTAINER_OPTIONS} onChange={setContainer} disabled={busy} />
                        <SelectChip label="Quality" value={quality} options={QUALITY_OPTIONS} onChange={setQuality} disabled={busy} />
                    </div>
                    <div className="flex shrink-0 gap-2 sm:justify-end">
                        {stage === "audio" || stage === "video" ? (
                            <button
                                type="button"
                                className="cosimo-button h-9 rounded-[8px] px-4 text-[9px] uppercase tracking-[0.13em] text-rose-100"
                                onClick={() => session?.cancel()}
                            >
                                Cancel
                            </button>
                        ) : audio === null ? (
                            <button
                                type="button"
                                data-role="video-bounce-render-audio"
                                disabled={session === null}
                                className="cosimo-button h-9 rounded-[8px] px-4 text-[9px] uppercase tracking-[0.13em] text-cyan-100 disabled:cursor-wait disabled:opacity-40"
                                onClick={() => void renderAudio()}
                            >
                                Render Audio
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="cosimo-button h-9 rounded-[8px] px-3 text-[8px] uppercase tracking-[0.11em] text-[var(--cosimo-ink-muted)]"
                                    onClick={() => void renderAudio()}
                                >
                                    Render Audio Again
                                </button>
                                <button
                                    type="button"
                                    data-role="video-bounce-render-video"
                                    className="cosimo-button h-9 rounded-[8px] border-cyan-200/25 bg-cyan-300/10 px-4 text-[9px] uppercase tracking-[0.13em] text-cyan-100"
                                    onClick={() => void renderVideo()}
                                >
                                    {video ? "Render Video Again" : "Render Video"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
