# Builder Kit Extraction Plan

Status: approved by Andrew 2026-08-31. Execution in progress on branch
`claude/builder-kit-extraction-arch-c93byl`.

Baseline: `origin/master@b1d5f5b`. The quality audit informing this plan was taken
at `7fc89fa`; 190 commits landed between the two, so every task must re-verify
audited file/line claims against the current head before editing.

## Architecture (decided)

Builder Kit is developed **in place** inside this monorepo under a top-level
`kit/` directory, and published to a separate private `builder-kit` repository by
an automated allowlist export. Customers receive a starter monorepo (kit export +
an editable Enhancer Lite plugin) and pull kit updates by git merge. Rationale,
alternatives, and the audit behind this are in the session record; the roadmap's
locked product requirements (`ENHANCER_LITE_BUILDER_KIT_ROADMAP.md` on
`codex/enhancer-lite-builder-kit-roadmap-cpm`) still govern the customer-facing
product. Root-level agent discovery works via committed relative symlinks
(`.agents/skills/<name> -> ../../kit/skills/<name>`); root `AGENTS.md` stays
owner-authored and directs agents to read `kit/AGENTS.md` fully.

Decisions from Andrew:

- Do NOT send Cmajor fixes upstream as PRs. Instead, when rebasing the private
  fork, check whether upstream already fixed the same issue and prefer their fix.
- All fixes to Cmajor/CHOC remain ordinary commits in the private forks with the
  pin bumped in `cmake/CosimoDependencies.cmake` (T69 rule). No patching of
  downloaded or generated sources in this repo.

## Already done on master (do not redo)

- **Latency root fix.** `f2bcc0d` fixed the fork generator, bumped the Cmajor pin
  (`f1c9a9a8` → `cb616bf1`), and deleted `replaceGeneratedPluginLatency` and the
  `generatedHostLatencySamples` registry field. The audit finding is resolved.
- **SeqFX release dev-path strip.** `b1d5f5b` added
  `createRuntimePatchManifest(..., { stripDevModule })`, currently hard-coded to
  seqfx behind an env key. Task 6 generalizes this.
- **SeqFX release tooling.** `scripts/build_seqfx_beta_release.mjs` and
  `scripts/seqfx-release-{config,toolchain}.mjs` now exist; the
  `cosimo-plugin-release` skill is no longer dangling (its personal signing
  identity and Patreon hard-coding remain a Phase 3 concern).

## Phase 1 — Toolchain root fixes

- [x] **1.1 Latency generator fix** — done on master (`f2bcc0d`), see above.
- [x] **1.2 Upstream check — DONE 2026-08-31.** Inspect the latest public
  `cmajor-lang/cmajor` release for (a) a fix to the JUCE-target latency
  generation, (b) movement on the WebView keyboard/user-files behavior our CHOC
  fork patches. Record findings in `PROGRESS.txt`. Informational only — it tells
  us how much fork diff a future rebase could shed. No upstream PRs.
- [x] **1.3 Consolidate the CHOC marker check — DONE 2026-09-01 (wave 2).** The same eight magic strings are
  checked in five places (`fx/prod-effect.mjs`, `scripts/install_fx_cmajplugin.sh`,
  `scripts/build_cmajplugin_vst3.sh`, `scripts/install_cmajplugin_vst3.sh`,
  `scripts/seqfx-release-config.mjs`) with at least two divergent
  implementations (`grep -a` vs `strings`). The pinned fork already guarantees
  the patched CHOC at source level, so the binary grep is a sanity check, not a
  gate: keep exactly one implementation in one shared module/script sourced by
  all callers, or delete it with a written rationale. Done when the strings
  appear in one place.

## Phase 2 — Cleanup in place

Each task lands with focused tests, per the repo's definition of done. Pure
JS/TS work; parallelizable across worktrees except where noted.

- [x] **2.1 One plugin registry — DONE 2026-09-01 (wave 2).** Plugin discovery becomes manifest-driven:
  scan `fx/*/` for `.cmajorpatch` (the dev server in `fx/vite.config.mjs`
  already proves the pattern); per-plugin build settings (cmakeTarget,
  productName, worker config, output dirs — derivable defaults with optional
  overrides) live in or beside the plugin's own manifest. Delete the other
  copies of the list: the `effectPlugins` object literal's hand-written portions,
  the `case` table + usage text in `scripts/install_fx_cmajplugin.sh`, its
  seqfx/polish special-case block, and the hard-coded inventory half of
  `tests/test_fx_build_args.mjs`. Fixes for free: enhancer/enhancer-lite become
  JIT-installable; the spectral JIT worker gap closes. Also resolve the
  two-manifests-in-one-directory ambiguity (`fx/enhancer_lite/` holds both the
  product patch and the shelves-audition patch; dev discovery picks whichever
  `readdir` returns first) — move the audition patch to its own directory or
  make selection explicit. Done when adding a plugin touches zero shared files
  and `npm run fx:build -- all`, `fx:dev`, and `fx:jit:install` all derive from
  the same source of truth.
- [x] **2.2 Harden the build scripts — DONE 2026-09-01 (wave 2).** In `fx/build-effect.mjs`:
  `normalizeRepoPath` must reject `..` segments (today a manifest `source` like
  `../../x` writes outside the runtime dir); validate registry-derived paths
  are non-empty and inside `build/` before any `rm -rf`; then delete the
  `runtimeSources` duplication (blocked on 2.5 moving Enhancer Lite's DSP files
  in-dir). Merge the two ~90%-identical Vite `build()` invocations. In
  `fx/vite.config.mjs`: reuse `ui/vite.shared.mjs` middleware instead of the
  two hand-rolled reimplementations, add path-containment to the harness-HTML
  handler, cache discovery instead of re-scanning per request. Same files as
  2.1 — run sequentially with it.
- [x] **2.3 View loader rewrite — DONE 2026-08-31 (wave 1).** `ui/shared/effects/effect-view-loader.js`:
  release builds must contain zero dev behavior — no `127.0.0.1:5175` probe, no
  code execution from a local port, no 500 ms startup stall, no `error.stack`
  rendered to end users, no repo-internal error copy. Generalize `b1d5f5b`'s
  `stripDevModule` to default-on for all `fx:build`/`fx:prod:build` runtime
  outputs (dev keeps it; remove the seqfx-only env special case). Dev-server
  loading becomes an explicit opt-in. Add tests for the prod path, the
  fallback, and both error views (currently 3 tests cover ~10 branches).
- [x] **2.4 Preset system sweep — DONE 2026-09-01 (wave 3).** Delete dead v1: `effect-preset-store.ts`,
  `use-effect-presets.ts`, `effect-preset-descriptors.ts`, the ~440 unreachable
  lines of `effect-preset-schema.ts` (salvage the shared types +
  `assertNoDuplicateJsonKeys` into a live module), and their tests
  (`test_effect_preset_state.mjs`, `test_effect_preset_schema.mjs`,
  `test_effect_preset_contract.mjs` — extract the two real checks: globally
  unique endpoint ids, hidden endpoints not preset-addressable). Split
  `standalone-effect-presets.ts` (2,091 lines, ~35% synth) into a generic
  preset controller and a synth adapter that owns bounce, sound-share,
  wavetable validation, `sourceMode === 1`, and the Cosimo factory-preset
  default (a plugin passing no `factoryPresets` must get an empty list, not
  chorus/OTT). Split `preset-bar.ts` (2,094 lines, ~31% synth): Polish meter,
  share links, bounce actions, compact-synth shell move behind an extension
  point the synth registers. Make custom-element names and the `"cosimo.*"`
  wire-format/storage prefixes configurable with the current values as
  defaults. Dedupe the five `isPlainObject`s, four `requireString`s, three
  stored-state envelope unwraps, two toasts. Synth behavior must be
  unchanged — the desktop suite is the gate.
- [x] **2.5 Enhancer Lite self-containment — DONE 2026-08-31 (wave 1), one deviation.** Move `cmajor/EnhancerLite.cmajor`
  and `cmajor/EnhancerLiteSpectrumAnalyzer.cmajor` into `fx/enhancer_lite/`
  (nothing else references them — verified, and
  `tests/test_enhancer_lite_state.mjs` asserts the non-coupling). Move
  `ui/shared/enhancer-lite-state.ts` into `fx/enhancer_lite/view/` and inline
  the six constants/types it imports from `ui/shared/enhancer-state.ts`.
  Update both patch manifests, the tests, and `tests/cmajor_enhancer_lite/`
  paths. Measurement scripts (`scripts/measure_enhancer_lite*.mjs`) stay
  Cosimo-private and unmoved.
- [x] **2.6 Test infrastructure — DONE 2026-08-31 (wave 1).** One static file server: keep
  `tests/helpers/static_web_server.mjs`, delete the duplicated server +
  MIME tables inside `desktop_harness_browser.mjs` and `live_review_server.mjs`
  (those two files otherwise stay, they are synth/speedrun tools). Port the
  four effect-plugin browser tests that spawn the desktop synth dev server
  (`test_enhancer_view_browser`, `test_enhancer_lite_view_browser`,
  `test_effect_preset_bar_browser`, `test_standalone_effect_preset_hook_browser`)
  to the static server like their four siblings. Promote a shared fake
  patch-connection test double (start from `ui/shared/patch-connection-mock.ts`
  if it fits; three tests currently hand-roll one) and parameterize
  `module_test_shell.html`'s hard-coded viewport. Fix `load_ui_module.mjs`
  cache key (missing `repoRoot`) and rejected-promise cache poisoning.
- [x] **2.7 Script hygiene — DONE 2026-08-31 (wave 1).** Add `npm run typecheck` (`tsc --noEmit`; fix
  cheap errors, record the rest in `PROGRESS.txt`), an aggregate `npm test`
  (node unit + browser groups; cmaj/native/python suites stay separate
  commands), and wire up or delete the ~39 test files reachable by no script.
  `tests/test_plain_cpm_dependencies.py`: drop the four tombstone
  file-absence asserts and the unrelated package.json probe; keep the
  single-resolver contract.

## Phase 3 — Restructure into `kit/`

Sequential, after Phase 2 lands.

- [ ] **3.1 The move.** Create `kit/` and move the curated survivors:
  `fx/*.mjs` pipeline + registry config, `cmake/CosimoDependencies.cmake` +
  `CPM.cmake`, `tools/{effect_plugin_build,cmajplugin_build,cmajor_runtime_build,cmajor_web_runtime}`,
  the generic `ui/shared/effects/` core + generic editor primitives
  (`cmajor-react`, `editor-tokens`, `editor-tick-slider`,
  `editor-curve-surface`, `editor-curve-geometry`, `patch-worker-services`,
  `stored-state-runtime-mirror`), kit test helpers + contract tests, the
  cmajplugin scripts. `tools/cmajor_external_codegen` stays (synth-coupled).
  Root gets committed relative symlinks `.agents/skills/<n> -> ../../kit/skills/<n>`.
  `AGENTS.md` splits: generic build/worktree/plugin conventions →
  `kit/AGENTS.md`; personal/machine facts (signing team, device ids, iPhone
  commands, synth specifics) stay in root `AGENTS.md`, which starts with
  "Read `kit/AGENTS.md` fully." Scrub personal identifiers (email, team id,
  device ids, `/Users/winterfell` paths) from everything under `kit/`.
- [x] **3.2 Scaffold — DONE 2026-09-01 (wave 4 stage D).** `npm run kit:new -- <name>` generates
  `fx/<name>/` with manifest, view stub wired to the loader, `product.json`,
  and a starter test. Registry is manifest-driven (2.1) so no other edits.
- [ ] **3.3 Kit docs and skills.** Rewrite `FX_PLUGIN_UI_ARCHITECTURE.md` as
  `kit/docs/` matching post-cleanup reality (audit found it ~75% accurate:
  wrong loader algorithm, 3-of-8 plugin coverage, undocumented worker/registry
  fields). Author kit skills: create/build/test/install/package a plugin.
  Genericize the release skill: extract the notarization verification
  checklist as a product-neutral doc; remove the personal signing identity,
  machine paths, and Patreon specifics from anything kit-side (the SeqFX
  release flow itself stays Cosimo-private).
- [x] **3.4 `product.json` identity — DONE 2026-09-01 (wave 4 stage D).** Per-plugin identity file driving
  product/manufacturer names, bundle id, 4-char codes, version, install
  filenames; validation + collision checks per the roadmap's locked BK-13
  contract.

## Phase 4 — Export and proof

- [ ] **4.1 Export job.** Allowlist export of `kit/` + root shims to the
  private `builder-kit` repo (filter, no rewriting), preserving per-path
  history. Leak gates that fail the export: any path outside the allowlist;
  forbidden strings (personal email, team id, device ids, `/Users/` paths);
  banned content classes (reference_labs, experiments, TODOS/PROGRESS,
  planning docs, Spectre material, factory assets).
- [ ] **4.2 Standalone proof.** CI job (or scripted check) that builds the
  exported kit + a fresh Enhancer Lite import alone in a clean container:
  manifest discovery, `fx:build`, unit/browser tests; on a Mac runner also
  `fx:prod:build`. This is the permanent boundary gate.
- [ ] **4.3 Customer starter.** Assemble kit export + Enhancer Lite + docs
  into the first customer repo; prove the "update my kit" merge flow against
  a starter with local plugin edits (clean merge, conflicting merge stops
  safely per the roadmap's locked update contract).

## Out of scope here (separate roadmap workstreams)

Host-automation/state migration, real AU, Developer ID signing/notarization,
naming, licensing (Gate 0), commerce. They run in parallel and gate selling,
not this extraction.

## Execution log

- **2026-08-31 wave 1** (commits `d99490d`, `e3bb13c`; verified green: `npm test`
  1086/1087 with one intentional corpus self-skip, all ported browser suites,
  `tsc --noEmit` unchanged at 27 pre-existing errors, none in touched files).
  - 1.2: upstream cmajor-lang/cmajor has NOT fixed the JUCE-target latency
    emission through 1.0.3177 (generator line unchanged since publication;
    latest release 1.0.3175; fork base 1.0.3066 is 57 commits behind). No
    upstream movement on the CHOC WebView keyboard/userFiles behavior either —
    both fork patches remain fork-only. Any fork rebase must carry the T72
    latency fix (`codex/t72-juce-declared-latency`) forward.
  - 2.3: loader production path proven zero-network/zero-timer by spy tests
    (12/12); error views show message-only neutral copy; packaged loader
    byte-exact in seqfx runtime.
  - 2.5 deviation: `cmajor/EnhancerLiteSpectrumAnalyzer.cmajor` was NOT moved —
    the synth now uses `wt::EnhancerSpectrumAnalyzer` (Polish meter +
    voice-enhancer spectrum, both synth manifests, polish tests). Analyzer
    ownership must be resolved in task 3.1 boundary work: either the synth gets
    its own processor or the analyzer joins the kit surface.
    `scripts/measure_enhancer_lite_shelves.mjs` intentionally keeps old paths
    (reads a pinned historical checkpoint via git show).
  - 2.6: shared static server gained fallback roots, lazy `/cmaj_api` mount
    (fixes container runs that cannot clone the private fork eagerly), and
    opt-in esbuild TS bundling mirroring Vite dev; four effect browser suites
    ported off the desktop synth server; `tests/helpers/patch_connection_mock.ts`
    added (Node adoption for the three hand-rolled fakes deferred to the preset
    wave — the mock extends HTMLElement at module scope).
  - 2.7: root `npm test` aggregate + `typecheck` added; 36 of 38 orphan test
    files wired; left unwired deliberately: `tests/test_claude_session_start.mjs`
    (stale expected git-config key count, hook now emits 3) and
    `tests/test_key_track.mjs` (3 subtests fail against current head — product
    question). 27 typecheck errors recorded (bounce/*.mjs missing declarations,
    DesktopPatchView sourceSlot union, sound-share-link lib types).

- **2026-09-01 wave 2** (commit `d67bdc0`; verified green: `npm test` 1097 tests,
  typecheck unchanged at 27 pre-existing errors, 60/60 effect browser suites,
  seqfx release drift gate passing; 9 macOS-environment-bound release subtests
  fail identically at baseline).
  - 2.1: registry derived by scanning `fx/*/` for every `.cmajorpatch` with
    optional `<PatchName>.build.json` sidecars (eight added, pinning all current
    aliases/targets/names); dev server, JIT installer, and both pipelines share
    the discovery; derived registry proven deep-equal to the old literal.
    Adversarial review caught and fixed: the enhancer family needed
    `jitInstallRuntime: true` (their source dirs carry no `view/index.js`);
    orphan sidecars and `workerOut`-without-`workerSource` now fail discovery
    closed; sidecar `cmakeTarget`/`productName` are identifier-shaped so no
    separator can reach install paths or cmake args.
  - 2.2: escaping manifest entries are auto-flattened with collision checks
    (replaces the hand-kept `runtimeSources` tables, deleted); output dirs
    validated inside `build/` before any `rm -rf`; dev-status leaks
    (repoRoot/pid) now loopback-only; harness handler rejects out-of-repo paths.
  - stripDevModule: `fx:prod:build` strips `view.devModule` for EVERY plugin;
    plain `fx:build` keeps it; the seqfx env key now only controls source maps.
  - 1.3: one CHOC marker implementation (`scripts/check_choc_markers.mjs`)
    consumed by prod-effect, both seqfx release scripts, and the three shell
    scripts.
  - Surface changes to know about: `/__fx-dev-status` names plugins by registry
    alias (was directory name); `all` builds in stable sorted order; installer
    `--help` exits 0.

- **2026-09-01 wave 3** (commits `d49a571`..`78634db`; verified green: `npm test`
  1095/0 with one intentional skip, typecheck pinned at the 27-error baseline,
  65/65 focused preset/snapshot suites, targeted synth gate 14/14, seqfx 80/81
  with only the known Linux font-metric failure, `fx:build all` clean, diff maps
  1:1 to stage reports, wire formats byte-identical to baseline).
  - Dead v1 preset system deleted (~3,000 lines incl. tests of dead code); live
    v1 symbols salvaged into `effect-preset-shared.ts` (audit missed one
    consumer: `sound-share-envelope.ts`). Chorus/OTT factory presets moved
    verbatim into `fx/{chorus_lab,ott_lab}/view/factory-presets.js`; the
    controller's factory default is now empty.
  - `standalone-effect-presets.ts` split: generic core + `synth-standalone-presets.ts`
    (sound transactions, bounce, share, wavetable validation, sourceMode check).
    `preset-bar.ts` split: generic bar + `synth-preset-bar.ts` subclass (Polish
    meter, share, bounce, compact shell). Extensibility mechanism = subclass +
    overridable presentation hooks — Andrew approved the mechanism-agnostic
    requirement ("just that it is extensible"); hooks must be documented in 3.3.
  - Import-graph tests keep both generic cores free of synth/bounce/share
    imports; element names and storage prefixes configurable, defaults
    unchanged; helpers deduped (`effect-utils.ts`, `effect-toast.ts`, one
    stored-state envelope unwrap). Registration guards added (foreign-class tag
    collisions throw).
  - Visible change (plan-sanctioned, owner-accepted): plugin preset bars render
    5 action buttons instead of 6 — the permanently-disabled Share button is
    synth-only now.
  - MUST RUN ON A FORK-CAPABLE MACHINE before calling the wave fully closed:
    `node ui/build.mjs --desktop` (patch_gui/desktop/app.js is stale — it was
    already stale at wave start from master commit 5237e30), then
    `npm run test:desktop:ui` plus the sound-share/bounce-ui browser suites.
    This container cannot clone the private cmajor fork (add_repo approval
    pending), so the desktop vite shards were replaced by the targeted 14/14
    synth gate.
  - Process note: an interrupted agent git-stash cycle nearly lost the wave;
    work was recovered from stash@{0} and agents are now forbidden from
    stash/checkout/reset — baselines are read via `git show` instead.

- **2026-09-01 wave 4, stage D (3.2 + 3.4)** — scaffold command and
  `product.json` identity. (Stages A–C — the kit/ moves, shims, docs, and
  skills — are summarized in their WIP commits pending the wave-4 closing
  entry.)
  - 3.4: optional per-plugin `product.json` beside the patch (names, bundle
    identifier, 4-char codes, semantic version, `outputFileName`, optional
    supportUrl/wordmark/accentColor; `patch` binder for multi-patch
    directories). Discovery validates it fail-closed (shape checks; wordmark
    existence; manifest drift; sidecar `productName` conflict) and derives the
    manifest-facing identity that the build writes into runtime manifests.
    Bundle ids and pluginCodes are collision-checked across ALL discovered
    plugins (manifest-only ones included); duplicates fail discovery naming
    both patches. Only `fx/enhancer_lite/` carries one (values mirror its
    manifest; sidecar `productName` moved into it); the enhancer-lite runtime
    output is proven byte-identical to the pre-change build. Absence of
    `product.json` = the patch manifest stays authoritative (documented in
    `kit/docs/PLUGIN_ARCHITECTURE.md`).
  - 3.2: `npm run kit:new -- <name>` (`kit/scripts/new_plugin.mjs`) scaffolds
    a working stereo-gain plugin: patch manifest + `.cmajor` example, build
    sidecar, `product.json`, `view/index.js` symlink to the kit loader,
    `createPatchView` TS view stub, starter test
    `tests/test_<name>_state.mjs`, then prints next steps. Refuses colliding
    directories/aliases/pluginCodes/bundle ids
    (`collectEffectIdentityClaims`). Smoke-proven end to end: scaffold
    `demo_verb`, `fx:build -- demo-verb`, starter test 2/2, full removal,
    `fx:build -- all` clean, typecheck still at the 27-error baseline.
  - Gates: `node --test tests/test_fx_build_args.mjs` 48/48 (new product.json
    validation/collision/scaffold coverage), `npm test` green, typecheck 27
    pre-existing errors, enhancer-lite runtime hashes unchanged.
