# MSEG API

An MSEG is an editable curve made of time/value points and curved segments. Start with `Mseg.Editor`; compose its public parts when you want different artwork, a toolbar, reference curves or a playhead. Saving and audio playback are separate from drawing, so the editor also works with plain React state.

Run `npm run ui:docs:dev` and choose **MSEG** for the interactive reference. Preview and Code tabs use the same source files. The real-playback example runs the included Cmajor Reader as an offline control signal, with no speaker output; its compiled program and source fingerprints ship with the example. Other examples cover custom handles/menus, A/B morphing, vertical layouts and external updates. `npm run test:mseg` exercises them in a browser. Copy the example TSX and CSS; the playback example additionally uses the included `playback-runtime.ts` and compiled assets as its demonstration host.

## A complete editor

```tsx
import { useState } from "react";
import { Mseg } from "../../kit/index";

export function Envelope() {
    const [curve, setCurve] = useState(Mseg.defaultCurve);
    return <Mseg.Editor value={curve} onValueChange={setCurve}
        aria-label="Envelope" className="my-envelope" />;
}
```

The default editor is 180px high and drawn in `--editor-accent-start` (cyan by default; see [Styling](#styling)). Ordinary CSS can override its height, background and color. For saved plugin state, use `Mseg.state()` and the complete [state/view example](PLUGIN_STATE.md#start-here), including gesture callbacks. The editor never creates its own history or engine connection.

## Compose the same behavior

```tsx
<Mseg.Root value={curve} onValueChange={setCurve}>
    <Mseg.Surface aria-label="Envelope" style={{height: 240, color: "#83d5ce"}}>
        <Mseg.Grid />
        <Mseg.Line value={reference} stroke="#b398da" strokeDasharray="5 5" />
        <Mseg.Fill />
        <Mseg.Line />
        <Mseg.SegmentHighlight />
        <Mseg.Points />
        <Mseg.Playhead position={position} stroke="white" />
        <Mseg.TimeAxis scale={{kind: "seconds", totalSeconds: 2}} />
    </Mseg.Surface>
    <YourToolbar />
</Mseg.Root>
```

| Part | What you control |
|---|---|
| `Root` | Controlled `value`/`onValueChange`, gesture callbacks, `disabled`, `readOnly`. Optional controlled `selection`/`onSelectionChange`, or local selection initialized by `defaultSelection` (default `null`). |
| `Surface` | Container dimensions, CSS and `orientation`: `horizontal`, `vertical`, or `auto`. Owns measurement, hit testing and editing. |
| `Grid`, `Fill`, `Line` | Optional drawing layers. Fill and Line draw the edited curve, or a separate read-only `value` you supply. (`Mseg.Curve` is the curve's data type.) |
| `Points` | Default handles, or `renderPoint` for your SVG artwork with the shared selection/keyboard behavior. |
| `SegmentHighlight` | Optional selected/hovered segment emphasis. |
| `Plot` | Read-only uniform `samples` covering normalized time 0–1; remove the renderer's one leading and two trailing padding samples. |
| `TimeAxis` | Seconds or note-division labels. Display only; it does not change playback timing. |
| `Playhead` | Normalized position: a number, `null` to hide it, or a stable `LiveValue<number \| null>`. |

The root is an ordinary div. The surface and drawing parts forward normal SVG props, classes, styles, ARIA/data attributes and refs. Layers draw in JSX order; reference curves never become edit targets. Use `currentColor` or normal SVG fill/stroke properties. No application theme, drawer, routing, HUD or A/B bank is required. Surface attributes expose `data-time-axis`, `data-hovered-segment` and `data-active-segment`. Root exposes `data-disabled` and `data-readonly`; point wrappers expose `data-selected`.

Custom handles receive `{point, index, selected, state, position, handleProps}`. Spread `handleProps` onto a focusable SVG group; it supplies the transform, selection, keyboard handlers and accessibility. A point edits two values and no ARIA role models that, so each handle is a slider over its value (`aria-roledescription="envelope point"`), with its time in `aria-valuetext` and `aria-current` marking the selected point. Draw the handle inside that group. `state` is `default`, `selected`, `highlighted` or `muted`; `position` contains pixel coordinates when your artwork needs them. Surface hit testing uses the shared point positions, so keep the handle visually centered there. The [composed example](../examples/mseg/composed.tsx) uses square handles and an ordinary Radix context menu without custom pointer code.

## Toolbars, menus and inspectors

`Mseg.useEditor()` returns only:

```ts
{
    value: Mseg.Curve;
    selection: {kind: "point" | "segment"; index: number} | null;
    select(selection): void;
    edit(change: (current: Mseg.Curve) => Mseg.Curve): void;
    beginGesture(): void;
    endGesture(cancelled?: boolean): void;
}
```

Use pure `Mseg.addPoint`, `movePoint`, `deletePoint` and `setCurvePower` inside `edit`. It receives the latest edited value. One isolated call is one short gesture; begin/end group repeated changes. The same commands power the default editor. Point insertion/deletion preserves a surviving selection or clears it. Remount/key the root when switching documents or A/B curves so an active gesture cannot continue into a different value.

Click empty space to add; drag a point to move; click an interior point to delete. Drag a segment to bend it. `curveEditActivationMode="hold-or-drag"` on Surface lets touch input wait for movement or a hold; `curveEditHoldDelayMs` and `onCurveEditHoldActivated` support your own haptics.

Keyboard editing is the same on every kit control. Arrow keys move one step: Right and Up increase, Left and Down decrease. Shift makes a step ten times finer, Page Up/Down ten times coarser, and Home/End jump to the ends of the range. Holding a key is one gesture, from the first keydown to keyup.

On a focused point, a step is .01 of normalized time (Left/Right) or value (Up/Down, Page Up/Down), and Home/End move it to the earliest or latest time its neighbours allow. Delete/Backspace removes an interior point. Focus Surface and press `[` / `]` to select a segment; Up/Down and Page Up/Down change its curve power in steps of .5. Insert adds a midpoint. Read-only stays focusable and accepts external values; disabled also removes the input from keyboard navigation.

Gesture termination runs once on release, cancellation, capture loss, blur, Escape, disable/read-only changes or unmount. Cancellation stops input and preserves values already accepted by the owner. `onGestureStart` precedes changed values; `onGestureEnd(cancelled)` closes the bracket. Caller pointer handlers run first and can `preventDefault()` to suppress an edit; termination still cleans up.

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

The default parts draw in `currentColor`, which `Mseg.Editor` sets from `--editor-accent-start`. Pass `stroke`, `fill` or `className` to any layer to style it separately.

## Connect the included player

`Mseg.state()` supplies curve validation, preparation and shared-data delivery. Include `kit/cmajor/mseg.cmajor` and the generated `PluginState.cmajor` in the plugin's sources. Instantiate `kit::mseg::Reader(PluginState::envelope::inputIndex)` and connect its `out` to your DSP destination. Its trigger, note-off, duration and playback inputs control the sound; [shared data](SHARED_DATA.md) covers the full state-to-reader setup.

For an observed playhead, expose the Reader's event output:

```cmajor
output event kit::mseg::Position envelopePosition;
connection envelopeReader.positionOut -> envelopePosition;
```

In your GUI, use the same patch connection as the rest of the view:

```tsx
const position = useMemo(
    () => Mseg.positionSource(connection, "envelopePosition"),
    [connection],
);
// Inside Root / Surface:
<Mseg.Playhead position={position} />
```

The adapter subscribes lazily and shares one endpoint subscription among its consumers. Reader reports actual position/activity at approximately 60 Hz and a new generation on each trigger/retrigger. The adapter validates reports, rejects older generations, hides inactive playback and disconnects after the final consumer unmounts. Recreate the source when changing connection/endpoint. The old `progressOut` audio-rate stream remains available for DSP uses.

Playhead applies observations directly on the display frame without rerendering the editor. Loop wraps and retriggers snap to the observed position; they never ease backwards. The component owns frame scheduling and cleanup. It never writes the curve or adds history.

A single Reader is one playback source. For multiple voices, expose each reader's endpoint and create a source for each. Choose which source to display in your instrument, or render several Playheads. A voice-selection policy belongs to the instrument; the editor does not guess newest/loudest/held voice. Custom processors may supply the same two-method `LiveValue` contract (`getSnapshot`, `subscribe`) without using the Reader adapter.

## Optional A/B and ADSR

For A/B, keep two ordinary curve values. Root edits the selected one; Line draws the other. Render both with `Mseg.renderInto`, remove interpolation padding, blend the samples and draw the result with Plot. Different point counts work because the resulting samples are blended. The [complete morph example](../examples/mseg/morph.tsx) contains this composition; playback/morph policy remains the plugin's choice.

This release does not add a general-purpose ADSR editor. An ADSR's attack/decay/sustain/release controls and note-gate behavior are a different contract from arbitrary MSEG points. The pinned Cmajor standard library supplies `std::envelopes::FixedASR` (fixed attack and release, sustained while a note is held); it is not a full configurable ADSR. A general ADSR editor/player remains separate work. Do not treat the MSEG Editor as an ADSR component.
