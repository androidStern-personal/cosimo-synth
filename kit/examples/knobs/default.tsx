import { useState } from "react";
import { Knob } from "../../index";
import "./examples.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function DefaultExample() {
    const [gain, setGain] = useState(0.62);
    return <div className="knob-row hero-knobs">
        <Knob label="Gain" value={gain} onValueChange={setGain} formatValue={percent} />
    </div>;
}
