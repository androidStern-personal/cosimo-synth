# Filter

A filter response editor with optional modulation and spectrum layers.

Open the interactive docs with `npm run ui:docs:dev`, then choose **Filter**. Preview and Code tabs share the same example source.

## Usage

```tsx
import { useState } from "react";
import { FilterEditor, type FilterValue } from "../../kit/index";

export function Filter() {
    const [value, setValue] = useState<FilterValue>({
        mode: "lowpass", cutoffHz: 1200, q: 3,
    });
    return <FilterEditor value={value} onValueChange={setValue} />;
}
```

Drag horizontally to change cutoff and vertically to change resonance. Focus the value handle for keyboard editing.

## Examples

| Need | Example |
|---|---|
| A cutoff interval | [Cutoff range](../examples/filters/band.tsx) |
| Modulate cutoff and resonance | [Two-axis modulation](../examples/filters/modulation.tsx) |
| Overlay an analyzer and live response | [Spectrum](../examples/filters/analyzer.tsx) |
| Custom styling or read-only editing | [Styling and state](../examples/filters/states.tsx) |

## Styling and integration

Set `className`, `style` or the shared `--editor-*` theme properties. Use `onGestureStart` and `onGestureEnd` to connect gestures to your state/history. The plugin owns routing and supplies live response and spectrum data.

See the [API reference](FILTERS_API.md) for supported modes, modulation handles, scales and spectrum inputs. For saving and shared Undo, use [plugin state](PLUGIN_STATE.md).
