# Real native/browser seams for plugin-state qualification

Read-only source investigation and lifecycle review, 2026-09-10. No Cmajor checkout, cache, generated runtime, build directory, installed plugin, or browser server was changed. The only new artifact is this report.

## Third lifecycle test and fix: independent review

Reviewed `kit/tests/test_stored_state_runtime_mirror_lifecycle.mjs` and the lifetime/reset additions to `kit/ui/stored-state-runtime-mirror.ts`. Ran both lifecycle and existing mirror files: **20/20 pass**. The coordinator supplied red-before-fix evidence; this reviewer independently checked the final green state.

The third test's deferred `sendRuntimeEvents` is an intentional production seam. Its two assertions distinguish (1) new work stranded behind old delivery and (2) old success contaminating the new incremental baseline. The delta renderer makes the latter consequence observable, rather than inspecting private state. It is not a native transport test.

Also ran three disposable public-seam probes without adding tests or editing production code: old delivery success, false result, and rejected promise each completed while the new delivery was still pending. After each old result, a new stored update did not start a concurrent third delivery; the new pending delivery remained owned correctly; no old failure notification fired. Resolving the current delivery then produced the correct delta from the new baseline. All three probes passed. This directly covers the risk that moving `deliveryInProgress = false` outside the lifetime check would release current work.

**Verdict: no outstanding blocker to the scoped mirror repair.** For durable regression coverage, the existing third test could additionally complete the old result while the new result remains pending and assert that later edits coalesce behind the new result; a small parameterized old-failure case would protect the symmetric catch branch. These are strengthening opportunities, not evidence of a remaining current-code fault.

The fix guarantees fresh mirror bookkeeping, new delivery progress, and rejection of old callback/completion effects. It does **not** cancel `sendRuntimeEvents` already invoked. New and old adapter work can overlap after restart. The old `Promise<boolean>` interface has no cancellation permit or engine-session address, so an old adapter that waits and then sends can still write later, even though the mirror ignores its completion. Neither the test nor a passing native build proves no old DSP write. Preserve the narrow claim; the new engine-binding design must put currentness at the actual transport send. No broader legacy-mirror rewrite is needed to accept this repair.

## Exact source provenance must be resolved before native implementation

- Cosimo branch at review: `codex/plugin-state-system`; existing dirty user and coordinator work preserved.
- Canonical Cmajor checkout `/Users/winterfell/src/cmajor` is clean on `feed-relative-choc`, HEAD `04ee24df55c4a3ba9f67d498a70c19de1aa1ad79`.
- `kit/cmake/CosimoDependencies.cmake:20` and `kit/toolchain.json` currently name `2fc4c2dce2a1b625c1578409e10bf312a5ac39b5`. That object initially did not resolve. The coordinator then fetched it without changing the checkout; this reviewer verified the exact commit resolves and that `cmaj_Patch.h`, `cmaj_PatchWorker_QuickJS.h`, and `cmaj-audio-worklet-helper.js` have no diff between it and canonical HEAD. Create the later implementation worktree from this verified pin, not canonical HEAD. This reviewer performed no fetch.
- The Cmajor source-line references below were read at canonical HEAD and their three source files were subsequently verified identical at the exact configured pin. Re-check them on the actual implementation worktree before editing. The existing cached runtime contains a similar API, but cache contents are never an edit target.

The tracked dependency route is the Cmajor fork, not a local post-copy monkey patch. Implement framework changes in an isolated Cmajor worktree; review/commit them there; then have the integration coordinator update the source pin consistently in `kit/cmake/CosimoDependencies.cmake` and `kit/toolchain.json` as appropriate. `kit/cmake/dependency-sources.cmake` owns repository URLs only; exported kits substitute their feed mirror. Do not add personal paths or a local-worktree override to shipped kit files.

Native headers and browser JavaScript share the Cmajor pin. `kit/tools/cmajor_web_runtime/CMakeLists.txt` copies `${COSIMO_CMAJOR_SOURCE_DIR}/javascript/cmaj_api`; `kit/fx/vite.shared.mjs::stageCmajorWebRuntime` invokes this with independent staging directories. Editing generated `build/**/cmaj_api` would create browser-only evidence disconnected from the shipped source.

## Native: public fixture that reaches the production channel

The existing `tests/native_quickjs/PatchWorkerLifetimeProbe.cpp` constructs private `Patch::PatchWorker` using `#define private public`. Keep its narrow regression evidence, but do not extend that approach for the new channel. There is already a sufficient public composition seam:

| Production API at canonical HEAD | What the new fixture can prove |
| --- | --- |
| `cmaj::Patch`, `createEngine`, `setPlaybackParams`, `loadPatch(..., true)` (`cmaj_Patch.h:41–121,2023`) | Load a real tiny Cmajor patch, create a real renderer and its real patch worker. Set runtime/library provenance explicitly; fail if loading or playable status fails. |
| `Patch::WorkerContext` and `createContextForPatchWorker` (`cmaj_Patch.h:306–318`) | Supply a recording/gated context through the actual host injection seam. Its `initialise` receives the real worker-origin send callback; its `sendMessage` receives production native routing. The test never obtains or constructs private `PatchWorker`. |
| Public `PatchView` constructor, `setActive`, destructor, `sendMessage` override (`cmaj_Patch.h:410–429`) | Create two real ordinary GUI views, observe messages addressed to each, deactivate/destroy them to drive actual native view lifetime. Do not label a manually invoked service `detach` as native detach proof. |
| `Patch::handleClientMessage(view, envelope)` (`cmaj_Patch.h:271,2779`) | Send client-origin commands with actual source-view identity. Send worker-origin messages using only the callback supplied to the context. A GUI-forged service flag follows GUI identity and must reject. |
| `getFullStoredState`, `setFullStoredState`, `findParameter`, `getParameterList` (`cmaj_Patch.h:164,209–215`) | Read actual native parameter/stored values and invoke the exact complete-state restore seam. No fake state map and no direct synthetic `documentReplaced` event. |
| `sendGestureStart/End`, public `PatchParameter` callbacks | Observe real host-facing gesture begin/end and parameter changes through the callbacks production wrappers attach. This proves Patch-level gesture behavior, not a particular DAW's automation mode. |
| `process`, `handleOutputEvent`, `startEndpointData` | Process finite audio blocks through the real engine and collect a real test DSP endpoint or matched acknowledgement. Do not equate “send call returned” with audio-thread application. |

Use the existing `tests/native/CMakeLists.txt::cosimo_configure_cmajor_probe` dependency/platform setup; a new finite `PluginStateChannelProbe` target can reuse it without adding another toolchain seam. `WorkerErrorSurvivalProbe.cpp` already demonstrates public `Library::initialise`, `Engine::create`, `enableQuickJSPatchWorker`, playback locking, bounded message-loop barriers, and actual rendered-signal assertions. That is a better composition template than the private lifetime probe.

Two native passes earn different evidence:

1. **Production Patch routing with controlled WorkerContext.** Load a real manifest whose worker is created by Patch. Let the injected context retain `initialise` callbacks and record serialized messages. This is a real native channel test: the native parser, sender identity, sequence/epoch check, persistence, queued routing, view lifetime, and restore interception are all production code. The controlled context replaces service behavior through a documented injection seam; it does not prove QuickJS or TypeScript service behavior.
2. **Production Patch + actual QuickJS worker bundle.** Replace that injected context with `enableQuickJSPatchWorker(patch)` and load the emitted plugin-state service bundle. Ordinary views still use real `PatchView`/`handleClientMessage`. Assert acceptance/lock/history/restore outcomes through real replies, `getFullStoredState`, and DSP output. This closes the native C++/JSON/QuickJS/runtime-services composition gap. A Node or bare QuickJS script running the model alone cannot replace it.

The tiny patch needs one parameter with non-default metadata, one complex-state event, and a test output that reports or deterministically reflects the processed payload. Two scalars plus curve can reuse the matrix fixture. Keep its DSP simple enough that a wrong routed value gives an unambiguous wrong output; do not build a fake renderer or a whole new demo product.

### Deterministic native sequences through public APIs

- **Attach/source identity:** create ordinary views A/B and the real worker; send attach for each; verify distinct client IDs and one coherent snapshot. Attempt worker-only publication/reset from A and verify rejection plus unchanged `getFullStoredState`. Send it through the actual worker-context callback and verify the permitted path.
- **Sequence recovery:** valid command → busy/invalid rejection → next valid command; duplicate command; old-owner/document command around restore → new-scope sequence 1. Assert actual replies and state, not internal counters.
- **Routed-prefix detach:** enqueue A's edit through `handleClientMessage`, then destroy/deactivate A before service response. The controlled context releases processing afterward; accepted prefix must remain routable and ordered before detach. Reattach C and ask the real service for accepted value/history in the QuickJS pass.
- **Old FIFO payload across restore:** inside one message-loop callback, set a real parameter to old value, then call actual `setFullStoredState` with replacement before returning to the loop. This creates an old FIFO payload whose dispatch cannot run until the callback yields. Pump the ordinary message loop; verify the new owner observation reports current parameter truth under the new epoch. Do not call private `ClientEventQueue::dispatchParameterChange`; a lower-level owner-event simulation misses the bug. Confirm the public parameter setter used actually posts FIFO observations on the pinned source.
- **Late publication/send:** hold worker response until after actual restore, then send its old-epoch publication through the real worker callback. Read native state and process blocks to show it did not mutate either native state or the guarded DSP endpoint.
- **Owner lifetime:** close all ordinary views, perform/finish accepted owner work, reopen a view and inspect state/history; unload/reload the Patch and verify a distinct owner plus cleared history. A raw view count or destructor count alone does not prove retained accepted work.
- **Shutdown/reentrancy:** reply from a recorded view/context through its valid public callback while another message is being observed; require bounded completion and coherent state. Use normal `Patch::unload` and object destruction while callbacks are pending; no private pointer access. Safety deadlines fail the test instead of retrying it to green.

Drive mutations in the message-loop context used by Patch. Use explicit event/barrier completion and a finite process-block loop, with a timeout only as deadlock/failure detection. Do not move production operations onto arbitrary test threads merely to manufacture interleavings. Maintain the existing playback mutex discipline if blocks run concurrently with load/unload.

## Browser: the actual seam differs from native

At canonical HEAD, `AudioWorkletPatchConnection.initialise` constructs and waits for an actual `AudioWorkletNode`, routes port messages, and invokes `startPatchWorker` (`cmaj-audio-worklet-helper.js:538–637`). `startPatchWorker` imports the manifest worker and calls `module.default(this)` in the current realm, discarding its return (`:756–763`). It does not create a Web Worker. The native glue instead instantiates a separate QuickJS connection and invokes the worker module (`cmaj_PatchWorker_QuickJS.h:140–209`). The test setup must retain these real differences.

The browser currently holds complex `cachedState` on the main connection, while the audio worklet owns scalar state. `sendFullStoredState` updates complex values synchronously and posts parameters afterward; `requestFullStoredState` requests worklet parameters then merges current cached complex values into the reply (`cmaj-audio-worklet-helper.js:676–728`). That is not an atomic complete-state fence. The proposed adapter must explicitly serialize restore/publication/snapshot across this split; a test where all values live in one JS map cannot reveal the mismatch.

Minimum browser fixture:

1. Build the tiny patch runtime and generated state worker/view with the production build path. Serve its manifest, DSP module, worker, view, and staged Cmajor API from a loopback test server using isolated staging/output paths. Follow existing browser harness conventions; do not replace another task's 5175 server.
2. Instantiate the actual `AudioWorkletPatchConnection` and generated `CmajorClass` in Chromium, with explicit audio-context activation. Attach two real clients through the new browser channel identity mechanism. Capture unhandled errors and reject a silent preview fallback.
3. Render the real knob/curve binding and perform a pointer gesture, busy competing edit, unrelated edit, shared Undo, host-equivalent scalar observation, close/reopen, and complete-state restore. Require real receipts and rendered values. A second generic client proves client policy; actual MCP transport still needs its own integration route before claiming MCP qualification.
4. Deliberately overlap worklet scalar request/response with a complex restore to prove the snapshot fence. Observe epoch and both values from the production client snapshot. Verify old pending publications cannot cross that fence.
5. Close the browser patch through the production lifecycle entry point and prove its retained worker-service host stops, pending work settles, and a new patch gets a fresh owner. `AudioContext.close` alone cannot prove the main-realm service was disposed.
6. Process/render audio or observe a real DSP output/ack for an application claim. A DOM value, recording event list, or successful port post is only the corresponding lower-level evidence.

The current build only bundles `workerSource` when plugin config provides it (`kit/fx/build-effect.mjs:1115–1130`), and the manifest rewrite points to `workerOut` (`:1053`). Automatic `state.ts` discovery and composed service-host ownership are therefore testable build changes, not existing behavior to assume. Build-provenance checks should load/run the emitted entry; source substring assertions alone cannot establish its lifecycle or service composition.

## Bounded gate and limits

First qualify one end-to-end vertical slice: real native attach → scalar + complex edit → host full-state restore with old queued observation → GUI close/reopen, then run the same domain sequence through the built browser path. Add concurrency/history cases after this platform seam is known to work. Do not finish a large fake-only test suite before trying the native channel that motivates the architecture.

This investigation ran only the 20 focused mirror tests and three public-seam delivery probes. None of the proposed new native/browser channel tests exists or has passed yet. A controlled native WorkerContext pass, actual QuickJS composition pass, browser audio-worklet pass, installed DAW interaction, DAW project save/reload, and listening are separate evidence. No local Cmajor worktree or native/browser build was created.
