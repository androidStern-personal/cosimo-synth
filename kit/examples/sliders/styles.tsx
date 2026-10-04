import { useState } from "react";
import { EditorTickSlider } from "../../index";
import "./examples.css";

export function StylesExample() {
    const [value, setValue] = useState(0.5);
    return <div className="slider-stack">
        <EditorTickSlider className="slider-example slider-rounded" label="Rounded"
            value={value} onChange={setValue} tickCount={24} />
        <EditorTickSlider className="slider-example slider-warm" label="Warm"
            value={value} onChange={setValue} accent="end" />
    </div>;
}
