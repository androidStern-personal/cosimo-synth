import { useState } from "react";
import { EditorTickSlider } from "../../index";
import "./examples.css";

export function DefaultExample() {
    const [value, setValue] = useState(0.62);
    return <EditorTickSlider className="slider-example" label="Gain" value={value}
        onChange={setValue} formatValue={value => `${Math.round(value * 100)}%`} />;
}
