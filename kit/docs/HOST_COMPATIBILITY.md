# Generic CmajPlugin host compatibility

Use this reference when loading an effect through the generic `CmajPlugin` in a DAW. Dedicated production VST3 builds use `npm run fx:prod:build -- <alias>` and have separate identity and release checks.

## Supported JIT path

1. `npm run kit:setup` downloads and verifies the pinned `cmaj` and generic `CmajPlugin.vst3` payloads.
2. `npm run cmajplugin:install` installs that pinned generic VST3 and verifies the expected patched CHOC keyboard-bridge markers. Maintainers may instead build from the pinned source with `npm run cmajplugin:build` and explicitly install with `npm run cmajplugin:install -- --from-source`.
3. `npm run fx:jit:install -- <alias>` validates the effect with the verified `cmaj`, validates the installed generic VST3, and writes only its VST3 `CmajPlugin.json` association. It does not install or replace the loader and never touches an AU.

Only one generic VST3 association is active at a time. Use a dedicated production VST3 for final product identity, packaging, signing, distribution, and release qualification.

## Known AU failure

In the recorded Ableton Live 11.3.43/macOS 26.2 investigation, turning a WebView knob in the official generic `CmajPlugin.component` could crash in `JuceAU::audioProcessorParameterChanged -> sendValueChangedMessageToListeners -> PatchParameter::setValue`. The same effect-patch interaction did not reproduce in the official generic VST3. This is historical compatibility evidence, not proof that current upstream AU builds are fixed or that every VST3 path is safe.

The supported JIT installer targets VST3 only. Do not install or recommend the official generic AU for ordinary WebView knob testing; use it only for an explicitly scoped AU reproduction. Reproducing or repairing the AU notification failure requires its own current wrapper/host investigation.

## Keyboard bridge evidence

Binary marker validation rejects a known stale generic loader, but marker presence is not behavioral proof of native event ordering, modifier ownership, or Ableton forwarding. Keep host keyboard acceptance separate from build, signature, and plug-in discovery results. Product repositories may carry a focused investigation record for their pinned CHOC bridge and supported hosts.
