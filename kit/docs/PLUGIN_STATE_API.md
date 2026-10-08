# Plugin state React API

Use the [plugin state guide](PLUGIN_STATE.md) to choose and connect a declaration. This reference describes the current return values; it does not introduce a different API. Import public functions and types from `kit/index`, using the relative path from your plugin.

## Exported names

Every state, preset and snapshot name `kit/index.ts` exports. Anything not listed here is internal.

| Name | Kind | What it is |
|---|---|---|
| `definePluginState(fields, options?)` | function | Declares the plugin's fields; every hook, view and the build read the returned definition. |
| `parameter(endpoint, options?)` | function | A field backed by an automatable Cmajor parameter endpoint; the host stores its value. |
| `storedValue(options)` | function | A field saved through its codec with the project, the instance or the user's files; not host-automatable. |
| `preparedState(options)` | function | A stored field whose `prepare` turns each accepted value into data the DSP reads, usually in shared memory. |
| `eventValue(endpoint, prepare, options?)` | function | An `engine` for `storedValue` that sends each accepted value to a DSP event endpoint. |
| `preparationFailure(message)` | function | Returned from `prepare` for an expected, retryable failure such as a missing file. |
| `sharedData({ type, length? })` | function | The shared-memory input a `preparedState` field writes into: `"float32"` or `"bytes"`, fixed or sized per value. |
| `nativeValue({ codec, initial })` | function | Small typed settings that the build also exposes to native C++ as a generated struct. |
| `Native` | namespace | The `nativeValue` codecs: `number`, `boolean`, `choice` and `record`. |
| `Mseg` | namespace | The MSEG curve, its editor and `Mseg.state()` declaration; see [MSEG API](MSEG_API.md). |
| `createStatefulPatchView({ definition, View, css? })` | function | Turns your React view into the Cmajor view entry, with state, presets and history connected. |
| `usePluginState(field)` | hook | Returns one field's `PluginStateControl`. |
| `usePluginState(definition)` | hook | Returns the `PluginStateEditor` that edits several fields as one Undo entry. |
| `usePluginHistory()` | hook | Returns the plugin's shared Undo and Redo as `PluginStateHistory`. |
| `UndoHistory` | class | The immutable, bounded Undo/Redo bookkeeping the state service uses; usable on its own. |
| `PluginStateFields` | type | Any state definition, as `definePluginState` returns it; the type of `definition` in `PresetBar`, `usePresets` and your own helpers that wrap them. |
| `PluginStateCodec<Value>` | type | `parse`, `encode` and `equals` for a stored value. |
| `PluginStateJson` | type | A JSON value; what `encode` returns and `parse` reads. |
| `PluginStateValueResult<Value>` | type | What `parse` returns: `{ kind: "ok", value }` or `{ kind: "error", message }`. |
| `PluginStateLifetime` | type | Where a stored value lives: `"project"`, `"instance"` or `"user"`. |
| `PluginStateOptions` | type | The `definePluginState` options: `historyLimit` and `memoryBudgetBytes`. |
| `PluginStatePrepareContext` | type | The second argument of `prepare`: `resources`, captured `parameters`, the change `reason` (`load`, `recall`, `history` or `edit`) and a cancellation `signal`. |
| `PluginStateSharedPlan` | type | What `prepare` returns for variable-length shared data: a `length` and a synchronous `write`. |
| `PluginStatePreparationFailure` | type | The value `preparationFailure` returns. |
| `PluginStateDelivery<Payload>` | type | A custom `engine` for `preparedState`: its declared endpoints and keys, and `create(document)`; see [Custom delivery](#custom-delivery). |
| `PluginStateDocumentContext` | type | What `create` receives: sending, listening, saved-state reads and shared-data writes that last until the project closes. |
| `PluginStateDeliveryContext` | type | What each `apply` receives: `send`, `listen` and a cancellation `signal` that last for that one application. |
| `PluginStateEffect` | type | One message a delivery sends: a declared event, or a declared host effect. |
| `PluginStateSubmission` | type | What `send` returns: submitted with a `completion`, failed, or cancelled. |
| `PluginStateDeliveryOutcome` | type | What `apply` resolves to: sent, acknowledged by the engine, unconfirmed, failed or cancelled. |
| `PluginStateControl<Value>` | type | One field's state, error, retry and edit actions; described below. |
| `PluginStateControlState<Value>` | type | `control.state`, discriminated by `status`. |
| `PluginStateControlError` | type | `control.error`: one displayable `message`. |
| `PluginStateEditor<Fields>` | type | The whole-definition editor: `edit(changes, options?)`, and `beginGesture(keys)` / `endGesture()` for a drag across several fields. |
| `PluginStateChanges<Fields>` | type | The changes object `edit` accepts, keyed by declared field. |
| `PluginStateEditResult` | type | What every edit and history action resolves to. |
| `PluginStateRejectionReason` | type | Why an edit was rejected; see the table below. |
| `PluginStateHistory` | type | `usePluginHistory()`'s result. |
| `PluginStateHistoryEntry` | type | An opaque token for guarded Undo and Redo. |
| `presets({ factory?, initial? })` | function | Adds `presetLibrary` and `activePreset` to a definition; `initial` names the factory preset a new project starts on. |
| `usePresets(definition)` | hook | Returns `Presets`: the preset lists, state and actions `PresetBar` is built on. |
| `snapshots({ slots? })` | function | Adds `snapshotSlots` and `activeSnapshot` to a definition. |
| `useSnapshots(definition)` | hook | Returns `Snapshots`: everything `SnapshotBar` shows and does. |
| `PresetBar` | component | The ready-made preset selector and menu. |
| `SnapshotBar` | component | The ready-made row of snapshot slots. |
| `Presets` | type | `usePresets()`'s result. |
| `Snapshots` | type | `useSnapshots()`'s result. |
| `Preset` | type | One saved user preset: `id`, `name` and `values`. |
| `PresetLibrary` | type | The user's saved presets, shared by every project. |
| `FactoryPreset` | type | A preset shipped with the plugin, with values in the form `editor.edit` accepts. |
| `PresetSummary` | type | The `id` and `name` a preset list shows. |
| `PresetFile` | type | The JSON written by Copy JSON and read by Paste JSON. |
| `PresetActionResult` | type | What every preset and snapshot action resolves to. |
| `SoundValues` | type | Values keyed by sound field, in each field's saved form. |
| `SnapshotSlots` | type | Each snapshot slot's captured sound, or `null`. |
| `PresetBarProps` | type | `PresetBar`'s props: `definition` and an optional `className`. |
| `SnapshotBarProps` | type | `SnapshotBar`'s props: `definition` and an optional `className`. |

## One declared field

```tsx
const envelope = usePluginState(definition.envelope);
```

This returns `PluginStateControl<Value>`. For `Mseg.state()`, `Value` is `Mseg.Curve`; for `parameter(...)`, it is `number`. The object has exactly these six public properties:

```ts
interface PluginStateControl<Value> {
    readonly state: PluginStateControlState<Value>;
    readonly error: PluginStateControlError | null;
    readonly retry: (() => Promise<PluginStateEditResult>) | null;
    beginGesture(): Promise<PluginStateEditResult>;
    setValue(value: Value): Promise<PluginStateEditResult>;
    endGesture(): Promise<PluginStateEditResult> | undefined;
}
```

`setValue` takes a value, not a React-style updater function. `beginGesture` and `endGesture` group drag updates into one Undo entry; ending without an active gesture returns `undefined`. `retry` is either an operation for the currently retryable field failure or `null`; it does not create an edit or an Undo entry. The hook requires the provider installed by `createStatefulPatchView` and a field belonging to that provider's definition; incorrect wiring throws rather than returning a failed field.

## The state object

`state.status` is the one public lifecycle discriminant:

```ts
type PluginStateControlState<Value> =
    | { readonly status: "loading" | "invalid" | "unavailable" }
    | {
        readonly status: "idle" | "updating";
        readonly value: Value;
        readonly metadata?: {
            readonly min: number;
            readonly max: number;
            readonly step: number;
            readonly defaultValue: number;
        };
    };
```

| `state.status` | What the UI should do |
|---|---|
| `loading` | Show a placeholder while obtaining a usable value, including while a replacement for invalid saved data awaits acceptance. |
| `invalid` | Offer to supply a valid replacement/default with `setValue`. There is no usable value to edit. |
| `unavailable` | Show the explanation in `error.message`. A missing parameter or closed connection cannot be repaired by changing its value. |
| `updating` | Keep the value editable; optionally show progress while an edit, save or engine preparation/delivery remains outstanding. |
| `idle` | Keep the value editable without a progress indicator. Display any unresolved error. |

Both `idle` and `updating` include `value`; the other statuses do not. Narrow with `"value" in control.state` before reading it. Do not disable a control simply because it is updating: successive drag updates are supported. `metadata` is supplied for host parameters and contains the four numbers shown above. MSEG fields have no parameter metadata.

`idle` means no tracked work remains. It is not an audio-adoption or successful-save certificate. A missing preparation dependency produces an error instead of an indefinite progress indicator. Engine phases, native receipt identities and transport proof strings remain framework details.

The status describes the displayed value. An optimistic draft does not inherit the previous value's failure. If that draft is rejected, the accepted value and its relevant error are restored. A held receipt does not hide a failure belonging to the new value once it has been accepted.

For an MSEG, the actual `state.value` data shape is:

```ts
type Curve = {
    format: "mseg.shape";
    version: 1;
    name: string;
    globalSmooth: boolean;
    points: Array<{ x: number; y: number; curvePower: number }>;
};
```

Treat received values as immutable even though this curve type uses mutable TypeScript property declarations. `x` and `y` are normalized curve coordinates; `curvePower` controls the outgoing segment. `globalSmooth` is retained metadata, not an implemented smoothing effect. Lifecycle status, duration and playback policy are not fields in this curve object.

## Field error and recovery

```ts
type PluginStateControlError = {
    readonly message: string;
};
```

`control.error` is `null` or one current diagnostic. An error can coexist with `updating`: for example, saving can fail while preparation continues. Keep displaying the editable value in that case.

`control.retry` is the matching framework-owned action or `null`. Show a Retry button when it exists; do not classify message strings to decide whether recovery is allowed. If saving and preparation both fail, the save error takes priority. Retrying it preserves the value and history, then any remaining preparation error becomes visible with its own retry action. Unexpected author preparation defects do not offer retry; a deliberate new edit can recover.

`invalid` has a different recovery: call `setValue(validReplacement)` with a value supplied by your plugin. The kit never silently overwrites malformed saved data with a default. The control reports `loading` without a value until that replacement is accepted.

## Action results

`setValue`, `beginGesture`, an active `endGesture`, and `retry` resolve to:

```ts
type PluginStateEditResult =
    | {
        readonly kind: "accepted";
        readonly changed?: boolean;
        readonly historyEntry?: PluginStateHistoryEntry;
    }
    | { readonly kind: "rejected"; readonly reason: PluginStateRejectionReason }
    | {
        readonly kind: "interrupted";
        readonly reason: "reset" | "closed";
        readonly acceptance: "unknown";
    };

type PluginStateRejectionReason =
    | "not-ready"
    | "invalid-command"
    | "invalid-value"
    | "stale-version"
    | "stale-history"
    | "stale-scope"
    | "busy"
    | "service-closed"
    | "sequence";
```

`accepted` confirms command acceptance, not completed saving or engine application. `changed`, when present, reports whether the editable value changed. `historyEntry`, when present, is an opaque token for guarded Undo/Redo; it has no public readable fields. Retain it and pass it to the history API rather than inspecting its contents. `interrupted` means the connection reset or closed before acceptance became known; do not assume rejection and automatically replay the edit.

| Rejection reason | Meaning |
|---|---|
| `not-ready` | Required state is not usable yet. |
| `invalid-command` | The request has an invalid shape or target. |
| `invalid-value` | The proposed value failed validation. |
| `stale-version` | The field or guarded retry target changed since it was observed. |
| `stale-history` | The requested history entry is no longer eligible. |
| `stale-scope` | The operation belongs to a replaced document or service lifetime. |
| `busy` | An active gesture prevents this operation. |
| `service-closed` | The state service is closed. |
| `sequence` | The command does not satisfy the required ordering. |

## Whole-definition overload and shared history

`usePluginState(definition)` returns a different object; it is not a map of controls and has no `state` property:

```ts
interface PluginStateEditor<Fields> {
    edit(changes: PluginStateChanges<Fields>, options?: { readonly history?: boolean; readonly recall?: boolean }): Promise<PluginStateEditResult>;
    beginGesture(keys: readonly (keyof Fields)[]): Promise<PluginStateEditResult>;
    endGesture(): Promise<PluginStateEditResult> | undefined;
}
```

`edit` applies the supplied declared fields together as one accepted change and one Undo entry. `edit(changes, { history: false })` applies the change without an Undo entry and leaves Redo intact. `edit(changes, { recall: true })` marks a preset or snapshot replacing the sound, so preparation sees `reason: "recall"` ([details](PLUGIN_STATE.md#why-a-value-is-being-prepared)); it cannot write into a gesture. `beginGesture(keys)` opens one gesture over several fields; until `endGesture`, `edit` and those fields' `setValue` write into it, and `endGesture` records one Undo entry listing every field that moved. `beginGesture` rejects with `busy` while any of those fields is in another gesture or this editor already has one open; `endGesture` returns `undefined` when this editor has none.

Undo/Redo are obtained separately through `usePluginHistory()`. They are not methods on `envelope`:

```ts
interface PluginStateHistory {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undoEntry?: PluginStateHistoryEntry;
    readonly redoEntry?: PluginStateHistoryEntry;
    canUndoEntry(entry?: PluginStateHistoryEntry): boolean;
    canRedoEntry(entry?: PluginStateHistoryEntry): boolean;
    undo(entry?: PluginStateHistoryEntry): Promise<PluginStateEditResult>;
    redo(entry?: PluginStateHistoryEntry): Promise<PluginStateEditResult>;
}
```

## Declaration options

| Option | On | Meaning |
|---|---|---|
| `preset: false` | `parameter(endpoint, options)`, `storedValue(options)` | The field is not part of the sound: presets and snapshots neither save nor recall it. |
| `lifetime: "user"` | `storedValue(options)` | One value shared by every instance and project of the plugin, kept in the user's files (in memory where the Cmajor user-files API is absent). Never part of Undo; `history: true` is an error. |

## Custom delivery

A component with its own transfer protocol passes a `PluginStateDelivery` as the `engine` of `preparedState`. The generated worker calls `create` once per project document and `apply` with each prepared value; the [guide](PLUGIN_STATE.md#custom-delivery) describes the lifetimes and walks through an example.

```ts
interface PluginStateDelivery<Payload> {
    readonly eventEndpoints: readonly string[];      // Events `send` may target.
    readonly outputEndpoints?: readonly string[];    // Outputs `listen` may observe.
    readonly storedKeys?: readonly string[];         // Saved-state keys `readStored` and `subscribeStored` may read.
    readonly hostEffects?: readonly string[];        // Host effects `send` may target; each needs a native handler.
    readonly dataInputs?: readonly number[];         // Shared-data inputs `prepareData` may fill.
    readonly replacement?: "supersede" | "finish";   // "finish" lets the current application end before the newest value.
    create(document: PluginStateDocumentContext): {
        apply(payload: Payload, context: PluginStateDeliveryContext): Promise<PluginStateDeliveryOutcome>;
        stop(): void | Promise<void>;
    };
}

type PluginStateEffect =
    | { readonly kind: "event"; readonly endpoint: string; readonly value: unknown }
    | { readonly kind: "host-effect"; readonly name: string; readonly value: unknown };

type PluginStateSubmission =
    | { readonly kind: "submitted"; readonly completion: Promise<   // Settles once native code has processed the message.
        | { readonly kind: "sent"; readonly proof: "native-publication-processed" }
        | { readonly kind: "failed"; readonly error: { readonly kind: string; readonly message: string } }
        | { readonly kind: "cancelled" }> }
    | { readonly kind: "failed"; readonly error: { readonly kind: string; readonly message: string } }
    | { readonly kind: "cancelled" };
```

`PluginStateDocumentContext` has `signal`, `send`, `listen`, `readStored`, `subscribeStored`, `prepareData(input, byteLength, writer, signal?)`, `report(status)` and `fail(error)`. `PluginStateDeliveryContext` has `signal`, `send` and `listen`; its listeners are removed when that application ends. `apply` resolves to `{ kind: "sent" }` or `{ kind: "acknowledged" }` when the engine has the value, `{ kind: "unconfirmed" }` when it cannot know, or `{ kind: "failed", error }` or `{ kind: "cancelled" }`. A submission's `completion` is itself a valid outcome, so an `apply` that sends one message can return it.

## Presets and snapshots

`presets({ factory?, initial? })` returns `{ presetLibrary, activePreset }` to spread into `definePluginState`. Each factory preset is `{ id, name, values }`, with `values` keyed by sound field in the form `editor.edit` accepts. `initial` is a factory preset `id`: a new project starts with it as the active preset, and `definePluginState` throws if no factory preset has that id. Without `initial`, `active` is `null` until the first recall. `snapshots({ slots? })` returns `{ snapshotSlots, activeSnapshot }`; `slots` defaults to `["A", "B", "C", "D", "E", "F", "G"]`.

`usePresets(definition)` returns:

```ts
interface Presets {
    readonly status: "loading" | "ready" | "unavailable";
    readonly error: string | null;            // Last failed action, or why presets are unavailable.
    readonly factory: readonly { id: string; name: string }[];
    readonly user: readonly { id: string; name: string }[];
    readonly active: { id: string; name: string } | null;   // May name a deleted user preset.
    readonly dirty: boolean;                  // The sound differs from the active preset.
    recall(id: string): Promise<PresetActionResult>;        // One Undo entry.
    revert(): Promise<PresetActionResult>;                  // Recall the active preset; one Undo entry.
    save(name: string): Promise<PresetActionResult>;        // New user preset from the sound; becomes active.
    update(): Promise<PresetActionResult>;                  // Overwrite the active user preset.
    rename(id: string, name: string): Promise<PresetActionResult>;
    remove(id: string): Promise<PresetActionResult>;        // Deleting the active preset clears it.
    duplicate(id: string): Promise<PresetActionResult>;
    exportJson(id?: string): { kind: "done"; text: string } | { kind: "failed"; message: string };   // No id: the current sound.
    importJson(text: string): Promise<PresetActionResult>;  // Adds to the library; does not load it.
    loadJson(text: string): Promise<PresetActionResult>;    // Loads the sound; one Undo entry; no preset is active afterwards.
}

type PresetActionResult = { readonly kind: "done" } | { readonly kind: "failed"; readonly message: string };
```

`useSnapshots(definition)` returns:

```ts
interface Snapshots {
    readonly status: "loading" | "ready" | "unavailable";
    readonly error: string | null;
    readonly slots: readonly { id: string; filled: boolean }[];
    readonly active: string | null;
    select(slot: string): Promise<PresetActionResult>;  // One Undo entry; see the guide for capture rules.
    clear(slot: string): Promise<PresetActionResult>;   // No Undo entry; clearing the active slot deselects it.
}
```

Only `recall`, `revert`, `loadJson` and `select` create Undo entries. `importJson` and `loadJson` refuse a file written for another plugin ID or one that sets a field that is not a sound field. A failed action's `message` is written for the user and says what to do next; the hook also keeps it in `error` until the next action succeeds.

`<PresetBar definition={definition} className? />` shows a labelled preset selector with factory and user groups, a "Modified" indicator, Save, Save as new, Revert, and a More menu with Rename, Duplicate, Delete, Copy JSON and Paste JSON. Paste JSON opens a field with Load (`loadJson`, also on Enter), Add to library (`importJson`) and Cancel. `<SnapshotBar definition={definition} className? />` shows one toggle button per slot (`aria-pressed` marks the active slot; a dot marks a filled slot) and Clear for the active slot. Both install their default styles into the document or shadow root they render in, and take their colors from the shared `--editor-accent-start` and `--editor-surface-bg` custom properties (see [Knobs](KNOBS_API.md#styling)).
