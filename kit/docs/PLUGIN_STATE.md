# Plugin state

Declare a value once. The kit owns saving, shared Undo, GUI reconnection and delivery to the engine. Your component owns what the value means and how sound uses it.

## Start here

```ts
// PLUGIN AUTHOR: fx/my_plugin/state.ts.
// Imported as definitions; importing does not start a worker.
import { definePluginState, parameter, storedValue, Mseg, nativeValue, Native } from "../../kit/index";
import { panelCodec } from "./panel";

export default definePluginState({
    gain: parameter("gain"),                 // Existing automatable DSP parameter.
    envelope: Mseg.state(),                   // Editable curve + direct shared samples.
    panel: storedValue({                      // Survives closing the GUI; not in presets.
        codec: panelCodec, initial: "envelope", lifetime: "instance", history: false,
    }),
    settings: nativeValue({                   // Typed values for your native C++ component.
        codec: Native.record({
            enabled: Native.boolean(),
            amount: Native.number({ min: 0, max: 2 }),
            mode: Native.choice(["clean", "warm"]),
        }),
        initial: { enabled: true, amount: 1, mode: "clean" },
    }),
}, { historyLimit: 100, memoryBudgetBytes: 64 * 1024 });
```

Set `"stateSource": "fx/my_plugin/state.ts"` in the plugin's `.plugin.json`.
The normal `fx:build` creates the worker and named `PluginState.cmajor` / `PluginState.h` readers. Do not also declare `workerSource`. The memory budget is a shared ceiling, not a preallocation per field. [Shared data details](SHARED_DATA.md).

```tsx
// PLUGIN AUTHOR: fx/my_plugin/view/source.tsx. Runs in the GUI.
import { createStatefulPatchView, usePluginState, usePluginHistory, Mseg } from "../../../kit/index";
import definition from "../state";

function View() {
    const envelope = usePluginState(definition.envelope);
    const history = usePluginHistory();
    if (envelope.state.kind !== "ready") return <p>{envelope.state.kind}</p>;

    return <>
        <Mseg.Editor value={envelope.state.value}
            onGestureStart={() => { void envelope.beginGesture(); }}
            onChange={value => { void envelope.setValue(value); }}
            onGestureEnd={() => { void envelope.endGesture(); }} />
        <button disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
        <button disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
        {envelope.error && <p>{envelope.error.message}</p>}
        {envelope.retry && <button onClick={() => { void envelope.retry?.(); }}>Retry</button>}
    </>;
}
export default createStatefulPatchView({ definition, View });
```

The wrapper reconnects the GUI automatically. Opening the window does not recreate the state or reinstall its audio data. `Mseg.Editor` edits one curve; it does not require a drawer or A/B morphing. `Mseg.Surface` supplies geometry and appearance with underlay/overlay slots for a composed editor.

## Values, errors and Undo

| API | Meaning |
|---|---|
| `control.state` | Connecting, ready, failed or closed. Ready includes the editable `value`. |
| `control.setValue(value)` | Draws immediately, then resolves to accepted, rejected or interrupted. An old render's setter cannot overwrite a newer accepted edit. |
| `control.state.pending` | This GUI is waiting for its edit to be accepted. |
| `control.state.application` | Engine progress. `acknowledged` means the engine confirmed this version; `sent` means only the stated handoff is proven. |
| `control.error` | This field's readiness, saving or application error; otherwise `null`. |
| `control.retry` | Retry the captured failure; otherwise `null`. Does not create another edit or Undo entry, or replay a superseded value. |
| `beginGesture` / `endGesture` | Many drag updates, one Undo entry. A net-zero drag adds none. |
| `usePluginHistory()` | Shared latest-first Undo/Redo. Values are restored through the same engine path as edits. |

A codec has `parse(unknown)`, `encode(value)` and `equals(a,b)`. Parsing returns `{kind:"ok",value}` or `{kind:"error",message}`. Accepted values must be immutable and independent of the input. Invalid saved data stays visibly failed until a valid edit repairs it; it is not silently replaced by a default.

Return `preparationFailure("Could not load this file")` for an expected resource failure. The failed field and its Undo remain usable; unrelated fields continue. Unexpected throws represent programming defects and close the state service. Source files needed by future Undo remain the author's responsibility.

Project state is saved and participates in history by default. `lifetime:"instance"` retains a value through GUI closure and project loads but excludes it from serialized project state; a new plugin instance starts from its default. `history:false` excludes a field from history without destroying unrelated Redo. Ephemeral hover/selection state can remain ordinary React state.

## Concurrent editing

The hook captures the accepted field version behind each setter. Stale edits return a conflict. Queued updates from the same active gesture remain valid; another GUI or agent cannot write that field during the gesture. Other fields remain usable. Host automation retains authority and is not recorded as a user edit. Undo/Redo restore the recorded user values, including when automation subsequently changed them.

Undo/Redo are unavailable during gestures that participate in history; calls return a busy rejection. A full project replacement clears history, rejects old commands and cancels old delivery. A legacy direct write to an owned saved-state key also replaces the project document; use the state API for normal editing. Unknown acceptance after a lost connection is reported, never automatically replayed.

The optional opaque `historyEntry` in an edit result supports a component's guarded Undo button: `history.canUndoEntry(entry)` and `history.undo(entry)` only target the current history head. Unguarded `history.undo()` always uses global latest-first order.

## Framework building blocks

| Module | Where it runs | Responsibility |
|---|---|---|
| Definition + `usePluginState` | Author declaration / GUI | Typed fields, immediate visual edits, read/error/retry API. |
| State session + Jotai | Persistent plugin worker | Accepted values, gesture ownership, stale-edit checks; installs state and history together. |
| `UndoHistory<Entry>` | Any JavaScript environment | Independent immutable bounded Undo/Redo bookkeeping; no Cmajor, React or delivery knowledge. |
| Engine binding | Persistent plugin worker | Preparation, cancellation and current-version delivery status. |
| Shared-data port + native/browser store | Control side and audio reader | Final allocation, publication, block adoption and safe reclamation. |
| Generated readers / component DSP | Audio processing | Named access; component interprets the layout and produces sound. |

An edit updates the session and history together. The engine binding prepares that accepted value. The store exposes it at the next audio block, then reports adoption. Jotai updates the GUI as acceptance and engine status arrive. Closing the GUI disposes only its client.

For an existing specialized protocol, `preparedState({codec,initial,prepare,engine})` also accepts a `PluginStateDelivery<Payload>`. It declares permitted event/output endpoints, saved keys, host effects and shared-data inputs. Its `create(document)` factory is owned by the generated worker. It returns `apply(payload,delivery)` and `stop()`; no author-created worker is needed. The document context supplies bounded `send`, `listen`, `readStored`, `subscribeStored`, direct `prepareData`, and status/failure reporting. These resources survive one successful application and are revoked on project replacement or shutdown. Per-application listeners and cancellation end with that application. `replacement:"finish"` supports a protocol that must finish its current application before sending the newest queued value.

`eventValue` remains useful for ordinary small DSP events. `engineData` retains the older acknowledged packet protocol for a component that already uses it; it is not needed for new shared-memory readers. Custom host effects require a matching registered native handler; the framework cannot invent the handler's product behavior.

The current worker owns state independently of the GUI, but is not a promise of a dedicated CPU thread. Native uses the Cmajor message loop; browser control code runs outside the AudioWorklet. Heavy preparation should account for that existing execution model.
