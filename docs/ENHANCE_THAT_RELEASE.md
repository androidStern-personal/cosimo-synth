# Enhance That release guide

The [launch handoff](../ENHANCE_THAT_LAUNCH_HANDOFF.md) defines the product and
customer promises. Bob manages the queue; L3 owns launch source composition,
compiler/product builds, installation and customer validation. L1 owns the
remaining focused state/JIT regression work. Use normal commands with bounded
execution. Historical one-off supervisors, frozen packets and review machinery
remain inactive evidence, not prerequisites for the next build.

## Product and dependency identity

Keep the name **Enhance That**, bundle `EnhanceThat.vst3`, patch/bundle ID
`dev.cosimo.enhancer-lite`, codes `CsEL` / `Cosi`, and processor CID
`ABCDEF019182FAEB436F73694373454C`. The rename preserves saved sounds and stable
parameter IDs. `previousProductName: CosimoEnhancerLite` enables recovery from
the old filename; do not invent a new plugin identity to bypass an old copy.

The eight sound controls remain Frequency, Q, Routing, Amount / Mid, Side,
Character, Intensity and Shape. Keep their automation/gesture repairs: a changed
button or key step sends one begin/value/end; a pointer touch ends on release,
cancel, capture loss or editor removal. Modifier-Q and arrow edits during a
pointer touch reuse that touch. Host notifications update the display without
sending values or gestures back. The native analyzer parameter is separate
from the eight saved sound controls and must not be removed to pass inventory.

The state repair is Cmajor `2fc4c2dce2a1b625c1578409e10bf312a5ac39b5`, with
CHOC `11f7dc63d7cb78f6dbaa559fe09ade8e941c0188` and stock JUCE
`501c07674e1ad693085a7e7c398f205c2677f5da`. Keep actual SDK/compiler identities
consistent with the selected build. Do not relabel old tools or substitute a
diagnostic checkout with a different origin. Separate generic JIT behavior
must be tested before a shared toolchain release; the compiled-product result
does not settle that behavior. SeqFX's independent expectations are unchanged.

## Build, package and sign

From the selected source checkout, normal product commands are:

```sh
FX_DISTRIBUTABLE_RUNTIME=1 npm run fx:prod:build -- enhancer-lite --clean
node scripts/build_enhance_that_release.mjs --plan
```

`FX_DISTRIBUTABLE_RUNTIME=1` omits distributable UI source maps while preserving
normal development builds. The normal production helper accepts its own pinned
source-built compiler or verified setup download; it is not an arbitrary
compiler-path override. Select the macOS-15-capable tool/source through that
supported build workflow. L3's current compiler checkout and artifacts are
separate from this documentation cleanup.

After the selected AU passes its host/customer qualification, use
`--include-au` with the existing packager. This selects the generated
`EnhanceThat_AU` target alongside VST3 and puts `EnhanceThat.component` in
`/Library/Audio/Plug-Ins/Components`. It does not establish qualification:

```sh
node scripts/build_enhance_that_release.mjs --plan --include-au
COSIMO_CMAKE_JOBS=4 node scripts/build_enhance_that_release.mjs \
  --unsigned --include-au --use-existing-build
```

For an explicitly VST3-only release, set `au_decision` to the agreed reason:

```sh
COSIMO_CMAKE_JOBS=4 node scripts/build_enhance_that_release.mjs \
  --unsigned --verify-repeatable-packaging --au-deferred "$au_decision"
COSIMO_CMAKE_JOBS=4 COSIMO_NOTARY_PROFILE="$notary_profile" \
  node scripts/build_enhance_that_release.mjs --release --au-deferred "$au_decision"
```

Set `notary_profile` to the existing authorized profile; keep credentials out
of source/logs. The packager requires a clean source checkout and tracked
notices, performs a fresh product build, and uses an absent versioned
`release/enhance-that/<kit-version>/{unsigned,release}` destination. It signs
with Developer ID, notarizes/staples and checks the extracted payload. It never
installs or publishes. Do not rerun it merely to validate an already-built
candidate. Repeatable unsigned assembly is not a claim of reproducible signed
bytes or independent native builds. AU needs its explicit include/defer decision;
`--include-au` and `--au-deferred` cannot be combined. The release manifest keeps
VST3 evidence in its existing fields and adds AU build, signing and extracted
payload evidence in `audioUnit` when included. Qualification remains separate.

Use `--use-existing-build` when packaging the current checkout's already
qualified product build. The owner must establish that product inputs still
match that build, including after source composition. This skips only rebuilding;
dependency provenance, generated-DSP/link checks, bundle validation and extracted
payload verification still run. It does not accept an external bundle path.

Preserve the existing canonical kit export/setup/release machinery. A normal
`kit:release` publishes; even its dry-run can perform substantial builds.
Use a new release version, never overwrite published `0.1.2`, and compute final
checksums after signing/stapling. Record the source/version, downloads, actual
signature/notary outcome and remaining customer limitations in the normal
release output; no additional manifest validator is required.

Check the final plugin and extracted download for matching identities,
architectures, signatures and assets, absent UI source maps, and generated
static DSP without Cmajor JIT/LLVM engine linkage. The separate development
compiler and generic loader are outside the finished plugin's no-JIT claim.
Retain [the product notices](../legal/enhance-that/THIRD_PARTY_NOTICES.txt),
[notice sources](../legal/enhance-that/NOTICE_SOURCES.json), and the kit's
[customer notices](../kit/template/root/THIRD_PARTY_NOTICES.md). Reconcile them
with actual shipped dependencies; keep the reviewed HarfBuzz/Unicode and
embedded codec notices, commercial modification/sale rights and JUCE disclosure.

## Focused native checks and original state bug

Build/run the [VST3 probe](../tools/enhance_that_native_probe/README.md) directly
against the selected bundle. It records the observed hash and checks unchanged
binary bytes afterward; no per-build source literal or Node supervisor is needed.
For broader headless validation, set absolute `selected_vst3` and a fresh
`validation_results` directory, then run pluginval with ordinary bounded command
execution (ten minutes overall):

```sh
mkdir "$validation_results"
/Applications/pluginval.app/Contents/MacOS/pluginval \
  --strictness-level 8 --skip-gui-tests --random-seed 954207 \
  --sample-rates 44100,48000,96000 --block-sizes 64,512,1024 \
  --timeout-ms 120000 --verbose --output-dir "$validation_results" \
  --output-filename enhance-that-vst3.txt --validate "$selected_vst3"
```

Keep failures and diagnose them; do not lower strictness or write expected
values into the plugin to repair a restore. The original product probe had
813 assertions/27 state failures; pluginval reported seven immediate readback
failures. After editing T and restoring S, hosted values stayed T while the
first/fresh instance serialized S. Restoring identical S again left both at T.

Two wrapper defects explained this: `lastLoadedStateHash` suppressed repeated
S even after edits, and asynchronous restore let JUCE cache T before S was
applied; rebound parameters then did not publish restored values. The repair
removes request-hash suppression, restores compiled message-thread calls
synchronously and republishes rebound values. Superseded compiled requests
cannot undo newer state; callback-originated requests are applied after the
current transaction, with the outermost call completing at the latest state.
No user gesture is invented. JIT compilation remains asynchronous.

The real one-control wrapper/audio A/B produced the predicted 31 baseline
failures and 104/104 repaired assertions with identical generated DSP. Keep
[the A/B results and original evidence](ENHANCE_THAT_STATE_AB_RESULTS.md).
That result is not final Enhance That host, generic JIT or listening acceptance.

## Installation and recovery

Enumerate user and system plugin scan roots before replacement. The generic
installer checks bundle ID and processor CID, keeps a recoverable old bundle
outside scan roots, rejects different identities/ambiguous duplicates, and
reports retained paths on failure. Preserve signed release bytes; do not
ad-hoc re-sign a finished Developer ID plugin.

The package preinstall checks all included formats before creating recovery
copies. It refuses legacy/user-level copies and reports their paths
without deleting them or loading their executables as root. A matching system
update retains its prior bundle and `RECOVERY.txt` outside the scan root, with
separate `.EnhanceThat.vst3.previous.*` and `.EnhanceThat.component.previous.*`
directories when both formats are included. AU identity comes from the sealed
`AudioComponents` type/subtype/manufacturer, not VST3 metadata.
Package failure uses that manual recovery; do not promise automatic rollback.
Keep real first-install, same-path/renamed update, interrupted update and recovery
checks, plus customer preset-bank ownership and safe dirty-work preservation.

## macOS floor and VM gotchas

Apple Silicon macOS 15 and 26 remain required for retained formats. Inspect
actual Mach-O minimum OS in every distributed executable/tool: a cmaj built
with an implicit macOS 26 minimum cannot be a macOS 15 customer download, even
when plugin slices have lower minima. L3 owns the explicit-floor compiler work;
a declared deployment target still needs actual binary and guest validation.

The existing clean-customer VM reached macOS **15.6.1 / 24G90**, with a neutral
local account and no maintainer Apple/GitHub login or shared source/cache. Its
historical setup ended paused; inspect current state before resuming. The VM is
`~/Library/Application Support/VirtualBuddy/Enhance That macOS 15 Clean Customer.vbvm`.
The retained `UniversalMac_15.6.1_24G90_Restore.ipsw` is 16,814,137,790 bytes, SHA-256
`3d87686b691ac765eb6a6b3082b2334e2af9710096a00432dd519af89ff2ea78`.
Original guest screenshots and setup reports remain with L3.

- The macOS license for this VM was already accepted with Andrew's approval;
  do not ask again for that same agreement. Account sign-in was not authorized.
- VirtualBuddy 2.1's `vctool` inspects IPSWs but does not create/install a VM.
  Use the existing guest, not another restore. Raw boot disks grow physically;
  logical capacity is not free-space reservation. Recheck real disk headroom.
- Pause does not release all VM memory. Do not kill the app or touch another
  guest to enforce an elapsed-time limit. Stopping/pausing a macOS installation
  is not proven safe or resumable; preserve failed installation evidence.
- CUA modifier input did not reliably preserve uppercase/underscore in this
  guest; verify typed text and use tab completion where appropriate.
- Setup selected Only Download Automatically. Account for future downloads
  before long runs. Do not copy private credentials, source or dependency trees
  into the guest. A host-loopback delivery URL is not a guest delivery path.
- macOS temporary-path aliases (`/var` versus `/private/var`) can change exact
  Git-origin assertions; use canonical paths. UUID-containing temporary paths
  can make npm redact `config get cache`; use an owned UUID-free temp path.

## Uncompleted customer checks

Use the actual downloads on macOS 15 and 26. VST3 is required; use a suitable free
host for AU if practical or record AU deferral. Logic access is not a blocker.
REAPER's evaluation is a no-purchase option; record the actual host/version.
Preserve existing tracks, clips, plugin copies and unsaved sessions. Use an owned
saved project for close/reload, not the user's unsaved set.

| Control / endpoint | State A | State B |
| --- | --- | --- |
| Frequency / `freqHzIn` | 220 Hz | 1800 Hz |
| Q / `qIn` | 0.71 | 2.5 |
| Routing / `modeIn` | Stereo | Mid/Side |
| Amount / Mid / `midAmountIn` | 0.20 | 0.65 |
| Side / `sideAmountIn` | 0.10 | 0.55 |
| Character / `curveIn` | Solid | Tube |
| Intensity / `saturationModeIn` | Subtle | Medium |
| Shape / `shapeIn` | Bell | Low; also exercise High |

Record actual editor gestures into automation and play them back, including
pointer/modifier-Q/arrow interactions and cancellation. Confirm host values,
editor display and audio; programmatically inserted envelope points alone do
not prove editor gesture recording. Save preset A, change to B and recall A;
save B/automation to disk, close/reopen that exact project and check every value.
Check editor reopen and an available preserved pre-rename project separately.
Exercise Space, keyup/focus loss, genuine text/numeric entry and active drags in
the actual host; DOM key synthesis is not that result.

Use identified stereo audio with distinct left/right content for Side processing.
Keep dry, A, B and post-reload playback/offline exports over the same interval,
with sample rate/frame counts and normalization/dither settings recorded. Check
finite output, unexpected silence and aligned pre/post-reload differences;
do not assume different render modes are bit-identical. Andrew's listening
acceptance names the actual audio/settings heard; spectra are not listening.
Also finish clean customer setup/build/install, successful and failed kit updates,
recovery, exact download delivery and retained-format/platform qualification.
Public launch, payments and sends keep their explicit approval checkpoints.
