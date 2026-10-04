import { createRoot } from "react-dom/client";
import * as Examples from "./examples";
import { exampleSources, exampleStyles } from "./sources";
import { ReferencePage, type DocsExample } from "../reference";

const entries = [
    ["default", "Default", "Drag to adjust a value.", Examples.DefaultExample],
    ["scales", "Scales", "Linear, logarithmic, stepped and custom ranges.", Examples.ScalesExample],
    ["entry", "Exact entry", "Type a value and unit. Enter commits; Escape cancels.", Examples.EntryExample],
    ["live", "Live modulation", "A live marker moves independently of the value you edit.", Examples.LiveExample],
    ["two-axis", "Two-axis editing", "Drag vertically and horizontally to edit two values.", Examples.TwoAxisExample],
    ["menu", "Context menu", "Right-click or long-press to open a Radix context menu.", Examples.MenuExample],
    ["custom", "Custom artwork", "Replace the dial while keeping pointer and keyboard behavior.", Examples.CustomExample],
    ["styles", "Size and color", "Style individual controls with CSS variables.", Examples.StylesExample],
    ["states", "Disabled and read-only", "Control editability without changing the value.", Examples.StatesExample],
    ["horizontal", "Horizontal drag", "Change drag direction, travel and keyboard increments.", Examples.HorizontalExample],
    ["gestures", "Gesture grouping", "Group a drag into one Undo action.", Examples.GesturesExample],
] as const;
const examples: DocsExample[] = entries.map(([id, title, description, component]) => ({
    id, title, description, component,
    files: [{ name: `${id}.tsx`, text: exampleSources[id] ?? "" }, { name: "examples.css", text: exampleStyles }],
}));
const root = document.getElementById("root");
if (!root) throw new Error("Missing component reference root.");
createRoot(root).render(<ReferencePage title="Knob" description="A numeric control with pointer, keyboard and exact-value editing."
    usage={'import { useState } from "react";\nimport { Knob } from "../../kit/index";\n\nexport function Example() {\n    const [gain, setGain] = useState(0.5);\n    return <Knob label="Gain" value={gain} onValueChange={setGain} />;\n}'}
    examples={examples} api={[
        { name: "Knob", description: "Complete dial. value and onValueChange are controlled by your application." },
        { name: "min / max / step / scale", description: "Value range and response. Defaults to a continuous 0–1 range." },
        { name: "KnobRoot / KnobControl", description: "Share value context and input behavior with custom artwork." },
        { name: "KnobDial / KnobLabel / KnobValue / KnobInput", description: "Optional visual and text-entry parts." },
        { name: "KnobRange / KnobMarker", description: "Modulation range and read-only live position." },
        { name: "className / style", description: "Normal CSS styling. --knob-size and --knob-color style the dial." },
        { name: "onGestureStart / onGestureEnd", description: "Connect edit grouping to your plugin state." },
    ]} />);
