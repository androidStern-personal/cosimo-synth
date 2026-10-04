import { useState } from "react";
import { EditorTickSlider } from "../../index";
import "./examples.css";

export function RangeExample() {
    const [value, setValue] = useState(0.25);
    const [end, setEnd] = useState(0.75);
    return <EditorTickSlider className="slider-example" label="Range" value={value}
        onChange={setValue} modulation={{ end, onEndChange: setEnd }} />;
}
