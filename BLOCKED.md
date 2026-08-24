# Current blocker

## 2026-08-24 — M1 boundary: Bounce G2 resident-bank relative-load gate

The URL-sharing implementation and its focused/full UI suites are green, but
the pre-existing Bounce G2 browser performance assertion is red after the
required Effects Lane T7 starter-patch merge. The current three-device starter
reduces the fresh oscillator baseline; after one Bounce/Revert cycle, the same
oscillator with the bank resident measures above the frozen relative limit.

Reproduction:

```sh
npm run web:build
node --test tests/test_bounce_ui_browser.mjs
```

Three isolated runs on this checkout failed the assertion at
`tests/test_bounce_ui_browser.mjs:359`:

- baseline `0.3406`, resident `0.4197`: +23.2%
- baseline `0.3296`, resident `0.4307`: +30.7%
- the preceding aggregate run measured baseline `0.3442`, resident `0.4211`:
  +22.3%

The limit is +10%. All three runs reported zero deadline misses; sampled mode,
the Bounce/Revert transaction, and the ten-cycle retirement test passed. The
same gate was green before T7 at roughly +4–7% using the eight-device legacy
default as the denominator.

This branch will not change the Effects Lane default or its DSP to make the
measurement green: the handoff expressly forbids completing or fixing Effects
Lane here. It will also not weaken or mask Bounce's 10% gate. Non-dependent
video milestones continue while this boundary incompatibility remains explicit.
