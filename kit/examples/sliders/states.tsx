import { useState } from "react";
import { Slider } from "../../index";
import "./examples.css";

export function StatesExample() {
    const [value, setValue] = useState(0.25);
    const [end, setEnd] = useState(0.75);
    const [disabled, setDisabled] = useState(false);
    const [mounted, setMounted] = useState(true);
    const [modulated, setModulated] = useState(true);
    const [events, setEvents] = useState<string[]>([]);
    return <div className="slider-stack">
        {mounted && <Slider className="slider-example" label="Controlled"
            value={value} onValueChange={setValue} disabled={disabled}
            modulation={modulated ? { end, onEndChange: setEnd } : null}
            onGestureStart={() => setEvents(previous => [...previous, "start"])}
            onGestureEnd={cancelled => setEvents(previous => [...previous, cancelled ? "cancel" : "end"])} />}
        <div className="slider-actions">
            <button type="button" onClick={() => setValue(0.6)}>Set 60%</button>
            <button type="button" onClick={() => setMounted(!mounted)}>{mounted ? "Unmount" : "Mount"}</button>
            <label><input type="checkbox" checked={disabled} onChange={event => setDisabled(event.target.checked)} /> Disabled</label>
            <label><input type="checkbox" checked={modulated} onChange={event => setModulated(event.target.checked)} /> Modulation</label>
        </div>
        <details><summary>Edit events</summary><output data-role="slider-events">{events.join(" · ") || "No edits yet."}</output></details>
    </div>;
}
