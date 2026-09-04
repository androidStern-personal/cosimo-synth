# Builder Kit build reliability and minimal agent guidance

Approved by Andrew on September 4, 2026. Implementation authorized; public release, feed publication, installed-plugin replacement, and physical DAW/device operation are not part of this handoff.

## Outcome and authority

Customers can change their plugin and run the supported build command without learning or repairing the build machinery. Agents receive the minimum universal guidance; hard-won knowledge remains available when relevant.

This specification supersedes the earlier suggestion to tolerate the generated editor-width patch. Andrew's decision is **a clean supported width limit, or no width limit**. Removing the requirement is explicitly allowed; preserving it by patching generated C++ is not.

Woods owns product scope and reviews the final guidance disposition. New Bob must use **gpt-6-astra, xhigh** and owns implementation coordination, source review, repair loops, serialized rebases, integration to master, and push. Do not revive the abandoned AGENTS audit task as an owner. Its observations may be checked as evidence, not treated as an approved architecture plan.

Source audit baseline: `origin/master@7341f96372e4561b5e02a5a7f870fdc3b8d64909`. Revalidate against current master before editing. This planning branch has historical source; **never merge it into source master**. Only carry this approved specification/tracker information across.

Keep the existing shared kit architecture and ordinary CPM cache/pins. Do not introduce another dependency resolver, per-plugin build system, custom cache/lease platform, or mandatory example-copying/onboarding workflow. Code generation remains owned by the Cmajor fork, not consumer-side text surgery.

## Approved tickets

### BK-24A — Rebuilds must apply removed or disabled settings

Problem: `kit/fx/prod-effect.mjs:createJuceGenerationConfigureArgs` omits false microphone-policy and absent width-limit values, while `kit/tools/effect_plugin_build/CMakeLists.txt` caches them. Previous configuration can survive a normal rebuild.

- Pass the complete current configuration, including reset/disabled values. Preserve unrelated user configuration.
- Test successive configurations in the same build directory: enable/change/remove values and demonstrate that current values win without deleting the cache.
- Coordinate the width-specific case with BK-24D; do not retain an obsolete width setting merely to test it. Test another surviving optional setting if width is removed.
- Include source-first review and a focused regression that fails before the fix.

### BK-24B — Make unchanged and edited builds genuinely incremental

Problem: normal `prepareJuceProjectOutput` removes all generated project content except `_build`, followed by configure-time generation. This recreates unchanged sources and undermines efficient iteration; no timing claim was established by the audit.

- Preserve unchanged generated files and accurately track DSP, manifest/config, UI/resources, generator and framework inputs. Removed/renamed inputs must not leave stale files in the product.
- Keep the existing customer commands. A fresh build, a no-change rebuild, DSP-only edit and UI-only edit must produce the correct artifact with only necessary work; retain concrete build/timestamp or command-trace evidence.
- An incremental artifact must agree with a clean build of the same inputs. Missing required generated outputs must recover correctly.
- Do not blindly move generation to a build-time command: the generated CMake project is currently needed during configuration. Choose the smallest sound implementation after tracing that dependency.
- No new custom build/cache orchestrator, timing dashboard, or broad CMake rewrite.

### BK-24C — Prove the real customer Mac build loop automatically

Problem: the current kit CI workflow is Linux-only and does not compile the customer VST3.

- Add a scoped repeatable Mac native qualification path using an exported customer kit and the existing shared build commands. Cover first build, unchanged rebuild, DSP/UI changes, configuration reset, and isolated product outputs.
- Validate the actual dedicated VST3 and compiled-mode packaging, not merely a web bundle or a source-string assertion. Keep no-JIT/product-identity protections intact.
- Keep fast tests fast. Run expensive composed native qualification after source review and focused fixes, with appropriate changed-path/release gating rather than rebuilding everything for every small edit.
- Use existing runner/tool/feed arrangements where available; do not print credentials or place private downloads in public artifacts. If a suitable runner is unavailable, deliver the runnable gate and local evidence, but report hosted CI as pending rather than silently skipping it or buying infrastructure.
- Final qualification depends on BK-24A/B/D. Separate build proof from unperformed Ableton/Logic listening and physical-device acceptance.

### BK-24D — Remove the generated editor-width hack

Problem: `kit/tools/effect_plugin_build/apply_generated_editor_width_ceiling.cmake` regex-rewrites generated C++ to substitute `CosimoBoundedGeneratedPlugin`. SeqFX currently declares `editorMaxWidth: 1120`.

- Look first for a small existing supported generator/JUCE/framework configuration route. If a small owned-fork improvement is appropriate, it must be an ordinary reviewed fork change with regression proof and matching tool/source pins; no edits to downloaded/generated sources.
- If retaining this optional width limit requires disproportionate generator/toolchain work, **drop the width requirement**, remove the now-unused setting/helper/splice/tests, and restore ordinary supported resizing. Andrew already authorized this fallback; do not block on asking again.
- Do not replace the regex with another text patch, runtime monkey-patch, or extra wrapper solely to preserve this optional constraint.
- Retain other responsive layout behavior, min-size constraints, sound, state, host identity and the protected card workshop. Prove the chosen width behavior and absence of consumer-side generated-source mutation.
- Handoff must say plainly whether the clean limit survived or was removed, and why.

### BK-24E — Strip AGENTS.md to essentials without losing knowledge

Scope: current repository root `AGENTS.md`, `kit/AGENTS.md`, and relevant shipped/exported instruction references. Inventory global/personal overlays for duplication, but do not edit user-global instructions or unrelated skills as part of this task.

- Account for each original substantive rule in a compact review artifact: keep as universal; retire as demonstrably outdated/duplicate; replace with source-enforced behavior plus proof; or relocate to a focused referenced document. Preserve provenance and known failures where useful, not obsolete directions presented as current truth.
- The root should contain only essential universal boundaries and a short **conditional** index. Do not reduce its line count by forcing every agent to load a giant replacement document. Apply the same discipline to the customer kit instructions.
- Put platform/build/host/product-specific knowledge near the relevant work or in existing focused references. Fix obsolete paths and contradictory guidance. Keep personal device/signing information out of exported customer material.
- Prefer existing source enforcement or small scoped fixes when a rule compensates for a real defect. Only remove a safety instruction as 'enforced' after the behavior is tested. Otherwise relocate it with a clear trigger; moving text is not fixing the issue.
- Preserve unresolved host-crash, keyboard forwarding, Spectral slot-zero/held-note, generated-artifact, dirty-worktree, shared-port, and install safety knowledge. Do not remove the underlying product behavior merely to simplify documentation.
- Existing CMake/iOS observations do not authorize a new device-management framework, DAW changes, or a repository-wide engineering rewrite. Larger newly discovered fixes become concrete follow-up tickets; keep their relevant guidance until fixed. The documentation reduction does not wait for every historical bug to be repaired.
- Verify referenced paths and commands against current source. Check the exported kit has usable product-neutral guidance and no private Cosimo references. Demonstrate that a cold reader can find build/install, platform and host guidance from the minimal index without reading all of it for unrelated work.
- Handoff includes before/after instruction size, the per-rule disposition and remaining unresolved issues. No arbitrary line-count target and no loss of current safety or product contracts.

## Execution and handoff

BK-24A and BK-24B share the build driver: use one owner or explicit non-overlapping edits. BK-24D shares the wrapper/config surface and must be sequenced with them. BK-24E inventory/relocation can proceed in parallel; reconcile final wording with landed code. BK-24C's final native gate runs after reviewed build changes compose.

Use isolated worktrees and one live queue. Every worker reports its thread, branch, worktree, base/final commit, scope, clean/dirty state, targeted proof, remaining failures and material decisions to the new Bob. Workers do not merge/push master, install products or publish. Follow Andrew's latest engineering-worker preference, SOL/xhigh, unless he specifies otherwise; Bob remains Astra/xhigh.

Review source before broad suites/builds. Use focused tests for repairs, parallelize independent work, serialize master mutations and native builds/install locations/fixed ports. Never stop another worktree's server or claim its output. No user-installed plugins, Ableton sessions, customer playground, primary dirty checkout, protected T26 checkpoints, SeqFX card/radial prototypes, or unrelated branches may be changed by this cleanup.

Bob records the queue and ownership in the live tracker without overwriting unrelated entries, integrates reviewed work to master, pushes, and reports completion or a genuine new product decision to Woods at `01a03885-0e68-7411-8b3f-f69ae41b6d89`. Public Builder Kit publication and upgrades to customers remain a separate authorization.

## Decision record

- User decision: a clean implementation is more important than retaining the width cap; its removal is allowed.
- User decision: retain knowledge, not a permanently bloated instruction file; source fixes, evidenced retirement, and selective references are acceptable routes.
- Scope choice: five tickets form one cleanup queue. Preserve the already-approved shared build architecture and avoid reopening the entire launch roadmap. Separate physical/host acceptance and publication from source integration.
