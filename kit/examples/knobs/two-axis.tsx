import { useState } from "react";
import { KnobRoot, KnobControl, KnobDial, KnobLabel, KnobValue, KnobRange, useKnob } from "../../index";
import "./examples.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;

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
            <KnobControl className="bk-knob-default-control" drag={{ horizontal: "value", vertical: enabled ? {
                value: depth, onValueChange: setDepth, min: -1, max: 1, sensitivity: 360,
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
