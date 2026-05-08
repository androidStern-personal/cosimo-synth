# Cosimo Synth Notes

## iPhone Build And Install

- If `build/ios_device_run/CosimoSynthAUv3.xcodeproj` does not exist yet in the current worktree, generate it with `./scripts/generate_ios_auv3_xcode_project.sh build/ios_device_run`.
- The canonical shortcut for that step is `npm run ios:project`.
- To build the installable iPhone app, build the `CosimoSynth_Standalone` scheme from `build/ios_device_run/CosimoSynthAUv3.xcodeproj`.
- Install `build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app` from the current worktree.
- Do not install the `CosimoSynth` target output, `cosimo_ios_auv3_generated_plugin`, or anything under `generated/cmajor`. Those are intermediate build products, not the wrapper app bundle.

## iPhone UI Dev Server

- The only iPhone Vite dev server to use is `npm run ios:ui:dev`.
- The canonical iPhone frontend build command is `npm run ios:ui:build`.
- `ios_auv3/vite.config.mjs` is the single iPhone Vite config. It must serve `patch_gui/index.ios.html`, `patch_gui/index.ios-host.js`, and the live React module at `patch_gui/index.ios.js`.
- `ui/ios/runtime-shell.html` and `ui/ios/runtime-host.js` are the iPhone host source files. `ui/build.mjs --ios` generates `patch_gui/index.ios.html` and `patch_gui/index.ios-host.js` from them.
- The iPhone app bundle must only copy these `patch_gui` runtime files:
- `index.ios.html`
- `index.ios-host.js`
- `index.ios.js`
- `resource-client.js`
- `wavetable-worker.js`
- Do not copy the whole `patch_gui` directory into the iPhone app or AUv3 bundle.

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
- `WavetableSynth.cmajorpatch` and `WavetableSynth.iOS.cmajorpatch` are checked-in source files, not generated outputs. If the synth source list, worker path, or view entry changes, edit those manifest files directly.
- `patch_gui/desktop/index.js` is a stable loader. It must default to the local compiled bundle `./app.js` and must not be rewritten into a dev-server-only file by `ui/build.mjs`.
- The desktop native wrapper lives in `tools/desktop_native`.
- The canonical compiled desktop build command is `npm run desktop:native:build`.
- The canonical desktop HMR launcher command is `npm run desktop:native:dev`.
- If a task changes the desktop UI, the final delivery must include a running standalone dev app unless the user explicitly says not to launch it. Run `npm run desktop:native:dev` after the changes, confirm it starts `http://127.0.0.1:5174`, and confirm it launches `build/desktop_native/CosimoDesktopNative_artefacts/Release/Standalone/CosimoDesktopNative.app`.
- During desktop UI development, do not claim the standalone app is verified or ready for review unless `npm run desktop:native:dev` started a fresh Vite dev server for this repo, the wrapper was rebuilt against that dev server, and the standalone app was relaunched from that dev session.
- During desktop UI development, do not deliver the compiled standalone build as if it were the active development app. If the app is not running against the dev server with HMR, say that explicitly.
- Both commands call `./scripts/build_desktop_native.sh`, which writes to `build/desktop_native`.
- For any completed desktop synth feature, final delivery must include building and installing the current VST3 for Ableton unless the user explicitly says not to. Run `npm run desktop:native:build`, verify it installs `~/Library/Audio/Plug-Ins/VST3/CosimoDesktopNative.vst3`, and report that exact installed path. Do not treat tests plus generated UI bundles as delivered without this Ableton install step.
- `./scripts/build_desktop_native.sh` defaults to the compiled desktop UI. `npm run desktop:native:dev` now starts the desktop Vite server itself, rebuilds the wrapper in `dev-server` mode, and launches the standalone app against `http://127.0.0.1:5174`.
- The desktop native wrapper chooses `dev-server` mode by injecting `window.__COSIMO_DESKTOP_UI_SOURCE_MODE__` and `window.__COSIMO_DESKTOP_DEV_SERVER_ORIGIN__` from `tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp` before the loader runs.
- If `COSIMO_DESKTOP_UI_SOURCE_MODE=dev-server`, `./scripts/build_desktop_native.sh` must fail unless `http://127.0.0.1:5174/patch_gui/desktop/index.js` is reachable.
- `build_assets.py` only regenerates the derived wavetable runtime catalog `assets/factory-bank-catalog.json` from `assets/factory-table-catalog.json`. It must not rewrite either patch manifest.
- React Grab for the standalone HMR path lives in `ui/desktop/patch-view-entry.tsx`. In Vite dev mode it must import `react-grab` and `@react-grab/mcp/client`. The Codex MCP config should use `npx -y @react-grab/mcp --stdio`; do not wire the deprecated `@react-grab/codex` package into this repo.
- The standalone app only gets React Grab when it is running in `dev-server` mode against Vite. The compiled desktop bundle must not load React Grab.

## Desktop Plugin Keyboard Focus

- In Ableton, Cmajor's `WKWebView` can steal QWERTY Musical Typing input. The current viable pattern is a native pending buffer for original `keyDown:`/`keyUp:` `NSEvent` objects plus a document-start JavaScript keyboard router that decides whether ordinary DOM events are claimed by text entry/plugin shortcuts or forwarded to the host.
- Do not rely on `[NSApp currentEvent]` for JavaScript-requested forwarding. It races with `LeftMouseDragged`, `MouseMoved`, and `Pressure` events during active knob drags.
- Do not call `resignFirstResponder` on the `WKWebView`; previous Ableton testing showed direct and deferred calls can crash the host.
- Do not buffer `flagsChanged:` by default. Plugin shortcuts like `Cmd+C` or `Shift+A` should be handled from normal DOM `keydown`/`keyup` events with modifier flags; raw modifier-only native forwarding is unproven and polluted the pending buffer in the probe.
- Keep native forwarding hidden below a reusable platform adapter. Product UI code should use normal browser keyboard handling and call `event.preventDefault()` when it owns a shortcut; it should not call native host-forwarding APIs.
- `KEYBOARD_INVESTIGATION.md` is the current learnings document for this issue.

## Desktop CmajPlugin Ableton Parameter Safety

- In Ableton Live 11.3.43 on macOS 26.2, turning a WebView knob in the official generic AU loader `CmajPlugin.component` can crash in `JuceAU::audioProcessorParameterChanged -> sendValueChangedMessageToListeners -> PatchParameter::setValue`. This is a host parameter-notification crash, not a DSP crash.
- The official generic VST3 loader `CmajPlugin.vst3` did not reproduce that crash with the same OTT lab patch, but it does not contain the patched CHOC keyboard bridge. For fast Ableton lab testing, use the repo-built patched generic VST3 from `npm run cmajplugin:build` and `npm run cmajplugin:install`, then point it at one effect with `npm run fx:jit:install -- ott` or `npm run fx:jit:install -- chorus`.
- Do not install or recommend the official generic AU loader `~/Library/Audio/Plug-Ins/Components/CmajPlugin.component` for Ableton WebView knob testing unless the task is specifically to reproduce the AU crash.
- `scripts/install_fx_cmajplugin.sh` validates migrated effect patches such as OTT Lab and Chorus Lab, verifies that the installed generic `CmajPlugin.vst3` contains the patched CHOC keyboard bridge, and writes only the VST3 `CmajPlugin.json`. It does not install `CmajPlugin.vst3` and does not touch any AU loader.
- `scripts/ensure_cmajor_runtime.py` is the default Cmajor source provider for effect production builds, the desktop native wrapper build, and the repo-built generic `CmajPlugin.vst3`. It creates `build/deps/cmajor-1.0.3066-choc-1e79d904`, where Cmajor is pinned to `172db53232337154d5a1c0f9a448318129dfacd9` and `include/choc` is pinned to the patched CHOC commit `1e79d904209abd842d688433358f9e0df7d55454`.
