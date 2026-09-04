# BK-24 integration queue

Authority: [approved specification](../BUILDER_KIT_BUILD_AND_GUIDANCE_CLEANUP.md), copied byte-for-byte from planning commit `e6e52999`; that historical branch is never merged.

Coordinator: Bob, task `01a06ded-e922-7b60-83a7-44332a0e3fee`, model `gpt-6-astra`, effort `xhigh` (verified in current run context). Woods/product owner: `01a03885-0e68-7411-8b3f-f69ae41b6d89`.

Integration: `codex/bk-24-build-guidance-integration`, `/Users/winterfell/.codex/worktrees/c57c/cosimo-synth`, fetched baseline `7341f96372e4561b5e02a5a7f870fdc3b8d64909`. Initial worktree clean; shell/Git execution verified. Configured `scripts/link_master_todos.sh` links the live tracker; do not stage that symlink or copy unrelated live tracker history into commits. Primary checkout and its unrelated changes stay untouched.

## Queue and serialization

| Tickets | Owner | Scope | Status |
| --- | --- | --- | --- |
| BK-24A/B/D | SOL/xhigh build worker | Build driver, generation, width setting removal or supported alternative, focused regression proof | Pending dispatch |
| BK-24E | SOL/xhigh guidance worker | Root/kit minimal conditional instructions, per-rule disposition, reference validation | Pending dispatch |
| BK-24C | SOL/xhigh native-gate worker | Exported-kit Mac qualification path and scoped workflow | Pending dispatch; native execution waits for reviewed A/B/D |

The shared driver and wrapper have one worker owner. Guidance inventory and native-gate authoring can proceed independently. Coordinator owns serial rebases and source review, then composed focused checks, one native gate, final integration and source master push. Workers never merge/push master or claim native/HMR/install slots. No installed products, DAWs/devices, public publication, feed releases, customer playground, protected checkpoints, other workshops or servers are changed.

## Decisions and review

- Work allocation: A/B/D have one owner because configuration reset, generation preservation and width removal overlap the same files. Independent C/E work stays parallel; native execution follows reviewed composition.
- Width requirement: approved choice is a small supported mechanism or removal. Consumer generated-source edits and disproportionate toolchain work are excluded. Final decision and evidence pending.
- Guidance: relocation is distinct from source enforcement; untested protections remain selectively discoverable. Final per-rule disposition and Woods product review pending.

## Evidence and handoff

Pending worker commits, independent source reviews, focused red-before regression results, native build-loop evidence, final objection severity assessment, exact changed scope and integration SHA. Host listening, physical-device acceptance, installs and publication are outside this queue.
