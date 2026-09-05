# Enhance That — isolated Cmajor state A/B result

**PASS for the real one-control wrapper/state/audio regression.** On September
5, 2026, the original Cmajor wrapper produced exactly the predicted 31 failures;
the corrected wrapper passed all 104 assertions. The generated processor C++
was identical. This does not qualify a repaired Enhance That product binary:
the original failed VST3 remains preserved and unchanged.

## Exact tested inputs and execution

- Baseline Cmajor headers: `7820a453f25e1b6eaf898d0bb2feb7e4ce01c207`.
- Corrected Cmajor headers and identical real regression source:
  `2fc4c2dce2a1b625c1578409e10bf312a5ac39b5`.
- Both CHOC checkouts: `11f7dc63d7cb78f6dbaa559fe09ade8e941c0188`.
- Stock JUCE: `501c07674e1ad693085a7e7c398f205c2677f5da`.
- Unchanged existing cmaj SHA-256:
  `cd83280092e35ad7e3fa7c2824f52c171ee1ddc3ccad435caaa8a58debdd9c99`.
- L1 root was clean at `f16bd2c3e0810a93df01f218c1aa4482cb090cd0`
  throughout execution. Subsequent changes only record this result.
- Both console executables are Mach-O arm64. The local machine reported
  macOS `26.6.2`, arm64. This is one existing development machine, not clean
  macOS 15/26 customer qualification.

Bob explicitly allocated this single A/B after L2's independent source PASS.
The exact frozen Node 22 supervisor ran once, from 10:36:36 to 10:38:22 UTC,
in **106.29 seconds**. Baseline configure/build/runtime completed before the
corrected variant. Four jobs were used; no expectation, code or classifier was
changed during execution. No third variant or retry ran.

The complete generated `cmajor_plugin.cpp` was identical in both build trees:
SHA-256 `e08c1d7a204d715aca9b0f7b00e8ee6f3087b7be7c2abfce022f08b1a4ad1c0f`.
Equality was checked before corrected compilation. Thus the test held the
generated gain DSP and embedded resources fixed while changing wrapper headers.

| Variant | Configure | Build | Runtime | Assertions | Exit |
| --- | --- | --- | --- | --- | --- |
| Original `7820a453` | 8.44 s | 44.11 s | 0.48 s | 73 pass / 31 expected failures | 1 |
| Corrected `2fc4c2dc` | 8.03 s | 44.38 s | 0.50 s | 104 pass / 0 failures | 0 |

The baseline's 31 FAIL lines exactly matched the frozen classifier. Both builds
produced the same harmless ranlib warnings for empty JUCE ARA/LV2 object files.
There was no build error, crash, signal, timeout, resource stop or residual
process-group cleanup.

## What the real runtime established

The actual generated gain processor, JUCE wrapper, parameter listeners and
stereo samples reproduce the original state mechanisms and pass after repair:

- Same-instance and fresh-instance restoration expose S immediately at the
  outermost compiled message-thread return, then remain correct after dispatch.
- Editing T and reapplying identical S restores S again, including the two
  background/deferred cases. No compensating parameter write is sent.
- Parameter readback, serialized state, actual restored-value callbacks and
  stereo DSP samples agree independently. Restores introduce no touch gesture.
- An older queued request cannot undo a newer synchronous state.
- A real one-shot `AudioProcessorListener` requests newer T from S's first
  renderer-change callback. Both synchronous and queued outer S complete with
  T in readback, serialization, value listeners and audio. Nested publication
  does not recurse; the synchronous case also exposes T at the outer return.

The intermediate `f229dd1a` callback defect was statically traced and repaired;
that intermediate header was not compiled as a third variant. The corrected
callback contract has actual positive runtime proof here. The external VST3
controller/host cache is not part of this direct-wrapper test, and these samples
are the minimal gain fixture, not Enhance That product audio or listening proof.

## Evidence, preservation and resource release

Full retained output:
`/Users/winterfell/.codex/worktrees/1388/cosimo-synth/build/l1-state-gain-ab-2fc4c2dc-01`.
Both complete build trees, generated C++, executables, phase command/PID/log/result
files, classifications, comparison, plan/preflight and release record remain.
No automatic cleanup or reuse is authorized by this result.

Durable evidence copy:
`/Users/winterfell/.codex/visualizations/2026/09/05/01a07068-7376-7012-a350-a5999d5bd51c/l1/state-ab-results-01`.
Its 26 copied files were compared by SHA-256 with their originals, including all
phase logs/results and the common generated C++. The index references the
retained executable/build paths.

- Evidence index SHA-256:
  `311dae7cbdeb5e93f08dda4d2f8638aa1bacf22f6936fb3e4f2f460434091af8`.
- Supervisor result SHA-256:
  `36d0ed145d25f5a1ef0a3e60851b3f0620451e248db12110942ed070b3cff32f`.
- Release record SHA-256:
  `7f987e59b1fa5b921c0ead98b4e859fce75c6b218c41994c573bdb96a7282983`.
- Baseline executable SHA-256:
  `452b30456ece95debf31d820c54c1d6c98c5be5bff869b0f95e6efdcbb70277d`.
- Corrected executable SHA-256:
  `371a97fa48d19fa92269d29cad11fc1169f01dd0ce5fad80f11093a64f65fcb3`.

The exact supervisor packet remains in adjacent `state-ab-supervisor-01`.
Supervisor SHA-256 is
`58165e21c4830817066d47c9d5fbd2832e27052101b7d74cc7db0700cd52f84d`;
plan SHA-256 is
`59e3e097862f5087aa26a51c2782fbb0f43fcbc095093ebf327c000380c436db`.
Its launch/preflight refuses reuse of this output directory.

All 35 pinned input/evidence files and the original failed VST3 binary/payload
were reverified at completion. Compiler, toolchain, shared dependencies and
frozen product fixture/evidence matched. Cmajor source stays frozen at `2fc4c2dc`.

At 10:39:06 UTC, all six owned groups were independently checked absent:
`71256`, `71642`, `72037`, `72041`, `72437`, `72821`. The native slot was explicitly
released to Bob. Retained build output was **378,936 KiB (~370.05 MiB)**, below
the 1 GiB ceiling. Free space at release was **45.3666 GiB**, above the 44 GiB
floor. Small durable evidence copies are additional retained documentation;
no native allocation remains active.

Next gates remain separately routed: coherent framework/tool provenance and
product rebuild, independently reviewed new binary/payload pins in the external
host fixture, original product VST3 state/validator checks, shared JIT behavior
before a global pin advance, and editor/AU/DAW/install/listening/release acceptance.
No product target, JIT or compiler build, pin/feed/receipt mutation, installation,
editor, DAW, audio device or clipboard work occurred in this A/B.
