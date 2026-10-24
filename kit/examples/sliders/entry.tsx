import { useState } from "react";
import { Slider, formatFrequencyDisplay, parameterEntrySpecForFrequency } from "../../index";
import "./examples.css";

const frequencyEntry = parameterEntrySpecForFrequency({ minHz: 20, maxHz: 20000, stepHz: 1, allowLogPercent: false });

export function EntryExample() {
    const [value, setValue] = useState(1200);
    return <Slider className="slider-example" label="Frequency" value={value}
        onValueChange={setValue} min={20} max={20000} scale="log"
        formatValue={formatFrequencyDisplay} entrySpec={frequencyEntry} />;
}
