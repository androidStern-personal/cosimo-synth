# Builder Kit release audit — 2026-09-12

**Status: preparing Builder Kit 0.2.0; not published.** The duplicate Cmajor pin is fixed, matching tool archives have been built, and Enhance That plus the new-plugin starter now use the state framework. Final packaged-customer qualification passed from source `3a4a393a85bd45eeabe77b643990b1f1fc00594f`. Release decision: preserve existing customer update history. The audited historical email/signing-team/device identifiers are non-secret metadata and no longer block this release.

Audited source: `363907f5b3474fff9702fa04b6a3627effa8df64` on `codex/shared-data-runtime`. Baseline: the actual released **0.1.5**, tagged at customer commit `9c98949d583f9fbc226f669d81103c4a27e72917`, created September 9. Source commit for that release: `863b6cb1643450acd1ef63f3d7e0dad6e4de67be`. The production store releases 0.1.5, 0.1.6, and 0.1.7 all offered the same Builder Kit 0.1.5 installer. Older preview feeds exist, but they are not established as paying-customer cohorts.

## Follow-up work

| Item | Current result |
|---|---|
| Cmajor provenance | Fixed: the exported tool manifest derives its revision from the committed CMake pin, `dca85fc1f87af241af66ca31989940f2887a7e56`. The real committed-source regression and mismatch rejection both pass. |
| Release identity and tools | Source version and archive paths are 0.2.0. Both pinned tools were built by the canonical release helper and archived with recorded hashes. Source-template hashes remain blank until release staging, intentionally. |
| Included example and starter | Migrated to the public state API. Existing Enhance That DSP, parameter identities, presets, and snapshots are preserved. Rapid input, Undo/Redo, GUI reopening, and the existing interaction assertions pass. |
| Existing-customer update | Actual 0.1.5 lineage was updated in isolated customer repos. Ordinary edits survived byte-for-byte; a deliberately mixed scaffold edit stopped as a conflict. Independent dependency installation, typecheck, and 287 customer tests passed, with six monorepo-only skips. |
| Historical identifiers | New release commits/tags use a neutral identity. Existing reachable history is preserved; that does not erase old identifiers or old downloads. Andrew requested the secure, simplest option: preserve the normal update path rather than rewrite history to remove non-secret identifiers. No clean-history migration is planned for this release. |
| Packaged customer qualification | Passed: real HTTP download, normal setup and strict doctor, typecheck, 285 tests (six monorepo-only skips), 57 browser tests, and production Enhance That VST3 build. No publication or installed-DAW/listening claim. |

Both the rebuilt CmajPlugin loader and the final customer-built Enhance That VST3 passed pluginval at strictness 5 with GUI tests skipped. GUI interaction was separately checked by the 57 browser tests; this is not installed-DAW or listening acceptance.

The final archives were rebuilt after mapping compiler diagnostic paths to neutral source names and removing unnecessary build RPATH. Scanning both archives found zero occurrences of the maintainer home path. Upstream prebuilt LLVM still includes its own upstream build paths; these are not private Cosimo source or maintainer credentials.

Release mirrors now contain only selected commit ancestry and ancestral kit release tags. Unrelated branch/tag objects are excluded. Existing published objects and reachable historical identifiers are not erased.

Final candidate evidence: `candidate-qualification.json`, `candidate-export-audit.json`, `tool-artifacts.json`, `tool-archive-privacy.json`, `tool-pluginval.log`, and `candidate-pluginval.log` under `build/release-audit-2026-09-12/`. The 216-file exported source scan found no detected credentials, maintainer paths, or exact private source matches; the previously identified private-project name literal remains only in a negative test fixture.

The original audit below described source `363907f5`; the follow-up above records the subsequent fixes. No external release, customer history rewrite, or customer email has been performed.

## What passed

A fresh export from the audited commit was created outside the repository and installed independently of repository dependencies.

- Export: **210 authored files** before its generated manifest. The kit subtree changed from **121 to 181 files** compared with 0.1.5: **60 added, 12 modified, none removed**.
- Separate `npm ci`: passed; npm reported zero known dependency vulnerabilities at the time of installation.
- Typecheck: passed.
- Customer tests: **283 passed, 6 skipped, 0 failed**. The skipped tests depend on monorepo-only plugin files, not missing customer runtime code.
- Unchanged Enhance That runtime/UI build: passed.
- Both documented state/UI examples: strict TypeScript checks passed against the exact export. The MSEG example also generated its real named Cmajor resource and matching readers.
- Native build: deliberately stopped at missing hash-pinned tools. It was not bypassed or reported as a native success.

The examples demonstrate real author APIs inside an existing plugin. They are not standalone newly built audio plugins. Prior Cosimo browser/native evidence is useful implementation evidence, but does not replace the final staged customer installation.

## Privacy and product separation

The current export contains the generic state framework, shared-data code, MSEG support, and Enhance That example. It does not export the private Cosimo DSP/UI/native source trees.

The audit inspected current files, the released customer Git lineage, Cmajor/CHOC dependency mirror history, and embedded archives: **12,813 Git objects, 1,529 commits, and 109 embedded archives**. It compared against **2,098 historical private Cosimo source objects**.

| Category | Result |
|---|---|
| Private Cosimo source | No exact private source matches in the export, mirror histories, or embedded archives. Import/export boundaries were also checked. |
| Maintainer credentials | No private signing keys or maintainer credential tokens detected. One credential-pattern match was adjudicated as bytes inside upstream embedded WebAssembly. |
| Personal identifiers | Old `v0.1.0` `kit/export-allowlist.json` contains personal email, signing-team IDs, and device IDs. Commit/tag metadata in the kit and dependency histories also contains personal email. These identifiers are **not authentication secrets**. |
| Customer access | Historical feed configuration intentionally contains customer access capabilities. Those are delivery credentials given to purchasers, not administrative credentials. Their values are excluded from these reports and announcement material. |
| Private project references | A shipped test contains private-project path/name literals in a negative fixture. It does not contain the referenced source. Move monorepo-only checks outside `kit/` while preserving their assertions. |
| Dependency branch refs | Mirrors contain extra branch names, but all inspected tips are ancestors of the approved pins; no additional off-pin commits were exposed by those refs. Publish only necessary approved refs in future. |

This is evidence from allowlists, imports, exact historical source comparison, and targeted secret/identifier scanning. It is not a mathematical guarantee against modified proprietary snippets or unknown secret formats. Newly built release archives must be scanned separately.

**Do not silently rewrite customer Git history.** That would break the normal merge-based update path. Deleting old names from today's files, pruning branch names, or adding a clean commit does not erase reachable historical objects or old immutable downloads. Complete identifier removal needs a deliberate customer update bridge and a decision about the old downloadable objects. A neutral release author identity prevents new metadata leakage but does not fix old history.

The concrete chain is: export selected files from the source repository, commit those files into the separate Builder Kit release repository, then distribute that repository for customer installation and updates. The source repository's Git history is not copied by the export. The first kit release accidentally included the exporter's exclusion list, with personal identifiers written inside its `forbiddenStrings` rules; the old kit commit still contains that file. Separately, author/tagger metadata can retain an email address.

## Release scope to communicate honestly

The new kit supplies the state declarations, persistent owner, React controls, shared Undo/Redo, guarded edits, field errors/retry, direct shared-data preparation, generated DSP references, MSEG state/editor/player, and typed native settings. These are exported customer code, not only private Cosimo prototypes.

The kit does not automatically migrate a customer's existing plugin. It does not infer custom DSP behavior, retain deleted external files for Undo, or supply the unfinished composable knob/context-menu package. Browser shared memory still requires cross-origin isolation. Supported customer installation remains Apple silicon with macOS 15 or newer; broader platform qualification is not established here.

Enhance That now declares its eight existing scalar parameters in `fx/enhancer_lite/state.ts`, uses `usePluginState` and `usePluginHistory`, and has a generated state owner through `stateSource`. The starter generates the same pattern. These scalar controls do not need shared-memory uploads.

Enhance That's multi-axis graph still groups history per affected scalar: a frequency/amount/Q drag can require more than one Undo. Existing preset and A–G snapshot recalls use their original host-write path and do not create shared Undo entries. The documentation and announcement must not imply preset Undo or whole-graph transaction grouping.

## Evidence

Local generated evidence is under `build/release-audit-2026-09-12/`: `release-audit-summary.json`, `RELEASE-CHANGE-AUDIT.md`, `released-baseline.json`, `export-result.json`, `npm-ci.log`, `typecheck.log`, `npm-test.log`, `runtime-build.log`, `native-build.log`, and strict-checked examples. These files are audit outputs, not customer content.
