# Effect Plugin UI Architecture

This document describes the architecture for standalone effect plugin UIs under `fx/`.

OTT Lab and Chorus Lab follow this architecture.

## Goals

- Keep the preset system self-contained so future effect plugins can reuse it.
- Keep the A-G snapshot system for fast local experimentation in lab plugins.
- Use one Vite dev server for all effect plugin UIs.
- Keep Cmajor patch manifests stable between development and production.
- Do not commit compiled UI bundles beside source files.
- Make new effect plugins inherit the same build and dev behavior instead of adding new one-off scripts.

## Terms

An effect plugin is a standalone Cmajor effect under `fx/`, such as `fx/ott_lab`.

A patch manifest is the `.cmajorpatch` file that tells Cmajor which DSP source and UI entry file to load.

A view entry file is `view/index.js`. Cmajor loads this file first.

A view source file is `view/source.js`. This is the human-edited UI module for one plugin.

The shared effect view loader is one reusable JavaScript module that decides whether to load the Vite-served UI or the production UI.

A runtime folder is a generated self-contained copy of a plugin under `build/`. It is disposable output, not source.

## Source Tree Shape

Each effect plugin should follow this shape:

```text
fx/ott_lab/
  OttLab.cmajorpatch
  OttLab.cmajor
  view/
    index.js
    source.js
```

`view/index.js` should be a symlink to the shared effect view loader:

```text
fx/ott_lab/view/index.js -> ../../../ui/shared/effects/effect-view-loader.js
```

`view/source.js` is the actual plugin UI source. It can import shared preset modules and local lab UI code because Vite handles those imports in development and production builds.

The source tree must not contain generated UI bundles such as:

```text
fx/<plugin_name>/view/app.js
fx/<plugin_name>/view/bundle.js
```

## Patch Manifest

The patch manifest should keep one stable UI entrypoint:

```json
"view": {
  "src": "view/index.js",
  "devModule": "/fx/ott_lab/view/source.js",
  "width": 920,
  "height": 720,
  "resizable": true
}
```

`src` is the file Cmajor loads. It stays `view/index.js` in development and production.

`devModule` is custom effect-plugin metadata. It is the Vite-served source module path for this plugin. This is the only plugin-specific UI path that must be declared.

The dev server origin should not be repeated per plugin. All effect plugins use the same origin, for example:

```text
http://127.0.0.1:5175
```

## Development Flow

Development uses the patched generic `CmajPlugin.vst3` and one shared Vite server.

```text
Ableton
  -> patched CmajPlugin.vst3
  -> fx/ott_lab/OttLab.cmajorpatch
  -> view/index.js
  -> http://127.0.0.1:5175/fx/ott_lab/view/source.js
```

Cmajor still owns the patch connection, parameter messages, stored state, and DSP hot reload.

Vite owns TypeScript or module compilation, UI hot reload, and shared UI imports.

The shared loader should do this:

```text
1. Read patchConnection.manifest.view.devModule.
2. Try importing DEV_ORIGIN + devModule.
3. If that succeeds, return the Vite-served UI.
4. If the dev server is not reachable, import the production module next to the loader.
```

The default production module path is:

```text
./app.js
```

That file does not exist in the source plugin folder. It exists only in generated runtime folders.

## Production Flow

Production builds must not package the raw source plugin folder directly.

The build creates a generated runtime folder:

```text
build/fx/ott_lab_runtime/
```

That folder contains:

```text
build/fx/ott_lab_runtime/
  OttLab.cmajorpatch
  OttLab.cmajor
  view/
    index.js
    app.js
```

The build should materialize `view/index.js` as a real file in the runtime folder, not a symlink. The packaged plugin should be self-contained.

The build should write the compiled UI to:

```text
build/fx/ott_lab_runtime/view/app.js
```

Then Cmajor production packaging uses:

```text
build/fx/ott_lab_runtime/OttLab.cmajorpatch
```

not:

```text
fx/ott_lab/OttLab.cmajorpatch
```

## Shared Build Pipeline

All effect plugins should use one shared pipeline.

A small registry should describe available plugins. For example:

```js
export const effectPlugins = {
  ott: {
    patch: "fx/ott_lab/OttLab.cmajorpatch",
    runtimeOut: "build/fx/ott_lab_runtime",
    juceOut: "build/ott_lab_juce",
    cmakeTarget: "OTTLab",
    productName: "OTTLab",
  },
  chorus: {
    patch: "fx/chorus_lab/ChorusLab.cmajorpatch",
    runtimeOut: "build/fx/chorus_lab_runtime",
    juceOut: "build/chorus_lab_juce",
    cmakeTarget: "ChorusLab",
    productName: "ChorusLab",
  },
};
```

The build script can read `view.devModule` from each patch manifest, so the registry does not repeat the UI source path.

The canonical runtime build command should be one command with a plugin argument:

```text
npm run fx:build -- ott
```

It should:

```text
1. Read the selected plugin from the registry.
2. Parse the patch manifest.
3. Read view.devModule from the manifest.
4. Delete and recreate the runtime folder under build/.
5. Copy the Cmajor patch source files into the runtime folder.
6. Materialize the shared loader as runtime/view/index.js.
7. Run Vite with view.devModule as the entry.
8. Write the production UI to runtime/view/app.js.
```

The canonical production plugin build command should be:

```text
npm run fx:prod:build -- ott
```

It should:

```text
1. Run the runtime build above.
2. Use scripts/ensure_cmajor_runtime.py as the default patched Cmajor source.
3. Run cmaj generate --target=juce against the generated runtime patch.
4. Configure and build the generated JUCE project with CMake.
5. Verify the built binary contains the patched CHOC keyboard bridge.
6. Leave the dedicated plugin artifacts under build/.
```

The canonical production plugin install command should be:

```text
npm run fx:prod:install -- ott
```

It should copy an already-built dedicated VST3 bundle into:

```text
~/Library/Audio/Plug-Ins/VST3/
```

It does not build anything, does not write `CmajPlugin.json`, and does not touch AU plugins.

The canonical dev command should be:

```text
npm run fx:dev
```

It should start one Vite server for all effect plugin UIs at the shared origin.

The canonical patched generic plugin build command should be:

```text
npm run cmajplugin:build
```

It builds Cmajor's generic `CmajPlugin.vst3` from the same patched Cmajor source used by production effect builds.

The canonical patched generic plugin install command should be:

```text
npm run cmajplugin:install
```

It copies the already-built generic `CmajPlugin.vst3` into:

```text
~/Library/Audio/Plug-Ins/VST3/CmajPlugin.vst3
```

It signs the installed bundle, verifies the signature, verifies the patched CHOC keyboard bridge strings, and does not write `CmajPlugin.json`.

The canonical generic plugin install command should be:

```text
npm run fx:jit:install -- ott
```

It validates the source patch, confirms the installed generic `CmajPlugin.vst3` is signed and contains the patched CHOC keyboard bridge, and writes the VST3 patch association file:

```text
~/Library/Audio/Plug-Ins/VST3/CmajPlugin.json
```

For OTT, that file points the already-installed generic plugin at:

```text
fx/ott_lab/OttLab.cmajorpatch
```

That command is for development. It does not install or overwrite `CmajPlugin.vst3` and it does not touch AU plugins. Production plugin builds should use the generated runtime patch under `build/`.

## Why This Avoids The Current Problem

The old setup made Cmajor load checked-in generated files such as:

```text
fx/ott_lab/view/bundle.js
```

That creates two sources of truth:

```text
source UI
compiled UI
```

This architecture removes that split from the source tree.

In development, Cmajor loads a stable local loader and the loader imports Vite-served source.

In production, the build creates a self-contained runtime folder and puts the compiled UI there.

The source plugin folder stays clean.

## Adding A New Effect Plugin

To add a new effect plugin:

```text
1. Add the Cmajor patch files under fx/<plugin_name>/.
2. Add view/source.js as the editable UI module.
3. Add view/index.js as a symlink to the shared loader.
4. Add view.devModule to the patch manifest.
5. Add one entry to the effect plugin registry.
```

The plugin should not add its own build script, dev script, or generated UI bundle.

The shared pipeline owns those behaviors.
