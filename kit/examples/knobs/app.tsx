import { createRoot } from "react-dom/client";
import { ReferencePage, type DocsExample } from "../reference";
import { DefaultExample } from "./default";
import { ScalesExample } from "./scales";
import { EntryExample } from "./entry";
import { LiveExample } from "./live";
import { TwoAxisExample } from "./two-axis";
import { MenuExample } from "./menu";
import { CustomExample } from "./custom";
import { StylesExample } from "./styles";
import { StatesExample } from "./states";
import { HorizontalExample } from "./horizontal";
import { GesturesExample } from "./gestures";
import defaultSource from "./default.tsx?raw";
import scalesSource from "./scales.tsx?raw";
import entrySource from "./entry.tsx?raw";
import liveSource from "./live.tsx?raw";
import twoAxisSource from "./two-axis.tsx?raw";
import menuSource from "./menu.tsx?raw";
import customSource from "./custom.tsx?raw";
import stylesSource from "./styles.tsx?raw";
import statesSource from "./states.tsx?raw";
import horizontalSource from "./horizontal.tsx?raw";
import gesturesSource from "./gestures.tsx?raw";
import styles from "./examples.css?raw";

const entries = [
    ["default", "Default", "Drag to adjust a value.", DefaultExample, defaultSource],
    ["scales", "Scales", "Linear, logarithmic, stepped and custom ranges.", ScalesExample, scalesSource],
    ["entry", "Exact entry", "Type a value and unit. Enter commits; Escape cancels.", EntryExample, entrySource],
    ["live", "Live modulation", "A live marker moves independently of the value you edit.", LiveExample, liveSource],
    ["two-axis", "Two-axis editing", "Drag vertically and horizontally to edit two values.", TwoAxisExample, twoAxisSource],
    ["menu", "Context menu", "Right-click or long-press to open a Radix context menu.", MenuExample, menuSource],
    ["custom", "Custom artwork", "Replace the dial while keeping pointer and keyboard behavior.", CustomExample, customSource],
    ["styles", "Size and color", "Style individual controls with CSS variables.", StylesExample, stylesSource],
    ["states", "Disabled and read-only", "Control editability without changing the value.", StatesExample, statesSource],
    ["horizontal", "Horizontal drag", "Change drag direction, travel and keyboard increments.", HorizontalExample, horizontalSource],
    ["gestures", "Gesture grouping", "Group a drag into one Undo action.", GesturesExample, gesturesSource],
] as const;
const examples: DocsExample[] = entries.map(([id, title, description, component, source]) => ({
    id, title, description, component,
    files: [{ name: `${id}.tsx`, text: source }, { name: "examples.css", text: styles }],
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
        { name: "className / style", description: "Normal CSS styling. --knob-size sets the dial size; --editor-* tokens set its colors." },
        { name: "onGestureStart / onGestureEnd", description: "Connect edit grouping to your plugin state." },
    ]} />);
