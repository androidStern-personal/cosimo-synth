# Polish Chain Design

Status: **concept locked, lineup proposed, 2026-08-25** (Andrew + assistant session).
Companion to `ENHANCER_DESIGN.md` and `DISTORTION_QUALITY_DESIGN.md`.

Andrew's call (2026-08-25): a **fixed mastering/polish chain at the very end of the
signal path. Not modulatable. A static chain you dial in.** The two-band enhancer is
a confirmed member. This document locks the chain's properties and proposes its
lineup; per-stage membership beyond the enhancer is open for veto (§6).

## 1. Properties (locked)

- **Fixed**: one chain, fixed order, always present. Not a lane module, not pooled,
  not reorderable. Single resident instance.
- **Static**: parameters are dialed in and preset-persisted only — **no rack
  modulation targets**. Params are still control-rate smoothed against zipper noise,
  but nothing in the modulation system can reach them. This deliberately breaks from
  every other effect in Cosimo, and it is the point: the polish chain is the frame,
  not the painting.
- **Position**: after everything — all lanes/modules and the global filter — and
  immediately before `RackOutputStage`, whose existing no-lookahead soft-clip safety
  stage serves as the chain's final element without moving any code.
- **Zero latency** (ADR-008): every member is minimum-phase IIR + memoryless or
  ADAA-grade nonlinearity. No lookahead anywhere (the `RackOutputStage.cmajor:32`
  rationale applies to the whole chain), no linear-phase EQ, ever.
- **Neutral = bit-exact**: every stage short-circuits to identity when its controls
  sit at neutral (checked per stage, routed around — not "multiply by ≈1"). A fresh
  patch with an untouched polish section passes audio unmodified, same contract as
  ADR-005 module bypass. This matters because M/S encode/decode and smoothed gains
  are not bit-exact by arithmetic; they must be bypassed, not trusted.

## 2. Proposed lineup (in order)

```
[ rack lanes → global filter ] →
  1. TILT      one-knob tone           (±3 dB, pivot ~700 Hz, 1-pole shelf pair)
  2. GLUE      one-knob bus compressor (2:1, slow, program-dependent, auto-makeup)
  3. ENHANCER  the two-band module     (per ENHANCER_DESIGN.md, unchanged)
  4. WIDTH     one-knob M/S balance    (side gain 0..1.5, neutral 1.0)
→ [ RackOutputStage: existing soft clip + output trim ]
```

Rationale for the order: tone correction first so the compressor and enhancer react
to the corrected balance; enhancer **after** the glue so its added harmonics aren't
compressed back down (standard exciter placement); width after harmonics so side
enhancement and width read as one image decision; clipper last, always.

### Stage specs and starting constants

- **TILT** — single knob −1..+1 → ∓3 dB low shelf / ±3 dB high shelf around a
  ~700 Hz pivot, 1-pole pair, exact inverse curves so knob = perceptual tilt.
  Neutral at 0. The "make it darker/brighter without opening an EQ" knob.
- **GLUE** — single knob 0..1. Fixed character: ratio 2:1, soft knee 6 dB, attack
  ~20 ms, program-dependent release 100–400 ms, stereo-linked RMS detector (~10 ms
  window), **no lookahead**. The knob maps threshold from "above signal" (0 = true
  unity) down to ~−18 dBFS, with static auto-makeup voiced at −18 dBFS pink so
  loudness holds while density increases — same fairness philosophy as
  `DISTORTION_QUALITY_DESIGN.md` §3.3. Single-band on purpose; aggressive multiband
  lives in the rack's existing OTT module, not here.
- **ENHANCER** — exactly as `ENHANCER_DESIGN.md` (two parametric bells, Tube/Solid,
  independent mid/side amounts, always-on de-emphasis). Its 10 params become static
  dial-ins like the rest of the chain.
- **WIDTH** — side gain 0 (mono) .. 1.0 (neutral) .. 1.5 (wide). Broadband in v1;
  bass-mono crossover deliberately deferred (it's a taste feature with phase
  consequences, and the enhancer's mid-targeted low bell already covers "keep the
  low end solid").

Total new controls beyond the enhancer's 10: **three knobs.** Every stage neutral by
default; a fresh patch's polish chain is an identity.

## 3. What the polish chain is not

- Not modulatable (locked). No LFOs, no envelopes, no macros reaching it.
- Not the sound-design saturator — `DISTORTION_QUALITY_DESIGN.md`'s module stays a
  rack lane citizen with full modulation. The two never merge.
- No lookahead limiter, no linear-phase anything, no upward maximizer — ADR-008 and
  the "synth, not mastering suite" line both forbid it. `RackOutputStage`'s clipper
  is the ceiling.
- No metering DSP in v1 (UI may tap existing preview streams later).

## 4. Engineering notes

Being static erases the expensive parts of module-hood: no modulation-table rows, no
lane-state schema growth, no pool instances or `poolResetIn` lifecycle, no
per-ordinal parameter fan-out. One resident processor group at the tail of the rack
graph with value-input params. Preset persistence rides the existing patch/effect
snapshot format. The latency witness proof extends over the chain unchanged
(everything is 0), and the all-neutral bit-exact contract gets its own test.

## 5. Ship criteria

1. All controls neutral ⇒ output bit-exact with the chain absent (the identity
   contract, per stage and end-to-end).
2. Rack latency witness still proves 0 with the chain in the graph.
3. Glue at any knob position: pink-noise loudness within ±1 dB of bypass
   (auto-makeup contract).
4. Enhancer ship criteria inherited from `ENHANCER_DESIGN.md` §8.
5. Andrew dials a patch's polish by ear without touching documentation — three
   knobs plus the enhancer must be self-explanatory.

## 6. Open decisions (defaults apply unless overridden)

1. **Lineup membership.** Enhancer is locked in. Tilt, Glue, Width are my proposal —
   default: all three ship. Veto any stage and the order of the rest stands.
2. **RackOutputStage UI folding.** Default: the output stage keeps its identity in
   code but its drive/trim controls appear in the polish panel, so the user sees one
   "finish" section. Alternative: leave its UI where it is.
3. **Name.** Working name "Polish" (`wt::PolishChain`). Alternatives: Finish,
   Master, Out.
