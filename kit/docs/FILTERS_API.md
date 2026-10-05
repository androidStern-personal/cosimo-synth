# Filter API

`FilterEditor` draws a filter response and edits cutoff and resonance. It is a controlled UI: your plug-in supplies values and receives edits. It does not process audio or create modulation routes.

Run `npm run ui:docs:dev` and choose **Filter** for five interactive examples with Preview/Code tabs. Each tab shows the actual TSX used by its preview and the companion CSS. `npm run test:filters` checks the public API in a browser. The files under `kit/examples/filters/` can be copied into your plug-in.

```tsx
import { FilterEditor, type FilterValue } from "../../../kit/index";

const [value, setValue] = useState<FilterValue>({
    mode: "lowpass", cutoffHz: 1200, q: 3,
});

<FilterEditor value={value} onValueChange={setValue} showModeControls />
```

Drag horizontally for cutoff, vertically for resonance. The supported modes are `off`, `lowpass`, `highpass`, `bandpass`, `notch`, and `peak`. Cutoff spans 20–20,000 Hz logarithmically; Q spans 0.1–20 through `qScale`. The default, `DEFAULT_FILTER_Q_SCALE`, is a logistic curve that gives low and moderate Q most of the drag height; supply `{ qToSurface, surfaceToQ }` to choose another invertible mapping.

`FilterEditor` forwards its ref and any other div attributes to the root element. `aria-label` names the editing surface (default "Filter editor").

| Add this | Result |
|---|---|
| `range={{ startCutoffHz, endCutoffHz }}` and `onRangeChange` | Cutoff-only band below the response. `rangePolarity="unipolar"` anchors its start to the base value. |
| `modulation={{ start: { cutoffHz, q }, end: { cutoffHz, q } }}` and `onModulationChange` | Two-dimensional endpoint grips, shaded response bounds, and a center grip that moves both endpoints by the same screen-space distance. Use this instead of `range`. |
| `preview={{ cutoffHz, q, mode }}` | A separate live response, such as the modulated value your engine reports; omitted fields inherit the base value. `active: false` hides it. Preview data does not change the editable base. |
| `spectrum={{ frame, renderMode }}` | FFT overlay with smoothing and peak hold. `frame` is `{ sampleRateHz, magnitudes }`, using linear FFT magnitudes from DC to Nyquist. Modes are `graph`, `bars`, and `round-bars`. A null frame clears it. |
| `showModeControls`, `showHandleChips`, `showReadout` | Optional mode button, cutoff-band chips, and values. All default off. |
| `readOnly` or `disabled` | Prevent editing while still rendering externally updated values. Read-only grips stay focusable; disabled also dims the control and leaves the tab order. |

## Modulation and edit boundaries

`onModulationChange(nextEndpoints, target)` identifies the edited grip as `start`, `end`, `base`, or `center`. Translate the returned cutoff/Q values into your own route amounts. The editor does not assume a particular modulation engine.

```tsx
<FilterEditor
    value={value}
    onValueChange={setValue}
    modulation={{
        ...endpoints,
        axes: "both",              // "cutoff", "q", or "both"
        showStartHandle: true,
        showCenterHandle: true,
        baseHandleMode: "value",  // "start" lets this grip edit a unipolar start
        color: "#ae8ef6",
    }}
    onModulationChange={(next, target) => updateRoutes(next, target)}
    onGestureStart={(grip) => beginEdit(grip)}
    onGestureEnd={(cancelled, grip) => endEdit(grip, cancelled)}
/>
```

A unipolar presentation passes `start: value`, hides the separate start grip, and uses `baseHandleMode: "start"`. Your callback updates the base when `target` is `base` or `center`; the unipolar example shows this explicitly. A coincident endpoint parks beside the base so the zero-width interval remains editable. `axes` constrains pointer and keyboard edits; it never fabricates a missing route.

`onGestureStart(grip)` and `onGestureEnd(cancelled, grip)` bracket each gesture for host automation or Undo, like every kit control's gesture callbacks; the extra argument names the grip: `value`, `range-start`, `range-end`, `modulation-start`, `modulation-end`, `modulation-base` or `modulation-center`. Value and band drags begin on the first movement; modulation drags begin on pointer-down so the host can snapshot the fixed endpoint. A held key is one gesture, and a mode change is a complete one. Release and keyup end a gesture; pointer cancellation, capture loss, page blur, focus loss, disabling, read-only changes and unmount cancel it.

## Keyboard

Keyboard editing is the same on every kit control. Arrow keys move one step: Right and Up increase, Left and Down decrease. Shift makes a step ten times finer, Page Up/Down ten times coarser, and Home/End jump to the ends of the range. Holding a key is one gesture, from the first keydown to keyup.

On the value and modulation grips, Left/Right move cutoff by 1% of its travel and Up/Down and Page Up/Down move Q by 2.5% of the drag height; Home/End set the lowest or highest cutoff. A cutoff band grip edits only its cutoff, so every key moves it. The center grip moves both modulation endpoints by the same distance a drag would.

## Styling and sizing

Defaults install once per document or shadow root and disappear when the last editor unmounts. No stylesheet imports are needed for the control itself. `className` and `style` apply to the root; the example stylesheet includes light, dark, and custom appearances.

Every kit control reads the same color properties, so one rule on your plugin's root themes knobs, sliders, MSEGs and filters together. Set them on any ancestor, or on a single control to theme it alone. A property you leave unset falls back to that control's own default palette.

| Property | Knob | Slider | MSEG | Filter |
|---|---|---|---|---|
| `--editor-accent-start` | Value arc, focus ring | Current cell, value thumb, focus ring | Curve, fill and points | Range start, modulation, focus ring |
| `--editor-accent-end` | `KnobRange` | Modulation end | – | Range end |
| `--editor-surface-ink` | Handle and marker | Text and filled cells | – | Labels and grips |
| `--editor-surface-ink-muted` | – | Label | – | Axis labels, readout captions |
| `--editor-surface-bg` | Handle outline | Background | – | Plot background |
| `--editor-label-font` | – | Label and readout | – | Labels, chips and readout |

The filter also reads its own drawing properties: `--editor-grid-stroke`, `--editor-axis-stroke`, `--editor-zone-fill`, `--editor-zone-stroke`, `--editor-curve-stroke`, `--editor-curve-stroke-width`, `--editor-curve-preview-stroke`, `--editor-curve-preview-stroke-width`, `--editor-curve-fill`, `--editor-handle-fill`, `--editor-handle-stroke`, `--editor-handle-stroke-width`, `--editor-handle-halo-fill`, `--editor-handle-halo-stroke`, `--editor-handle-halo-stroke-width`, `--editor-accent-range`, `--editor-accent-start-ink`, `--editor-accent-end-ink`, `--editor-chip-bg`, `--editor-chip-ink`, `--editor-chip-radius`, `--editor-label-weight`, `--editor-label-letter-spacing`, `--editor-label-size-sm`, `--editor-label-size-md`, and `--filter-spectrum-rgb` (three space-separated RGB channels for the analyzer). Modulation can use `color` or `--filter-modulation-color`; `--filter-modulation-handle-fill` controls hollow grip backgrounds.

The mode button follows the surface colors in light and dark themes. Override `--filter-mode-background`, `--filter-mode-hover-background`, `--filter-mode-active-background` or `--filter-mode-border` for separate button chrome.

The viewport sizes itself to its container. Override `.filter-range-editor__viewport` for a fixed height; `plotPadding={{ horizontal, top, bottom }}` sets geometry spacing in pixels. `sampleRateHz` controls the response calculation (default 44,100). The spectrum uses its own frame sample rate. Optional `spectrum.timestampMs` gives deterministic smoothing in a recording or replay.
