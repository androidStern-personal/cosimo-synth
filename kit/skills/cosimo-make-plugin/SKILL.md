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
3. The plugin's own directory: patch manifest, `<PatchName>.plugin.json`
   config, `view/`; and the repository-root `product-owner.json` its identity
   derives from.

## Environment Check

Before the first build on a machine (or when a build fails to find `cmaj`):

```bash
npm run kit:doctor        # read-only report: tools, feed, registry, node_modules
npm run kit:setup -- --accept-juce-terms   # pinned cmaj + CmajPlugin.vst3, npm install
npx playwright install chromium            # once, before npm run test:browser
```

`kit:doctor` never writes (`--json`, `--strict`, `--offline` available).
`kit:setup` is idempotent: it downloads the hash-pinned tools named in
`kit/toolchain.json` from the feed in `kit/feed.json` into `build/kit-tools/`,
records the JUCE notice acknowledgment once, and runs `npm install` when
`node_modules` is missing (`--dry-run` plans without writing). Never install
or point the build at a different `cmaj`; the pin must match the Cmajor
source commit and the generic `CmajPlugin.vst3`.

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

One file beside the patch, `<PatchName>.plugin.json`, optional-field and
fail-closed:

- `"schemaVersion": 1` is required (a version newer than `kit/kit.json`
  supports fails discovery naming the fix: update the kit).
- Build settings: `alias`, `cmakeTarget`, `productName` (the install filename,
  `<productName>.vst3`), `runtimeOut`, `juceOut`, `workerSource`/`workerOut`,
  `includeInAll`, `disableMicrophonePermission`, `jitInstallRuntime`. Only set
  fields whose derived defaults are not right; a malformed, unknown-key, or
  orphan config fails discovery loudly.
- `product` — the plugin's identity: `productName`, `manufacturerName`,
  `bundleIdentifier`, 4-char `pluginCode`/`manufacturerCode`, `version`,
  optional `supportUrl` and wordmark/accent tokens. Every omitted key derives
  from the plugin name, the patch manifest, and the repository-root
  `product-owner.json` (`manufacturer`, `manufacturerCode`,
  `bundleIdentifierPrefix`, optional `pluginCodePrefix`/`supportUrl`). When
  the object is present (even empty) it is authoritative: the patch manifest
  must agree (drift fails discovery) and codes/bundle ids are
  collision-checked across every discovered plugin. When absent, the patch
  manifest is authoritative — nothing changes. Never hard-code identity
  values in build scripts or shared files.

`kit/docs/PLUGIN_ARCHITECTURE.md` lists every derivation.

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
- `npm test` runs the kit contract tests plus every plugin unit test; run it
  whenever a plugin touches preset, snapshot, or stored-state code, since the
  shared preset/snapshot suites are part of it. A single focused file runs
  with `node --test tests/test_<plugin>_state.mjs`.
- Browser view tests build the runtime first, then drive the packaged view
  with Playwright over the static test server:
  `npm run fx:build -- <alias> && npm run test:browser`. They need
  `npx playwright install chromium` once per machine.
- Never weaken a failing assertion; strengthen or repoint it.

## JIT Install (Iterate Inside A DAW)

```bash
npm run kit:setup            # downloads the pinned generic CmajPlugin.vst3
npm run cmajplugin:install   # install setup artifact + sign-verify + marker check
npm run fx:jit:install -- <alias>   # point the generic plugin at this plugin
```

`kit:setup` also downloads the prebuilt pinned `CmajPlugin.vst3` into
`build/kit-tools/`. Maintainers can explicitly use the source route with
`npm run cmajplugin:build` followed by
`npm run cmajplugin:install -- --from-source`.

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
the JUCE project from the runtime patch with the pinned `cmaj`
(`build/kit-tools/cmaj` from `kit:setup`, hash-checked against
`kit/toolchain.json`; a missing or mismatched tool fails with an error naming
`npm run kit:setup`), builds the `cmakeTarget`, and verifies the patched CHOC
WebView markers. The native build links JUCE: see `THIRD_PARTY_NOTICES.md`
for the per-product JUCE license requirement.
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
- Worked example — adopting the header as-is: `fx/enhancer_lite/view/source.ts`
  builds `createStandaloneEffectPresetController` (with the plugin-owned
  inventory in `view/factory-presets.js`) and `EffectSnapshotBankController`,
  hands both to `createEffectHeader()`, mounts the header above its own
  surface, and attaches/detaches them in `connectedCallback` /
  `disconnectedCallback`. Copy that wiring for a new plugin; the contract test
  `kit/tests/test_effect_factory_preset_contract.mjs` checks the inventory
  (every preset stores the complete, non-hidden parameter set).
- Worked example — how the Cosimo synth extends the kit (these files live in
  the Cosimo monorepo, not in the kit; read them as a pattern):
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
