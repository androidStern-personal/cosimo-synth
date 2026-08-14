# ADR-022: One A/B/C renderer, adapted—not reimplemented—per platform

Status: accepted, implementation pending — 2026-08-14

## Context

The accepted construction branch currently keeps oscillator A on the old Cmajor render
loop while B/C use `WarpRenderer` through `RendererBridge` in opt-in fixtures. It also
keeps A's exact-float table bank beside the new packed A/B/C pool. This was done to hold
the existing A sound constant and keep normal products working while the new path was
built.

Desktop and iPhone can call native external functions through different host mechanics.
Stock Cmajor WebAudio generation cannot resolve the renderer external function, so the
browser currently compiles the external path out. That tool limitation was beginning to
turn temporary staging into a proposed permanent platform split.

## Decision

`native/three_oscillator_renderer/WarpRenderer.cpp` plus `RendererBridge` is the sole
oscillator-rendering implementation for A, B, and C.

- Desktop supplies the exact function through the existing Cmajor native provider seam.
- iPhone links the same source into generated AUv3 code.
- Web compiles the same source to SIMD WebAssembly and supplies it to the Cmajor
  AudioWorklet through a direct Wasm function import and computed shared memory layout.

Those are adapters around one renderer. They may translate calling conventions and
memory ownership; they may not contain another waveform, warp, unison, or table-sampling
algorithm.

The product hard cut removes the old A render loop, exact-float A bank, scalar A table
protocol, packed-table mirroring, and `enableExternalRenderer`. All shipping products
require the canonical renderer. A renderer-construction failure is an explicit patch
startup failure, not an A-only fallback product.

## Why the Web adapter is different

Desktop and iPhone execute native C++; Web executes WebAssembly inside an AudioWorklet.
That necessarily changes how the function and memory are connected, but not what code
calculates audio.

The chosen Web design preserves the existing Cmajor WebAudio/PatchConnection host:

1. provider-aware generation leaves one exact renderer import in the Cmajor module;
2. the renderer source compiles to a second small SIMD Wasm module;
3. both modules use one computed, non-overlapping memory layout;
4. the imported Wasm function is called directly, without a per-sample JavaScript
   trampoline.

A prior isolated proof already established feasibility. The roadmap therefore does not
fund a second route-selection prototype or a pure-Cmajor B/C renderer.

## Product invariant

For identical tables, controls, note schedules, and sample rate, all platforms execute
the same renderer source. Platform gates must witness isolated A, B, C, summed A/B/C,
the exact 18-slice table ABI, and a real renderer invocation. A non-silent A note is not
sufficient evidence because the old A path could mask a disconnected renderer.

## Merge rule

Portable native/Web adapters may land while unused. Root, worker, UI, and renderer
activation are one atomic merge unit. The accepted product after that merge contains no
feature switch or alternate implementation. Intermediate construction commits are not
independently shippable.

## Consequences

- Browser integration is a real prerequisite rather than a permanent exception.
- The hard cut intentionally gives up old DAW-project endpoint compatibility and the
  ability to run a reduced A-only product.
- Frozen A audio remains a comparison oracle, not retained production code.
- The packed A/B/C pool becomes the only table representation, removing roughly the
  temporary exact-float A duplication documented by CORE-02/03.
- Platform host code remains different where the operating systems require it, while
  musical/rendering behavior has one owner.

## Rejected alternatives

- **Keep old A indefinitely:** rejected because it duplicates rendering, tables,
  controls, and lifecycle logic.
- **Pure-Cmajor B/C on Web:** rejected because it creates a second renderer algorithm.
- **Permanent A-only browser manifest:** rejected because platform capability would
  change the product.
- **Runtime zero/trap fallback:** rejected because it advertises an A/B/C graph whose
  renderer is unavailable.
- **Maintain a product feature flag through the cutover:** rejected because it preserves
  the parallel architecture the hard cut is meant to remove.
