# Cosimo Synth Open-Work Roadmap

Updated: 2026-08-25

This roadmap sequences every unfinished entry in `TODOS.txt`. The task file remains
the authority for exact product behavior and acceptance criteria; this document owns
dependency order, safe parallel work, and integration gates.

## Current reality

- The mobile surface and Auto-preview are implemented; they still need the recorded
  real-phone acceptance and tuning decision.
- The Nested Effects Lane foundation is already on `master`: multiple instances,
  Parallel and Frequency Split groups, device add/remove, dynamic modulation targets,
  saved lane state, and the starter chain. Its original remaining gate is the physical
  iPhone/AUv3 pass. The graph drawing, compact layout, branch-tail add buttons, and live
  drag preview remain separate open work.
- URL sharing already compresses, copies, confirms, loads, migrates, and removes the
  fragment. It needs a complete-state audit, stable shipped-wavetable identity,
  realistic size measurements, WebKit coverage, and destructive-failure protection.
- Undo/Redo behavior and architecture are designed, but implementation remains parked
  behind authorization and an all-or-nothing replay proof on desktop and iOS.
- The five distortion and output-polish documents are checked in at the repository
  root. They came from `claude/cosimo-distortion-quality-x0rx9c` at
  `63dd431b15f7ebfd27e9f54406892391a42fd6d7`.
- The Performance tuning page is compiled into development builds only. Phone tuning
  must use a reachable development build unless a separate protected-access product
  decision is made.

## Sequencing decisions

1. Close already-built work before interpreting an open checkbox as a rebuild.
2. Make product decisions early when later engineering depends on them: overall
   amplitude envelope, Global Tune, Polish controls, custom-wavetable service rules,
   and authorization for Undo.
3. Establish shared foundations early but finish broad integrations late. In
   particular, build the Keytrack rules after Global Tune, audit URL sharing early but
   run its final complete-state proof after new saved controls land, and prove Undo
   early but expose it only after every sound-changing surface is stable.
4. Keep one owner for each merge hotspot. Parallel workers should build isolated
   modules and tests; one integrator wires the main screen, top-level synth graph,
   preset/state owners, and generated bundles.
5. Research tickets may finish with a recorded reject/defer result. They do not imply
   production integration.

## Stage 0 — Establish one shared base

1. Land `TODOS.txt`, this roadmap, `FX_GRAPH_DRAWING_FINDINGS.md`, and the five design
   documents together.
2. Record the Nested Effects Lane foundation as built and leave its phone acceptance
   gate open.
3. Make the development-only Performance tuning page reachable from the test phone.
4. Add `Copy settings` before the Auto-preview and MSEG feel-tuning sessions.
5. Freeze one reusable sound corpus and comparison protocol for Distortion, Enhancer,
   the clipper experiment, the Sausage reference, and Polish. It must include drums,
   bass, a bright dense patch, and adversarial near-Nyquist material with level, peak,
   aliasing, DC, latency, reset, and CPU measurements.

## Stage 1 — Close existing work and remove the highest risks

Run these concurrently:

### Physical phone acceptance and Auto-preview

- Verify the shipped Voice layout, filter card, modulation drag navigation, active-tab
  re-tap, wavetable modulation shading, held-note continuity, chord replay, and Mod bar
  default position.
- Tune Auto-preview cadence, stopped-motion timing, final-note length, loop-grid policy,
  and eligible direct edits. Record one result: ship, revise, or reject.
- Verify the existing Effects Lane foundation in the iPhone/AUv3 product.

### Browser audio recovery

- Reproduce the real leave-page/return sequence in Chromium, WebKit, and physical
  Safari while recording the audio context, playback session, worklet progress, graph
  connection, held notes, and output.
- Repair the lifecycle indicated by that evidence. The first intentional touch after
  return must both recover audio where required and perform its intended synth action.

### Early product decisions

- Decide the overall amplitude envelope's signal location, stages, note behavior,
  modulation behavior, Bounce treatment, and Voice-screen location.
- Decide Global Tune range, units, modulation depth, state representation, screen
  location, and Bounce treatment.
- Decide the Polish control surface, medium-compression values, Safe Bass controls and
  slope, lookahead choice, and relationship with the current output safety stage.
- Decide whether Undo is authorized to proceed to its hidden feasibility proof.

### Small correctness work

- Make every newly created or reset effect Mix/Wet control start at 50 percent while
  preserving explicit saved values.
- Make a second tap on the active Mod source close its drawer, and make a different
  source switch the open drawer without a close/reopen flash.

## Stage 2 — Run the interface work in parallel lanes

### Effects graph lane

Keep these changes sequential under one owner because they share placement, drawing,
drag targets, and the same browser surface:

1. Make the three-band Frequency Split compact and collision-free.
2. Add a real tail insertion position and small add button to every trunk and branch.
3. Draw continuous rounded split and merge paths from the final branch positions.
4. Add the lifted effect, following pointer, destination gap, ghost, animated movement,
   successful settle, and cancellation restore.
5. Finish with phone, plugin, and desktop geometry tests plus a real touch pass.

### MSEG, ADSR, and parameter-display lane

1. Make the full-screen MSEG editor an expanded version of the drawer editor while
   leaving the drawer's existing top border and color unchanged.
2. Establish one shared MSEG control and active-surface geometry implementation.
3. In parallel, add longest-axis time orientation and replace the edge-bound timing
   slider with a compact knob that does not increase the row height.
4. Add the tunable non-linear timing response and conduct the live tuning session.
5. Make the shared drag display select purpose-built presentations: real wavetable for
   Index, real filter response for Cutoff, and the existing knob for ordinary values.
6. Extend that same display to show the realized MSEG A/B morph, while the drawer keeps
   the realized shape visible at rest.
7. Redraw ADSR geometry responsively without stretching handles and settle the shared
   ADSR/MSEG color in the composed interface.
8. After geometry is stable, add direction-locked decay/sustain editing, a draggable
   sustain line, and the finger-following value label.

### Mod bar lane

1. Put the bar's dimensions and touch areas behind one proportional geometry model.
2. Scale the complete bar by roughly ten percent, including spacing and safe bounds.
3. Recalculate the default dock position so the larger bar does not worsen the known
   Voice-paddle overlap.
4. Review collapsed, expanded, paging, left/right docking, and modulation dragging on
   representative phones.

### Voice and pitch lane

1. Implement Global Tune and replace the Oscillator-A-derived effect-tracking value
   with keyboard note plus pitch bend plus Global Tune, latching the last pitch for
   effect tails.
2. Turn the accepted overall-amplitude-envelope design into an implementation task and
   build it using the improved ADSR component where appropriate.
3. After the new Voice controls have settled, design and implement the future mobile
   home for Articulations without replacing its existing sound model.

## Stage 3 — Run the sound work in parallel

### Rack Distortion

- Start immediately from `DISTORTION_QUALITY_DESIGN.md`.
- Preserve the six existing controls and add Type: Symmetric, fixed-static-bias
  Asymmetric, or Wavefold. Exactly one selected nonlinear algorithm runs; there are no
  cascaded clippers, moving bias, Drive-macro EQ, or post-distortion tone filters.
- Keep both wet filters before Drive/distortion, the existing DC removal, 4x
  oversampling, zero declared latency, and exact dry at zero Wet. Align the shaped and
  unity oversampled round trips before Harmonics subtraction.
- Andrew's quiet-input phone test supersedes the fixed Type x Drive x Knee table: it
  failed by 12.47 dB at -36 dBFS even though its -18 dBFS pink test passed. Match the
  actual completed wet to dry with one bounded stereo-linked running energy ratio,
  then normalize intermediate Mix from the same running dry/wet correlation.
- Use only the existing production test seam plus one narrow verification entry point;
  do not build a general harness or detour into ADAA, circuit modelling, or unrelated
  rack architecture.

### Enhancer, Sausage reference, and latency proof

Run these concurrently:

- Build the fixed two-band Enhancer as an isolated module from `ENHANCER_DESIGN.md`.
  It remains static, non-modulatable, and part of the final Polish section.
- Reproduce the decoded Sausage Fattener compressor, transfer curve, gains, and macro
  wiring as a deterministic reference lab.
- Prove constant delay reporting and compensation in the desktop plugin, AUv3,
  standalone app, and browser before choosing nonzero lookahead.
- Make the separate build/defer/reject decision for the per-voice tracked Enhancer.
  Its technical feasibility and 0.5x-to-32x harmonic-ratio control are already settled;
  do not repeat that investigation.

### Polish integration

After the Enhancer, Sausage reference, latency proof, and product choices are ready:

1. Build one fixed final chain: Safe Bass, Enhancer, medium compression, soft clipping,
   output trim, and safety.
2. Absorb or explicitly preserve the current output safety stage; do not stack two
   competing terminal shapers by accident.
3. If lookahead is used, keep it constant and report it exactly. Neutral output is then
   delayed identity, not an unmatched bypass.
4. Prove the 60 Hz gain-change floor, safety, smoothing, saved-state recall, and
   level-matched sound approval.

### Independent research

- Capture and test the detail-preserving clipper reference in an isolated lab. It does
  not block Distortion or Polish and may end with a do-not-build result.
- After the Distortion, Enhancer, clipper, and Polish scopes are known, use
  `DISTORTION_FIELD_NOTES.md` to choose at most one genuinely non-duplicative sound
  experiment, or record that none is worth pursuing.

## Stage 4 — Add Keytrack in layers

Global Tune must be complete first.

1. Freeze a code-backed inventory of every qualifying frequency, rate, delay, and
   duration control plus every approved exclusion.
2. Implement one shared logarithmic ratio conversion for pitch-relative frequency,
   tuned delay period, keyboard-scaled rate, and keyboard-scaled duration.
3. Implement one saved Free/Sync/Keytrack mode and one canonical keyboard-pitch feed.
4. Wire in parallel by area:
   - Voice filter, Glide, MSEG, modulation envelopes, and the new amplitude envelope;
   - Effects Lane frequencies, rates, times, and time-derived controls;
   - shared buttons, exact entry, modulation behavior, and live musical/physical
     readouts.
5. Add the flanger Base Delay/Tune control and express its sweep depth musically.
6. If the per-voice Enhancer is approved, make it use the same per-voice pitch authority.
7. After the sound redesigns land, rerun the inventory so their controls cannot escape
   classification.

## Stage 5 — Finish sharing

### URL-only sharing

1. Compare the shared document mechanically with complete preset capture.
2. Store stable shipped-wavetable identity rather than relying only on catalog index.
3. Refuse custom, unavailable, and bounced/sample-backed sources without changing the
   current sound.
4. Measure representative and maximal patches in Safari and Chromium before freezing
   the warning and refusal lengths.
5. Prove exact round trips, visible failure, cancellation, and non-destructive handling
   on desktop and phone.
6. Make the test fail automatically when a new saved sound field is omitted.
7. Repeat the maximal proof after Global Tune, the amplitude envelope, Keytrack, and
   Polish land.

### Custom-wavetable sharing

Only after URL-only sharing passes:

1. Decide storage, content identity, limits, retention/deletion, ownership, privacy,
   abuse controls, missing assets, and anonymous versus account-bound sharing.
2. Develop the storage service and browser upload/download client in parallel against
   the approved content-reference contract.
3. Apply a shared sound only after its exact wavetable has downloaded and verified;
   never substitute a different table after failure.

## Stage 6 — Finish Undo/Redo and qualify the product

### Undo/Redo

Run the hidden feasibility proof early if authorized, but keep public activation last:

1. Prove bounded all-or-nothing restoration on desktop and iOS.
2. Add disabled action grouping that unfinished editors can adopt without exposing a
   partial public history.
3. After all sound-changing interfaces settle, connect parameters, wavetables, Effects
   Lane edits, modulation, MSEG/envelope editing, and Articulations.
4. Make preset, Init, effect-preset, and shared-link replacement clear the history.
5. Replace the separate MSEG and Articulation recovery stores with views of the single
   history.
6. Add menu actions, platform shortcuts, failure messages, memory bounds, editor-reopen
   behavior, host-conflict handling, and physical-device coverage.
7. Expose Undo/Redo only when every enabled direct sound edit is accounted for.

### Final qualification

- Run each task's narrow regression while its failure is still easy to localize.
- At each merged interface wave, rebuild the generated browser bundles rather than
  merging generated output by hand.
- Run the complete desktop, iPhone, browser, state, native DSP, and safety suites.
- Launch the fresh desktop development app, build and install the current VST3, build
  and install the iPhone app/AUv3, and perform the final Safari, phone, and listening
  passes.
- Update `TODOS.txt` with completion evidence and put only durable setup or architecture
  knowledge in `PROGRESS.txt`.
- Deploy only the accepted integrated build.

## Safe parallel ownership

| Work lane | Safe parallel partners | Work that stays sequential inside the lane |
|---|---|---|
| Effects graph | Browser, Voice/pitch, isolated DSP | compact layout, tail points, paths, animation |
| MSEG/ADSR/displays | Effects graph, browser, isolated DSP | shared editor structure before detailed interactions |
| Mod bar | Effects graph, browser, DSP | tap behavior, proportional geometry, scaling, phone review |
| Voice/pitch | Interface-only work and DSP labs | Global Tune, amplitude envelope, top-level synth wiring |
| Browser/sharing | Graph and DSP work | URL-only sharing before custom-file integration |
| Sound/DSP | Most interface work | one integration owner for the final synth/output graph |
| Undo proof | All other lanes while hidden | public activation waits for every sound-writing path |

`DesktopPatchView.tsx`, `WavetableSynth.cmajor`, `FixedFrameOscillator.cmajor`, the
preset/state adapters, and generated bundles are integration chokepoints. Independent
branches should minimize direct edits there; one integrator lands those changes in
dependency order.

## Critical paths

- Product/state: Global Tune decision and implementation -> canonical keyboard pitch
  -> Keytrack -> final complete-state sharing proof -> public Undo -> final platform
  qualification.
- Output sound: checked-in design documents -> Enhancer + Sausage reference + latency
  proof + product decisions -> Polish integration -> listening approval.
- Effects graph: compact branches and tail insertion points -> rounded connections ->
  live drag preview and animation -> touch acceptance.
- Modulation editors: shared MSEG design -> compact timing control -> non-linear live
  tuning; responsive ADSR drawing -> precise ADSR editing.
- Shared custom tables: complete URL-only sharing -> service decisions -> verified
  server-backed custom-wavetable sharing.

## Human decisions to schedule before engineers wait on them

- Auto-preview ship/revise/reject and final timing values.
- Overall amplitude-envelope architecture and placement.
- Global Tune range, representation, placement, and Bounce behavior.
- Shared ADSR/MSEG color and MSEG drag-curve coefficients.
- Final Mod bar size and dock-position approval.
- Per-voice Enhancer build/defer/reject.
- Polish controls, Safe Bass behavior, lookahead, and sound approval.
- Detail-preserving clipper result and the one field-notes experiment, if any.
- Custom-wavetable service ownership/privacy rules.
- Authorization to implement Undo/Redo after its hidden proof.
