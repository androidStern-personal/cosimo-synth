# Builder Kit Notes

Generic conventions for any plugin monorepo built on the Builder Kit under `kit/`. Owner-, machine-, and product-specific rules stay in the root `AGENTS.md`; nothing in this file may name a person, a machine, a signing identity, or a device.

## Architecture Pointers

- `kit/docs/PLUGIN_ARCHITECTURE.md` is the effect-plugin system reference: discovery registry and build sidecars, the shared view loader (including the production `devModule` strip), worker builds, generated runtime layout, and how to add a plugin.
- `kit/docs/RELEASE_VERIFICATION.md` is the product-neutral macOS release verification checklist (signing, notarization, packaging, install, and DAW smoke checks).
- `kit/skills/cosimo-make-plugin/SKILL.md` is the agent workflow for creating, building, testing, and installing a plugin.
- `THIRD_PARTY_NOTICES.md` at the repo root lists the third-party components a built plugin depends on and their license terms (JUCE in particular needs a license per closed-source product; the kit does not include one).

## Environment Setup

- `npm run kit:doctor` is the read-only environment and registry report: OS, architecture, and tool versions against `kit/toolchain.json`, the pinned `cmaj` and `CmajPlugin.vst3` at their local paths, feed reachability, plugin discovery, `node_modules`, and the JUCE acknowledgment. `--json` prints only the machine-readable block; `--strict` exits non-zero on any problem; `--offline` skips the feed probe. It never writes.
- `npm run kit:setup` prepares a machine: it shows the JUCE licensing notice and records acknowledgment (`--accept-juce-terms`, stored once under `build/kit-tools/`), downloads the hash-pinned `cmaj` and `CmajPlugin.vst3` archives from the feed (`kit/feed.json` base URL + `kit/toolchain.json` artifact paths), verifies their SHA-256 before extracting to `build/kit-tools/`, and runs `npm install` when `node_modules` is missing. It is idempotent; `--dry-run` prints the plan and writes nothing; `--force` re-downloads.
- Toolchain SHA-256 pins identify archives, not extracted executables. Setup records the verified archive identity plus a digest of the installed payload (files, permissions, and symlink targets). Doctor, setup, production builds, and installers share that verifier. Changed payloads and legacy hash-only receipts are stale; `kit:setup` repairs them by downloading the pinned archive again.
- `cmaj` is obtained only through `kit:setup` from the pinned toolchain. `fx:prod:build` resolves the verified installed payload at `build/kit-tools/cmaj` (a checkout that carries the Cmajor command-tool source may use its own pinned build when no pinned download exists) and otherwise fails with a clear error naming `npm run kit:setup`. A stale downloaded payload never silently falls back. Do not install a different `cmaj` and do not point the build at one: the pin, the Cmajor source commit in `kit/cmake/CosimoDependencies.cmake`, and the patched generic `CmajPlugin.vst3` must all match.
- Browser view tests use Playwright's bundled Chromium. Run `npx playwright install chromium` once per machine before `npm run test:browser`; `npm install` alone does not download the browser.

## Canonical Plugin Commands

- `npm run kit:new -- <name>` scaffolds a new working plugin under `fx/<name>/` (stereo-gain patch + DSP example, the single `<Name>.plugin.json` config whose `product` identity derives from the root `product-owner.json`, view stub wired to the shared loader, starter test) and refuses names colliding with an existing directory, alias, pluginCode, or bundle identifier. Discovery picks it up; no shared file needs editing.
- `npm run fx:dev` starts the one shared Vite dev server for every effect plugin UI on port 5175. Do not add per-plugin dev servers or ports.
- `npm run fx:build -- <alias>` (or `-- all`) builds a plugin's self-contained runtime folder under `build/fx/`.
- `npm run fx:prod:build -- <alias>` builds the dedicated native plugin bundle under `build/`. It strips `view.devModule` from the runtime patch manifest for every plugin, so release builds contain zero dev-server behavior.
- `npm run fx:prod:install -- <alias>` copies an already-built dedicated VST3 bundle into the user plugin folder. It does not build, does not write `CmajPlugin.json`, and does not touch AU plugins.
- `npm run cmajplugin:install` installs the pinned, setup-downloaded generic `CmajPlugin.vst3` used for JIT development and verifies the patched CHOC keyboard bridge markers. `npm run cmajplugin:build` plus `npm run cmajplugin:install -- --from-source` is the explicit maintainer fallback.
- `npm run fx:jit:install -- <alias>` points the installed generic `CmajPlugin.vst3` at one plugin's patch for fast in-host iteration. It validates the patch with setup's verified `cmaj`, never a global command, and validates the installed generic plugin first. It writes only the VST3 `CmajPlugin.json`, and never overwrites `CmajPlugin.vst3` or any AU loader. Maintainers may explicitly pass `--from-source` when this repo contains the command source project and its executable at `build/cmajor_command/bin/cmaj`.
- Customer `npm test` discovers `test_*.mjs` recursively under `kit/tests/` and `tests/`, excluding `_browser` tests. Newly scaffolded plugin tests need no shared-list edit. `npm run test:browser` runs the Playwright view tests against built runtimes (`fx:build` the plugin first); `npm run typecheck` runs `tsc --noEmit`.
- Plugin aliases come from discovery; `node kit/fx/build-effect.mjs --targets` lists them.

## Isolated Worktrees

- CMake dependency callers include `kit/cmake/CosimoDependencies.cmake` and share the ordinary user-level CPM source cache (`CPM_SOURCE_CACHE`, default `~/.cache/CPM`) across worktrees. Do not link dependency trees or provision a worktree-specific Cmajor checkout.
- Downloaded tools live under `build/kit-tools/` in each worktree; run `npm run kit:setup` in a fresh worktree rather than copying binaries between trees.

## Dependency Pinning

- `kit/cmake/CosimoDependencies.cmake` is the sole source-dependency seam for effect production builds and the repo-built generic `CmajPlugin.vst3`. Plain CPM retrieves the exact pinned Cmajor commit recursively; that repository's CHOC gitlink is the only CHOC version authority. The same module retrieves the exact pinned JUCE commit. Source URLs (and nothing else) live in `kit/cmake/dependency-sources.cmake`, which the kit export renders to point at the distribution feed. All Cmajor/CHOC fixes are ordinary commits in those repositories; do not patch or replace downloaded sources.
- Dependency pin bumps are ordinary edits to `kit/cmake/CosimoDependencies.cmake` and arrive with kit updates together with a matching `kit/toolchain.json`. Never patch downloaded or generated sources in the consuming repo to work around an upstream issue.

## Definition Of Done

- Every plugin change lands with focused tests. Run the tests that cover the changed behavior before reporting done, and name them in the handoff.
- Never weaken a failing assertion to make a suite pass. When source moves, repoint the assertion at the new location with an equal-or-stronger check.
- Do not commit generated UI bundles beside plugin source (`fx/<name>/view/app.js`, `bundle.js`). Generated output belongs under `build/`.
- Adding a plugin must touch zero shared files: discovery scans `fx/*/` for `.cmajorpatch` files, and per-plugin settings live in the plugin's own `<PatchName>.plugin.json` config (build settings plus the `product` identity object). A change that reintroduces a hand-written central plugin list is wrong.
- Build configuration fails closed: an orphan or malformed config, a `schemaVersion` newer than `kit/kit.json` supports, a duplicate alias, an unresolvable build identifier, or a `product` identity defect (bad code/bundle-id shape, manifest drift, duplicated pluginCode or bundle identifier across plugins, a derivation that needs a missing `product-owner.json`) must abort discovery loudly rather than being silently ignored. Absent a `product` object, the patch manifest is the identity authority.
- Kit modules under `kit/` stay generic: no product-specific imports, no personal identifiers, no machine paths. Product-specific behavior extends the kit through its documented extension seams (see `kit/docs/PLUGIN_ARCHITECTURE.md`). Kit updates replace `kit/` wholesale, so product code belongs in `fx/<plugin>/` and the root files, never inside `kit/`.
- When a kit module still has pre-kit consumers importing its old path, leave a one-line re-export shim at the old path marked `kit re-export shim`, and never change generated-bundle module names or content as a side effect of a move.
