import { useState } from "react";
import { Slider } from "../../index";
import "./examples.css";

export function RangeExample() {
    const [value, setValue] = useState(0.25);
    const [end, setEnd] = useState(0.75);
    return <Slider className="slider-example" label="Range" value={value}
        onValueChange={setValue} modulation={{ end, onEndChange: setEnd }} />;
}
