# State-management test audit

Date: 2026-09-10. Worktree: `/Users/winterfell/src/cosimo-synth`, branch `codex/plugin-state-system`, baseline commit `faab35a3b648250f63ecc6a032b3a32d4d46af7c`.

Scope: read-only audit of the existing tests and production interfaces. This document is the only file written by the audit worker. The coordinator is independently adding a regression test and fixing the lifecycle issue below. Existing dirty trackers and research files were preserved. Guidance read: root and kit `AGENTS.md`, `docs/AGENT_COORDINATION.md`, coding-standards `TESTING_AND_VERIFICATION.md`, and the TDD skill. No native builds, generated UI output, browser servers, installs, or DAW mutations were performed.

## Recommendation

Use **SeqFX as the first full structured-state integration target**, while keeping the shared scalar host-binding contract distinct. SeqFX already has public bridge commands, a persistent document, a runtime worker, a preset adapter, one-gesture undo/redo, authority distinctions, and reproducible property tests. These are concrete seams for proving a new state core without inventing a test-only architecture.

Cosimo has strong scalar readiness and runtime-install coverage, but state ownership spans multiple domains and its MSEG undo is a local one-level shape checkpoint. Its broader bridge includes modulation, articulation, routing, native whole-sound restore, and other owners. Moving all of these at once would make failures harder to localize. Use the existing Cosimo scalar browser tests as a separate acceptance contract; later take one structured domain through the new core.

## Preserve these strong protections

| Existing file and cases | Evidence actually established |
|---|---|
| `kit/tests/test_stored_state_runtime_mirror.mjs:159-550` | Production mirror with recording connection and injected delivery function: Cmajor values-bucket hydration, no write-on-boot, required-parameter gating, runtime-session refresh, deduplication, send failure retry, deferred acknowledgment/coalescing, false/rejected acknowledgments, listener cleanup. |
| `kit/tests/test_effect_snapshot_bank.mjs:438-733` | Production bank interface: hydration before capture, detach/reattach, persistence failure before sound writes, partial parameter-write rollback, stale boot reply after a user mutation, malformed bank rejection. These are useful independent failure boundaries, not redundant happy paths. |
| `tests/test_seqfx_runtime_bridge.mjs:1053-1440` | Public edits, no-op suppression, bounded gesture semantics, undo/redo and divergent-history invalidation, monotonic runtime upload revisions, preset replacement clearing history, invalid replacement preserving sound and history. The revision test composes the real bridge and worker on one recording connection. |
| `tests/test_seqfx_preset_adapter.mjs:139-306` | Adapter capture and apply through real bridge/worker: all-pattern serialization, authoritative recall versus ordinary edit, Aux arrays in actual emitted runtime payloads. Keep alongside bridge tests: the adapter is a separate caller-facing route. |
| `tests/test_seqfx_worker_service.mjs:218-453` | Last-good runtime state survives malformed updates; startup survives invalid saved state; selection changes reupload; one-pattern edit markers are checked and mismatched recall fails closed. |
| `tests/test_seqfx_state_properties.mjs` and `tests/test_seqfx_block_properties.mjs` | Fixed seeds, deep-frozen caller values, independent topology traversal, codec fixed points, semantic preservation, overlapping/out-of-range rejection, edit sequences. Preserve seeds and run counts. |
| `tests/test_seqfx_sparse_state.mjs:117-503` | Rare per-step overrides, effect memories/Aux round trip, dense host-state budget, strict boundary rejection with typed paths. Concrete regressions complement generated inputs. |
| `tests/test_shared_synth_hooks_browser.mjs:375-605,736-806` | Real mounted React hooks with controllable connection responses: endpoint and connection rebinding, not-ready writes blocked, stale responses ignored, float32 echoes, host gesture ownership, blur/unmount cleanup, clamped host truth. This is the strongest current scalar integration contract. |
| `tests/test_shared_synth_hooks_browser.mjs:609-734` | Articulation discard undo belongs to the exact connection and stale reconnect hydration is rejected. This does not establish MSEG undo ownership. |
| `tests/test_modulation_bridge.mjs:248-432,514-558` | Atomic document rejection, last-good state, independent A/B shape edits, stable route-identity subscriptions and notification locality. |
| `tests/test_runtime_install_channel.mjs` | Production transport interface: dropped input/output acknowledgment, exact replay serial, semantic rejection, one publisher per lane, independent modulation/articulation lanes, lifecycle cancellation, malformed acknowledgment, suspension and bounded replay. Strong failure/interleaving suite. |
| `tests/test_modulation_worker_service.mjs` | Composed real worker and runtime channel publishing all 1,484 routes with correlated acknowledgments; independently checks the tails of sparse route arrays. A fake receiver proves the JS protocol, not DSP acceptance. |
| `tests/test_desktop_patch_view_browser_articulation_mseg.mjs:3099-3129` | Visible MSEG Undo actually removes an added point from stored shape. Preserve it; do not equate button existence with undo behavior. |

## Concrete holes and repairs

### 1. Confirmed: delayed mirror boot callbacks outlive their owner

`kit/ui/stored-state-runtime-mirror.ts:184` accepts a captured full-state callback without lifecycle correlation. `applyRuntimeStateIfReady()` has no started guard. Existing stop cases at `kit/tests/test_stored_state_runtime_mirror.mjs:502-569` emit through listeners that have already been removed; they never resolve captured boot callbacks.

A read-only Node probe through `createStoredStateRuntimeMirror` produced:

```json
{"case":"deferred bootstrap after stop","events":[{"endpointID":"image","value":"stale after stop"}]}
{"case":"old bootstrap after restart","events":[{"endpointID":"image","value":"fresh"},{"endpointID":"image","value":"old lifecycle"}]}
```

Probe sequence: capture `requestFullStoredState` callbacks in a recording connection; `start`, `stop`, resolve old callback; then `start`, resolve current callback, resolve old callback. No private field access was needed. Add separate public behavior tests for stopped replies, old replies after restart, and old asynchronous delivery completion after restart. Also test a live authoritative stored-state update followed by a delayed boot snapshot, because same-lifecycle staleness is distinct from stop/start ownership. The coordinator is addressing this issue; the original baseline passed despite it.

### 2. The async modulation echo test never creates an echo

`tests/test_modulation_bridge.mjs:498-511` constructs `AsyncEchoPatchConnection`, attaches and requests boot, then flushes microtasks. Boot does not call `sendStoredStateValue`, so its asynchronous echo queue stays empty. Furthermore the UI bridge intentionally does not upload runtime events. An unchanged upload count cannot establish echo suppression in this architecture.

Repair through the public interface: commit a real route/shape edit, capture delayed stored-state echoes, release them in duplicate and reordered sequences, and observe current state, subscriber notifications, and persisted writes. Include a genuine external replacement after pending echoes. The synchronous echo test at `:560-580` directly reads private `pendingStoredStateEchoes.size`; replace that implementation assertion only when the new behavioral cases prove its original no-leak/no-resuppression protection.

### 3. Randomized command rejection swallows unexpected defects

`tests/test_seqfx_block_properties.mjs:300-305` continues after every non-null error except `TypeError`. An ordinary `Error` or `RangeError` from a valid operation therefore counts as an acceptable rejected command. The final state can remain valid because no operation succeeded.

Keep the independent topology oracle and immutability checks, but make expected acceptance/rejection explicit in a small command model. Reject only the documented domain failure and assert the predicted unchanged state; propagate all unexpected errors. Generate sequences containing successful transitions, and assert those semantic outcomes. Do not solve this by excluding difficult commands, lowering run counts, or replacing the oracle with production normalization.

### 4. Source-string checks are not restore/runtime proof

`tests/test_complete_sound_state_contract.mjs:103-240` checks many exact native helper names/expressions. `:243-273` infers atomic restore ordering from source indexes; `indexOf` returning `-1` can satisfy some less-than comparisons, and names/order do not execute a host restore. Keep the real compiled header test at `:81-101` and exact host-identity inventory checks. Label source checks as wiring/architecture guards. Add an interface-level native fixture that restores an invalid chunk and verifies all observable parameters/stored values remain unchanged before considering string guards replaceable.

`tests/test_seqfx_patch_contract.mjs:9-13` is a useful cheap declaration guard but does not prove host bus enumeration. Do not remove artifact or native checks because this source guard passes.

### 5. Important missing state-core acceptance cases

These were not found in the inspected suites; they are requirements for the new integration, not claims that every current feature is broken.

- SeqFX: connection detach/rebind during a live edit, delayed/reordered self echoes around external full recall, stored-state send failure during commit/undo/redo, host clamp arriving during a scalar gesture, and actual history-cap behavior through `canUndo`/`undo` rather than private stack inspection. The existing `SEQFX_UNDO_HISTORY_LIMIT = 100` is not itself proof of bounded history.
- MSEG: a multi-move gesture creates one checkpoint, Undo restores exact A or B shape and playback policy as intended, swapping connection/slot/shape identity invalidates foreign checkpoints, and expanding the editor preserves the same session checkpoint. Existing visible Undo checks only restore point count after one add; `ui/shared/synth-hooks.ts:2059-2080,2191-2225` owns the checkpoint in React state.
- Cross-domain transaction: malformed external state changes neither published state nor persisted state nor undo history; asynchronous persistence/runtime failure produces explicit outcomes; cancellation cannot commit after its owner is gone; selector subscribers observe a coherent committed snapshot with stable identity for unrelated domains.
- Representative runtime: same public state commands and serialization must execute in the actual Worker/QuickJS/host transport as applicable. Node bundles and recording adapters do not prove structured-clone restrictions, native queues, host session restore, DAW undo, or audio acceptance.

## Tightening runtime without weakening protection

1. **Clear successful deadline timers.** `tests/test_runtime_install_channel.mjs:9-16` uses `Promise.race` without clearing the losing one-second timeout. Clear it in `finally` or use an equivalent owned deadline helper. Preserve all timeout assertions. Several timing cases also use real 1/3/20/40 ms waits; an injected scheduler would make causal timeout/replay tests deterministic while retaining a small real-event-loop smoke test.
2. **Separate authored-source qualification from generated-artifact qualification.** `tests/test_modulation_bridge.mjs`, `tests/test_mseg_editor.mjs`, and `tests/test_runtime_install_channel.mjs` import `patch_gui/*.js`; changing the authored TypeScript does not automatically change what those tests execute. Use source modules for the fast core contract and retain a distinct generated-artifact parity/runtime gate. Do not relabel a stale generated baseline as current source proof.
3. **Deduplicate runner invocations, not assertions.** Root `npm test` serially runs the long `test:units:orphans` list and several other groups. `test_fx_build_args.mjs` appears both there and in `test:enhancer-lite:state`; Build a concrete file inventory before deduplicating other nested commands; shared tests also recur across separately requested qualification commands such as `test:synth:defaults` and `test:sound-share`. SeqFX properties also have a dedicated command and run inside the broad unit group; running both consecutively repeats the expensive workload.
4. **Keep SeqFX qualification inventory fail-closed.** `scripts/qualify_seqfx_source.mjs:18-77,148-178` explicitly assigns every SeqFX test once and rejects missing/duplicate assignments. This is valuable. Its `crossSurfaceNode` points to `tests/test_effect_snapshot_bank.mjs`, while the actual bank test now lives under `kit/tests/`; the old path was confirmed absent in this checkout. Fix the path as a runner repair. Do not weaken the preflight to silently skip missing files.
5. **Partition only independent pure Node groups.** The current orphan command uses concurrency one across roughly a hundred files. Group source/core, codec/property, and runtime-transport tests with bounded process concurrency after checking their mutation footprint. Keep native builds, output-generating tests, and browser/shared resources serialized. Parallel scheduling lowers wall time, not CPU cost, and can distort benchmark numbers.
6. **Profile properties before changing them.** The three block properties alone took approximately 48.0 s, 41.4 s, and 14.4 s in this run. They repeatedly traverse/freeze the full dense editing state; those traversals preserve meaningful immutability/topology protection. First measure generation, transition/normalization, freeze, and oracle costs. Cache traversal only for recursively verified immutable identities; shallow `Object.isFrozen` alone is insufficient. Keep all fixed seeds, run counts, rejection cases, and full-state final checks.
7. **Do not merge semantically distinct suites to chase a count.** Codec round trips, strict malformed-input cases, bridge gesture/undo, adapter recall, worker authority, and runtime acknowledgment are independent seams. Share recording-connection setup carefully, but do not let a universal fake assume synchronous success and erase delayed/failure behaviors.

## Baseline evidence

Executed from the assigned worktree with the installed Node v22.16.0. The module loader bundles TypeScript with esbuild in memory (`write: false`), caches per process, and imports the result into Node. This is public-module Node evidence, not a browser/native build.

```sh
node --test --test-concurrency=1 --test-reporter=spec \
  kit/tests/test_stored_state_runtime_mirror.mjs \
  kit/tests/test_effect_state_contract.mjs \
  kit/tests/test_effect_snapshot_bank.mjs \
  tests/test_seqfx_runtime_bridge.mjs \
  tests/test_seqfx_worker_service.mjs \
  tests/test_modulation_bridge.mjs \
  tests/test_modulation_worker_service.mjs \
  tests/test_mseg_editor.mjs
```

Result: **120/120 passed**, 0 skipped/cancelled, **5.333 s** Node runner duration. This run preceded the coordinator's lifecycle repair.

```sh
node --test --test-concurrency=1 --test-reporter=spec \
  tests/test_seqfx_state_properties.mjs \
  tests/test_seqfx_block_properties.mjs \
  tests/test_seqfx_sparse_state.mjs \
  tests/test_seqfx_preset_adapter.mjs \
  tests/test_runtime_install_channel.mjs \
  tests/test_parameter_authority.mjs \
  tests/test_modulation_v6_state.mjs
```

Result: **56/56 passed**, 0 skipped/cancelled, **159.462 s** Node runner duration. Block properties took 47.994 s / 41.389 s / 14.395 s; normalization and canonical fixed-point properties took 26.341 s / 26.493 s. These five property cases account for approximately 156.6 s of the total. This is a full unchanged fixed-seed property run, not a reduced smoke selection.

Browser scalar/MSEG/SeqFX suites, generated DSP probes, native/QuickJS/host qualification, DAW undo and listening were inspected where stated but **not run** by this audit.
