# Bounce in Place implementation log

## 2026-08-23 — M0: Linux environment green

Baseline: `a80bdface7f10406d3e70aa2117086910b8b2017` on
`codex/bounce-in-place`.

- Read `BOUNCE_IN_PLACE_AGENT_HANDOFF.md` and
  `docs/reference/BOUNCE_IN_PLACE_FEASIBILITY.md` before implementation.
- Fetched the pinned Cmajor 1.0.3066 source (`172db532…`) plus patched CHOC,
  built the `cmaj` CLI, and built `cosimo_cmajor_external_codegen` on Linux.
- A four-job Cmajor build exhausted the Codespace's 7.8 GiB RAM and the
  compiler was killed. Serial builds completed reliably, so code-generation
  scripts now accept `COSIMO_CMAJOR_BUILD_JOBS=1` without changing the
  existing default.
- Ubuntu packages expose WASI preview 1 as `wasm32-wasi`, whereas the renderer
  script only understood Homebrew's `wasm32-wasip1`. The script now detects
  both layouts and checks linker support before using `--no-stack-first`.
  The shared-memory renderer inspection passed with LLVM 18.
- `npm run web:build` completed with the external renderer linked into the
  generated Cmajor WebAssembly product.
- The browser harness now uses pinned headless Playwright Chromium on Linux
  while retaining headed system Chrome on macOS. The functional web POC
  result was 13 passed, 5 skipped, 0 failed. Two pre-existing WebKit-only
  tests and three real-output performance tests were skipped; headless Linux
  has no realtime sink. An exploratory forced run showed valid continuous
  output but meaningless wall-clock load (including average load 0.683 and
  53 deadline misses in one mobile case), confirming the environment
  limitation rather than a product regression.
- `npm run test:modulation:routing` passed. `npm run test:units:orphans`
  passed all 68 tests when run outside the process-spawn sandbox; the one
  sandbox-only failure was a C++ compile/execute probe denied with `EPERM`.
- The web bundle contract initially exposed pre-existing worker growth from
  the Effects Lane dynamic-target baseline (`be5309e..367922d`), not M0 work:
  149,732 raw and 36,209 bytes with Node level-9 gzip versus stale ceilings
  of 145,000/34,900. The ceilings are now 151,000/36,600 (under 1.5%
  headroom), and all 14 bundle contract tests pass.

G1 baseline, committed in
`docs/reference/BOUNCE_M0_OFFLINE_SPEED.json`: three 3-second single-voice
runs measured 2.692×, 2.818×, and 2.798× realtime (2.798× median). The locked
19-root, 9-second-per-root default projects to 62.35 seconds serial or 15.59
seconds at ideal four-worker scaling. This is well below the five-minute
pivot threshold, so the locked default remains unchanged. Absolute timing is
informational because the Codespace CPU is shared.

Reproduction steps and exact toolchain paths are in
`docs/BOUNCE_CODESPACE_SETUP.md`.
