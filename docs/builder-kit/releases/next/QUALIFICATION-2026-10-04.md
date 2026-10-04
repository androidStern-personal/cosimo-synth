# Builder Kit 0.2.0 qualification — October 4, 2026

The component branch is integrated into the isolated release candidate, and the customer update-email sender is implemented and tested. Neither the kit nor the sender was published or deployed, and no customer email was sent.

## Integrated source

Candidate branch: `codex/builder-kit-020-candidate`. Qualification worktree: `builder-kit-020-qualification/cosimo-synth`.

The state integration base `6febf1ea4cf` was an ancestor of component source **`d8c0f97d4f48497d3b1378158f5dba5ebd37c82c`**, so integration fast-forwarded without conflict. That exact committed source was exported and qualified. Subsequent changes record these results and add customer release-update documentation; they are not the source SHA in the staged release manifest. The original component worktree and primary maintained checkout were preserved. No master merge, push, or shared tracker rewrite occurred.

The existing release helper staged version **0.2.0** over the real **0.1.5** customer ancestry, using freshly built canonical tools. Cmajor pin: `dca85fc1f87af241af66ca31989940f2887a7e56`. CHOC pin: `eedf2aebd3049a84cdcf280664c73c53796118ac`. The staging feed used loopback HTTP and is no longer running; its URLs are qualification fixtures, not a production destination.

## Customer qualification

| Gate | Current result |
|---|---|
| Source review checks | Independent dependency installation, typecheck, release contracts, and diff whitespace checks passed. |
| Canonical committed-source export | Export proof passed: typecheck, unit/runtime checks, synthetic merge guards and export boundary. |
| Normal customer install | Cloned the staged Git feed over HTTP outside the monorepo, ran ordinary `kit:setup` with the already acknowledged JUCE notice, and passed strict doctor. |
| Independent customer tests | **293 passed, 6 documented monorepo-only skips, 0 failed.** Dependencies were installed independently. |
| Packaged browser UI | **57 passed**, plus **20 state/lifecycle tests** and **41 knob/MSEG/filter tests**, including copying/bundling the displayed code and real offline Cmajor MSEG playback. |
| Browser audio | Real Chromium AudioWorklet initialization and running audio passed for Enhance That and the preserved customer gain plug-in. The helper came from the customer build's exact pinned Cmajor dependency; the programs were compiled by the installed hash-pinned customer tool. Parameter edits changed finite, unclipped output. Proper COOP/COEP headers enabled cross-origin isolation; no hosting-specific patch was used. Output was muted: this is measured audio evidence, not human listening acceptance. |
| Unchanged included example | Runtime/UI build and production Enhance That VST3 build passed. |
| Native validation | Both the customer-built Enhance That VST3 and freshly rebuilt bundled CmajPlugin VST3 loader passed pluginval at strictness **5**, with GUI tests skipped. Browser tests exercised the UI separately. No plug-in installation, DAW session, signing/notarization, device acceptance, or listening acceptance was performed. |
| Actual 0.1.5 update | The old bundled fetch helper obtained the staged release in its isolated release namespace. A normal merge preserved customer edits byte-for-byte; the updated installation passed dependency installation, typecheck and units. |
| Real customer plug-in update | Created `customer_gain` with the actual 0.1.5 starter, customized its DSP, UI and owner identity, and changed the shared editor tokens. All customer files, the loader symlink and starter test survived unchanged. After updating, typecheck, **295 tests** (6 skips), and the custom plug-in runtime build passed. A separate customer scaffold edit produced an explicit conflict; its HEAD and customer files were preserved, with no automatic resolution. |
| Current export privacy | Scanned **294 entries**, including the generated manifest and in-boundary skill links. No detected credentials, maintainer paths/signing/device identifiers, or exact private source matches. The previously adjudicated private-project name remains only in the negative preset-identity fixture. |
| Fresh tool archive privacy | Both rebuilt archives passed targeted scans with zero findings. Existing customer history was preserved; historical non-secret metadata was not rewritten. |

Fresh tool hashes:

| Artifact | SHA-256 |
|---|---|
| `cmaj-macos-arm64.tar.gz` | `ff47c0f940abb586ae48fbcd5b774f0435177d3ed2c6dcb82c9fea97f003fd2b` |
| `CmajPlugin-macos-arm64.zip` | `409f5122622292d39230b33eade9504491df95718423ab4ae45fc918cb4f0b88` |

Machine-readable receipt: `build/release-020-qualification/qualification.json`. The artifact root, actual customer installations, native bundle, update hashes, deliberate conflict, and measured audio results are recorded there. Companion records are `export-audit.json`, `tool-artifacts.json`, and `tool-archive-privacy.json` in the same directory. Stage-specific logs carry the corresponding names. The initial all-stage harness hit an old/new module identity mismatch at the legacy fetch boundary; the update stage was resumed with the old helper in its own process and passed. These harness failures did not change customer code or bypass a gate.

## Customer release email

Store branch: **`codex/builder-kit-release-email-318e`**, commit **`8aab1b5`**, based on current store source `b16892f`. Worktree: `builder-kit-release-email-318e/song-machines`.

`npm run email:release` implements plan, enqueue, send, status, retry and reconciliation over the existing purchase SQLite/Blob ledger and Resend adapter. It sends the approved HTML and text templates, freezes the reviewed payload/sender, selects paid lifetime-entitled owners including guests, deduplicates by product/version/email, persists claims before HTTP, and checks publication before queuing or sending. Signed delivery events settle lost acknowledgements and suppress bounced/complained-about addresses without removing access. Unknown outcomes beyond the safe retry window are held rather than resent blindly.

The complete store suite passes **115 tests**, including **16 focused release-email tests**. Static validation and the deployment build also pass. These include the real SQLite and production Blob adapters against controlled persistence/HTTP fixtures and signed callbacks through the real endpoint: concurrency, lost acknowledgements, restarts, recipient exclusions, frozen retries, reconciliation and cancellation. The store's `docs/RELEASE-EMAIL.md` contains the exact operator sequence. Its rendered template source matches this release's approved `EMAIL.html`/`EMAIL.txt`.

No real provider send, production ledger mutation, callback registration or deployment was performed. Automated fixtures do not prove inbox delivery.

## Release-specific update instructions

Documentation commit **`9a24aa3e`** adds the 0.2.0 changelog's copyable update prompt, required compatibility work and optional adoption links. The update skill reads the target release's changelog before merging, including applicable skipped-version instructions. The email points customers to that section; its matching store-template commit is **`8546b13`**. No sender behavior or executable kit code changed.

The committed customer export includes the changelog section, discoverable skill, root update guide and every referenced API document; export boundary checks pass. The skill's YAML frontmatter parses successfully. The existing update-helper suite passes **14 tests**, and the sender suite with the revised templates passes **16 tests**. The export and template-equality receipt is `build/release-020-qualification/release-prompt-export.json`. This verifies the documentation follow-up; the full runtime/native results above remain attached to `d8c0f97d`, and production publication must restage the newer source.

## Remaining launch operations

1. Review the committed candidates, reconcile any newer integration-base changes, then publish through the existing release command at the approved production destination. Restage actual production URLs; do not upload the loopback qualification manifest as-is. Finalize the dated customer changelog and public release-notes page.
2. Deploy the reviewed store callback changes, configure the existing signed endpoint's delivery events, and verify one explicitly authorized operator email before the approved owner batch.
3. Complete the remaining launch-asset review/publication in the broader roadmap. This qualification does not claim the announcement video or public social copy was posted.

Use [RELEASE-AND-EMAIL.md](RELEASE-AND-EMAIL.md) for the release sequence and [AUDIT.md](AUDIT.md) for the historical audit. Earlier evidence remains attached to its named source; this record supersedes claims that final component integration/customer qualification or sender implementation is still unfinished.
