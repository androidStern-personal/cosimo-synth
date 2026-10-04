import { useState } from "react";
import { EditorTickSlider, formatFrequencyDisplay } from "../../index";
import "./examples.css";

export function EntryExample() {
    const [value, setValue] = useState(1200);
    return <EditorTickSlider className="slider-example" label="Frequency" value={value}
        onChange={setValue} min={20} max={20000} step={1} scale="log"
        formatValue={formatFrequencyDisplay}
        entrySpec={{ _tag: "frequency", min: 20, max: 20000, step: 1,
            defaultUnit: "Hz", percentScale: null }} />;
}
