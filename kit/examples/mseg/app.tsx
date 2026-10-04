import { createRoot } from "react-dom/client";
import { ReferencePage, type DocsExample } from "../reference";
import { DefaultExample } from "./default";
import { ComposedExample } from "./composed";
import { MorphExample } from "./morph";
import { StatesExample } from "./states";
import { PlaybackExample } from "./playback";
import defaultSource from "./default.tsx?raw";
import composedSource from "./composed.tsx?raw";
import morphSource from "./morph.tsx?raw";
import statesSource from "./states.tsx?raw";
import playbackSource from "./playback.tsx?raw";
import runtimeSource from "./playback-runtime.ts?raw";
import styles from "./examples.css?raw";

const entries = [
    ["default", "Default", "Add points, drag handles and bend segments.", DefaultExample, defaultSource],
    ["composed", "Composition", "Custom handles, drawing layers and a context menu.", ComposedExample, composedSource],
    ["playback", "Playback position", "Trigger the included Cmajor envelope Reader to move the playhead. Uses playback-program.js and playback-reader.json from this folder; no speaker output.", PlaybackExample, playbackSource],
    ["morph", "A/B morphing", "Edit either curve and blend their sampled output.", MorphExample, morphSource],
    ["states", "Orientation and state", "Vertical time, external updates, disabled and read-only editing.", StatesExample, statesSource],
] as const;
const examples: DocsExample[] = entries.map(([id, title, description, component, source]) => ({
    id, title, description, component,
    files: [{ name: `${id}.tsx`, text: source },
        ...(id === "playback" ? [{ name: "playback-runtime.ts", text: runtimeSource }] : []),
        { name: "examples.css", text: styles }],
}));
const root = document.getElementById("root");
if (!root) throw new Error("Missing component reference root.");
createRoot(root).render(<ReferencePage title="MSEG" description="An editable envelope made of points and curved segments."
    usage={'import { useState } from "react";\nimport { Mseg } from "../../kit/index";\n\nexport function Example() {\n    const [curve, setCurve] = useState(Mseg.defaultCurve);\n    return <Mseg.Editor value={curve} onValueChange={setCurve} aria-label="Envelope" />;\n}'}
    examples={examples} api={[
        { name: "Mseg.Editor", description: "Complete controlled editor. value and onValueChange edit the curve." },
        { name: "Mseg.Root / Mseg.Surface", description: "Editing context and the SVG interaction surface." },
        { name: "Mseg.Grid / Fill / Curve / Points", description: "Optional drawing layers, rendered in JSX order." },
        { name: "Mseg.Playhead / TimeAxis / Plot", description: "Playback position, time labels and sampled reference curves." },
        { name: "className / style / SVG props", description: "Size, colors and custom artwork use ordinary CSS and SVG." },
        { name: "disabled / readOnly", description: "Prevent editing while keeping the curve visible." },
        { name: "onGestureStart / onGestureEnd", description: "Connect edit grouping to your plugin state." },
    ]} />);
