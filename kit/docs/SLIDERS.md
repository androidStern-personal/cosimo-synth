# Slider

A segmented numeric slider with optional modulation endpoints.

Open the interactive docs with `npm run ui:docs:dev`, then choose **Slider**. The examples cover ordinary values, logarithmic frequency, exact entry, discrete steps, modulation and styling. `npm run test:sliders` checks them in a browser.

## Usage

```tsx
import { useState } from "react";
import { Slider } from "../../kit/index";

export function Gain() {
    const [value, setValue] = useState(0.5);
    return <Slider label="Gain" value={value} onValueChange={setValue} />;
}
```

The default range is 0–1 with 16 cells. Styles are included. `onValueChange` returns the value in the units you supply.

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

| Prop | Default / purpose |
|---|---|
| `label`, `value`, `onValueChange` | Required visible label and controlled value. The label is also the accessible name unless you pass `aria-label`. |
| `min`, `max` | `0`, `1`. |
| `step` | None: the value is continuous. Set it to snap to steps in the value's units. |
| `scale` | `"linear"`, `"log"` (positive range) or `{ toPosition, fromPosition }`, as for the knob. |
| `tickCount`, `discrete` | `16`, `false`. `discrete` fills whole cells only. |
| `formatValue` | Readout and `aria-valuetext` formatting. |
| `entrySpec` | Makes the readout a button that opens unit-aware exact entry, for example `parameterEntrySpecForFrequency(...)`. Enter commits, Escape cancels. |
| `modulation` | `{ end, onEndChange, direction? }`. `direction` is `"both"` (default), `"up"` or `"down"`; a one-sided end follows the value when the value passes it. |
| `disabled` | Blocks editing and closes an open gesture. |
| `onGestureStart`, `onGestureEnd(cancelled)` | Bracket each drag, held key or exact entry as one edit. Release ends it; pointer cancellation, blur, Escape, disabling, a range or modulation change and unmount cancel it. |
| `className`, `style`, `ref`, other div attributes | Applied to the root element. |

## Keyboard

Keyboard editing is the same on every kit control. Arrow keys move one step: Right and Up increase, Left and Down decrease. Shift makes a step ten times finer, Page Up/Down ten times coarser, and Home/End jump to the ends of the range. A step is one `step`, or 1% of the travel when the value is continuous; Shift has no effect on a stepped value. With `modulation`, the value and the end are two focusable sliders that follow the same keys.

## Styling

Parts carry `data-slot` attributes for styling and tests: `slider` (root, with `data-modulated` and `data-disabled`), `slider-label`, `slider-input`, `slider-cell` (with `data-fill` and `data-current`), `slider-value`, `slider-entry`, `slider-range`, `slider-drag-surface`, `slider-start` and `slider-end`. The scoped `.bk-slider__*` classes can be restyled with ordinary CSS.

Every kit control reads the same color properties, so one rule on your plugin's root themes knobs, sliders, MSEGs and filters together. Set them on any ancestor, or on a single control to theme it alone. A property you leave unset falls back to that control's own default palette.

| Property | Knob | Slider | MSEG | Filter |
|---|---|---|---|---|
| `--editor-accent-start` | Value arc, focus ring | Current cell, value thumb, focus ring | Curve, fill and points | Range start, modulation, focus ring |
| `--editor-accent-end` | `KnobRange` | Modulation end | – | Range end |
| `--editor-surface-ink` | Handle and marker | Text and filled cells | – | Labels and grips |
| `--editor-surface-ink-muted` | – | Label | – | Axis labels, readout captions |
| `--editor-surface-bg` | Handle outline | Background | – | Plot background |
| `--editor-label-font` | – | Label and readout | – | Labels, chips and readout |

The slider also reads `--editor-accent-range` (modulation range cells), `--editor-entry-background` (exact-entry field) and `--editor-label-size-sm`, `--editor-label-size-md`, `--editor-label-weight` and `--editor-label-letter-spacing`.

See [plugin state](PLUGIN_STATE.md) for saving and shared Undo.
