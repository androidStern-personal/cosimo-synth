# Builder Kit customer-experience qualification, 2026-09-04

Coordinator: Bob, task `01a06784-1cfc-7f43-be19-5c93ade6f53a`, branch `codex/builder-kit-cx-integration-20260904`, worktree `/Users/winterfell/.codex/worktrees/77d5/cosimo-synth`.

Product contact: Woods, task `01a03885-0e68-7411-8b3f-f69ae41b6d89`. Authority is planning commit `29b3961889911b49c90323c8dbe0523fb4963865`, September 4 section and exact ticket rows. The historical planning branch was not merged.

Starting master: `b40b52aa3236774dc3d6cd4bdbc1fe804d39c26c`.
Qualified implementation source: `c3bdffdf5b848ce64945907b23beb18bd8d26d17`.
Integration status is recorded in the owning `TODOS.txt` item; this is source/build qualification, not a published release.

## Outcome boundaries

| Ticket | Result |
| --- | --- |
| BK-13A | Permanent-plugin-ID preset isolation, same-ID retention, and explicit original-owner access to existing legacy folders are implemented and qualified. |
| BK-21A | Setup presents the exact full JUCE acknowledgment command; no automatic consent behavior was added. |
| BK-22B | Actual bundle/processor identities govern replacement; staged, signed copies and recoverable exclusive moves are implemented and qualified. |
| BK-22C | Opt-in real included/starter UI works at the documented browser route; no audio engine or automatic preview. |
| BK-40A | Concise unchanged-example guidance is implemented. Final composed cold-customer first-use proof remains pending its explicit BK-13B dependency. |
| BK-13B | Held. Unpushed naming candidate introduces quoted-name compilation failure and semicolon truncation. No JUCE fork, new delivery seam, pin change, narrowed validation, or alternate implementation is authorized. |
| BK-22A | Bounded read-only investigation completed. Exact live Spacebar reproducer, focus state, root cause, and regression boundary are unconfirmed. No repair or live-host manipulation. |

No published feed, public deployment, live plugin replacement, Ableton interaction, VM rerun, or unrelated cleanup occurred.

## Clean owner handoffs and source review

- Presets: `/root/presets`, branch `codex/bk-13a-preset-identity`, worktree `/private/tmp/builder-kit-cx.pTfNiS/presets`, commit `bec034515db2b659c53e3866646e4498b705f966`.
- Entry flow: `/root/entry`, branch `codex/bk-customer-entry-flow`, worktree `/private/tmp/builder-kit-cx.pTfNiS/entry`, commit `2fb989b730a60a35f08cb920ec8a8493cac50ed9`.
- Native installer: `/root/native`, branch `codex/bk-native-identity-install`, worktree `/private/tmp/builder-kit-cx.pTfNiS/native`, commit `010247542beaa9ef5fd7210005d0a6ea9acc4182`.

All three owner worktrees were clean and rebased against the unchanged starting master. Coordinator reviewed production source and focused tests before broad gates. An independent data-safety review found a check-before-move race; the owner repaired it, the reviewer accepted the repair, and real-filesystem interleaving tests passed.

The template merge conflict retained both the browser entry test and the explicit native-install test command. Coordinator commits `8093c1b9` and `c3bdffdf` wire existing canonical gates and prove ordinary customer units exclude native compilation. No shared tracker history was removed.

## Composed verification

| Gate | Result |
| --- | --- |
| Root `npm test` | 1,198 passed, zero failed, one existing optional local Spectre shelf-corpus skip. |
| Root `npm run typecheck` | Passed, zero TypeScript diagnostics. |
| Root `npm run test:enhancer-lite:view` | Built the UI; 34/34 source/compiled view and documented preview-route checks passed. |
| Root `npm run test:effect-presets:browser` | 7/7 passed. |
| Root `npm run test:kit:native-install` | 34/34 passed, zero skips, using actual native factory binaries and real filesystem failures/interleavings. |
| Customer setup and strict offline doctor | Passed using newly downloaded, hash-verified published tools and the export's own npm dependencies. |
| Customer typecheck and `npm test` | Zero diagnostics; 101 passed, zero failed, six explicit monorepo-only skips. |
| Customer `npm run test:browser` | 34/34 passed against the actual exported source and built runtime. |
| Customer `npm run fx:prod:build -- enhancer-lite` | Passed; actual dedicated VST3 and production identity helper built. |
| Production installer API, isolated destination | Read-only dry run, first install, and same-identity update passed; exact candidate/installed payload digests match and no recovery remainder remains. |
| pluginval strictness 5 | Passed with `--skip-gui-tests`; external Steinberg validator was not configured. This is not DAW/editor/listening acceptance. |
| Scoped diff | Clean; dependency pins/feed, patch manifests, DSP, and all tracked synth bundles unchanged. |

## Actual customer artifact

Export: `/private/tmp/builder-kit-cx.pTfNiS/customer-native`, from the qualified implementation commit (exporter file count: 137, before adding its manifest). All 136 inventoried regular files, including that manifest, remained byte-identical after qualification. No included-example source, identity, or tests were modified during this flow.

The existing owner's JUCE acknowledgment was preserved; no new acknowledgment was fabricated or consent recorded. The existing release renderer supplied the current published archive hashes to this derived export. Normal setup downloaded tools into its own `build/kit-tools`; no tool binaries or dependency trees were copied. This is maintainer qualification, not the pending cold-customer prompt proof. Native sources resolved through the normal shared CPM cache.

- Cmajor: `04ee24df55c4a3ba9f67d498a70c19de1aa1ad79`.
- Published cmaj archive SHA-256: `2f170724ca44d1c0e9bd7d0bf23f961794dc707211c3048cbf133e9593eb545d`.
- Published CmajPlugin archive SHA-256: `7f5bb5dd9d916b1f47437d5f7a366fedd0cbed0f1fa74887f3f8ee9e7d53ed8b`.
- Actual factory bundle ID: `dev.cosimo.enhancer-lite`.
- Actual factory processor CID: `ABCDEF019182FAEB436F73694373454C`.
- Actual factory display name: `CosimoEnhancerLite`; readable-name work is still held.
- Native executable SHA-256: `73ab24e6cb4a631200de07a4d21e2d36533ae00180703ce9456d3a6185b6a0a2`.
- Complete tested UI: 254,577 bytes, SHA-256 `fa246455a4e8f911d2ee7b5553b4ce6f4c9aefd78e17d6d38d26310ef482ecb6`. These exact bytes are embedded in the native executable.
- Signed bundle payload SHA-256: `825106078e402a0708eee987a5f77c005d1a66c000b7ea62faddc4cd9c934325` before and after installation.
- Production runtime manifest retains the same ID and has no `view.devModule`.

Built bundle: `/private/tmp/builder-kit-cx.pTfNiS/customer-native/build/enhancer_lite_juce/_build/plugin/CosimoEnhancerLite_artefacts/Release/VST3/CosimoEnhancerLite.vst3`.

Isolated installed bundle: `/private/tmp/builder-kit-cx.pTfNiS/customer-proof/isolated-install/Plug-Ins/VST3/CosimoEnhancerLite.vst3`. The production API was exercised here; the CLI's default real-home destination was not used or presented as tested.

Detailed filtered logs, source inventory, setup/build/browser outcomes, native-install evidence, and pluginval log are under `/private/tmp/builder-kit-cx.pTfNiS/customer-proof/`. No capability URL is printed in this report.

## Coordinator decision-provenance audit

- **LOW, accepted: identity scope versus sound contract.** A fixed lowercase SHA-256 of `[manifest.ID, effectID]` isolates filesystem storage without changing sound compatibility. Exact original-owner declarations retain old folders in place. Broad copying/migration into every derivative was rejected because it would contaminate new identities. Identity, late-load, original-bank, and upgrade tests cover the seam.
- **MEDIUM, accepted: unreadable initial bank fails closed.** Preset mutation refuses while the bank is incomplete/unreadable, with a visible retryable UI failure; sound and editor remain usable. Guessing an empty bank risks data loss. Existing asynchronous write durability semantics were not redesigned.
- **LOW, accepted: actual binary identity.** A build-produced helper uses the existing pinned SDK headers and a bounded child process to inspect one real audio processor factory, without creating its processor/editor. Copied metadata or a candidate-settings helper cannot establish an existing binary's identity.
- **MEDIUM, accepted after repair: recoverability over forced cleanup.** Exclusive native moves and post-move entry/digest verification preserve unexpected captures and reconcile lost subprocess responses. Uncertain rollback can require manual recovery at the reported path. Forcing a retry or deleting an unexpected bundle was rejected. Both independent review and interleaving cases pass.
- **LOW, accepted: preserve signatures.** Candidate, staged, and installed bundles must verify; installation does not re-sign a damaged copy. Existing unsigned/unreadable bundles refuse replacement. Older valid bundles need not carry today's UI markers.
- **LOW, accepted: native tests are explicit.** Ordinary customer units must not newly require a compiler or SDK download. Native installation tests remain a documented serialized macOS gate, with a permanent discovery-exclusion regression.
- **LOW, accepted: optional real UI only.** A small shared harness uses actual plugin view code and declarative parameter metadata, with page-local state. A substitute UI, automatic startup, and an audio-engine expansion were rejected. Custom harnesses are preserved; ambiguous/missing plugin routes fail clearly.
- **HIGH, held: human-readable names.** The candidate breaks previously buildable quoted names and truncates semicolons at the pinned JUCE boundary. Source-generation and tiny compile-boundary evidence are not an actual repaired generator/full-plugin result. No dependency fork or alternate scope was inferred from the build failure.

## Separate findings and remaining authority

Woods explicitly excluded unrelated synth artifact refresh. Rebuilding unchanged starting master reproduced all iOS/worker output changes, while rebuilt desktop baseline-versus-candidate source maps isolated the intended preset files. Against tracked master, desktop generation also incorporates older bounce/preset/kit-relocation drift. All five tracked synth artifacts were therefore left unchanged, not hand-edited. Their source parity is still stale. The Builder Kit export excludes them and rebuilt its own task-specific UI successfully.

The generated candidate and exact baseline comparison remain at `/private/tmp/builder-kit-cx.pTfNiS/candidate-patch-gui` and `GENERATED-BOUNDARY.md`. Naming evidence is `BK-13B-NAME-BOUNDARY.md`; Spacebar evidence is `BK-22A-INVESTIGATION.md` in the same scratch root.

Remaining gates/decisions: BK-13B owning-layer naming repair authority; then BK-40A exact cold-customer prompt/build/install proof; an authorized isolated Spacebar/focus reproducer before any BK-22A repair. Actual DAW scan/display/editor/keyboard/listening, physical-device acceptance, notarization, new customer publication, and the unrelated synth bundle catch-up are not completed by this handoff.
