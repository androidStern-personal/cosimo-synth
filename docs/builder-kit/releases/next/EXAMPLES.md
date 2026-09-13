# Verified author examples

These are complete state/UI files for two existing Builder Kit plugins. Their public APIs passed strict TypeScript checking against the exact customer export. Supply the existing plugin config and DSP described below; these files alone are not standalone audio plugins.

## An existing parameter with Undo and Redo

The existing DSP exposes a parameter named `gain`. Add `"stateSource": "fx/gain_demo/state.ts"` to its `.plugin.json` and point its UI source at the view below.

### fx/gain_demo/state.ts

PLUGIN AUTHOR: declaration loaded by the framework when the plugin starts. Importing this file does not itself start a worker.

```ts
import { definePluginState, parameter } from "../../kit/index";

export default definePluginState({ gain: parameter("gain") });
```

### fx/gain_demo/view/source.tsx

PLUGIN AUTHOR: React GUI code. Hooks connect to the framework-owned state; event handlers run when the user clicks or drags.

```tsx
import { createStatefulPatchView, usePluginState, usePluginHistory } from "../../../kit/index";
import definition from "../state";

function View() {
    const gain = usePluginState(definition.gain);
    const history = usePluginHistory();
    if (!("value" in gain.state)) return <p>{gain.error?.message ?? gain.state.status}</p>;
    return <>
        <p>Gain: {gain.state.value}</p>
        <button onClick={() => { void gain.setValue(0.5); }}>Set gain to 0.5</button>
        <button disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
        <button disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
        {gain.error && <p>{gain.error.message}</p>}
    </>;
}
export default createStatefulPatchView({ definition, View });
```

## An editable envelope with shared Undo

Add `"stateSource": "fx/mseg_demo/state.ts"` to the existing `.plugin.json`; do not also supply `workerSource`. Include `kit/cmajor/mseg.cmajor` in the patch. The build generates `PluginState.cmajor`; DSP can call `kit::mseg::sample(PluginState::envelope::inputIndex, position)` or use `kit::mseg::Reader(PluginState::envelope::inputIndex)`. The plugin decides how that envelope changes its sound.

### fx/mseg_demo/state.ts

PLUGIN AUTHOR: declaration loaded by the framework when the plugin starts. Importing this file does not itself start a worker.

```ts
import { definePluginState, Mseg } from "../../kit/index";

export default definePluginState({ envelope: Mseg.state() }, { memoryBudgetBytes: 64 * 1024 });
```

### fx/mseg_demo/view/source.tsx

PLUGIN AUTHOR: React GUI code. Hooks connect to the framework-owned state; event handlers run when the user clicks or drags.

```tsx
import { createStatefulPatchView, usePluginState, usePluginHistory, Mseg } from "../../../kit/index";
import definition from "../state";

function View() {
    const envelope = usePluginState(definition.envelope);
    const history = usePluginHistory();
    if (!("value" in envelope.state)) return <p>{envelope.error?.message ?? envelope.state.status}</p>;
    return <>
        <Mseg.Editor value={envelope.state.value}
            onGestureStart={() => { void envelope.beginGesture(); }}
            onChange={value => { void envelope.setValue(value); }}
            onGestureEnd={() => { void envelope.endGesture(); }} />
        <button disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo curve edit</button>
        {envelope.error && <p>{envelope.error.message}</p>}
        {envelope.retry && <button onClick={() => { void envelope.retry?.(); }}>Retry</button>}
    </>;
}
export default createStatefulPatchView({ definition, View });
```

The framework owns the persistent state lifetime, gesture history, saving and reconnection. The MSEG declaration also generated its actual float32 resource and Cmajor/C++ accessors in this audit. These checks establish API and generation validity; they do not claim a separate native/audio build of these example plugins.
