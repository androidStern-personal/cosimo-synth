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
