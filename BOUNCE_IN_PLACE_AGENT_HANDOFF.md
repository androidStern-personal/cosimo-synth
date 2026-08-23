# Handoff: Implement "Bounce in Place" end to end

You are an autonomous coding agent working unsupervised in a GitHub Codespace
(Linux). Your job is to implement the Bounce in Place feature in Cosimo Synth
end to end, including any architectural refactoring genuinely required along
the way. Nobody will answer questions mid-run: every product decision you need
is locked in §4, every known trap is listed in §5, and every place where the
architecture could fork has a designated primary path, fallback, and pivot
criteria in §6. When reality contradicts this document, trust reality, record
the contradiction in your log, and follow the pivot protocol in §9.

---

## 1. The feature, in plain terms

The user presses **Bounce**. Cosimo renders the complete current sound —
oscillators, per-voice filter, modulation, envelopes, and the full effects
rack — at several root pitches into a hidden set of stereo recordings (a
"bounce bank"). When rendering succeeds, the oscillator section of the UI is
replaced by a simple waveform view, and playing MIDI now plays the recordings
(repitched between roots) instead of running the oscillators. The user gets a
fresh, neutral processing layer above the sampled source: filter, envelopes,
modulation routes, and effects all start clean, and everything they do now
layers on top of the frozen sound. They can press Bounce again to resample the
already-resampled sound. Revert restores the pre-bounce state. The experience
must feel like freeze/flatten/bounce-to-audio — never like configuring a
multisampler.

---

## 2. Baseline, branch, and ground rules

- Base your work on **`origin/claude/effects-lane-m1`** (tip at handoff time:
  `367922d`). Create and work on a new branch **`codex/bounce-in-place`** from
  that tip. If the tip has moved, use the current tip.
- **Never** rebase, amend published commits, or force-push. Merge
  `origin/claude/effects-lane-m1` forward if you need newer work.
- **Commit and push constantly.** Push after every milestone and at least
  every couple of hours of work regardless. Every artifact you produce —
  analysis notes, probe scripts, measurements, WAV fixtures (keep them short),
  logs — must be **committed in the repository**, never left loose in the
  container. The container is disposable; the branch is the deliverable.
- Maintain a running log at `BOUNCE_LOG.md` (repo root): dated entries for
  every milestone completion, every pivot (what, why, evidence), every
  blocker, every measurement. Commit it with each update.
- Do not delete failed-path code silently: revert it in a commit whose message
  says why, or park it behind a flag, and log it.
- Keep your diff scoped: `claude/effects-lane-m1` carries active "Effects
  Lane" work. Don't refactor things bounce doesn't need.

### Reference material (fetch it first)

Two prior feasibility studies exist on a different branch. Fetch them
read-only; copy them into `docs/reference/` on your branch and commit:

```
git fetch origin claude/sound-speedrun-pipeline-plan-eaf9zd
git show FETCH_HEAD:BOUNCE_IN_PLACE_FEASIBILITY.md      > docs/reference/BOUNCE_IN_PLACE_FEASIBILITY.md
git show FETCH_HEAD:AUDIO_ASSET_OWNERSHIP_FEASIBILITY.md > docs/reference/AUDIO_ASSET_OWNERSHIP_FEASIBILITY.md
git show FETCH_HEAD:PROBE_bounce_math.mjs               > docs/reference/PROBE_bounce_math.mjs
```

**Caution:** every `file:line` in those documents (and in §5 below) was
verified at commit `bc0f363`, which is NOT your baseline. Your branch has
since **reworked the modulation target system** ("dynamic target domain",
"one target-kind grammar for every device" — commits `be5309e..367922d`).
Before relying on any cited fact, re-locate it by symbol name on your baseline
and re-verify it. Where the target-domain rework changes the picture (it
probably makes adding sampler modulation targets easier), prefer the new
system's idioms. A second agent's report also references probe sources at
`experiments/resample-feasibility/{MultisampleProbe,ExternalSamplerProbe}.cpp`;
they may or may not exist on any branch — use them if present, don't hunt.

---

## 3. Environment reality (Codespace, not a Mac)

You cannot build or validate the macOS desktop app, the VST3/AU plugins, or
the iPhone AUv3 here. What you CAN do on Linux:

- All pure-node test suites (`npm run test:modulation:routing`,
  `test:units:orphans`, etc.).
- The **browser product**, end to end: generate the Cmajor→JS/WASM engine,
  build `build/web`, and run Playwright tests. This is your primary
  integration target. The browser is where "end to end" must be proven.
- Compile the Cmajor→C++ generated code and the native renderer sources with
  Linux clang to prove the native code paths build (no host app around them).

Toolchain bring-up is Milestone 0 and has real friction:

- `python3 scripts/ensure_cmajor_runtime.py --path` clones the pinned Cmajor
  (tag 1.0.3066, commit `172db532…`) + patched CHOC and applies the repo's
  patches. You must then **build the `cmaj` tool and the repo's
  `tools/cmajor_external_codegen` on Linux** (cmake; upstream Cmajor supports
  Linux). This is on the critical path: the stock `cmaj` CLI cannot resolve
  the synth's external renderer function; only the repo's codegen tool can.
- The renderer-WASM build script defaults to Homebrew paths but honors
  `COSIMO_RENDERER_LLVM_DIR`, `COSIMO_RENDERER_WASI_C_DIR`,
  `COSIMO_RENDERER_WASI_CXX_DIR` (see
  `scripts/build_three_oscillator_renderer_wasm.sh`). Install a recent LLVM
  and wasi-sdk/wasi-libc and point those at them.
- The browser test harness launches Chromium with `headless: false` and
  `channel: "chrome"` (see `tests/test_web_poc_browser.mjs`) — Mac
  assumptions. Adapt the launch for Linux (Playwright chromium, headless or
  `xvfb-run`) in a way that keeps the Mac path working, and commit it.
- Performance numbers from a shared Codespace vCPU are noisy. Always measure
  **relative** deltas (before/after, mode A vs mode B) and record absolute
  numbers as informational only.

If the toolchain cannot be brought up after a serious attempt (see timeboxes,
§9), that is a hard blocker for DSP work — log it precisely and switch to
every milestone that doesn't need engine regeneration (UI, persistence
scaffolding, planners, unit-tested pure logic) while documenting exactly what
a Mac run must do to unblock the rest.

---

## 4. Locked product decisions (do not reopen these)

1. **Bake scope:** the capture includes the complete chain — voice, filter,
   modulation, effects rack, output limiter. Chords will stack per-note
   reverb/delay; that is accepted "resampled instrument" behavior.
2. **Note semantics (MVP): one-shot with a real release.** Each captured note
   plays start-to-finish. Releasing the key early fades the note with a real,
   user-controllable amplitude release (see M1). Holding past the recording's
   end: the note simply ends. **Stretch goal (only after M7):** looped
   sustain + separate release segment, behind a flag.
3. **Roots:** default one capture every 4 semitones across MIDI 24–96
   (19 roots), config constant, nearest-root selection, repitch by playback
   rate. No mip pyramids needed at ≤ ±2 semitones.
4. **Velocity:** capture at velocity 100, single layer; live velocity maps to
   loudness only. No round-robin.
5. **Capture length:** hold 3 s per note, then record the tail until it falls
   below −80 dBFS or hits a 6 s cap. Capture at the live sample rate, tempo
   frozen at bounce start.
6. **Fresh layer after bounce = NEUTRAL, not Init.** Explicitly: modulation
   routes cleared; all rack effects disabled; voice filter set to *Off* (the
   Init default is an audible 1 kHz lowpass — do not use Init defaults);
   MSEG shapes, ENV settings, macro names, play mode, glide preserved; all
   oscillator parameters preserved untouched but inert. Immediately after
   bounce, playing a single note must sound essentially identical to before.
7. **Snapshot semantics:** the bounce renders the state captured at the
   moment Bounce was pressed; knob moves during the render don't affect it.
8. **Atomicity:** the patch flips to sampled mode only after the bank is
   fully rendered, persisted, installed, and verified. Cancel or any failure
   leaves the previous sound completely untouched.
9. **Revert:** single-level. Keep the full pre-bounce document and the
   previous bank; Revert restores them. Recursive bounce replaces the revert
   snapshot with the latest pre-bounce state.
10. **Persistence is MVP-blocking.** A bounced patch must survive page reload
    in the browser (bank stored by content digest; the patch document stores
    the digest + root/segment metadata). Storing PCM in browser
    `localStorage`/stored-state is **forbidden** (~5 MB quota, silent
    failure — verified). Native persistence is designed and documented but
    validated later on a Mac (M8).
11. **Rendering is silent and backgrounded** in the browser (workers); live
    playing continues. If a platform can't do that, a modal "Bouncing…" state
    is acceptable there.
12. **Recursion:** re-bounce captures at the same root set so the sampler
    plays at rate 1.0 during capture (near-lossless generations).

---

## 5. Verified engine facts and traps (re-verify each on your baseline)

These were established by direct source reading and probes at `bc0f363`.
Symbol names should survive; line numbers may not.

1. **Splice point.** Per sample, per voice, in `SharedVoiceEngine.main()`
   (cmajor/FixedFrameOscillator.cmajor): the oscillator renderer's per-voice
   stereo output is read from `rendererFloats` at `rendererNoteOutputOffset`,
   then flows → per-voice filter → × amp gate (`envelopes[voice].gainOut`) →
   voice sum → `StereoTrim(0.18f)` → effects rack → soft-limit output stage.
   **The sampled source replaces exactly that per-voice read.** Everything
   downstream is the fresh processing layer, unchanged.
2. **There is no real amplitude release today.** The per-voice amp envelope
   is `RetriggerableFixedASR(0.01f, 0.20f)` — compile-time constants. On
   note-off (`voiceEventIn(NoteOff)`): `voiceActive = 0` and the gate starts
   a 0.2 s fade immediately. ENV 1–3 are modulation generators; a long ENV
   release routed to level is chopped at 0.2 s because the gate multiplies
   after it. Exactly these sites gate voice lifetime/audibility:
   `voiceIsSoundingForRackModulation`, the monitor `isVisible` check, the
   mix-loop skip, and the final `gain =` multiply. M1 fixes this.
3. **Gain-staging trap.** Captured audio is post-trim(0.18)/rack/limiter;
   sampled voices re-enter pre-trim. Playback needs a structural makeup gain
   of 1/0.18 (+14.9 dB) or everything comes back ~15 dB quiet. The sum then
   passes the output limiter a second time — acceptable, document it.
4. **Sample-rate regime.** Oversampling is chosen once at engine init from
   `processor.frequency` (<46 kHz: 2× + a 44.1 filter; 46–88.2 kHz: 2×;
   ≥88.2 kHz: 1×). Capture must run at the live SR. The UI currently has no
   clean way to ask the engine its SR (only the filter-spectrum monitor
   payload carries `sampleRateHz`) — add a small status/SR readback as part
   of M3 unless the effects-lane branch already added one.
5. **Uploads/event limits.** The performer input FIFO is 64 KiB; the shipped
   wavetable protocol uses 24 KiB batches, one in flight, ack-paced
   (measured; see `wavetableMipFrameBatchSize` comment). Product JS bundles
   are generated with `advance()` capped at **128 frames per call**. Offline
   (advance-pumped) installs collapse to memcpy speed — the ack pacing is a
   realtime phenomenon.
6. **Offline rendering is proven.** The generated class runs headless:
   `await initialise(sessionID, SR)`, `advance(n)`,
   `getOutputFrames_audioOut(...)`, `sendInputEvent_midiIn({message})`.
   Templates: `tests/test_seqfx_probe.py` (frame-offset event scheduling),
   `tests/native/run_three_oscillator_generated_web.mjs` (minimal loop),
   `tests/native_quickjs/ModulationRestoreProbe.cpp` (native JIT + QuickJS
   worker driven from a background thread — the desktop driver's skeleton).
   Use a **fresh engine + fresh integer session id per root** so state is
   cold and install lanes start at their baselines.
7. **Speed reality.** Full-patch, 16-voice, single-thread ≈ 0.72–0.87 of the
   realtime budget in the browser (measured); one-voice/16-voice cost ratio
   ≈ 0.295 (measured). Expect roughly 3–5× realtime per thread for capture.
   Never promise more without measuring (that's gate G1).
8. **Dead ends, pre-verified — do not attempt:** loading PCM as Cmajor
   manifest `external` data (load-time only, and a probe measured ~2 GiB RSS
   to JIT-link 18 MiB of PCM); rebuilding the performer per bounce; a
   host-side sampler outside the engine (breaks rack routing); shipping PCM
   through the realtime acked event lane as the *permanent* transport.
9. **Identity/persistence facts.** `wavetableSelect` is a frozen 0..237
   factory-catalog index — bank identity must be a content digest in a new
   stored document, not a selector value. Stored-state values on native ride
   the JUCE ValueTree binary chunk (binary-safe, no base64 bloat; desktop
   restore is synchronous). ADR-027 (undo/history) is UNIMPLEMENTED and its
   design makes full-sound replacement a history barrier — build Revert as a
   bespoke snapshot, not on ADR-027. The Init flow
   (`prepareInitSoundReplacement` / `requestSoundReplacement` in
   ui/shared/effects/standalone-effect-presets.ts) is the template for the
   confirm+apply flip; you must add an exemption mechanism because Init today
   resets everything including table selection.
10. **Inert-controls gap.** After bounce, every per-oscillator modulation
    target and most oscillator articulation bits do nothing. On `bc0f363`
    the target domain was frozen by a load-time assertion; **your branch has
    since made the target domain dynamic — re-derive how targets are
    declared and how to mark/remove/grey inert ones under the new grammar.**
    The UI has an `unbacked` concept (ui/shared/target-descriptor.ts) but no
    visual treatment — you must build the greyed/inactive affordance.
11. **Wavetable readiness pattern.** Notes play silence until a table is
    committed (`canRender` gate). Copy this: sampled mode is silent until the
    bank commit, never wrong-sounding.

---

## 6. Architecture and the sanctioned forks

Target shape (identical product regardless of fork choices):

```
MIDI → dispatcher → per-voice source:  oscillators  OR  bounce-bank sampler
                                   ↓
                     per-voice filter + real release envelope (M1)
                                   ↓
                     voice sum → trim → fresh rack → output limiter
```

### F1 — Where the bank's PCM lives. PRIMARY: Path B. UPGRADE/PIVOT: Path A.

- **Path B (primary): bank inside Cmajor state.** A new pure-Cmajor
  `BounceSampler` reads stereo 16-bit samples packed two-per-int32 in state
  arrays (≈19 MiB capacity: 19 roots × ~6 s average; size it from
  `PROBE_bounce_math.mjs` and your defaults). Install via a new staged event
  lane cloned from the wavetable pattern (session/generation/serials → ready
  flags → atomic commit → readiness gate). No C++/ABI/wasm-layout changes;
  works through normal codegen on every platform. Cost: frozen capacity,
  +~19 MiB per instance, a few seconds of acked install into the *live*
  engine per bounce.
- **Path A (upgrade): host/renderer-owned arena.** PCM lives outside Cmajor
  in memory owned by the canonical renderer layer; the engine passes a
  handle. Better memory and install characteristics, and the direction both
  feasibility studies endorse long-term — but it makes the renderer stateful
  for the first time (per-instance identity under a context-free external
  ABI, epoch-based reclamation, wasm arena + `--global-base` layout and the
  shared-memory canary test rework). **Do not start here.**
- **Pivot B→A triggers:** generated-engine memory growth from the in-state
  bank breaks the browser build or the web POC perf suite; or the staged
  install into the live engine measurably glitches audio and can't be paced;
  or state-size regeneration friction becomes the dominant time sink. Log
  evidence, then pivot. **Pivot A→B trigger** (if you ended up in A): two
  timeboxes burned on wasm layout/identity issues.
- Either way, keep residency behind one seam (`BounceBankStore` interface:
  install, commit, read-access, retire) so the other path stays reachable.

### F2 — Note semantics. PRIMARY: one-shot + real release (locked, §4.2).
Stretch: loop+release segments behind a flag, only after M7, only if the
one-shot A/B gates are green.

### F3 — Browser offline capture driver. PRIMARY: Web Worker pool (one worker
per root, class-only engine bundle — note `web/build.mjs` currently emits a
module that imports the worklet helper; add a class-only artifact).
FALLBACK: sequential rendering on the main thread with progress yields, if
worker+WASM loading fights you for more than one timebox. FORBIDDEN: driving
the live AudioWorklet engine for capture.

### F4 — Browser persistence. PRIMARY: OPFS (navigator.storage.getDirectory)
keyed by digest. FALLBACK: IndexedDB. FORBIDDEN: localStorage / stored-state
JSON for PCM.

### F5 — The release fix shape (M1). PRIMARY: replace the fixed ASR with a
runtime-parameterized release (new host parameter `ampRelease`, range
0.005–10 s, default 0.2 s so existing behavior is unchanged), and derive
voice lifetime from "release fade still audible OR sampler still playing".
FALLBACK: keep the fixed gate for oscillator mode and bypass it in sampled
mode with sampler-driven lifetime — only if the parameterized ASR breaks
tests you can't stabilize in one timebox. Parameters are append-only in
declaration order — append, never reorder.

---

## 7. Milestones with acceptance criteria

Do them in order; each ends with tests green, docs updated, log entry,
commit, push. "A/B within tolerance" means: peak-normalized RMS over 50 ms
windows differs < 1 dB, no window > 3 dB, verified by a committed script.

- **M0 — Environment green.** Pinned Cmajor + codegen tool built on Linux;
  `npm run web:build` succeeds; the web POC Chromium test runs headless on
  Linux (harness adapted without breaking Mac); pure-node suites pass.
  Commit a `docs/BOUNCE_CODESPACE_SETUP.md` with exact steps.
- **M1 — Real amplitude release.** `ampRelease` parameter per F5; voice
  lifetime follows it; with a dry patch and 3 s release, audio is present
  2 s after note-off (automated offline render test); with the default
  0.2 s, existing golden/behavior tests still pass.
- **M2 — Sampler source plays a hand-built bank.** A script converts any WAV
  into a bank fixture; `sourceMode` switch; staged install + readiness;
  nearest-root + rate repitch; +14.9 dB makeup verified; at a root note,
  playback A/B-matches the source within 16-bit tolerance; polyphony, glide,
  velocity-to-loudness, and early-release tests pass; oscillator mode is
  bit-identical to before when `sourceMode=oscillator` (regression render).
- **M3 — Offline capture.** Snapshot → plan → per-root fresh-engine renders
  in workers → noteOff-offset + silence truncation → bank + digest. Two
  bounces of the same snapshot produce identical digests (determinism). For
  three test patches (pluck, pad with reverb+delay, nonlinear OTT patch):
  captured-note vs sampled-playback A/B at each root within tolerance,
  including ≥1 s of recorded FX tail after note-off (this proves M1+M2+M3
  compose). SR readback endpoint added if absent.
- **M4 — The flip.** `bounce.v1` document (digest, roots, segment offsets,
  capture SR/tempo, generation, revert ref); neutral fresh layer per §4.6;
  Revert restores exactly (document equality test); cancel mid-render and
  induced failures (bad digest, install timeout) leave the old sound
  untouched (automated).
- **M5 — Persistence.** Bank in OPFS by digest; Playwright: bounce → reload
  page → sampled patch plays without re-rendering; preset save/load carries
  the reference; missing-bank on load degrades to a clear error state, not
  silence-with-working-looking-UI. Native persistence design written into
  `docs/BOUNCE_NATIVE_PERSISTENCE.md` (App-Group files on iOS — the
  entitlement already exists; app-support on desktop; binary stored-state
  value in the DAW chunk as the portable option).
- **M6 — UI.** Bounce control with progress + cancel; source panel swap (the
  oscillator stage is already a slot — `DesktopOscillatorPresentation`'s
  `selectedOscillatorStage`; the compact editor has an insertion slot); PCM
  waveform view; Revert control; inert oscillator/mod controls visibly
  disabled; works at desktop width and the 393×852 phone layout (Playwright
  checks for both).
- **M7 — Recursion.** Bounce a bounced patch; generation-2 vs generation-1
  A/B at roots within tolerance ×2; old bank retired (memory/storage
  accounting in the log); Revert still single-level correct.
- **M8 — Native readiness (code-complete only).** Generated C++ for the
  patch compiles on Linux with the sampler in it; desktop/iOS driver code
  written following the ModulationRestoreProbe pattern with whatever unit
  tests are runnable; `HUMAN_VALIDATION.md` listing the exact Mac/iPhone
  steps, builds, and measurements a human must run (desktop JIT compile
  time, iOS transient memory during bounce, AUv3 lifecycle, Ableton chunk
  save/load).

## 8. Performance and quality gates (measure, record, compare relatively)

- G1: measure single-voice offline render speed (frames rendered / wall time
  ÷ SR) in M0/M3; record it; if a default 19-root bounce projects to
  > 5 minutes in the Codespace, reduce default roots/hold rather than
  shipping a worse architecture — and log the numbers for Mac re-testing.
- G2: web POC perf suite (worklet load metrics) before vs after bank
  install: relative regression ≤ 10%, zero new deadline misses in the test
  window.
- G3: no allocation, locks, or unbounded work in the audio-thread sampled
  path (code review + grep-able assertion comments; in wasm the worklet is
  single-threaded — keep it that way).
- G4: click test — render across a source-mode swap and across noteOn/off
  boundaries; max inter-sample step below an audible-click threshold except
  at legitimate transients (committed script with justification).
- G5: ten bounce→revert→bounce cycles in the browser: wasm memory pages and
  OPFS usage bounded (no ratchet); report the numbers.
- G6: full existing test suite stays green (`test:units:orphans`,
  modulation routing, web POC). You may update tests whose behavioral
  contract legitimately changed (M1 release, new parameters) — each such
  change gets a log entry explaining why the old contract was wrong.

## 9. Pivot and stuck protocol

- **Timebox:** any single blocker gets ~6 focused hours. Then: execute the
  designated fallback for that fork; if none exists, descope per the ladder
  below; log what you tried with evidence either way.
- **Descope ladder (in order):** loop/sustain stretch → M7 recursion → M6
  polish (keep a functional minimal UI) → root count/quality defaults → M8
  native compile checks. **Never descope:** M1, M2, M3, M4 atomicity,
  M5 browser persistence, or the test gates.
- **Thrash guard:** don't pivot the same fork twice without new evidence;
  the second pivot must cite what changed.
- **Hard-blocked:** write `BLOCKED.md` (exact state, repro commands, what a
  human on a Mac must do), commit, push, and continue on any milestone that
  doesn't depend on the blocker. Never end the run with unpushed work or an
  empty log.
- **End of run:** final `BOUNCE_LOG.md` entry summarizing: what's done, what
  gates passed with numbers, what's descoped/blocked, and the single next
  action for a human.

## 10. Final deliverable

The branch `codex/bounce-in-place`, pushed, containing: the working
browser-end-to-end feature (bounce → sampled playback → persistence →
revert → recursion), the M1 release fix, all tests and gates green on Linux,
`BOUNCE_LOG.md`, `docs/BOUNCE_CODESPACE_SETUP.md`,
`docs/BOUNCE_NATIVE_PERSISTENCE.md`, `HUMAN_VALIDATION.md`, and updated
reference docs. Do not open a pull request; the human will review the branch.
