# Knob API

A controlled numeric input with reusable pointer/keyboard behavior and composable artwork. Import from `kit/index`; the scoped default styles are included.

Run `npm run ui:docs:dev` and choose **Knob** for the interactive reference page. Every example has a Preview/Code view. The Code tab contains the complete TSX file (including imports and helpers) and `examples.css`. Copy both files together; adjust the public kit import path for your application. The examples run from those exact source files, and a browser test copies the displayed code into a separate page without the documentation application. It covers the default control, linear/log/custom scales, discrete values, exact entry, live modulation, two-axis editing, context menus, custom artwork, styling, disabled/read-only state and gesture grouping.

## Start with a complete control

```tsx
import { Knob } from "../../kit/index";

<Knob label="Cutoff" value={cutoff} onValueChange={setCutoff}
  min={20} max={20_000} scale="log" formatValue={formatHz} />
```

`value` and `onValueChange` are required. Bounds default to 0–1. Values, bounds and `step` use the same units: a cutoff in Hz stays in Hz, including its live marker. A logarithmic scale needs positive bounds. Omit `step` for continuous movement; provide it for discrete choices or a quantized range. A custom `scale` supplies inverse `toPosition(value)` / `fromPosition(position)` functions over normalized 0–1 travel. They must be finite, monotonic and mutually consistent.

## Compose the parts

```tsx
<KnobRoot value={cutoff} onValueChange={setCutoff} min={20} max={20_000} scale="log">
  <KnobLabel>Cutoff</KnobLabel>
  <KnobControl className="bk-knob-default-control">
    <KnobDial>
      <KnobRange from={400} to={6000} />
      <KnobMarker value={liveCutoff} />
    </KnobDial>
  </KnobControl>
  <KnobValue />
  <KnobInput parseValue={parseHz} aria-label="Exact cutoff" />
</KnobRoot>
```

| Part | Owns |
|---|---|
| `KnobRoot` | Value interpretation, range, scale, formatting and shared interaction state. A layout container. |
| `KnobControl` | Slider accessibility, focus, keyboard editing, pointer capture, drag and gesture cleanup. No control size, shape, colors or focus decoration. |
| `KnobDial` | Default SVG artwork. Children share its 100-unit drawing coordinates. |
| `KnobRange` | A visual interval in canonical units. `innerRadius` / `outerRadius` default to 40 / 48. |
| `KnobMarker` | A read-only value indicator. `radius` defaults to 44; `smoothingMs` defaults to 45. |
| `KnobLabel`, `KnobValue` | An accessible label and formatted base-value readout. |
| `KnobInput` | Text entry, validation, commit on Enter/blur and draft cancellation on Escape. |
| `useKnob()` | `value`, normalized `position`, `toPosition(value)`, `isDragging`, `activeAxis` for custom child presentation. |

Every visual part forwards its normal DOM props and ref. Use classes, styles, ARIA and data attributes normally. `--knob-size` sets the default dial's size; colors come from the shared theme properties below. State styling can target `data-disabled`, `data-readonly`, `data-dragging`, and `data-axis`.

`Knob` includes the default round control appearance. When composing the parts, add `className="bk-knob-default-control"` to opt into that same size, round shape and keyboard-focus outline. Omit that class for custom artwork and style your control with ordinary CSS, including a visible `:focus-visible` indicator. This choice works with or without `asChild`; `asChild` only chooses the DOM element. You do not need CSS resets to cancel a forced circle. `KnobRoot` retains its documented layout, label/readout styles and theme variables; customize it with `className` or `style` as usual.

The custom example puts a rectangular meter inside a rounded tile. The tile owns selection, drop feedback and keyboard focus; the input inside owns editing. It includes an ordinary HTML drag source to exercise the visual states. Application drag/drop semantics remain application code. The input surface and the artwork may have different sizes.

Replace `KnobDial` with your SVG or HTML artwork inside `KnobControl` to preserve input behavior. Use `asChild` to put the control behavior on one custom, ref-forwarding element. That child must spread its props, preserve the supplied event handlers and remain focusable. Interactive descendants inside the slider are not supported: put a text input or button beside the control. Caller handlers can prevent default before an edit starts; cleanup still runs when a gesture ends.

## Exact values and formatting

`formatValue` formats both the readout and accessible value text. It does not change the numeric domain. The plain input accepts a number; `parseValue(text)` can return:

```ts
{ kind: "ok", value: 2500 }
{ kind: "error", message: "Enter a frequency in Hz or kHz." }
```

The input then checks finiteness/bounds and applies `step`. Errors leave the base value unchanged. The live example uses the kit's existing text normalization and numeric/unit lexer to accept Hz/kHz without hiding range errors through premature clamping. Use a composed multi-value editor for changes such as switching free time to tempo sync; a scalar knob cannot infer a second parameter write.

## Live modulation

A marker accepts a number, `null` (hidden), or a stable read-only source:

```ts
type LiveValue<T> = {
  getSnapshot(): T;
  subscribe(onChange: () => void): () => void;
};
```

A live numeric source returns `number | null`. The component subscribes, updates SVG attributes through a shared animation-frame driver and unsubscribes on source replacement/unmount. Static/settled indicators stop scheduling work. A new or reactivated source starts at its observed position. Smoothing affects presentation only; use `smoothingMs={0}` for immediate updates.

The source supplies the effective value in the knob's units. Its owner resolves routing and modulation law: a selected route's contribution and the combined result of all sources are different possible displays. A knob must not guess which is intended. Base editing remains independent and marker movement never saves state or enters Undo history. The reference page explicitly simulates a signal; it does not run an audio engine.

## Input and edit gestures

`KnobControl` defaults to vertical drag. Set `drag="horizontal"` for horizontal movement. `sensitivity` is CSS pixels per full travel, default 220. A secondary quantity in a two-axis mapping can supply its own `sensitivity`; otherwise it inherits the control’s sensitivity. Shift-drag uses one tenth of normal travel.

Keyboard editing is the same on every kit control. Arrow keys move one step: Right and Up increase, Left and Down decrease. Shift makes a step ten times finer, Page Up/Down ten times coarser, and Home/End jump to the ends of the range. Holding a key is one gesture, from the first keydown to keyup. A step is one `step`, or 1% of normalized travel when the value is continuous; `keyboardStep` replaces it with an amount in the value's units. Shift has no effect on a stepped value, because a finer step would snap back. Escape cancels the open gesture. Read-only blocks edits but remains focusable; disabled also leaves the tab order. Both still reflect external value updates.

`onGestureStart` fires before the first changed value. `onGestureEnd(cancelled)` finishes the bracket once on release, cancellation, loss of capture/focus, relevant reconfiguration or unmount. Cancellation ends input; it keeps changes already accepted by the owner. A click with no edit creates no bracket. Key the root when switching to a different parameter with the same range so transient input cannot remain bound to the old parameter.

```tsx
<KnobControl className="bk-knob-default-control" drag={{
  horizontal: "value",
  vertical: {
    value: depth, onValueChange: setDepth, min: -1, max: 1, sensitivity: 360,
    onGestureStart: beginDepthEdit, onGestureEnd: endDepthEdit,
  },
}}>
  <KnobDial />
</KnobControl>
```

Two-axis input classifies the dominant direction and can switch as the pointer changes direction. A switching sample is consumed instead of jumping the other value. Each quantity has its own edit bracket. `null` makes an axis inert. Give the secondary quantity a labelled keyboard-accessible control as well; the main slider's keyboard semantics describe its main value.

## Accessibility

`KnobControl` is an ARIA slider. It is named by `aria-label`, by `aria-labelledby`, or by a rendered `KnobLabel`; without any of them it has no name, so give icon-only knobs an `aria-label`. `aria-orientation` follows `drag="horizontal"` or `"vertical"`. `formatValue` supplies `aria-valuetext`.

## Styling

Every kit control reads the same color properties, so one rule on your plugin's root themes knobs, sliders, MSEGs and filters together. Set them on any ancestor, or on a single control to theme it alone. A property you leave unset falls back to that control's own default palette.

| Property | Knob | Slider | MSEG | Filter |
|---|---|---|---|---|
| `--editor-accent-start` | Value arc, focus ring | Current cell, value thumb, focus ring | Curve, fill and points | Range start, modulation, focus ring |
| `--editor-accent-end` | `KnobRange` | Modulation end | – | Range end |
| `--editor-surface-ink` | Handle and marker | Text and filled cells | – | Labels and grips |
| `--editor-surface-ink-muted` | – | Label | – | Axis labels, readout captions |
| `--editor-surface-bg` | Handle outline | Background | – | Plot background |
| `--editor-label-font` | – | Label and readout | – | Labels, chips and readout |

## State, menus and application overlays

Wire `value` / `onValueChange` and gesture callbacks to [plugin state](PLUGIN_STATE.md). The knob does not own persistence, engine application or history. Keep state failures/retry presentation at the application level.

Compose an ordinary context-menu trigger around `KnobControl`. The shipped reference uses Radix's `ContextMenu.Trigger asChild`, matching the composition pattern familiar from shadcn's Radix components. The menu receives standard context-menu events, including a stationary touch long press. Applications own menu actions and keyboard menu-opening behavior; the demo includes Shift+F10/ContextMenu support. No routing action enum is embedded in the knob.

An application overlay can observe the same value, use gesture callbacks, or consume `useKnob()` inside the root. Position it from a normal element ref. No application-specific HUD renderer or model is bundled.
