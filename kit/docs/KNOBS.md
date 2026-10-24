# Knob

A numeric control with pointer, keyboard and exact-value editing.

Open the interactive docs with `npm run ui:docs:dev`, then choose **Knob**. Each example has Preview and Code tabs; the displayed code is the source running in the preview.

## Usage

```tsx
import { useState } from "react";
import { Knob } from "../../kit/index";

export function Gain() {
    const [value, setValue] = useState(0.5);
    return <Knob label="Gain" value={value} onValueChange={setValue} />;
}
```

Adjust the import path for your project. Styles are included and scoped to the component.

## Examples

| Need | Example |
|---|---|
| Frequency, stepped or bipolar values | [Scales](../examples/knobs/scales.tsx) |
| Type an exact value and unit | [Exact entry](../examples/knobs/entry.tsx) |
| Display a live modulation position | [Live modulation](../examples/knobs/live.tsx) |
| Replace the dial artwork | [Custom artwork](../examples/knobs/custom.tsx) |
| Add a context menu | [Context menu](../examples/knobs/menu.tsx) |
| Group a drag into one edit | [Gesture grouping](../examples/knobs/gestures.tsx) |

## Styling and composition

Set `className` or `style` on the control. `--knob-size` sets the default dial's size; the shared `--editor-accent-start`, `--editor-accent-end`, `--editor-surface-ink` and `--editor-surface-bg` properties set its colors, as they do for every kit control.

For custom artwork, compose `KnobRoot`, `KnobControl`, `KnobLabel` and the optional value/range/marker parts. The control keeps its input behavior; your artwork and application own their presentation.

See the [API reference](KNOBS_API.md) for all parts, keyboard behavior and live-value subscriptions. For saving and shared Undo, use [plugin state](PLUGIN_STATE.md).
