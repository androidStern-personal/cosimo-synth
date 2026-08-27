# Polish Chain Design

Status: **concept locked; lineup and stage specs are the current brainstorm state,
2026-08-25** (Andrew + assistant session). Companion to `ENHANCER_DESIGN.md`,
`DISTORTION_QUALITY_DESIGN.md`, and `SAUSAGE_FATTENER_ANALYSIS.md`. Decided items
are marked **locked**; everything else is direction, not commitment.

## 1. Properties

- **Locked — fixed and static**: one chain, fixed order, always present, at the very
  end of the signal path. Not a lane module, not pooled, not reorderable, **not
  modulatable** — parameters are dialed in and preset-persisted only (control-rate
  smoothed against zipper noise). The polish chain is the frame, not the painting.
- **Locked — lookahead is permitted here, up to 4 ms** (Andrew, 2026-08-25),
  deliberately unlike the rack. Engineering consequences:
  - The chain is a top-level fixed stage, not a rack module, so ADR-008 still binds
    every rack module and does not bind this stage. A composing GRAPH's latency does
    sum its children (per the `EffectsRack.cmajor` C10 notes), so the chain's
    latency is representable and reportable at the top level; the AUv3/web host
    delay-compensation path must be verified to carry it.
  - Latency is **constant** regardless of settings and reported once — never
    settings-dependent. The accepted high-quality T26 Enhancer contributes a fixed
    declared 60 samples. The compressor may add 0–4 ms of fixed lookahead (up to
    another 192 samples at 48 kHz). The reported total is their exact sum; do not
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
→ output trim / safety (RackOutputStage relationship: open, §5)
```

Supersessions from earlier drafts, recorded: TILT (vetoed — linear tone is
`GlobalFilter`'s job); the FAT maximizer-macro stage (superseded by the comp/clip
spec below); WIDTH (no longer in Andrew's stated lineup — side-image concerns are
covered by SAFE BASS plus the enhancer's side amounts; revive only by explicit ask).

### 2.1 SAFE BASS

High-pass on the side channel only; mid untouched. This is classic **elliptical
EQ** from vinyl mastering (bass summed to mono so the cutter head survived), still
standard practice: phasey stereo bass wastes clipper headroom and muddies small
speakers. Starting spec: 6–12 dB/oct on S below ~120 Hz. Mono input ⇒ S = 0 ⇒
no-op. Open: fixed frequency vs one knob.

### 2.2 ENHANCER

As `ENHANCER_DESIGN.md`: two parametric bells; per-band Stereo or Mid/Side routing;
linked Stereo Amount or independent Mid and Side amounts; Tube/Solid; shared
Subtle/Medium; continuous de-emphasis. All settings are static per §1.

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
material. "Medium" compression (Andrew) rather than SF's near-limiting ratio —
exact threshold/ratio and the knob surface (one knob vs comp-amount + clip-amount)
are open.

T27's repeatable, isolated comparison package is
`reference_labs/polish_comp_clip/`. Its exact decoded fixtures are source facts;
its offline compressor and inter-knot transfer evaluator are explicitly Cosimo
inferences for level-matched tuning, not a proprietary implementation claim.
The independently named `fx/polish_lab/` VST3 exposes those defaults plus the
open detector, macro, tone, and curve decisions for live Ableton tuning; it has
no production signal-path connection.

## 3. Not in this chain

- Modulation of any kind (locked out).
- The sound-design saturator (`DISTORTION_QUALITY_DESIGN.md`) — rack citizen,
  fully modulatable, never merged with this.
- Linear-phase anything; multiband dynamics (the rack's OTT covers it); upward
  maximization; metering DSP in v1.

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

## 5. Open items

1. COMP/CLIP control surface: one fattener-style knob vs separate comp-amount and
   clip-amount; exact "medium" threshold/ratio values (voiced by ear against the
   SF reference numbers).
2. SAFE BASS: fixed ~120 Hz vs a knob; slope 6 vs 12 dB/oct.
3. RackOutputStage relationship: absorbed into the chain's final stage vs kept as
   a separate safety clipper after it; where the output trim UI lives.
4. Transient/PUNCH mode (floated earlier): parked; revisit only if voicing shows
   the finisher kills material worth keeping.
5. Name (working: "Polish").
6. WIDTH stage: out of the lineup unless Andrew re-adds it.
