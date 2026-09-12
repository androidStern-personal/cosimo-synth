# Builder Kit release audit — 2026-09-12

**Verdict: do not cut the current source as a new release yet.** The framework is present in the customer export, and that export installs and tests successfully. The release inputs are not ready; the distributed Git history also retains personal identifiers.

Audited source: `363907f5b3474fff9702fa04b6a3627effa8df64` on `codex/shared-data-runtime`. Baseline: the actual released **0.1.5**, tagged at customer commit `9c98949d583f9fbc226f669d81103c4a27e72917`, created September 9. Source commit for that release: `863b6cb1643450acd1ef63f3d7e0dad6e4de67be`. Older installation feeds were also checked; they are not all on the same release.

## What prevents release approval

| Finding | What it means | Completion condition |
|---|---|---|
| Cmajor metadata disagrees | CMake pins `dca85fc1f87af241af66ca31989940f2887a7e56`; `kit/toolchain.json` still names `cdea10c4dc82c9510fcf77a32325663402c9ba5e`. The release script rejects this mismatch. | Choose one published pin, build its tools, and stamp matching metadata and verified hashes. Do not bypass the guard. |
| The source still says 0.1.5 | That version already exists for customers. The source toolchain is a release template, not the new downloadable tool set. Blank template hashes alone are not a defect. | Assign a new version; recommended **0.2.0**. Produce a staged release with its own matching archives and manifest. |
| Git history retains personal identifiers | The current exported files are clean, but old Git objects and commit metadata remain downloadable. See the precise classification below. | Resolve the historical-distribution policy and update migration before claiming the package contains no personal information. Prevent new identifier leakage with history-aware inspection and a neutral release identity. |
| Existing owners use different feeds | The update skill fetches tags from the feed installed in that customer's kit. Publishing only to the newest feed does not make the update available everywhere. | Demonstrate a real update from each supported feed cohort, preserving a customer's plugin edits, or ship an explicit feed migration. |
| Exact packaged customer proof is incomplete | A raw export cannot supply the new verified tool archives. Its native build correctly stopped there. | Use the staged release through normal setup, build unchanged Enhance That natively, and exercise the packaged browser path with shared-memory isolation and audio. Audit the actual archives too. |

No runtime source, version, pin, feed, customer history, or external release was changed during this audit. The changelog and announcement material are new local drafts.

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

## Release scope to communicate honestly

The new kit supplies the state declarations, persistent owner, React controls, shared Undo/Redo, guarded edits, field errors/retry, direct shared-data preparation, generated DSP references, MSEG state/editor/player, and typed native settings. These are exported customer code, not only private Cosimo prototypes.

The kit does not automatically migrate a customer's existing plugin. It does not infer custom DSP behavior, retain deleted external files for Undo, or supply the unfinished composable knob/context-menu package. Browser shared memory still requires cross-origin isolation. Supported customer installation remains Apple silicon with macOS 15 or newer; broader platform qualification is not established here.

## Evidence

Local generated evidence is under `build/release-audit-2026-09-12/`: `release-audit-summary.json`, `RELEASE-CHANGE-AUDIT.md`, `released-baseline.json`, `export-result.json`, `npm-ci.log`, `typecheck.log`, `npm-test.log`, `runtime-build.log`, `native-build.log`, and strict-checked examples. These files are audit outputs, not customer content.
