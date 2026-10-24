import { useState } from "react";
import { Slider } from "../../index";
import "./examples.css";

export function StepsExample() {
    const [value, setValue] = useState(3);
    return <Slider className="slider-example" label="Voices" value={value}
        onValueChange={setValue} min={1} max={8} step={1} tickCount={8} discrete />;
}
