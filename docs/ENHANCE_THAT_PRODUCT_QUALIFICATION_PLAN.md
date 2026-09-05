# Enhance That — repaired-product qualification proposal

**Preparation only; no product, JIT or compiler build is allocated.** The
compiled gain A/B passed independent source and evidence review. The next
product proof must load a new, explicitly identified VST3. The old failed bundle
and all existing fixtures/results remain preserved. Bob owns native scheduling;
L3 has completed base VM installation and final paused-state confirmation is
pending. The post-install host headroom floor is now 8 GiB.

## Smallest diagnostic product build

Reuse the exact two files that produced the failed product, without editing or
regenerating them:

- `build/enhancer_lite_juce/cmajor_plugin.cpp`, SHA-256
  `da032729e12d3e18e2c7f4ed8d7c24f73019025450ca469de5970e0c3346bc9d`.
- `build/enhancer_lite_juce/CMakeLists.txt`, SHA-256
  `5df9b746de5694064664f27a69610f20dfd148fcb54b6f8ccaf902c276f824d1`.

An owned outer CMake project adds that frozen source directory with a **new
binary directory**, then replaces only the generated `EnhanceThat` target's two
external Cmajor include routes. The corrected routes point to L1's exact
`2fc4c2dce2a1b625c1578409e10bf312a5ac39b5` SDK and its unchanged CHOC. Generated
files, product definitions, metadata, DSP and embedded UI are not patched.
Stock JUCE remains `501c07674e1ad693085a7e7c398f205c2677f5da`.

This is a diagnostic build-graph override under Bob's explicit SDK qualification
scope. It does not modify `kit/`, shared CPM, JUCE, the normal dependency seam or
the customer pipeline. No compiler invocation is needed to regenerate C++.
The already-generated product source came from the old `7820a453` compiler,
whose unchanged executable hash is
`cd83280092e35ad7e3fa7c2824f52c171ee1ddc3ccad435caaa8a58debdd9c99`.
Record **old generated product / corrected SDK** as separate provenance inputs;
never relabel that compiler, rewrite its receipt, or claim a coherent new kit pin.

Prepared owned packet:
`/Users/winterfell/.codex/visualizations/2026/09/05/01a07068-7376-7012-a350-a5999d5bd51c/l1/product-qualification-plan-01`.
It contains exact command arrays and input hashes in `plan.json`, the outer
`cmake/CMakeLists.txt`, a read-only preflight, a compile-command routing audit,
and a candidate-pin proposal generator. The CMake project is unconfigured.
The two post-build helpers have not run; the candidate does not exist.

Proposed fresh output:
`build/l1-enhance-that-sdk-2fc4c2dc-01/native/plugin/EnhanceThat_artefacts/Release/VST3/EnhanceThat.vst3`.
Build only `EnhanceThat_VST3`, with four jobs. Do not build AU/Standalone or
install anything. The original `build/enhancer_lite_juce/_build` is never an
output path. Before compiling, `audit-configure.mjs` must verify the actual
generated-C++ command selects the corrected SDK, excludes the original SDK,
and resolves the exact expected new VST3 target. After building, its real `.o.d`
dependency file must name the corrected wrapper exclusively.

Apply the same local ad-hoc signing and strict/deep verification used by the
original production build, only to the new bundle. Then run the unchanged,
hash-pinned identity helper already built in this worktree; it loads the new
bundle and reports actual factory identity. The helper's SHA-256 is
`efb470183e653a065ea62dc08644556195c29a2e3850dd2be4e964d725ed1208`.
Require `Enhance That`, `dev.cosimo.enhancer-lite`, CID
`ABCDEF019182FAEB436F73694373454C`, and the new bundle's actual executable path.
The frozen generated metadata retains `CsEL`/`Cosi`, version 0.1.0, all eight
sound controls, the existing analyzer, and the original embedded presets/UI.
Read back universal architectures; no release/notarization claim follows.

## Candidate freeze, then original product gates

After build/sign/identity, release all processes and the native slot. Freeze the
new binary hash, canonical whole-payload hash, actual identity, generated-source
hashes, actual compiler dependencies and diagnostic provenance. Independently
review this concrete candidate before running the original product fixture.

The prepared `prepare-candidate-pins.mjs` checks the real identity report,
candidate path, input hashes and actual corrected-header dependency. It writes
`candidate-provenance.json` and a review-only `fixture-pin-only.patch` into the
new output. It does **not** edit tracked source. The patch changes exactly:

1. `main.cpp`'s `expectedBinaryHash` literal.
2. `run.mjs`'s `expectedBinary` literal.
3. `run.mjs`'s `expectedPayload` literal.

Only after review may that patch be applied and committed. It preserves every
`9c201678` assertion, control/value/range/default/step expectation, deadline,
state sequence, analyzer requirement, bypass rule, hash refusal and watchdog.
The product-source field remains `954207e4` because that generated product
source is unchanged; the adjacent provenance record must explicitly name the
corrected SDK and old generator. The old source is retained in Git, and the
old compiled host plus its original runner/evidence remain preserved.

Allocate a new serial runtime slot after this source checkpoint:

- Run actual pluginval on the exact signed candidate with the previous settings:
  strictness 8, GUI tests skipped, seed 954207, rates 44.1/48/96 kHz, blocks
  64/512/1024, 120-second internal timeout, verbose output and an owned ten-minute
  outer group watchdog. Require a normal zero exit and no reported failures.
- Compile the newly pinned **otherwise unchanged** host fixture in a new
  `build/l1-enhance-that-state-host-2fc4c2dc-01` tree. Run its normal hash-locked
  Node runner with fresh evidence and the existing 120-second outer deadline.
  Require zero failures and the complete 813-assertion sequence, including
  same-instance S, identical S after another edit, and fresh-instance S.
- Keep the hidden `analyzerEnabledIn` native parameter: ID 303068736, automatable,
  host-continuous, default 0, range 0–1. Only the actual wrapper bypass is allowed
  in addition to it and the eight sound controls. No endpoint may be removed to
  make the product inventory pass.

No native work continues after an unexpected build/identity/signature/validator
or state result. Preserve the evidence, release the processes/slot and diagnose
off-slot. Do not weaken an assertion or combine a source repair with a retry.

## Product audio restoration remains a separate observation

Neither pluginval's processing tests nor the original fixture's finite-output
test proves that the saved **product sound** returned. The gain A/B proves only
its own one-control DSP oracle at 44.1 kHz / 128 frames. The product audio gate
therefore needs a separately reviewed additive observation patch; it is not
implemented or silently included in the three-literal fixture patch above.

Proposed concrete observation, against the exact same product binary:

- Keep the original host, S/T vectors, all 813 assertions and restore calls.
  At 48 kHz / 128 frames, reset only the deterministic input sample counter,
  never the plugin or its parameters. Use the existing 437 Hz left / 613 Hz plus
  left-feed right stimulus. Process two seconds of input as a warmup, then retain
  4,096 stereo float frames. This is offline processing, without an audio device.
- Capture reference S and reference T after the fixture's existing parameter
  writes. Require a measurable reference separation (proposed peak difference
  greater than 1e-5); otherwise fail the oracle as insufficiently discriminating.
- After each original restore, capture the same stimulus with the same warmup,
  without resending expected parameters. Save samples and SHA-256, maximum/RMS
  error to both references, and the readback/state result separately. Proposed
  acceptance is finite samples and peak error to S at most 1e-6; retain error to
  T as an independent diagnostic. Review these bounds before execution.
- Add an explicitly separate replay of the frozen pre-repair `S.bin` (SHA-256
  `778baf9cef9de6788d30948ed0879b19d0f4c4b61594d6573ad8e4f21fb1e226`) into the
  repaired candidate after edits, checking values and audio against S. This is
  pre-repair state compatibility, not a pre-rename or disk-saved DAW-project test.
- An original-failed-bundle audio comparison would be a separately allocated
  negative-control run. It is useful but is not implied by the minimum new-product
  slot. Preserve the original failed artifact regardless.

The added capture work changes processing history, so its source must be
reviewed separately and its results kept distinct from the unchanged fixture
run. Capture-only failures cannot be turned green by adjusting values, resetting
the processor, changing stimulus after the fact, or dropping the old assertions.
This observation still does not establish listening, editor gestures, actual
host automation recording, offline DAW export or clean-platform acceptance.

## Shared JIT and global pin consequences

The header repair also removes deduplication and republishes rebound values for
JIT wrappers. Both `JITLoaderPlugin` and `SinglePatchJITPlugin` have
`isPrecompiled=false`; their compiler/load completion remains asynchronous.
The synchronous return guarantee and stale-queued coalescing guard belong to the
compiled path. Do not apply the gain test's immediate-read expectation to JIT.

Before a global header/pin advance, prepare actual-engine baseline/corrected JIT
witnesses for both wrapper types, not a generated-engine simulation:

| Surface | Required observable proof |
| --- | --- |
| Fixed-patch JIT | Initial compile, S/T/identical/fresh restore after real asynchronous completion; values, notifications, stored state and processed audio agree |
| Generic JIT loader | The existing 100 reusable host parameter slots remain valid through patch changes, differing endpoint counts and same-patch restores; metadata/value callbacks match actual active endpoints |
| Ordering/lifetime | Requests during compilation, callback-originated restore, failure/recovery, unload and destruction; no stale completion, use-after-free, invented gesture or hung worker |
| Real host | Actual generic CmajPlugin VST3 state/notification behavior against the qualified engine; baseline inherited failures classified separately |

No JIT runtime candidate has been prepared by this task. Acquiring/building a
matching real engine and wrapper requires its own source review, owned output,
resource estimate and slot. The normal `kit/tools/cmajplugin_build` and
`kit/tools/cmajor_runtime_build` request full Cmajor toolchain dependencies,
including LLVM/Boost. Their cost is outside the 1 GiB product proposal; do not
start them with an assumed small allowance or reuse another task's build tree.

The current production seam pins one Cmajor commit for both SDK and tool builds
in `kit/cmake/CosimoDependencies.cmake`. `scripts/release_builder_kit.mjs:809`
requires `kit/toolchain.json`'s `cmaj.forkCommit` to equal that commit. Its tool
producer builds both `cmaj` and `CmajPlugin.vst3`, packages versioned archives and
records their hashes in the staged manifest. Setup receipts then bind the exact
archive identity and installed payload (`toolchain.mjs:219`). A raw binary hash
or edited `forkCommit` cannot replace those archive/payload/provenance checks.

Before advancing that seam, Bob must integrate the reviewed Cmajor change with
the current framework queue and qualify the affected shared paths. L3/the tool
producer must then either build truthful artifacts from the integrated pin and
issue coherent versioned archives/receipts/feed manifests, or separately design
and review a product-neutral split between generator and SDK provenance. The
latter is an architectural proposal, not implemented here. Do not relabel the
old compiler or copy its receipt onto a new pin. Existing SeqFX release-tool
attestation also hard-pins `7820a453` and must be handled by its owner rather
than silently patched as part of this product experiment.

Final release still uses L3's reviewed parser, `previousProductName` handling,
identity-gated installer and clean macOS 15/26 acceptance. The diagnostic build
does not repair L1's older parser or bypass migration, packaging or feed policy.
No framework push, shared pin, tool receipt, archive or feed change is authorized
by this proposal.

## Minimum resources and review sequence

- Minimum product-only allocation proposed: **1 GiB additional disk** across the
  new product, separately built host and logs; expected retention approximately
  **0.3–0.6 GiB**, based on the frozen ~204 MiB product and ~80 MiB host trees.
  Existing failed product, gain A/B (~370 MiB), owned SDK and all evidence stay.
- First native window: at most **20 minutes**, four jobs, ten-minute combined
  configure/build limit plus bounded signing/identity/hash capture and cleanup.
  Release the slot for the candidate/hash/source review checkpoint.
- Second window: at most **20 minutes** for pluginval, new host build and the
  original state fixture, serially. Product audio observation gets its own
  reviewed source and explicit runtime allocation; it is not silently added.
- A new exact supervisor must be frozen and syntax-checked before either GO,
  using the A/B's exercised independent group cleanup and resource monitoring.
  Require L3's paused-state confirmation, a fresh check of at least **9 GiB free**
  to allocate 1 GiB above Bob's **8 GiB host floor**, and Bob's final GO. Proposed
  early stops are 768 MiB owned output and 8.25 GiB free, with the same cleanup
  margins used by the gain supervisor. Read-only preflight during preparation
  found about **26.05 GiB free**; that snapshot is not a reservation.
- Review now: diagnostic CMake/include routing, honest provenance, candidate-pin
  helper and staged proof plan. Then review actual artifact identity/hashes and
  the three-literal pin patch. Separately review audio observation, JIT source
  and any coherent global pin/tool/feed proposal. No native work starts merely
  because these source preparations exist.
