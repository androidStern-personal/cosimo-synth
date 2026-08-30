# SeqFX Excellence Roadmap

Status: implementation in progress; Phases 0–5 complete; Tape Stop v2, Crush v2, Ring, Talk Box, Dirty, production Comb, Vibro, Flange, and Pitch complete; Phase 6 continues with Reverse
Owner thread: `01a05051-d7c7-7e13-bb60-58968b6392cf`
Branch: `codex/seqfx-excellence-01a05051`
Worktree: `/Users/winterfell/.codex/worktrees/seqfx-excellence-01a05051/cosimo-synth`
Base: `origin/master` at `7fc89fa322764221facdd2714e9b16bc91c41157`
Integration coordinator: `01a042bf-abd2-7820-9d47-b10405b67c5d`
Roadmap date: 2026-08-30

Execution evidence:

- Phase 0 baseline: `research/seqfx/baseline.md`
- Tape Stop contract: `research/seqfx/tape-stop-benchmark.md`
- Requested-effect matrix: `research/seqfx/effect-benchmark-matrix.md`
- Comb research and selection: `research/seqfx/comb-research.md` and
  `research/seqfx/comb-lab-decision.md`
- Sparse state/domain checkpoint: `research/seqfx/state-v7-evidence.md`
- Shared-buffer decision: `research/seqfx/buffer-architecture.md`
- Lifecycle/reset contract: `research/seqfx/lifecycle-contract.md`
- Pitch production decision: `research/seqfx/pitch-decision.md`
- Tape Stop v2 implementation proof: `research/seqfx/tape-stop-v2-evidence.md`
- Crush v2 decision and implementation proof: `research/seqfx/crush-v2-decision.md`
- Ring decision and implementation proof: `research/seqfx/ring-decision.md`
- Talk Box decision and implementation proof: `research/seqfx/talk-box-decision.md`
- Dirty decision and implementation proof: `research/seqfx/dirty-decision.md`
- Production Comb decision and implementation proof:
  `research/seqfx/comb-lab-decision.md`
- Vibro decision and implementation proof: `research/seqfx/vibro-decision.md`
- Flange decision and implementation proof: `research/seqfx/flange-decision.md`

## 1. Outcome

Turn SeqFX from a four-effect proof-quality sequencer into a polished macOS VST3 release candidate whose effects are musically useful, whose behavior is grounded in established products and published DSP work, and whose state, UI, host integration, and release path survive real projects.

The finished product keeps the current 32-step, four-chain, twelve-pattern sequencer and supports these selectable, step-sequenced effects:

1. Filter (existing; retained and polished)
2. Crush (existing Crusher, renamed and upgraded without changing its persisted effect ID)
3. Tape Stop (replaced by an evidence-driven v2)
4. Stutter (existing; retained and qualified)
5. Pitch
6. Comb
7. Ring
8. Reverse
9. Talk Box
10. Vibro
11. Flange
12. Dirty

The Koala effects are targets for musical usefulness and effect identity, not a requirement to copy Koala's live XY interaction. Every one is authored and recalled as a SeqFX block, exactly like the current effects.

## 2. Product authority and boundaries

### Direct requirements

- Do not guess Tape Stop behavior. Establish it from mature products, official documentation, and repeatable listening tests before replacing the current algorithm.
- Add only the requested Koala-family effects: Crush, Pitch, Comb, Ring, Stutter, Reverse, Talk Box, Vibro, Flange, and Dirty.
- Effects are sequenced SeqFX block types; a separate live-performance surface is not in scope.
- The Comb effect must go beyond a generic one-delay comb. It needs an original, musically useful design informed by contemporary comb, feedback-delay, dispersion, and time-varying-filter work.
- Include the previously identified state, workflow, formatting, visual, host, and release polish rather than treating effect count as the whole job.
- Do all work in this isolated worktree and branch. Do not alter the primary checkout or another agent's worktree.

### Inherited constraints

- Four serial chains, 32 steps, and 12 patterns remain the core composition model.
- The patch stays a stereo audio effect with no MIDI sidechain requirement for this roadmap.
- Existing saved SeqFX states and presets must migrate without losing audible blocks.
- The first release candidate is macOS VST3. AU, Windows, and in-plugin Patreon authorization remain outside this slice.
- This task may build and locally qualify a release candidate. It must not merge to `master`, push `master`, deploy, publish, or upload a Patreon artifact. Those actions belong to the integration coordinator or require separate release authorization.
- Installed-plugin and fixed native-build operations must be serialized with other repo work.

### Explicit interpretation

Koala documents one combined "Vibrato/Flanger" effect. The user named `Vibro` and `Flange` separately. This roadmap therefore creates two selectable effects with separate IDs and focused controls. That choice preserves the user's explicit enumeration and prevents a bipolar control from hiding which algorithm a block will run.

## 3. What “shippable” means

SeqFX is shippable only when all of the following are true:

- Every requested effect exists in DSP, state, upload, UI, preset, and test layers.
- Tape Stop behavior is backed by a completed competitor benchmark sheet and listening evidence; undocumented details are not presented as competitor facts.
- A one-cell Tape Stop can produce a useful slowdown whose audible gesture is not forcibly killed at the cell boundary when its configured timing calls for a longer gesture.
- The default serialized state is compact and version/key naming is coherent.
- Old `seqfx.v6` / internal-version-5 states migrate to the new schema and sound the same for existing Filter, Crush, Tape Stop, and Stutter blocks, except where Tape Stop v2 has an explicitly documented migration mapping.
- No effect or inspector section overflows the supported plugin geometry, labels are not hidden, text meets contrast requirements, and every icon-only action has an accessible name.
- Global bypass, mix, clock, BPM, rate, swing, loop, pattern, play/reset where applicable, undo, and redo are visible and wired to their real endpoint or state owner.
- The plugin opens without the current unnamed-audio-bus exception, passes the focused suites and strict `pluginval`, and recalls state in Ableton after save/reopen.
- The release artifact is reproducible, signed/notarized when the required credentials are available, packaged with a manifest/checksum, and tested from a clean install location.
- Any unperformed subjective listening, physical host, signing, notarization, or distribution gate is named rather than being inferred from lower-level tests.

## 4. Current baseline and debt inventory

These are source-backed facts at the roadmap base commit. Measurements will be refreshed in Phase 0 before code changes.

### DSP and effect lifecycle

- Effect IDs are currently `empty=0`, `filter=1`, `crusher=2`, `tapeStop=3`, `stutter=4`.
- Each of four chains allocates separate one-second Tape Stop and Stutter buffers.
- Tape Stop uses a rolling delay with a speed floor of `0.005`, a nominal one-second maximum history, and a duration-scale range of `0.05..4`.
- At the block boundary, `processTapeStop` drives its wet target to zero and returns to the live stage. This is the concrete reason a longer configured stop cannot produce a natural gesture tail beyond the triggering block.
- The current “catch-up” jumps the read head near the live write head, crossfades for at most roughly 2 ms, and then fades the wet output. It is not the same thing as a continuously accelerating motor return.
- Tape Stop retrigger has a 32-frame output crossfade but no evidence-backed retrigger contract.
- The input and output endpoints have no `[[ name: "Input" ]]` / `[[ name: "Output" ]]` annotations. The current Cmajor/JUCE bus-name path can throw `choc::value::Error: This type is not an object` during strict plugin validation.

### State and boundaries

- The stored key is `seqfx.v6` while the internal state type says `version: 5`.
- A default state expands all 12 patterns × 4 chains × 32 steps, including full parameter and aux structures for empty cells.
- Per-effect parameter and aux memories can be repeated on individual steps.
- The entire serialized state is written after each committed edit.
- Boundary parsing relies heavily on casts from partial object shapes. New schema work must replace trust casts at the storage/preset seam with concrete parsers and keep normalized domain state inside.

### UI and workflow

- The custom UI exposes pattern selection, the grid, effect editing, and modulation, while several existing DSP endpoints for global bypass/mix, clock mode, manual BPM, rate, swing, loop start/length, internal play, and reset are absent or only partially bridged.
- The effect picker is icon-only. Twelve effect types will not remain legible or discoverable in that shape.
- Chain labels are hidden by CSS in the current composition.
- The 1120×680 manifest size leaves multiple inspector editors wider or taller than their available section, including the existing Crush, Tape Stop, Stutter, and modulation layouts.
- Tape Stop has near-background readout text in at least one current state and inconsistent numeric precision near its speed floor.
- The top bar is pattern-dense and lacks the complete global-control, undo, and redo workflow expected of a mature sequencer.

### Release path

- Current `master` has production effect build/install commands but no current SeqFX release checklist or release-packaging command.
- An older `codex/seqfx-beta-release` branch contains useful release automation and notarization evidence, but it predates the present source and must be ported by inspection rather than merged wholesale.
- Final public display name, bundle ID, and long-term plugin identity still require an explicit product decision before public beta distribution.

## 5. Evidence policy: no more guessing

### Evidence classes

Every behavior decision in this roadmap must be recorded as one of:

- **Documented fact** — stated in an official manual, product page, standard, or primary research paper.
- **Measured observation** — reproduced in a named product or SeqFX build with source audio, settings, host, sample rate, and captured output recorded.
- **Engineering inference** — a proposed behavior derived from facts/measurements, clearly labeled and tested before it becomes the default.
- **Open question** — not yet supported. It cannot silently become shipped behavior.

### Tape Stop benchmark protocol

Before Tape Stop v2 DSP is implemented, produce `research/seqfx/tape-stop-benchmark.md` and frozen audio fixtures covering:

1. Kilohearts Tape Stop.
2. Sugar Bytes Effectrix2 Vinyl Tape Stop / Tape Start / Tape Stop Msec.
3. Sugar Bytes Looperator Tape Stop, including tied-step behavior.
4. Arturia Tape MELLO-FI Tape Stop and Instant Tape Catch-up.
5. Cableguys TimeShaper tape-stop curves if a local demo is available.

For each available product, run the same four sources:

- single impulse followed by silence;
- one-bar drum loop with an exposed snare tail;
- sustained chord;
- spoken phrase ending at the trigger.

Capture and measure:

- trigger alignment;
- stop-time mapping and whether sync/free modes are offered;
- speed/pitch trajectory for at least three curve settings;
- behavior when the gate or sequencer step ends before the stop time;
- whether stopped audio holds, fades, mutes, or keeps creeping;
- restart behavior, restart time, and instant catch-up behavior;
- dry signal behavior during stop and return;
- repeated triggers before the first gesture completes;
- transport stop, seek, loop wrap, and tempo-change behavior;
- click/discontinuity behavior at trigger, hold, restart, and retrigger.

If a product cannot be installed or licensed, record only its official documented behavior. Do not fill its listening columns by inference.

### Effect benchmark protocol

Create `research/seqfx/effect-benchmark-matrix.md`. For every requested effect, record:

- the core audible job;
- the smallest established control set;
- synced versus free-time behavior;
- tail/capture/retrigger behavior;
- gain staging and dry/wet behavior;
- stereo and mono-collapse behavior;
- known click/aliasing/stability risks;
- what SeqFX will copy, adapt, or intentionally omit.

Koala supplies the requested effect identities. Effectrix2, Looperator, Kilohearts, and primary DSP papers supply parameter and lifecycle evidence where Koala's public page does not.

## 6. Research findings that already constrain the design

### Tape Stop

- Kilohearts exposes a motor Play state, Stop Time, Start Time, and Curve. Stop and restart are therefore separate phases, not one anonymous duration knob.
- Effectrix2 exposes slowdown Time, Slope, Tape Stop, Tape Start, and an absolute-millisecond Tape Stop mode. Its effect timing can therefore be musical or absolute.
- Looperator describes Tape Stop as turning off a tape recorder/turntable while the output remains audible, supplies five established speed profiles, and uses tied steps to extend effect duration.
- Arturia documents tempo-synced stop durations from 1/4 bar to 8 bars and an optional Instant Tape Catch-up.
- TimeShaper documents buffer scrubbing, tempo-locked tape stops, and click-smoothing around hard time steps.
- DAFx work distinguishes speed-style tape behavior from simply changing delay length and describes constant-cost methods and antialiasing needs for speed increases.

These facts commit SeqFX to explicit stop timing, curve control, a separately defined return/restart, musical and useful free timing, and click-safe buffered variable-speed playback. They do **not** yet settle the exact block-end, hold, retrigger, or dry-under-tail defaults; the benchmark does.

### Sequencer and workflow

- Effectrix2 establishes 32-step sequencing, 12 patterns, explicit loop range, swing, undo/redo, per-effect bypass, serial effect order, resizable steps, per-step parameter modulation, effect presets, and multiple master mix laws.
- Effectrix2 explicitly keeps Delay and Reverb tails playing after their effect step is over. That is direct precedent for separating a step's trigger/gate lifetime from a stateful effect's audio lifetime.
- Looperator establishes tied multi-step gestures, sequence-level undo/redo, host/manual clocking, and warnings when reverse/slice playback asks for audio that has not yet been captured.

### Requested effects

- Kilohearts and Effectrix2 establish expected parameter vocabulary: bit depth plus sample-rate reduction for Crush; semitone/grain/jitter controls for Pitch; frequency/polarity/stereo for a basic Comb; frequency, LFO, waveform, spread, and drive/bias for Ring; crossfade and synced/free windows for Reverse; vowel selection and Q for formant/Talk Box; delay/rate/depth/spread/feedback for Flange and vibrato-family modulation; and drive/type/bias/dynamics for Dirty.
- Koala's public contract names a “Talkbox formant filter,” so this roadmap does not turn Talk Box into a carrier/modulator vocoder with a sidechain.

### Advanced Comb direction

- A basic feedforward comb mixes a signal with a delayed copy; polarity moves the repeated notches/peaks and opposite channel polarity can create mono-compatible width.
- Vesa Norilo's vectored time-varying comb work generalizes a comb/feedback-delay network into time-varying and nonlinear domains, including chorus, flanger, pitch, Hadamard coupling, and hybrid effects.
- Canfield-Dafilou and Abel's modal dispersive-filter work shows that comb modes can have frequency-dependent delay, independently shaped damping, time-varying mode frequencies, and input-level-dependent decay.
- Published physical-modeling work places allpass dispersion and time-varying feedback inside comb loops to move beyond a perfectly harmonic metallic series.

SeqFX will therefore prototype multiple advanced topologies and select by frozen listening evidence, stability, and CPU rather than branding a conventional delay as “cutting edge.”

## 7. Target product model

### Stable effect IDs

Persisted effect IDs are append-only:

| ID | Effect | Compatibility rule |
|---:|---|---|
| 0 | Empty | Existing |
| 1 | Filter | Existing |
| 2 | Crush | Existing Crusher ID; display name changes only |
| 3 | Tape Stop | Existing ID; v5 parameters migrate explicitly |
| 4 | Stutter | Existing |
| 5 | Pitch | New |
| 6 | Comb | New |
| 7 | Ring | New |
| 8 | Reverse | New |
| 9 | Talk Box | New |
| 10 | Vibro | New |
| 11 | Flange | New |
| 12 | Dirty | New |

No effect ID may be renumbered after this roadmap begins. Display labels may change without altering IDs.

### Effect definition module

Create one deep TypeScript domain module that owns the public effect vocabulary:

- stable ID, name, short label, and fontaudio-backed identity;
- parameter IDs, units, ranges, defaults, scaling, snapping, display formatting, and aux eligibility;
- trigger-latched versus continuously modulated parameters;
- capture and tail policy tags;
- factory effect presets;
- state parsing and projection helpers.

Callers ask this module for an effect definition or a formatted parameter; they do not duplicate switch statements, limits, labels, or default vectors. Cmajor retains compile-time DSP constants, with a contract test proving its IDs/ranges/defaults match the definition module.

### Sparse state v7

Replace dense empty-step persistence with a sparse block document:

```text
SeqFxStateV7
  version: 7
  patterns[12]
    revision
    chains[4]
      blocks[]
        startStep
        length
        effectType
        mix
        params (current effect only)
        aux (only enabled/non-default data)
        memories? (only effect types actually visited on this block)
        stepOverrides? (rare legacy continuation-cell differences, without a false retrigger)
```

Rules:

- Blocks in one chain are sorted, in bounds, and non-overlapping.
- A block owns one effect type and one trigger at its start. Continuation cells are a runtime projection, not persisted objects.
- Default values are omitted at the storage projection and restored by the parser.
- `seqfx.v7` contains `version: 7`; the key and version no longer disagree.
- The bridge reads v7 first, otherwise parses and migrates the legacy `seqfx.v6` version-5 payload.
- Legacy inactive-cell defaults are discarded because they have no audible meaning.
- Legacy active contiguous steps become blocks and keep mix, current parameters, aux state, and meaningful per-effect memories.
- Legacy per-cell values inside one non-retriggering block remain optional sparse `stepOverrides`; splitting them into new blocks would change trigger/capture behavior.
- Migration is idempotent and never rewrites state until parsing succeeds.
- Preset parsing is strict; malformed public presets fail with a useful typed error instead of silently becoming Init.
- Runtime upload remains a dense fixed-size projection so the Cmajor event contract stays deterministic.

Targets:

- default serialized v7 state below 16 KiB;
- a deliberately dense 12-pattern stress state below 256 KiB;
- no state write for pointer previews; one write for each committed gesture;
- migration round-trip and audible upload equivalence tests for legacy fixtures.

### Effect lifecycle state machine

Every effect declares one lifecycle policy:

- `gated`: processes while its block is active and exits through the standard short crossfade;
- `captured`: owns a captured audio window and may need a fill/play state;
- `gesture`: continues a bounded one-shot gesture after the trigger block when its contract calls for it;
- `tail`: accepts no new input after release but may decay audibly;
- `modulatedDelay`: keeps its delay state warm and exits click-free.

The chain processor owns transitions among `idle`, `entering`, `active`, `released`, and `resetting`. Effect code does not independently invent block-end behavior.

The research benchmark decides the bounded overlap/retrigger policy for Tape Stop, Reverse, Pitch, Stutter, and Comb. Whatever policy is selected must be explicit, resource-bounded, and tested on a third trigger before completion; it cannot merely overwrite a live read head.

Reset events are explicit:

- host transport stop;
- discontinuous host seek;
- loop/rate changes that invalidate timing;
- authoritative pattern replacement;
- sample-rate reset;
- plugin disable where the bypass contract requires a flush.

Editing a future block must not kill the block or tail currently sounding.

### Shared time-buffer architecture

Before adding Pitch, Reverse, Vibro, Flange, or a new Tape Stop buffer, run a Cmajor memory/codegen probe for:

- one shared rolling history per chain for Tape Stop, Stutter, Reverse, and granular Pitch where safe;
- a compact modulation-delay bank per chain for Comb, Vibro, and Flange;
- the maximum supported gesture/window at 44.1, 48, 88.2, 96, and 192 kHz;
- two overlapping captures/gestures if benchmark evidence requires them.

Choose the smallest architecture that passes the behavior contract. Do not allocate a full maximum-size buffer per effect per chain by default.

Fractional reads use a named interpolator with measured aliasing/error. Speed-up paths need antialiasing or a documented quality limit. Feedback paths include explicit stability clamps, DC control, denormal protection where needed, and no unbounded sample values.

## 8. Effect contracts and implementation tasks

Every effect task includes all of these deliverables:

1. effect-definition entry and stable parameter schema;
2. state parser/default/migration support;
3. dense upload projection and Cmajor contract;
4. DSP implementation with click-safe enter/exit/retrigger;
5. aux modulation support only for parameters that can safely move at audio/control rate;
6. inspector editor using shared controls and real units;
7. at least three factory effect presets plus one full-pattern demonstration;
8. focused TypeScript behavior tests, Cmajor probes, and browser tests;
9. matched-level audio renders on impulse, sine, noise, drums, chord, bass, and speech where relevant;
10. decision/evidence entry for any behavior not dictated by the sources.

### FX-00 — Filter qualification

- Preserve current LP/HP/BP identity and range editor.
- Verify cutoff/Q stability at every supported sample rate.
- Make mode/cutoff/Q/curve units and modulation ranges consistent with the shared definition module.
- Fix containment, contrast, keyboard operation, and block-copy recall.
- Acceptance: existing Filter states upload equivalently, no instability/NaN in parameter sweeps, and the editor fits every supported geometry.

### FX-01 — Crush v2

Evidence-backed control set to prototype:

- bit depth;
- sample rate / hold rate in Hz rather than only opaque frames;
- drive;
- tone or band balance;
- character mode covering at least classic sample-and-hold and smoothed/interpolated reduction.

Requirements:

- Persist ID `2` and migrate existing bits/hold/drive exactly.
- Correct gain order so drive does not clamp the input before gain is applied.
- Add optional dither only if it wins the listening fixture; never add nondeterministic noise without a deterministic test seed seam.
- Prevent DC and constrain output.
- Acceptance: existing patches sound unchanged in legacy mode, new rate mapping remains stable across sample rates, and at least one musical low-rate setting avoids the current brittle all-or-nothing sweet spot.

### FX-02 — Tape Stop v2

Implementation begins only after the benchmark report is complete.

Controls committed by current evidence:

- Stop Time with tempo-synced values and a free-time mode;
- Curve with a centered, useful mapping;
- an explicit restart/return behavior derived from the benchmark;
- independent restart time when the selected return mode accelerates;
- block mix through the common block control.

Controls or modes **not** committed until benchmark evidence resolves them:

- hold after full stop;
- dry signal under the stopped tail;
- instant catch-up as default versus optional mode;
- overlap count and voice-steal policy;
- whether block end releases the motor or a triggered gesture completes independently.

Required behavior:

- A one-cell trigger can produce a slowdown longer than one cell.
- Stop-time position is easy to tune around one cell, one beat, and one bar; the UI offers musical snaps without trapping free values.
- The displayed minimum is honest and useful; no `0.005` value rendered as a misleading `0.01`.
- Speed and pitch follow one variable-speed trajectory.
- Restart/catch-up has no read-head teleport click.
- Retrigger, loop wrap, seek, tempo change, bypass, and pattern switch follow the recorded contract.
- Acceptance includes A/B renders against the benchmark products, not only envelope math.

### FX-03 — Stutter v2 qualification

- Keep the useful current controls: slice count, playback speed, envelope shape, and gate.
- Compare current capture-first behavior against Effectrix/Looperator loopers and document why SeqFX captures the chosen region.
- Add synced/free slice vocabulary only where it improves over block-relative slice count.
- Decide reverse/alternating direction here only if it does not make the separate Reverse effect redundant.
- Preserve click-free wrap crossfades across playback speeds and slice-count modulation.
- Acceptance: first repeat begins at the documented boundary, fast retrigger does not murder the active audio, and no stale buffer crosses a seek/pattern authority change.

### FX-04 — Pitch

Prototype a granular, delay-line pitch shifter with:

- pitch in semitones;
- optional fine cents if it remains usable in the inspector;
- grain size;
- jitter/variation;
- stereo spread.

Requirements:

- Define and report algorithmic latency; if latency varies, report the maximum or choose a fixed-latency contract.
- Crossfade grains with complementary windows and prevent phase-reset clicks.
- Keep pitch stable for sine and sustained-chord fixtures; characterize transient smear separately.
- Support musical semitone snaps and continuous aux sweeps without zippering.
- Acceptance: ±12 semitones and an octave-down drum setting are useful, no unbounded level/NaN occurs, and host bypass/recall does not shift timing unexpectedly.

### FX-05 — Comb: advanced signature effect

Build a lab with three independently implemented candidates:

1. **Reference Comb** — fractional feedforward/feedback comb with tune, polarity, feedback/decay, damping, and Kilohearts-style mono-compatible opposite-polarity stereo option.
2. **Dispersive Comb** — feedback comb with allpass/modal dispersion so resonances can bend away from a perfectly harmonic metallic series, plus frequency-dependent damping.
3. **Vector Comb** — a small coupled delay bank with orthogonal/Hadamard cross-feedback, controlled time variation, stereo rotation, and a saturating feedback option.

Render the same pluck, drums, bass, chord, voice, impulse, and noise fixtures at matched output level. Score:

- immediately useful sweet-spot width;
- distinctiveness from ordinary comb and the existing Spectral Chord Resonator;
- tune stability;
- transient response;
- controllable decay;
- stereo interest and mono collapse;
- modulation artifacts;
- CPU/memory cost;
- runaway/denormal risk.

The product version may combine candidates only after the component candidates are understood. The likely control vocabulary is Tune, Feedback/Decay, Polarity, Dispersion, Damping, Motion, Drive, and Width/Coupling, but the lab must earn the final mapping.

Originality rule: implement from published equations and independently written code. Do not copy third-party source or duplicate another product's exact control layout/preset names.

Acceptance:

- It can act as a clean conventional comb at neutral advanced settings.
- At least one advanced setting produces stable material/string/spring-like color unavailable from a conventional one-delay comb.
- Fundamental tuning error is measured over the supported range.
- Feedback cannot run away under any allowed parameter or aux sweep.
- Stereo mode has a documented mono result.
- The selected topology and rejected alternatives are recorded with audio and CPU evidence.

### FX-06 — Ring

Prototype controls from established Ring implementations:

- carrier frequency with Hz and optional musical ratio/note snaps;
- waveform;
- LFO amount and synced/free rate;
- stereo spread;
- bias/rectification;
- drive or output trim if needed for character/gain control.

Requirements:

- Use phase-continuous oscillators unless the benchmark supports retriggered phase as a useful explicit mode.
- Oversample or band-limit discontinuous carrier shapes where aliasing is audible.
- Acceptance: sine-carrier sidebands match an oracle, stereo spread collapses safely, and fast block transitions are click-free.

### FX-07 — Reverse

The benchmark must explicitly choose among:

- pre-roll reversal of already captured audio with zero added latency;
- capture-then-play reversal with one-window latency;
- a fixed-latency lookahead architecture that aligns the reversed region to the authored block.

Do not hide that tradeoff.

Controls:

- synced/free window or block-relative window;
- crossfade percentage/time;
- playback speed only if it stays distinct from Pitch and Stutter;
- capture/source mode if more than one mode survives the benchmark.

Requirements:

- UI explains unavailable future audio rather than silently returning unexplained silence.
- Window boundaries use complementary crossfades.
- Loop wrap, first-run empty history, seek, and repeated blocks have explicit behavior.
- Acceptance: a known numbered spoken phrase reverses the intended region, onset timing is measured, and no old-project audio leaks after an authoritative reset.

### FX-08 — Talk Box

Implement the requested Koala-style formant effect, not a sidechain vocoder:

- vowel A;
- vowel B;
- vowel morph;
- resonance/Q;
- low-frequency passthrough;
- high-frequency passthrough;
- optional drive.

Requirements:

- Use a documented vowel/formant table with interpolation in perceptual/log frequency.
- Smooth coefficient movement and keep filters stable at every supported sample rate.
- Give the inspector a literal vowel/morph display, not anonymous frequency knobs.
- Acceptance: vowel endpoints are distinguishable on speech and saw fixtures, morph is smooth, and extreme Q remains bounded.

### FX-09 — Vibro

Vibro is wet variable-delay pitch modulation without the dry comb that defines flanging.

Controls:

- synced/free rate;
- depth in cents or delay excursion with a musically honest display;
- base delay where required by the algorithm;
- waveform;
- stereo phase/spread;
- drift/randomness only if it wins the listening test.

Requirements:

- Fractional delay interpolation must not add zipper noise.
- Neutral depth is exact pass-through under the common block mix law.
- Acceptance: measured modulation depth/rate match the display, stereo does not disappear unexpectedly in mono, and the effect is clearly distinguishable from Flange.

### FX-10 — Flange

Controls:

- base delay;
- modulation depth;
- synced/free rate;
- feedback magnitude with explicit Normal/Inverse loop polarity;
- stereo spread;
- polarity;
- optional barber-pole/scroll mode only if its CPU and sound justify the added surface.

Requirements:

- Preserve state while active; use a click-safe entry/exit.
- Clamp the feedback loop after modulation and interpolation, not only the UI value.
- Acceptance: classic jet flange, subtle widening, and one moving-feedback preset are useful; feedback remains stable; mono behavior is documented.

Production status: implemented with a 0.2–10 ms minimum delay, 0–10 ms added
depth, Free or host-synchronized motion, a separate feedback-magnitude and
polarity contract, 25 ms feedback history, four-point Hermite reads, bounded
writes, phase-continuous retriggers, and no output tail. Scroll/barber-pole mode
was omitted because its conditional listening/CPU gate had no evidence. DSP,
source-browser, packaged-browser, and generated-runtime proofs are complete;
the named subjective preset and native-host gates remain in Phase 8. See
`research/seqfx/flange-decision.md`.

### FX-11 — Dirty

Dirty is a character distortion, deliberately distinct from Crush's digital resolution loss.

Prototype:

- drive;
- character/type (soft saturation, hard clip, fold, asymmetric/biased);
- bias;
- dynamics preservation;
- tone;
- output compensation/trim.

Requirements:

- Use fixed quality oversampling for alias-prone nonlinear modes if the measured improvement justifies cost.
- Remove DC after asymmetric modes.
- Loudness-match factory presets and preserve useful input dynamics where the Dynamics control says it will.
- Acceptance: matched-level A/B proves character rather than simple loudness, DC and alias tests pass, and allowed sweeps remain finite.

## 9. Product and UI polish tasks

### UX-01 — Complete global control surface

- Bind visible controls to real endpoints for SeqFX On, global mix, pattern, clock source, manual BPM, rate, swing, loop start, loop length, internal play, and reset.
- Hide manual-only controls when host clock owns them, or clearly disable them with an explanation.
- Show the loop range directly on the 32-step ruler and make edge drag/move behavior keyboard-accessible.
- Add undo/redo with a bounded in-memory edit history; host/preset loads create explicit history boundaries.
- Add Init, clear-loop, copy-loop, paste-loop, and safe randomization only after their mutation contracts have tests.
- Avoid duplicate authority: host parameters own automatable globals; the sparse document owns authored patterns/blocks.

### UX-02 — Effect discovery and inspector information architecture

- Replace the icon-only picker with a named, keyboard-navigable grid/menu that fits all 12 effects without horizontal guessing.
- Use fontaudio for audio/effect identities and preserve a cheap identity seam for future replacement.
- Keep common Block Mix and Effect/Mod tabs in a fixed location.
- Give each effect a concise primary panel and an expandable advanced panel only when needed; do not make users scroll past every advanced parameter to reach the common controls.
- Display honest units: Hz/kHz, ms/s, note divisions, semitones/cents, dB, percent, Q, bits, samples where unavoidable.
- Reuse shared number entry, slider, tick, modulation-range, and focus primitives.
- Make selected block, chain, effect, and step range readable as text.

### UX-03 — Grid and chain polish

- Restore visible `Chain 1..4` labels and keep effect short labels inside blocks.
- Make block colors supplementary; text and accessible names carry effect identity.
- Keep create, resize, move, copy-paint, multi-select, cross-chain move/copy, paste, and delete behavior intact for all new effect types.
- Show invalid drops before commit and preserve one undo step per gesture.
- Make playhead, loop, selection, trigger, copied preview, and disabled state visually distinct.
- Ensure adjacent blocks of different effect types never merge.

### UX-04 — Responsive geometry and visual quality

Supported proof sizes:

- 1120×680 manifest default;
- 900×600 compact desktop/plugin;
- 720×520 minimum supported editor;
- one wide 1440×800 resize check.

At each size:

- no page, inspector, primary editor, advanced editor, picker, readout, or modulation row overflows its owned region;
- no control is clipped behind the footer/header;
- scroll exists only inside the intended inspector body;
- effect picker and pattern row remain usable;
- minimum interactive target is 24 CSS px on desktop, larger where the existing shared touch treatment requires it;
- normal text meets WCAG AA 4.5:1 and large/decorative text is classified correctly;
- focus rings are visible;
- reduced-motion mode removes nonessential movement without hiding state;
- zoom from 80% through 200% does not make core controls unreachable.

Capture named visual-regression screenshots for empty state and every effect's selected inspector at default and compact geometry.

### UX-05 — Presets, onboarding, and documentation

- Provide Init plus at least three musically named effect presets per effect.
- Provide at least twelve full SeqFX patterns spanning drums, vocals, bass, sustained harmony, transitions, and subtle utility.
- Presets must be level-conscious and must not depend on unavailable external audio.
- Add a compact in-product first-use hint for drawing, resizing, selecting an effect, and opening modulation; it must dismiss and stay dismissed for the plugin instance.
- Write `SEQFX_USER_GUIDE.md` with clocking, blocks, triggers/tails, each effect, modulation, state/preset behavior, and host limitations.
- Write release notes and a known-issues section from verified facts.

## 10. Architecture and implementation sequence

### Phase 0 — Freeze and remeasure the baseline

Tasks:

- `P0.1` Install worktree-local JS dependencies without linking another worktree's dependency tree.
- `P0.2` Record git/base/build-tool/compiler versions.
- `P0.3` Run focused state/runtime/browser/DSP probes and save exact pass/fail counts.
- `P0.4` Measure default and dense state byte size.
- `P0.5` Build the production VST3 and reproduce strict plugin validation.
- `P0.6` Capture default 1120×680 and compact screenshots plus geometry/contrast measurements.
- `P0.7` Render baseline audio fixtures for the four existing effects.
- `P0.8` Record baseline build time, binary size, Cmajor memory/codegen limits, and representative CPU.

Exit: `research/seqfx/baseline.md` contains commands, versions, outputs, screenshots/audio paths, and known unrelated failures.

### Phase 1 — Research and behavioral contracts

Tasks:

- `P1.1` Complete Tape Stop official-document matrix.
- `P1.2` Inventory locally installed competitor plugins; do not install a paid/demo product without separate authorization.
- `P1.3` Run available Tape Stop listening captures and measurements.
- `P1.4` Complete requested-effect benchmark matrix.
- `P1.5` Complete Comb paper/product matrix and independently implement lab candidates.
- `P1.6` Record chosen and rejected Tape, Reverse, Stutter, Pitch, and Comb lifecycle behaviors.
- `P1.7` Convert settled behavior into executable fixture expectations.

Exit: no production Tape Stop or Comb code begins with an unresolved core behavior disguised as a default.

### Phase 2 — Release blocker and domain foundations

Tasks:

- `P2.1` Name audio buses `Input` and `Output`; add a regression test around the patch contract.
- `P2.2` Create the effect-definition domain module and replace duplicated UI switch tables incrementally.
- `P2.3` Add append-only effect IDs 5–12 and contract tests against Cmajor.
- `P2.4` Implement strict v7 boundary parsers and sparse state projection.
- `P2.5` Implement v6/version-5 migration with frozen real fixtures.
- `P2.6` Implement sparse edit operations behind the existing mutation interface or a narrower replacement, preserving observable block gestures.
- `P2.7` Expand sparse state into the existing dense runtime upload.
- `P2.8` Add state-size, round-trip, migration, malformed-input, and preset tests.
- `P2.9` Implement undo/redo at committed mutation boundaries.

Exit: current four effects work through v7; old state recalls; default state target is met; focused UI and DSP suites are green.

### Phase 3 — Lifecycle and buffer foundations

Tasks:

- `P3.1` Implement the explicit chain/effect lifecycle state machine.
- `P3.2` Add future-edit versus current-sounding-state discrimination.
- `P3.3` Run shared-buffer memory/codegen probes and choose the architecture.
- `P3.4` Add named fractional-delay interpolation and quality tests.
- `P3.5` Add tail/gesture output routing and bounded retrigger behavior from the benchmark.
- `P3.6` Add seek, loop, tempo, pattern-authority, bypass, and reset semantics.
- `P3.7` Add click/discontinuity, finite-output, and buffer-leak probes.

Exit: existing effects still pass, a synthetic test tail survives its block correctly, and invalid history never crosses an authoritative reset.

### Phase 4 — Tape Stop v2 and simple streaming effects

Order:

1. Tape Stop v2
2. Crush v2
3. Ring
4. Talk Box
5. Dirty

For each effect: write failing behavior fixtures, implement DSP, add state/upload/UI, render audio evidence, then commit a clean checkpoint.

Exit: five production effects meet their individual contracts and the complete focused SeqFX suite stays green.

### Phase 5 — Delay/modulation effects and advanced Comb

Order:

1. Comb lab selection and production Comb
2. Vibro
3. Flange

Share only proven delay/interpolation machinery; keep each effect's user-facing vocabulary and lifecycle separate.

Exit: all three pass stereo/mono, modulation, stability, CPU, and visual proof; the Comb decision record includes rejected candidates.

### Phase 6 — Captured/time-remapping effects

Order:

1. Pitch
2. Reverse
3. Stutter v2 final qualification

Checkpoint: Pitch is complete through measured DSP, sparse state, sequenced
source UI, packaged UI, and decision evidence. Reverse is the active slice;
subjective Pitch listening and Ableton timing remain Phase 8 gates.

These arrive after buffer/lifecycle foundations because their latency/capture contracts are the most coupled.

Exit: all requested effect types are available in every chain, can be copied/moved/persisted, and pass their timing/audio fixtures.

### Phase 7 — Product polish and content

Tasks:

- `P7.1` Complete the global control surface.
- `P7.2` Replace effect picker and restructure inspector.
- `P7.3` Repair chain/grid labeling and all current formatting defects.
- `P7.4` Complete responsive/contrast/focus/reduced-motion work.
- `P7.5` Add factory effect presets and full patterns.
- `P7.6` Add onboarding hint, user guide, release notes, and known issues.
- `P7.7` Run visual review at every supported size and repair every named overflow/contrast defect.

Exit: no known formatting/visual defect remains in the release ledger; every requested effect is discoverable without memorizing an icon.

### Phase 8 — Qualification and release candidate

Tasks:

- `P8.1` Review source and scoped diff before broad gates.
- `P8.2` Run focused tests again after review repairs.
- `P8.3` Run the complete relevant Node/browser/Cmajor suites once the source is review-clean.
- `P8.4` Build universal macOS VST3 from the clean commit.
- `P8.5` Run strict `pluginval`, codesign verification, bundle inspection, and clean-host discovery.
- `P8.6` Install the candidate only after checking no other task is using the installed SeqFX path.
- `P8.7` Run Ableton insert/UI/audio/automation/project-save/reopen/preset/transport tests.
- `P8.8` Run the structured listening matrix and record human acceptance separately from automation.
- `P8.9` Port and review release packaging from the historical release branch.
- `P8.10` Generate package, zip, checksum, build manifest, and release notes from a clean commit.
- `P8.11` Sign/notarize/staple only when valid Developer ID identities and the approved notary profile are available.
- `P8.12` Test install on a Gatekeeper-enabled clean macOS account/machine when available.
- `P8.13` Produce the exact coordinator handoff; do not merge, push, deploy, or upload.

Exit: a committed clean release-candidate branch and reproducible artifact exist, with external/user gates plainly identified.

## 11. Verification matrix

### Domain/state

- strict accept/reject tests for v7;
- v6/version-5 migration fixtures from empty, sparse, dense, malformed, and per-effect-memory states;
- property tests for block normalization, non-overlap, bounds, copy/move/resize, and serialize/parse idempotence;
- undo/redo behavior through public mutations;
- default and stress byte-size limits;
- preset apply/serialize and host stored-state recall.

### DSP

Run at 44.1, 48, 88.2, 96, and 192 kHz where the Cmajor test runner supports it:

- silence in/silence out and finite output;
- impulse response and tail duration;
- sine frequency/pitch oracle;
- logarithmic parameter sweep;
- hard trigger/release/retrigger discontinuity measurement;
- transport stop, seek, loop wrap, rate and tempo change;
- pattern replacement while current/future blocks differ;
- maximum feedback and aux modulation stress;
- mono input, dual-mono input, stereo input, and mono-collapse checks;
- deterministic repeated render where randomness is not a product feature;
- buffer-clear/no-old-audio tests.

### UI/browser

- effect picker exposes all stable IDs and names;
- every effect editor mounts, edits, formats, commits, recalls, and modulates its supported controls;
- copy/move/resize/multi-select/cross-chain gestures preserve new effect state;
- global endpoints and host updates round-trip;
- undo/redo boundaries;
- keyboard/focus/accessibility names;
- default/compact/minimum/wide geometry and overflow;
- contrast measurements on text and essential state indicators;
- packaged shadow-root flow, not only dev source;
- generated-bundle/source-content provenance after UI changes.

### Host/release

- Cmajor patch dry-run/codegen;
- dedicated universal VST3 build;
- binary architectures and bundle metadata;
- strict codesign verification;
- strict `pluginval` including cold open;
- Ableton rescan, insert, UI open/resize, audio, automation, transport, save/reopen, preset recall, and multiple-instance stress;
- packaged artifact install/uninstall instructions;
- checksum and manifest reproducibility;
- notarization/stapling/Gatekeeper when credentials/environment exist.

## 12. Performance and quality budgets

Phase 0 records the machine-specific baseline. Final acceptance requires:

- no audio dropout in a ten-minute worst-case four-chain Ableton stress session;
- no single newly selected effect causing an unexplained >25% CPU regression against the closest relevant baseline fixture without an accepted quality tradeoff;
- release-build binary and state-size changes recorded, not hidden;
- default stored state below 16 KiB and dense stress state below 256 KiB;
- no non-finite sample in any automated sweep;
- no allowed feedback path whose impulse response grows after input stops unless self-oscillation is an explicit, bounded product mode;
- all reported latency fixed/documented and supplied to the host where required;
- no audible transition click in the structured listening pass, with automated discontinuity metrics used as screening evidence rather than a substitute for listening.

## 13. Release and distribution boundary

This roadmap creates a release candidate, not an unauthorized public release.

Before public beta distribution, the user or coordinator must settle:

- public display name (`SeqFX`, `Cosimo SeqFX`, or another approved name);
- final bundle identifier instead of the current `dev.cosimo.seqfx` if desired;
- durable plugin/manufacturer codes;
- beta version string;
- support email and release-note voice;
- Patreon tier/product and whether the upload is a member post or digital product;
- permission to sign/notarize using the configured identities/profile;
- permission to upload/publish.

The implementation task must not infer these from a build succeeding.

## 14. Decision register

| Decision | Status | Why | Rejected alternative | Downstream consequence |
|---|---|---|---|---|
| Keep four serial chains and 12×32 composition model | Committed | Existing product contract is useful and the request expands effects, not sequencer dimensions | Rebuild as Effectrix-style fixed effect rows | New work focuses on effect quality/state/polish and preserves existing projects |
| Requested effects are block types, not a live XY page | Committed | Direct user requirement | Clone Koala's live surface | All state/DSP/UI work routes through the current block model |
| Keep Filter | Committed | It is an existing useful effect; the requested list was additive/narrowing for new Koala effects | Remove anything not named in the Koala list | Existing Filter projects and current product capability survive |
| Rename Crusher display to Crush, preserve ID 2 | Committed | Matches requested vocabulary without breaking recall | Add a second Crush ID or renumber | Migration is simple and old projects remain addressable |
| Vibro and Flange are separate IDs | Committed from wording | The user listed both, while Koala combines them | One bipolar Vibro/Flange block | Clearer authored intent and independent focused controls |
| Sparse v7 block state | Committed engineering direction | Removes hundreds of kilobytes of empty repeated state and creates one coherent version boundary | Extend dense version 5 again | Requires migration, but lowers host-state risk and effect-expansion cost |
| Tape is a trigger-latched motor gesture with explicit Stop Time, Curve, Catch Up/Spin Up, optional Start Time, and Sync/Free timing | Committed and implemented | Official mature-product vocabulary plus the frozen benchmark; block end does not define motor lifetime | Invent Tail/Throw controls or keep the old block-bound ramp | Two gesture voices, tiered history, explicit v5 migration, and a dedicated v2 inspector |
| Crush uses Original/Classic/Smooth/Progressive characters plus ADC Q, DAC Q, and deterministic Dither | Committed and implemented | Kilohearts, Effectrix2, and Redux establish the converter vocabulary; measured fixtures preserve the old sound and distinguish the new modes | Keep opaque Hold Frames or add an overlapping Tone control | ID 2 persists; legacy Hold maps at canonical 48 kHz; Rate is stable across host sample rates |
| Ring uses a phase-continuous carrier with additive Bias, bipolar Rectify, and opposite frequency Spread | Committed and implemented | Kilohearts establishes the core semantics; Effectrix2 and Looperator establish waveform and LFO vocabulary; analytic sidebands provide an exact oracle | Reset phase per block, use a guessed phase-offset Spread, or add a sidechain/Drive that overlaps other products | ID 7 is block-sequenced; Wave latches, other controls can use Aux, max Spread is a documented 25 cents per channel, and internal Motion stays free-running while shared Aux owns tempo sync |
| Talk Box is a two-formant vowel filter, not a vocoder | Committed and implemented | Koala names a formant filter, Kilohearts establishes two resonances/Q/passthrough, and Peterson-Barney supplies measured vowel targets | Guess Koala internals, require a sidechain, or expose anonymous F1/F2 knobs | ID 9 sequences literal From/To vowels; Morph is logarithmic; selection latches while Morph/Q/Lows/Highs/Drive remain Aux eligible; crossover and gain choices are recorded as inference |
| Dirty is a fixed-4x character distortion with residue-only Tone and bounded dynamics restoration | Committed and implemented | Koala establishes the requested identity; Kilohearts and Ableton establish character, bias, dynamics, DC, and quality vocabulary; a measured alias fixture justifies 4x | Treat Dirty as a second Crush, copy undocumented curves, or darken/delay the entire signal for Tone | ID 12 sequences six controls; Character latches and crossfades; continuous controls use Aux; dry Mix remains exact while the nonlinear residue owns DC and Tone processing |
| Comb uses the selected vector-dispersive feedback topology | Committed and implemented | The lab retained recognizable tuning while dispersion, stereo vector coupling, damping, motion, drive, and width created a distinct stable instrument | Ship a conventional one-delay comb or the less controllable modal candidates | ID 6 keeps an exact reference neutral, morphs through the full four-path advanced network, and records measured tuning, tail, stability, mono, reset, browser, and generated-runtime evidence |
| Vibro is a wet-only, phase-continuous Doppler delay with literal Sync/Free timing | Committed and implemented | Academic delay-line theory establishes pure variable delay as vibrato; Kilohearts and Effectrix2 separate the dry-mixed/feedback vocabulary of chorus and flanging; measured depth/rate fixtures provide the oracle | Add feedback/dry combing, guess Koala's private behavior, or ship optional Drift without a listening win | ID 10 sequences Rate, Depth, Wave, Spread, Timing, and Division; its corrected 400 ms history covers the stated slow/deep extreme; Flange remains separately identifiable |
| Flange is a canonical short dry-plus-delay comb with explicit feedback magnitude and polarity | Committed and implemented | Kilohearts, Effectrix2, and published flanger theory converge on Delay, added Depth, Rate, Spread, Feedback, Mix, interpolation, and optional loop inversion | Guess Koala's private behavior, overload a bipolar feedback control with a second Polarity switch, or ship optional Scroll without its listening/CPU win | ID 11 sequences Delay, Depth, Rate, Feedback, Spread, Polarity, Timing, and Division; a 25 ms private history covers the public range; feedback writes are bounded and output is gated without a tail |
| macOS VST3 release candidate only | Inherited | Existing release scope and toolchain | Expand AU/Windows now | Keeps the slice finishable; other formats need their own roadmap |
| No merge/push/deploy/publish by this task | Inherited | Coordinator and user authorization boundary | Treat “end to end” as permission to release | Final result is a clean handoff and artifact, not an external launch |

## 15. Risk register

| Risk | Impact | Mitigation | Release evidence |
|---|---|---|---|
| Cmajor array/codegen limit from new buffered effects | Critical | Shared-buffer probes before production architecture; cap windows explicitly | Codegen/build at supported sample rates and memory ledger |
| Tape behavior still feels wrong despite correct math | Critical | Competitor captures, matched fixtures, listening gate before final default | Benchmark report and A/B renders |
| Reverse semantics are musically misaligned | High | Make latency/pre-roll tradeoff explicit and benchmark it | Spoken-count timing render and host latency proof |
| Pitch latency/transient smear | High | Fixed latency contract, complementary grains, varied source fixtures | Host timing and audio renders |
| Comb instability or “generic metallic” result | High | Three topology lab, stability clamps, matched-level listening | Candidate scorecard, sweeps, selected/rejected record |
| State migration loses old sounds | Critical | Frozen legacy fixtures and dense-upload equivalence | Migration and recall tests plus old-project host check |
| Twelve effects make inspector unusable | High | Named picker, primary/advanced hierarchy, size matrix | Visual/browser proof for every editor |
| UI source and packaged bundle diverge | High | Build-derived artifacts and packaged shadow-root tests | Source-content/provenance and production browser gate |
| Release validation cold-open crash | Critical | Named audio endpoints and strict pluginval early and late | Cold-open strict validation log |
| Shared installed plugin disrupts another task | High | Check running work/installed identity and serialize install | Install ledger and coordinator handoff |
| Signing/notary credentials unavailable | High for distribution, not source | Build unsigned/local candidate; stop at explicit credential gate | Credential audit and unperformed-gate statement |

## 16. Work estimate and critical path

This is a large product tranche, not a patch. Estimates are planning ranges, not promises:

| Tranche | Engineering days | Critical dependency |
|---|---:|---|
| Baseline and research | 5–8 | Competitor availability/listening captures |
| Sparse state/domain foundations | 6–10 | Frozen migrations and effect registry |
| Lifecycle/shared-buffer foundations | 7–12 | Cmajor memory/codegen probes |
| Tape Stop v2 | 5–8 | Tape benchmark decision |
| Crush/Ring/Talk Box/Dirty | 8–14 | Effect registry/lifecycle |
| Comb lab and product Comb | 7–12 | Research, listening, stability/CPU |
| Vibro/Flange | 5–8 | Modulated-delay primitive |
| Pitch/Reverse/Stutter | 9–15 | Captured-buffer and latency decisions |
| UI/workflow/content polish | 8–14 | Stable effect/state surface |
| Host/release qualification | 5–9 | Review-clean source and available credentials/hosts |
| Total | 70–110 | Solo execution; subjective/external gates excluded |

Critical path:

```text
baseline -> benchmark -> state/domain -> lifecycle/buffers
         -> Tape + streaming effects -> Comb/modulated delays
         -> Pitch/Reverse/Stutter -> UI/content polish
         -> source review -> broad gates -> VST3/Ableton/release artifact
```

## 17. Definition of done and handoff ledger

The owner may call the implementation complete only when:

- this roadmap's tasks are checked against an evidence ledger;
- source and generated changes are committed on the named branch;
- the worktree is clean;
- the exact final commit is named;
- changed scope is listed by domain rather than only file count;
- focused and broad test commands/results are recorded;
- built/generated artifacts are named;
- strict validation and Ableton results are separated from browser/Cmajor proof;
- subjective listening and physical clean-machine acceptance are stated as performed or unperformed;
- signing/notarization and distribution status are explicit;
- the decision-provenance objection audit names choices most likely to be challenged, their rejected alternatives, and supporting evidence;
- the integration coordinator receives the exact branch/worktree/commit ledger;
- there is no direct merge, push, deployment, or publication by this task.

## 18. Primary sources

### Products and manuals

- [Sugar Bytes Effectrix2 product page](https://sugar-bytes.de/en/effectrix2)
- [Sugar Bytes Effectrix2 manual](https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf)
- [Sugar Bytes Looperator manual](https://downloads.sugar-bytes.de/manuals/Looperator.pdf)
- [Kilohearts Tape Stop](https://kilohearts.com/products/tape_stop)
- [Kilohearts Bitcrush](https://kilohearts.com/products/bitcrush)
- [Kilohearts Pitch Shifter](https://kilohearts.com/products/pitch_shifter)
- [Kilohearts Essentials effect documentation](https://kilohearts.com/docs/snapins)
- [Ableton Live Audio Effect Reference: Redux](https://www.ableton.com/en/manual/live-audio-effect-reference/#redux)
- [Koala FX official effect list](https://www.elf-audio.com/koalafx/)
- [Arturia Tape MELLO-FI](https://www.arturia.com/products/software-effects/tape-mello-fi/overview)
- [Arturia Tape MELLO-FI FAQ](https://support.arturia.com/hc/en-us/articles/4414426565010-Tape-MELLO-FI-General-Questions)
- [Cableguys ShaperBox 3 manual](https://downloads.cableguys.com/Cableguys-ShaperBox-3-Manual.pdf)

### Primary DSP research

- [Zavalishin and Parker, “Efficient Emulation of Tape-like Delay Modulation Behavior,” DAFx-18](https://www.dafx.de/paper-archive/2018/papers/DAFx2018_paper_9.pdf)
- [Norilo, “Exploring the Vectored Time Variant Comb Filter,” DAFx-14](https://www.dafx.de/paper-archive/2014/dafx14_vesa_norilo_exploring_the_vectored_ti.pdf)
- [Canfield-Dafilou and Abel, “Extensions and Applications of Modal Dispersive Filters,” DAFx-19](https://www.dafx.de/paper-archive/2019/DAFx2019_paper_49.pdf)
- [Oksanen, Parker, and Välimäki, “Physically Informed Synthesis of Jackhammer Tool Impact Sounds,” DAFx-13 archive](https://www.dafx.de/paper-archive/details/tToUh5dFycviheiDn-Cn8g)
- [McNally, “Variable Speed Replay of Digital Audio with Constant Output Sampling Rate,” AES 76](https://secure.aes.org/forum/pubs/conventions/?elib=11618)

### Release authorities

- [Apple Developer ID and notarization guidance](https://help.apple.com/xcode/mac/current/en.lproj/dev033e997ca.html)
- [Steinberg VST3 locations](https://steinbergmedia.github.io/vst3_dev_portal/pages/Technical%2BDocumentation/Locations%2BFormat/Plugin%2BLocations.html)
- [Tracktion pluginval](https://github.com/Tracktion/pluginval)
