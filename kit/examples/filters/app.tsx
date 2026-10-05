import { createRoot } from "react-dom/client";
import { ReferencePage, type DocsExample } from "../reference";
import { DefaultExample } from "./default";
import { BandExample } from "./band";
import { ModulationExample } from "./modulation";
import { AnalyzerExample } from "./analyzer";
import { StatesExample } from "./states";
import defaultSource from "./default.tsx?raw";
import bandSource from "./band.tsx?raw";
import modulationSource from "./modulation.tsx?raw";
import analyzerSource from "./analyzer.tsx?raw";
import statesSource from "./states.tsx?raw";
import styles from "./examples.css?raw";

const entries = [
    ["default", "Default", "Drag horizontally for cutoff and vertically for resonance.", DefaultExample, defaultSource],
    ["band", "Cutoff range", "Add a one-axis range with editable endpoints.", BandExample, bandSource],
    ["modulation", "Two-axis modulation", "Drag either endpoint or move the interval with the center handle.", ModulationExample, modulationSource],
    ["analyzer", "Spectrum", "Overlay a generated demo signal and a live response.", AnalyzerExample, analyzerSource],
    ["states", "Styling and state", "Custom colors, resonance scales and editability.", StatesExample, statesSource],
] as const;
const examples: DocsExample[] = entries.map(([id, title, description, component, source]) => ({
    id, title, description, component,
    files: [{ name: `${id}.tsx`, text: source }, { name: "examples.css", text: styles }],
}));
const root = document.getElementById("root");
if (!root) throw new Error("Missing component reference root.");
createRoot(root).render(<ReferencePage title="Filter" description="A filter response editor with optional modulation and spectrum layers."
    usage={'import { useState } from "react";\nimport { FilterEditor, type FilterValue } from "../../kit/index";\n\nexport function Example() {\n    const [value, setValue] = useState<FilterValue>({\n        mode: "lowpass", cutoffHz: 1200, q: 3,\n    });\n    return <FilterEditor value={value} onValueChange={setValue} />;\n}'}
    examples={examples} api={[
        { name: "value / onValueChange", description: "Controlled mode, cutoffHz and q." },
        { name: "range / onRangeChange", description: "Optional one-dimensional cutoff interval." },
        { name: "modulation / onModulationChange", description: "Optional cutoff/resonance interval and editable axes." },
        { name: "spectrum / preview", description: "Read-only analyzer data and the live response from your engine." },
        { name: "showModeControls / showHandleChips / showReadout", description: "Optional mode button, range chips and value readout." },
        { name: "className / style / ref", description: "Root styling, attributes and element ref; --editor-* tokens set the theme." },
        { name: "onGestureStart / onGestureEnd(cancelled)", description: "Bracket each drag or held key as one edit; both also name the grip." },
    ]} />);
