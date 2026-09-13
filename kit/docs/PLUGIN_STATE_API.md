# Plugin state React API

Use the [plugin state guide](PLUGIN_STATE.md) to choose and connect a declaration. This reference describes the current return values; it does not introduce a different API. Import public functions and types from `kit/index`, using the relative path from your plugin.

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

`usePluginState(definition)` returns a different object with one method: `edit(changes): Promise<PluginStateEditResult>`. It applies the supplied declared fields together as one accepted change and one Undo entry; it is not a map of controls and has no `state` property.

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
