---
name: make-plugin
description: Use when building the included Enhance That plugin, creating a new Builder Kit effect plugin, or changing one under fx/ — scaffolding, the fx:dev/fx:build loop, plugin state, presets and snapshots, plugin tests, JIT install into a DAW through the generic CmajPlugin, dedicated native builds and installs, and the per-plugin .plugin.json config.
---

# Make A Plugin

## Before You Start

The project must pass the readiness check in the Always list of
`kit/AGENTS.md`: strict doctor from the project root, and `kit:setup` only
when the doctor names it. `kit:setup` needs the customer's JUCE
acknowledgment; follow the rule for it in the root `AGENTS.md`. Never point a
build at a different `cmaj`: the pinned tool, the Cmajor source commit and the
generic `CmajPlugin.vst3` are pinned together.

## Included Enhance That, Unchanged

When the customer chooses to build the included plug-in as-is, use this short
route before reading the architecture guide. The included `enhancer-lite`
target carries its own identity, so template values in `product-owner.json` do
not block this route.

Do not copy, rename, create, or edit a plug-in or test. Do not make a browser
preview or source modification a prerequisite. From the ready project root run,
in order:

```bash
npm run typecheck
npm test
npm run fx:prod:build -- enhancer-lite
npm run fx:prod:install -- enhancer-lite
```

Stop on a failed command and explain the relevant recovery step. Do not change
authored source merely to complete the unchanged build. Read the architecture
guide only when the failure is relevant to that pipeline.

After success, keep the result brief:

```text
Enhance That is built and installed.
Installed at: <exact path printed by fx:prod:install>
```

You may add one short invitation for the customer's next change. Do not launch
a DAW, alter a session, start a tutorial, or claim listening/DAW acceptance.
Provide DAW help only when the customer requests it or reports a problem.

## Create Or Modify A Plugin

Adding or changing a plugin touches no shared file. Discovery scans `fx/*/`
for `.cmajorpatch` files, and each plugin's settings live beside its own
patch. If a change seems to need a central plugin list, it is wrong; read
`kit/docs/PLUGIN_ARCHITECTURE.md`.

Read first: `kit/docs/PLUGIN_ARCHITECTURE.md` for discovery, the loader and
the build pipeline; then the plugin's own directory (patch manifest,
`<PatchName>.plugin.json`, `state.ts`, `view/`). The included Enhance That is
the worked example; `fx/enhancer_lite/README.md` explains its state and Undo
behavior.

Before creating or distributing the customer's own plugin, replace the
template values in the root `product-owner.json` with the customer's real
identity; `kit:new` refuses to scaffold while any template value remains and
names each key to edit. The unchanged Enhance That route above does not need
this.

## Create A Plugin

```bash
npm run kit:new -- <name>
```

This writes `fx/<name>/`: the patch manifest, its DSP, `state.ts`, an
editable `view/source.tsx`, the `view/index.js` link to the shared loader, the
`.plugin.json` config and a starter test. The starter's `state.ts` declares
one `gain` parameter plus presets and snapshots, and its view shows a gain
control, `PresetBar`, `SnapshotBar` and Undo/Redo. Extend that declaration
for new controls; do not add a second parameter cache or Undo history. See
`kit/docs/PLUGIN_STATE.md`.

Confirm discovery with `node kit/fx/build-effect.mjs --targets`.

## Per-Plugin Config

`<PatchName>.plugin.json` sits beside the patch. `"schemaVersion": 1` is
required; every other field is optional and has a derived default, so set only
what the default gets wrong. The scaffold sets `stateSource` to
`fx/<name>/state.ts`, and the build generates the state worker from it; do not
also set `workerSource`. The optional `product` object holds the plugin's
identity; omitted keys derive from the plugin name and `product-owner.json`.
A malformed config, an unknown key, or a config without a matching patch stops
discovery with a message naming the file. Never hard-code identity in build
scripts or shared files. `kit/docs/PLUGIN_ARCHITECTURE.md` lists every field
and its default.

## Dev Loop

```bash
npm run fx:dev                # one Vite server for every plugin UI, port 5175
npm run fx:build -- <alias>   # self-contained runtime folder under build/fx/
```

- In a browser, open `http://127.0.0.1:5175/fx/<dir>/view/harness.html`.
- In a host, the shared loader loads the plugin's `view.devModule` from the dev
  server when that server is running and serves that exact module; otherwise
  it loads the packaged `app.js`.
- `fx:prod:build` strips `view.devModule`, so production builds never contact
  a dev server. Never work around the loader with plugin-specific loading
  code.

## Tests

- Every plugin change lands with focused tests; report them by name.
- Plugin tests live in `tests/`, named `test_<plugin>_*.mjs`. Run one with
  `node --test tests/test_<plugin>_state.mjs`.
- `npm test` runs every non-browser `test_*.mjs` under `kit/tests/` and
  `tests/`.
- Browser tests drive the built view with Playwright. Build first:
  `npm run fx:build -- <alias> && npm run test:browser`. Install Chromium
  once with `npx playwright install chromium`, only when a task needs browser
  tests.
- DSP tests are `.cmajtest` files under `tests/`; `npm run test:dsp` runs
  them with the pinned `cmaj` from `kit:setup`.
- Never weaken a failing assertion; strengthen or repoint it.

## JIT Install (Iterate Inside A DAW)

```bash
npm run kit:setup                  # downloads the pinned generic CmajPlugin.vst3
npm run cmajplugin:install         # installs it and verifies its signature
npm run fx:jit:install -- <alias>  # points the generic plugin at one plugin
```

`fx:jit:install` writes only the VST3 `CmajPlugin.json`. A plugin with a
`state.ts` or a worker builds its runtime and points the loader at that copy,
so rerun `fx:jit:install` after a DSP edit. UI edits reload live through
`fx:dev`.

## Production Build And Install

```bash
npm run fx:prod:build -- <alias>     # dedicated native plugin bundle under build/
npm run fx:prod:install -- <alias>   # copy the built VST3 into the user plugin folder
```

`fx:prod:build` builds the runtime without `view.devModule`, generates the
JUCE project with the pinned `cmaj`, builds it, and checks the patched CHOC
WebView markers. A missing or mismatched `cmaj` stops the build with a message
naming `npm run kit:setup`. The native build links JUCE; see
`THIRD_PARTY_NOTICES.md` for the license each product needs.
`fx:prod:install` copies an already-built `<productName>.vst3`; it never
builds, never writes `CmajPlugin.json` and never touches AU plugins. For a
release build, follow `kit/docs/RELEASE_VERIFICATION.md`.

## Presets And Snapshots

To add a preset bar, spread `presets({ factory })` and `snapshots()` into
`definePluginState` in `state.ts`, then render
`<PresetBar definition={definition} />` and `<SnapshotBar definition={definition} />`.
Recalling a preset or selecting a snapshot is one Undo entry. Mark a field that
is not part of the sound with `preset: false`. Details and the custom-interface
hooks: `kit/docs/PLUGIN_STATE.md`, "Presets and snapshots".
