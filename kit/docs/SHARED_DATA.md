# Shared audio data

`sharedData` delivers prepared `Float32Array` values through the existing plugin
state and Undo API. Allocation and writes happen outside audio processing. Audio
switches to a completed resource at the start of a render block. The native JIT
uses native storage; the browser uses shared WebAssembly memory.

This requires the Cmajor fork's shared-data support. Browser code must be generated
with `sharedMemory: { maximumPages }` and served with cross-origin isolation.
The current production toolchain pin does not yet include this feature.

## Plugin author: state definition

```ts
import { definePluginState, preparedState, sharedData } from "./kit";
import { curveCodec, initialCurve, renderCurve } from "./my-curve";

export const state = definePluginState({
    envelope: preparedState({
        schema: curveCodec,       // Editable data: parsing, saving and equality.
        initial: initialCurve,
        prepare: renderCurve,     // Returns a new Float32Array of DSP samples.
        engine: sharedData({ input: 0 }),
    }),
});
```

The framework runs `prepare` when an accepted edit, Undo, Redo or restore requires
new audio data. Returning a buffer gives the framework exclusive read ownership;
do not mutate it or reuse it for another preparation. This avoids copying the
whole prepared buffer again. Preparation is independent of React; this feature
does not move CPU-heavy preparation to a new computation thread.

The GUI uses the existing `usePluginState(state.envelope)` and
`usePluginHistory()` hooks. It never creates a worker or handles transfer messages.
`control.state.application.kind === "acknowledged"` means the specific replacement
was used by audio. An accepted edit and an audio acknowledgement remain separate.
Failed delivery leaves the accepted editable value and Undo history intact.

## Plugin author: memory allowance and DSP reader

Declare the available inputs and one shared live-data budget in the patch manifest:

```json
"sharedData": { "inputCount": 1, "maxRetainedBytes": 32768 }
```

This is a limit, not a request to preallocate that many bytes for every input.
It must accommodate resources still being played plus new unpublished resources.
The native store counts retained vector capacity; the browser grows its arena as
needed and reuses freed regions. Browser memory can retain its largest reached
capacity until that program instance is disposed. Fragmentation can prevent a
large contiguous allocation even when smaller free regions remain.

```cmajor
// PLUGIN DSP: these functions are supplied by the framework.
namespace cmaj::data
{
    external float read (int inputIndex, int sampleIndex);
    external int size (int inputIndex);
}

// Inside the processor: use samples according to your component's layout.
// The input number matches sharedData({ input: 0 }) above.
float sample = cmaj::data::read (0, sampleIndex);
```

Invalid input/sample indexes return zero. A zero-length resource clears an input.
The component author defines what each sample means; no component-specific packet
assembly or storage management is required. This stock adapter handles floats,
not arbitrary JavaScript objects or retained versions for individual held notes.

## Framework building blocks

| Module | Runs where | Owns |
|---|---|---|
| `sharedData` | Declaration imported by GUI and generated worker | Selects a data input; no live resources on import |
| State service and engine binding | Existing plugin worker | Accepted values, shared Undo, preparation and cancellation |
| Shared-data port | Existing plugin worker | Bounded control messages, correlation, timeout and exact cleanup |
| Cmajor native/browser bridge | Native control thread / browser main thread | Allocation, writing and scoped publication |
| Shared storage and reader | Control thread and audio thread | Complete-resource adoption, read bounds and safe reclamation |

Native control messages contain at most 8,192 floats. They populate unpublished
native storage and do not enter the DSP event queue. Browser writes populate shared
memory directly; sample payloads do not travel through the AudioWorklet message
port. In either environment, audio performs only the small resource switch.

The lower storage API can share one prepared resource across multiple inputs.
The stock `sharedData` declaration prepares one resource for one input. Advanced
component delivery can use the existing `PluginStateDelivery` seam and declare
`dataInputs`, then call its scoped `replaceData(input, samples)` capability.

There is one control owner and one audio reader per store. Audio performs no
allocation, deallocation, locking or waiting in the store. Reclamation runs on the
control side after audio finishes its block. Disposal requires confirmed audio
quiescence; it does not depend on another audio block occurring. Source assets for
future Undo remain the plugin author's responsibility.
