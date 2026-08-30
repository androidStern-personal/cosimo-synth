# SeqFX sparse state v7 evidence

Date: 2026-08-30

Scope: roadmap Phase 2 (`P2.1`–`P2.9`). This checkpoint covers the release-blocking
bus names, the central effect registry, append-only effect IDs, sparse persisted
state, legacy recall, preset/snapshot migration, and committed-edit undo/redo. It
does not claim Phase 3 lifecycle/buffer behavior or the new effect DSP.

## Contract

- Current stored key/document: `seqfx.v7`, version `7`.
- Read-only migration source: `seqfx.v6`, document version `5`.
- Persisted v7 is a strict sparse hierarchy of 12 patterns, four chains per
  pattern, and authored blocks per chain. The editing/runtime projection remains
  dense so existing public mutations and Cmajor upload arrays stay coherent.
- Non-default values on a continuation cell are represented by an optional
  `stepOverrides` entry. They do not become a new block because doing so would
  manufacture a trigger and change capture/gesture behavior.
- Effect IDs are append-only: Empty `0`, Filter `1`, Crush `2`, Tape Stop `3`,
  Stutter `4`, Pitch `5`, Comb `6`, Ring `7`, Reverse `8`, Talk Box `9`, Vibro
  `10`, Flange `11`, Dirty `12`.
- Undo/redo retains at most 100 committed states. Pointer/live edits create one
  entry on commit; preset and host-authoritative replacement are history
  boundaries. A replacement is parsed before it can clear history or alter the
  current sound.

## Size evidence

Measured with `Buffer.byteLength` over the exact JSON sent to Cmajor stored state:

| Fixture | Baseline v5 | Sparse v7 | Target | Result |
| --- | ---: | ---: | ---: | --- |
| Init/default | 663,686 B | 1,010 B | < 16 KiB | pass; 99.85% smaller |
| 12 patterns × 4 chains × 32 independently triggered active cells | not recorded | 247,970 B | < 256 KiB (262,144 B) | pass; 14,174 B margin |

The dense fixture intentionally prevents block coalescing. It cycles all 12
registered effect IDs, assigns a non-default mix, and uses each effect's current
default parameter vector.

The Flange checkpoint first measured that same fully populated fixture at
264,866 bytes, 2,722 bytes over budget. The v7 writer now omits the redundant
`length: 1` field for the common one-step block. The strict parser treats an
absent length as one while continuing to accept all earlier v7 documents with
an explicit length. Runtime-upload equivalence remains tested. This is a
backward-compatible sparse encoding refinement, not a schema-version change or
a relaxed budget.

## Migration behavior

- A valid v5 document is parsed and range-checked before a v7 write occurs.
- The original `seqfx.v6` key is retained; migration writes `seqfx.v7` once and
  all later boots prefer v7.
- The runtime worker may read v6 as a fallback but never writes stored state.
- Named effect presets and A–G snapshots migrate at the shared contract layer,
  including replacement of their old contract hash and stored-state key. Their
  migration source hash is derived from the live parameter manifest, rather than
  copied as a fragile constant.
- Missing, malformed, wrong-version, out-of-range, overlapping, unsorted,
  out-of-bounds, unknown-field, and fractional-integer documents fail without a
  v7 write. Invalid authoritative replacement also preserves the current sound
  and undo history.
- Migration equivalence is compared at the dense `SeqPatternUpload` boundary,
  including active/trigger/effect/mix/parameter/aux arrays.

### Literal predecessor fixture

The migration suite no longer fabricates its representative v5 document with
the current v7 constructors. `tests/fixtures/seqfx/legacy-v5-dense-state.json.gz`
contains the exact 669,361-byte `seqfx.v6` string emitted by commit
`7fc89fa322764221facdd2714e9b16bc91c41157`, immediately before the v7 work,
through that revision's exported block-edit and serialization API. It includes
one non-default Filter, Crusher, Tape Stop, and Stutter block; Crusher Aux state;
and a four-cell Tape Stop gesture.

The gzip keeps the repetitive dense document at 5,325 bytes. Its sidecar pins
the source commit, source-file hashes, uncompressed and compressed sizes, and
SHA-256 values. `tests/helpers/generate_seqfx_legacy_v5_fixture.mjs` reproduces
the capture from Git history, and the migration test hard-codes those hashes
before checking the Tape Stop and Crush mappings. This proves recall from the
actual predecessor serializer. It is not represented as a customer-supplied
preset or as Ableton save/reopen evidence.

## Qualification at checkpoint

- Focused state/runtime/worker/preset/snapshot/mirror suite: 114/114 passing.
- Shared effect preset suite after the snapshot migration API extension:
  115/115 passing.
- Effect registry/Cmajor host-contract tests: 5/5 passing. Cmajor accepts IDs
  through Dirty `12`; effects not implemented yet remain dry instead of being
  clamped and falsely rendered as Stutter `4`.
- SeqFX Cmajor DSP probe: 51/51 passing.
- Composed SeqFX browser suite: 54/55 passing. All 54 product assertions pass;
  the sole failure is the pre-existing dev-loader React Grab marker failure
  recorded in `baseline.md`. The packaged-production loader test remains green.
- `npm run fx:build -- seqfx`: pass; generated development evidence bundle is
  1,335.74 kB (238.22 kB gzip), worker 62.13 kB (12.24 kB gzip).
- `npx tsc --noEmit`: the repository still exits nonzero on the baseline
  desktop/iOS/bounce/sound-share errors. No error names a Phase 2 changed source
  file.
- `git diff --check`: pass.
- `cmaj play --dry-run --stop-on-error fx/seqfx/SeqFx.cmajorpatch`: loaded
  `Cosimo SeqFX` successfully.

Commands:

```sh
node --test tests/test_seqfx_preset_migrations.mjs tests/test_seqfx_preset_adapter.mjs tests/test_effect_snapshot_bank.mjs tests/test_seqfx_state.mjs tests/test_seqfx_sparse_state.mjs tests/test_seqfx_runtime_bridge.mjs tests/test_seqfx_worker_service.mjs tests/test_stored_state_runtime_mirror.mjs
node --test tests/test_seqfx_effect_definitions.mjs tests/test_seqfx_patch_contract.mjs
npm run test:effect-presets
uv run pytest -q tests/test_seqfx_probe.py
node --test tests/test_seqfx_patch_view_browser.mjs
npm run fx:build -- seqfx
npx tsc --noEmit
git diff --check
cmaj play --dry-run --stop-on-error fx/seqfx/SeqFx.cmajorpatch
```

## Explicit limits

- This checkpoint does not establish Ableton save/reopen acceptance; that is a
  release-phase host gate after all DSP and UI work is integrated.
- It does not turn automated upload equivalence into subjective Tape Stop
  listening acceptance.
- The 256 KiB dense stress case has a 14,174-byte margin. The v7 schema is
  frozen for the roadmap; any later persisted fields require a new size check
  and should remain optional/default-elided.
