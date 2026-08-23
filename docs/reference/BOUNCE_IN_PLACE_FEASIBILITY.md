# Feasibility Study: Bounce in Place for Cosimo

Independent adversarial study. All references are repo-relative at commit
`bc0f363` (the analysis was performed in a detached worktree at that HEAD;
the probe `PROBE_bounce_math.mjs` is committed alongside this document).

Evidence classes: **[V]** verified in source · **[M]** measured (recorded
in-repo or probe-reproduced) · **[I]** source-backed inference ·
**[P]** product-semantic choice that cannot be inferred technically ·
**[U]** unresolved uncertainty.

---

## 1. Verdict

**Bounce in Place is feasible end-to-end. No fatal blocker exists on any
platform, and the intended experience — press Bounce, get a sampled source
with a fresh processing layer, repeat recursively — can be delivered
honestly.** But three prompts in the product intent hide the three largest
subsystems, all of which are **greenfield** in this repo:

1. **Binary asset persistence does not exist anywhere.** Stored state is
   JSON strings; the resource client is read-only; browser persistence is
   one ~5 MB localStorage key that fails silently on quota. A bounce bank
   (≈14–35 MiB) needs a new persistence layer on every platform [V].
2. **A sampled voice source does not exist.** It is a new pure-Cmajor
   processor spliced where the oscillator renderer's per-voice output is
   read — clean insertion point verified — plus release-segment playback
   (forced by the compile-fixed 0.2 s amp gate), new appended modulation
   targets, and a bank install lane [V].
3. **An offline render driver does not exist**, though every ingredient is
   proven in in-repo test harnesses; and the repo's own measurements say the
   full patch renders at only ≈1.15–1.4× realtime on one thread — bounce
   speed must be measured (single-voice capture is ≈3–5× by the measured
   voice-scaling ratio), not assumed [M][I].

"The same sound" is honest **as a resampling contract** (each note through
the full chain at capture conditions), not as "the same instrument":
per-note-baked global FX, crossfaded sustain loops, one velocity layer,
frozen randomness and tempo. These are the same compromises as sampling any
hardware synth through its FX — the right mental model to ship under.

Scope is a **major feature: ~13–18 engineering weeks cross-platform**
(browser-first cut ≈7–9), gated by five cheap evidence spikes (§7). Bounce
does **not** require the audio-asset-store refactor: a V1 bank can live in
Cmajor state (+19 MiB frozen) using the proven staged-install/atomic-commit
pattern; §6.4 states the exact interface Bounce wants from any future
asset-ownership work.

---

## 2. Current architecture facts the design stands on

### 2.1 The engine (verified)

- **Splice point.** Per sample, per voice: renderer output → per-voice
  filter → × amp gate → voice sum → `trim(0.18)` → rack → soft-limit
  output stage (cmajor/FixedFrameOscillator.cmajor:4845-4917;
  WavetableSynth.cmajor:1374, :1524-1544). A sampled source replaces
  exactly the renderer read; the entire downstream chain is the "fresh
  processing layer" for free [V].
- **The amp envelope is a compile-fixed ASR gate** —
  `RetriggerableFixedASR(0.01f, 0.20f)[16]` (:1298, :1017-1113). User
  "envelopes" are ENV 1–3 modulation generators routed through the matrix.
  Velocity→gain survives sampled mode automatically (:1029-1032); the
  0.20 s release would truncate baked tails → release-segment playback and
  a sampled-mode voice-lifetime predicate are required. Exactly four sites
  consult the gate for lifetime (:3278-3281, :3449, :4699/:4860, :4906) [V].
- **Modulation domain**: 30 per-oscillator targets go inert
  (4 of 10 kinds meaningless, 6 reinterpretable); 21 shared voice targets
  survive; the domain is enforced by a load-time assertion (13/51/36/1131,
  ui/shared/modulation-targets.ts:164-193) and is append-only; two 32-wide
  SIMD lane blocks hold 51 targets → **13 free lanes** for appended
  sampler targets (FixedFrameOscillator.cmajor:60-66) [V].
- **Articulations**: 6 of 21 per-oscillator override bits go inert; shared
  bits survive (:95-123) [V].
- **No readiness gate exists**: notes play silence until a table commits
  (`canRender`, :2418-2433) — sampled mode inherits this pattern for
  "silent until bank installed" [V].
- **Oversampling regime is init-time keyed to `processor.frequency`**
  (<46 k: 2×+44.1-filter; 46–88.2 k: 2×; ≥88.2 k: 1× — :2323-2326) →
  capture must run at the live SR; the UI currently has **no clean SR
  query** (only the filter-spectrum payload carries it —
  FilterSpectrumAnalyzer.cmajor:87; the web host reads worklet sampleRate)
  — a small SR/status endpoint is a prerequisite [V].
- **Gain staging**: capture is necessarily post trim+rack+limiter; sampled
  voices re-enter pre-trim → structural makeup ×(1/0.18) = +14.9 dB, and
  the sum is soft-limited a second time (benign below threshold) [V][M].
- Cmajor std lib has `std::audio_data::SamplePlayer` but it is an
  event-fed single player — a custom per-voice bank reader is needed
  regardless (cmajor.dev/docs/StandardLibrary) [V].

### 2.2 Offline rendering ingredients (verified, scattered)

- Generated class runs headless: `initialise(sessionID, SR)` /
  `advance(≤128)` / `getOutputFrames_audioOut` / `sendInputEvent_midiIn`
  (tests/native/run_three_oscillator_generated_web.mjs:14-35) [V].
- The richest render template is tests/test_seqfx_probe.py:159-278:
  frame-offset-scheduled inputs, event-aligned advance slicing, output
  event drain, PCM write [V].
- **The desktop bounce skeleton already exists as a test**:
  tests/native_quickjs/ModulationRestoreProbe.cpp loads the production
  patch via JIT + QuickJS worker and pumps it from a background thread
  (:251-256, :315, :427-451) — precisely the offline-driver shape the
  desktop plugin needs [V].
- Tempo/transport can be synthesized: `sendBPM`/`sendTransportState`/
  `sendPosition` (ios_auv3/Source/CosimoCmajorPlugin.h:2220-2254) [V].
- Offline installs are cheap: upload pacing is block-cadence, so the ~3.8 s
  of *virtual* install time collapses to wall-time ÷ speed-factor under an
  advance pump (TODOS.txt:683-694; SOUND_SPEEDRUN_PIPELINE_PLAN.md:607-609)
  [M][I].
- Browser has **zero Web Worker infrastructure today** (not one
  `new Worker` in the tree); the speedrun plan's worker host is designed,
  not built [V].

### 2.3 Speed and memory (measured — corrects easy assumptions)

| Fact | Value | Cite |
|---|---|---|
| Full-patch single-thread load, browser worklet | 0.72–0.87 of realtime budget (≈1.15–1.4× realtime) | PROGRESS.txt:4, :596; TODOS.txt:825 |
| One-voice / sixteen-voice cost ratio | 0.295 (median) | PROGRESS.txt:597 |
| ⇒ single-voice capture speed (est.) | ≈3–5× realtime/thread [I] — **gate GB1** | derived |
| Effects-rack-only offline render | ~31× realtime | transient/rack-dsp-poc/README.txt:42-43 |
| Performer state / object | 54,551,200 / 54,559,424 B | experiments/effects_lane_capacity/REPORT.md:132 |
| iPhone 14 Pro live footprint | 71.5 MiB peak; CPU budget **already failing** (mean .37 vs ≤.30) | REPORT.md:330-352 |
| iOS AOT performer construct/init/prepare | 7.9–14.2 / 4.4–5.9 / 13.3–19.5 ms | REPORT.md:499-501 |
| Desktop JIT compile time of the synth | **unmeasured** [U] — gate GB2 | (absence verified) |
| Bank sizes (PROBE_bounce_math.mjs) | 13 roots × 6 s = 14.3 MiB i16 / 28.6 f32; 19 × 10 s = 34.8/69.6 | [M] |
| Repitch at ≤4 st root grid | ≤ ±2 st → no mip pyramid needed | [M] |

### 2.4 State / undo / persistence reality (verified)

- **ADR-027 is unimplemented and its v1 makes full-sound replacement a
  non-undoable barrier** (docs/ADR-027:3, :123-131, :185; TODOS.txt:878-887)
  → bounce revert must be a bespoke single-snapshot mechanism [V].
- Transaction templates that DO exist: `applySoundTransaction`
  (compensating rollback, ui/shared/effects/standalone-effect-presets.ts:1424)
  and the two-phase dirty-guarded Init flow (`prepareInitSoundReplacement`
  :1762, `requestSoundReplacement` :1819 + "Discard/Save and Init" UI) —
  the right shape for the bounce flip; Init-minus-source needs a new
  exemption mechanism (Init resets `osc*WavetableSelect` today) [V].
- **Persistence**: no binary write path exists anywhere; the iOS zip
  installer's staged-validate-atomic-swap
  (ios_auv3/Source/CosimoSharedWavetableLibrary.mm:204-282, :434-511) is
  the only asset-write template; the App-Group entitlement covers the AUv3
  extension too (ios_auv3/CMakeLists.txt:270-277) so banks can persist
  there with no new entitlement. DAW chunks carry **binary** stored-state
  values with no base64 inflation (CosimoCmajorPlugin.h:1923-1937; desktop
  reader tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp:672-692) —
  embedding a bank in projects is mechanically fine (desktop restore is
  synchronous; iOS async). Browser: localStorage ~5 MB with silent quota
  failure (web/browser-patch-state.mjs:103-107) → OPFS/IndexedDB required [V].
- **Bank identity**: `wavetableSelect` is a frozen 0..237 factory index —
  banks need digest-based identity in a new stored document [V].
- **UI**: the oscillator stage is already a swappable slot
  (ui/desktop/desktop-oscillator-presentation.tsx:63; the compact editor
  has an unused insertion slot); no PCM scope exists (nearest: the
  distortion-scope streaming pattern, ui/shared/distortion-visualizer.tsx:165);
  the `unbacked` target state exists in types (target-descriptor.ts:70-86)
  but nothing greys/disables inert targets — that affordance must be
  built [V].
- **Prior art**: zero mentions of bounce/freeze/resample/sampler in the
  planning record; the only adjacent design is the (unimplemented)
  speedrun offline-render plan; the only adjacent rejection ("do not
  investigate multiple performers", REPORT.md:633-634) is explicitly about
  *concurrently active realtime* performers, not a transient bounce
  instance [V].

---

## 3. What "the same sound" can honestly mean [P]

**Faithful:** any single note at capture velocity, held up to the capture
hold-length, through the complete chain (voice + trim + rack + limiter) at
capture tempo and SR, including its release character (via release
segments). Immediate post-bounce A/B on one note ≈ identical.

**Necessarily different — state it, don't hide it:**
1. Global FX become per-note: chords stack N delays/reverbs; nonlinear FX
   (OTT/distortion/limiter) bake pre-sum. Identical to sampling hardware
   through its FX — the mental model to ship under.
2. Holds beyond the capture length loop a crossfaded region; strong slow
   motion (long MSEGs) audibly cycles.
3. One velocity layer: velocity→gain survives; velocity→timbre is baked.
4. Baked randomness (unison phase random) repeats identically.
5. Tempo-synced FX frozen at capture tempo; SR regime frozen at capture SR.
6. MPE pressure/slide and articulation of baked params are gone;
   expressivity returns through the fresh layer's routes.
7. Repitch ≤ half the root-grid step (≤ ±2 st at the default grid).

---

## 4. Proposed end-to-end architecture

### 4.1 Sampled source (new pure-Cmajor processor — no external, ADR-022-clean)

- `BounceSampler` inside `SharedVoiceEngine`: per-voice state {segment,
  position, active}; reads a resident bank of stereo 16-bit-packed PCM
  (two samples per int32 — the 18/14-bit pool-packing precedent) with
  4-point interpolation; **nearest-root selection**, playback rate =
  2^((voicePitch − rootPitch)/12) × bankSR/liveSR per sample — glide and
  pitch modulation flow for free from the existing per-voice pitch state.
- **Two segments per root: attack+sustain and release.** Capture records
  the exact noteOff offset; playback loops a crossfaded late-sustain window
  while held, then crossfades into the release segment on noteOff and
  plays it to completion. Voice lifetime = "sampler segment active" OR
  gate>0; the amp gate contributes velocity scaling with a unity path in
  sampled mode (4 predicate sites to touch).
- `sourceMode` (event input): oscillator | sampled. In sampled mode the
  wavetable renderer is skipped (its `canRender` gate already handles
  absent tables); osc params/targets become runtime-inert.
- **Appended sampler modulation targets** (~6: ampGainDb, pan,
  pitchSemitones, start, +2 reserve) in the free SIMD lanes; domain
  assertion and catalogs updated in lockstep (append-only).
- Bank residency V1: Cmajor state arrays, capacity compile-frozen at
  ~19 MiB (13 roots × 8 s stereo i16-packed); installed via a new staged
  lane copying the proven wavetable pattern (session/generation/serials →
  ready flags → atomic commit; silence until committed). §6.4 gives the
  asset-store alternative.

### 4.2 Bounce pipeline (shared planner, thin platform drivers)

1. **Snapshot** the live document (params + modulation.v6 + rack.v1 +
   articulations.v4 + current bank ref if recursive) at button press.
2. **Plan** (shared, platform-neutral JSON): root grid (default every 4 st
   over the playable range → 19 roots; quality presets), hold H (default
   3 s), tail cap from release params + FX-feedback estimate (default
   ≤6 s, silence-truncated at −80 dBFS), capture SR = live SR, tempo =
   live BPM.
3. **Render** each root in a fresh offline performer (fresh integer
   session id; installs advance-pumped; state cloned from the snapshot;
   recursive bounces install the current bank the same way):
   - Browser: worker pool (class-only engine bundle + `OfflineEngineHost`
     — the speedrun plan's designed-not-built module), roots in parallel.
   - Desktop: background thread driving a second JIT `cmaj::Patch` with
     the QuickJS worker enabled (the ModulationRestoreProbe pattern;
     auto-rebuild watcher disabled); engine linked once, roots sequential.
   - iOS: one transient AOT performer, roots sequential, PCM encoded and
     flushed to App-Group disk per root to bound peak memory.
4. **Segment + encode**: mark the noteOff offset, pick the loop window,
   truncate the tail at silence, no normalization (structural makeup
   only), pack i16, digest.
5. **Persist** the bank by digest (OPFS / App-Group / app-support;
   DAW-chunk embedding per P7) with staged-write + atomic rename (the
   zip-installer pattern).
6. **Install + verify**: staged install into the live engine; render one
   short offline verification note through the sampled path; compare its
   RMS envelope against the capture (cheap sanity gate).
7. **Atomic flip** via the two-phase confirm flow: write `bounce.v1`
   stored document {digest, roots, segment table, loop points, capture
   SR/tempo, generation, revert ref}, set `sourceMode=sampled`, apply the
   **neutral fresh layer** (routes cleared, rack disabled, voice filter
   Off/neutral — NOT Init's audible 1 kHz lowpass — MSEG/ENV/macros/
   playMode/glide preserved, osc params preserved-but-inert), keep the
   pre-bounce snapshot + previous bank ref for **Revert** (bespoke,
   single-level; not ADR-027 undo).
8. **Cancel/failure**: abort discards partials; the document never flips
   until persist+install+verify all succeed; typed per-stage errors
   (silent capture, quota, install timeout).

### 4.3 Recursion

Bounce N+1 renders through sampler(bank N) + layer N+1 at the **same root
set** → playback rate 1.0 during capture → near-lossless generations (only
FX and i16 quantization). Old banks retained per revert policy (P6), GC'd
beyond it.

### 4.4 UI

Source-panel swap in the existing stage slot (desktop) / editor slot
(compact): PCM waveform view (distortion-scope drawing pattern, showing the
root nearest the last played note), root markers, Bounce/Revert controls,
progress + cancel; inert-target greying consumes the existing `unbacked`
vocabulary; the bounce entry reuses the dirty-guard confirm ("Save and
Bounce / Discard and Bounce").

---

## 5. Product decisions that cannot be inferred technically [P]

P1. FX bake scope: full chain per note (recommended) vs voice-only bake
    with the legacy rack kept live.
P2. Root grid / hold / tail defaults; whether a quality control is
    user-visible.
P3. Sustain behavior: crossfaded loop (recommended) vs one-shot vs
    gate-faded.
P4. Velocity layers (recommend 1) and round-robin (recommend none) in V1.
P5. Fresh-layer definition: recommended NEUTRAL (filter Off, routes
    cleared, rack disabled, generators preserved) — explicitly not Init.
P6. Revert depth (recommend single-level pre-bounce snapshot) and bank
    retention/GC across generations.
P7. Bank persistence in presets/projects: embed in the DAW chunk
    (portable; binary ValueTree carries it without inflation; desktop
    restore is synchronous) vs reference-by-digest into the platform
    library (small; breaks portability) — likely embed-on-native,
    reference+OPFS on web.
P8. Mid-bounce edits: render the press-time snapshot (recommended).
P9. Silent-capture handling; per-root normalization (recommend none).
P10. Bounce audibility: silent background render (recommended) vs audible
    realtime capture (also the desktop fallback if GB2 fails).
P11. Framing: users must understand old controls go inert until Revert.
P12. SR-change behavior post-bounce (rate-compensated playback plus a
    "re-bounce for best quality" prompt vs silent acceptance).

---

## 6. Risks, unknowns, rejected alternatives

### 6.1 Major risks
- **iOS memory**: +52 MiB transient performer inside an extension whose
  live footprint is 71.5 MiB and whose CPU budget already fails its frozen
  contract; mitigations (sequential roots, per-root flush, bounce in the
  standalone app with App-Group sharing) must be proven on device (GB3).
- **Render speed**: measured full-patch ≈1.15–1.4× realtime/thread; if the
  single-voice factor lands near 2× instead of 4×, a 19-root bounce is
  ~1–2 min on iOS — pushing default root counts down or requiring the
  audible-capture fallback (GB1 decides).
- **Loop quality on motional patches** is the biggest perceived-quality
  risk (GB5 listening gate).
- **Desktop second-engine unknowns**: JIT compile time unmeasured; a
  second hidden-WebView worker is avoided by using the QuickJS worker for
  the offline patch (compiled in, iOS-proven); the auto-rebuild
  double-watcher must be disabled for the bounce instance (GB2).
- **Greenfield persistence** on web (OPFS) and the inert-target UX are
  easy to underestimate.
- **State-size growth**: +19 MiB frozen Cmajor state (V1 bank) lands on
  browser pages and iOS footprint budgets; the effects-lane budget allows
  128/160 MiB incremental — it fits but eats a seventh of it (GB4).

### 6.2 Unresolved uncertainties [U]
Desktop JIT compile seconds; true single-voice offline speed per platform;
iOS jetsam behavior under the transient instance; single 5M-int32 state
array vs chunking (trivial either way); host tolerance for 15–35 MB chunks
across DAWs; loop-window heuristics' hit rate.

### 6.3 Rejected alternatives
- **Resample-to-wavetable as the bounce**: no audio→frame scanner exists
  (wtbank.py:196-230 requires exact 2048-multiples), the pipeline destroys
  DC per frame and caps at 256 single cycles — it cannot carry "the
  complete current sound" (noise, stereo, FX tails). Worth building
  someday as a separate creative feature; not this one.
- **Live-performer capture** (render through the playing instance):
  realtime-locked, pollutes live state (tails), blocks playing — rejected
  as primary; audible realtime capture remains the desktop fallback.
- **Host-side sampler outside Cmajor**: breaks the one-engine architecture
  and rack routing.
- **ADR-027-based undo for V1**: unimplemented, spike-gated, and its v1
  semantics make replacement a history-clearing barrier.
- **Voice-only bake with the legacy rack kept live**: two effect
  ownerships at once; contradicts flatten semantics.

### 6.4 The interface Bounce needs from asset ownership (dependency, not assumption)
Publish/acquire/release of an immutable stereo PCM bank addressed by
{digest, generation} with per-voice random access, atomic swap, and
platform persistence — plus segment metadata riding in `bounce.v1`. V1
works without any refactor via the in-state bank; if an asset store lands
later, only §4.1's residency and §4.2 steps 5–6 change.

---

## 7. Implementation sequence and scope

0. **Gates (≈1.5 wk, parallel)** — GB1 speed probes (browser worker probe;
   iOS via the existing benchmark path + the `cosimoPerfProcessMultiplier`
   instrument); GB2 desktop skeleton from ModulationRestoreProbe (measure
   JIT compile; render 3 roots); GB3 iOS transient-instance memory dry
   run; GB5 loop-quality listening on 5 motional factory patches using
   GB1's browser renders; SR/status endpoint prerequisite.
1. **Sampler DSP (≈2.5–3 wk)** — bank state + install lane +
   BounceSampler + sourceMode + voice lifetime + appended targets +
   golden render tests.
2. **Bank format + segmentation + persistence (≈2 wk)** — shared
   segmenter/encoder/digest; OPFS + App-Group + app-support writers
   (zip-installer pattern); preset/DAW embedding per P7.
3. **Offline drivers (≈2–3 wk)** — browser worker host (class-only bundle
   + OfflineEngineHost); desktop C++ driver; iOS sequential driver.
4. **State transition (≈1.5–2 wk)** — `bounce.v1`, Init-minus-source
   neutral layer + exemption mechanism, two-phase confirm, bespoke revert,
   verify-render, typed failures.
5. **UI (≈2 wk)** — source panel + PCM scope, bounce/progress/cancel/
   revert, inert-target affordance, phone + desktop.
6. **Recursion + hardening (≈1.5–2 wk)** — same-root recursion tests,
   memory/budget fingerprints, DAW soak, docs.

**Total ≈13–18 wks cross-platform; ≈7–9 wks for a browser-first V1**
(best render story; worst persistence story; no DAW). An
iOS-standalone-first cut is the most product-natural alternative
(App-Group persistence half-exists; bounce in the standalone, playback
everywhere).

## 8. Key evidence locations

- Engine: cmajor/FixedFrameOscillator.cmajor :1298 (fixed ASR),
  :2418-2433 (silence gate), :2323-2326 (oversampling regimes),
  :3278/:3449/:4699/:4860/:4906 (lifetime sites), :4845-4917 (splice),
  :60-66 (free SIMD lanes); WavetableSynth.cmajor:1374 (trim),
  :1524-1544 (signal path).
- Offline: tests/test_seqfx_probe.py:159-278;
  tests/native/run_three_oscillator_generated_web.mjs:14-35;
  tests/native_quickjs/ModulationRestoreProbe.cpp:251-451;
  ios_auv3/Source/CosimoCmajorPlugin.h:2220-2254 (tempo feed).
- Speed/memory: PROGRESS.txt:4, :596-597; TODOS.txt:683-694, :825;
  experiments/effects_lane_capacity/REPORT.md:132, :330-352, :499-501,
  :633-666; transient/rack-dsp-poc/README.txt:42-43.
- State/persistence: docs/ADR-027-native-action-history-and-atomic-sound-
  replay.md:3, :123-131, :185;
  ui/shared/effects/standalone-effect-presets.ts:1424, :1762-1834;
  ios_auv3/Source/CosimoSharedWavetableLibrary.mm:204-282, :434-511;
  ios_auv3/Source/CosimoCmajorPlugin.h:1913-1951;
  tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp:566-584,
  :631-700, :672-692, :710-733; web/browser-patch-state.mjs:91-108.
- UI/targets: ui/desktop/desktop-oscillator-presentation.tsx:63;
  ui/shared/mobile-voice-editor.tsx:161-225;
  ui/shared/target-descriptor.ts:70-86;
  ui/shared/modulation-targets.ts:10-51, :164-193;
  ui/shared/distortion-visualizer.tsx:165.
- Probe: PROBE_bounce_math.mjs (repo root).
