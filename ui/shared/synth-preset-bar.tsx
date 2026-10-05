import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { PresetBar, SnapshotBar, usePluginState, usePresets } from "../../kit/index";
import type { PluginStateFields } from "../../kit/ui/plugin-state-definition";
import { pluginManifestId } from "../../kit/ui/plugin-state-user-files";
import { editOutcome, jsonEqual, parsePresetFile, soundChanges, useCurrentSound, type SoundValues } from "../../kit/ui/presets";
import { usePatchConnection } from "./cmajor-react";
import {
    advancePolishPeakDisplay,
    createPolishPeakDisplayState,
    formatPolishLoudnessDbfs,
    formatPolishPeakDbfs,
    type PolishMeterFrame,
} from "./polish";
import { createSoundShareURL, decodeSoundShareFragment, stripSoundShareFragment } from "./sound-share-link";
import { validateSoundShareWavetables, type ShippedWavetableTable } from "./sound-share-wavetable";
import { synthPluginState, synthSourceMode } from "./synth-plugin-state";

type Notice = { readonly kind: "status" | "error"; readonly text: string } | null;
type ShareDialog = { readonly url: string; readonly message: string; readonly warning: boolean };
type SharedSound = { readonly name: string; readonly values: SoundValues };

export interface SynthPresetBarProps {
    /** The phone shell row (ADR-026): Back, Polish meter, the preset name, and one menu. */
    readonly compact: boolean;
    readonly backAvailable: boolean;
    readonly onBack: () => void;
    readonly polishMeter: PolishMeterFrame;
    /** The factory tables this surface ships; a sound link may only name these. */
    readonly wavetableTables: ReadonlyArray<ShippedWavetableTable>;
    readonly bounceAudioAvailable: boolean;
    readonly onBounceAudio: () => void;
    readonly videoBounceAvailable: boolean;
    /** Receives the current sound as a speedrun patch: label, parameters and stored documents. */
    readonly onBounceVideo: (patch: unknown) => void;
    readonly developerSettingsAvailable: boolean;
    readonly onOpenDeveloperSettings: () => void;
    /** A preset, snapshot, Undo of either, or sound link replaced the sound; receives its parameter values. */
    readonly onSoundReplaced: (parameters: Readonly<Record<string, number>>) => void;
}

const fields: PluginStateFields = synthPluginState;

function parameterValues(values: Readonly<Record<string, unknown>>): Record<string, number> {
    const parameters: Record<string, number> = {};
    for (const [key, value] of Object.entries(values)) {
        if (fields[key]?.kind === "parameter" && typeof value === "number") parameters[key] = value;
    }
    return parameters;
}

function canUseSoundLinks() {
    try {
        const { protocol } = new URL(globalThis.location.href);
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
}

/** The synth's preset row: the kit's preset and snapshot bars plus sound links, Bounce and the shell controls. */
export function SynthPresetBar(props: SynthPresetBarProps) {
    const { compact, polishMeter, wavetableTables, onSoundReplaced } = props;
    const presets = usePresets(synthPluginState);
    const editor = usePluginState(synthPluginState);
    const sound = useCurrentSound(synthPluginState);
    const sourceMode = usePluginState(synthSourceMode);
    const activePreset = usePluginState(synthPluginState.activePreset);
    const activeSnapshot = usePluginState(synthPluginState.activeSnapshot);
    const pluginId = pluginManifestId(usePatchConnection().manifest);
    const [menuOpen, setMenuOpen] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);
    const [shareDialog, setShareDialog] = useState<ShareDialog | null>(null);
    const [sharedSound, setSharedSound] = useState<SharedSound | null>(null);
    const menuId = useId();
    const ready = presets.status === "ready" && sound.status === "ready";
    const bounced = "value" in sourceMode.state && sourceMode.state.value === 1;

    // A recall changes the active preset or snapshot together with the sound; a library
    // action such as Save changes the active preset but leaves the sound as it was.
    const recall = useRef<{ readonly preset: unknown; readonly snapshot: unknown; readonly sound: SoundValues | null } | null>(null);
    const presetValue = "value" in activePreset.state ? activePreset.state.value : undefined;
    const snapshotValue = "value" in activeSnapshot.state ? activeSnapshot.state.value : undefined;
    useEffect(() => {
        const previous = recall.current;
        const current = sound.status === "ready" ? sound : null;
        recall.current = { preset: presetValue, snapshot: snapshotValue, sound: current?.saved ?? null };
        if (!previous?.sound || !current) return;
        const activeChanged = previous.preset !== presetValue || previous.snapshot !== snapshotValue;
        if (activeChanged && !jsonEqual(previous.sound, current.saved)) onSoundReplaced(parameterValues(current.values));
    }, [presetValue, snapshotValue, sound, onSoundReplaced]);

    // A link opened in the browser offers its sound once the presets are ready.
    const fragmentChecked = useRef(false);
    useEffect(() => {
        if (!ready || fragmentChecked.current) return;
        fragmentChecked.current = true;
        void decodeSoundShareFragment(globalThis.location.hash).then(decoded => {
            if (!decoded.ok) { setNotice({ kind: "error", text: decoded.error.message }); return; }
            if (decoded.value === null) return;
            if (!pluginId) { setNotice({ kind: "error", text: "This view has no plugin ID, so it cannot read sound links." }); return; }
            const parsed = parsePresetFile(decoded.value, pluginId, synthPluginState);
            if (parsed.kind === "error") { setNotice({ kind: "error", text: parsed.message }); return; }
            setSharedSound(parsed.value);
        });
    }, [ready, pluginId]);

    const closeMenuAnd = (action: () => void) => () => { setMenuOpen(false); action(); };

    const shareSound = async () => {
        setNotice(null);
        if (sound.status !== "ready") return;
        if (bounced) { setNotice({ kind: "error", text: "Bounced sounds can't be shared by link yet." }); return; }
        const tables = validateSoundShareWavetables(sound.values, wavetableTables);
        if (!tables.ok) { setNotice({ kind: "error", text: tables.error.message }); return; }
        const exported = presets.exportJson();
        if (exported.kind === "failed") { setNotice({ kind: "error", text: exported.message }); return; }
        const created = await createSoundShareURL(exported.text, globalThis.location.href);
        if (!created.ok) { setNotice({ kind: "error", text: created.error.message }); return; }
        const { url, length, lengthClass } = created.value;
        const warning = lengthClass === "warning";
        const message = warning
            ? `This link is ${length.toLocaleString()} characters. Some apps may shorten it; copy the complete link below.`
            : "Anyone with this link can choose to load this sound. The sound stays in the link itself.";
        setShareDialog({ url, message, warning });
        if (await copyText(url)) setShareDialog({ url, message: `${warning ? `${message} ` : ""}Link copied.`, warning });
    };

    const copyShareLink = async () => {
        if (!shareDialog) return;
        setNotice(await copyText(shareDialog.url)
            ? { kind: "status", text: "Sound link copied." }
            : { kind: "error", text: "Copy failed. Select the link and copy it manually." });
    };

    const loadSharedSound = async () => {
        const shared = sharedSound;
        setSharedSound(null);
        if (!shared) return;
        const tables = validateSoundShareWavetables(shared.values, wavetableTables);
        if (!tables.ok) { setNotice({ kind: "error", text: tables.error.message }); return; }
        const result = editOutcome(await editor.edit({ ...soundChanges(synthPluginState, shared.values), activePreset: null }, { recall: true }));
        if (result.kind === "failed") { setNotice({ kind: "error", text: result.message }); return; }
        onSoundReplaced(parameterValues(shared.values));
        const stripped = stripSoundShareFragment();
        setNotice(stripped.ok
            ? { kind: "status", text: `Loaded “${shared.name}”. Save it as a preset to keep it.` }
            : { kind: "error", text: stripped.error.message });
    };

    const bounceVideo = () => {
        if (sound.status !== "ready") return;
        const { saved } = sound;
        const parameters = parameterValues(sound.values);
        if ("value" in sourceMode.state) parameters.sourceMode = sourceMode.state.value;
        const storedState = Object.fromEntries(Object.entries(saved).filter(([key]) => fields[key]?.kind === "stored"));
        props.onBounceVideo({ label: presets.active?.name ?? "Current sound", parameters, storedState });
    };

    useEffect(() => {
        if (notice?.kind !== "status") return;
        const timer = setTimeout(() => setNotice(null), 2500);
        return () => clearTimeout(timer);
    }, [notice]);

    const soundActions = <>
        {compact && <SnapshotBar definition={synthPluginState} className="synth-preset-bar-snapshots" />}
        <MenuButton action="share" disabled={!ready || !canUseSoundLinks()} onClick={closeMenuAnd(() => { void shareSound(); })}>Share sound link</MenuButton>
        <MenuButton action="bounce-audio" disabled={!props.bounceAudioAvailable} onClick={closeMenuAnd(props.onBounceAudio)}>Bounce audio</MenuButton>
        {props.videoBounceAvailable && <MenuButton action="bounce-video" disabled={!ready} onClick={closeMenuAnd(bounceVideo)}>Bounce video</MenuButton>}
        {props.developerSettingsAvailable && <MenuButton action="perf-tuning" onClick={closeMenuAnd(props.onOpenDeveloperSettings)}>Developer settings</MenuButton>}
    </>;

    const menu = <>
        <button type="button" data-action="toggle-sound-actions" aria-label="Sound actions" aria-expanded={menuOpen} aria-controls={menuId}
            onClick={() => setMenuOpen(!menuOpen)}
            className={`grid place-items-center text-[18px] leading-none text-slate-200/80 ${compact ? "h-10 w-10" : "h-6 w-8 rounded border border-white/20"}`}>&#8943;</button>
        {menuOpen && <div id={menuId} data-role="sound-actions" role="group" aria-label="Sound actions"
            className="absolute right-0 top-[calc(100%+6px)] z-40 flex w-max min-w-[208px] max-w-[calc(100vw-16px)] flex-col gap-1 rounded-xl border border-white/10 bg-[#14191c] p-1.5 shadow-[0_14px_32px_rgba(0,0,0,0.55)]">
            {compact && <PresetBar definition={synthPluginState} className="flex-wrap p-1" />}
            {soundActions}
        </div>}
    </>;

    // The phone row keeps the ADR-026 composition: Back and the Polish meter on the left,
    // the preset name centered on the row whatever the Back state, and one menu on the right.
    return <div data-role="synth-preset-bar" data-compact={compact ? "" : undefined}
        className={`relative min-w-0 text-[11px] text-slate-100 ${compact ? "h-[var(--compact-shell-row,40px)]" : "flex items-center gap-2 px-3 py-1.5"}`}
        onKeyDown={event => { if (event.key === "Escape" && menuOpen) { event.preventDefault(); setMenuOpen(false); } }}>
        {compact ? <>
            <div data-role="shell-left-cluster" className="absolute left-0 top-0 z-[2] flex h-full w-[134px] items-center gap-0.5">
                <button type="button" data-action="shell-back" aria-label="Back" disabled={!props.backAvailable} onClick={props.onBack}
                    className="grid h-full w-10 shrink-0 place-items-center text-[20px] leading-none text-slate-200/80 disabled:pointer-events-none disabled:invisible">&#8249;</button>
                <PolishMeter frame={polishMeter} />
            </div>
            <p data-role="preset-name"
                className="absolute left-1/2 top-0 z-[1] m-0 h-full w-[max(0px,calc(100%-268px))] -translate-x-1/2 truncate text-center text-[13px] leading-[var(--compact-shell-row,40px)]">
                {presets.active?.name ?? "No preset"}
                {presets.dirty && <span data-role="preset-modified" className="text-[var(--editor-accent-start)]" aria-label="Modified"> ●</span>}
            </p>
            <div className="absolute right-0 top-0 z-[2] h-full">{menu}</div>
        </> : <>
            <PresetBar definition={synthPluginState} className="min-w-0" />
            <SnapshotBar definition={synthPluginState} />
            <div className="relative ml-auto shrink-0">{menu}</div>
        </>}
        {sharedSound && <Dialog role="alertdialog" name="shared-load-dialog" title="Load shared sound?">
            <p className="m-0">Load “{sharedSound.name}” from this link? You can undo it.</p>
            <div className="flex justify-end gap-2">
                <DialogButton onClick={() => { setSharedSound(null); }}>Cancel</DialogButton>
                <DialogButton primary onClick={() => { void loadSharedSound(); }}>Load</DialogButton>
            </div>
        </Dialog>}
        {shareDialog && <Dialog role="dialog" name="share-dialog" title="Share sound">
            <p className={`m-0 ${shareDialog.warning ? "text-amber-300" : ""}`}>{shareDialog.message}</p>
            <input type="text" readOnly value={shareDialog.url} aria-label="Sound link" onFocus={event => event.currentTarget.select()}
                className="h-7 w-full rounded border border-white/20 bg-black/30 px-2 text-[11px] text-slate-100" />
            <div className="flex justify-end gap-2">
                <DialogButton onClick={() => setShareDialog(null)}>Close</DialogButton>
                <DialogButton primary onClick={() => { void copyShareLink(); }}>Copy link</DialogButton>
            </div>
        </Dialog>}
        {notice && <div role={notice.kind === "error" ? "alert" : "status"}
            className={`absolute left-2 top-[calc(100%+4px)] z-50 flex max-w-[420px] items-center gap-2 rounded bg-[#14191c] px-2 py-1 ${notice.kind === "error" ? "text-[#fa9b91]" : ""}`}>
            {notice.text}
            {notice.kind === "error" && <button type="button" onClick={() => setNotice(null)} className="underline">Dismiss</button>}
        </div>}
    </div>;
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

function MenuButton({ action, disabled = false, onClick, children }: {
    readonly action: string;
    readonly disabled?: boolean;
    readonly onClick: () => void;
    readonly children: ReactNode;
}) {
    return <button type="button" data-action={action} disabled={disabled} onClick={onClick}
        className="flex min-h-[34px] items-center rounded-lg px-3 text-left text-[13px] text-slate-100/90 hover:bg-white/5 disabled:cursor-default disabled:text-slate-100/30 disabled:hover:bg-transparent">
        {children}
    </button>;
}

function Dialog({ role, name, title, children }: {
    readonly role: "dialog" | "alertdialog";
    readonly name: string;
    readonly title: string;
    readonly children: ReactNode;
}) {
    const titleId = useId();
    return <div role={role} data-role={name} aria-modal="true" aria-labelledby={titleId}
        className="absolute left-1/2 top-[calc(100%+6px)] z-50 flex w-[min(360px,calc(100vw-16px))] -translate-x-1/2 flex-col gap-2 rounded-xl border border-white/10 bg-[#14191c] p-3 text-[12px] shadow-[0_14px_32px_rgba(0,0,0,0.55)]">
        <h3 id={titleId} className="m-0 text-[13px] font-semibold">{title}</h3>
        {children}
    </div>;
}

function DialogButton({ primary = false, onClick, children }: { readonly primary?: boolean; readonly onClick: () => void; readonly children: ReactNode }) {
    return <button type="button" onClick={onClick}
        className={`h-7 rounded border px-3 ${primary ? "border-[var(--editor-accent-start)] text-[var(--editor-accent-start)]" : "border-white/20"}`}>
        {children}
    </button>;
}

/** Peak (held, then decaying) and 400 ms loudness of the Polish output, with a light that pulses with loudness. */
function PolishMeter({ frame }: { readonly frame: PolishMeterFrame }) {
    const displayRef = useRef(createPolishPeakDisplayState());
    const [display, setDisplay] = useState(displayRef.current);
    useEffect(() => {
        let animation = 0;
        const present = (nowMs: number) => {
            const next = advancePolishPeakDisplay(displayRef.current, frame, nowMs);
            displayRef.current = next;
            setDisplay(next);
            const holding = nowMs < next.heldUntilMs;
            const decaying = next.peakDbfs > frame.peakDbfs + 0.01;
            if (holding || decaying) animation = requestAnimationFrame(present);
        };
        animation = requestAnimationFrame(present);
        return () => cancelAnimationFrame(animation);
    }, [frame]);

    const peak = formatPolishPeakDbfs(display.peakDbfs);
    const loudness = formatPolishLoudnessDbfs(frame.loudnessDbfs);
    const pulse = Math.max(0, Math.min(1, (frame.loudnessDbfs + 60) / 60));
    const light = display.peakDbfs >= 0 ? "#ff5c52" : display.peakDbfs >= -6 ? "#f4c86a" : "#77d9a2";
    return <div data-role="polish-meter" data-overload={display.peakDbfs >= 0 ? "true" : "false"}
        aria-label={`Polish output: peak ${peak} dBFS, loudness ${loudness} dBFS`}
        className="pointer-events-none grid h-6 w-[92px] shrink-0 grid-cols-[7px_35px_34px] items-center gap-[3px] overflow-hidden rounded-full border border-white/10 bg-black/35 px-1 text-[8px] tabular-nums text-slate-200/80">
        <span data-role="polish-meter-light" aria-hidden="true" className="h-1.5 w-1.5 rounded-full"
            style={{ background: light, boxShadow: `0 0 7px ${light}`, opacity: 0.32 + pulse * 0.68, transform: `scale(${0.78 + pulse * 0.38})` }} />
        <output className="grid grid-cols-[8px_minmax(0,1fr)] items-center whitespace-nowrap" aria-label="Peak dBFS">
            <b className="font-semibold text-slate-200/40">P</b>
            <span data-role="polish-meter-peak" className={`overflow-hidden text-right ${display.peakDbfs >= 0 ? "text-[#ff6b61]" : ""}`}>{peak}</span>
        </output>
        <output className="grid grid-cols-[8px_minmax(0,1fr)] items-center whitespace-nowrap" aria-label="400 millisecond loudness dBFS">
            <b className="font-semibold text-slate-200/40">L</b>
            <span data-role="polish-meter-loudness" className="overflow-hidden text-right">{loudness}</span>
        </output>
    </div>;
}
