import { useState } from "react";
import { Slider, formatFrequencyDisplay } from "../../index";
import "./examples.css";

export function FrequencyExample() {
    const [value, setValue] = useState(1200);
    return <Slider className="slider-example" label="Cutoff" value={value}
        onValueChange={setValue} min={20} max={20000} scale="log"
        formatValue={formatFrequencyDisplay} />;
}
