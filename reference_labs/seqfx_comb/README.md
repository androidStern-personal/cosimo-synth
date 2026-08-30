# SeqFX Comb Candidate Lab

This lab independently implements the three candidates specified in
`research/seqfx/comb-research.md`: conventional reference, allpass-dispersive,
and four-line Hadamard-coupled vector combs.

Run:

```sh
uv run python -m reference_labs.seqfx_comb.render_candidates --check
```

Outputs are written under `build/seqfx-comb-lab/`. They are research evidence,
not production DSP. The implementation intentionally favors literal equations
and measurements over realtime optimization; the selected topology must be
rewritten and bounded in Cmajor.
