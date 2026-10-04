# Slider

A segmented numeric slider with optional modulation endpoints.

Open the interactive docs with `npm run ui:docs:dev`, then choose **Slider**. The examples cover ordinary values, logarithmic frequency, exact entry, discrete steps, modulation and styling.

## Usage

```tsx
import { useState } from "react";
import { EditorTickSlider } from "../../kit/index";

export function Gain() {
    const [value, setValue] = useState(0.5);
    return <EditorTickSlider label="Gain" value={value} onChange={setValue} />;
}
```

The default range is 0–1 with 16 cells and increments of 0.01. Styles are included. `onChange` returns the value in the units you supply.

## Examples

| Need | Example |
|---|---|
| Two modulation endpoints | [Modulation range](../examples/sliders/range.tsx) |
| Logarithmic frequency | [Frequency](../examples/sliders/frequency.tsx) |
| Unit-aware text entry | [Exact entry](../examples/sliders/entry.tsx) |
| Whole cells for stepped choices | [Discrete values](../examples/sliders/steps.tsx) |
| Cell shape, color and count | [Styling](../examples/sliders/styles.tsx) |
| External updates or disabled editing | [Controlled and disabled](../examples/sliders/states.tsx) |

## API

| Option | Default / purpose |
|---|---|
| `label`, `value`, `onChange` | Required accessible label and controlled value. |
| `min`, `max`, `step`, `tickCount` | `0`, `1`, `0.01`, `16`. |
| `scale`, `discrete` | `"linear"`, `false`. Use `"log"` with a positive range; `discrete` fills complete cells. |
| `formatValue`, `entrySpec` | Display formatting and optional unit-aware exact entry. |
| `modulation` | `{ end, onEndChange, direction? }`. Direction is `"both"`, `"up"` or `"down"`. |
| `onGestureStart`, `onGestureEnd` | Edit grouping; disabling or unmounting also closes an active gesture. |
| `className`, `style`, `ref` | Standard root presentation and element access. Other normal div attributes are forwarded. |

Style the scoped `.editor-tick-slider__*` classes or set inherited `--editor-surface-ink`, `--editor-accent-start`, `--editor-accent-end` , `--editor-accent-range` and `--editor-entry-background` tokens. A slider's value readout is display text; enable `entrySpec` to make it editable. See [plugin state](PLUGIN_STATE.md) for saving and shared Undo.
