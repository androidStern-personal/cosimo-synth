import { useState } from "react";
import { Knob } from "../../index";
import "./examples.css";

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function StylesExample() {
    const [value, setValue] = useState(0.67);
    return <div className="knob-row">
        <Knob label="Compact" value={value} onValueChange={setValue} className="compact" formatValue={percent} />
        <Knob label="Warm" value={value} onValueChange={setValue} className="warm" formatValue={percent} />
        <Knob label="Large" value={value} onValueChange={setValue} className="large cyan" formatValue={percent} />
    </div>;
}
