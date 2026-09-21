import { useState } from "react";
import { KnobRoot, KnobControl, KnobLabel, KnobValue, useKnob } from "../../index";
import "./examples.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;

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
    const [selected, setSelected] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [assigned, setAssigned] = useState(false);
    return <div className="knob-row">
        <KnobRoot value={value} onValueChange={setValue} formatValue={percent} className="cyan">
            <KnobLabel>Custom dial</KnobLabel>
            <KnobControl asChild><button type="button" className="needle-control" title="Custom artwork, shared input"><Needle /></button></KnobControl>
            <KnobValue />
        </KnobRoot>
        <KnobRoot value={value} onValueChange={setValue} formatValue={percent} className="lavender">
            <KnobLabel>Custom meter</KnobLabel>
            <div className="custom-meter-tile" data-selected={selected || undefined}
                data-eligible={dragging || undefined} data-hovered={hovered || undefined}
                onDragOver={event => { if (dragging) { event.preventDefault(); setHovered(true); } }}
                onDragLeave={event => {
                    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setHovered(false);
                }}
                onDrop={event => {
                    event.preventDefault(); setHovered(false); setDragging(false);
                    if (event.dataTransfer.getData("text/plain") === "demo-source") setAssigned(true);
                }}>
                <KnobControl asChild onPointerDown={() => setSelected(true)} onKeyDown={() => setSelected(true)}>
                    <button type="button" className="meter-control"><Meter /></button>
                </KnobControl>
            </div>
            <KnobValue />
            <button type="button" className="demo-drag-source" draggable
                onDragStart={event => { event.dataTransfer.setData("text/plain", "demo-source"); setDragging(true); }}
                onDragEnd={() => { setDragging(false); setHovered(false); }}>
                Drag source
            </button>
            <small role="status">{assigned ? "Source assigned" : "Drop onto the meter"}</small>
        </KnobRoot>
    </div>;
}
