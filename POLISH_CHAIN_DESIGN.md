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
  1. FAT       one-knob fattener       (slow-attack comp + auto-makeup + soft clip)
  2. ENHANCER  the two-band module     (per ENHANCER_DESIGN.md, unchanged)
  3. WIDTH     one-knob M/S balance    (side gain 0..1.5, neutral 1.0)
→ [ RackOutputStage: existing soft clip + output trim ]
```

Rationale for the order: density first — the enhancer sits **after** the fat stage
so its added harmonics aren't compressed back down (standard exciter placement) and
so it reacts to the fattened balance; width after harmonics so side enhancement and
width read as one image decision; clipper last, always. Tilt was in an earlier draft
and is out (Andrew veto, 2026-08-25): linear tone re-balancing is `GlobalFilter`'s
job, and the enhancer adds content rather than re-balancing.

### Stage specs and starting constants

- **FAT** — single knob 0..1, Sausage-Fattener school (Andrew's reference,
  2026-08-25), **voiced loudness-first** (Andrew's call, same day: "we're going for
  loudness"): a compressor + static makeup driving an **integrated soft clipper**,
  stereo-linked RMS detector (~10 ms window), soft knee, **no lookahead**. Division
  of labor, which is the whole loudness mechanism: the compressor buys *density*
  (body up), the clipper eats *peaks* (crest down) — peak-eating lives in the
  clipper rather than the compressor's attack because attack-based peak control
  ducks the entire signal on every hit (losing the RMS it just bought) and, with
  no lookahead permitted (ADR-008; `RackOutputStage`'s own rationale), overshoots
  besides. Clipper-led is how loud actually gets made.
  The knob is a macro over everything, **attack included**: threshold unity →
  ~−24 dBFS, ratio 2:1 → ~8:1, attack 20 ms → ~2 ms, program-dependent release
  100–400 ms → 50–150 ms, clipper drive up to ~6 dB of peak shave. Low travel =
  glue-ish density (attack barely matters at 1–2 dB of reduction, transients ride
  through naturally); top travel = fast-everything maximizer smash. Both are loud;
  the knob moves monotonically louder.
  **Makeup is peak-referenced, not loudness-matched** — a deliberate departure
  from the equal-loudness contract used everywhere else in these docs: output true
  peak is held ~constant while crest factor falls, so LUFS genuinely rises with
  the knob. This stage's honest frame is "trade crest for loudness," and hiding
  that behind loudness-matching would defeat its purpose. Neutral at 0 = true
  identity. Single-band on purpose; aggressive multiband lives in the rack's
  existing OTT module. Color knob deliberately omitted — the enhancer next in
  line is the color section. (Sausage Fattener's internals are closed-source and
  undocumented; the target is its observable behavior — one knob, instantly
  louder and fatter, saturation woven into the compression — not its constants.)
- **ENHANCER** — exactly as `ENHANCER_DESIGN.md` (two parametric bells, Tube/Solid,
  independent mid/side amounts, always-on de-emphasis). Its 10 params become static
  dial-ins like the rest of the chain.
- **WIDTH** — side gain 0 (mono) .. 1.0 (neutral) .. 1.5 (wide). Broadband in v1;
  bass-mono crossover deliberately deferred (it's a taste feature with phase
  consequences, and the enhancer's mid-targeted low bell already covers "keep the
  low end solid").

Total new controls beyond the enhancer's 10: **two knobs** (FAT, WIDTH). Every stage
neutral by default; a fresh patch's polish chain is an identity.

## 3. What the polish chain is not

- Not modulatable (locked). No LFOs, no envelopes, no macros reaching it.
- Not the sound-design saturator — `DISTORTION_QUALITY_DESIGN.md`'s module stays a
  rack lane citizen with full modulation. The two never merge.
- No lookahead limiter, no linear-phase anything — ADR-008 forbids both. The loud
  endgame is clipper-led (FAT's integrated clipper feeding `RackOutputStage`'s
  ceiling), per the output stage's own no-lookahead rationale.
- No metering DSP in v1 (UI may tap existing preview streams later).
- Not transparent: the FAT stage is colored on purpose (Sausage-Fattener school,
  not SSL-bus school).

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
3. FAT contract: output true peak constant within ±0.5 dB across the whole knob
   travel, LUFS monotonically increasing with the knob (crest-for-loudness trade,
   realized honestly), and no audible pumping on a drum loop at mid travel.
4. Enhancer ship criteria inherited from `ENHANCER_DESIGN.md` §8.
5. Andrew dials a patch's polish by ear without touching documentation — three
   knobs plus the enhancer must be self-explanatory.

## 6. Open decisions (defaults apply unless overridden)

1. **Lineup membership.** Enhancer and FAT are locked in; tilt is vetoed out
   (2026-08-25). Width remains my proposal — default: it ships.
1b. **PUNCH / transient mode.** Floated by Andrew 2026-08-25. Default: **not in
   v1** — the knob's lower travel already is the punchy setting (slow attack,
   light reduction), so a separate mode only earns its place if voicing shows the
   loud top half destroys material worth keeping. If needed later: a toggle that
   pins the slow-attack profile across the whole travel (or a small transient
   re-injection stage, Drum-Buss style), rather than a second continuous control.
2. **RackOutputStage UI folding.** Default: the output stage keeps its identity in
   code but its drive/trim controls appear in the polish panel, so the user sees one
   "finish" section. Alternative: leave its UI where it is.
3. **Name.** Working name "Polish" (`wt::PolishChain`). Alternatives: Finish,
   Master, Out.
