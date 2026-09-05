# Enhance That — native state source repair

## Review checkpoint

September 5, 2026. L2 independently passed the corrected source, and Bob's
subsequent isolated gain A/B completed: **original baseline 31 predicted
failures; corrected wrapper 104/104 assertions passed** with identical generated
C++. See the [executed A/B result](ENHANCE_THAT_STATE_AB_RESULTS.md). The original
failed product VST3, host fixture, state blobs and results remain unchanged.
Product retry is not covered by this minimal regression; the native slot is
released and further native work requires separate routing.

- Owned Cmajor clone: `build/l1-cmajor-state-repair`, relative to L1's
  `/Users/winterfell/.codex/worktrees/1388/cosimo-synth` worktree.
- Branch: `codex/enhance-that-state-restore`; clean at
  `2fc4c2dce2a1b625c1578409e10bf312a5ac39b5`.
- Exact base: `7820a453f25e1b6eaf898d0bb2feb7e4ce01c207`.
- Initial regression-source commit: `c0bdc06be71063f7d256977d14dc3f009b5d968a`.
- Initial repair: `f229dd1a8d75fec9d3dbae4ae3c6b2f802741cf5`; superseded after
  L2's P2 review finding about callback reentrancy.
- Correction: `2fc4c2dce2a1b625c1578409e10bf312a5ac39b5`, adding the shared
  application boundary and real callback regressions. Correction scope is
  23 header lines, 70 regression lines and README policy clarification.
  The complete repair from base changes one production header: 53 insertions /
  9 deletions. Corrected source passed independent re-review and the isolated A/B.
- No shared CPM checkout, primary Cmajor checkout, dependency pin, compiler
  receipt, JUCE source, product DSP, identity, endpoint or migration code changed.

The clone uses independent Git objects (`--no-hardlinks`), with only its pinned
CHOC submodule materialized in another independent local clone. Neither clone
uses Git alternates. LLVM, Boost and the other compiler submodules were not
initialized. This source checkpoint is not an integration or release approval.

## Observable failure and source diagnosis

The frozen actual VST3 fixture at `9c201678` reported 813 assertions / 27
failures, entirely in state restore; pluginval strictness 8 reported seven
immediate state-readback failures. See [the native results](ENHANCE_THAT_L1.md).
Saved S and edited T are distinct 683-byte blobs. No expected parameter values
are sent during a restore.

| Operation | Observed hosted values after two seconds | Observed recaptured bytes |
| --- | --- | --- |
| Edit T, restore S | T | S |
| Edit T again, restore identical S | T | T |
| Destroy/recreate, edit T, restore S | T | S |

The source establishes two defective mechanisms matching these observations:

1. **The last request is mistaken for current state.** At the pinned Cmajor
   base, `include/cmajor/helpers/cmaj_JUCEPlugin.h:338` hashes the incoming bytes
   and skips a hash matching `lastLoadedStateHash`. That field is set only by
   state requests and never invalidated by parameter edits. The repeated S
   request therefore does not reach `setNewStateAsync` after editing T.
2. **The host reads before restoration, then never receives the restored
   values.** The same function posts every load as a message. Stock JUCE's
   `juce_audio_plugin_client_VST3.cpp:1194` reads the processor parameters in
   `setComponentState` immediately after the component state call, so its
   controller initially caches T. Later, Cmajor's renderer build applies S at
   `cmaj_Patch.h:1234`, before the renderer is published at line 2618 and before
   `Parameter::setPatchParam` attaches the JUCE listeners at
   `cmaj_JUCEPlugin.h:770`. `updateParameters` at line 926 rebinds them without
   emitting the values. `handlePatchChange` at line 484 reports metadata/dirty
   state; JUCE's `audioProcessorChanged` at line 1505 does not treat that as a
   parameter-value refresh. The hosted parameter reads JUCE's cache
   (`juce_VST3PluginFormatImpl.h:2012`), so it remains T.

The ordinary JUCE value notification path is
`audioProcessorParameterChanged -> paramChanged` at line 1472 of the pinned
VST3 client. It updates the controller value and notifies the host. During a
synchronous component state call, JUCE deliberately suppresses these callbacks
with `inSetState` (line 2903); its subsequent `setComponentState` read supplies
the restored values instead. Both timing and later publication therefore
matter: adding a notification alone would leave the immediate validator read
wrong; changing timing alone would leave background/deferred restores stale.

All line numbers in this diagnosis refer to the exact base pins, not the
repaired header. JUCE is stock `501c07674e1ad693085a7e7c398f205c2677f5da`.
Its bundled SDK's `pluginterfaces/vst/ivstcomponent.h:198` specifies the UI
thread for component `setState`; JUCE's controller also asserts that thread.

Two alternatives are less consistent with the evidence. A general failure to
parse/apply S predicts that first/fresh recaptured state would also remain T;
it does not. A mere short asynchronous delay predicts eventual hosted S; none
appeared in the two-second processing/message window. Neither observation
establishes audio restoration: `getUpdatedState` reads patch parameter values
(`cmaj_JUCEPlugin.h:536`), and their serialization is not an audio oracle.

The smaller real-wrapper A/B now experimentally confirms the original mechanisms
and the corrected parameter/state/listener/audio contract. No synthetic
reimplementation is offered as runtime proof; repaired product-host qualification
remains separate.

## Restore contract and narrow repair

Reapplying saved state after an edit must restore its parameters regardless of
whether the bytes match a previous request. For an ordinary outermost compiled
restore on the message thread, processor readback must be correct on return;
processed audio must then use those values. A deferred restore must publish its
completed values to listeners. A restore introduces no user touch gesture.

The single-header repair:

- Removes last-request hash suppression; parsing and the serialized format stay
  unchanged. Every request reaches the normal restore path.
- Calls the existing `setNewState` directly for a precompiled plugin on the
  message thread. It already uses synchronous `loadPatch(..., true)` internally;
  no compiler is introduced. Other threads and JIT plugins keep deferred loading.
- Publishes values after all current parameters have been rebound. It uses the
  existing `forceValueChanged` callback and does not write expected values back
  to parameters or fabricate begin/end gestures.
- Numbers state requests and ignores superseded queued requests for compiled
  plugins. This prevents the new synchronous path from being undone by an older
  queued restore. The ordering guard is a regression precaution, not a third
  failure claimed from the frozen product run. JIT message handling does not
  use the coalescing guard.
- Serializes application through the common `setNewState` boundary. A nested
  request from a notification updates a pending state and returns without
  recursively publishing a renderer. After the current transaction completes,
  the outermost call drains the latest pending state. Both direct and dequeued
  application use this boundary.

**Nested-call completion policy:** a call made inside a restore notification
does not promise immediate readback of its requested state within that callback.
It returns deferred. With a finite sequence of nested requests, the outermost
application completes with the latest nested state applied. Normal outermost
compiled message-thread calls retain immediate readback; no new event-loop wait
is introduced for them. Multiple nested requests coalesce to the latest one.

L2's source review found why the earlier queue sequence guard alone was
insufficient: `Patch::setNewRenderer` removes the old renderer, calls
`sendPatchChange`, then publishes its local S. The real synchronous
`AudioProcessorListener::audioProcessorChanged` callback can request newer T
during that gap. At `f229dd1a`, T recursively publishes, then outer S overwrites
it. The correction lets S finish before applying pending T. The pending state
is cleared before each application and the active flag uses a scoped guard,
so nested callbacks cannot start another renderer transaction on that stack.
The intermediate `f229dd1a` failure remains source-established reachability; it
was not compiled as a third variant. The corrected callback contract passed its
real runtime cases in the authorized A/B.

The shared callback repair and removal of deduplication also affect the generic
JIT wrapper. JIT compilation remains asynchronous; JIT qualification is not
covered by this compiled-gain witness. The coordinator must account for that
shared-header scope before advancing a global Cmajor pin. AU and other host
threading contracts also remain separate qualification surfaces.

## Minimal faithful witness

`build/l1-cmajor-state-repair/tests/juce_plugin_state/` contains a real generated
one-parameter stereo gain patch and a JUCE console regression. It exercises the
actual public `AudioProcessor` state API, actual parameter listeners and actual
rendered samples. Saved gain is 0.25, edited gain 0.75; constant stereo input
provides a sample-wise oracle independent of serialized state.

It checks same-instance, repeated identical S after another edit, fresh-instance,
two background restores separated by edits, and older-queued/newer-synchronous
ordering. It also attaches a real one-shot `AudioProcessorListener` that
requests T inside S's first change callback. Separate cases start S directly
and through the background/queued entry. They assert that nested publication
does not recurse, then check final T independently in parameter readback,
serialized state, value listeners and actual stereo samples. The synchronous
case also checks T at the outermost return, before pumping messages.
The other message-thread cases observe values, bytes, notifications and
audio before pumping messages, then again after a bounded message barrier.
The existing product fixture's assertions, state sequence, timing and source
hash locks remain unchanged. No DSP-observation change was made to that fixture.

The regression's README records the exact proposed A/B command shape and the
predicted baseline signature. It requires the same cmaj/JUCE/test source on
both sides and changes only the Cmajor include tree. No mock host-cache test is
substituted for the original VST3 host run. A passing gain test would establish
the wrapper/DSP mechanism for this fixture, not Enhance That audio acceptance.

Source checks passed before native allocation. The subsequent authorized run
configured, generated and compiled both variants, then observed exactly the
predicted 31 baseline failures and all 104 corrected assertions passing. Complete
generated C++ matched before corrected compilation. Commands, timing, hashes,
actual resource usage and process release are in the
[A/B result](ENHANCE_THAT_STATE_AB_RESULTS.md); the build plan below records the
constraints used to prepare that allocation.

## Build, dependency and disk implications

- Cmajor baseline is the exact pin above. Repair is owned commit `2fc4c2dc`.
  CHOC remains `11f7dc63d7cb78f6dbaa559fe09ade8e941c0188`; stock JUCE remains
  `501c07674e1ad693085a7e7c398f205c2677f5da`.
- The existing local `build/kit-tools/cmaj` has SHA-256
  `cd83280092e35ad7e3fa7c2824f52c171ee1ddc3ccad435caaa8a58debdd9c99`.
  An approved diagnostic A/B can use that unchanged compiler and explicit
  `--cmajorIncludePath`; generated `cmajor_plugin.cpp` includes the wrapper
  header externally. This header-only experiment does not mechanically require
  a compiler rebuild. It must truthfully record the old compiler and new SDK
  headers as separate inputs; do not relabel or restamp the compiler.
- Use fresh owned output roots, proposed `build/l1-state-baseline` and
  `build/l1-state-repaired`. Build only `cmaj_juce_plugin_state_test`; no generated
  VST3/AU/Standalone target or install is needed for this first A/B. The generator
  may create universal shared-code targets, so an arm64 console does not imply
  arm64-only compilation cost. Use four jobs and owned process-group watchdogs.
- A product retry must use a new owned output and the reviewed integration/build
  inputs. Keep the frozen VST3 and generated project intact. The exact product
  fixture pins the failed binary and payload in both its runner and C++ source;
  it will correctly refuse a new binary. A separately reviewed candidate-pin
  update is required before a product retry, preserving all existing assertions.
- Production `kit/cmake/CosimoDependencies.cmake` currently uses one Cmajor pin
  for SDK and tool builds; `kit/toolchain.json` names that fork commit too.
  Bob/L3 must resolve the framework commit and coherent tool/receipt/feed
  provenance before production qualification. No global pin or release tooling
  decision is made by this local diagnostic repair. Final migration still uses
  L3's reviewed identity-gated installer; no parser or migration bypass was added.
- Owned source plus CHOC occupies **101 MiB**. Proposed A/B builds are estimated
  at **0.4–0.8 GiB** total. The **smallest next gate requests a 1 GiB ceiling for
  the two serial gain-regression builds and runs only**: four build jobs,
  ten-minute owned watchdog per configure/build variant, 30 seconds per runtime,
  and 25 minutes overall. First build/run the exact original header as the
  negative control; preserve its expected failures before building/running the
  repair. Require identical generated `cmajor_plugin.cpp` bytes on both sides.
  No product target or compiler build is part of this request.
- A later isolated product rebuild adds approximately **0.2–0.4 GiB**, based on
  the frozen 204 MiB product tree. Reserve a conservative **2 GiB total allowance**
  if that later phase is authorized. No product retry is allocated. Actual
  allocation and cleanup remain serialized by Bob.
- Last measured free space was **45.77 GiB**; L3's **44 GiB reserve** leaves about
  1.77 GiB. The proposed 1 GiB A/B-only ceiling fits that snapshot; the combined
  2 GiB later-phase allowance does not. Recheck space and obtain Bob's resource
  allocation before any native step; do not reclaim another task's files.
  No native slot is currently held by L1.

## Preserved evidence and remaining gates

Preservation record:
`/Users/winterfell/.codex/visualizations/2026/09/05/01a07068-7376-7012-a350-a5999d5bd51c/l1/state-repair-source-02/preservation.json`.
It rechecks all 25 frozen evidence/fixture files against the prior preservation
record and verifies the VST3 binary,
canonical payload, compiler and original toolchain hashes against their prior
values. Shared Cmajor/JUCE source checkouts remain clean. The native fixture's
executable source is unchanged from `9c201678`; its README already records the
failed run in the prior documentation commit.

The adjacent `cmajor-state-repair.bundle` preserves all three owned Cmajor commits
outside the build tree. `git bundle verify` passed; importing it requires the
exact `7820a453` base. Bundle SHA-256:
`a91f8bb02a3fb1c98540921a77b01aa6487418ebaf1f380832288d1bc3df2d38`.
The adjacent `reentrancy-correction.patch` is the exact `f229dd1a..2fc4c2dc`
diff; SHA-256:
`eaf2183a740436aaeffe382330fd09b6afc8116b00f92a36b87b2f23e09e09f1`.
The original `state-repair-source-01` record and bundle remain unchanged;
the latter's SHA-256 was reverified as
`b489c4c7020129653cde679ed4950b98a321cc7d20642d718fb3f13d10bcaa56`.

Next: an independently reviewed product rebuild/fixture-pin checkpoint and the
original exact-host state/validator gate. Product audio, actual editor
notifications, DAW projects, AU, installation/migration, listening, clean macOS
15/26 and release acceptance remain unperformed. No user account, publication,
outreach, shared tracker, master or push action occurred.
