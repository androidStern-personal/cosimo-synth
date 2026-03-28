## Transient Worker Mip TDD Plan

This is a transient implementation checklist for landing the reviewed JS-worker mip-loading architecture in the current repo.

### Goal

Keep raw wavetable WAV files as shipped assets, move runtime truth to a patch-owned state machine, keep mip compilation in the JS worker, and remove the current UI-optimistic / worker-direct `wavetableSelect` loading path.

### Current Baseline

- `patch_gui/wavetable-worker.mjs` still listens directly to `wavetableSelect`, requests the current parameter value, loads the selected WAV immediately, prebuilds spectra for the whole table, and sends `wavetableLoadBegin` followed by `wavetableMipFrame`.
- `cmajor/FixedFrameOscillator.cmajor` still only knows about `wavetableLoadBegin`, `wavetableMipFrame`, `wavetableUploadAck`, and `wavetableMipRequest`.
- There is no patch-owned runtime state channel, no restart-safe service reconstruction, no same-table retry path, and no committed-load abort path.

### TDD Order

1. Add protocol tests before implementation.
2. Add patch-side runtime state primitives.
3. Add worker-side state reconstruction and scheduling.
4. Add DSP-side restart-safe rules and abort/idempotence.
5. Update UI bootstrap and late-attach behavior.
6. Update iPhone generator/runtime if the new endpoints require wrapper changes.
7. Audit every changed test with the `audit-test-integrity` checklist before declaring the task done.

### Protocol To Implement

#### Patch-owned runtime state

- Add a patch-visible `RuntimeSyncRequest` input event.
- Add a patch-visible `RetryDesiredTableRequest` input event.
- Add a patch-visible `RuntimeState` output event.
- `RuntimeState` must separate:
  - current DSP service truth
  - desired intent ordering
  - failure metadata

Required `RuntimeState` fields:

- `dspSessionId`
- `desiredIntentSerial`
- `desiredTableIndex`
- `generationFrontier`
- `serviceState`
  - `0 Empty`
  - `1 LoadingMuted`
  - `2 Active`
- `hasActive`
- `activeTableIndex`
- `activeGeneration`
- `hasLoading`
- `loadingTableIndex`
- `loadingGeneration`
- `hasFailure`
- `failedTableIndex`
- `failedGeneration`
- `failureScope`
  - `0 candidate`
  - `1 service`
- `failurePhase`
- `failureReasonCode`

#### Worker / DSP transport

- `LoadBegin`
- `MipFrame`
- `UploadAck`
- `MipRequest`
- `ServiceLoadAbort`
- `WorkerLoadFailure`

`MipRequest` must carry:

- `dspSessionId`
- `generation`
- `tableIndex`
- `mipIndex`
- `urgencyLevel`
  - `2 mute-recovery`
  - `1 audible-but-blocking`
  - `0 opportunistic`

`WorkerLoadFailure` must carry:

- `dspSessionId`
- `tableIndex`
- `generation`
  - `0` when failure happened before `LoadBegin`
- `candidateAttemptSerial`
  - required for pre-commit failures
- `failurePhase`
- `failureReasonCode`

### Implementation Tasks

#### Phase 1: Add failing tests for the protocol

- Add JS worker tests for:
  - worker bootstrap via `RuntimeSyncRequest`
  - worker ignoring raw parameter callbacks
  - reconstructing `hasLoading` service target on restart
  - reconstructing `hasActive` service target on restart
  - not auto-retrying unchanged `Failed`
  - same-table retry via `RetryDesiredTableRequest`
  - urgency promotion for an already queued mip job
  - in-flight-only `UploadAck` acceptance

- Add DSP/runtime tests for:
  - `RuntimeState` sync snapshot shape
  - accepted `LoadBegin` transitions to `LoadingMuted`
  - activation transitions to `Active`
  - duplicate `MipFrame` idempotence
  - `ServiceLoadAbort` clearing a dead committed load
  - stale `WorkerLoadFailure` ignored when `candidateAttemptSerial` is old

- Add integration-facing tests for:
  - UI attach requiring `RuntimeSyncRequest`
  - worker restart while `LoadingMuted`
  - worker restart while `Active` followed by later mip request

#### Phase 2: Add patch/runtime-state scaffolding

- Extend `cmajor/FixedFrameOscillator.cmajor` endpoint structs with:
  - runtime sync request / runtime state support
  - `ServiceLoadAbort`
  - `MipRequest.urgencyLevel`
- Add a patch-owned coordinator for `RuntimeState`.
- Add a patch-owned desired-table monitor that:
  - quantizes `wavetableSelect`
  - increments `desiredIntentSerial` only on actual table changes
  - feeds the coordinator instead of directly driving the worker

#### Phase 3: Rebuild worker logic around runtime state

- Stop listening to `wavetableSelect` directly.
- Start with `RuntimeSyncRequest -> RuntimeState`.
- Track:
  - `knownSessionId`
  - `latestRuntimeState`
  - `serviceTarget`
  - `candidateValidation`
  - `mipJobState`
- Reconstruct service responsibility from `RuntimeState` in this order:
  - `hasLoading`
  - `hasActive`
  - else `Empty` desired-table load
- Only allow unchanged desired auto-load when `serviceState == Empty`.
- Do not auto-retry unchanged `Failed`.
- Add explicit `RetryDesiredTableRequest` handling.
- Replace whole-table `buildSpectrumCacheForFrames` prepass with lazy per-frame spectrum build plus yielding batches.

#### Phase 4: Rebuild scheduler and failure paths

- Implement mip-job coalescing by `{ dspSessionId, generation, mipIndex }`.
- Store maximum observed urgency per mip job.
- Promote queued jobs when a repeated request raises urgency.
- Scheduler tiers:
  - tier 2: mute-recovery
  - tier 1: candidate validation and audible-but-blocking mip work
  - tier 0: opportunistic improvement
- Ensure `candidateValidation` cannot starve forever once the synth is already `Active`.
- Add `WorkerLoadFailure` emission for:
  - catalog lookup failure
  - WAV decode/read failure
  - frame contract failure
  - worker watchdog timeout
- Add `ServiceLoadAbort` emission for committed post-`LoadBegin` failures/timeouts.

#### Phase 5: DSP state-machine hardening

- Make `MipFrame` idempotent per:
  - `dspSessionId`
  - `generation`
  - `mipIndex`
  - `frameIndex`
- Re-ack duplicates without double-counting readiness.
- Accept `UploadAck` only when the worker currently has that frame `InFlight`.
- Emit `MipRequest` with urgency based on actual audio consequence:
  - no audio without it
  - audible but blocked/degraded
  - darker fallback already exists

#### Phase 6: UI and late-attach integration

- Update `patch_gui/index.js` so the editor:
  - issues `RuntimeSyncRequest` on attach
  - treats runtime state as unknown until snapshot arrives
  - shows audible truth from `RuntimeState`
  - stops pretending `wavetableSelect` means the audio has already switched
- Add same-table retry UI path that sends `RetryDesiredTableRequest` when appropriate.

#### Phase 7: iPhone/runtime integration

- Verify the iPhone wrapper still exposes the worker and new endpoints correctly.
- Only touch `scripts/generate_ios_auv3_plugin.sh` or related wrapper code if the new runtime-state endpoints or worker bootstrap need it.
- Keep the existing bundle-backed patch/resource loading path intact.

### Test Commands To Keep Running

- `node --test tests/test_wavetable_worker.mjs`
- `uv run pytest tests/test_runtime_wavetable_mip_probe.py -q`
- `uv run pytest tests/test_fixed_frame_probe.py -q`
- `node --test tests/test_wavetable_display.mjs tests/test_patch_view_layout.mjs`
- `uv run pytest tests/test_ios_auv3_build.py -q -k 'not ios_host_smoke'`

### Audit Checklist Before Calling It Done

- Every new test must fail against a clearly wrong implementation.
- No test may rely on the function under test to compute its own expected value.
- Cover at least one non-happy path per new behavior area.
- No async silent passes.
- Re-run the changed test files after every fix.
- Re-read every changed test file with the `audit-test-integrity` skill checklist before the final report.
