import { useEffect, useMemo, useRef, useState } from "react";
import { KnobRoot, KnobControl, KnobDial, KnobLabel, KnobValue, KnobRange, KnobMarker, formatFrequencyDisplay } from "../../index";
import "./examples.css";

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
            <KnobControl className="bk-knob-default-control"><KnobDial>
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
