import { useRef, useState } from "react";
import { EditorTickSlider } from "../../index";
import "./examples.css";

export function StatesExample() {
    const [value, setValue] = useState(0.25);
    const [end, setEnd] = useState(0.75);
    const [disabled, setDisabled] = useState(false);
    const [mounted, setMounted] = useState(true);
    const [grouped, setGrouped] = useState(true);
    const [events, setEvents] = useState<string[]>([]);
    const inputRef = useRef<HTMLDivElement>(null);
    return <div className="slider-stack">
        {mounted && <EditorTickSlider ref={inputRef} className="slider-example" label="Controlled"
            value={value} onChange={setValue} disabled={disabled}
            modulation={grouped ? { end, onEndChange: setEnd } : null}
            onGestureStart={() => setEvents(previous => [...previous, "start"])}
            onGestureEnd={() => setEvents(previous => [...previous, "end"])} />}
        <div className="slider-actions">
            <button type="button" onClick={() => setValue(0.6)}>Set 60%</button>
            <button type="button" onClick={() => setMounted(!mounted)}>{mounted ? "Unmount" : "Mount"}</button>
            <label><input type="checkbox" checked={disabled} onChange={event => setDisabled(event.target.checked)} /> Disabled</label>
            <label><input type="checkbox" checked={grouped} onChange={event => setGrouped(event.target.checked)} /> Modulation</label>
        </div>
        <details><summary>Edit events</summary><output data-role="slider-events">{events.join(" · ") || "No edits yet."}</output></details>
    </div>;
}
