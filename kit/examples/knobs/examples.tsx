import { useEffect, useMemo, useRef, useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { Knob, KnobRoot, KnobControl, KnobDial, KnobLabel, KnobValue, KnobInput, KnobRange, KnobMarker,
    useKnob, normalizeEntryText, parseNumericAndUnit, unitIs, formatFrequencyDisplay,
    type KnobParseResult, type KnobScale } from "../../index";

// example:default
export function DefaultExample() {
    const [gain, setGain] = useState(0.62);
    const [cutoff, setCutoff] = useState(1200);
    const [mix, setMix] = useState(0.4);
    return <div className="knob-row hero-knobs">
        <Knob label="Gain" value={gain} onValueChange={setGain} formatValue={percent} />
        <Knob label="Cutoff" value={cutoff} onValueChange={setCutoff} min={20} max={20000}
            scale="log" formatValue={formatFrequencyDisplay} className="cyan" />
        <Knob label="Mix" value={mix} onValueChange={setMix} formatValue={percent} className="lavender" />
    </div>;
}
// endexample

export const percent = (value: number) => `${Math.round(value * 100)}%`;
const db = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`;
const choices = ["Low-pass", "High-pass", "Band-pass", "Notch"];

// example:scales
export function ScalesExample() {
    const [trim, setTrim] = useState(-6);
    const [mode, setMode] = useState(1);
    const [response, setResponse] = useState(25);
    // A custom curve still uses canonical values at the public interface.
    const scale = useMemo<KnobScale>(() => ({
        toPosition: value => Math.sqrt(value / 100),
        fromPosition: position => position ** 2 * 100,
    }), []);
    return <div className="knob-row">
        <Knob label="Bipolar trim" min={-24} max={24} step={0.5} value={trim} onValueChange={setTrim} formatValue={db} />
        <Knob label="Filter mode" min={0} max={3} step={1} value={mode} onValueChange={setMode}
            formatValue={value => choices[value] ?? ""} className="cyan" />
        <Knob label="Custom response" min={0} max={100} scale={scale} value={response}
            onValueChange={setResponse} formatValue={value => value.toFixed(1)} className="lavender" />
    </div>;
}
// endexample

// example:entry
function parseFrequency(text: string): KnobParseResult {
    const parsed = parseNumericAndUnit(normalizeEntryText(text));
    if (!parsed || (parsed.unit !== undefined && !unitIs(parsed.unit, "hz", "khz", "k")))
        return { kind: "error", message: "Enter a frequency in Hz or kHz." };
    return { kind: "ok", value: Number(parsed.numericText) * (unitIs(parsed.unit, "khz", "k") ? 1000 : 1) };
}
export function EntryExample() {
    const [value, setValue] = useState(1200);
    return <KnobRoot value={value} onValueChange={setValue} min={20} max={20000} scale="log"
        formatValue={formatFrequencyDisplay} className="cyan">
        <KnobLabel>Frequency</KnobLabel>
        <KnobControl><KnobDial /></KnobControl>
        <KnobValue />
        <KnobInput parseValue={parseFrequency} aria-label="Exact frequency" />
    </KnobRoot>;
}
// endexample

// example:live
// This demo source simulates telemetry. It contains no audio engine or saved state.
function createSignal(initial: number | null) {
    let value = initial;
    const listeners = new Set<() => void>();
    return {
        getSnapshot: () => value,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        set: (next: number | null) => { value = next; for (const listener of listeners) listener(); },
    };
}
export function LiveExample() {
    const [cutoff, setCutoff] = useState(800);
    const [depth, setDepth] = useState(2);
    const [playing, setPlaying] = useState(true);
    const [smooth, setSmooth] = useState(45);
    const [mounted, setMounted] = useState(true);
    const source = useMemo(() => createSignal(null), []);
    const renders = useRef(0); renders.current += 1;
    useEffect(() => {
        if (!playing) { source.set(null); return; }
        const started = performance.now();
        const timer = window.setInterval(() => {
            const lfo = (Math.sin((performance.now() - started) / 500) + 1) / 2;
            // Example modulation law: +/- depth octaves around the base frequency.
            source.set(cutoff * 2 ** ((lfo * 2 - 1) * depth));
        }, 1000 / 60);
        return () => window.clearInterval(timer);
    }, [cutoff, depth, source, playing]);
    return <div className="live-layout">
        <div className="live-knob-slot">{mounted && <KnobRoot value={cutoff} onValueChange={setCutoff}
            min={20} max={20000} scale="log" formatValue={formatFrequencyDisplay}>
            <KnobLabel>Modulated cutoff</KnobLabel>
            <KnobControl><KnobDial>
                <KnobRange from={20} to={20000} opacity={0.15} />
                <KnobRange from={cutoff / 2 ** depth} to={cutoff * 2 ** depth} />
                <KnobMarker value={source} smoothingMs={smooth} />
            </KnobDial></KnobControl>
            <KnobValue />
        </KnobRoot>}</div>
        <div className="demo-controls">
            <label>Depth <span>{depth.toFixed(1)} oct</span><input aria-label="Modulation depth" type="range" min="0" max="4" step="0.1"
                value={depth} onChange={e => setDepth(Number(e.target.value))} /></label>
            <label>Smoothing <span>{smooth} ms</span><input aria-label="Marker smoothing" type="range" min="0" max="200" step="5"
                value={smooth} onChange={e => setSmooth(Number(e.target.value))} /></label>
            <div className="button-row"><button onClick={() => setPlaying(!playing)}>{playing ? "Stop signal" : "Start signal"}</button>
                <button onClick={() => setMounted(!mounted)}>{mounted ? "Detach knob" : "Attach knob"}</button></div>
            <small>Simulated 60 Hz signal · React renders: <output data-testid="live-renders">{renders.current}</output></small>
        </div>
    </div>;
}
// endexample

// example:two-axis
function InteractionReadout() {
    const { isDragging, activeAxis } = useKnob();
    return <small className="axis-readout">{isDragging ? `${activeAxis} axis` : "Drag → value · ↑ depth"}</small>;
}
export function TwoAxisExample() {
    const [value, setValue] = useState(0.5);
    const [depth, setDepth] = useState(0.25);
    const [enabled, setEnabled] = useState(true);
    return <div className="live-layout">
        <KnobRoot value={value} onValueChange={setValue} formatValue={percent}>
            <KnobLabel>Value & depth</KnobLabel>
            <KnobControl drag={{ horizontal: "value", vertical: enabled ? {
                value: depth, onValueChange: setDepth, min: -1, max: 1,
            } : null }}><KnobDial>
                <KnobRange from={value} to={value + depth} />
            </KnobDial></KnobControl>
            <KnobValue /><InteractionReadout />
        </KnobRoot>
        <div className="demo-controls">
            <label>Secondary value <span>{Math.round(depth * 100)}%</span><input aria-label="Secondary depth" type="range"
                min="-1" max="1" step="0.01" value={depth} onChange={e => setDepth(Number(e.target.value))} /></label>
            <label className="check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Enable vertical editing</label>
            <small>The secondary quantity is independent. It also has its own keyboard-accessible control.</small>
        </div>
    </div>;
}
// endexample

// example:menu
export function MenuExample() {
    const [value, setValue] = useState(0.62);
    const [message, setMessage] = useState("Right-click or hold still. Shift+F10 works too.");
    return <div className="centered-demo">
        <KnobRoot value={value} onValueChange={setValue} formatValue={percent} className="lavender">
            <KnobLabel>Output</KnobLabel>
            <ContextMenu.Root>
                <ContextMenu.Trigger asChild>
                    <KnobControl onKeyDown={event => {
                        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                            event.preventDefault();
                            const rect = event.currentTarget.getBoundingClientRect();
                            event.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true,
                                cancelable: true, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
                        }
                    }}><KnobDial /></KnobControl>
                </ContextMenu.Trigger>
                <ContextMenu.Portal><ContextMenu.Content className="demo-menu" aria-label="Output actions">
                    <ContextMenu.Item onSelect={() => { setValue(0.5); setMessage("Reset to 50%."); }}>Reset <span>50%</span></ContextMenu.Item>
                    <ContextMenu.Item onSelect={() => { setValue(0); setMessage("Output muted."); }}>Mute</ContextMenu.Item>
                    <ContextMenu.Separator />
                    <ContextMenu.Item onSelect={() => setMessage("Your application owns this command.")}>Custom action…</ContextMenu.Item>
                </ContextMenu.Content></ContextMenu.Portal>
            </ContextMenu.Root>
            <KnobValue />
        </KnobRoot><small role="status">{message}</small>
    </div>;
}
// endexample

// example:custom
function Needle() {
    const { position, isDragging } = useKnob();
    return <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="38" fill="var(--demo-disc)" stroke="currentColor" strokeWidth="1" opacity=".8" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" opacity=".1" />
        <g transform={`rotate(${-135 + position * 270} 50 50)`}>
            <path d="M 50 24 L 50 38" stroke="var(--knob-color)" strokeWidth={isDragging ? 5 : 3} strokeLinecap="round" />
        </g>
    </svg>;
}
function Meter() {
    const { position } = useKnob();
    return <div className="meter-art" aria-hidden="true"><div style={{ height: `${position * 100}%` }} /><i style={{ bottom: `${position * 100}%` }} /></div>;
}
export function CustomExample() {
    const [value, setValue] = useState(0.5);
    return <div className="knob-row">
        <KnobRoot value={value} onValueChange={setValue} formatValue={percent} className="cyan">
            <KnobLabel>Custom dial</KnobLabel>
            <KnobControl asChild><button type="button" title="Custom artwork, shared input"><Needle /></button></KnobControl>
            <KnobValue />
        </KnobRoot>
        <KnobRoot value={value} onValueChange={setValue} formatValue={percent} className="lavender">
            <KnobLabel>Custom meter</KnobLabel>
            <KnobControl asChild><button type="button" className="meter-control"><Meter /></button></KnobControl>
            <KnobValue />
        </KnobRoot>
    </div>;
}
// endexample

// example:styles
export function StylesExample() {
    const [value, setValue] = useState(0.67);
    return <div className="knob-row">
        <Knob label="Compact" value={value} onValueChange={setValue} className="compact" formatValue={percent} />
        <Knob label="Warm" value={value} onValueChange={setValue} className="warm" formatValue={percent} />
        <Knob label="Large" value={value} onValueChange={setValue} className="large cyan" formatValue={percent} />
    </div>;
}
// endexample

// example:states
export function StatesExample() {
    const [value, setValue] = useState(0.5);
    return <div className="centered-demo">
        <div className="knob-row">
            <Knob label="Editable" value={value} onValueChange={setValue} formatValue={percent} />
            <Knob label="Read-only" readOnly value={value} onValueChange={setValue} formatValue={percent} />
            <Knob label="Disabled" disabled value={value} onValueChange={setValue} formatValue={percent} />
        </div>
        <label className="wide-range">External value<input aria-label="External value" type="range" min="0" max="1" step="0.01"
            value={value} onChange={event => setValue(Number(event.target.value))} /></label>
    </div>;
}
// endexample

// example:horizontal
export function HorizontalExample() {
    const [value, setValue] = useState(50);
    return <KnobRoot value={value} onValueChange={setValue} min={0} max={100}>
        <KnobLabel>Horizontal drag</KnobLabel>
        <KnobControl drag="horizontal" sensitivity={320} keyboardStep={5}><KnobDial /></KnobControl>
        <KnobValue />
    </KnobRoot>;
}
// endexample

// example:gestures
export function GesturesExample() {
    const [value, setValue] = useState(0.5);
    const [mounted, setMounted] = useState(true);
    const [history, setHistory] = useState<number[]>([]);
    const [events, setEvents] = useState<string[]>([]);
    const latest = useRef(value); latest.current = value;
    const start = useRef(value);
    const log = (message: string) => setEvents(old => [...old.slice(-4), message]);
    return <div className="live-layout">
        <div className="live-knob-slot">{mounted && <Knob label="Gesture grouping" value={value}
            onValueChange={next => { latest.current = next; setValue(next); }} formatValue={percent}
            onGestureStart={() => { start.current = latest.current; log("Edit started"); }}
            onGestureEnd={cancelled => {
                if (start.current !== latest.current) setHistory(old => [...old, start.current]);
                log(cancelled ? "Edit cancelled · accepted changes kept" : "Edit ended · one history entry");
            }} />}</div>
        <div className="demo-controls">
            <div className="button-row"><button disabled={!history.length} onClick={() => {
                const previous = history.at(-1); if (previous === undefined) return;
                setValue(previous); setHistory(history.slice(0, -1)); log("Undo");
            }}>Undo ({history.length})</button>
            <button onClick={() => setMounted(!mounted)}>{mounted ? "Unmount" : "Mount"}</button></div>
            <div className="event-log" role="log" aria-label="Gesture events">{events.length ? events.map((event, i) => <div key={i}>{event}</div>) : "Waiting for an edit…"}</div>
            <small>Local history demonstrates gesture callbacks. In a plugin, wire these callbacks to usePluginState().</small>
        </div>
    </div>;
}
// endexample
