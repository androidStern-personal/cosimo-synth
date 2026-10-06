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
- **The project `package.json`** is named `builder-kit-project` and requires
  Node 22 or newer.
- **Tools for publishing the kit itself are no longer shipped.** The kit now
  holds only what a plugin project uses.

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

## 0.1.0 (2026-10-04) — First release

Guided setup into the Documents folder, a first-task choice, a tracked
dependency lockfile, and an update flow that preserves local plugin edits.
