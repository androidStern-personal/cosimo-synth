# Public state lifecycle update — 2026-09-13

Integrated into `codex/shared-data-runtime` through `ee8190a84aa07150448d4a573f97ac8ca528cbd9`; not published. The original worker verification below is followed by the final coordinator qualification. Source base: `51017bb36b04b6a35f2ffac39f22677391c2cf35`. Tested customer export: `4be2b39e0b2bcc00974c51059efe3e511e6452cf`.

## Customer contract

`usePluginState(field)` now exposes one `state.status`: `loading`, `invalid`, `unavailable`, `idle`, or `updating`. Only `idle` and `updating` contain a usable `value`; both remain editable. The separate public `kind`, `pending`, and `application` fields and `PluginStateApplicationState` export have been removed.

The control still provides `error`, a guarded `retry` action when recovery is available, and its existing edit/gesture methods. An error contains its displayable message. The framework owns failure classification and chooses the matching recovery action. See the customer-shipped [API reference](../../../../kit/docs/PLUGIN_STATE_API.md).

Outstanding edits, retries, saving, and preparation contribute to `updating`. An error may remain visible while other work continues. `idle` means no tracked work remains, not successful saving or certified audio adoption. Invalid saved data can be replaced explicitly; missing parameters and closed connections cannot be repaired by replacing their values.

New optimistic values do not inherit an older value's failure or retry action. Rejected edits restore the accepted value and its current error. A retained Retry callback cannot restart the superseded value while a different draft is displayed. Held receipts do not hide failures that already belong to the accepted, displayed value.

Private session/protocol evidence and its existing stale-version, scope, generation, and persistence guards remain internal. This change does not replace engine or native protocols with the UI status enum.

## Verification

The source changes are in `2921c96d12044633eefe51de03561556e6f4780e`. Commit `4be2b39e0b2bcc00974c51059efe3e511e6452cf` additionally fixes browser fixture URL construction for independently installed customer dependencies.

| Check | Result |
|---|---|
| Complete state suite: `npm run test:plugin-state` | 216 passed |
| Public hook/browser suite: `npm run test:plugin-state:browser` | 20 passed, including five new lifecycle regression cases |
| Source TypeScript: `npx tsc --noEmit` | Passed |
| Real synth parameter/MSEG browser test | Passed: edits, shared Undo/Redo, automation, and reopening |
| Enhance That source-view browser tests | 8 passed |
| Kit export and ordinary preview/starter tests | 11 passed |
| Fresh committed customer export | 217 files before generated manifest; export gates passed |
| Independent customer `npm ci` and `npm run typecheck` | Passed |
| Customer `npm test` | 285 passed; six monorepo-only skips; no failures |
| Customer public hook and ordinary preview/starter browser suites | 23 passed; no skips or failures |
| Release Gain, MSEG, and video reference examples | All six state/view files passed strict TypeScript against that customer export |
| Exported agent documentation | All ten local links in `kit/AGENTS.md` resolve; state guide, API reference, and shared-data guide are present |

The five lifecycle cases cover concurrent save/preparation failure, draft rejection and recovery, pending retry acceptance, current-value failure with a held receipt, and terminal unconfirmed/missing-input states. Existing public type tests reject the removed fields and export.

The first customer browser run failed before mounting controls: the suites concatenated a slash onto a server URL that already ended in one. The independently installed Playwright 1.63.0 setup exposed this malformed URL; source dependencies used 1.59.0. The test URLs now use `new URL(...)`. All 23 browser tests passed after a new committed export and independent dependency installation. No missing asset or runtime-control workaround was required.

Local logs use `/tmp/builder-kit-state-*-318e.log`. Final customer-install/type/unit/browser logs contain `customer-final`; example compilation is `release-examples`. The export path is recorded in `/tmp/builder-kit-state-export-path-318e.txt`. These temporary logs are verification output, not customer content.

### Integration-review repair

Independent integration review found a regression with two outstanding stored edits: if codec equality threw while processing the first accepted reply, receipt settlement could redraw the remaining draft and throw again. This stranded promises after the listener had already been removed. Receipt settlement now completes without calling the fallible projection; normal receive paths redraw separately. Known acceptance resolves, remaining sent tickets interrupt with unknown acceptance, and the snapshot closes.

A new real channel-seam regression failed before the repair and now covers both accepted-snapshot retention failure and remaining-draft projection failure. The original single-edit assertions remain. A second regression checks a 32-edit burst: draft equality work depends on the latest displayed draft per field, not every superseded draft. Held receipts still preserve current-value diagnostics. The public compound-edit browser assertion now finishes saves and preparation before checking that the held receipt alone keeps both controls updating.

Repair verification: 28 focused client/public-type checks, all 20 public-hook browser tests, all 220 state tests, and source TypeScript pass. Logs use `/tmp/builder-kit-state-review-*-318e.log`; `review-red` records the original failing regressions. This repair does not change the public API or announcement wording. Customer-export and native qualification of the repaired candidate belong to the integration coordinator; the earlier export evidence above predates this repair.

## Release material audit

| Material | Action |
|---|---|
| Customer docs and changelog | Updated the state guide, API reference, shared-data guide, and changelog. Docs ship under `kit/docs`; the agent guide links to them. |
| Included example, generated starter, synth adapter | Migrated all public control consumers to value availability, preserving usable controls during updates. |
| `EXAMPLES.md` and `WRITEUP.md` | Updated guards and lifecycle wording. Both complete author examples were checked against the fresh export. |
| Current video reference | Updated `SOURCE-EXAMPLE.tsx.txt` and the corresponding note in `BRIEF.md` in the existing `videos/builder-kit-update` preview project. Its complete state/view reference passed strict TypeScript against the export. These local video files are in the separate, preexisting video worktree, not this implementation branch. |
| Current video on-screen code | Uses `usePluginState`, `state.value`, edit methods, and history methods, with no removed lifecycle fields. It remains a documented excerpt. No timing, artwork, or rendered footage needed changing for this API fix. Older renders are historical versions. |
| Release `EMAIL.txt`, `EMAIL.html`, and `SOCIAL.md` | Audited; no removed fields or invalidated lifecycle claims. No copy change required. |
| Maintained website and customer-email source | Audited local website source and its available `origin/main` ref; no removed public API references. Email delivery's own `status` fields are unrelated. No website deployment or email send performed. |

## Original worker handoff boundary

The integration coordinator owns rebasing, final review, integration, and publication. This task did not merge, push, deploy, change the store, or send customer email. The earlier native package qualification in `AUDIT.md` remains evidence for its recorded source revision. These new source/browser/customer-export checks do not claim a rebuilt native candidate, installed-host acceptance, listening acceptance, or a release of the changed API.


## Final coordinator qualification — 2026-09-13

Independent review reproduced a two-edit shutdown regression and accepted its repair at `ee8190a8`. No remaining scoped blocker was found. The coordinator fast-forwarded the clean branch after qualifying that exact committed source; the four unrelated dirty root trackers and separate untracked video project were preserved.

- Source: typecheck, all 220 state tests, all 20 public-hook browser tests, and the real synth parameter/MSEG Undo/Redo/automation/reopen browser test passed.
- Fresh release candidate: the existing release implementation staged the committed export and unchanged hash-verified Cmajor tools. A separate customer cloned it over HTTP and passed ordinary setup, strict doctor, typecheck, 289 tests (six monorepo-only skips), the runtime build, 57 ordinary browser tests, and 20 public-hook browser tests.
- That customer's production Enhance That VST3 build passed, followed by pluginval strictness 5 with GUI tests skipped. GUI behavior was separately exercised by browser tests. This is not installed-DAW or listening acceptance.
- The 218-file installed export scan found no detected credentials, maintainer home paths, or exact private Cosimo source matches. The existing negative-test private-project name literal remains; no new issue was found.

Evidence: `build/state-api-integration-2026-09-13/candidate-qualification.json`, `candidate-export-audit.json`, `candidate-pluginval.log`, and the accompanying stage logs. Source rerun logs are `/tmp/state-api-integration-*-final.log`. The pinned tool source and hashes did not change, so no tool rebuild was needed.

This renews packaged customer/native qualification for the changed public API. It does not publish the release, change store settings, send email, or alter video assets.
