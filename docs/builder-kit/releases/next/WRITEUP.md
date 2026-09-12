# State management for audio plugins, built into Builder Kit

Draft for the next release. Compared with the live Builder Kit 0.1.5 release; implementation reviewed at `363907f5`. Suggested version: **0.2.0**, because this introduces a substantial new author-facing framework. No release version or tag has been changed.

Builder Kit now gives Cmajor plugin authors one API for parameters, editable complex state, saving, Undo/Redo, and getting prepared data into the audio engine.

Turn a control, edit an envelope, or select a different wavetable: those edits can share one Undo history. Close and reopen the plugin window: the framework reconnects it to the existing state. If preparing an asset fails, that field can report the failure without disabling unrelated controls.

For large audio data, the author supplies the preparation function. The framework supplies its writable destination, publishes complete data at an audio-block boundary, and releases replaced storage safely. Plugin authors do not write a packet uploader or manage that shared-memory handoff themselves.

## What is new since 0.1.5

| Capability | What the author gets |
|---|---|
| State declarations | `parameter` for an existing DSP parameter; `storedValue` for editable saved/instance state; `preparedState` when editable data needs conversion before DSP uses it. |
| A persistent owner | Normal `stateSource` build setup creates the state owner. `createStatefulPatchView` reconnects an open GUI automatically. |
| Shared history | `usePluginHistory()` undoes the most recent user action across participating fields. Drag grouping, compound edits, bounded history, and guarded component-specific Undo use the same system. |
| Concurrent editing | A setter retains the version its GUI saw. Stale edits are rejected; one active gesture owns its field. Genuine host automation remains supported without turning delayed own echoes into new edits. |
| Clear failure states | Controls expose readiness, pending acceptance, engine progress, an error or `null`, and a retry function or `null`. A retry preserves history and cannot reinstall an obsolete edit. |
| Shared audio data | Fixed or discovered sizes, one author-supplied memory ceiling, direct writable storage, cancellation, block-boundary publication, and safe cleanup. Native JIT, compiled native, and browser WebAssembly use the same declaration. |
| Bundled MSEG | Curve schema/math, rendering, an editable graph, composable drawing surfaces, shared curve data, and a Cmajor reader/player. A/B morphing and a drawer are optional composition choices. |
| Native settings | `nativeValue` and `Native` codecs produce matching C++ accessors for a native component. The component still decides what the settings do. |
| Extensibility | Reusable history and explicit custom-delivery seams remain available underneath the convenient declarations. |

The release also contains the parameter-drag ordering fixes, field/history subscription improvements, compound-pending fix, safer native retry/restore behavior, lifecycle cleanup fixes, and compatible customer React/React DOM pins. The complete customer-facing record is [kit/CHANGELOG.md](../../../../kit/CHANGELOG.md).

## Example 1: give an existing parameter shared Undo

These are real author APIs. The plugin already has a Cmajor parameter endpoint called `gain`.

```ts
// PLUGIN AUTHOR — fx/my_plugin/state.ts.
// This declares state; the framework starts its persistent owner at plugin load.
import { definePluginState, parameter } from "../../kit/index";

export default definePluginState({ gain: parameter("gain") });
```

```tsx
// PLUGIN AUTHOR — inside the plugin's React GUI.
const gain = usePluginState(definition.gain);
const history = usePluginHistory();

// A button changes the value; Undo restores it through the same engine path.
<button onClick={() => { void gain.setValue(0.5); }}>Half gain</button>
<button disabled={!history.canUndo}
    onClick={() => { void history.undo(); }}>Undo</button>
```

The full view imports the hooks, handles readiness, and uses `createStatefulPatchView({ definition, View })`. Set `stateSource` in the plugin's `.plugin.json`. These short excerpts are not a complete audio-plugin scaffold.

## Example 2: an editable envelope with saving and Undo

```ts
// PLUGIN AUTHOR — state.ts. The budget is a ceiling, not a reservation per field.
import { definePluginState, Mseg } from "../../kit/index";

export default definePluginState({
    envelope: Mseg.state(),
}, { memoryBudgetBytes: 64 * 1024 });
```

```tsx
// PLUGIN AUTHOR — React GUI, after checking envelope.state.kind === "ready".
const envelope = usePluginState(definition.envelope);

<Mseg.Editor
    value={envelope.state.value}
    onGestureStart={() => { void envelope.beginGesture(); }}
    onChange={value => { void envelope.setValue(value); }}
    onGestureEnd={() => { void envelope.endGesture(); }}
/>
```

The kit groups the drag into one Undo entry, saves the editable curve, renders shared samples, and reconnects the GUI after it closes. To make the envelope affect sound, the author connects the included Cmajor reader to the intended DSP destination. State declarations cannot infer a plugin's sound design.

The [full state/view files for these two examples](EXAMPLES.md) were strictly typechecked against the actual exported kit, not a separately invented interface. They demonstrate author integration into an existing plugin; they do not independently prove a newly built native demo. [Complete public guide](../../../../kit/docs/PLUGIN_STATE.md) · [DSP/shared-data connection](../../../../kit/docs/SHARED_DATA.md).

## What to show in the announcement

Use a short actual-plugin recording: change a parameter, edit an envelope, then Undo twice so viewers see both changes reverse. A second shot closes/reopens the UI with the edited curve intact. Pair it with the two small API excerpts above. Capture the release candidate, rather than using a mockup as functional evidence.

Lead with **“State management for audio plugins, built into Builder Kit.”** Support it with saving, shared Undo, persistent state and shared audio data. Keep the Cmajor/React context visible; do not imply a drop-in state layer for every audio framework.

## Explicit limits

- Existing customer plugins need deliberate adoption of the new API; updating kit source does not rewrite their plugin.
- Custom data still needs a layout and DSP interpretation. The kit supplies those for its bundled MSEG.
- A memory ceiling must fit active data and its replacement. Browser memory can retain its high-water allocation.
- Saved presets and closing the GUI are supported lifecycle cases. Undo history itself is not serialized as part of the DAW project.
- External files needed for future Undo must remain available. A declared state field is not an asset archive.
- An asynchronous preparation callback is not a promise of a dedicated computation thread.
- Do not announce the unfinished composable knob/context-menu extraction, a generic arbitrary C++ shared-memory reader, Windows/Intel qualification, or fully automatic plugin migration.
- The measured drag improvement was roughly one-third less state-message traffic in the same browser interaction. That is not a new audio-DSP CPU benchmark or a universal speedup claim.
