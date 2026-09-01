# Builder Kit Notes

Generic conventions for any repo built on the Builder Kit under `kit/`. Owner-, machine-, and synth-product-specific rules stay in the root `AGENTS.md`; nothing in this file may name a person, a machine, a signing identity, or a device.

## Architecture Pointers

- `kit/docs/PLUGIN_ARCHITECTURE.md` is the effect-plugin system reference: discovery registry and build sidecars, the shared view loader (including the production `devModule` strip), worker builds, generated runtime layout, and how to add a plugin.
- `kit/docs/RELEASE_VERIFICATION.md` is the product-neutral macOS release verification checklist (signing, notarization, packaging, install, and DAW smoke checks).
- `kit/skills/cosimo-make-plugin/SKILL.md` is the agent workflow for creating, building, testing, and installing a plugin.

## Canonical Plugin Commands

- `npm run kit:new -- <name>` scaffolds a new working plugin under `fx/<name>/` (stereo-gain patch + DSP example, build sidecar, `product.json` identity, view stub wired to the shared loader, starter test) and refuses names colliding with an existing directory, alias, pluginCode, or bundle identifier. Discovery picks it up; no shared file needs editing.
- `npm run fx:dev` starts the one shared Vite dev server for every effect plugin UI on port 5175. Do not add per-plugin dev servers or ports.
- `npm run fx:build -- <alias>` (or `-- all`) builds a plugin's self-contained runtime folder under `build/fx/`.
- `npm run fx:prod:build -- <alias>` builds the dedicated native plugin bundle under `build/`. It strips `view.devModule` from the runtime patch manifest for every plugin, so release builds contain zero dev-server behavior.
- `npm run fx:prod:install -- <alias>` copies an already-built dedicated VST3 bundle into the user plugin folder. It does not build, does not write `CmajPlugin.json`, and does not touch AU plugins.
- `npm run cmajplugin:build` and `npm run cmajplugin:install` build and install the patched generic `CmajPlugin.vst3` used for JIT development; the installer verifies the signature and the patched CHOC keyboard bridge markers.
- `npm run fx:jit:install -- <alias>` points the installed generic `CmajPlugin.vst3` at one plugin's patch for fast in-host iteration. It validates the patch and the installed generic plugin first, writes only the VST3 `CmajPlugin.json`, and never overwrites `CmajPlugin.vst3` or any AU loader.
- Plugin aliases come from discovery; `node kit/fx/build-effect.mjs --targets` lists them.

## Isolated Worktrees

- CMake dependency callers include `cmake/CosimoDependencies.cmake` and share the ordinary user-level CPM source cache across worktrees. Do not link dependency trees or provision a worktree-specific Cmajor checkout.
- The dependency module now lives at `kit/cmake/CosimoDependencies.cmake`; older references to `cmake/CosimoDependencies.cmake` predate the kit move and mean the same file.

## Dependency Pinning

- `cmake/CosimoDependencies.cmake` is the sole source-dependency seam for effect production builds, the desktop native wrapper, iOS AUv3, web/codegen builds, and the repo-built generic `CmajPlugin.vst3`. Plain CPM retrieves the exact private Cmajor commit recursively; that repository's private CHOC gitlink is the only CHOC version authority. The same module retrieves the exact production JUCE commit, while T26 explicitly selects its research-only JUCE 7.0.1 commit through a separate function in that module. All Cmajor/CHOC fixes are ordinary commits in those private repositories; do not patch or replace downloaded sources.
- Dependency pin bumps are ordinary edits to `kit/cmake/CosimoDependencies.cmake`. Never patch downloaded or generated sources in the consuming repo to work around an upstream issue.

## Definition Of Done

- Every plugin change lands with focused tests. Run the tests that cover the changed behavior before reporting done, and name them in the handoff.
- Never weaken a failing assertion to make a suite pass. When source moves, repoint the assertion at the new location with an equal-or-stronger check.
- Do not commit generated UI bundles beside plugin source (`fx/<name>/view/app.js`, `bundle.js`). Generated output belongs under `build/`.
- Adding a plugin must touch zero shared files: discovery scans `fx/*/` for `.cmajorpatch` files, and per-plugin build settings live in the plugin's own `<PatchName>.build.json` sidecar. A change that reintroduces a hand-written central plugin list is wrong.
- Build configuration fails closed: an orphan or malformed sidecar, a duplicate alias, an unresolvable build identifier, or a `product.json` defect (bad code/bundle-id shape, manifest drift, duplicated pluginCode or bundle identifier across plugins) must abort discovery loudly rather than being silently ignored. Absent `product.json`, the patch manifest is the identity authority.
- Kit modules under `kit/` stay generic: no product-specific imports, no personal identifiers, no machine paths. Product-specific behavior extends the kit through its documented extension seams (see `kit/docs/PLUGIN_ARCHITECTURE.md`).
- When a kit module still has pre-kit consumers importing its old path, leave a one-line re-export shim at the old path marked `kit re-export shim`, and never change generated-bundle module names or content as a side effect of a move.
