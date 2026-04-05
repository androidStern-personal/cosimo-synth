# Cosimo Synth Notes

## iPhone Build And Install

- If `build/ios_device_run/CosimoSynthAUv3.xcodeproj` does not exist yet in the current worktree, generate it with `./scripts/generate_ios_auv3_xcode_project.sh build/ios_device_run`.
- To build the installable iPhone app, build the `CosimoSynth_Standalone` scheme from `build/ios_device_run/CosimoSynthAUv3.xcodeproj`.
- Install `build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app` from the current worktree.
- Do not install the `CosimoSynth` target output, `cosimo_ios_auv3_generated_plugin`, or anything under `generated/cmajor`. Those are intermediate build products, not the wrapper app bundle.

## iPhone Signing

- The generated Xcode project does not set `DEVELOPMENT_TEAM`. A plain `xcodebuild` device build fails with `Signing for "CosimoSynth_AUv3" requires a development team.`
- On this machine, the working override is personal team `JUFVT28775` with automatic signing. The signing identity that Xcode actually used was `Apple Development: andrewstern@cox.net (28VA33X8SY)`.
- The exact device build command that succeeded from this worktree was:
- `xcodebuild -project build/ios_device_run/CosimoSynthAUv3.xcodeproj -scheme CosimoSynth_Standalone -configuration Debug -destination id=00008120-000139383644C01E DEVELOPMENT_TEAM=JUFVT28775 CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY='Apple Development' -allowProvisioningUpdates build`
- That command created development provisioning profiles for both bundle identifiers:
- `dev.cosimo.wavetable-synth`
- `dev.cosimo.wavetable-synth.wavetable-synthAUv3`
- The paired phone currently appears under two different Apple tool identifiers:
- `xcodebuild` destination id: `00008120-000139383644C01E`
- `devicectl` device id: `00C7F433-8B6A-5CAC-856F-56D7385E12F9`

## iPhone Install And Launch

- The install command that succeeded from this worktree was:
- `xcrun devicectl device install app --device 00C7F433-8B6A-5CAC-856F-56D7385E12F9 'build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app'`
- The standalone app bundle identifier is `dev.cosimo.wavetable-synth`.
- The launch command that succeeded was:
- `xcrun devicectl device process launch --device 00C7F433-8B6A-5CAC-856F-56D7385E12F9 dev.cosimo.wavetable-synth`

## Why This Matters

- The iPhone app assets are copied by the `POST_BUILD` step for `CosimoSynth_Standalone` and `CosimoSynth_AUv3` in `ios_auv3/CMakeLists.txt`.
- If someone builds the wrong target, the app bundle can be missing `assets/factory-bank-catalog.json` and `assets/factory_sources`, which breaks the UI on launch.

## Sanity Check Before Install

- The app bundle should contain:
- `Cosimo Synth.app/assets/factory-bank-catalog.json`
- `Cosimo Synth.app/assets/factory_sources/`

## Desktop UI Loading

- `WavetableSynth.cmajorpatch` must keep `view.src` set to `patch_gui/desktop/index.js`.
- `patch_gui/desktop/index.js` is a stable loader. It must default to the local compiled bundle `./app.js` and must not be rewritten into a dev-server-only file by `ui/build.mjs`.
- The standalone live dev app chooses `dev-server` mode by injecting `window.__COSIMO_DESKTOP_UI_SOURCE_MODE__` and `window.__COSIMO_DESKTOP_DEV_SERVER_ORIGIN__` from `tools/live_dev_plugin/Source/cmaj_PatchLoaderPlugin.cpp` before the loader runs.
- `scripts/build_live_dev_plugin.sh` must build the normal UI artifacts, then pass `COSIMO_DESKTOP_UI_SOURCE_MODE` into CMake. If that mode is `dev-server`, the script must fail unless `http://127.0.0.1:5174/patch_gui/desktop/index.js` is reachable.
- React Grab for the standalone HMR path lives in `ui/desktop/patch-view-entry.tsx`. In Vite dev mode it must import `react-grab` and `@react-grab/mcp/client`. The Codex MCP config should use `npx -y @react-grab/mcp --stdio`; do not wire the deprecated `@react-grab/codex` package into this repo.
- The standalone app only gets React Grab when it is running in `dev-server` mode against Vite. The compiled desktop bundle must not load React Grab.
