# BK-24 integration queue

Authority: [approved specification](../BUILDER_KIT_BUILD_AND_GUIDANCE_CLEANUP.md), copied byte-for-byte from planning commit `e6e52999`; that historical branch is never merged.

Coordinator: Bob, task `01a06ded-e922-7b60-83a7-44332a0e3fee`, model `gpt-6-astra`, effort `xhigh` (verified in current run context). Woods/product owner: `01a03885-0e68-7411-8b3f-f69ae41b6d89`.

Integration: `codex/bk-24-build-guidance-integration`, `/Users/winterfell/.codex/worktrees/c57c/cosimo-synth`, fetched baseline `7341f96372e4561b5e02a5a7f870fdc3b8d64909`. Initial worktree clean; shell/Git execution verified. Configured `scripts/link_master_todos.sh` links the live tracker; do not stage that symlink or copy unrelated live tracker history into commits. Primary checkout and its unrelated changes stay untouched.

## Queue and serialization

| Tickets | Owner | Scope | Status |
| --- | --- | --- | --- |
| BK-24A/B/D | `/root/build`, `codex/bk-24-build-reliability`, `/Users/winterfell/.codex/worktrees/bk24-build/cosimo-synth` (SOL/xhigh) | Build driver, generation, width setting removal or supported alternative, focused regression proof | Source reviewed and composed |
| BK-24E | `/root/guidance`, `codex/bk-24-guidance`, `/Users/winterfell/.codex/worktrees/bk24-guidance/cosimo-synth` (SOL/xhigh) | Root/kit minimal conditional instructions, per-rule disposition, reference validation | Source reviewed and composed |
| BK-24C | `/root/native`, `codex/bk-24-native-gate`, `/Users/winterfell/.codex/worktrees/bk24-native/cosimo-synth` (SOL/xhigh) | Exported-kit Mac qualification path and scoped workflow | Source reviewed and composed; native slot pending final fast gates |

The shared driver and wrapper have one worker owner. Guidance inventory and native-gate authoring can proceed independently. Coordinator owns serial rebases and source review, then composed focused checks, one native gate, final integration and source master push. Workers never merge/push master or claim native/HMR/install slots. No installed products, DAWs/devices, public publication, feed releases, customer playground, protected checkpoints, other workshops or servers are changed.

Previous coordinator `01a06784-1cfc-7f43-be19-5c93ade6f53a` confirmed no active or planned shared native/master work; new operations will serialize through this queue. Unrelated holds remain with that coordinator.

## Decisions and review

- Work allocation: A/B/D have one owner because configuration reset, generation preservation and width removal overlap the same files. Independent C/E work stays parallel; native execution follows reviewed composition.
- Width decision: REMOVE the optional cap. Coordinator independently verified the current CPM Cmajor source is exact pin `04ee24df55c4a3ba9f67d498a70c19de1aa1ad79`; `include/cmajor/helpers/cmaj_JUCEPlugin.h:970` fixes stock bounds at 250x160 through 32768x32768 and the JUCE generator has no width option. Alternative fork/tool delivery would be disproportionate for this optional rule. Severity: LOW, explicitly authorized product tradeoff; responsive/min-size source must remain unchanged. Tool/source pins stay unchanged.
- Incremental approach: generate on every configure into scratch, then synchronize changed bytes and remove stale generated outputs while preserving `_build`. This avoids a second input cache/invalidation system. Generator invocation remains; no native timing claim until actual qualification.
- Guidance: relocation is distinct from source enforcement; untested protections remain selectively discoverable. Woods approved the product direction on September 4. His final K11/K14/K17 evidence-label correction is recorded in `07bdc29c`; it preserves the behavioral-proof distinction without expanding implementation scope. Severity: LOW after repair.

## Evidence and handoff

Baseline instruction size: root `AGENTS.md` 123 lines / 15,775 bytes; `kit/AGENTS.md` 50 lines / 8,715 bytes (173 / 24,490 combined). Final root: 19 lines / 2,170 bytes. Final kit: 26 lines / 2,905 bytes. Combined: 45 lines / 5,075 bytes. [Disposition](BK24_GUIDANCE_DISPOSITION.md) accounts for 68 root and 30 kit rules, plus the unchanged personal overlay.

### Reviewed composition

- A/B/D: original worker `165fa0f7`, coordinator-rebased `ef2fa4d7`, merge `8d9e2878`; clean worker handoff in [build evidence](BK24_BUILD_HANDOFF.md). Coordinator reviewed the source and scoped diff, verified the stock Cmajor width behavior, and reran the focused 57-test suite successfully. A scratch stale-symlink concern was disproven without source changes. Configuration reset and content-aware generated-file synchronization are technically sound on focused evidence; real native incremental proof remains required.
- E: original `d51eb9fd` / `c1690501`, rebased `b389da08` / `b5563730`, merge `8ab5a811`; final evidence-only followups `678fc010` / `07bdc29c`, merge `3d06f898`. Coordinator repaired softened desktop-delivery defaults and restored exact historical device/signing evidence; Woods approved that direction. Coordinator export/loader/fontaudio checks passed 14/14. The worker's missing-esbuild fontaudio attempt is superseded by this composed check, not called a passed worker run.
- C: original final `ae6b1c72`, rebased final `d557d1a6`, merge `54e6cb40`; [gate handoff](BK24_NATIVE_HANDOFF.md). Coordinator and A/B/D worker independently reviewed the harness. Repairs reject malformed nonempty published-tool pins, prove a second product leaves the first product untouched, distinguish signed-binary timestamp from no compile/link work, and compare exported CMake source/toolchain/published pins. No outstanding source-review finding remains. Existing local destination configuration was found through the prior coordinator; no new secret or release infrastructure is needed.

### Objection severity

- Dropping the optional SeqFX width cap: LOW, explicitly authorized; avoids consumer-side generated C++ mutation and extra fork/tool release work. Responsive layout, initial size and source/tool pins remain unchanged.
- Always generate into staging and synchronize only changed bytes: MEDIUM until the native gate proves unchanged, edited, missing-output and clean-equivalence cases. This deliberately keeps CMake's configure-time project contract rather than adding a second cache/invalidation mechanism.
- Guidance relocation with unresolved defects retained: LOW after product review. No safety rule is claimed enforced merely because source was inspected. Exact historical device commands remain internal and explicitly historical.
- Maintainer-only native scratch harness and published hash composition: LOW after pin/redaction review. It invokes real exported customer commands without adding a customer API or changing feed contents. Hosted native CI remains pending until a trusted runner is configured.
- Narrow UUID/signature normalization only after exact clean-binary mismatch: MEDIUM until actual evidence. The report must disclose fallback use; all other machine-code/resources must agree.

Final composed fast/export/native results and source-push SHA are pending. Host listening, physical-device acceptance, installs and publication are outside this queue.
