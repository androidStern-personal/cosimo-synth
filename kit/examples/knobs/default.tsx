import { useState } from "react";
import { Knob, formatFrequencyDisplay } from "../../index";
import "./examples.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;

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
