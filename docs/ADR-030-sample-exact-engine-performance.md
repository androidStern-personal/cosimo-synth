# ADR-030: Sample-exact engine performance program

## Status

Accepted, 2026-08-30.

## Context

The 2026-08 iPhone dropout report (a shared INIT-derived legato patch with a
distortion/split/OTT/chorus lane — kept as
`tests/fixtures/perf/dropout-share-patch.json`) reproduced offline: the
generated web engine spent roughly half its render budget on complete
silence, and the shared patch ran over realtime. ADR-020's qualification data
had already recorded the shape of this — 22–26% render load on an EMPTY
engine in desktop browsers while the native build measured only 1.3–2.3%
*added* load for full route programs — but the web engine never had a
phone-budget gate, so the fixed floor shipped.

The floor was not one mistake. It was the sum of every place a sound
principle stopped one seam short: the compiled sparse modulation program
(ADR-020) delivered through a dense 195-lane smooth-and-publish loop; sixteen
voices advancing seven modulator nodes per sample regardless of sounding
state; the oscillator renderer expanding unison controls for all 48
voice-oscillator slots and convolving its 79-tap anti-imaging FIR for all 16
note slots per channel per sample, active or not; diagnostic analyzers
running a 4096-point FFT twenty times a second for views that were closed;
and per-sample transcendental re-derivation of values that only move on
parameter edits — while the exact memo idiom needed (`wt::RackOctaveScaler`)
sat in the same codebase.

## Decision

Engine performance work is accepted only when it is **sample-exact**: the
optimized engine must produce bit-identical `audioOut` for identical input
sequences. The audio-rate temporal contract of ADR-020 stands untouched —
nothing moves to a control rate, no epsilon tolerances enter audio paths.
What changes is only *when* a value is derived, never *what*:

- **Skip work whose inputs are provably zero.** A quiescent voice (not
  active, amp envelope at exactly zero) is frozen whole — its modulators,
  pitch glide and renderer controls — because every consumer gates on the
  same sounding predicate and a note-on resets everything it reads. The
  renderer skips control expansion for cleared voice-oscillators and skips a
  4-note FIR batch once its history has drained to all-zero (the drain
  counter still pushes and filters the final zeros; convolving an all-zero
  history is exactly +0, so writing 0 is identity). The rack modulation bus
  smooths and publishes only lanes that are routed or still decaying; a
  lane's last write before going dormant is its snapped exact zero.
- **Derive on change, reuse identical bits otherwise.** KeyTrack.cmajor owns
  an exact-input memo family (`ExactPow2Memo`, `NoteFrequencyMemo`,
  `GainDbMemo`): recompute on ANY input change (exact float compare, unlike
  RackOctaveScaler's 0.001 forwarding epsilon), return the identical stored
  value otherwise, self-invalidating from zero-init because every derived
  value is strictly positive. Applied to the voice SVF coefficients (derived
  once per change, mirrored to the right channel; filter state never
  copied), note-to-frequency, dB-to-gain, the key-track ratio pows, the
  distortion's asymmetric bias term (a function of the knee alone that was
  recomputed 16 times per output sample), and the chorus mix/tone/ring
  constants.
- **Observation is demand-driven.** The spectrum capture and distortion
  scopes sleep unless their int32 activity event input is nonzero. The UI
  half is one seam: `usePatchVisualEndpoint` reference-counts analyzer
  endpoint listeners (`ui/shared/analyzer-activity.ts`), so a view wakes its
  analyzer for exactly as long as it observes. Audio is untouched either
  way.
- **Observation math runs on the observer's thread.** The 4096-point
  spectrum FFT used to execute inside ONE sample's advance, twenty times a
  second — several render quanta of work in a 2.7ms budget, the single
  biggest peak-load spike on a phone with the filter view open. The engine
  now emits the raw 1024-sample analysis window
  (`FilterSpectrumCapture`) on the unchanged `filterSpectrum` endpoint and
  the UI computes the identical Hann window, zero-padded FFT and normalized
  magnitudes at 20fps (`computeFilterSpectrumMagnitudes` in
  `ui/shared/filter-spectrum.ts`, which also still accepts recorded and
  synthetic magnitude frames). Frame-by-frame parity against the in-engine
  FFT was measured at a maximum absolute error of 2.4e-9 with identical
  emission samples — float32 rounding, invisible on a dB display.
- **The render thread allocates nothing for unobserved events.** The
  generated worklet helper unpacked EVERY queued output event into fresh JS
  objects each block — the monitor streams at 30–60Hz, the spectrum's
  2048-entry array literal — listeners or not, then posted one port message
  per event per listener. JSC garbage-collection pauses from that churn are
  multi-ms audio-thread stalls: late callbacks and missed deadlines on the
  phone HUD. `poolCosimoAudioWorkletEventDelivery`
  (`web/audio-worklet-instrumentation.mjs`) now drops unlistened events in
  wasm memory unread, and coalesces the events one block does deliver into
  a single port message (the `cosimo-event-batch` envelope, unwrapped
  before `deliverMessageFromServer`; a lone message keeps the original wire
  shape).

## The acceptance gate

`tests/tools/offline-engine-driver.mjs` drives the generated offline
performer deterministically (fixed session id seeds all engine randomness)
through the product's own adapters — the modulation program compiler and the
lane v2 event builder — so scenarios replay exactly what the app sends.

- `scripts/compare_engine_renders.mjs <baseline> <candidate> --report <path>`
  records each artifact's realpath, SHA-256, source commit, dirty state,
  Cmajor/JUCE pins, and Node/V8 runtime before rendering. Integration mode
  rejects the same realpath or identical bytes; a baseline-versus-itself run
  cannot qualify a change. It renders five canonical scenarios through two
  distinct builds and fails on the first non-identical sample (`Object.is`,
  so NaN and signed zero count). The
  scenarios cover idleness, an 8-note chord, the dropout-report patch, a
  stress patch at the product ceiling (3 oscillators x 8 unison, a
  10-device lane with a 3-band split, 12 routes with swept macros), and a
  transition gauntlet (mid-render program reinstall, mute toggles, drain to
  silence, retrigger, lane topology swap).
- `scripts/bench_engine_offline.mjs` reports wall-clock DSP cost as percent
  of realtime per scenario (`npm run bench:engine`).
- `npm run test:engine:determinism` uses the explicit `--self-check` mode to
  render one build twice. This proves deterministic replay, not integration
  equivalence, and the report labels it separately.

The gate caught two real bugs during this program — a stale first-attack
frame on mono retunes out of quiescence, and a drain counter that skipped
its own final zero pushes — both invisible to every existing suite. The
native renderer oracle (`run_three_oscillator_renderer_oracle.sh`) further
pins the C++/Wasm renderer to identical fingerprints.

## Measured results

One container (node/V8, x86, minimum of 3 reps; treat as relative — the
phone is measured with the web host's `?perf=1` HUD):

| scenario                    | before | after |
|-----------------------------|--------|-------|
| init-idle                   |  49.0% | 25.2% |
| init-poly8                  |  90.2% | 65.1% |
| shared-patch (dropout repro)| 115.9% | 76.1% |
| stress 3x8 + 10 FX + 12 rt  | 186.2% | 142.8% |
| transitions                 |  99.2% | 62.5% |

The final moving-master integration rerun used the distinct clean artifacts
from master `02159e0f` and candidate `a613512c` on arm64 macOS, Node
22.22.3/V8 12.4, again taking the minimum of three serial reps. Absolute load
is machine-specific; the paired result is the qualification evidence:

| scenario                    | master | candidate | reduction |
|-----------------------------|--------|-----------|-----------|
| init-idle                   |  15.8% |      8.2% |     48.1% |
| init-poly8                  |  28.3% |     19.7% |     30.4% |
| shared-patch (dropout repro)|  35.8% |     24.1% |     32.7% |
| stress 3x8 + 10 FX + 12 rt  |  52.0% |     39.0% |     25.0% |
| transitions                 |  30.6% |     20.0% |     34.6% |

The companion five-scenario render comparison authenticated different paths
and SHA-256 hashes, pinned the same Cmajor/JUCE sources, and found every output
sample bit-identical.

Per-device lane costs after this program (held note, same container, above
a 35.5% base): distortion +36, phaser +31, chorus +29, OTT +28, reverb +10,
flanger/delay/globalFilter ≈ +1. These are now dominated by
signal-dependent work (the 4x oversampled shaper pows, the phaser's
audio-rate sweep pow, OTT's detector logs) — honest costs under the
audio-rate contract.

## Consequences and next steps

- The always-advance posture for IN-CHAIN disabled devices (EffectsRack's
  ADR-005 note) is unchanged; devices outside the chain already cost
  nothing.
- Polish still processes at zero amounts. Bypassing it is NOT sample-exact
  (its 156-frame latency and warm detector state are audible contracts);
  any change there is a separate product decision.
- If phone measurements still want more after this program, the measured
  next tier is per-device: the phaser/chorus LFO trigonometry and OTT
  detector logs (approximation — leaves sample-exactness, needs its own
  ADR), or applying the compiled program per-route instead of per-lane in
  the voice vector application.
- Keep the gate in the loop: any engine change ships with a
  `compare_engine_renders` run against the previous build, and an
  intentional sound change replaces the fixture expectations consciously,
  never incidentally.
