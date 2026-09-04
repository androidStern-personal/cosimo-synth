# iPhone and AUv3 build workflow

Use this reference for the Cosimo iPhone UI, standalone app, AUv3 extension, signing, and device work. Device installation and launch require separate authority from source/build work.

## UI and project entrypoints

- `npm run ios:ui:dev` is the iPhone Vite entrypoint; `ios_auv3/vite.config.mjs` serves the authored host and the live React module.
- `npm run ios:ui:build` generates the iPhone runtime from `ui/ios/runtime-shell.html`, `ui/ios/runtime-host.js`, and the React entry.
- `npm run ios:project` configures `build/ios_device_run/CosimoSynthAUv3.xcodeproj`. Reconfigure rather than treating project-file existence as proof that it is current.
- Build the `CosimoSynth_Standalone` scheme for the installable app. Files under `generated/cmajor` and generated performer/library targets are intermediates, not installable products.

The app and extension package exactly these generated `patch_gui` runtime files: `index.ios.html`, `index.ios-host.js`, `index.ios.js`, `resource-client.js`, and `wavetable-worker.js`. `ios_auv3/CMakeLists.txt` clears the runtime destination and copies that allowlist; do not copy the whole desktop/runtime tree.

## Validate before any install

Use the app produced by this worktree at `build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app`. Before contacting a device, verify the app and embedded AUv3 have the expected bundle identities, signatures, executables, and runtime files. The standalone app must also contain a valid `assets/factory-bank-catalog.json` and its referenced files under `assets/factory_sources/`.

This gate preserves the original March 2026 failure: selecting an intermediate or wrong target produced an app without factory resources, and the UI failed on launch. Directory existence alone is weaker than validating the catalog and every referenced asset. `tests/test_ios_auv3_build.py` and `scripts/run_ios_auv3_host_smoke.py` cover simulator packaging; they do not prove current device signing or physical acceptance.

## Signing, install, and launch

The generated Xcode project does not choose a development team. A plain device build can fail with `Signing for "CosimoSynth_AUv3" requires a development team.` Supply the currently selected team at build time and let Xcode perform automatic signing.

Resolve the intended paired device from current machine-readable `xcodebuild` and `devicectl` inventories. Their identifiers for one phone may differ, so correlate deliberately and fail on ambiguity. Derive the launch bundle identifier from the validated built app rather than duplicating it in instructions.

Install only the validated app from this build, then launch that installed identity and report install, process launch, UI readiness, AUv3 hosting, and listening as distinct results. The exact 2026-03-29 signing/device/install procedure from `b03abe07` remains in [`IOS_DEVICE_RECEIPT_2026-03-29.md`](IOS_DEVICE_RECEIPT_2026-03-29.md). Verify every value before reuse; it is historical evidence, not confirmed current state.

There is no single production `ios:device` command yet. Project generation, signing selection, bundle validation, install, launch, and UI readiness remain separate steps; do not claim that source or simulator tests complete the physical-device gate.
