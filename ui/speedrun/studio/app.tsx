import React, { useEffect, useMemo, useState } from "react";

import type { NotePerformance } from "../audio/checkpoint-renderer";
import { DEFAULT_SPEEDRUN_PERFORMANCE } from "../midi/default-performance";
import { parsePerformanceFile } from "../midi/smf";
import { SpeedrunStudioError, studioError } from "./errors";
import {
    SpeedrunStudioSession,
    type SpeedrunAudioArtifact,
    type SpeedrunPreparedPipeline,
    type SpeedrunVideoArtifact,
} from "./pipeline";
import { readStudioPatchSelection, type StudioPatchSelection } from "./patch-input";
import {
    detectSpeedrunVideoFormat,
    type SpeedrunVideoContainer,
} from "./video-support";
import "./styles.css";

type PatchSource = "current" | "file" | "share";
type PerformanceSource = "default" | "file";
type Stage = "input" | "analysis" | "audio" | "video";

type Props = {
    readonly session: SpeedrunStudioSession;
};

function megabytes(bytes: number) {
    return `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 1 : 2)} MB`;
}

function seconds(value: number) {
    return `${value.toFixed(value >= 10 ? 1 : 2)} s`;
}

function stageError(stage: Stage, error: unknown, fallback: string) {
    if (error instanceof SpeedrunStudioError) return error;
    return studioError(stage === "input" ? "intake" : stage, "StudioActionFailed", error, fallback);
}

async function copyText(value: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) throw new Error("The browser did not allow clipboard access.");
}

function SourceChoice({
    name,
    value,
    active,
    label,
    detail,
    onChange,
}: {
    readonly name: string;
    readonly value: string;
    readonly active: boolean;
    readonly label: string;
    readonly detail: string;
    readonly onChange: () => void;
}) {
    return (
        <label className={`source-choice${active ? " is-active" : ""}`}>
            <input type="radio" name={name} value={value} checked={active} onChange={onChange} />
            <span><b>{label}</b><small>{detail}</small></span>
        </label>
    );
}

function ErrorCard({ error, clear }: { readonly error: SpeedrunStudioError; readonly clear: () => void }) {
    return (
        <div className="studio-error" role="alert" data-testid={`error-${error.stage}`}>
            <div><small>{error.stage.toUpperCase()} / {error.code}</small><strong>{error.message}</strong></div>
            <button type="button" onClick={clear}>Dismiss</button>
        </div>
    );
}

function RecipeReport({ prepared }: { readonly prepared: SpeedrunPreparedPipeline }) {
    const omitted = Object.entries(prepared.analysis.omitted)
        .filter(([, values]) => values.length > 0);
    return (
        <section className="studio-panel recipe-report" data-testid="recipe-report">
            <div className="panel-heading">
                <div><span>02</span><h2>Recipe</h2></div>
                <p>{prepared.recipe.sections.length} sections · {seconds(prepared.timeline.durationInFrames / prepared.timeline.fps)}</p>
            </div>
            {prepared.timeline.compressionLevel > 0 ? (
                <div className="compression-note">Long patch: pacing compression level {prepared.timeline.compressionLevel} applied.</div>
            ) : null}
            <ol className="recipe-list">
                {prepared.recipe.sections.map((section, index) => (
                    <li key={section.id} data-section-id={section.id}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div><strong>{section.title}</strong><ul>{section.captions.map((caption) => <li key={caption}>{caption}</li>)}</ul></div>
                    </li>
                ))}
            </ol>
            <details className="omitted-report">
                <summary>Deliberately omitted facts ({omitted.reduce((sum, [, values]) => sum + values.length, 0)})</summary>
                {omitted.length === 0 ? <p>Nothing omitted.</p> : omitted.map(([label, values]) => (
                    <p key={label}><b>{label}</b><span>{values.join(", ")}</span></p>
                ))}
            </details>
        </section>
    );
}

export function SpeedrunStudioApp({ session }: Props) {
    const [patchSource, setPatchSource] = useState<PatchSource>("current");
    const [patchFile, setPatchFile] = useState<File | null>(null);
    const [shareValue, setShareValue] = useState("");
    const [performanceSource, setPerformanceSource] = useState<PerformanceSource>("default");
    const [performanceFile, setPerformanceFile] = useState<File | null>(null);
    const [durationCeiling, setDurationCeiling] = useState(90);
    const [prepared, setPrepared] = useState<SpeedrunPreparedPipeline | null>(null);
    const [audio, setAudio] = useState<SpeedrunAudioArtifact | null>(null);
    const [video, setVideo] = useState<SpeedrunVideoArtifact | null>(null);
    const [busy, setBusy] = useState<Stage | null>(null);
    const [audioProgress, setAudioProgress] = useState(0);
    const [videoProgress, setVideoProgress] = useState(0);
    const [error, setError] = useState<SpeedrunStudioError | null>(null);
    const [copyStatus, setCopyStatus] = useState("");
    const [containerChoice, setContainerChoice] = useState<"auto" | SpeedrunVideoContainer>("auto");
    const [videoQuality, setVideoQuality] = useState<"very-low" | "low" | "medium" | "high">("high");
    const [support, setSupport] = useState<{ mp4: boolean; webm: boolean } | null>(null);

    useEffect(() => {
        let live = true;
        void Promise.all([
            detectSpeedrunVideoFormat("mp4"),
            detectSpeedrunVideoFormat("webm"),
        ]).then(([mp4, webm]) => {
            if (live) setSupport({ mp4: mp4 !== null, webm: webm !== null });
        });
        return () => { live = false; };
    }, []);

    const canRenderVideo = support !== null && (support.mp4 || support.webm);
    const durationFrames = Math.max(1, Math.round(durationCeiling * 30));
    const shareWarning = prepared?.shareLink.lengthClass === "warning";
    const activeLabel = useMemo(() => prepared?.document.label ?? "No sound analyzed", [prepared]);

    const selection = (): StudioPatchSelection => {
        if (patchSource === "current") return { kind: "current" };
        if (patchSource === "share") return { kind: "share", value: shareValue };
        if (patchFile === null) throw new SpeedrunStudioError("intake", "PatchFileMissing", "Choose a Cosimo patch JSON file.");
        return { kind: "file", file: patchFile };
    };

    const selectedPerformance = async (): Promise<NotePerformance> => {
        if (performanceSource === "default") return DEFAULT_SPEEDRUN_PERFORMANCE;
        if (performanceFile === null) {
            throw new SpeedrunStudioError("intake", "PerformanceFileMissing", "Choose a MIDI or JSON performance file.");
        }
        return parsePerformanceFile(performanceFile);
    };

    const analyze = async () => {
        setBusy("analysis");
        setError(null);
        setCopyStatus("");
        setPrepared(null);
        setAudio(null);
        setVideo(null);
        try {
            const [patchInput, performance] = await Promise.all([
                readStudioPatchSelection(selection()),
                selectedPerformance(),
            ]);
            setPrepared(await session.prepare(patchInput, performance, { maxDurationInFrames: durationFrames }));
        } catch (cause) {
            setError(stageError("analysis", cause, "The sound could not be analyzed."));
        } finally {
            setBusy(null);
        }
    };

    const renderAudio = async () => {
        setBusy("audio");
        setError(null);
        setAudioProgress(0);
        setVideo(null);
        try {
            const artifact = await session.renderAudio((progress) => {
                setAudioProgress(progress.totalFrames === 0 ? 1 : progress.completedFrames / progress.totalFrames);
            });
            setAudio(artifact);
            setAudioProgress(1);
        } catch (cause) {
            setError(stageError("audio", cause, "Checkpoint audio could not be rendered."));
        } finally {
            setBusy(null);
        }
    };

    const renderVideo = async () => {
        setBusy("video");
        setError(null);
        setVideoProgress(0);
        try {
            const artifact = await session.renderVideo({
                preferredContainer: containerChoice === "auto" ? undefined : containerChoice,
                videoBitrate: videoQuality,
                onProgress: (progress) => setVideoProgress(progress.progress),
            });
            setVideo(artifact);
            setVideoProgress(1);
        } catch (cause) {
            setError(stageError("video", cause, "The video could not be rendered."));
        } finally {
            setBusy(null);
        }
    };

    const copyShare = async () => {
        if (prepared === null) return;
        setCopyStatus("");
        try {
            await copyText(prepared.shareLink.url);
            setCopyStatus(shareWarning ? "Copied — this long link may not work in every app." : "Share link copied.");
        } catch (cause) {
            setError(stageError("input", cause, "The share link could not be copied."));
        }
    };

    return (
        <main className="speedrun-studio" data-testid="speedrun-studio">
            <header className="studio-hero">
                <div className="hero-mark"><i /><span>COSIMO</span></div>
                <p>SOUND SPEEDRUN STUDIO</p>
                <h1>Build the sound.<br />Show every move.</h1>
                <div className="hero-status">
                    <span className={canRenderVideo ? "is-ready" : ""} />
                    {support === null
                        ? "Checking browser encoders…"
                        : canRenderVideo
                            ? `Ready for ${support.mp4 ? "MP4" : "WebM fallback"}`
                            : "Audio works here; video export needs WebCodecs"}
                </div>
            </header>

            {error ? <ErrorCard error={error} clear={() => setError(null)} /> : null}

            <section className="studio-panel input-panel">
                <div className="panel-heading"><div><span>01</span><h2>Source</h2></div><p>{activeLabel}</p></div>
                <div className="input-columns">
                    <fieldset>
                        <legend>Sound</legend>
                        <SourceChoice name="patch-source" value="current" active={patchSource === "current"}
                            label="Current browser sound" detail="Reads this origin’s saved patch" onChange={() => setPatchSource("current")} />
                        <SourceChoice name="patch-source" value="file" active={patchSource === "file"}
                            label="Patch file" detail="Preset, browser state, or bare patch JSON" onChange={() => setPatchSource("file")} />
                        {patchSource === "file" ? (
                            <label className="file-picker"><input data-testid="patch-file" type="file" accept=".json,application/json"
                                onChange={(event) => setPatchFile(event.currentTarget.files?.[0] ?? null)} />
                                <span>{patchFile?.name ?? "Choose patch JSON"}</span></label>
                        ) : null}
                        <SourceChoice name="patch-source" value="share" active={patchSource === "share"}
                            label="Share link" detail="Paste a #p=1 Cosimo URL" onChange={() => setPatchSource("share")} />
                        {patchSource === "share" ? (
                            <textarea data-testid="share-link-input" value={shareValue} onChange={(event) => setShareValue(event.currentTarget.value)}
                                placeholder="https://…/#p=1.…" rows={3} />
                        ) : null}
                    </fieldset>
                    <fieldset>
                        <legend>Performance</legend>
                        <SourceChoice name="performance-source" value="default" active={performanceSource === "default"}
                            label="Cosimo demo phrase" detail="Bundled 2.4 second cycling performance" onChange={() => setPerformanceSource("default")} />
                        <SourceChoice name="performance-source" value="file" active={performanceSource === "file"}
                            label="MIDI or JSON notes" detail="SMF 0/1, tempo map, CC and pitch bend" onChange={() => setPerformanceSource("file")} />
                        {performanceSource === "file" ? (
                            <label className="file-picker"><input data-testid="performance-file" type="file" accept=".mid,.midi,.json,audio/midi,application/json"
                                onChange={(event) => setPerformanceFile(event.currentTarget.files?.[0] ?? null)} />
                                <span>{performanceFile?.name ?? "Choose MIDI / notes JSON"}</span></label>
                        ) : null}
                        <label className="duration-setting"><span>Duration ceiling</span><div><input data-testid="duration-ceiling" type="number" min="3" max="90" step="1"
                            value={durationCeiling} onChange={(event) => setDurationCeiling(Math.min(90, Math.max(3, Number(event.currentTarget.value) || 3)))} /><b>sec</b></div></label>
                    </fieldset>
                </div>
                <button data-testid="analyze-button" className="primary-action" type="button" disabled={busy !== null} onClick={() => void analyze()}>
                    {busy === "analysis" ? "Analyzing…" : "Analyze reconstruction"}
                </button>
            </section>

            {prepared ? <RecipeReport prepared={prepared} /> : null}

            {prepared ? (
                <section className="studio-panel render-panel" data-testid="audio-stage">
                    <div className="panel-heading"><div><span>03</span><h2>Checkpoint audio</h2></div><p>Fresh offline engines · deterministic splice</p></div>
                    <div className="render-row">
                        <div className="progress-block"><span style={{ width: `${audioProgress * 100}%` }} /><b>{Math.round(audioProgress * 100)}%</b></div>
                        {busy === "audio" ? <button className="cancel-action" type="button" onClick={() => session.cancel()}>Cancel audio</button>
                            : <button data-testid="render-audio-button" className="primary-action" type="button" disabled={busy !== null} onClick={() => void renderAudio()}>
                                {audio ? "Render audio again" : "Render checkpoint audio"}</button>}
                    </div>
                    {audio ? (
                        <div className="audition" data-testid="audio-ready"><audio controls src={audio.url} /><span>{megabytes(audio.bytes)} · rendered in {seconds(audio.elapsedMilliseconds / 1_000)}</span></div>
                    ) : null}
                </section>
            ) : null}

            {audio && prepared ? (
                <section className="studio-panel render-panel" data-testid="video-stage">
                    <div className="panel-heading"><div><span>04</span><h2>Video export</h2></div><p>Browser-only render · verified before download</p></div>
                    <div className="export-options">
                        <label><span>Container</span><select data-testid="container-choice" value={containerChoice}
                            onChange={(event) => setContainerChoice(event.currentTarget.value as "auto" | SpeedrunVideoContainer)}>
                            <option value="auto">Auto — prefer MP4</option>
                            <option value="mp4" disabled={support?.mp4 === false}>MP4 · H.264 / AAC</option>
                            <option value="webm" disabled={support?.webm === false}>WebM fallback · VP9 / Opus</option>
                        </select></label>
                        <label><span>Encode quality</span><select data-testid="video-quality" value={videoQuality}
                            onChange={(event) => setVideoQuality(event.currentTarget.value as typeof videoQuality)}>
                            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="very-low">Very low</option>
                        </select></label>
                    </div>
                    <div className="render-row">
                        <div className="progress-block"><span style={{ width: `${videoProgress * 100}%` }} /><b>{Math.round(videoProgress * 100)}%</b></div>
                        {busy === "video" ? <button className="cancel-action" type="button" onClick={() => session.cancel()}>Cancel video</button>
                            : <button data-testid="render-video-button" className="primary-action" type="button" disabled={busy !== null || !canRenderVideo} onClick={() => void renderVideo()}>
                                {video ? "Render video again" : "Render verified video"}</button>}
                    </div>
                    {video ? (
                        <div className="delivery" data-testid="video-ready">
                            <div><small>VERIFIED {video.format.label.toUpperCase()}</small><strong>{video.fileName}</strong>
                                <span>{megabytes(video.blob.size)} · {seconds(video.verification.durationSeconds)} · minimum audio RMS {video.verification.minimumWindowRms.toFixed(5)}</span></div>
                            <div className="delivery-actions">
                                <a data-testid="download-video" className="download-action" href={video.url} download={video.fileName}>Download {video.format.extension.toUpperCase()}</a>
                                <button data-testid="copy-share-link" type="button" onClick={() => void copyShare()}>Copy share link</button>
                            </div>
                            <input className={shareWarning ? "share-url is-warning" : "share-url"} readOnly value={prepared.shareLink.url} aria-label="Rendered sound share link" />
                            {copyStatus ? <p className="copy-status" role="status">{copyStatus}</p> : null}
                        </div>
                    ) : null}
                </section>
            ) : null}

            <footer className="studio-footer"><span>No uploads. No render server.</span><b>PATCH → RECIPE → AUDIO → VIDEO</b></footer>
        </main>
    );
}
