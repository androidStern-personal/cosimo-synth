# Filter API

`FilterEditor` draws a filter response and edits cutoff and resonance. It is a controlled UI: your plug-in supplies values and receives edits. It does not process audio or create modulation routes.

Run `npm run ui:filters:dev` for five interactive examples with Preview/Code tabs. Each tab shows the actual TSX used by its preview and the companion CSS. `npm run test:filters` checks the public API in a browser. The files under `kit/examples/filters/` can be copied into your plug-in.

```tsx
import { FilterEditor, type FilterValue } from "../../../kit/index";

const [value, setValue] = useState<FilterValue>({
    mode: "lowpass", cutoffHz: 1200, q: 3,
});

<FilterEditor value={value} onValueChange={setValue} showModeControls />
```

Drag horizontally for cutoff, vertically for resonance. Arrow keys edit the focused grip; Shift makes larger steps. The supported modes are `off`, `lowpass`, `highpass`, `bandpass`, `notch`, and `peak`. Cutoff spans 20–20,000 Hz logarithmically; Q spans 0.1–20 through `qScale`. The defaults use a curved resonance transfer; supply `{ qToSurface, surfaceToQ }` to choose another invertible mapping.

| Add this | Result |
|---|---|
| `range={{ startCutoffHz, endCutoffHz }}` and `onRangeChange` | Cutoff-only band below the response. `rangePolarity="unipolar"` anchors its start to the base value. |
| `modulation={{ start: { cutoffHz, q }, end: { cutoffHz, q } }}` and `onModulationChange` | Two-dimensional endpoint grips, shaded response bounds, and a center grip that moves both endpoints by the same screen-space distance. Use this instead of `range`. |
| `preview={{ cutoffHz, q, mode }}` | A separate effective/live response; omitted fields inherit the base value. `active: false` hides it. Preview data does not change the editable base. |
| `spectrum={{ frame, renderMode }}` | FFT overlay with smoothing and peak hold. `frame` is `{ sampleRateHz, magnitudes }`, using linear FFT magnitudes from DC to Nyquist. Modes are `graph`, `bars`, and `round-bars`. A null frame clears it. |
| `showModeControls`, `showHandleChips`, `showReadout` | Optional mode button, cutoff-band chips, and values. All default off. |
| `readOnly` or `disabled` | Prevent editing while still rendering externally updated values. Disabled also dims the control. |

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
    onEditStart={(target) => beginEdit(target)}
    onEditEnd={(target) => endEdit(target)}
/>
```

A unipolar presentation passes `start: value`, hides the separate start grip, and uses `baseHandleMode: "start"`. Your callback updates the base when `target` is `base` or `center`; the unipolar example shows this explicitly. A coincident endpoint parks beside the base so the zero-width interval remains editable. `axes` constrains pointer and keyboard edits; it never fabricates a missing route.

`onEditStart`/`onEditEnd` bracket each gesture for host automation or Undo. Targets are `value`, `range-start`, `range-end`, `modulation-start`, `modulation-end`, `modulation-base`, and `modulation-center`. Value and band drags begin on the first movement; modulation drags begin on pointer-down so the host can snapshot the fixed endpoint. Keyboard steps and mode changes are complete one-shot edits. Pointer release/cancel, capture loss, page blur, disabling, read-only changes, and unmount close an open edit.

## Styling and sizing

Defaults install once per document or shadow root and disappear when the last editor unmounts. No stylesheet imports are needed for the control itself. `className` and `style` apply to the root. Override CSS tokens on that root; the example stylesheet includes light, dark, and custom appearances.

Common tokens: `--editor-surface-bg`, `--editor-surface-ink`, `--editor-surface-ink-muted`, `--editor-grid-stroke`, `--editor-axis-stroke`, `--editor-zone-fill`, `--editor-zone-stroke`, `--editor-curve-stroke`, `--editor-curve-stroke-width`, `--editor-curve-preview-stroke`, `--editor-handle-fill`, `--editor-handle-stroke`, `--editor-handle-halo-fill`, `--editor-handle-halo-stroke`, `--editor-accent-start`, `--editor-accent-end`, and `--filter-spectrum-rgb` (three space-separated RGB channels). Modulation can use `color` or `--filter-modulation-color`; `--filter-modulation-handle-fill` controls hollow grip backgrounds. The remaining chip, label, and readout tokens are listed in `kit/ui/filter-editor.css`.

The mode button follows the surface colors in light and dark themes. Override `--filter-mode-background`, `--filter-mode-hover-background`, `--filter-mode-active-background` or `--filter-mode-border` for separate button chrome.

The viewport sizes itself to its container. Override `.filter-range-editor__viewport` for a fixed height; `plotPadding={{ horizontal, top, bottom }}` sets geometry spacing in pixels. `sampleRateHz` controls the response calculation (default 44,100). The spectrum uses its own frame sample rate. Optional `spectrum.timestampMs` gives deterministic smoothing in a recording or replay.

`FilterRangeEditor` remains a compatibility alias of `FilterEditor`, with the same existing cutoff-band props and helpers. There is one response sampler and one gesture implementation for both presentations.
