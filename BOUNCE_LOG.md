# Bounce in Place implementation log

## 2026-08-23 — M0: Linux environment green

Baseline: `a80bdface7f10406d3e70aa2117086910b8b2017` on
`codex/bounce-in-place`.

- Read `BOUNCE_IN_PLACE_AGENT_HANDOFF.md` and
  `docs/reference/BOUNCE_IN_PLACE_FEASIBILITY.md` before implementation.
- Fetched the pinned Cmajor 1.0.3066 source (`172db532…`) plus patched CHOC,
  built the `cmaj` CLI, and built `cosimo_cmajor_external_codegen` on Linux.
- A four-job Cmajor build exhausted the Codespace's 7.8 GiB RAM and the
  compiler was killed. Serial builds completed reliably, so code-generation
  scripts now accept `COSIMO_CMAJOR_BUILD_JOBS=1` without changing the
  existing default.
- Ubuntu packages expose WASI preview 1 as `wasm32-wasi`, whereas the renderer
  script only understood Homebrew's `wasm32-wasip1`. The script now detects
  both layouts and checks linker support before using `--no-stack-first`.
  The shared-memory renderer inspection passed with LLVM 18.
- `npm run web:build` completed with the external renderer linked into the
  generated Cmajor WebAssembly product.
- The browser harness now uses pinned headless Playwright Chromium on Linux
  while retaining headed system Chrome on macOS. The functional web POC
  result was 13 passed, 5 skipped, 0 failed. Two pre-existing WebKit-only
  tests and three real-output performance tests were skipped; headless Linux
  has no realtime sink. An exploratory forced run showed valid continuous
  output but meaningless wall-clock load (including average load 0.683 and
  53 deadline misses in one mobile case), confirming the environment
  limitation rather than a product regression.
- `npm run test:modulation:routing` passed. `npm run test:units:orphans`
  passed all 68 tests when run outside the process-spawn sandbox; the one
  sandbox-only failure was a C++ compile/execute probe denied with `EPERM`.
- The web bundle contract initially exposed pre-existing worker growth from
  the Effects Lane dynamic-target baseline (`be5309e..367922d`), not M0 work:
  149,732 raw and 36,209 bytes with Node level-9 gzip versus stale ceilings
  of 145,000/34,900. The ceilings are now 151,000/36,600 (under 1.5%
  headroom), and all 14 bundle contract tests pass.

G1 baseline, committed in
`docs/reference/BOUNCE_M0_OFFLINE_SPEED.json`: three 3-second single-voice
runs measured 2.692×, 2.818×, and 2.798× realtime (2.798× median). The locked
19-root, 9-second-per-root default projects to 62.35 seconds serial or 15.59
seconds at ideal four-worker scaling. This is well below the five-minute
pivot threshold, so the locked default remains unchanged. Absolute timing is
informational because the Codespace CPU is shared.

Reproduction steps and exact toolchain paths are in
`docs/BOUNCE_CODESPACE_SETUP.md`.

## 2026-08-23 — M1: real amplitude release

- Replaced the compile-fixed `RetriggerableFixedASR(0.01, 0.20)` voice gate
  with a runtime release input and appended the public `ampRelease` host
  parameter after every pre-existing automation slot. Its locked range is
  0.005–10 s and its default remains 0.2 s.
- Generated/headless performers leave undriven value inputs at zero rather
  than applying endpoint annotations. Because zero is outside the public
  range, the engine treats it as the legacy 0.2 s default. This keeps
  isolated `SharedVoiceEngine` fixtures and hosted products identical.
- The runtime decay coefficient is cached and recomputed only when the
  release value changes. Idle/releasing voices do not add a per-sample
  transcendental calculation to the audio thread.
- Added `tests/test_bounce_amp_release.mjs`. A generated full-patch dry render
  proves that a 3 s release is still audible 2 s after note-off, and that the
  default path is sample-for-sample identical to an explicit 0.2 s release.
  The append-only endpoint order and annotations are also covered by the
  existing host-contract test.
- Updated the old host-order test because its assertion that Filter Mix was
  the final/sole append was no longer the correct contract. It now freezes
  the same legacy prefix and requires `filterMix`, then `ampRelease`.

Validation: 3/3 Bounce release tests; 65/65 Cmajor rack tests; 691/691 pure
Node tests; 34/34 modulation-routing tests; 14/14 web bundle tests; 27/27
patch/layout tests; and the Linux Chromium web POC at 13 passed, 5 expected
environment skips, 0 failed.

The post-M1 offline probe measured 3.725× realtime median and projects the
locked 19-root/9-second worst-case render at 46.84 s serial (11.71 s ideal
four-worker). The committed M0 run was 2.798×. Per the small-cloud-VM rule,
this cross-session absolute change is informational, not claimed as a speedup;
it provides no evidence of a regression and remains far below the explicit
five-minute pivot threshold. Mac/iOS performance must be measured separately.

## 2026-08-23 — M2: sampled source and staged bank residency

- Added deterministic `CSBNK001` stereo-i16 bank encoding plus a CLI converter
  for uncompressed integer PCM (8/16/24/32-bit) and IEEE-float (32/64-bit) WAV
  inputs. Mono is duplicated to stereo and multichannel inputs use the first
  two channels. Root ranges are strictly ascending, contiguous, and validated
  before PCM becomes visible.
- Appended `sourceMode` after every previous host parameter. Oscillator mode
  retains the committed M1 render SHA-256 exactly
  (`8d930510bc1f7e522b999a94cb36159bc2787a99844295838ae581f36a935561`).
- Implemented the Path-B `BounceBankStore` seam in pure Cmajor: session,
  generation, and gap-checked delivery serials; one acknowledged 6,000-frame
  batch in flight; staged metadata/PCM; explicit commit/abort; silence before
  commit; and active-slot latching per voice. An old slot is not reused while
  any one-shot voice still reads it.
- Correct atomic replacement requires two immutable 5,472,000-frame slots.
  Each slot is 19 roots × 6 s × 48 kHz = 20.9 MiB, so the correct double-buffer
  cost is 41.7 MiB rather than the feasibility note's single-slot ~19 MiB
  estimate. Generated memory grew from 96,010,240 to 139,853,824 bytes
  (+41.8 MiB including metadata/events), still below the browser budget. The
  first codegen attempt hit Cmajor's per-array element ceiling; splitting each
  slot into eight 684,000-frame chunks (the existing wavetable-pool pattern)
  fixed it. The production browser build passes, so this is not a B→A pivot.
- The sampler uses nearest-root selection with lower-root tie breaking,
  float64 position, 4-point interpolation, and per-sample rate
  `2^((voice-root)/12) * bankSR/liveSR`; glide and bend therefore act on the
  in-flight one-shot. It enters the existing per-voice filter/release path and
  keeps sampled segment activity in the voice-lifetime predicate.
- Playback applies the locked structural `1/0.18` (+14.9 dB) makeup before the
  shared trim. Separately, its amplitude gate is normalized around the locked
  capture velocity 100, so velocity 100 is the unity A/B path and other live
  velocities scale loudness. This avoids applying the capture velocity twice.
- Added generated-performer coverage for staging/readiness/abort, root A/B
  within one i16 step, trim makeup, nearest root, rate repitch, two-voice
  polyphony, velocity scaling, early release, legato glide, and the exact M1
  oscillator regression.

Path-B performance evidence: the committed full-capacity probe uploads a
20.9 MiB candidate in 912 ack-paced batches while an oscillator note remains
held. On this small VM it completed in 1,608 ms. Across 912 interleaved pairs,
control audio blocks were 0.801 ms p95 and upload blocks 0.797 ms p95, with
zero 2.667 ms deadline misses in either lane; host enqueue was 0.302 ms p95
and is outside the audio callback. Two adjacent pre-M2/M2 oscillator probes
measured 3.783×→3.702× (-2.16%) and 3.708×→3.689× (-0.50%), inside the 5%
paired-regression gate. Absolute VM timing remains informational; real
AudioWorklet output and Mac/iOS must be remeasured before a platform claim.

Validation: production `web:build`; 6/6 sampler tests; 3/3 bank-format tests;
3/3 amplitude-release tests; 65/65 Cmajor rack tests; 691/691 pure Node tests;
34/34 modulation-routing tests; 14/14 web bundle tests; 27/27 patch/layout
tests; and Linux Chromium web POC at 13 passed, 5 expected environment skips,
0 failed. The headless worklet's absolute load/deadline telemetry is not used
as a hard gate because this VM has no realtime audio sink.

## 2026-08-23 — M3: deterministic worker-based offline capture

- Added the append-only `engineStatus` event. It is emitted once from DSP
  time using `processor.frequency`; a generated performer initialized at
  44.1 kHz reports exactly 44,100 Hz, so capture does not infer native or web
  engine rate from a device preference.
- `web:build` now emits `cmaj_Cosimo_Synth.offline.js`, a class-only canonical-
  renderer performer with no AudioWorklet import, and a dedicated 9.66 kB
  (3.42 kB gzip) `bounce-render-worker.js`.
- Added immutable button-press snapshots and a platform-neutral plan with the
  locked 24–96/every-4-semitone roots, velocity 100, 3 s hold, 6 s tail cap,
  live sample rate, frozen tempo, 128-frame offline blocks, and −80 dBFS
  truncation. Structured runtime events are cloned, ordered, and can be
  session-scoped for each fresh performer.
- The primary browser driver runs one short-lived worker per root with one
  fresh performer/session, bounds concurrency to 1–4, transfers i16 PCM back
  without a copy, terminates each wasm instance promptly, and cancels every
  peer if any root fails. The pool preserves root order regardless of worker
  completion order.
- Each root renders the complete chain through note-off and the full tail cap,
  then retains the last audible 50 ms RMS window plus 100 ms padding. Capture
  is never normalized. The exact stereo-i16 bank bytes are SHA-256 digested;
  the Cmajor 5,472,000-frame residency ceiling is now shared and checked at
  both bank creation and install boundaries.
- Added a committed A/B definition: independently peak-normalized stereo RMS
  over 50 ms windows, omitting only windows below the same −80 dBFS tail
  floor; mean absolute difference must be <1 dB and no window may exceed 3 dB.
- The real generated engine captured pluck, pad with serial delay+reverb, and
  nonlinear OTT fixtures at roots 48/60/72 in Node worker threads. Each bank
  was installed into a fresh sampled performer and every root passed. Mean
  deltas were 0.001–0.003 dB; worst-window deltas were 0.092–0.222 dB. Every
  pad root retained audible baked output at least one second after note-off.
- Two independent fresh-worker renders of the same snapshot/root produced
  identical bank bytes and digest. Example fixture digests were
  `daa662a6…` (pluck), `e7b42f3c…` (pad), and `80c67e10…` (OTT).

G1 evidence on this small cloud VM: measured per-root offline throughput was
4.146–4.225× realtime for pluck, 3.428–3.477× for delay+reverb pad, and
3.152–3.324× for OTT. Using the slowest measured 3.152× value, the locked
19-root × 9-second worst-case plan projects to about 54.3 seconds serial,
well below the five-minute pivot trigger; bounded parallelism can reduce wall
time further. These absolute values are informational rather than a hard
Mac/iOS verdict. Relative regressions, callback deadlines, architecture, and
bounded memory are the VM gates; a real sink and Mac/iOS validation remain in
M8/HUMAN_VALIDATION.

Validation: production `web:build`; 3/3 planner/segmenter tests; the full M3
worker/engine/determinism/three-patch A/B test; 3/3 bank-format tests; 3/3
amplitude-release tests; 6/6 sampled-source tests; and 15/15 web bundle tests.

## 2026-08-23 — M4: two-phase flip and exact single-level Revert

- Added strict `cosimo.patch-document` and `bounce.v1` schemas. The Bounce
  document records the SHA-256 digest, encoded byte length, ordered roots,
  contiguous segment offsets/counts and note-off offsets, capture sample rate,
  frozen tempo, velocity/hold/tail policy, monotonic Bounce generation, and a
  single revert reference containing the complete pre-bounce patch document
  plus the prior bank digest when recursive.
- The neutral fresh-layer projection changes only what can color the baked
  source twice: Source Mode becomes Bounce, the live voice filter becomes
  Off, modulation routes are cleared, all Effects Lane devices are disabled,
  articulation route amounts and filter overrides are cleared. Oscillator
  parameters remain stored but inert. MSEG shapes/playback, ENV parameters and
  names, macro names/values, play mode, glide, effect parameters, oscillator
  parameters, and all other host values are preserved. Revert restores the
  original canonical patch document exactly.
- Added the transactional coordinator. Capture → digest validation → durable
  write → inactive-slot live upload → offline sanity verification all finish
  before publication. A single final callback queues bank commit, the neutral
  runtime state, `sourceMode`, and `bounce.v1`. The candidate slot is aborted
  on every earlier failure or cancellation.
- Added the live bank driver around M2's protocol: authoritative DSP session
  and sample rate readback; begin-state confirmation; one 6,000-frame batch in
  flight; exact ack correlation; nonblocking sends; progress; explicit
  commit/abort; timeout, DSP rejection, and transport errors. `engineStatus`
  now includes `processor.session` and has an explicit request input so a host
  attaching after initialization cannot miss the one-shot status event.
- Added a live patch-document adapter which snapshots every parameter from
  status/readback plus `modulation.v6`, `articulations.v4`, `lane.v1`, and
  `bounce.v1`. Writes queue Source Mode last after parameters and structured
  documents so the selected source has a committed bank and neutral layer.
- Automated failure gates prove that mid-worker cancel, a mismatched digest,
  an install-ack timeout, and verification failure perform no patch-document
  write. Verification failure also aborts the staged inactive bank. The
  generated Cmajor performer itself passed the status → staged batch → commit
  path (session 42, 48 kHz, generation 1, four active frames), not only the
  transport fake.

Validation: production `web:build`; 5/5 transition/atomicity/Revert tests;
4/4 live-install/document-adapter tests; 6/6 sampler tests; and 15/15 web
bundle tests. Oscillator audio remains bit-identical to the M1/M2 pinned hash.

## 2026-08-23 — M5: content-addressed persistence and safe restore

- Added a browser `BounceBankStore` with OPFS as the primary backend. A bank
  is SHA-256 checked before write, written to a unique same-directory staging
  file, reopened and checked, atomically renamed to
  `bank-<digest>.csbk`, and checked again through its published name. Existing
  content is idempotent. IndexedDB is the capability-only fallback; quota and
  integrity failures remain visible rather than being disguised by fallback.
- Browser reload keeps `sourceMode` at the safe oscillator default until the
  user starts audio, the referenced bytes and all `bounce.v1` metadata verify,
  the current DSP session is read back, and an inactive bank slot commits.
  Persisted semantic generations are separated from engine-local FIFO
  generations, so a restored bank cannot make a later recursive operation
  stale. The same verified digest is not redundantly reinstalled.
- Runtime safety writes no longer mutate durable parameter intent. In
  particular, a host readback of the temporary source-mode default and a
  missing-bank oscillator fallback cannot overwrite saved sampled mode. A
  later explicit user write still persists normally.
- Missing, corrupt, mismatched-length, and invalid-document restores expose a
  typed error. The web host presents a persistent `role=alert` stating that
  oscillator fallback is active instead of displaying a working sampled UI
  over silence.
- Added the required synth preset adapter. Presets carry only canonical
  `bounce.v1` metadata/digest; PCM remains out of localStorage, JSON, and
  Cmajor stored state. Init produces `bounce.v1: null`. Migration paths add
  that null value to pre-Bounce presets and compose with the older pre-filter-
  Mix migration.
- Locked the native design in `docs/BOUNCE_NATIVE_PERSISTENCE.md`: the existing
  `group.dev.cosimo.wavetable-synth` App Group on iOS/AUv3, Application
  Support on desktop, verified atomic content files, lifecycle/session rules,
  conservative retirement, and an opt-in binary JUCE/DAW chunk for project
  portability without base64.

The Chromium end-to-end proof wrote a 5-second stereo bank through real OPFS,
reloaded the page, restored it through the generated AudioWorklet bank
protocol, and measured audible sampled output. The entire test case took
about 2.2 seconds on this VM and launched zero Bounce render workers after
reload. The missing-bank case reached its visible typed fallback in about
1.3 seconds and retained the recoverable digest/source intent. These are
functional observations, not Mac/iOS performance claims; absolute VM timing
remains advisory.

Validation: production `web:build`; 2/2 Chromium persistence/reload tests;
5/5 persistence/preset unit tests; 39/39 combined persistence, transition,
preset-migration, and web-bundle tests; 692/692 pure Node tests; and the full
Linux Chromium web POC at 13 passed, 5 expected environment skips, 0 failed.

## 2026-08-23 — M6: product capture UI, source presentation, and quality gates

- Added the product Bounce controller and connected the complete M3/M4/M5
  transaction to both UI layouts. Bounce takes immutable parameter and
  structured-document reads at the confirmed press, asks DSP for its actual
  sample rate **and current host tempo**, prepares factory tables plus
  modulation/articulation/Effects Lane runtime state, renders in background
  workers, persists, stages, verifies, and only then publishes the sampled
  document. Never-edited omitted stored documents resolve to their canonical
  product defaults after a full-state reply, not during a hydration race.
- Factory wavetable preparation deduplicates identical A/B/C selections and
  preserves shared typed-array aliases in the capture snapshot. Source FFT and
  mip work yields every eight frames, reports preparation progress, and checks
  cancellation throughout instead of monopolizing the browser main thread.
  Velocity-mode articulation at the locked capture velocity 100 now emits a
  root-scoped `articulationNoteMeta` immediately before each worker note-on;
  Chain/Key live external selection is intentionally not invented from patch
  state that does not contain it.
- Desktop swaps `DesktopOscillatorPresentation`'s source-stage slot for a PCM
  waveform; compact swaps the focused-editor slot. The waveform uses a
  peak-preserving stereo envelope for the root nearest the last intentional
  note, with lower-root tie breaking, root markers, digest, recorded duration,
  missing-bank alert, and Revert. The locked 393×852 proof has no document
  overflow, keeps the stage within viewport bounds, and reserves at least
  220 px of waveform height.
- Added Bounce progress for preparation, roots, live-bank frames, validation,
  persistence, install, verify, and flip, plus cancellation from the first
  preparation paint. Cancellation/failure leaves Source Mode and durable state
  unchanged. A coordinator settlement fix now publishes `busy=false` after
  successful cleanup rather than leaving the control stuck at 100%.
- Bounce reuses the synth preset controller's existing unsaved-sound choke
  point. The dialog says exactly `Save and Bounce` / `Discard and Bounce`;
  cancellation runs no continuation, and only the currently confirmed
  press-time continuation can start capture.
- Oscillator performance and unison controls remain visible but are inert,
  grey, and explained as baked. Oscillator modulation destinations disappear
  from both desktop and compact pickers; a transient existing row is itself
  inert/grey and labelled Baked. Filter, ENV, MSEG, macros, Play Mode, Glide,
  and fresh-layer rack/modulation destinations remain live. The articulation
  surface explicitly distinguishes baked oscillator overrides from live
  filter/MSEG/ENV overrides.
- The browser restorer accepts a document already verified and committed by a
  live transaction before the `bounce.v1` stored-state echo, preventing a
  duplicate bank upload race. An explicit regression proves the echo performs
  zero storage reads and zero stage calls.
- A held-note Source Mode change had a real click edge: the old implementation
  changed readers in one frame. Added a fixed 192-frame (4 ms at 48 kHz)
  fade-down/swap/fade-up. It uses fixed scalar state and bounded 16-voice work,
  with no allocation or lock on the audio thread; leaving sampled mode also
  releases paused readers so an old immutable bank slot cannot remain pinned.

G2 browser evidence, using paired 256-block held-note AudioWorklet windows:
pre-install oscillator average load was 0.50830; sampled load was 0.44385;
post-Revert oscillator load with the bank still resident was 0.50537, a
−0.58% relative change and inside the ≤10% gate. Sampled/resident windows
added no deadline misses versus the adjacent VM baseline (0 and 6 versus 8).
The headless clock was `Date.now` and individual absolute windows contained VM
scheduling misses, so those absolute values are advisory rather than a Mac/iOS
performance verdict; the relative bank-residency comparison is the gate.

G4 evidence: the committed generated-performer script renders a deliberately
near-peak 0.12-FS/440-Hz held sample across Bounce→Oscillator→Bounce and through
note-on/off. Maximum stereo inter-sample step was 0.00692749 FS (−43.19 dBFS),
below the justified isolated-click ceiling of 0.01000 FS (−40.00 dBFS).

The Chromium product proof cancels one real attempt, completes a second through
exactly one new worker, verifies durable `bounce.v1`, audibly plays root 60,
checks inert controls, resizes the same sampled state to desktop and 393×852,
then Reverts to exact oscillator intent and clears the reference. Including
the G2 windows it took about 7.2 seconds on this small VM; the duration is
informational only.

Validation: production `web:build`; 6/6 capture planner/recipe/segmenter tests;
the full worker determinism/three-patch A/B test; 7/7 sampled-source tests;
4/4 live-install tests; 6/6 persistence/preset tests; 15/15 synth Init/dirty-
guard tests; Bounce preset-bar browser assertions; 1/1 PCM waveform test;
1/1 real M6 Chromium UI transaction; 693/693 pure Node tests; 34/34 modulation
routing tests; 17/17 web-bundle tests; 27/27 patch/layout tests; 65/65 Cmajor
rack tests; and the full Linux Chromium web POC at 13 passed, 5 expected
environment skips, 0 failed. Oscillator mode retains the pinned M1/M2 render
hash exactly.
