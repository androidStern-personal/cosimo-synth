# Shared plugin state

This opt-in API keeps editable values and Undo history alive when the plugin
window closes. React controls use the same API for host parameters and structured
values. The framework builds and owns the state worker.

It requires the Cmajor `kit_state` channel extension in both the native wrapper
and browser runtime. An older runtime cannot run it: startup reports failure
instead of silently keeping a separate GUI-only state. The framework does not
change how existing plugins work unless they opt in.

## Author code

Put a default-exported definition in `fx/<plugin>/state.ts`. Import the public
API from `../../kit/index`:

```ts
import { definePluginState, parameter, storedValue, eventValue } from "../../kit/index";
import { curveCodec, initialCurve, renderCurve } from "./curve";

export default definePluginState({
    cutoff: parameter("cutoff"),
    envelope: storedValue({
        initial: initialCurve,
        codec: curveCodec,
        engine: eventValue("envelopeSamples", renderCurve),
    }),
});
```

`cutoff` and `envelopeSamples` must exist in the DSP. A parameter gets its current
value, range, step and default from the host; the definition does not introduce
another default. A stored field uses its definition key (`envelope` here) as its
native storage key.

The author supplies the domain codec and renderer. The codec has three methods:

- `parse(unknown)` returns `{ kind: "ok", value }` or `{ kind: "error", message }`.
  A successful value must be immutable and independent of the input.
- `encode(value)` returns JSON suitable for saving and restoring that value.
- `equals(left, right)` compares domain values, independent of object allocation.

A missing saved value uses the declared initial value. Invalid saved data reports
a failed field; it is not overwritten with a default.

The renderer receives the accepted value and returns the payload for the DSP
event. It may return a promise and numeric typed arrays. It must not depend on
React, DOM globals or a view remaining open. Preparation runs outside audio
processing; the framework converts the payload and sends it through the selected
engine binding. The event path is bounded by the native channel's JSON limits;
it is not an arbitrary-size asset transport.

If rendering depends on a host parameter, declare that dependency explicitly:

```ts
engine: eventValue("envelopeSamples", (curve, { parameters, signal }) =>
    renderCurve(curve, parameters.rate, signal),
    { dependencies: ["rate"] }),
```

`rate` is the key of a `parameter(...)` in the same definition. The renderer gets
captured values for exactly those dependencies. Changes to the field or its
declared dependencies, and project restores, supersede obsolete preparation.
A renderer can use `signal.aborted` and `signal.onAbort(callback)` to stop work
cooperatively. Late results cannot authorize another framework send after
cancellation; cancellation cannot recall an event already sent to the engine.

Set `"stateSource": "fx/<plugin>/state.ts"` in the plugin's `.plugin.json`.
The normal build generates the worker. Do not also set `workerSource`.

The view entry composes an ordinary React component:

```tsx
import { createStatefulPatchView, usePluginState, usePluginHistory } from "../../../kit/index";
import definition from "../state";

function View() {
    const cutoff = usePluginState(definition.cutoff);
    const history = usePluginHistory();
    if (cutoff.state.kind !== "ready") return <p>{cutoff.state.kind}</p>;

    return <>
        <input type="range"
            min={cutoff.state.metadata?.min}
            max={cutoff.state.metadata?.max}
            step={(cutoff.state.metadata?.step ?? 0) > 0 ? cutoff.state.metadata?.step : "any"}
            value={cutoff.state.value}
            onPointerDown={() => { void cutoff.beginGesture(); }}
            onChange={event => { void cutoff.setValue(Number(event.target.value)); }}
            onPointerUp={() => { void cutoff.endGesture(); }}
            onPointerCancel={() => { void cutoff.endGesture(); }} />
        <button disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
    </>;
}

export default createStatefulPatchView({ definition, View });
```

Use the same hook with `definition.envelope` and pass its value and edit calls to
your curve editor. Control unmount ends its gesture; window removal releases the
GUI client. Reopening attaches a fresh client to the surviving state owner.

## What an edit means

The control draws its draft immediately. `setValue` resolves with acceptance,
rejection, or an interruption that says whether acceptance remains unknown.
Acceptance does not mean audio has necessarily changed. `state.pending` means
this view still has edits awaiting acceptance. `state.application` separately
reports preparation, delivery or failure.

An accepted `setValue` result includes `changed`: whether the accepted value
actually changed after validation and parameter rounding. A valid no-op returns
`false`. This describes the edit, independently of engine delivery.

The built-in event binding reports `sent` with
`proof: "native-publication-processed"`. That means the native channel processed
the publication, not that the DSP sent an acknowledgement. An adapter may report
`acknowledged` only when its actual engine protocol provides that evidence.
Incoming host parameter values start as `unconfirmed`; an observation is not
invented proof of a particular GUI write.

## Shared editing rules

- A gesture groups its accepted changes into one Undo entry. Net-zero gestures
  do not add entries. History retains the latest 100 completed entries.
- An active gesture protects that field from another GUI or agent writer.
  Other fields remain editable. Host automation retains host authority.
- GUI edits and edits from another framework client share Undo history. An agent
  integration can use that same client protocol; this module does not itself
  install an MCP server. Automation updates the current value without making
  Undo entries or echoing another write to the host.
- Undo and Redo are unavailable while any gesture is active.
- Control/window removal through the view wrapper, or native client detachment,
  ends that client's gestures. A full project restore replaces the document,
  clears history and rejects old commands and delivery completions.
- A lost connection never automatically replays an edit whose acceptance is
  unknown. Callers receive that uncertainty rather than a fabricated rejection.

## Framework responsibilities

The definition and React hooks are the author-facing surface. Internally, the
session owns accepted values, history and conflict rules. The GUI client owns
temporary drafts and correlates replies. Each uses Jotai for local reactivity.
The Cmajor adapter carries commands and snapshots between those owners. Native
views and the worker have separate JavaScript environments; the browser currently
hosts the worker facade in the main browser realm, separately from the AudioWorklet.
Engine bindings own preparation, cancellation and delivery evidence.
The view wrapper and generated worker own startup and cleanup.

`kit/package.json` marks unused library modules as removable when bundling the
worker from the public entry point. Actual preview/dev-tool entry effects and CSS
remain marked as side effects. A new module that performs work at import time
must preserve that behavior explicitly, or move it into an owned startup function.
