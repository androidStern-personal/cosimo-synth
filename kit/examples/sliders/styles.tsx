import { useState } from "react";
import { Slider } from "../../index";
import "./examples.css";

export function StylesExample() {
    const [value, setValue] = useState(0.5);
    return <div className="slider-stack">
        <Slider className="slider-example slider-rounded" label="Rounded"
            value={value} onValueChange={setValue} tickCount={24} />
        <Slider className="slider-example slider-warm" label="Warm"
            value={value} onValueChange={setValue} />
    </div>;
}
