import { useRef, useState } from "react";
import { Knob } from "../../index";
import "./examples.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;

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
