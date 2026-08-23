# Sound Speedrun Pipeline — Technical Plan

Status: design complete, not implemented.

Goal: one reusable, entirely browser-side pipeline:

```
Cosimo patch + MIDI performance
  → patch analysis
  → ordered reconstruction recipe
  → cumulative partial-patch audio (WASM engine, offline, in workers)
  → animated phone-UI speedrun with batched captions (Remotion composition)
  → downloadable MP4 (@remotion/web-renderer, WebCodecs)
```

No server-side rendering anywhere. The pipeline must work for arbitrary Cosimo
patches, not one hard-coded example. V1 has no narration, but the design keeps
an explicit seam for future AI narration.

This document is grounded in the current repository. Every load-bearing claim
cites the file that proves it.

---

## 1. Ground truth: what the repo already gives us

The design leans on six existing facts. Everything else is built on top of them.

### 1.1 A patch is `parameters + storedState`, and both are replayable

A complete Cosimo sound is exactly two bags of data:

- **Public parameters** — 140 automatable endpoint values declared in
  `cmajor/WavetableSynth.cmajor` (guard slot 0; 3 × 22 oscillator params;
  voice/global params; 45 hoisted rack params; appended MSEG-rate / ENV-ADSR /
  filterMix params). Declaration order is the frozen host-slot contract
  (`cmajor/WavetableSynth.cmajor:1260`).
- **Structured stored state** — three JSON documents keyed in the patch's
  stored-state store:
  - `modulation.v6` (`ui/shared/modulation.ts:42`) — MSEG shapes/playback for
    3 slots, envelope slot names, macro names, and the route list
    `{sourceKind, sourceSlot, targetKind, polarity, amount, reducer, enabled}`.
  - `rack.v1` (`ui/shared/rack-state.ts:5`) — effect order permutation +
    enabled flags for the 8 rack modules.
  - `articulations.v4` (`ui/shared/articulation-image.ts`) — per-note override
    layers (carried through by the pipeline, not demonstrated in V1).

Both bags exist today in two serialized shapes we must accept:

- **Preset shape** — `EffectPresetV2` `{kind:"cosimo.effectPreset", version:2,
  effectID:"cosimo-synth", contract{hash}, parameters, storedState}`
  (`ui/shared/effects/effect-preset-v2.ts:29`), with migrations available via
  `buildSynthPresetMigrations` (`ui/shared/effects/synth-preset-migrations.ts`).
- **Browser-persistence shape** — `cosimo.web.patch-state.v2`
  `{sound:{parameters, storedState}, auxiliary}` (`web/browser-patch-state.mjs`).

Loading a patch into a running engine is already a solved problem: write the
parameters (`sendEventOrValue`) and the stored-state keys
(`sendStoredStateValue`), and the patch worker services mirror stored state
into runtime installs — `ui/worker/modulation-articulation-worker-service.ts`,
`ui/worker/rack-state-worker-service.ts`, `ui/worker/wavetable-worker.ts`,
composed by `ui/shared/patch-worker-services.ts`.

### 1.2 Defaults are machine-readable

- Parameter defaults are the `init` annotations on the Cmajor endpoints,
  available at runtime from the generated class
  (`WavetableSynth.prototype.getInputEndpoints()`, re-exported by the web build
  in `web/build.mjs:64`). Notable inits: all three `osc*WavetableSelect` = 34
  (`pwm-medicinehat`), `osc*VolumeDb` = −9.542425, `osc*Mute` = 0,
  `filterMode` = 1 (Lowpass), `filterCutoff` = 1000, `filterQ` = 0.707107,
  `filterMix` = 1, envelopes A/D/S/R = 0.01/0.25/0.5/0.2, `mseg*Rate` = 1.0.
- Structured-state defaults are canonical factory functions:
  `createDefaultModulationState()` (`ui/shared/modulation.ts:820`),
  `createDefaultRackState()` — all 8 effects **disabled**
  (`ui/shared/rack-state.ts:76`), `createEmptyArticulationsState()`. The Init
  preset is assembled from exactly these
  (`ui/shared/effects/synth-init-state.ts:222`).
- Rack parameter metadata (label, min/max/step/scale/unit/choices, `initial`,
  `modulationTargetIndex` 0–35) is a complete authored catalog:
  `ui/shared/rack-parameter-descriptors.ts`.

### 1.3 The DSP runs offline, outside an AudioWorklet, faster than realtime

The web build compiles the whole synth (Cmajor → JS + WASM) into a plain class
(`scripts/generate_cmajor_javascript_with_renderer.mjs`, wrapped by
`web/build.mjs` into `build/web/cmaj_Cosimo_Synth.js`). The raw class API, as
exercised by in-repo offline harnesses
(`tests/native/run_three_oscillator_generated_web.mjs`,
`tests/test_seqfx_probe.py`, `bench.py:702`):

```js
const engine = new WavetableSynth();
await engine.initialise(sessionID, sampleRateHz);   // sessionID becomes dspSessionId
engine.setInputValue_oscAVolumeDb(-6, 0);           // per-endpoint setters
engine.sendInputEvent_midiIn({ message: (0x90<<16)|(60<<8)|100 });
engine.advance(n);                                  // n ≤ 128 for the shipped bundle
engine.getOutputFrames_audioOut(channels, n, offset);
engine.getOutputEventCount_runtimeInstallAck(); engine.getOutputEvent_runtimeInstallAck(i);
```

The `--max-frames-per-block` for the product JS bundle is 128
(`scripts/generate_cmajor_javascript_with_externals.sh`); nothing in the DSP
hard-codes a sample rate (everything reads `processor.frequency`). The install
protocols (wavetable `wavetableLoadBegin`/`wavetableMipFrame` with acks;
modulation `modulationProgram`/`modulationAmount`/`modulationMsegBuffer`
(2051-sample padded buffers)/`modulationMsegPlayback`; `articulationSnapshot`;
rack `rackOrder`/`rackEnable`) all key on `dspSessionId == processor.session`
and per-lane delivery serials (`ui/shared/runtime-install-channel.ts`).

This is the foundation of checkpoint audio: we can render any patch state to
PCM deterministically, in a Web Worker, with no AudioContext.

### 1.4 The phone UI is the compact responsive shell, and its geometry is fully specified

The tabbed phone layout (VOICE / FX / MOD + sticky keyboard + floating Mod bar)
is `ui/desktop/DesktopPatchView.tsx` under
`matchMedia("(max-width: 639px)")` (`DesktopPatchView.tsx:3999`), canonically
tested at **393 × 852** (ADR-026, `docs/ADR-026-persistent-mobile-workspace-tabs.md`).
(`ui/ios/IOSPatchView.tsx` is a different, simpler native-shell surface without
tabs/Mod bar — not the video's subject.)

The interaction model the video must demonstrate is precisely constant-defined:

- **Mod bar → parameter mapping drag**: sources live in the perimeter-docked
  Mod rail (`MobileGlobalModRail`, `ui/desktop/effects-rack-workspace.tsx:2024`,
  chips `rack-mod-source-{mseg|env|macro}-{1..}`); a drag activates after
  **7 px** (`ui/shared/mod-source-touch-geometry.ts:1`), the touch preview is
  amplified 2.1–2.5× of finger travel, drop targets are any element with
  `data-modulation-target-kind` (44 px minimum capture box, 12 px hysteresis,
  segment-sweep so flicks land — `effects-rack-workspace.tsx:253-427`), and a
  drop creates an enabled route with **amount 0**
  (`createDefaultRoute`, `ui/shared/modulation.ts:680`).
- **Parameter gesture**: one controller (`ui/shared/parameter-gesture.ts`) with
  a rolling axis classifier (`ui/shared/rolling-axis-classifier.ts`; 8 px touch
  activation, 1.3× to claim an axis, 1.6× over 4 px to switch). **Horizontal =
  base value at 220 px per full range; vertical (up-positive) = modulation
  amount of the armed route at 360 px per full span** (`parameter-gesture.ts:26-28`)
  — exactly the product behavior the brief describes.
- **Effect on/off**: a tap on `rack-enabled-<effectId>` →
  `commitRackState()` (`rackOrder`+`rackEnable` events) + stored `rack.v1`
  (`effects-rack-workspace.tsx:722`, `ui/shared/rack-state.ts:205`).
- Knob artwork constants (viewBox `-3 -3 106 106`, 270° sweep from 225°, mod
  annulus r36→48) live in `ui/desktop/rack-parameter-knob.tsx:49` /
  `ui/shared/parameter-knob-artwork.tsx`.

### 1.5 The UI already runs headless against a mock connection

`ui/shared/patch-connection-mock.ts` (`MockPatchConnection`) is a complete
in-memory `PatchConnectionLike`: parameters with annotations, stored state,
runtime-state/ack simulation — it even runs the real
modulation-articulation worker service against itself. The desktop harness
(`ui/desktop/harness-main.tsx`) mounts the entire real view on it. And the repo
already contains a Remotion project that mounts a **real production view**
inside a composition driven by a mock connection whose state is a pure function
of the frame: `promo/seqfx-teaser/src/components/SeqFxUi.tsx` (Remotion
4.0.451, React 19.2.4 — the same React as the app). The pattern the video layer
needs is proven in-repo.

### 1.6 What Remotion's web renderer can and cannot do

`@remotion/web-renderer` (stable since 4.0.491) renders a React composition to
MP4 (H.264 + AAC) or WebM in the browser via WebCodecs + Mediabunny:

- API: `renderMediaOnWeb({composition:{id, component, durationInFrames, fps,
  width, height}, inputProps, container:"mp4", videoCodec:"h264",
  audioCodec:"aac", sampleRate:48000, onProgress, signal}) →
  {getBlob(): Promise<Blob>}`.
- **DOM capture is emulated**, not screenshotted: a tree walk +
  `getBoundingClientRect`, painting to a canvas. `<canvas>`, `<img>`,
  `<video>`, `<svg>` are captured **natively**; a curated CSS subset is
  supported (flex layout, transforms, gradients, borders/radius, text/font
  properties, basic box-shadow, filters). Unsupported: `z-index`,
  `backdrop-filter`, blend modes, inset shadows, shadow spread, and anything
  not on the list.
- Audio from mounted `<Audio>` (from `@remotion/media`) elements is decoded and
  mixed into the output's audio track; `trimBefore/trimAfter`, `volume`,
  frame-based volume callbacks are supported.
- Browser floor: WebCodecs — Chromium 94+, Firefox 130+ (desktop), Safari 26+
  (AudioEncoder only landed in Safari 26). Practical V1 target: Chromium.

Two consequences shape the whole video layer: (a) the composition must be a
**pure function of the frame number** (Remotion seeks), so we cannot "play" the
live app; (b) heavy CSS effects in the production UI won't survive capture
verbatim, so the video UI must be built from capture-safe primitives.

---

## 2. Architecture overview

Seven stages, each a pure module with one owned data structure. Arrows are
plain function calls / worker messages; there is no shared mutable state
between stages other than the objects named here.

```
                                ┌──────────────────────────────────────────────┐
 patch JSON (preset or          │            ui/speedrun/ (new)                │
 browser-state) ──┐             │                                              │
                  ▼             │                                              │
            [A] patch-io ── PatchDocument + DefaultsSnapshot                   │
                  ▼                                                            │
            [B] analyzer ── PatchAnalysis (what is genuinely in use)           │
                  ▼                                                            │
            [C] recipe   ── SpeedrunRecipe (sections → ops → captions)         │
                  ▼                                                            │
            [D] timeline ── SpeedrunTimeline (frames; THE sync authority)      │
              ▼        ▼                                                       │
 MIDI file ──▶ [E] audio                [F] composition                        │
 (smf.ts)      partial-states           SpeedrunComposition (Remotion)         │
               checkpoint renders        · phone-UI scene (frame-pure)         │
               (worker pool, WASM)       · caption waterfall                   │
               master WAV + blob URL ──▶ · finger/gesture overlay              │
                                         · <Audio src={masterUrl}>            │
                                              ▼                               │
            [G] studio page ── renderMediaOnWeb → MP4 Blob → download          │
                                └──────────────────────────────────────────────┘
```

Ownership summary (one owner per artifact, consumers never mutate):

| Artifact | Owner module | Consumers |
|---|---|---|
| `PatchDocument`, `DefaultsSnapshot` | `ui/speedrun/patch-io.ts` | analyzer, partial-states |
| `PatchAnalysis` | `ui/speedrun/analyzer.ts` | recipe |
| `SpeedrunRecipe` | `ui/speedrun/recipe.ts` | timeline, partial-states |
| `SpeedrunTimeline` | `ui/speedrun/timeline.ts` | audio assembly, composition, studio |
| `NotePerformance` | `ui/speedrun/midi/smf.ts` | checkpoint renderer |
| `CumulativePatchState[]` | `ui/speedrun/partial-states.ts` | checkpoint renderer |
| checkpoint PCM, master WAV | `ui/speedrun/audio/*` | composition (via blob URL), tests |
| MP4 Blob | `ui/speedrun/studio/render.ts` | download UI |

Everything runs in the page and its dedicated workers. The only build-time
prerequisites are artifacts the web build already produces (`npm run
web:build`), plus one small addition (§5.2).

---

## 3. Stage A — Patch intake, normalization, defaults

**Module** `ui/speedrun/patch-io.ts`.

Input: a patch in any of the accepted shapes. Output: one canonical
`PatchDocument` plus a `DefaultsSnapshot`.

```ts
type PatchDocument = {
    label: string;
    parameters: Record<string, number>;        // complete: every one of the 140 endpoints
    modulation: ModulationState;               // parsed modulation.v6
    rack: RackState;                           // parsed rack.v1
    articulations: ArticulationsState;         // carried, not demonstrated in V1
};

type DefaultsSnapshot = {
    parameters: Record<string, number>;                   // annotation.init per endpoint
    annotations: Record<string, EndpointAnnotation>;      // name/min/max/step/unit/text
    modulation: ModulationState;                          // createDefaultModulationState()
    rack: RackState;                                      // createDefaultRackState()
};
```

Mechanics, all reusing existing boundaries:

1. **Shape detection**: `kind === "cosimo.effectPreset"` → preset path;
   `format === "cosimo.browserPatchState"` → browser-state path; a bare
   `{parameters, storedState}` object is accepted as a degenerate preset. Also
   accept "current patch" — read live from an attached connection via
   `requestFullStoredState` + parameter listeners (this is how the studio page
   offers "speedrun the sound I'm hearing").
2. **Preset normalization**: run `normalizeEffectPresetV2` with
   `buildSynthPresetMigrations` so old contract hashes migrate exactly as the
   preset bar does today (`ui/shared/effects/standalone-effect-presets.ts`).
3. **Stored-state parsing**: `deserializeModulationState` (strict v6, throws on
   junk), `deserializeRackState` (defaults on junk — matches product), and
   `parseArticulationsV4` with the route-id set derived from modulation routes
   (mirroring `ui/worker/modulation-articulation-worker-service.ts:76`).
4. **Parameter completion**: any endpoint missing from the document is filled
   with its default. Values are clamped to `[min,max]` and snapped for
   discrete endpoints, using the annotations.
5. **Defaults**: read `getInputEndpoints()` from the engine module (the same
   metadata the UI's parameter bindings and the Init preset already rely on).
   A unit test pins the defaults snapshot against
   `ui/shared/rack-parameter-descriptors.ts` initials and the Cmajor `init`
   values so drift is caught at CI time, not video time.

Failure behavior: intake either returns a `PatchDocument` or a typed
`PatchIntakeError` (unknown shape / failed migration / corrupt modulation doc).
There is no partial acceptance — the pipeline's later stages assume a complete,
valid document.

---

## 4. Stage B — Patch analysis: what is genuinely in use

**Module** `ui/speedrun/analyzer.ts`. Pure function
`analyzePatch(doc, defaults): PatchAnalysis`.

The analyzer never guesses from audio; it derives "in use" from the same data
the engine consumes.

### 4.1 Value diffing

`diffParameters(doc, defaults)` → `ParamDiff[] {endpointID, from, to}` using
per-endpoint epsilon: `max(step/2, span·1e-4)` for continuous, exact for
discrete. Every later rule consumes these diffs; nothing re-reads raw values.

### 4.2 Routes and sources

- **Operative route**: `enabled === true` AND (`amount ≠ 0` OR the route id is
  referenced by an articulation layer — the same rule the runtime program uses,
  where enabled zero-amount voice routes stay installed only for articulation
  (`ui/shared/modulation-runtime-program.ts:282`)). V1 treats
  articulation-only routes as non-demonstrated but keeps them installed.
- **Operative source**: any source addressed by an operative route
  (`mseg-1..3`, `env-1..3`, `macro-1..4`, `velocity`, `pressure`, `slide`,
  identities in `ui/shared/modulation-targets.ts:94`).
- **Source configuration to demonstrate** (only where non-default):
  - MSEG slot *n*: `shapeA`/`shapeB` differ from `createDefaultMsegShape`
    (compare via `msegShapesEqual`), playback policy differs, `msegNRate` or
    `msegNMorph` params differ.
  - ENV slot *n*: any of `envNAttack/Decay/Sustain/Release` diffs.
  - Macro *n*: `macroN` param diff and/or renamed `macroNames[n]`.
  - `velocity`/`pressure`/`slide`: nothing to configure — they exist implicitly.

### 4.3 Oscillators

Per oscillator X ∈ {A,B,C} with the 22 `oscX*` endpoints:

- **audible(X)** = `oscXMute == 0` AND `oscXVolumeDb > −48 + ε` AND (no other
  oscillator has `solo == 1`, or `oscXSolo == 1`).
- **touched(X)** = has any `oscX*` param diff, or is the target of an operative
  route (`oscX.*` target kinds).
- **Demonstrated**: `audible(X)` (an audible all-default oscillator still gets
  a minimal section — it contributes to the final sound, so the reconstruction
  must introduce it; its section is just short). Not-audible oscillators are
  omitted entirely and forced silent in every cumulative state (§7.2).

### 4.4 Voice filter

The "main filter" is the per-voice filter (`filterMode/filterCutoff/filterQ/
filterMix`; targets `filterCutoffOctaves`, `filterQ`, `filterMix`). In use ⇔
any of those params diff from defaults OR an operative route targets them.
(Reminder: defaults are already audible — Lowpass @1 kHz — so "unused filter"
simply means it stays at defaults and gets no section.)

### 4.5 Effects

From `rack.v1`: **active effects** = `enabled[effectId] === true`, presented in
the patch's `order` permutation (that is the FX list's displayed order —
`rack-module-list` renders `rackState.order`). Per active effect:

- relevant settings = param diffs among that effect's descriptors
  (`ui/shared/rack-parameter-descriptors.ts`), *excluding* diffs the enable
  already implies nothing about (the catalog's `initial` is the reference).
- effect modulation = operative routes whose `targetKind` is `rack.<endpointID>`
  of that effect.

The rack "filter" module (`globalFilter*`) is an effect like any other and is
demonstrated on the FX page, distinct from the voice filter.

### 4.6 Global/voice leftovers

Diffs not claimed above (`playMode`, `glideTime`, unclaimed macros) are
collected into a small "voice setup" bucket, attached to the front of the first
oscillator section (they're cheap one-op items; no section of their own).

### 4.7 Output shape

```ts
type PatchAnalysis = {
    sources: SourceUsage[];            // ordered mseg-1..3, env-1..3, macro-1..4 (operative only)
    oscillators: OscillatorUsage[];    // A,B,C order, demonstrated only, with per-osc diffs+routes
    voiceFilter: FilterUsage | null;
    effects: EffectUsage[];            // patch order, enabled only, with diffs+routes
    voiceSetup: ParamDiff[];
    omitted: OmittedReport;            // muted oscillators, disabled fx, inert routes, default params
};
```

`omitted` exists so tests (and the studio's debug view) can assert the analyzer
consciously excluded things rather than losing them.

---

## 5. Stage C — Recipe compilation (sections, ops, captions)

**Module** `ui/speedrun/recipe.ts`. Pure function
`compileRecipe(analysis, doc, defaults, catalog): SpeedrunRecipe`.

### 5.1 Section order (fixed by product behavior)

1. One **Sources** section per operative source that has anything to configure
   (order: MSEG 1..3, ENV 1..3, Macros 1..4). Sources with nothing non-default
   produce no section — they "exist" trivially and appear first when their
   mapping is demonstrated at the target.
2. One section per **demonstrated oscillator** (A, B, C), ops ordered:
   wavetable selection → wavetable index (`framePosition`) → routes onto
   `oscX.wavetablePosition` → warp (`warpMode`, `warpAmount`) → routes onto
   `oscX.warpAmount` → detune (`unisonDetune`, plus `unisonDetuneMode` if
   diffed) → voice count (`unisonVoices`) → remaining `oscX*` diffs and
   remaining `oscX.*` routes, rapid-fire (level, pan, octave/semitone/fine,
   blend/width/spreads, phase/retrigger…).
3. One **Filter** section (if in use): mode (if diffed) → cutoff → resonance →
   routes onto filter targets → remaining (mix, drive).
4. One section per **active effect**, in rack display order: enable toggle →
   its param diffs (quick params first, then the rest in catalog order) →
   its routes.

### 5.2 Ops — the atomic vocabulary

```ts
type UIOp =
  | { kind: "navigate";       to: NavTarget }                       // tab, oscillator tab, fx row select, mod panel
  | { kind: "setParam";       endpointID: string; from: number; to: number;
      surface: SurfaceRef;    weight: OpWeight }
  | { kind: "selectWavetable";osc: OscillatorID; tableIndex: number; tableName: string }
  | { kind: "toggleEffect";   effectId: EffectModuleId; enabled: true }
  | { kind: "mapRoute";       route: ModulationRoute; surface: SurfaceRef }   // drag chip → target, then vertical amount drag
  | { kind: "configureMseg";  slot: 1|2|3; shapeA: MsegShape; shapeB?: MsegShape;
      playback: MsegPlaybackPatch; rate?: number; morph?: number }
  | { kind: "setEnvelope";    slot: 1|2|3; adsr: Partial<{a:number;d:number;s:number;r:number}> }
  | { kind: "setMacro";       slot: 1|2|3|4; value: number; name?: string };
```

`SurfaceRef` names the UI surface the op is performed on (a voice cell, the
filter graph, a rack knob, the wavetable graph) using the same role vocabulary
the product uses (`mobile-voice-cell-<controlID>`,
`rack-parameter-surface-<endpointID>`, `filter-graph-drop-surface`, …) so the
composition and any future real-UI driver agree on targets.

The compiler also inserts the implicit `navigate` ops each section needs
(Sources → MOD tab / source selector; oscillator N → VOICE tab + oscillator
tab; filter → VOICE tab (filter card is on the Voice panel below the
oscillator editor, `DesktopPatchView.tsx:4738`); effects → FX tab + row
select). Navigation is part of the speedrun's visual honesty.

### 5.3 Captions

Every section gets a compact caption block derived from its ops — never
free-typed. Formatting reuses product formatters so numbers read exactly like
the app: `formatRackParameterValue` (`ui/shared/rack-parameter-descriptors.ts:295`),
`formatParameterEntry` specs (`ui/shared/parameter-value-entry.ts`),
`getModulationTargetDisplayLabel` (`ui/shared/target-descriptor.ts:655`),
wavetable names from `assets/factory-bank-catalog.json` (238 tables), macro
display names from the patch's `macroNames`.

Examples of generated lines (mechanical templates, one per op):

```
OSC A                          FILTER                    DELAY
· Wavetable “PWM MedicineHat”  · Cutoff 640 Hz           · On
· Position 0.62                · Resonance 2.4           · Time 1/8. (sync)
· MSEG 1 → Position +0.45      · ENV 2 → Cutoff +2.5 oct · Feedback 45%
· Warp Bend 0.30               · Mix 100%                · MACRO 2 → Mix +60%
· Unison ×5, Detune 0.18
```

Per-section caption cap: 8 lines; overflow folds into `“…+N more”` while the
ops still execute (fast) in the UI. The full uncapped list is retained on the
section object for the future narration track (§12).

### 5.4 The round-trip invariant

`applyRecipe(defaults, recipe)` (in `partial-states.ts`, §7) must reproduce the
patch's audible state: parameters equal within epsilon, modulation routes
set-equal, rack equal — modulo the analyzer's `omitted` report (muted
oscillators keep their persisted-but-inaudible params unreproduced). This
invariant is the pipeline's central correctness property and is enforced by
property-based tests (§11).

---

## 6. Stage D — Timeline assembly (the sync authority)

**Module** `ui/speedrun/timeline.ts`. Pure function
`assembleTimeline(recipe, config): SpeedrunTimeline`.

Fixed rendering parameters: **fps = 30**, audio **48 000 Hz** → exactly
**1600 samples per frame**. All synchronization is integer-frame math; no
runtime sync logic exists anywhere downstream.

```ts
type SpeedrunTimeline = {
    fps: 30;
    durationInFrames: number;
    sections: TimedSection[];
};
type TimedSection = {
    section: SpeedrunSection;         // from the recipe
    startFrame: number; endFrame: number;
    captionEvents: { line: number; atFrame: number }[];   // waterfall schedule
    opSpans: { op: UIOp; startFrame: number; endFrame: number }[];
    checkpointIndex: number;          // which cumulative bounce plays during this section
};
```

### 6.1 Pacing rules (speedrun defaults, config-overridable)

| Item | Frames @30fps |
|---|---|
| section lead-in (captions waterfall begins, UI settles on target surface) | 10 |
| caption line stagger | 4 |
| `navigate` | 10 |
| `setParam` | 13 |
| `selectWavetable` | 18 |
| `toggleEffect` | 9 |
| `mapRoute` (drag 14 + amount drag 11) | 25 |
| `configureMseg` | 26 |
| `setEnvelope` / `setMacro` | 12 |
| rapid-fire overflow ops (beyond the per-section cap) | 5 each, overlapped |
| section tail (hear the change) | 12 |
| section minimum | 48 (1.6 s) |

Ops within a section may overlap the caption waterfall (captions start at
lead-in; ops begin on line-appearance of their caption line — the batched
"waterfall then fly through" feel from the brief).

### 6.2 Global budget

Default target ceiling **90 s** (2700 frames), configurable. If the assembled
duration exceeds the ceiling, compression applies in order: (1) scale op spans
toward floors (`navigate` 6, `setParam` 8, `mapRoute` 16, tail 8); (2) fold
more ops into rapid-fire; (3) as a last resort merge the smallest adjacent
sections' tails. The assembler reports the compression level so the studio can
surface "long patch — compressed pacing".

### 6.3 Audio mapping

`checkpointIndex` for a section = index of the cumulative state **after** that
section completes ("during the first oscillator phase, playback contains only
the completed first oscillator"). Sections before any sound source is complete
(the Sources phase) map to checkpoint −1 = silence; the first oscillator
section is the first audible phase. Section audio sample range =
`[startFrame*1600, endFrame*1600)` — assembled in §7.4.

---

## 7. Stage E — Cumulative states and checkpoint audio

### 7.1 Partial-state builder

**Module** `ui/speedrun/partial-states.ts`. Pure:

```ts
buildCumulativeStates(defaults, recipe): CumulativePatchState[]
// CumulativePatchState = { parameters, modulation, rack }  — one per section
```

`state[k]` = defaults + ops of sections `0..k` applied. Op application is
mechanical (`setParam` writes the value; `mapRoute` appends the route with its
final amount; `toggleEffect` flips `rack.enabled`; `configureMseg` writes the
slot; …).

### 7.2 The one neutralization exception: oscillator mutes

Defaults make all three oscillators audible (unmuted, −9.5 dB, table 34), so
"defaults + completed sections" alone would pollute early checkpoints with
not-yet-built oscillators. Rule: in `state[k]`, every oscillator whose section
index > k — and every never-demonstrated oscillator — gets `oscXMute = 1`
forced. When oscillator X's section completes, its mute reverts to the patch's
actual value. Nothing else needs neutralizing: the voice filter's defaults are
part of the Init sound by definition, and effects default to disabled.

This exception is applied by `buildCumulativeStates`, not by the analyzer, so
the round-trip invariant (§5.4) checks the final state with all demonstrated
oscillators unmuted.

### 7.3 Offline checkpoint renderer

**Modules** `ui/speedrun/audio/offline-engine-host.ts` (adapter),
`ui/speedrun/audio/checkpoint-worker.ts` (Web Worker),
`ui/speedrun/audio/render-pool.ts` (pool + progress).

**Engine artifact.** `web/build.mjs` already produces the class; add one small
build output `cmaj_Cosimo_Synth.engine.js` that exports **only** the generated
class (no `cmaj_api` worklet-helper import), so workers can import it without
touching AudioWorklet-flavored modules. This is a ~10-line addition next to
`buildRendererAwarePatchModule()` (`web/build.mjs:47`) reusing the same
generated source.

**The adapter.** `OfflineEngineHost` implements `PatchConnectionLike` over the
raw class so the existing worker services run unmodified:

- `sendEventOrValue(id, v)` → `sendInputEvent_<id>(v)` or
  `setInputValue_<id>(v, 0)` chosen by the endpoint table from
  `getInputEndpoints()`.
- `sendMIDIInputEvent(id, code)` → `sendInputEvent_midiIn({message: code})`.
- `addEndpointListener` → after every `advance()`, drain
  `getOutputEventCount_<id>` / `getOutputEvent_<id>` /
  `resetOutputEventCount_<id>` and dispatch.
- `requestFullStoredState` → serves the in-memory `CumulativePatchState`
  documents (serialized with `serializeModulationState` / `serializeRackState`).
- a `pump(frames)` method advances the engine in ≤128-frame slices while
  dispatching output events and letting microtasks settle.

**Per-checkpoint procedure** (fresh engine per checkpoint; `sessionID` = a
fresh integer, so `dspSessionId` bookkeeping is trivial and every install lane
starts at its baseline):

1. `await initialise(sessionId, 48000)`.
2. Write all parameters of `state[k]` (mutes included) via the adapter.
3. Start the real services against the adapter:
   `createWavetableWorkerController` (with a resource loader backed by
   pre-fetched, cached frames — §7.5), `createModulationArticulationWorkerService`,
   `createRackStateWorkerService`; seed stored state; then `pump()` in
   128-frame slices until the services report installed (wavetable
   `runtimeState.hasActive` per used oscillator, modulation frontier reached,
   rack `effectiveRackState` matching), with a hard bound (~4 s of virtual
   time) → typed failure if not reached. Setup audio is discarded; because no
   notes have sounded, time-based effect state (delay/reverb tanks) is silent,
   so capture can start immediately after install.
4. **Capture**: schedule the `NotePerformance` (§8) as frame-offset MIDI
   events, slicing `advance()` calls exactly at event offsets
   (the `tests/test_seqfx_probe.py` pattern); copy `audioOut` planar Float32
   into a preallocated buffer of `sectionSamples + crossfadeSamples`. If the
   performance is shorter than the section, it cycles (restart from 0 —
   note-ons re-trigger; the dispatcher handles overlapping notes normally); if
   longer, capture simply stops at the boundary — "only as much of that
   checkpoint's rendered audio as the corresponding section lasts".
5. Transfer the PCM (transferable ArrayBuffers) to the main thread.

**Pool.** N = `min(4, navigator.hardwareConcurrency − 2, checkpoints)` workers
render checkpoints in parallel. Checkpoints are independent by construction
(each starts the MIDI from t=0), so ordering doesn't matter; progress =
rendered-samples / total-samples.

**Cost model.** The engine holds realtime on phones inside a 128-frame worklet
budget, so a desktop worker renders ≥3–10× realtime. Total checkpoint audio is
roughly the video length (~30–90 s across all sections); with 4 workers,
expect **~2–10 s** of audio rendering for typical patches — well inside a
usable product experience. `bench.py` provides the harness to validate this
number per-patch-complexity during implementation.

### 7.4 Master track assembly

**Module** `ui/speedrun/audio/master-track.ts`.

One master stereo Float32 track of exactly `durationInFrames × 1600` samples:
each section's range is filled from its checkpoint bounce; boundaries get a
**90 ms equal-power crossfade** (checkpoint k's tail × fade-out + checkpoint
k+1's head × fade-in — the extra crossfade tail captured in §7.3 step 4 feeds
this), silence before the first audible section, hard fade-out over the last
15 frames. Encode to WAV (float32 or 16-bit PCM; ~16 MB/90 s at 16-bit) →
`URL.createObjectURL(blob)`.

A single premixed master (rather than per-section `<Audio>` sequences) makes
the composition's audio exactly one `<Audio src={masterUrl}/>` and moves all
splice math into tested, deterministic code.

---

## 8. MIDI ingestion

**Module** `ui/speedrun/midi/smf.ts`. No MIDI parser exists in the repo
(`demo/one_note.mid` is only consumed by native cmajor test tooling), and the
repo's dependency posture is lean (three runtime deps), so this is a small
vendored parser, not a new dependency:

- Standard MIDI File format 0/1; merge tracks; apply the tempo map; emit
  `NotePerformance = { events: {atSec, code}[], durationSec }` where `code` is
  the packed short message the engine consumes
  (`(status<<16)|(data1<<8)|data2` — `web/cosimo-web-host.js:213`).
- V1 keeps note-on/off (+ running status, velocity) and channel; CC/pitch-bend
  pass through as packed codes too (the engine's `std::midi::MPEConverter`
  handles them), but MPE pressure/slide-driven patches are simply "as played" —
  if the performance contains no pressure, `pressure`-source routes
  contribute 0. Documented, acceptable for V1.
- Also accepted: a plain JSON note list `{note, velocity, onSec, offSec}[]`
  (useful for tests and for programmatic callers).
- Sanitization: notes clamped to the performance window; all-notes-off
  implied at `durationSec`.

`atSec × 48000` → sample offset → frame-sliced event scheduling in §7.3.

---

## 9. Stage F — The video composition

**Location** `ui/speedrun/composition/`. Dependencies added to the root
`package.json`: `remotion`, `@remotion/media`, `@remotion/web-renderer`
(pinned ≥ 4.0.491, exact-pinned like the teaser), optionally
`@remotion/player` for preview. React 19.2.4 is already the app's version.

### 9.1 The frame-purity constraint and the three candidate UI strategies

Remotion renders by mounting the composition and seeking frames; the scene must
be a deterministic function of `useCurrentFrame()`. Three ways to get the phone
UI on screen were evaluated against the repo:

1. **Live-drive the real app and screen-capture it** — rejected. Capture APIs
   (`getDisplayMedia`) are realtime and permission-gated; the live app
   (worklet audio, async stored-state echoes, wall-clock timers like the mock's
   700 ms wavetable activation, `patch-connection-mock.ts:66`) cannot be
   seeked to an arbitrary frame; output would be non-deterministic.
2. **Mount the full real `DesktopPatchView` inside the composition** on a
   `MockPatchConnection` whose state is computed from the frame — the
   seqfx-teaser pattern at full scale. Genuinely viable, but three concrete
   repo facts make it the *upgrade path*, not V1:
   - the compact layout is selected by `window.matchMedia("(max-width:
     639px)")` (`DesktopPatchView.tsx:3999`) — inside a composition the window
     is the render host, so the view needs a small upstream change (a
     `forceCompactViewport` prop) before it can render phone layout at all;
   - navigation (tabs, FX selection, quick sheets) is internal presentation
     state driven by pointer events; a scripted-shell-state seam
     (`workspace-shell.ts` state injected as a prop) must be added, and
     synthetic pointer events are unusable during rendering (not
     frame-idempotent);
   - fidelity: the production CSS uses `z-index` layers, `backdrop-filter`
     glass (the Mod rail), blend and inset shadows — exactly the properties
     the web renderer does not emulate, plus per-frame settling of
     microtask-driven listeners needs `delayRender` gating.
3. **A purpose-built, frame-pure `SpeedrunPhoneUI`** composed from the real
   *leaf* presentation pieces — **chosen for V1**:
   - real shared CSS tokens/styles (`ui/shared/editor-tokens.css`,
     `synth-style-guide.css`, theme constants in `ui/shared/theme.ts`) — the
     same files the teaser already imports across the repo boundary;
   - real pure artwork/render modules: knob dial + mod annulus
     (`ui/shared/parameter-knob-artwork.tsx` — plain SVG), MSEG shape
     rendering (`renderMsegShape`, `ui/shared/mseg.ts`) into SVG paths,
     wavetable line/graph drawing (`ui/shared/wavetable-display.ts`) into
     `<canvas>`, fontaudio SVG icons (`ui/assets/fontaudio/`), segmented tabs
     (`ui/shared/segmented-editor-tabs.tsx`), value formatting (§5.3);
   - replicated chrome, built only from capture-safe primitives (flex layout,
     borders/radius, gradients, text, SVG, canvas): the 40 px VOICE/FX/MOD tab
     row, preset/Back bar, sticky keyboard strip, the Mod rail (its glass
     effect approximated with a gradient instead of `backdrop-filter`), the
     8-row FX list, the voice cells rail, the filter card;
   - geometry copied from the real layout at 393 × 852 so motion reads
     authentically (rows are 40/48 px, rail width 40 px, knob viewBox
     `-3 -3 106 106`, 270° sweep from 225°).

   Rationale: strategy 3 is deterministic by construction, guaranteed
   compatible with the renderer's capture model, and keeps the leaf visuals
   honest by reusing product modules. Strategy 2 stays on the roadmap behind a
   **fidelity gate**: a spike renders ~10 representative frames of the real
   view through `renderMediaOnWeb` and diffs them against Playwright
   screenshots; if it passes after the two small upstream seams
   (`forceCompactViewport`, scripted shell state) land, the replica shell can
   be swapped for the real view without touching stages A–E or the gesture
   layer, because both consume the same `SpeedrunTimeline` and `SurfaceRef`
   vocabulary.

### 9.2 Scene structure

```
SpeedrunComposition({ timeline, masterAudioUrl, patchLabel })   1080×1920 @30fps
├─ <Audio src={masterAudioUrl}/>                     (@remotion/media)
├─ <TitleCard/>            (patch name, first/last ~45 frames)
├─ <PhoneStage>            (393×852 scene scaled ×2.4, centered upper 2/3)
│   ├─ <SpeedrunPhoneUI state={uiStateAt(frame)}/>   (frame-pure replica)
│   └─ <FingerOverlay gesture={gestureAt(frame)}/>   (SVG touch dot + ripple)
└─ <CaptionPanel section={sectionAt(frame)}/>        (lower 1/3, waterfall lines)
```

`uiStateAt(frame)` is derived, not stored: reduce the recipe's ops over
`opSpans` up to `frame`, interpolating the in-flight op's value with Remotion
`interpolate` + easing. Because it recomputes from section start each frame
(sections have ≤ ~20 ops), it is cheap and seek-safe in both preview and
render.

### 9.3 Gesture derivation and animation

`ui/speedrun/composition/gestures.ts` maps each `UIOp` to a `GestureScript`
(a timed finger path + surface reactions), mirroring the real mechanics from
§1.4 so the video *demonstrates the actual interaction model*:

- `navigate` → finger tap on the tab/row (tap ripple; panel swap on release).
- `setParam` → finger lands on the `SurfaceRef` cell/knob; **horizontal**
  finger travel = `Δnormalized × 220 px` (the real base-value rate), value
  readout counts along the authored interpolation; knob pie/cell fill track it.
- `mapRoute` → the Mod rail's source chip highlights (arming), a ghost chip
  follows a bezier from rail to target (the rail dodges off-edge exactly as the
  product does while mapping); on arrival the target flashes its capture
  highlight (`is-mod-hover` treatment, source-colored); then the finger drags
  **vertically upward** on the target, `Δamount × 360 px / span`, while the mod
  annulus arc grows from 0 to the route's amount (drop creates amount 0 —
  matching `createDefaultRoute`). Negative amounts drag downward.
- `toggleEffect` → tap on the row's power control; row's `data-enabled`
  styling flips; the FX editor header swaps "FX BYPASSED" → "SELECTED FX".
- `selectWavetable` → tap the wavetable cell, name flips through 2–3
  neighboring catalog names (fast-scroll feel), canvas graph morphs to the
  target table's frame line (drawn via `wavetable-display` from the actual
  frame data, pre-fetched by the studio).
- `configureMseg` → the MSEG card's SVG path interpolates from the default
  shape to the target (point handles pop in staggered), playback/rate chips
  set themselves. (A literal point-by-point authoring replay is intentionally
  not attempted — the speedrun batching in the brief calls for rapid
  demonstration, not tutorial-accurate editing.)

All coordinates come from a static `layout.ts` map of the replica (deterministic
geometry — no DOM measurement), keyed by the same `SurfaceRef`s the recipe
emits.

### 9.4 Render call

```ts
const {getBlob} = await renderMediaOnWeb({
  composition: { id: "sound-speedrun", component: SpeedrunComposition,
                 durationInFrames: timeline.durationInFrames, fps: 30,
                 width: 1080, height: 1920 },
  inputProps: { timeline, masterAudioUrl, patchLabel },
  container: "mp4", videoCodec: "h264", audioCodec: "aac", sampleRate: 48000,
  videoBitrate: "high", onProgress, signal });
downloadBlob(await getBlob(), `${slug(patchLabel)}-speedrun.mp4`);
```

Fonts: `await document.fonts.ready` (and explicit `FontFace` loads for the
vendored UI fonts in `ui/assets/fonts/`) before rendering, so text capture is
stable from frame 0.

---

## 10. Stage G — The studio page (product surface & orchestration)

**Location** `ui/speedrun/studio/` with a Vite entry + npm scripts
(`speedrun:dev`, `speedrun:build`) modeled on the existing configs
(`ui/vite.desktop.config.mjs`). It is a standalone page (served alongside
`build/web/`), not part of the plugin bundles — the synth's shipped UI is
untouched.

Flow (all client-side):

1. **Inputs**: patch (file drop / paste JSON / "use current browser patch" via
   `readBrowserPatchState()`), MIDI file (or JSON notes; a bundled demo
   performance as default), optional settings (duration ceiling, pacing
   preset).
2. **Analyze** (A→D): synchronous, milliseconds; show the recipe as a
   checklist (sections, captions, omitted report) — this doubles as the
   debugging surface for arbitrary patches.
3. **Bounce** (E): worker pool renders checkpoints with a progress bar;
   assemble master WAV; offer an audition `<audio>` element (plain playback of
   the blob) before committing to video.
4. **Preview** (optional, behind `@remotion/player`): live-play the
   composition with the master audio — instant iteration without encoding.
5. **Render** (F): `renderMediaOnWeb` with progress + cancel (`AbortSignal`);
   then download. Feature-gate up front: `typeof VideoEncoder === "undefined"`
   → "video export needs a WebCodecs browser (Chrome/Edge; Safari 26+)".

Error surfaces are per-stage and typed: intake errors (§3), install timeout
(§7.3 step 3) with the failing lane named, render abort/OOM guidance (§13).

---

## 11. Testing and verification

Repo-idiomatic: `node --test` unit suites + Playwright browser suites, wired
into `package.json` like the existing `test:*` scripts.

**Pure stages (fast, no browser):**
- `tests/test_speedrun_patch_io.mjs` — shape detection, migrations, clamping;
  defaults snapshot pinned against Cmajor inits + rack catalog initials.
- `tests/test_speedrun_analyzer.mjs` — fixtures: Init patch → empty recipe;
  each module family exercised (osc-only, filter-only, per-effect, per-source);
  solo/mute logic; articulation-only routes not demonstrated; `omitted`
  completeness (every non-default fact is either in a section or in `omitted`).
- `tests/test_speedrun_recipe_roundtrip.mjs` — **the invariant**: for
  generated random patches (`fast-check`, already a devDependency: random param
  subsets within annotation ranges, random route sets over the 13×87 legal
  domain, random rack states), `applyRecipe(defaults, compileRecipe(...))`
  reproduces the audible patch state exactly (params within epsilon, routes
  set-equal, rack equal).
- `tests/test_speedrun_timeline.mjs` — pacing/caps/compression; frame↔sample
  exactness; checkpoint mapping (section k plays state k; sources phase silent).
- `tests/test_speedrun_smf.mjs` — SMF fixtures incl. `demo/one_note.mid`,
  format 0/1, tempo changes, running status.

**Engine-in-browser (Chromium + WebKit, following `test_web_poc_browser.mjs`):**
- `tests/test_speedrun_offline_render_browser.mjs` — build the web bundle;
  in a worker: initialise, install a fixture patch through the real services
  via `OfflineEngineHost`, render 2 s with a note; assert non-silence (RMS,
  as the POC does), **determinism** (two renders → identical PCM hash), and
  **differential audibility** per checkpoint chain (osc A only → +osc B raises
  RMS; enabling the delay changes the tail energy; filter cutoff change moves
  spectral centroid — coarse FFT assertions, not golden audio).
- Install-timeout path: a wavetable index with a poisoned resource loader
  fails with the typed error, not a hang.

**Composition (Chromium):**
- `tests/test_speedrun_composition_browser.mjs` — mount `SpeedrunComposition`
  via `@remotion/player` seeked to fixture frames; assert scene invariants from
  DOM/canvas (active tab, caption line count, knob `aria`/arc values at
  op-boundary frames); screenshot-golden a handful of frames (same tolerance
  approach as `tests/test_effects_rack_xy_visual.mjs`).
- Determinism: render the same frame twice (seek away and back) → identical
  screenshot.

**End-to-end (Chromium):**
- `tests/test_speedrun_pipeline_browser.mjs` — fixture patch + MIDI → full
  pipeline → MP4 Blob; parse with Mediabunny (duration ≈ timeline, one H.264
  video + one AAC audio track); decode a mid-video audio window and assert
  non-silence; runtime budget assertion (< N minutes) to catch pathological
  regressions.

**Manual QA matrix** (documented in the studio): Chrome/Edge current (primary),
Safari 26 (secondary), Firefox (audio pipeline works; MP4 export
feature-gated — see §13).

---

## 12. Narration seam (V2, explicitly out of V1)

The recipe already carries everything narration needs: per-section uncapped
caption lines with structured values (§5.3 keeps the pre-cap list). The seam:

- `SpeedrunSection.narration?: { text: string; audioUrl?: string; frames?: [start,end] }`
  populated by a future `ui/speedrun/narration.ts` (LLM text over the section's
  structured facts; TTS to per-section clips).
- Timeline assembly gains an optional "respect narration duration" pass
  (sections stretch to `max(visual, narrationFrames)`).
- Composition mixes narration as additional `<Audio>` sequences over the
  master track (renderer mixes mounted audio) with a config-driven duck on the
  master's volume callback.

Nothing in V1 blocks this; no V1 code needs narration to exist.

---

## 13. Browser support, performance, memory, failure constraints

- **Support floor**: WebCodecs `VideoEncoder`+`AudioEncoder` — Chromium 94+
  (primary), Safari 26+ (secondary; renderer filters unsupported on WebKit —
  the replica avoids CSS `filter`), Firefox 130+ has WebCodecs but H.264
  encode availability is platform-dependent → V1 feature-gates MP4 export to
  capability-detected browsers and offers WebM (vp9/opus) as a labeled
  fallback on Firefox rather than failing. Everything before the render stage
  (analysis, audio bounce, audition) works in any modern browser.
- **Workers/WASM memory**: each engine instance owns one `WebAssembly.Memory`
  (generated initial + 32 reserved pages for the canonical renderer,
  `web/canonical-renderer-wasm.mjs:2`); pool of ≤4 keeps peak WASM memory in
  the low hundreds of MB, freed on pool teardown. Wavetable frames are fetched
  once, mip pyramids built once per used table (`ui/shared/wavetable-mip.ts`)
  and copied per worker (~1–2 MB/table).
- **Audio memory**: master track = 90 s × 48 kHz × 2ch × 4 B ≈ 35 MB Float32
  (WAV blob 16-bit ≈ 17 MB). Checkpoint buffers are released after splicing.
- **Video memory**: `renderMediaOnWeb` defaults to `web-fs`/arraybuffer output;
  a 90 s 1080×1920 H.264 at "high" bitrate ≈ 50–120 MB blob. `outputWritable`
  exists if we ever need progressive writing.
- **Render time**: WebCodecs H.264 at 1080×1920 encodes well above 30 fps on
  desktop hardware; the scene is flex/SVG/canvas (cheap capture). Budget
  expectation: audio ≈ 2–10 s, video ≈ 0.5–2× video duration → a 45 s speedrun
  in roughly one to two minutes end-to-end. The studio surfaces both progress
  phases separately.
- **Failure containment**: every stage returns typed errors; the studio never
  leaves a spinner — install timeouts name the lane (wavetable/modulation/
  rack), render errors offer retry at 720×1280@24 as a degraded preset;
  `AbortSignal` cancels cleanly (pool terminate + object-URL revocation).
- **Determinism guards**: no wall-clock reads anywhere in stages B–F; the
  composition bans `Math.random`/`Date.now` (lint rule for `ui/speedrun/`).

## 14. How patch complexity scales duration and cost

Let `P` = non-default params (post-cap per section), `R` = operative routes,
`E` = enabled effects, `O` = demonstrated oscillators, `S` = operative sources
with config.

- Sections ≈ `S + O + (filter? 1:0) + E`; ops ≈ `P + R + E + navigations`.
- Video frames ≈ Σ section(lead-in + ops·weights + tail) — linear in ops, hard
  ceiling via §6.2 compression (worst-case fully-modded patch: every section
  hits the 8-line cap + rapid-fire, so duration saturates at the ceiling
  rather than growing unboundedly).
- Audio cost ≈ video duration × (1/pool) × engine-speed-factor — linear in
  duration, independent of patch complexity except through voice/effect DSP
  load (bounded: 16 voices, 8 effects always running per the always-advance
  rack design, `cmajor/EffectsRack.cmajor:642`).
- Video cost ≈ duration × encode factor — independent of patch complexity.

So the ceiling config is the single knob that bounds the whole product
experience for arbitrary patches.

## 15. Genuine risks, unknowns, and pre-implementation spikes

Ordered by how much design they could invalidate:

1. **Web-renderer capture fidelity of the replica** (medium risk). The replica
   uses only documented-supported primitives, but the renderer is young
   (stable since 4.0.491). → **Spike V-1** (first): a 10 s composition with a
   knob (SVG), a canvas wavetable, text captions, and a blob-URL WAV `<Audio>`
   → MP4 with sound, on Chromium + Safari 26. Verifies: blob URLs in
   `<Audio>` (docs don't explicitly promise them; fallback is a data: URL or
   an in-memory fetch-intercepted URL), font capture, SVG/canvas capture, A/V
   sync at section boundaries.
2. **Offline engine install loop** (low-medium). The worker services are
   ack-driven and were built for a live worklet; the adapter pumps them
   synchronously. → **Spike A-1**: in a worker, run wavetable + modulation +
   rack services against `OfflineEngineHost` for a fixture patch; assert
   installed-state and first-note audio matches the realtime web host (RMS
   window compare against `__COSIMO_WEB_POC__` output). Also measures real
   engine speed factor for §7.3's cost model.
3. **Event-FIFO limits during bulk install** (low). Cmajor input queues are
   per-block bounded; the services' in-flight caps (wavetable
   `maxBatchesInFlight = 1`) should keep us safe by construction — A-1
   confirms, and the pump slices guarantee forward progress.
4. **Remotion licensing** (business, not technical): Remotion requires a paid
   company license above a small-team threshold; `@remotion/web-renderer`
   telemetry/licensing applies to in-browser rendering. Must be resolved
   before shipping publicly (the repo already ships a Remotion teaser, so a
   posture likely exists — confirm and record it).
5. **Firefox MP4 export** (accepted gap): feature-gated WebM fallback (§13);
   revisit when Firefox H.264 encode is dependable.
6. **Real-UI upgrade path** (deferred): the two upstream seams
   (`forceCompactViewport`, scripted shell state) are small and independently
   useful for tests; the fidelity gate (§9.1) decides if/when the replica is
   swapped. Not a V1 blocker by design.
7. **Patch-format drift**: presets carry contract hashes; intake runs the
   existing migrations and refuses unknown hashes with a clear error — same
   guarantees as the product preset bar, no new invariant.

None of these are foundation-threatening: 1–2 are verified by the two spikes
before any pipeline code lands; 3–7 have contained fallbacks.

## 16. Implementation sequence

Each phase ends green on its named tests before the next begins.

- **Phase 0 — Spikes (parallel):** V-1 (renderer + blob audio proof) and A-1
  (offline engine + services proof, speed measurement). Exit: both proofs
  committed as runnable scripts under `experiments/speedrun/`.
- **Phase 1 — Pure core:** `patch-io`, `analyzer`, `recipe`, `timeline`,
  `midi/smf`, `partial-states` with the full unit + property suites
  (§11 pure-stage tests). Exit: round-trip invariant green under fast-check;
  fixture recipes snapshotted.
- **Phase 2 — Audio:** engine artifact in `web/build.mjs`,
  `offline-engine-host`, `checkpoint-worker`, `render-pool`, `master-track`;
  browser test suite (offline render determinism + differential audibility).
  Exit: fixture patch → auditionable master WAV in the browser.
- **Phase 3 — Composition:** `layout.ts`, `SpeedrunPhoneUI` leaf-by-leaf
  (tabs → voice cells/knobs → rail → FX list → filter card → MSEG card),
  `gestures.ts`, captions, `SpeedrunComposition`; `@remotion/player` preview
  harness; composition browser tests + frame goldens.
- **Phase 4 — Studio + export:** studio page, progress/cancel/error surfaces,
  `renderMediaOnWeb` integration, download, capability gating; E2E pipeline
  test producing a real MP4 in CI (Chromium).
- **Phase 5 — Hardening:** pacing ceiling/compression tuning against real
  factory patches, memory teardown audits, Safari 26 pass, docs
  (`ui/speedrun/README.md`), and the omitted-report debug view.
- **Phase 6 (optional, post-V1):** real-UI fidelity gate + swap; narration
  seam (§12).

## 17. Component reuse ledger

**Reused as-is (no changes):** engine class + WASM (`web/build.mjs` outputs);
worker services (`ui/worker/wavetable-worker.ts`,
`modulation-articulation-worker-service.ts`, `rack-state-worker-service.ts`,
`ui/shared/patch-worker-services.ts`, `ui/shared/runtime-install-channel.ts`);
state schemas + factories (`modulation.ts`, `modulation-targets.ts`,
`modulation-runtime-program.ts`, `rack-state.ts`, `articulation-image.ts`,
`mseg.ts` incl. `renderMsegShape`); preset machinery
(`effect-preset-v2.ts`, `synth-preset-migrations.ts`, `synth-init-state.ts`);
catalogs (`rack-parameter-descriptors.ts`, `target-descriptor.ts`,
`oscillator-binding.ts`, `wavetable-bank.ts`, `wavetable-mip.ts`,
`assets/factory-bank-catalog.json`); formatters (`parameter-value-entry.ts`,
`formatRackParameterValue`); visual leaves (`parameter-knob-artwork.tsx`,
`segmented-editor-tabs.tsx`, `wavetable-display.ts`, fontaudio assets, shared
CSS tokens); `browser-patch-state.mjs`; test patterns (web POC harness,
`MockPatchConnection` for pipeline tests).

**New (all under `ui/speedrun/` unless noted):** `patch-io.ts`, `analyzer.ts`,
`recipe.ts`, `timeline.ts`, `partial-states.ts`, `midi/smf.ts`,
`audio/offline-engine-host.ts`, `audio/checkpoint-worker.ts`,
`audio/render-pool.ts`, `audio/master-track.ts` (+ WAV encoder),
`composition/` (layout, SpeedrunPhoneUI, gestures, captions, FingerOverlay,
SpeedrunComposition), `studio/` (page, progress, render, download),
`web/build.mjs` engine-artifact addition, vite config + npm scripts, tests.

**Deliberately untouched:** the shipped synth UI bundles, the Cmajor DSP, the
patch manifests, and the iOS/desktop native shells.
