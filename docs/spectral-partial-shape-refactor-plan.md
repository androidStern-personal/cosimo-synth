# Spectral Partial Shape Refactor Plan

This plan replaces the old scalar harmonic controls with one shaped partial table for Spectral Chord Resonator.

## Architecture Contract

- DSP owns audio behavior.
- `SpectralPartialShapeRuntimeBridge` owns the partial shape object.
- React or DOM code renders state and calls bridge methods.
- The view does not call `sendStoredStateValue` or DSP endpoints directly.
- Shared repo infrastructure remains responsible for presets, snapshots, and stored-state transport.

The partial shape is the single authority for both active partial count and partial strengths:

```ts
type SpectralPartialShapeState = {
  version: 1;
  count: number;
  values: number[];
  preset: "flat" | "saw" | "square" | "triangle" | "organ" | "nasal" | "air" | "pluck" | "custom";
};
```

There is no legacy second owner. `harmonicCountIn` and `harmonicRolloffDbIn` are removed from the public graph and DSP path.

## Runtime Data Flow

The Cmajor upload endpoint is:

```cmajor
struct PartialShapeUpload
{
    int32 count;
    float32[64] strengths;
}

input event PartialShapeUpload partialShapeUpload;
```

`partialShapeUpload` clamps `count` and `strengths`, updates DSP state, marks the mask dirty, and causes the chord mask to rebuild from uploaded partial strengths.

The bridge writes stored state. The worker only mirrors stored state back into DSP when the view is absent.

## Task Breakdown And Acceptance Criteria

### Task 1: Plan Document

Work:
- Add this Markdown plan.
- Include task acceptance criteria and a TDD matrix.

Acceptance criteria:
- The document states the single-owner rule for `{ count, values }`.
- The document explicitly removes `harmonicCountIn` and `harmonicRolloffDbIn`.
- The TDD matrix maps each implementation risk to a test.

### Task 2: Partial Shape State Module

Work:
- Add `fx/spectral_chord_resonator/view/spectral-partial-state.ts`.
- Define constants, default state, preset builders, normalization, strict parsing, serialization, transforms, and upload building.

Acceptance criteria:
- State always has exactly 64 values.
- `count` clamps to `1..64`.
- Values clamp to `0..1`.
- Manual transforms set `preset` to `custom`.
- Inactive values above `count` are preserved.
- Presets produce independently recognizable shapes.

### Task 3: DSP Upload Endpoint

Work:
- Add `PartialShapeUpload` to `SpectralChordResonator.cmajor`.
- Replace rolloff-derived harmonic gains with uploaded partial strengths.
- Remove `harmonicCountIn` and `harmonicRolloffDbIn` graph inputs and event handlers.
- Initialize partial strengths to the saw 1/h default.

Acceptance criteria:
- `partialShapeUpload` clamps malformed input in DSP.
- `partialShapeUpload` rebuilds the chord mask.
- `rebuildChordMask()` uses `partialStrengths[h - 1]`.
- Existing bypass behavior remains unchanged.
- A DSP test proves different uploaded shapes produce different resonance behavior.

### Task 4: Runtime Bridge

Work:
- Add `fx/spectral_chord_resonator/view/spectral-partial-runtime-bridge.ts`.
- Keep it small: boot, subscribe, stored-state writes, DSP upload, live-edit batching, echo suppression.
- Put shape math in pure state functions, not in the bridge.

Acceptance criteria:
- Boot with saved state uploads exactly once and writes no stored state.
- Boot with missing state uploads the default shape and writes no stored state.
- Live edit batches intermediate uploads and writes stored state once on commit.
- Final pointerup/blur commit flushes the last state.
- Preset apply cancels any pending live edit before applying state.
- Stored-state echoes cannot clobber a newer local edit.

### Task 5: Preset And Snapshot Adapter

Work:
- Add `spectral-partial-preset-adapter.ts`.
- Use the existing `EffectStoredStateAdapter` contract.
- Pass the adapter into `createStandaloneEffectPresetController` and `EffectSnapshotBankController`.

Acceptance criteria:
- Adapter `capture()` reads bridge state.
- Adapter `apply()` goes through the bridge.
- Adapter tests do not retest shared preset/snapshot controllers.

### Task 6: Worker Restore

Work:
- Add `fx/spectral_chord_resonator/worker/source.ts`.
- Use `createStoredStateRuntimeMirror`.
- Wire `workerSource` into `fx/build-effect.mjs`.

Acceptance criteria:
- Worker uploads saved partial shape to DSP.
- Worker writes no stored state.
- Built spectral runtime manifest contains `worker.js`.

### Task 7: Controlled Editor UI

Work:
- Replace the generated-only spectral view with a controlled partial shape editor plus existing scalar controls.
- Keep `effect-header`.
- Keep the standalone HTML prototype as UX reference only.

Acceptance criteria:
- Editor reflects bridge state.
- Dragging a partial changes visible state and commits one stored-state write.
- Scalar parameter controls still render for the remaining parameters.
- Internal `partialShapeUpload` is not shown as a user control.

### Task 8: Verification

Work:
- Run the Cmajor, Node, Python, build, and browser smoke checks.
- Audit changed tests for meaningful assertions.

Acceptance criteria:
- Cmajor dry-run passes.
- Cmajor spectral tests pass.
- Node state/bridge/adapter/worker/view tests pass.
- Python spectral probe passes.
- `npm run fx:build -- spectral` passes.
- Browser smoke load has no view-load error.

## TDD Matrix

| Risk | Test | Acceptance signal |
| --- | --- | --- |
| State normalization silently corrupts shape data | `tests/test_spectral_partial_state.mjs` | Count `1..64`, values `0..1`, 64 values preserved |
| Presets are not distinct enough to be useful | `tests/test_spectral_partial_state.mjs` | Saw decays, square zeros evens, triangle decays odd partials faster |
| JS upload shape does not reach DSP | `tests/test_spectral_chord_resonator_probe.py` | Flat and fundamental-only uploads produce measurably different harmonic energy |
| Bridge overwrites saved state on boot | `tests/test_spectral_partial_runtime_bridge.mjs` | Saved state uploads once, stored writes remain zero |
| Missing state causes no usable DSP shape | `tests/test_spectral_partial_runtime_bridge.mjs` | Default saw shape uploads once, stored writes remain zero |
| Live drawing spams storage or drops final state | `tests/test_spectral_partial_runtime_bridge.mjs` | Uploads are coalesced and one stored write happens on commit |
| Stored-state echo clobbers newer edit | `tests/test_spectral_partial_runtime_bridge.mjs` | Newer state remains canonical |
| Preset apply races live edit | `tests/test_spectral_partial_runtime_bridge.mjs` | Live edit is cancelled before preset state applies |
| Adapter bypasses bridge ownership | `tests/test_spectral_partial_preset_adapter.mjs` | Adapter capture/apply goes through bridge |
| Worker diverges from bridge restore behavior | `tests/test_spectral_worker_service.mjs` | Worker uploads saved state and writes nothing |
| UI becomes state owner again | Browser smoke and bridge tests | View loads editor; ownership assertions stay in bridge tests |
| Shared libraries are accidentally retested instead of Spectral behavior | Test audit | Tests assert Spectral payloads, writes, and state transitions |

