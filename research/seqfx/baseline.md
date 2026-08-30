# SeqFX Frozen Baseline

Captured 2026-08-30 from `codex/seqfx-excellence-01a05051` at roadmap
commit `b824306134a3f6f125068b1e014a4be1d635d2c6`. This is the before-state for
the SeqFX excellence work. Build outputs live under
`build/seqfx-evidence/baseline/` and are intentionally not source artifacts.

## Environment

| Item | Baseline |
|---|---|
| Base | `origin/master` `7fc89fa322764221facdd2714e9b16bc91c41157` |
| Worktree | `/Users/winterfell/.codex/worktrees/seqfx-excellence-01a05051/cosimo-synth` |
| macOS | 26.5.1, build 25F80, arm64 host |
| Node | 22.22.3 |
| npm | 10.9.8 |
| CMake | 4.2.3 |
| Xcode | 26.5, build 17F5022i |
| AppleClang | 21.0.0.21000101 |
| Cmajor | 1.0.3066, build 2025-11-22 |
| pluginval | 1.0.4 |

`npm ci` installed 246 packages from the lockfile. `npm audit` reported 12
known dependency advisories: 2 low, 3 moderate, 6 high, and 1 critical. No
automatic audit rewrite was run because it can change the dependency graph.

## Source inventory

- Stored key: `seqfx.v6`; stored document version: `5`.
- Composition: 12 patterns, 4 serial chains, 32 steps, 8 parameter slots.
- Stable effects: Empty 0, Filter 1, Crusher 2, Tape Stop 3, Stutter 4.
- The saved document expands every empty step and its aux target array.
- Tape Stop and Stutter each allocate a one-second history for each chain.
- Patch audio endpoints are named only by endpoint ID (`audioIn`, `audioOut`),
  with no host-facing `Input` and `Output` annotations.

## State measurements

Measured with the production state serializer, counting UTF-8 bytes.

| Case | Bytes |
|---|---:|
| Default 12-pattern state | 663,686 |
| Dense stress state with all steps active and four effect memories | 847,526 |

The roadmap targets are below 16 KiB default and below 256 KiB dense stress.
The current schema misses both by a large margin.

## Automated baseline

### State, bridge, worker, and editor-domain tests

Command:

```sh
node --test --test-concurrency=1 \
  tests/test_seqfx_state.mjs \
  tests/test_seqfx_runtime_bridge.mjs \
  tests/test_seqfx_worker_service.mjs \
  tests/test_seqfx_aux_source.mjs \
  tests/test_seqfx_crusher_preview.mjs \
  tests/test_seqfx_stutter_envelope.mjs \
  tests/test_seqfx_tape_stop_envelope.mjs
```

Result: 72 passed, 0 failed.

### Rendered Cmajor DSP probes

Command:

```sh
uv run pytest -q tests/test_seqfx_probe.py
```

Result: 51 passed in 3.69 seconds, including Cmajor JavaScript generation.

### Browser and packaged-view tests

Command:

```sh
npm run fx:build -- seqfx
node --test --test-concurrency=1 \
  tests/test_seqfx_patch_view_browser.mjs \
  tests/test_seqfx_production_view_browser.mjs
```

Result: 61 passed, 1 failed. The failure is the development-loader test
`seqfx_shared_effect_loader_imports_react_dev_module_from_manifest`, which
expects the development-only React Grab marker. All seven packaged
shadow-root/loader tests passed. This is recorded as a pre-existing tooling
contract mismatch, not an effect-DSP failure.

### Cmajor load

`cmaj play --dry-run --stop-on-error build/fx/seqfx_runtime/SeqFx.cmajorpatch`
loads `Cosimo SeqFX` successfully. Generated JavaScript is 1,263,798 bytes.

## Production VST3 baseline

Command:

```sh
npm run fx:prod:build -- seqfx --clean
```

Clean build result:

- wall time: 61.52 seconds;
- universal architectures: `x86_64 arm64`;
- bundle disk use: 14 MiB;
- executable size: 14,558,480 bytes;
- executable SHA-256:
  `b45d4689d619a3bd1cffc9733d0678513814d62c43e652916036f795f255741f`;
- ad-hoc signature passes `codesign --verify --deep --strict`.

Strict pluginval command:

```sh
/Applications/pluginval.app/Contents/MacOS/pluginval \
  --validate build/seqfx_juce/_build/plugin/CosimoSeqFX_artefacts/Release/VST3/CosimoSeqFX.vst3 \
  --strictness-level 5 \
  --timeout-ms 120000
```

Result: scan succeeds, then cold-open aborts with:

```text
libc++abi: terminating due to uncaught exception of type choc::value::Error:
This type is not an object
```

This is the frozen reproduction for the unnamed audio-bus blocker. It must be
rerun immediately after the host-facing bus names are added.

## Visual baseline

Screenshots:

- `build/seqfx-evidence/baseline/seqfx-default.png`
- `build/seqfx-evidence/baseline/seqfx-900x600.png`
- `build/seqfx-evidence/baseline/seqfx-720x520.png`

Measured layout:

| Viewport | Document size | Finding |
|---|---|---|
| 1280×720 browser default | 1280×720 | No page overflow; empty inspector uses only 71 px height |
| 900×600 | 900×600 | No page overflow in empty state |
| 720×520 | 720×715 | 195 px vertical page overflow before an effect editor is selected |

Visible baseline defects:

- chain names are absent from the composed grid;
- the empty inspector is visually underdeveloped and wastes its available area;
- the preset/snapshot header plus pattern strip is already dense;
- the minimum supported editor cannot contain the empty-state surface;
- the effect picker is not present until selection and is icon-first;
- the current surface has no visible complete clock/loop/bypass/mix workflow.

## Frozen audio

The same deterministic complex stereo source was rendered through one block of
each existing effect at 48 kHz:

- `build/seqfx-evidence/baseline/audio/source.wav`
- `build/seqfx-evidence/baseline/audio/filter.wav`
- `build/seqfx-evidence/baseline/audio/crush.wav`
- `build/seqfx-evidence/baseline/audio/tape-stop.wav`
- `build/seqfx-evidence/baseline/audio/stutter.wav`
- `build/seqfx-evidence/baseline/audio/metrics.json`

All outputs are finite. The render is a regression reference, not subjective
approval. In particular, it preserves the Tape Stop behavior the user already
rejected.

## Performance interpretation

The 51-probe suite completing in 3.69 seconds and the 61.52-second clean native
build are reproducible engineering baselines. They are not substitutes for DAW
CPU measurements. No fresh Ableton CPU trace or ten-minute real-time stress run
was performed at this checkpoint; final qualification must measure those from
the release candidate.

## Competitor availability

A read-only scan of system and user audio-plugin directories found no local
Effectrix, Looperator, Turnado, Kilohearts Tape Stop, ShaperBox/TimeShaper,
Tape MELLO-FI, or Koala FX installation. Product behavior that has not been
measured locally is recorded only from official documentation in the benchmark
documents.
