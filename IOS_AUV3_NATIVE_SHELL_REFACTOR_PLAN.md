# iOS AUv3 Native Shell Refactor

## Current Status

Completed on 2026-03-30.

What landed:

- `scripts/generate_ios_auv3_plugin.sh` now emits raw `cmaj generate --target=cpp` performer output instead of a generated JUCE plug-in shell.
- The repo now pins the Cmajor helper runtime, Cmajor API headers, COM headers, CHOC headers, and browser `cmaj_api` files under `ios_auv3/Vendor/cmajor/`.
- The iOS target now builds through `ios_auv3/Source/CosimoPluginMain.cpp`, which includes the raw generated performer and the pinned runtime instead of compiling generated `cmajor_plugin.cpp`.
- The bundle packaging step now copies real `patch_gui/`, `cmaj_api/`, `assets/`, and `WavetableSynth.iOS.cmajorpatch` files into the standalone app and AUv3 extension bundles.
- The visible WebView bridge keeps the full Cmajor `PatchWebView` protocol and now has a development-server loader with fallback to bundled files.
- The development workflow now includes `package.json` plus `ios_auv3/vite.config.mjs` so the editor can load `patch_gui` and `cmaj_api` from a live Vite server during development.
- The iOS build tests now freeze the new architecture instead of the old generated-header monkeypatching path.

What was verified:

- `uv run pytest -q tests/test_ios_auv3_build.py -k 'not host_smoke'`
- `uv run pytest -q tests/test_ios_auv3_build.py`

What remains intentionally unchanged:

- The runtime wavetable mip transport and large queue-size hack were left alone for a separate follow-up.

## Goal

Replace the current generated-and-patched Cmajor JUCE shell with a repo-owned iPhone shell while keeping:

- Cmajor as the source of DSP and patch metadata
- the current `patch_gui` JavaScript UI
- the current shared App Group wavetable-library flow
- the full JavaScript bridge protocol from Cmajor's `cmaj_PatchWebView.h`

Do not solve the large queue-size hack in this refactor. Leave it alone unless another step forces a minimal runtime adjustment.

## Design Boundary

After this refactor:

- `cmaj generate --target=cpp` is the source of the raw performer code.
- The repo owns the plug-in shell, editor, resource resolver, visible WebView bridge, and bundle packaging.
- The repo no longer rewrites generated JUCE helper headers after code generation.
- Debug development can point the editor at a live development server so JavaScript and HTML changes reload without rebuilding the plug-in.

## Milestone 1: Replace The Generator Contract

### Deliverables

- `scripts/generate_ios_auv3_plugin.sh` only:
  - validates inputs
  - runs `build_assets.py`
  - runs `cmaj generate --target=cpp`
  - writes the raw generated performer C++ output into the build folder
- A pinned repo-owned Cmajor runtime directory exists in the repo instead of depending on the generated JUCE helper output at build time.

### Acceptance Criteria

- Running the generator produces a raw C++ performer file and no generated JUCE plug-in shell files.
- The generator still rejects a missing patch file and still refuses unsafe output directories.
- The generated raw C++ file still exposes the shipping endpoint names, including:
  - `wavetablePosition`
  - `wavetableSelect`
  - `wavetableLoadBegin`
  - `wavetableMipFrame`
  - `wavetableUploadAck`
  - `wavetableMipRequest`

## Milestone 2: Add The Repo-Owned Cmajor Runtime Layer

### Deliverables

- A repo-owned runtime directory contains the Cmajor helper layer the app actually uses.
- The repo-owned runtime keeps:
  - `cmaj::Patch`
  - patch manifest support
  - generated C++ engine support
  - worker support
  - the browser-side `cmaj_api` modules
- The repo no longer includes or compiles the generated `cmaj_JUCEPlugin.h`.

### Acceptance Criteria

- The iOS target builds against repo-owned runtime files only.
- The runtime source tree is pinned and versioned in the repo.
- No build step patches vendored helper headers with search-and-replace edits.

## Milestone 3: Build The Repo-Owned Plug-In Shell

### Deliverables

- A repo-owned `juce::AudioProcessor` owns `cmaj::Patch`.
- A repo-owned editor owns the visible patch UI host.
- The shared-library installer and extension-unavailable screens are plain repo code, not injected into generated code.

### Acceptance Criteria

- The app and AUv3 still expose the same shipping plug-in identity:
  - product name `Cosimo Synth`
  - bundle id `dev.cosimo.wavetable-synth`
  - AUv3 subtype `CmDv`
  - manufacturer code `Manu`
- State save and reload still preserve patch parameter values across:
  - reload inside one host session
  - host relaunch
- The standalone app still shows the wavetable installer when the shared library is missing.
- The AUv3 extension still shows the "install in the standalone app first" screen when the shared library is missing.

## Milestone 4: Keep The Full Bridge Protocol

### Deliverables

- A repo-owned visible bridge host replaces generated `PatchWebView`.
- The host keeps the full bridge protocol from Cmajor's visible patch bridge instead of trimming it to only the methods the current UI uses.
- The bridge continues to support:
  - status requests and status listeners
  - endpoint events and listeners
  - parameter requests and listeners
  - parameter gesture start/end
  - stored-state operations
  - native-to-JS message delivery
  - JS-to-native message sending
  - resource reads
  - audio-data resource reads

### Acceptance Criteria

- The shipping `patch_gui` loads without code changes to its patch-connection contract.
- The browser-side `cmaj_api` utilities still back the piano keyboard and knob controls.
- The editor can open, close, and continue to respond to parameter changes and endpoint events.

## Milestone 5: Replace Resource Loading And Bundle Packaging

### Deliverables

- The app and extension bundle `patch_gui` and `cmaj_api` as normal files.
- A repo-owned resource resolver decides whether each path comes from:
  - the app bundle
  - the extension bundle
  - the shared App Group wavetable library
- Runtime resources are not embedded into the generated performer C++ file.

### Acceptance Criteria

- The runtime patch manifest still loads from the bundle.
- `patch_gui/index.ios.js` still loads from the bundle.
- `assets/factory-bank-catalog.json` and `assets/factory_sources/*` still resolve from the shared wavetable library when installed.
- The app and extension bundle layout both allow the patch UI to read the runtime catalog and source WAV files correctly.

## Milestone 6: Add Live UI Development

### Deliverables

- A development server workflow exists for the patch UI.
- Debug builds can point the editor at a live development URL without rebuilding the plug-in.
- The live path supports hot reload for JavaScript and HTML shell changes.

### Acceptance Criteria

- Starting the development server allows the open editor to pick up JavaScript module edits without rebuilding the AUv3 target.
- Stopping the development server falls back cleanly to the bundled UI.
- Release builds always load the bundled UI, never the development server.

## Milestone 7: Replace The Current Test Contract

### Deliverables

- The old tests that freeze generated-header monkeypatching are removed or replaced.
- New tests prove the shipping behavior instead of the implementation accident.

### Acceptance Criteria

- Automated checks prove:
  - raw C++ generation works
  - bundle resources are present
  - bundle and extension resource roots both load the runtime patch and UI files
  - the shared wavetable library helper still uses App Group storage and zip install
  - the host smoke test still discovers the AUv3, opens the editor, sends parameter changes, and restores state
  - the editor still fits inside phone and tablet viewports

## Hard Stop Conditions

Stop and fix the architecture before moving forward if any milestone would require:

- reintroducing generated-header search-and-replace patches
- weakening the host smoke tests
- dropping the full visible bridge protocol
- shipping a debug-only live-server path in release builds

## Copy Sources

These Cmajor pieces are expected to be copied or adapted into repo-owned code:

- raw performer from `cmaj generate --target=cpp`
- Cmajor runtime helpers from a pinned generated JUCE helper output:
  - `cmaj_Patch.h`
  - `cmaj_PatchManifest.h`
  - `cmaj_PatchHelpers.h`
  - `cmaj_GeneratedCppEngine.h`
  - `cmaj_AudioMIDIPerformer.h`
  - `cmaj_EndpointTypeCoercion.h`
  - `cmaj_PluginHelpers.h`
  - `cmaj_PatchWorker_QuickJS.h` or `cmaj_PatchWorker_WebView.h`
- browser-side helpers from `cmaj_api`:
  - `cmaj-patch-connection.js`
  - `cmaj-event-listener-list.js`
  - `cmaj-parameter-controls.js`
  - `cmaj-piano-keyboard.js`
  - `cmaj-midi-helpers.js`
  - `cmaj-patch-view.js`

These Cmajor pieces are reference material to copy from, not runtime dependencies to keep as generated build output:

- `cmaj_JUCEPlugin.h`
- `cmaj_PatchWebView.h`

## Explicit Non-Goal

Do not redesign the runtime wavetable mip transport in this refactor. If the queue-size issue still exists after the shell is repo-owned, keep it as a separately tracked follow-up instead of sneaking it into this milestone chain.
