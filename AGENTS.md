# Cosimo Synth Notes

## iPhone Build And Install

- To build the installable iPhone app, build the `CosimoSynth_Standalone` scheme from `build/ios_device_run/CosimoSynthAUv3.xcodeproj`.
- Install `/Users/winterfell/src/cosimo-synth/build/ios_device_run/CosimoSynth_artefacts/Debug/Standalone/Cosimo Synth.app`.
- Do not install the `CosimoSynth` target output, `cosimo_ios_auv3_generated_plugin`, or anything under `generated/cmajor`. Those are intermediate build products, not the wrapper app bundle.

## Why This Matters

- The iPhone app assets are copied by the `POST_BUILD` step for `CosimoSynth_Standalone` and `CosimoSynth_AUv3` in `ios_auv3/CMakeLists.txt`.
- If someone builds the wrong target, the app bundle can be missing `assets/factory-bank-catalog.json` and `assets/factory_sources`, which breaks the UI on launch.

## Sanity Check Before Install

- The app bundle should contain:
- `Cosimo Synth.app/assets/factory-bank-catalog.json`
- `Cosimo Synth.app/assets/factory_sources/`
