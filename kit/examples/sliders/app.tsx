import { createRoot } from "react-dom/client";
import { ReferencePage, type DocsExample } from "../reference";
import styles from "./examples.css?raw";
import { DefaultExample } from "./default";
import defaultSource from "./default.tsx?raw";
import { RangeExample } from "./range";
import rangeSource from "./range.tsx?raw";
import { FrequencyExample } from "./frequency";
import frequencySource from "./frequency.tsx?raw";
import { EntryExample } from "./entry";
import entrySource from "./entry.tsx?raw";
import { StepsExample } from "./steps";
import stepsSource from "./steps.tsx?raw";
import { StylesExample } from "./styles";
import stylesSource from "./styles.tsx?raw";
import { StatesExample } from "./states";
import statesSource from "./states.tsx?raw";

const examples: DocsExample[] = [
    { id: "default", title: "Default", description: "Drag to adjust the level.", component: DefaultExample, files: [{ name: "default.tsx", text: defaultSource }, { name: "examples.css", text: styles }] },
    { id: "range", title: "Modulation range", description: "Drag the nearest endpoint or focus it and use arrow keys.", component: RangeExample, files: [{ name: "range.tsx", text: rangeSource }, { name: "examples.css", text: styles }] },
    { id: "frequency", title: "Logarithmic scale", description: "Distribute a frequency range logarithmically.", component: FrequencyExample, files: [{ name: "frequency.tsx", text: frequencySource }, { name: "examples.css", text: styles }] },
    { id: "entry", title: "Exact entry", description: "Click the value to enter a frequency in Hz or kHz.", component: EntryExample, files: [{ name: "entry.tsx", text: entrySource }, { name: "examples.css", text: styles }] },
    { id: "steps", title: "Discrete values", description: "Use complete cells for stepped values.", component: StepsExample, files: [{ name: "steps.tsx", text: stepsSource }, { name: "examples.css", text: styles }] },
    { id: "styles", title: "Styling", description: "Change cell count, shape and color with normal CSS.", component: StylesExample, files: [{ name: "styles.tsx", text: stylesSource }, { name: "examples.css", text: styles }] },
    { id: "states", title: "Controlled and disabled", description: "Replace the value externally or disable editing.", component: StatesExample, files: [{ name: "states.tsx", text: statesSource }, { name: "examples.css", text: styles }] },
];
const root = document.getElementById("root");
if (!root) throw new Error("Missing component reference root.");
createRoot(root).render(<ReferencePage title="Slider" description="A segmented numeric slider with optional modulation endpoints."
    usage={'import { useState } from "react";\nimport { EditorTickSlider } from "../../kit/index";\n\nexport function Example() {\n    const [value, setValue] = useState(0.5);\n    return <EditorTickSlider label="Gain" value={value} onChange={setValue} />;\n}'}
    examples={examples} api={[
        { name: "value / onChange", description: "Controlled value. Defaults to a 0–1 range." },
        { name: "min / max / step / tickCount", description: "Range, increments and number of cells." },
        { name: "scale / discrete", description: "Linear or logarithmic travel; partial or complete cell filling." },
        { name: "modulation", description: "Optional end value, onEndChange and up/down/both direction." },
        { name: "entrySpec / formatValue", description: "Unit-aware exact entry and display formatting." },
        { name: "className / style / ref", description: "Standard root styling, attributes and element ref." },
        { name: "onGestureStart / onGestureEnd", description: "Group edits; cleanup also closes an active gesture." },
    ]} />);
