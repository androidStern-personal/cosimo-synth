# Builder Kit changelog

Each release lists what was added, changed and removed, what is known not to
work yet, and how to update. [Compatibility](docs/COMPATIBILITY.md) explains
what a version number promises.

## 0.2.0 — Plugin state, Undo, presets and controls

### Added

- **Plugin state.** Declare each control and piece of custom data once in
  `state.ts` with `definePluginState`, `parameter`, `storedValue` and
  `preparedState`. The build generates the worker that owns and saves that
  state, and every open plugin window connects to it. See
  [Plugin state](docs/PLUGIN_STATE.md).
- **Undo and Redo.** One history covers parameters and custom data. A drag of
  one control is one entry, `edit(...)` groups several fields into one entry,
  and `beginGesture(keys)` makes a drag that moves several fields one entry.
  `usePluginHistory` drives Undo and Redo buttons.
- **Presets and snapshots as state.** Spread `presets()` and `snapshots()` into
  the declaration and render `PresetBar` and `SnapshotBar`. `presets({ initial })`
  names the preset a new instance starts from. Recalling a preset or selecting a
  snapshot is one Undo entry, and so is loading a pasted preset file as the
  sound. Library operations (saving, renaming, deleting a preset; clearing a
  snapshot slot) are not Undo entries. `usePresets` and `useSnapshots` serve
  custom interfaces.
- **Field status.** Each field reports `loading`, `invalid`, `unavailable`,
  `updating` or `idle`, with one current error and a retry action. Values stay
  editable while they save.
- **Shared audio data.** `preparedState` and `sharedData` prepare large data,
  such as curves or tables, straight into memory the audio engine reads. The
  build generates matching Cmajor readers. See
  [Shared audio data](docs/SHARED_DATA.md).
- **Native settings.** `nativeValue` and the `Native` codecs pass typed values
  to custom C++ code, with generated readers.
- **Custom deliveries.** Give `preparedState` a `PluginStateDelivery` as its
  `engine` to deliver a field to the audio engine your own way. Write one from
  the public types `PluginStateDelivery`, `PluginStateDeliveryContext`,
  `PluginStateDocumentContext`, `PluginStateEffect`, `PluginStateSubmission`
  and `PluginStateDeliveryOutcome`. See
  [Custom delivery](docs/PLUGIN_STATE.md#custom-delivery), which walks through
  a step sequencer's pattern upload.
- **Controls.** `Knob`, `Slider`, `FilterEditor` and the `Mseg` editor, each
  usable whole or assembled from parts with your own artwork. See
  [Knobs](docs/KNOBS.md), [Sliders](docs/SLIDERS.md),
  [Filters](docs/FILTERS.md) and [MSEG](docs/MSEG.md).
- **Control gallery.** `npm run ui:docs:dev` opens working previews of every
  control beside its source.
- **`UndoHistory`**, the history bookkeeping on its own, for code outside the
  state framework.
- **Guides.** `kit/AGENTS.md` sends a coding agent to the right guide for each
  task. Every control has a guide and an API page, and
  [Compatibility](docs/COMPATIBILITY.md) explains what a version promises.

### Changed

- **The public API is the list in `kit/index.ts`.** Import only from
  `kit/index`. Paths under `kit/ui` are internal and may change in any release.
- **One plugin config file.** A plugin is configured only by
  `<PatchName>.plugin.json` beside its patch. `npm run kit:new` writes one.
- **Environment overrides.** `BUILDER_KIT_CMAJ` names another `cmaj`,
  `BUILDER_KIT_CMAKE` another `cmake`, and `BUILDER_KIT_PLUGIN_JOBS` and
  `BUILDER_KIT_CMAKE_JOBS` set build parallelism.
- **Renamed.** `EditorTickSlider` is now `Slider`, and its prop and type
  names changed to match; see [Sliders](docs/SLIDERS.md). The browser preview
  parameter type `EffectParameterContract` is now `BrowserPreviewParameter`,
  with the same fields. Gesture callbacks are `onGestureStart` and
  `onGestureEnd` on every control.
- **Pinned tools.** This release pins new `cmaj` and `CmajPlugin.vst3`
  downloads. `npm run kit:setup` fetches them when strict doctor reports a
  mismatch.
- **`npm run fx:dev` listens on `127.0.0.1` only.**
- **A state update carries only the fields that changed.** Opening a plugin
  window still receives the whole state; turning a knob sends that one field.
- **The project `package.json`** is named `builder-kit-project` and requires
  Node 22 or newer.
- **Tools for publishing the kit itself are no longer shipped.** The kit now
  holds only what a plugin project uses.

### Removed

- **Old preset, snapshot and header code.** `kit/ui/effects/` is gone: the
  preset and snapshot stores, preset bar, snapshot bar, effect header, toast,
  browser-preview helpers and `effect-view-loader.js`. Presets and snapshots
  are now plugin state (see Added), and the view loader is
  `kit/ui/view-loader.js`.
- **Shared editor tokens.** `kit/ui/editor-tokens.css` and `editor-tokens.ts`
  are gone. Each control carries its own stylesheet (`knob.css`, `slider.css`,
  `filter-editor.css`, `mseg.css`, `preset-bar.css`, `snapshot-bar.css`); style
  your plugin in its own CSS.
- **Replaced controls.** `editor-tick-slider` (now `Slider`) and
  `filter-range-editor` (now `FilterEditor`), plus internal helpers
  (`curve-lab`, `analyzer-activity`, `enhancer-spectrum`, `user-edit-bus`,
  `patch-worker-services`, `stored-state-runtime-mirror`).
- **`effectPlugins` from `kit/fx/build-effect.mjs`.** Call `getEffectPlugins()`
  instead; discovery now runs when you ask for it.
- **Kit publishing tools** (`export_kit.mjs`, the `cosimo-make-plugin` skill,
  CmajPlugin build and install scripts, `CosimoDependencies.cmake`) and the
  kit's own tests for the removed code.

### Known issues

- Shared audio data in a browser needs a cross-origin isolated page (COOP and
  COEP headers). `npm run ui:docs:dev` sends them; `npm run fx:dev` does not.
- Builder Kit runs on Apple silicon Macs with macOS 15 or newer, and builds
  VST3 plugins only.

### Update instructions

Copy this prompt into your coding agent:

> Update Builder Kit to 0.2.0 using the kit-update skill. Follow this release's Update instructions in the target release's kit/CHANGELOG.md before merging. Preserve my plugin changes and check that my plugins still build. Then tell me which of the new state, Undo, preset and control features apply to my project.

Take the new lockfile and tool pins through the normal merge, run `npm ci`,
then run `npm run kit:setup` when strict doctor reports a tool mismatch.

Then fix each plugin you made with `npm run kit:new` on 0.1.x:

1. Re-point its view loader:
   `ln -sfn ../../../kit/ui/view-loader.js fx/<plugin>/view/index.js`.
2. In its view, import `BrowserPreviewParameter` instead of
   `EffectParameterContract` (same fields).
3. In its starter test `tests/test_<plugin>_state.mjs`, replace
   `const { effectPlugins } = await loadDiscovery();` with
   `const effectPlugins = (await loadDiscovery()).getEffectPlugins();`, and
   compare `view/index.js` with `kit/ui/view-loader.js` instead of
   `kit/ui/effects/effect-view-loader.js`.
4. If you edited `kit/ui/editor-tokens.css`, the merge stops on it because
   0.2.0 deletes that file. Copy your values into your plugin's own CSS, then
   accept the deletion with `git rm kit/ui/editor-tokens.css`.

Finish with `npm run typecheck` and `npm test`; both must pass.

## 0.1.5 (2026-09-09) — First release

Guided setup into the Documents folder, a first-task choice, a tracked
dependency lockfile, and an update flow that preserves local plugin edits.
