import { useState } from "react";
import { KnobRoot, KnobControl, KnobDial, KnobLabel, KnobValue } from "../../index";
import "./examples.css";

export function HorizontalExample() {
    const [value, setValue] = useState(50);
    return <KnobRoot value={value} onValueChange={setValue} min={0} max={100}>
        <KnobLabel>Horizontal drag</KnobLabel>
        <KnobControl className="bk-knob-default-control" drag="horizontal" sensitivity={320} keyboardStep={5}><KnobDial /></KnobControl>
        <KnobValue />
    </KnobRoot>;
}
