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

`state.kind` is the control's connection/readiness status. It is not the kind of envelope or the declaration kind. Its literal strings are lowercase. The alternatives below expand the public type without changing its property names:

```ts
type PluginStateControlState<Value> =
    | { readonly kind: "connecting" }
    | { readonly kind: "closed" }
    | { readonly kind: "failed"; readonly reason: string }
    | {
        readonly kind: "ready";
        readonly value: Value;
        readonly pending: boolean;
        readonly application?: PluginStateApplicationState;
        readonly metadata?: {
            readonly min: number;
            readonly max: number;
            readonly step: number;
            readonly defaultValue: number;
        };
    };
```

| `state.kind` | Meaning | Additional properties |
|---|---|---|
| `connecting` | Waiting for the connection or this field's initial usable value. | None |
| `closed` | The client connection has closed. | None |
| `failed` | Connection or field readiness failed. | `reason: string` |
| `ready` | There is a usable editable value. | `value`, `pending`, optional `application`, optional `metadata` |

Only `ready` exposes `value`. Its `pending` means this GUI is waiting for edit acceptance; it does not mean the audio engine has finished applying the edit. `metadata` is supplied for host parameters and contains the four numbers shown above, not units, formatting functions or endpoint names. An MSEG field normally has `application` and no parameter `metadata`.

The public `failed.reason` is an unrestricted diagnostic string, not an enum. Field-readiness reasons currently include `missing-parameter`, `invalid-state`, and `service-closed`; connection failures can carry other messages.

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

Treat received values as immutable even though this curve type uses mutable TypeScript property declarations. `x` and `y` are normalized curve coordinates; `curvePower` controls the outgoing segment. `globalSmooth` is retained metadata, not an implemented smoothing effect. Connection status, engine status, duration and playback policy are not fields in this curve object.

## Engine application

The optional `state.application` describes delivery of the requested value to the engine. This is separate from having an editable value and from accepting an edit:

```ts
type PluginStateApplicationState =
    | { readonly kind: "pending" }
    | { readonly kind: "waiting-for-inputs" }
    | { readonly kind: "preparing" }
    | { readonly kind: "unconfirmed" }
    | {
        readonly kind: "sent";
        readonly proof:
            | "connection-call-returned"
            | "native-publication-processed";
    }
    | { readonly kind: "acknowledged" }
    | {
        readonly kind: "failed";
        readonly error: {
            readonly kind: "resource" | "transport" | "engine-rejected" | "defect";
            readonly message: string;
        };
    };
```

| `application.kind` | Meaning |
|---|---|
| `pending` | An engine update is requested; no later progress has been reported. |
| `waiting-for-inputs` | Required declared inputs are not ready yet. |
| `preparing` | Preparing the engine data. |
| `unconfirmed` | Engine application is not confirmed. |
| `sent` | The stated handoff completed; this is not audio-adoption confirmation. |
| `acknowledged` | The engine confirmed applying that update. |
| `failed` | Preparation or delivery failed; inspect `error`. |

`resource` covers expected resource/preparation failures, `transport` delivery failures, `engine-rejected` an explicit engine refusal, and `defect` an unexpected implementation failure. The hook does not offer retry for a `defect`.

## Field error

```ts
type PluginStateControlError = {
    readonly kind: "readiness" | "persistence" | "application";
    readonly message: string;
};
```

`envelope.error` is `null` or one field diagnostic. If multiple failures exist, the projection chooses readiness first, then persistence, then application. A `ready` control can still have a persistence or application error: having an editable value does not establish successful saving or engine delivery. A connection-level `state.reason` is not necessarily duplicated in `error`; inspect the failed state itself. There is no separate public persistence-status object on this control.

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
