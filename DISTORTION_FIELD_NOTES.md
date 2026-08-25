# Distortion Field Notes

Session knowledge notes, 2026-08-25 (Andrew + assistant). Not a design doc — a
reference companion to `DISTORTION_QUALITY_DESIGN.md` (whose §9 holds the
open-source survey receipts: sst-waveshapers, Surge XT, Vital, chowdsp/BYOD).

## A taxonomy: what a distortion bends

Every distortion type bends one of five things about the wave. Grades of memory per
`DISTORTION_QUALITY_DESIGN.md` §2 (1 = bookkeeping, 2 = structural, 3 = physical).

| Axis | Mechanism | Examples discussed | Memory |
|---|---|---|---|
| Height | Static transfer curve: monotonic = saturation, non-monotonic = wavefolding (Buchla/Serge West-Coast lineage); asymmetry/bias ⇒ even harmonics | "Grill" (sat+fold), "Tube" (Class-A triode: 2nd-harmonic at low drive, asymmetric dual knees, bias drift when pushed) | 1–2 |
| Speed | Limit/warp rate-of-change: slew limiting rounds fast edges into ramps; frequency-dependent by nature, dark and filter-like (op-amp TIM, ProCo RAT's LM308, Serge slope generators) | "Slew" (3 variants: hard slew clamp, soft slew, differentiate→shape→re-integrate) | 2 |
| Time | Audio-rate self-modulated delay = phase modulation = feedback FM; inharmonic sidebands (Chowning FM, DX7 feedback operator — unrelated to Casio "phase distortion") | "Phase" | 2 |
| Change | Exaggerate dV/dt instead of flattening peaks — crest factor *rises*; loosely transformer-inspired (output ∝ dΦ/dt; flux-domain trick: integrate → saturate → differentiate) | "Rubidium" | 2 |
| Memory | The nonlinearity itself remembers: tape hysteresis (stubborn magnetic domains, path-dependent M(H) loop, AC bias linearization; Jiles–Atherton solved per-sample in ChowTape/BYOD; commercial "efficient" versions use reduced-order loops) | "Tape" | 3 |

Real-transformer footnote: flux ∝ V/f, so lows saturate first — the Neve/console
low-end weight; implement phenomenologically as low-shelf boost pre-clipper,
matching cut post.

## Enhancer lineage (context for ENHANCER_DESIGN.md)

Aphex Aural Exciter (mid-70s): high-pass → distort → blend a whisper back.
Wavesfactory Spectre (2018, DSP: Jesús Ginard + Ivan Cohen) generalizes it: 5-band
parallel boost-only EQ, the *difference* signal per band saturated (10 curve types),
de-emphasis (v1.5) subtracts the linear boost so only new harmonics are added —
architecturally identical to Cosimo's existing "harmonics" residue mode, band-limited.
Parallel boost-only topology is what makes the difference extraction phase-clean.

## Loudness lineage (context for POLISH_CHAIN_DESIGN.md)

Waves L1 (1994) begat lookahead limiting; TDR Limiter 6 GE documents the full
canonical chain (RMS comp → peak limiter → HF limiter → clipper → true-peak);
modern EDM practice is increasingly clipper-first ("clip to zero"). Sausage
Fattener, measured, is a low-cut → ceiling-parked peak-catcher comp → rounded hard
clip with one drive macro (`SAUSAGE_FATTENER_ANALYSIS.md`). Elliptical EQ (side-HP
bass mono) comes from vinyl cutting and survives as standard mastering hygiene.
