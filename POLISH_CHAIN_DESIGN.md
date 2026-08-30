# Polish Chain Design

Status: **current T74 implementation contract for qualification against master,
2026-08-30**. Companion to `ENHANCER_DESIGN.md`,
`DISTORTION_QUALITY_DESIGN.md`, and `SAUSAGE_FATTENER_ANALYSIS.md`. The exact
contract below supersedes the earlier T28 candidate framing and remains
intentionally conservative and evidence-backed. Automated qualification does not
replace Andrew's later level-matched listening, which remains a separate,
unperformed product-acceptance gate.

## 1. Properties

- **Locked — fixed and static**: one chain, fixed order, always present, at the very
  end of the signal path. Not a lane module, not pooled, not reorderable, **not
  modulatable** — parameters are dialed in and preset-persisted only (control-rate
  smoothed against zipper noise). The polish chain is the frame, not the painting.
- **Locked — no backward compatibility**: adding Polish creates a new complete
  saved-sound version. Older presets, automatic browser state, shared URLs, and
  host state are ignored or rejected as whole documents. Do not infer missing
  Polish values, migrate old documents, or add a hidden legacy bypass. Retained
  factory sounds are rebuilt in the new format; obsolete old-format copies may be
  deleted after they are inventoried.
- **Locked — starts off**: Init and every brand-new patch set Safe Bass Amount,
  Enhance Amount, and Comp Amount to zero, Output Trim to 0 dB, and all four
  independent bypass values to Active. With all three Amounts at zero and Trim at
  0 dB, the complete section is neutral apart from its declared constant latency.
  Every Amount and bypass is a public, saved part of the current complete sound;
  no stage derives its activation from another stage's Amount.
- **Locked — compact output meter**: keep one fixed-width meter capsule inside the
  existing compact preset-bar row. It must not add a row, increase the bar height,
  or cause changing digits to move surrounding controls. A small light pulses with
  momentary loudness and changes color with remaining peak headroom, reaching red
  at digital full scale. Beside it, fixed-width tabular readouts show `P` for the
  ordinary post-trim sample peak/headroom in dBFS relative to 0 dB and `L` for
  400 ms momentary loudness. Do not add true-peak oversampling or a user-selectable
  meter mode; Andrew explicitly chose the simplest implementation.
  A new higher peak writes immediately, holds for one second, then falls smoothly
  toward silence; another higher peak restarts the hold. There is no permanent
  latch, tap-to-clear state, preset state, or extra mastering panel. On detail
  screens, the universal Back glyph sits immediately before the meter as one
  compact left-side cluster; the meter remains visible. The preset name stays
  independently centered and truncates before collision, while the menu remains
  fixed at the right.
- **Locked — lookahead is permitted here, up to 4 ms** (Andrew, 2026-08-25),
  deliberately unlike the rack. Engineering consequences:
  - The chain is a top-level fixed stage, not a rack module, so ADR-008 still binds
    every rack module and does not bind this stage. A composing GRAPH's latency does
    sum its children (per the `EffectsRack.cmajor` C10 notes), so the chain's
    latency is representable and reportable at the top level; the AUv3/web host
    delay-compensation path must be verified to carry it.
  - Latency is **constant** regardless of settings and reported once — never
    settings-dependent. The accepted high-quality T26 Enhancer contributes a fixed
    declared 60 samples. The compressor adds exactly **96 frames** of fixed
    lookahead (2.00 ms at 48 kHz, 2.18 ms at 44.1 kHz). The complete section
    therefore applies and reports exactly **156 frames** at every supported sample
    rate. The reported total is their exact sum; do not
    replace the Enhancer with Lite's cheaper wrapper merely to avoid that latency.
  - Neutral behavior is pinned per stage. The T26 Enhancer contributes exactly zero
    nonlinear signal at zero Amount and matches its retained FIR neutral impulse
    within `1e-7`; it is not same-frame bit-exact dry. Other stages should use true
    bypass paths where possible. The complete chain must report the exact constant
    latency it applies.
- **The gain-change rule (Andrew): as fast as possible without distortion — no gain
  trajectory shorter than one cycle of a 60 Hz bass note (~16.7 ms).** In practice:
  attack may be effectively instant *because* lookahead lets the gain ramp ahead of
  the peak (smoothed across the lookahead window — zero overshoot, no click);
  release/recovery respects the ~17 ms floor, and/or the detector is high-passed
  (~100 Hz) so bass never drives gain at cycle rate.

## 2. Lineup (current direction, per Andrew 2026-08-25)

```
[ rack lanes → global filter ] →
  1. SAFE BASS   side-channel low cut (bass to mono)
  2. ENHANCER    the two-band module (per ENHANCER_DESIGN.md)
  3. COMP/CLIP   medium compression evening out into a soft clipper
→ output trim (no post-trim safety processor; overload indication only)
```

Supersessions from earlier drafts, recorded: TILT (vetoed — linear tone is
`GlobalFilter`'s job); the FAT maximizer-macro stage (superseded by the comp/clip
spec below); WIDTH (no longer in Andrew's stated lineup — side-image concerns are
covered by SAFE BASS plus the enhancer's side amounts; revive only by explicit ask).

### 2.1 SAFE BASS

High-pass on the side channel only; mid untouched. This is classic **elliptical
EQ** from vinyl mastering (bass summed to mono so the cutter head survived), still
standard practice: phasey stereo bass wastes clipper headroom and muddies small
speakers. The baked curve is a **120 Hz, second-order Butterworth high-pass** on S
(12 dB/oct, Q = 1/sqrt(2)); M is untouched. Mono input ⇒ S = 0 ⇒ no-op. The
filtered and unfiltered S paths crossfade with a sample-rate-aware 20 ms one-pole
ramp. The public **Safe Bass Amount** controls that crossfade from exact dry at
zero to the one tuned fixed curve at full amount; the 120 Hz cutoff remains baked
and is not exposed. Safe Bass has its own saved bypass, which smoothly targets
the dry path without overwriting Amount. The filter continues running while
bypassed so re-entry does not expose stale history. This chooses the steeper end
of the researched 6–12 dB/oct range because it removes more sub-120 Hz side
energy without moving the cutoff upward; listening approval is still pending.

### 2.2 ENHANCER

As `ENHANCER_DESIGN.md`: two parametric bells; per-band Stereo or Mid/Side routing;
linked Stereo Amount or independent Mid and Side amounts; Tube/Solid; shared
Subtle/Medium; continuous de-emphasis. All settings are static per §1.

The Polish surface exposes one dedicated **Enhancer Amount** macro `e` in 0..1.
It retains the complete T26 processor and its fixed 60-frame FIR latency, with the
musical-material regression settings baked exactly:

- band 1: 130 Hz, Q 0.71, Stereo, Solid, Mid/linked Amount `0.70 * e`
  (the retained Side endpoint is fed `0.35 * e`, though Stereo routing does not
  consume it);
- band 2: 9 kHz, Q 0.71, Mid/Side, Tube, Mid Amount `0.35 * e`, Side Amount
  `0.70 * e`;
- shared saturation Subtle and de-emphasis 1.0.

The macro is linear in T26's existing 0..1 Amount domain, so the underlying
Spectre gain law remains the accepted nonlinear `10^(12*Amount/20)-1` rather than
being approximated or replaced. The macro is smoothed for 20 ms before entering
T26's retained 15 ms control smoother. Frequency, Q, routing, character,
intensity, de-emphasis, and relative balance are not public controls.
Enhance has an independent saved bypass. Bypass smoothly targets an effective
Amount of zero while retaining the authored Amount and the fixed 60-frame timing
path; the other Polish stages continue processing.

### 2.3 COMP/CLIP (the finisher)

Direction (Andrew): **a medium amount of compression driven into a soft clipper —
the compressor's job is only to even out the signal before clipping.** Reference
numbers extracted from the Sausage Fattener recreation
(`SAUSAGE_FATTENER_ANALYSIS.md`): threshold parked at the ceiling, hard knee,
~11:1, attack 0.21 ms, release 26.8 ms, rounded-knee-into-hard-clip transfer
reaching the ceiling at 0.94 of full scale. Cosimo's version adapts that recipe
with the two rules above: up to 4 ms lookahead (same speed as SF's 0.2 ms attack
without its overshoot-or-distort tradeoff), release ≥ the 60 Hz floor (SF's
26.8 ms already is), detector HP as the cleaner alternative for bass-heavy
material. "Medium" compression (Andrew) rather than SF's near-limiting ratio. The
public **Compression/Clip Amount** macro `a` is clamped to 0..1 and smoothed with a
sample-rate-aware 20 ms one-pole. It drives the fixed stages as follows:

- stereo-linked instantaneous peak detector; threshold 0 dBFS; quadratic 6 dB
  knee; ratio `1 + 3a` (1:1 at zero, 4:1 at full); no makeup gain and no detector
  high-pass;
- 20 ms attack and 120 ms release gain smoothing. The detector sees the current
  input while gain is applied to audio delayed by the fixed 96-frame lookahead.
  The 20 ms attack and 120 ms recovery both respect the 60 Hz gain-change floor;
  lookahead reduces transient overshoot without turning the compressor into a
  peak limiter;
- a symmetric soft clipper after the compressor, mixed as
  `compressed + a * (softClip(compressed) - compressed)`. For magnitude `m`,
  `softClip` is exact identity through the -3 dBFS knee
  `k = 10^(-3/20)`, then `k + (1-k) * tanh((m-k)/(1-k))`, with the original sign.
  It approaches but never exceeds 0 dBFS. The matching unit slope at the knee
  makes the transition continuous and click-free.

These values take T27 Curve Lab's 0 dBFS threshold, 4:1 ratio, 6 dB knee, and
120 ms release as the closest open, independently implemented evidence, then move
its 10 ms attack to 20 ms to honor the locked 60 Hz rule. Omitting makeup and
input drive is deliberate: the compressor only evens the top of the signal and
the clipper only shaves the last 3 dB, rather than making the macro a hidden
loudness boost. At `a = 0`, the compressor gain is exactly one and clip wet is
exactly zero, but the 96-frame timing path remains active.

Comp has an independent saved bypass. It smoothly targets the same macro-neutral
state without changing the stored Amount; compressor reduction recovers through
the accepted release rather than being reset in one sample, and the soft-clip wet
term fades with the macro. The fixed lookahead path remains active.

T27's repeatable, isolated comparison package is
`reference_labs/polish_comp_clip/`. Its exact decoded fixtures are source facts;
its offline compressor and inter-knot transfer evaluator are explicitly Cosimo
inferences for level-matched tuning, not a proprietary implementation claim.
The independently named `fx/polish_lab/` VST3 exposes those defaults plus the
open detector, macro, tone, and curve decisions for live Ableton tuning; it has
no production signal-path connection.

### 2.4 OUTPUT TRIM AND METER

Output Trim is the final audible operation, ranges from -24 to +12 dB, starts at
0 dB, and follows a sample-rate-aware 20 ms gain ramp. Its independent saved
bypass smoothly targets unity gain without changing the stored trim level. It is
not a safety stage: values over 0 dB may overload, and the meter reports that
honestly.

The post-trim meter observes without altering audio. `P` receives the maximum
ordinary sample magnitude between 60 Hz telemetry frames, expressed in dBFS. `L`
is the ungated 400 ms sliding stereo mean-square level, expressed in dBFS; it is
not true peak, integrated loudness, or a selectable mastering mode. The UI owns
the peak display ballistics: a higher value appears on the next visual frame,
holds for 1.0 s, then decays at 24 dB/s toward the current peak. The loudness value
drives pulse strength directly. This exact definition avoids implying EBU gating
or K-weighting that the compact `L` readout does not claim.

### 2.5 Interface placement

The FX graph always ends with one permanent **POLISH** node after the complete
editable Effects Lane. It makes the true signal position visible without adding
a permanent control panel. Tapping it opens four clearly named compact modules in
the existing effect-editor area: Safe Bass, Enhance, and Comp each expose one
Amount plus an independent bypass; Output Trim exposes its level plus an
independent bypass. One compact `Expand` action owns only a controlled open/close
handoff. T75 owns the later full-screen surface and any analyzer composition, so
T74 does not reserve permanent graph space or add a placeholder editor.

POLISH is not a lane effect: it cannot be moved, deleted, replaced, reordered, or
bypassed as a whole and has no effect context menu or drag behavior. Its four
internal stages do have the independent bypasses above. The editable lane's tail
add control remains upstream and inserts new effects before the fixed section.
The whole-Effects-Lane Mix and Bypass controls are upstream and do not affect it.
The post-trim peak/loudness capsule remains in the existing preset-bar row. On
detail screens, Back followed by the meter forms one compact left-side cluster.
Neither control disappears, adds height, or moves the centered preset name; the
name truncates before collision. This composition still requires real 320 px
layout proof before acceptance.

## 3. Not in this chain

- Modulation of any kind (locked out).
- The sound-design saturator (`DISTORTION_QUALITY_DESIGN.md`) — rack citizen,
  fully modulatable, never merged with this.
- Linear-phase anything; multiband dynamics (the rack's OTT covers it); upward
  maximization; any metering beyond the fixed compact post-trim observer.

## 4. Reference knowledge (from the session's research)

- **Lookahead limiter mechanics**: gain computed ahead of the audio; attack
  realized as a smoothing window across the lookahead buffer so gain reaches
  minimum exactly as the peak arrives — no overshoot, no click. 1–5 ms is the
  industry-typical window; Waves L1 (1994) is the ancestor of all of it.
- **The canonical loudness chain** (TDR Limiter 6 GE / VladG Limiter No6, free and
  documented): RMS comp → lookahead peak limiter → HF limiter → clipper →
  true-peak safety. "Even out slowly, shave fast, clip the rest." The polish
  chain's comp/clip is the two-stage reduction.
- **Family survey**: Ableton Glue Compressor = SSL bus comp + soft-clip toggle
  (comp+clipper in one box); OTT = upward+downward multiband (the other loudness
  school); Devil-Loc = Level-Loc auto-leveler + saturation (the crush school);
  KClip/StandardCLIP "clip-to-zero" = oversampled clipper as the primary tool.
- **Sausage Fattener measured**: see `SAUSAGE_FATTENER_ANALYSIS.md` — low-cut →
  peak-catcher comp at 0 dB → EQ → rounded hard clip; Fatness = input drive over
  36 dB into fixed thresholds.
- **Why attack-led peak control loses**: a fast-attack compressor ducks the whole
  signal for the duration of each hit (giving back the RMS it bought) and, without
  lookahead, overshoots; a clipper removes exactly the crest. With lookahead
  permitted, the comp can be fast *and* clean — the clipper still takes what the
  comp shouldn't chase.

## 5. Remaining acceptance items

1. Andrew's level-matched listening approval for the Safe Bass curve, both macro
   responses, compressor/clip character, and comparison with the T27 bundle.
2. Transient/PUNCH mode (floated earlier): parked; revisit only if voicing shows
   the finisher kills material worth keeping.
3. Name (working: "Polish").
4. WIDTH stage: out of the lineup unless Andrew re-adds it.
