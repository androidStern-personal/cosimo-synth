# MSEG

An editable envelope made of points and curved segments.

Open the interactive docs with `npm run ui:docs:dev`, then choose **MSEG**. Preview and Code tabs share the same example source.

## Usage

```tsx
import { useState } from "react";
import { Mseg } from "../../kit/index";

export function Envelope() {
    const [curve, setCurve] = useState(Mseg.defaultCurve);
    return <Mseg.Editor value={curve} onValueChange={setCurve}
        aria-label="Envelope" />;
}
```

Click empty space to add a point. Drag a handle to move it or a segment to bend it. Focus a handle and use arrow keys to edit it.

## Examples

| Need | Example |
|---|---|
| Custom layers, handles and a menu | [Composition](../examples/mseg/composed.tsx) |
| Animate the playback position | [Playback](../examples/mseg/playback.tsx) |
| Blend two different envelopes | [A/B morphing](../examples/mseg/morph.tsx) |
| Vertical time or read-only editing | [Orientation and state](../examples/mseg/states.tsx) |

The playback example includes a Cmajor Reader host and frozen compiled assets in `kit/examples/mseg`. A plugin supplies its own patch connection. The editor itself does not produce sound.

## Styling and composition

Use ordinary CSS and SVG props for size, colors and stroke widths. Compose `Mseg.Root` and `Mseg.Surface` with optional `Grid`, `Fill`, `Curve`, `Points`, `Playhead` and `TimeAxis` layers. JSX order controls drawing order.

See the [API reference](MSEG_API.md) for custom handles, live position and the included preparer/Reader. For saving, audio data and shared Undo, use [plugin state](PLUGIN_STATE.md).
