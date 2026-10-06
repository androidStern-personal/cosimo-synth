# Plugin state

Declare a value once. The kit owns saving, shared Undo, GUI reconnection and delivery to the engine. Your component owns what the value means and how sound uses it.

Use `parameter("gain")` when the value is an existing audio-engine parameter that the DAW can automate. Use `storedValue(...)` when you need to remember your own value or object, without automatically sending it to the audio engine. Use `preparedState(...)` with `sharedData(...)` when changing that value must generate or load data for the audio engine to read—for example, turning envelope points into sampled curve data; `Mseg.state()` already supplies that preparation for an MSEG.

The choice depends on how the value reaches the engine, not its JavaScript type or size. See [shared audio data](SHARED_DATA.md) for fixed tables, loaded assets and typed native settings, or the [React API reference](PLUGIN_STATE_API.md) for the complete `usePluginState` return object and its status values.

## Start here

```ts
// PLUGIN AUTHOR: fx/my_plugin/state.ts.
// Imported as definitions; importing does not start a worker.
import { definePluginState, parameter, storedValue, presets, snapshots, Mseg, nativeValue, Native } from "../../kit/index";
import { panelCodec } from "./panel";

export default definePluginState({
    gain: parameter("gain"),                 // Existing automatable DSP parameter.
    envelope: Mseg.state(),                   // Editable curve + direct shared samples.
    panel: storedValue({                      // Survives closing the GUI; not in presets.
        codec: panelCodec, initial: "envelope", lifetime: "instance", history: false, preset: false,
    }),
    settings: nativeValue({                   // Typed values for your native C++ component.
        codec: Native.record({
            enabled: Native.boolean(),
            amount: Native.number({ min: 0, max: 2 }),
            mode: Native.choice(["clean", "warm"]),
        }),
        initial: { enabled: true, amount: 1, mode: "clean" },
    }),
    ...presets({ factory: [] }),              // Preset library and the project's active preset.
    ...snapshots(),                           // A-G snapshot slots.
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
    if (!("value" in envelope.state)) return <p>{envelope.error?.message ?? envelope.state.status}</p>;

    return <>
        <Mseg.Editor value={envelope.state.value}
            onGestureStart={() => { void envelope.beginGesture(); }}
            onValueChange={value => { void envelope.setValue(value); }}
            onGestureEnd={() => { void envelope.endGesture(); }} />
        <button disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
        <button disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
        {envelope.state.status === "updating" && <p role="status">Updating…</p>}
        {envelope.error && <p role="alert">{envelope.error.message}</p>}
        {envelope.retry && <button onClick={() => { void envelope.retry?.(); }}>Retry</button>}
    </>;
}
export default createStatefulPatchView({ definition, View });
```

The wrapper reconnects the GUI automatically. Opening the window does not recreate the state or reinstall its audio data. `Mseg.Editor` edits one curve; it does not require a drawer or A/B morphing. Compose `Mseg.Root`, `Mseg.Surface` and the drawing layers for custom handles, reference curves, A/B editing or an engine playhead. See the [MSEG guide and complete examples](MSEG.md).

## Values, errors and Undo

| API | Meaning |
|---|---|
| `control.state.status` | `loading`, `invalid`, `unavailable`, `updating`, or `idle`. Both `updating` and `idle` include the editable `value`. |
| `control.setValue(value)` | Draws immediately, then resolves to accepted, rejected or interrupted. An old render's setter cannot overwrite a newer accepted edit. |
| `control.error` | One current `{ message }` or `null`. An error can coexist with `updating`; keep editing enabled when a value exists. |
| `control.retry` | Retry the captured failure; otherwise `null`. Does not create another edit or Undo entry, or replay a superseded value. |
| `beginGesture` / `endGesture` | Many drag updates, one Undo entry. A net-zero drag adds none. |
| `usePluginHistory()` | Shared latest-first Undo/Redo. Values are restored through the same engine path as edits. |

A codec has `parse(unknown)`, `encode(value)` and `equals(a,b)`. Parsing returns `{kind:"ok",value}` or `{kind:"error",message}`. Accepted values must be immutable and independent of the input. Invalid saved data reports `invalid` until a valid replacement is requested and accepted; it is not silently replaced by a default. A codec that throws while handling an edit rejects that edit as `invalid-value` and reports the error to the console; other edits and other views carry on.

Return `preparationFailure("Could not load this file")` for an expected resource failure. The failed field and its Undo remain usable; unrelated fields continue. A throw from your preparation function or synchronous writer becomes a non-retryable error on that field; its previous audio remains active. A later deliberate edit can recover. Unexpected framework or delivery-callback defects still close the service because continuing may be unsafe. A transport can report a recoverable handoff failure through its explicit protocol. Source files needed by future Undo remain the author's responsibility.

Project state is saved and participates in history by default. `lifetime:"instance"` retains a value through GUI closure and project loads but excludes it from serialized project state; a new plugin instance starts from its default. `lifetime:"user"` shares a value between every instance and project of the plugin, through the user's files; it never takes part in Undo. `history:false` excludes a field from history without destroying unrelated Redo. Ephemeral hover/selection state can remain ordinary React state.

## Change related fields together

```tsx
// PLUGIN AUTHOR: GUI. One accepted change and one Undo entry.
const editor = usePluginState(definition);
const result = await editor.edit({ gain: 0.5, envelope: nextCurve });
if (result.kind === "rejected") {
    // The pair was not applied. Handle the reported conflict or invalid value.
}
```

Only included fields participate. Each value is validated and encoded by its codec. Pass `{ history: false }` as the second argument to apply the change without an Undo entry, for example when editing a library of saved items. The hook captures their versions when rendered: if either field changed meanwhile, the whole edit is rejected. Field controls report `updating` while the compound command is outstanding, even though it has no optimistic preview; they return to `idle` after tracked saving and engine work also finish. There is no second history manager.

A drag that moves several fields at once, such as a graph handle setting frequency and gain, opens one gesture over them:

```tsx
await editor.beginGesture(["frequency", "gain"]);   // pointer down
void editor.edit({ frequency: f, gain: g });         // each pointer move
void editor.endGesture();                             // pointer up: one Undo entry
```

Until `endGesture`, `editor.edit(...)` and each field control's `setValue` on those fields write into the gesture. Ending it records one Undo entry listing every field that moved; a drag that returns to its start records none. The host sees one gesture-start and gesture-end per parameter. Another view cannot edit those fields during the gesture, and unmounting the component ends it.

## Presets and snapshots

A preset is a named sound; a snapshot is one of a few quick slots (A to G by default) for comparing sounds. Both are ordinary plugin state, so recalling one goes through the same edit path, saving and Undo as a knob.

```ts
// PLUGIN AUTHOR: state.ts.
export default definePluginState({
    gain: parameter("gain"),
    tone: parameter("tone"),
    meterHold: parameter("meterHold", { preset: false }),   // Not part of the sound.
    ...presets({ factory: [
        { id: "init", name: "Init", values: { gain: 0, tone: 0 } },
        { id: "warm", name: "Warm", values: { gain: -3, tone: 0.2 } },
    ], initial: "init" }),                                   // A new project starts on Init.
    ...snapshots(),
});
```

```tsx
// PLUGIN AUTHOR: GUI.
<PresetBar definition={definition} />
<SnapshotBar definition={definition} />
```

`presets()` adds two fields: `presetLibrary`, the user's saved presets, and `activePreset`, the project's current preset. `snapshots({ slots })` adds `snapshotSlots` and `activeSnapshot`. The **sound fields** are every other field, unless declared with `preset: false` on `parameter()` or `storedValue()`. `definePluginState` checks each factory preset: it must set every sound field and nothing else, with valid values, and its `id` must be unique. The error names the preset and the field.

`initial` names the factory preset a new project starts on: it is the active preset until the user recalls another, and it reads as unmodified while the sound matches its values, so give it the same values as the fields' defaults. Without `initial`, no preset is active until the first recall. An `initial` that is not a factory preset id is an error.

| Action | Undo |
|---|---|
| Recall or revert a preset | One entry: the sound and the active preset are restored together. |
| Select a snapshot slot | One entry: the sound and the selected slot are restored. Slot contents are not. |
| Load a preset file as the sound | One entry: the sound and the active preset are restored. |
| Save, save as new, rename, duplicate, delete a preset; add a preset file to the library; clear a slot | None. Library operations are not Undo entries. |

Recall sets the fields a preset contains; a field the preset lacks keeps its value, and a key that is no longer a sound field is ignored. A preset is **modified** when the current sound differs from the active preset's values. Selecting a snapshot slot first stores the current sound in the slot being left, so tweaks made while it was selected are kept; selecting an empty slot stores the current sound in it.

`presetLibrary` has `lifetime: "user"`: every instance of the plugin, in every project, shares it through the Cmajor user-files API, in a folder named after a hash of the manifest `ID`. Without that API (the browser preview, tests) the library lives in memory until the page closes. `activePreset` and the snapshot fields are saved with the project.

**Copy JSON** writes the current sound as a preset file. **Paste JSON** reads one: **Load** (or Enter) makes it the sound, as one Undo entry, and leaves no preset active, because that sound is not in the library; **Add to library** saves it as a user preset without loading it:

```json
{ "kind": "builder-kit.preset", "version": 1, "plugin": "<manifest ID>", "name": "Warm", "values": { "gain": -3, "tone": 0.2 } }
```

A file from another plugin ID, or one that sets a field that is not a sound field, is refused with a message saying so. For a custom interface, `usePresets(definition)` and `useSnapshots(definition)` return the same lists, state and actions the bars use; see the [API reference](PLUGIN_STATE_API.md#presets-and-snapshots).

## Why a value is being prepared

The context passed to `prepare` carries `reason`, so the audio engine can treat a replaced sound differently from a live edit:

| `reason` | When |
|---|---|
| `load` | The plugin opened, or the host loaded a project. |
| `recall` | A preset was recalled or reverted, a preset file was loaded as the sound, or a snapshot slot was selected. |
| `history` | Undo or Redo restored the value. |
| `edit` | Any other change, including host automation of a declared dependency. |

```ts
// PLUGIN AUTHOR: state.ts. Clear captured audio when a stored sound replaces this one, not while a control moves.
prepare(pattern, { reason }) {
    return { ...toUpload(pattern), restart: reason === "load" || reason === "recall" };
}
```

`PresetBar`, `SnapshotBar`, `usePresets` and `useSnapshots` mark their recalls, including a preset file loaded as the sound. A custom preset interface marks its own with `editor.edit(changes, { recall: true })`; a recall cannot be part of a gesture.

## Custom delivery

`eventValue` suits ordinary small DSP events. When a component has its own transfer protocol, give `preparedState` a `PluginStateDelivery` as its `engine` and the field reaches the engine your way, with the same editing, saving and Undo as every other field. A step sequencer whose DSP holds only the selected pattern, and ignores an upload older than one it has accepted, numbers each upload:

```ts
// PLUGIN AUTHOR: pattern-upload.ts.
import type { PluginStateDelivery } from "../../kit/index";

export type PatternUpload = { readonly content: PatternContent; readonly replacesSound: boolean };

// Rises for as long as the plugin instance runs, across every project it loads.
let revision = 0;

export const patternUploadDelivery: PluginStateDelivery<PatternUpload> = {
    eventEndpoints: ["patternUpload"],
    create() {
        return {
            async apply(upload, context) {
                revision += 1;
                const submitted = context.send({
                    kind: "event",
                    endpoint: "patternUpload",
                    value: { ...upload.content, revision, authoritative: upload.replacesSound },
                });
                return submitted.kind === "submitted" ? await submitted.completion : submitted;
            },
            stop() {},
        };
    },
};
```

```ts
// PLUGIN AUTHOR: state.ts. Re-sent when the patterns change or the host selects another one.
patterns: preparedState({
    codec: patternsCodec,
    initial: defaultPatterns,
    dependencies: ["selectedPattern"],
    prepare: (patterns, { parameters, reason }) => ({
        content: patternContent(patterns, Math.round(parameters["selectedPattern"] ?? 0)),
        replacesSound: reason === "load" || reason === "recall",
    }),
    engine: patternUploadDelivery,
}),
```

The delivery declares the event and output endpoints, saved keys, host effects and shared-data inputs it may use. The generated worker calls `create(document)` once per project document; it returns `apply(payload, context)` and `stop()`, and no author-created worker is needed. The document context supplies bounded `send`, `listen`, `readStored`, `subscribeStored`, direct `prepareData`, and status and failure reporting. These resources survive one successful application and are revoked on project replacement or shutdown; per-application listeners and cancellation end with that application. `replacement: "finish"` suits a protocol that must finish its current application before sending the newest queued value. A custom host effect needs a matching registered native handler; the framework cannot invent the handler's product behavior.

Write a delivery from the public types `PluginStateDelivery`, `PluginStateDeliveryContext`, `PluginStateDocumentContext`, `PluginStateEffect`, `PluginStateSubmission` and `PluginStateDeliveryOutcome`, all exported from `kit/index`; see the [API reference](PLUGIN_STATE_API.md#custom-delivery).

## Concurrent editing

The hook captures the accepted field version behind each setter. Stale edits return a conflict. Queued updates from the same active gesture remain valid; another GUI or agent cannot write that field during the gesture. Other fields remain usable. Host automation retains authority and is not recorded as a user edit. Undo/Redo restore the recorded user values, including when automation subsequently changed them.

Undo/Redo are unavailable during gestures that participate in history; calls return a busy rejection. A full project replacement clears history, rejects old commands and cancels old delivery. Writing directly to a saved-state key that the framework owns also replaces the project document; use the state API for normal editing. Unknown acceptance after a lost connection is reported, never automatically replayed.

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

Every state update the worker sends to the GUI carries every field, not only the ones that changed, because a GUI must be able to attach at any revision (opening the window, a second view, a reconnect) and render from that one message. Each view re-renders only for the fields it reads, but a large stored value is still sent whole on every update, so split it into smaller fields or move its bulk into prepared state so each update and each re-render covers only what changed.

The current worker owns state independently of the GUI, but is not a promise of a dedicated CPU thread. Native uses the Cmajor message loop; browser control code runs outside the AudioWorklet. Heavy preparation should account for that existing execution model.
