---
name: cosimo-make-plugin
description: Use when creating a new Builder Kit effect plugin or working on an existing one under fx/ — scaffolding, the fx:dev/fx:build dev loop, plugin tests, JIT install into a DAW via the generic CmajPlugin, production native builds and installs, per-plugin build/identity config, or extending the shared preset-bar/snapshot UI system. Trigger for requests about adding an effect plugin, plugin build or dev-server issues, plugin registry/sidecar settings, or preset/snapshot UI extension points.
---

# Cosimo Make Plugin

## Core Rule

Adding or changing a plugin must touch zero shared files. The registry is
derived by scanning `fx/*/` for `.cmajorpatch` files; per-plugin settings live
beside the plugin's own patch. If a change seems to need editing a central
plugin list, the change is wrong — read
`kit/docs/PLUGIN_ARCHITECTURE.md` first.

## First Reads

1. `kit/AGENTS.md` for the plugin-repo conventions and definition of done.
2. `kit/docs/PLUGIN_ARCHITECTURE.md` for discovery, the loader, runtime
   layout, and build pipeline details.
3. The plugin's own directory: patch manifest, `<PatchName>.build.json`
   sidecar, `product.json`, `view/`.

## Create A Plugin

Use the scaffold:

```bash
npm run kit:new -- <name>
```

It generates `fx/<name>/` with the patch manifest (`view.src` set to
`view/index.js`), the `view/index.js` symlink to the shared loader
(`kit/ui/effects/effect-view-loader.js`), an editable view stub, the
per-plugin config files, and a starter test. Discovery picks the plugin up
immediately — confirm with:

```bash
node kit/fx/build-effect.mjs --targets
```

## Per-Plugin Config

Two files beside the patch, both optional-field and fail-closed:

- `<PatchName>.build.json` — build sidecar: `alias`, `cmakeTarget`,
  `productName`, `runtimeOut`, `juceOut`, `workerSource`/`workerOut`,
  `includeInAll`, `disableMicrophonePermission`, `jitInstallRuntime`. Only set
  fields whose derived defaults are not right; a malformed, unknown-key, or
  orphan sidecar fails discovery loudly.
- `product.json` — the plugin's identity: product/manufacturer names, bundle
  id, 4-char plugin/manufacturer codes, version, install filename
  (`outputFileName`), optional support URL and wordmark/accent tokens. When
  present it is authoritative: the patch manifest must agree (drift fails
  discovery), the sidecar must not also set `productName`, and codes/bundle
  ids are collision-checked across every discovered plugin. When absent, the
  patch manifest is authoritative — nothing changes. A multi-patch directory
  binds the file with its `patch` key. Never hard-code identity values in
  build scripts or shared files.

## Dev Loop

```bash
npm run fx:dev            # one shared Vite server for all plugin UIs, port 5175
npm run fx:build -- <alias>   # self-contained runtime folder under build/fx/
```

- In a host, the shared loader probes `/__fx-dev-status` and hot-loads the
  plugin's `view.devModule` from the dev server when it is running and serving
  that exact module; otherwise it loads the packaged `app.js`.
- In a browser, open `http://127.0.0.1:5175/fx/<dir>/view/harness.html` for
  the plugin's harness page.
- The loader only ever dev-loads when the manifest carries `view.devModule`;
  `fx:prod:build` strips that key, so production runtimes have zero dev
  behavior. Never work around the loader with plugin-specific loading code.

## Test Conventions

- Every plugin change lands with focused tests; name them in the handoff.
- Kit contract tests live in `kit/tests/` (loader, preset/snapshot systems,
  state contract, import graphs). Plugin-specific tests live in the repo's
  `tests/` directory, named `test_<plugin>_*.mjs`, run with `node --test`.
- Browser view tests build the runtime first, then drive the packaged view
  over the static test server, e.g.
  `npm run fx:build -- ott && node --test tests/test_ott_lab_view_browser.mjs`.
- Shared preset/snapshot behavior is covered by `npm run test:effect-presets`;
  run it whenever a plugin touches preset, snapshot, or stored-state code.
- Never weaken a failing assertion; strengthen or repoint it.

## JIT Install (Iterate Inside A DAW)

```bash
npm run cmajplugin:build     # patched generic CmajPlugin.vst3 from the pinned fork
npm run cmajplugin:install   # install + sign-verify + CHOC marker check
npm run fx:jit:install -- <alias>   # point the generic plugin at this plugin
```

`fx:jit:install` writes only the VST3 `CmajPlugin.json`. Targets with
`jitInstallRuntime` (worker plugins, or plugins whose source directory has no
loadable view entry) get their runtime built and pointed at instead of the
source patch. DSP edits hot-reload through Cmajor; UI edits hot-reload through
`fx:dev`.

## Production Build And Install

```bash
npm run fx:prod:build -- <alias>     # dedicated native plugin bundle under build/
npm run fx:prod:install -- <alias>   # copy the built VST3 into the user plugin folder
```

`fx:prod:build` builds the runtime with `view.devModule` stripped, generates
the JUCE project from the runtime patch with the pinned `cmaj`, builds the
`cmakeTarget`, and verifies the patched CHOC WebView markers.
`fx:prod:install` copies an already-built `<productName>.vst3`; it never
builds, never writes `CmajPlugin.json`, and never touches AU plugins. For
release-grade artifacts, follow `kit/docs/RELEASE_VERIFICATION.md`.

## Preset Bar And Snapshot Extension Points

The kit UI is extended by subclassing, not by editing kit modules:

- `StandaloneEffectPresetController` (`kit/ui/effects/standalone-effect-presets.ts`)
  exposes `protected` seams for host products: identity
  (`getUnnamedLabel`, `getUnnamedDirty`, `supportsInit`), sound-replacement
  deferral (`getPendingSoundReplacement`, `requestSoundReplacement`,
  `reapplyWithoutActivePreset`), edit tracking (`handleUnnamedParameterEdit`,
  `handleUnnamedStoredStateEdit`, `recordCleanCapturedPreset`), and
  apply/commit (`commitActivePresetAndApply`, `commitImportedPresetAndApply`,
  `attachStoredStateListeners`). The generic controller never defers a sound
  replacement and ships an empty factory-preset default; plugins pass their own
  `factoryPresets`.
- `PresetBar` (`kit/ui/effects/preset-bar.ts`) exposes overridable
  presentation hooks: `_prepareController`, `_hasOpenExtensionSurface`,
  `_closeExtensionSurfaces`, `_afterActionActivated`,
  `_syncExtensionSurfaces`, `_afterStateRender`, plus the shadow-DOM element
  cache (`_cacheElements`) for subclasses that inject extra chrome.
- Registration: a subclass registering first under the default element name
  (`cosimo-preset-bar`) is the intended composition — `definePresetBarElement`
  accepts an already-registered `PresetBar` subclass and throws on a foreign
  class. Element names (and the snapshot bank's stored-state key) are
  parameters with `cosimo-*` defaults; the `"cosimo.*"` wire-format kinds are
  shared exported constants.
- Worked example — how the Cosimo synth extends the kit:
  `SynthStandaloneEffectPresetController`
  (`ui/shared/effects/synth-standalone-presets.ts`) subclasses the controller
  to add its unnamed working sound, bounce/share transactions, and wavetable
  validation; `SynthPresetBar` (`ui/shared/effects/synth-preset-bar.ts`)
  subclasses the bar to prepend its shell cluster, Polish meter, share and
  bounce actions, and registers itself under the default element name via
  `defineSynthPresetBarElement` before any generic caller runs.
- The A–G snapshot system (`effect-snapshots.ts`, `effect-snapshot-bank.ts`,
  `snapshot-bar.ts`) follows the same pattern: `defineSnapshotBarElement` /
  `createSnapshotBar` take an element-name parameter, and lab plugins use it
  as-is.
- Keep generic cores generic: the import-graph tests
  (`kit/tests/test_standalone_preset_import_graph.mjs`) fail any kit module
  that imports product-specific code. Product behavior goes in the subclass.
