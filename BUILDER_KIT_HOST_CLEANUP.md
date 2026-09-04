# Builder Kit: Ableton Spacebar and plugin-name cleanup

Authority: Andrew, Woods thread 01a03885-0e68-7411-8b3f-f69ae41b6d89, 2026-09-04.
Coordinator: Bob — Build reliability and AGENTS cleanup, thread 01a06ded-e922-7b60-83a7-44332a0e3fee.
Final independent customer acceptance: Woods, after both fixes land.

## Assignment and changed authority

Andrew authorized Bob to coordinate the Spacebar and plugin-name work through review and integration, then Woods to conduct the complete customer experience and report the results. BK-22A is now authorized for reproduction, diagnosis, and an evidence-led shared-framework fix; BK-13B is authorized for a regression-free owning-layer naming fix. This supersedes the former investigation-only / routine-repair holds for these two items, not unrelated product decisions.

Resume the existing Bob task; do not create a rival coordinator or direct the old research/product threads. Keep the existing Astra/xhigh coordinator configuration and verify execution permissions. Start from freshly checked origin/master in clean isolated worktrees. Bob owns assignment, focused repair loops, dependency ordering, serialized rebases, final reviews, integration and pushes to master. Workers must not merge/push master, deploy, or take shared native/host/install slots independently. Record exact owners and scope in a durable queue.

## BK-22A: Spacebar reaches Ableton when the plugin does not own it

Reproduce and identify the actual failing focus/gesture path before assigning cause. Inspect the customer-built dedicated VST3 and current shared keyboard routing; byte markers and DOM defaultPrevented assertions are not proof of Ableton transport behavior.

Required result: ordinary interaction with the plugin must not accidentally swallow Spacebar or other established host-forwarded musical-typing input. Preserve legitimate text entry and intentional plugin shortcuts. Test non-text controls, knobs/sliders, numeric fields, true text entry, menus, active drags, shadow DOM, repeats, and matching key-up behavior as relevant. Numeric input focus alone must not be assumed to justify consuming Space; establish the actual intended action and host result.

Fix the responsible shared layer so other generated customer plugins inherit the behavior. Do not add a one-plugin forwarding workaround, global focus hack, synthetic global keystroke relay, or regress the original-native-event bridge. Preserve the established restrictions against currentEvent-based forwarding, resignFirstResponder, and unqualified flagsChanged forwarding.

Start from BK-22A-INVESTIGATION.md in /private/tmp/builder-kit-cx.pTfNiS as historical evidence only. Its candidate plugin, processes, binaries, and focus states must be freshly verified. The failure was not yet reproduced there.

Provide a focused regression that actually observes the forwarding decision/native path, and an authorized isolated Ableton before/after check. Use a disposable host session without disturbing an unsaved user session. If that cannot be done safely, report the exact host boundary; do not close or discard Andrew's work. Existing installed products and the dirty customer playground must not be overwritten. Dedicated test installs require collision checks and recoverable handling, not blind replacement. Do not install/repoint CmajPlugin.

## BK-13B: display the configured plugin name correctly

Show the configured human-readable name in the DAW, for example Cosimo Enhancer Lite, while keeping internal build identifiers and filenames separate where necessary. Preserve stable bundle/processor/plugin identities, host state and presets, DSP, parameters, and branding.

Do not ship the previous partial fix. Read /private/tmp/builder-kit-cx.pTfNiS/BK-13B-NAME-BOUNDARY.md; its isolated candidate e588619 fixes spaces but breaks quotes and truncates semicolons. Use actual current source and generated output to establish the owning boundary. Test representative spaces, apostrophes, quotes, semicolons, backslashes, Unicode, and interpolation-looking text as supported by the baseline; preserve literal data rather than executing/interpolating it. Do not silently narrow the accepted naming contract to avoid fixing escaping.

The fix must be in the responsible reusable generator/framework/CMake layer, not a post-generation regex/header splice or customer instruction workaround. Ordinary fixes in our existing Cmajor/CHOC repositories and matching Cosimo/kit pins/tool artifacts are in scope where required. Do not patch shared CPM cache sources. A new third-party fork or new dependency-delivery architecture remains a consequential expansion: present a concrete recommendation if genuinely necessary, not a unilateral addition.

Verify the generated plugin's actual factory/display metadata and real Ableton-displayed name. Keep build identifiers and immutable host identity stable. Tiny boundary executables alone are insufficient for final acceptance.

## Coordination, qualification, and delivery

The two investigations may run in parallel, but coordinate any shared generator/CHOC/toolchain changes and use one composed final dependency pin. Keep native builds, generated outputs, plugin installation, host input, master mutations and candidate packaging serialized. Observe other worktrees/servers and do not kill or seize their processes/ports.

Read source and review the full scoped diff before broad tests. During repairs, run targeted tests. After source review is clean, run the complete relevant composed qualification once. Independently review assumptions Andrew may object to. Distinguish actual host observations from tests/markers/source inspection.

Preserve BK-24 build correctness and minimal AGENTS work. Do not reintroduce the width cap or generated-code patches. Automated release infrastructure, GitHub/VM runner setup, general AGENTS redesign, unrelated UI/DSP work, dynamic-data research, and the rest of the launch roadmap are outside this queue. In particular, the other dynamic-data implementation is not input to these fixes.

After both fixes are reviewed, integrate and push the exact qualified source to origin/master through the normal coordinator-only process. Update the queue with source/dependency/tool-artifact identities and any genuinely unperformed checks. Do not declare the independent full customer acceptance complete; Woods owns it next.

Prepare a reproducible candidate from the final integrated source with matching compiler/runtime/tool archives where necessary, using existing packaging and non-publishing/staging mechanisms. Woods must be able to test the actual fixed kit using the approved short installer shape, not the old published release or a source-only export with stale compiler binaries. Keep release candidates private/local and do not replace immutable releases or change the existing customer update channel. Do not invent new release infrastructure to enable this test. If making the candidate available requires authority beyond this isolated test scope, identify precisely what is missing while finishing all independent engineering work.

Final handoff must include:
- Both ticket results, thread/branch/worktree/commit identities, cleanliness and changed scope.
- Exact landed master and dependency/tool hashes, focused and final test evidence, actual host reproduction/verification, and unperformed acceptance.
- The exact candidate and private customer-entry delivery location, or precise staging blocker. Never print secret-bearing commands or credentials into committed documents or ordinary chat.
- How to exercise the unchanged included example first, with shipped instructions and no custom wrapper/source edits/maintainer-only preparation.
- A clear declaration that all shared build/host/install slots have been released.

Send the terminal handoff to Woods 01a03885-0e68-7411-8b3f-f69ae41b6d89. Explicitly tell Woods the fixes have landed and the candidate is ready for his complete customer experience. Woods will run the short-install, unchanged-example build/install, DAW name/Spacebar/use, and relevant saved-state/update/recovery journey in an isolated customer environment, record every intervention and deficiency, and report honestly to Andrew. Do not make Andrew repeat the long setup instructions or perform the acceptance himself.

No automatic release scheduling or customer publication is authorized by this assignment. No polling automation is needed: notify Woods on terminal completion or a genuine decision.

