# Sound-Speedrun Video + URL Sharing Log

## 2026-08-24 — M0: merged baseline green

### Effects Lane synchronization

- Started from `codex/speedrun-video-share` at `6ce638a6`.
- Merged the required `origin/claude/effects-lane-m1` commit `90e9a288`
  without rebasing. The resulting merge is `41763372`.
- Re-fetched at the M0 boundary and merged the then-current Effects Lane tip,
  range `90e9a288..fe1e9e7d`, in merge `7aa7ec0f`. Regenerated shared modules
  are committed as `8564ed46`.
- No Effects Lane feature work was completed, fixed, or extended on this
  branch. One stale lane-v1 browser-test assertion was updated to observe the
  merged lane-v2 contract (`rack.v2.chain[0].deviceId`); product lane code was
  left to its owning branch.

### Conflict inventory and generated output

- The required merge conflicted only in generated outputs:
  `patch_gui/desktop/app.js`, `patch_gui/desktop/app.js.map`,
  `patch_gui/index.ios.js`, `patch_gui/index.ios.js.map`, and
  `patch_gui/wavetable-worker.js`. The later tip sync conflicted in the
  generated desktop bundle and source map.
- Generated conflicts were not hand-merged. A temporary side was selected,
  then the desktop, iPhone, production-worker, Bounce-worker, and test-worker
  outputs were regenerated from the merged sources.
- The automatic merge in `ui/shared/effects/synth-init-state.ts` and
  `tests/test_synth_init_state.mjs` was reviewed. It retains the Bounce
  adapter while making `lane.v2` the canonical rack state and upgrading
  `lane.v1` input at the boundary.

### Merge residue repaired

- The intended lane-v2 worker payload measured 157,762 raw bytes / 38,295
  gzip bytes. The frozen bundle ceiling was raised only to 160,000 / 38,800,
  leaving about 1.5% headroom around the measured merged payload.
- The desktop preset assertion was updated for the merged Bounce adapter: a
  fresh preset contains the `bounce.v1` slot with a null value.
- The Bounce resident-bank G2 check was flaky because it compared a cold
  1280px baseline with a post-phone-layout 393px sample using an integer-ms
  AudioWorklet clock. The product threshold remains 10%. The test now warms
  both sides, restores the same viewport, and applies the same test-only 2x
  DSP multiplier to lift real work above timer quantization. Five consecutive
  focused passes stayed about 4–7% above baseline with zero deadline misses;
  the combined Bounce UI/waveform suite passed 3/3.
- `test:web:poc` previously launched Chromium and WebKit in parallel but a
  bare shell `wait` could report only the final job status and hide the other
  browser's failure. It now captures and checks both process statuses. The
  corrected authoritative command passes in both engines.

### Green baseline evidence

- State and JavaScript suites: orphan units 708/708; effect presets 113/113;
  Bounce fast-path suites 31/31; Bounce persistence 12/12; Web bundle 17/17;
  desktop UI 218/218; iPhone UI 20/20; browser orphans 117 pass plus one
  expected native-keyboard skip; lane/init/modulation focused gates 96/96.
- Generated browser product: Chromium and WebKit each pass 16 with two
  expected skips; modulation routing passes 34/34.
- Native/runtime: all four `test:bounce:native` stages pass; Cmajor rack
  73/73; native QuickJS passes its seven pytest cases plus content,
  Promise-job, and worker-restore checks; synth engine renderer/provider/
  hard-cut gates pass; warp-alias 3/3 and filter-stability 18/18.
- Adjacent production views: OTT 19/19 and SeqFX 7/7.
- `npm run ios:ui:build` plus desktop, production-worker, Bounce-worker, and
  test-worker generation complete successfully and reproducibly.
- A direct `npx tsc --noEmit` probe is not a repository gate and remains red
  on pre-existing Bounce `.mjs` declaration gaps and an existing cast in
  `use-bounce`. There is no `typecheck` package script. The owned generation
  paths and all repository suites above are green; this unrelated type-probe
  residue is not expanded under M0.

### M0 decisions

- Merge the active Effects Lane tip instead of repairing its exact-baseline
  behavior locally, preserving ownership and the required merge-only sync.
- Keep the Bounce 10% product gate unchanged and repair only its measurement
  comparability.
- Treat runner exit-status propagation as part of the acceptance gate so a
  future single-engine regression cannot be reported green.

Next: re-check the Effects Lane tip at the M1 boundary, then ship URL patch
sharing before beginning the video renderer spike.

## 2026-08-24 — M1 boundary Effects Lane sync

- Fetched the owner branch and merged `fe1e9e7d..412a2a87` without rebasing.
  The incoming T6b slice makes selection, parameter bindings, map actions,
  and modulation base controls address lane device instances.
- Generated conflicts: `patch_gui/desktop/app.js` and map,
  `patch_gui/index.ios.js.map`, and `patch_gui/wavetable-worker.js`. They were
  replaced by fresh desktop, iPhone, production-worker, Bounce-worker, and
  test-worker generation from the resolved sources.
- Source conflict: `ui/desktop/mobile-mod-mappings-panel.tsx`. The resolution
  preserves Bounce's oscillator-route inertness while threading T6b's parsed
  lane `deviceId` into each instance binding. No Effects Lane behavior was
  added beyond retaining both owners' already-implemented paths.
- Merge residue: an older browser assertion still required pool instances to
  be amount-only. It now observes T6b's current contract (each parsed instance
  exposes the type's base rail) and uses DOM text rather than layout-dependent
  `innerText` so content-visibility cannot erase the label under sharding.
- Green sync gates: focused lane/init units 40/40; subway + Bounce browser
  gates 11/11; full desktop browser suite 221/221; modulation runtime 34/34;
  generated Chromium and WebKit suites each 16 pass with two expected skips.

URL-sharing implementation begins from Effects Lane tip `412a2a87`.

## 2026-08-24 — M1 URL sharing and boundary status

- Shipped strict `cosimo.soundShare` v1 envelopes at
  `#p=1.<deflate-base64url>`, using native browser compression with bounded
  decode, corruption/version rejection, 2,000-character warning, and
  8,000-character refusal.
- Share capture uses the current preset-v2 contract plus the canonical lane
  document, refuses sampled/Bounced sounds, and loads through the existing
  sound transaction. A successful shared load becomes an unnamed clean
  baseline whose Revert target is the shared sound; the fragment is removed
  only after acceptance.
- Desktop and compact layouts expose Share. Opening a link requires the
  explicit `Load shared sound?` confirmation and then uses the existing
  Save/Discard/Cancel dirty guard when necessary.
- Fast-check round trips, strict-boundary tests, controller tests, and the real
  fresh-browser-context link flow pass 28/28. The full desktop suite passes
  222/222; browser orphans pass 117 with one expected native probe skip;
  iPhone UI passes 20/20; shared hooks pass 34/34; effect presets pass 113/113;
  and orphan units pass 708/708.
- The broad browser run exposed one dialog regression: pending Init state was
  temporarily rendered with generic Load copy. Commit `3ee6de12` preserves the
  Init-specific guard while still naming confirmed preset/share operations.

### Effects Lane boundary synchronization and blocker

- Merged `412a2a87..5733b556` in `116e4c42`, regenerated every generated
  desktop/iPhone/worker conflict, and preserved the incoming T6/T7 instance
  contract without adding owner-branch behavior. One source-test conflict kept
  both the incoming instance behavior and the existing layout-independent text
  assertion.
- Re-fetched at the boundary and merged the T7 close-out
  `5733b556..0a0eba9c` in `190bc903`; it changed only the owner plan document.
- The existing Bounce G2 relative-load gate is now reproducibly red after the
  T7 three-device starter became the fresh default: three isolated measurements
  put a resident bank about 22–31% above the fresh oscillator baseline versus
  the frozen 10% limit, with zero misses. Bounce/Revert behavior and the ten-
  cycle retirement gate remain green. `BLOCKED.md` contains exact reproduction
  and measurements.
- Decision: do not alter the Effects Lane default and do not weaken/mask the
  Bounce threshold. Under the handoff's stuck protocol, continue the
  non-dependent renderer spike while this boundary incompatibility remains
  explicit.

## 2026-08-24 — M2 browser renderer spike

- Pinned `remotion`, `@remotion/media`, and `@remotion/web-renderer` to exact
  version 4.0.491 and Mediabunny to the renderer-matched 1.50.8.
- Added the committed throwaway experiment at
  `experiments/remotion-web-renderer-spike/`: 10 seconds / 300 frames / 30 fps /
  640x360, with a moving SVG knob, frame-driven canvas wavetable, changing text,
  and one deterministic stereo PCM16 WAV passed as a blob URL to one `<Audio>`.
- The gate calls `renderMediaOnWeb` inside headless Chromium, then independently
  demuxes the returned Blob. A qualifying run produced a 372,884-byte MP4 in
  2,142 ms with duration 10.0693 seconds, exactly one AVC/H.264 video track and
  one AAC audio track. The decoded five-second pulse had RMS 0.18532 across
  15,360 frames; decoded video had minimum luma variance 487.95 and mean frame
  difference 5.00.
- The first run successfully reached MP4 verification but the verifier omitted
  Mediabunny's required `fit` option when requesting both decoded-frame
  dimensions. `fit: "fill"` repaired the verifier; neither blob-URL audio nor
  MP4 encoding needed a fallback.
- Decision: F2 stays one pre-spliced blob-URL WAV and F3 stays
  MP4/H.264/AAC on Chromium. Encoded byte identity is logged, not gated.
- Added `docs/SPEEDRUN_VIDEO_BROWSER_RENDERING.md`: a human must resolve
  Remotion licensing and production telemetry/key posture before public ship.

## 2026-08-24 — M3 pure pipeline core

- Built strict patch intake against the generated current synth contract: 96
  visible parameters plus modulation v6, articulations v4, and the current
  instance-based lane v2 tree. Sound-share, preset-v2, browser-patch-v2, bare
  document, and live-capture inputs normalize to one complete patch model;
  corrupt structured state and sampled/Bounced sounds fail with typed errors.
- The analyzer reports only audible facts. It respects oscillator mute/solo and
  level, keeps articulation-only modulation routes, walks Effects Lane display
  and effective order through groups, and addresses repeated devices by dynamic
  targets such as `lane.delay#2.delayMix`. Omitted-state reasons remain
  inspectable even though they do not become video acts.
- The deterministic recipe compiler orders source, oscillator, filter, and
  effects acts; caps visible captions at eight while retaining every operation;
  and emits a neutral prelude for structured state that must exist before its
  audible edits are demonstrated. That prelude preserves inactive devices and
  inert route metadata rather than rewriting Effects Lane behavior.
- Cumulative states implement the plan's sole checkpoint neutralization rule:
  not-yet-demonstrated and never-demonstrated oscillators are muted until their
  sections complete. Timeline assembly uses exact 30 fps / 48 kHz authority
  (1,600 samples per frame), the specified pacing table, a 90-second ceiling,
  and deterministic three-level compression.
- The checked-in current-contract fixture contains disabled `distortion#1` plus
  active `delay#2` and `reverb#1` inside enabled `split#1`, including an
  instance-aware modulation target. Its golden recipe, complete replay, and
  partial-state checkpoints pass without modifying Effects Lane code.
- `npm run test:speedrun:core` passes 14/14, including 75 fast-check randomized
  audible-patch round trips. Direct module bundles pass. The repository-wide
  TypeScript probe still reports pre-existing declaration gaps outside this
  milestone; filtering the probe to `ui/speedrun` reports no owned errors.

### M3 boundary decision and synchronization

- Fetched `origin/claude/effects-lane-m1` after the M3 gate. Its tip remains
  `0a0eba9c`; no merge was required. The pipeline continues to consume that
  topology as input and does not fix, complete, or extend Effects Lane.
- Decision: preserve complete normalized state in the recipe prelude while
  demonstrating only audible facts in sections. This makes exact reconstruction
  and checkpoint rendering compatible without presenting hidden state as a
  user-visible speedrun action.

## 2026-08-24 — M4 checkpoint audio

- Added `OfflineEngineHost`, a production `PatchConnectionLike` adapter over
  the existing class-only Cmajor performer. It writes all cumulative parameters,
  serves modulation v6 / articulations v4 / lane v2 stored state, drains output
  events after every <=128-frame advance, and runs the real wavetable,
  modulation-articulation, and rack worker services before a note is captured.
- Checkpoints use the existing Bounce worker pool unchanged: one short-lived
  worker and fresh performer per cumulative state, bounded to four workers and
  explicitly using `hardwareConcurrency - 2` for speedrun concurrency. The
  speedrun worker speaks Bounce's existing render-root protocol and transfers
  its Float32 PCM buffer back to the pool owner.
- Selected factory sources are fetched and decoded once before virtual-time
  installation, then structured-cloned as an immutable resource bundle to each
  checkpoint worker. This keeps asset I/O outside the four-second virtual
  install bound while every worker still independently builds and installs the
  production mip image.
- The first real Chromium pass exposed a generated-performer re-entrancy rule:
  dispatching an output acknowledgement before resetting its output FIFO let
  the listener's next mip input disappear. The adapter now copies and resets
  each output FIFO before invoking listeners. A pure regression test pins that
  order; the real service matrix then completes all three tables in 26,880
  virtual install frames.
- Performance MIDI is scheduled at exact sample offsets, cycles at its declared
  duration, and carries current articulation selectors when configured. Every
  section captures its exact duration plus a 90 ms tail. The master assembler
  places sections at timeline sample offsets, applies 90 ms equal-power
  crossfades, fades the final 15 video frames, emits deterministic stereo PCM16
  WAV, and hashes the Float32 master with SHA-256.
- Chromium and WebKit both pass exact repeat PCM/master digests, non-silence,
  oscillator-A to oscillator-A+B RMS growth, current `delay#2` split-lane tail
  growth, and low-pass spectral-centroid reduction. A poisoned source fails as
  typed `SpeedrunInstallError: wavetable install failed` instead of hanging.
- Measured Chromium fixture: four 2.09-second checkpoints = 8.36 seconds of
  rendered audio in 1,217.2 ms wall time with two workers, or 6.87x aggregate.
  Individual fresh-worker throughput was 3.57x, 3.58x, 3.62x, and 3.64x
  realtime, above the handoff's conservative 2.7x budget figure.
- Green gates: M4 audio 6/6; M3 core 14/14; Bounce capture 8/8; Web bundle
  contract 18/18; owned TypeScript probe clean. The existing Bounce G2 boundary
  red remains separately documented and was not changed.

### M4 boundary decision and synchronization

- Fetched `origin/claude/effects-lane-m1` after the M4 gates. Its tip remains
  `0a0eba9c`; no merge was required and no Effects Lane implementation changed.
- Decision: use the current worker-service stack rather than replaying a second,
  speedrun-specific approximation of lane/modulation installs. This makes
  repeated-device and group behavior an observed pipeline input while Bounce's
  proven pool remains the sole worker lifecycle owner.

## 2026-08-24 — M5 frame-pure composition

- Added the purpose-built `SpeedrunPhoneUI` Track 1 composition at
  1080x1920/30 fps. It recomputes navigation, parameter interpolation,
  current lane devices, modulation routes, captions, and gesture geometry
  solely from `(recipe, timeline, frame)`; it never drives the live patch
  view or retains presentation state across seeks.
- The replica reuses production leaf visuals rather than copying their
  drawing laws: `ParameterKnobArtwork`, `SegmentedEditorTabs`, the shared
  wavetable renderer, MSEG buffer rendering, current rack descriptors, shared
  fonts, and design tokens. Repeated identities such as `delay#2` remain the
  UI and route keys from the merged lane.v2 recipe.
- Added deterministic navigation/tap/horizontal-edit/map-route gesture scripts
  over a static 393x852 surface map. The finger, route ghost, target capture,
  knob state, and caption waterfall are all direct integer-frame projections.
- The composition uses the pre-spliced master WAV as one blob-URL `<Audio>`.
  The real MP4 alignment fixture exposed 1.36–1.50 frames of decoded AAC
  priming when left uncompensated. Trimming one silent lead-in frame at the
  composition boundary reduced all three measured onset errors to
  0.36–0.37 frames, inside the frozen +/-1-frame gate without moving visual
  events or changing the master PCM.
- Checked in exact Chromium PNG goldens for all six current-contract section
  boundaries plus the end card. Seeking away and back to the same active
  frame produces byte-identical pixels; the harness also verifies production
  canvas/knob leaves are present.
- The rendered 3.413-second alignment MP4 has one AVC track and one AAC track.
  Caption lines become visible on frames 10/14/18; decoded click onsets land at
  frames 10.374/14.374/18.363. The end card contains only the patch name and
  "Made with Cosimo"; no share URL is baked into pixels.

### M5 decision

- Kept the handoff's primary frame-pure replica path. The real patch-view
  fallback was not attempted because the selected path passed frame purity,
  current-lane fidelity, screenshot, and real MP4 A/V gates.
- Fetched `origin/claude/effects-lane-m1` after all M5 gates. Its tip remains
  `0a0eba9c`; it is already an ancestor, so no merge or Effects Lane change was
  required.

## 2026-08-24 — M6 browser studio

- Added a standalone `/speedrun/` studio rather than coupling the pipeline to
  either shipped synth surface. It accepts the current browser sound, a preset
  file, or an M1 share link; accepts Standard MIDI Files (format 0/1) or the
  built-in performance; and keeps download plus copy-share actions adjacent.
- The studio owns one disposable pipeline session. Preparation normalizes the
  current sound contract and compiles its recipe/timeline; audio rendering uses
  the M4 short-lived worker pool; video rendering sends the single assembled
  WAV blob URL to the M5 composition. Both long stages report progress and
  support cancellation without leaving a live render or worker behind.
- MP4/H.264/AAC is the preferred Chromium path. WebM/VP9/Opus is offered only
  when its complete encode/decode contract is available. A result is withheld
  until Mediabunny proves the requested container, exactly one video and one
  audio track, the expected codecs and duration, and non-silent decoded audio
  inside every audible section window.
- The production-built end-to-end gate uploaded `demo/one_note.mid`, rendered a
  3.3667-second current patch into a 288,759-byte, 3.4347-second AVC/AAC MP4,
  and measured minimum per-section decoded RMS 0.01149. A second current
  lane.v2 fixture retained active `delay#2` and `reverb#1` inside `split#1` and
  produced a 347,597-byte, 3.9467-second AVC/AAC MP4 with minimum section RMS
  0.005759. The gate also proves blob signatures, download/share actions,
  clipboard text, and cancellation.
- Green gates: end-to-end pipeline 2/2; MIDI intake 5/5; composition 3/3;
  checkpoint audio 6/6 across Chromium and WebKit; pure core 14/14; URL sharing
  28/28; effect presets 113/113; shared hooks 34/34; iPhone 20/20; Bounce
  capture 8/8; Web bundle 18/18; orphan units 712/712; desktop browser 222/222;
  browser orphans 117 passes plus one intentional skip.
- A direct repository-wide TypeScript probe remains red only at pre-existing
  Bounce `.mjs` declaration gaps and a sound-share TypeScript 6 DOM mismatch;
  no M6-owned diagnostic appears. The repository's owned build and test gates
  above are authoritative for this milestone.

### M6 boundary decision and synchronization

- Fetched `origin/claude/effects-lane-m1` after all M6 gates. Its tip remains
  `0a0eba9c`; it is already an ancestor, so no merge or Effects Lane change was
  required.
- Decision: keep the speedrun studio as a disposable browser-only orchestrator
  over existing product contracts. It does not add video concerns to the live
  synth, duplicate DSP/runtime services, or expose an unverified encoded blob.

## 2026-08-24 — M7 duration, fallback, lifetime, and delivery seal

- Added a maximal fixture generated from the current performer contract: all
  96 public parameters, all 1,131 legal modulation mappings, all 8 current
  effect types, all 3 audible oscillators, and 13 modulation sources. Its 22
  sections retain all 1,282 reconstruction operations.
- The fixture's uncompressed presentation is 30,181 frames. Deterministic
  pacing level 3 brings the default result to exactly 2,700 frames / 90
  seconds; the 30-second policy reaches exactly 900 frames without removing a
  section or reconstruction operation.
- Video pacing and sound-share URL compression are independent contracts. The
  maximal fixture's 226,952-byte raw share carrier deflates to a 15,011-character
  candidate URL, so Copy Share reports typed `URLTooLong` under the 8,000-
  character limit while analysis, checkpoint audio, and video rendering remain
  available. Oversized-link refusal cannot block the video pipeline.
- Added a real fallback render gate. Chromium produced an 84,409-byte,
  1.76-second WebM with exactly one VP9 video track and one Opus audio track;
  decoded audio is non-silent (minimum fixture RMS 0.01199) and the EBML
  signature, duration, tracks, and codecs verify before download exposure.
- Five consecutive full audio-plus-video cycles leave zero checkpoint workers
  alive after each job, exactly two live product object URLs after each settled
  render, and zero URLs after session disposal. The run created five workers
  total with peak concurrency one. Settled post-GC heaps spanned 1,475,356
  bytes; the permanent 128 MiB ceiling stays deliberately conservative across
  browser and encoder variation while still rejecting unbounded retention.
- Added `ui/speedrun/README.md` with the standalone development and production
  paths, inputs, cancellation/lifetime rules, format behavior, verification
  commands, and the public-shipping license hold. Updated the renderer note with
  the production MP4/WebM and five-render evidence.

### Final gate seal

- Speedrun hardening 2/2; browser pipeline 5/5; pure core 14/14; composition
  3/3; MIDI intake 5/5; checkpoint audio 6/6 across Chromium and WebKit; URL
  sharing 28/28; Bounce capture 8/8; Web bundle 18/18; effect presets 113/113;
  shared hooks 34/34; iPhone UI 20/20; orphan units 712/712; desktop browser
  222/222; browser orphans 117 passes plus one intentional native-keyboard
  skip. Desktop and iPhone generated bundles were rebuilt deterministically.
- The separate Bounce G2 boundary gate remains explicitly red at about 22–31%
  resident-bank overhead versus the frozen 10% limit, with zero misses. It is
  unchanged, is not hidden by the green speedrun seal, and remains documented
  in `BLOCKED.md` for its owning lane/Bounce work.
- Final boundary fetch found `origin/claude/effects-lane-m1` unchanged at
  `0a0eba9c`; it is already an ancestor. No merge and no Effects Lane product
  change were required.

### M7 decisions and remaining human action

- Keep video rendering independent from optional link copying. A sound that is
  too large for a safe URL remains fully eligible for local video export.
- Keep verified MP4/H.264/AAC primary and expose verified WebM/VP9/Opus only as
  a labeled fallback; never silently substitute containers.
- Keep the studio isolated from shipped synth surfaces, keep encoded blobs
  hidden until media verification passes, and retain the conservative 128 MiB
  lifecycle bound rather than tightening it to the single-machine observation.
- Technical delivery is complete. Before public ship, a human must confirm the
  applicable Remotion license and production telemetry/key configuration. The
  Effects Lane/Bounce G2 boundary blocker remains separate owner work.
