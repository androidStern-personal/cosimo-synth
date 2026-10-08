import { useState } from "react";
import { Slider } from "../../index";
import "./examples.css";

export function DefaultExample() {
    const [value, setValue] = useState(0.62);
    return <Slider className="slider-example" label="Gain" value={value}
        onValueChange={setValue} formatValue={value => `${Math.round(value * 100)}%`} />;
}
