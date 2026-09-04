# Internal iPhone device receipt — 2026-03-29

This is a historical, product-internal receipt from the iPhone build that entered repository guidance in `b03abe07`. It preserves a known-working machine procedure and identifiers for diagnosis. It is not current configuration: verify the paired device, signing team, certificate, profiles, paths, and bundle identities before reusing any value. This file is outside `kit/` and must not be included in a Builder Kit customer export.

## Recorded signing result

- Development team: `JUFVT28775`
- Automatic-signing identity selected by Xcode: `Apple Development: andrewstern@cox.net (28VA33X8SY)`
- `xcodebuild` destination identifier: `00008120-000139383644C01E`
- `devicectl` device identifier for the same recorded phone: `00C7F433-8B6A-5CAC-856F-56D7385E12F9`
- Provisioned bundle identifiers: `dev.cosimo.wavetable-synth` and `dev.cosimo.wavetable-synth.wavetable-synthAUv3`

The successful build command was:

```sh
xcodebuild -project build/ios_device_run/CosimoSynthAUv3.xcodeproj -scheme CosimoSynth_Standalone -configuration Debug -destination id=00008120-000139383644C01E DEVELOPMENT_TEAM=JUFVT28775 CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY='Apple Development' -allowProvisioningUpdates build
```

The successful install and launch commands were:

```sh
xcrun devicectl device install app --device 00C7F433-8B6A-5CAC-856F-56D7385E12F9 'build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app'
xcrun devicectl device process launch --device 00C7F433-8B6A-5CAC-856F-56D7385E12F9 dev.cosimo.wavetable-synth
```

Before reuse, regenerate/reconfigure the project from the current worktree, inspect current `xcodebuild`/`devicectl` inventories, validate the app and embedded AUv3 identities and resources, and confirm that the recorded product path still matches the selected configuration. Command success remains separate from UI readiness, AUv3 hosting, and listening acceptance.
