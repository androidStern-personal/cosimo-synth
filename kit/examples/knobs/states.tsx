import { useState } from "react";
import { Knob } from "../../index";
import "./examples.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;

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
