import { useState } from "react";
import { EditorTickSlider, formatFrequencyDisplay } from "../../index";
import "./examples.css";

export function FrequencyExample() {
    const [value, setValue] = useState(1200);
    return <EditorTickSlider className="slider-example" label="Cutoff" value={value}
        onChange={setValue} min={20} max={20000} step={1} scale="log"
        formatValue={formatFrequencyDisplay} />;
}
