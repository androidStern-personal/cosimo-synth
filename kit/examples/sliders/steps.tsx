import { useState } from "react";
import { EditorTickSlider } from "../../index";
import "./examples.css";

export function StepsExample() {
    const [value, setValue] = useState(3);
    return <EditorTickSlider className="slider-example" label="Voices" value={value}
        onChange={setValue} min={1} max={8} step={1} tickCount={8} discrete />;
}
