# Cosimo Synth agent guide

## Always

- Preserve the user's work and task ownership. Inspect Git state before editing; work only in the assigned worktree and scope; never discard, stash, reset, reformat, or overwrite unrelated changes.
- The active integration coordinator owns rebases, merges to `master`, pushes, deployments, and the integration queue unless that authority is explicitly delegated. Keep source review, automated qualification, installed-host proof, listening acceptance, and physical-device acceptance as separate results.
- Treat fixed ports, native build directories, generated artifacts, installed plug-ins, devices, DAWs, and shared trackers as shared or external state. Serialize mutations, use only artifacts from the current worktree, and never stop or replace another task's resource.
- Everything under `kit/` ships to Builder Kit customers. Keep it product-neutral and free of personal identifiers, machine paths, signing identities, device details, and private Cosimo behavior; extend it through the documented seams.

## Read when relevant

- Effect plug-in creation, UI/DSP changes, builds, tests, JIT loading, or production install: [`kit/AGENTS.md`](kit/AGENTS.md).
- Delegated implementation or integration: [`docs/AGENT_COORDINATION.md`](docs/AGENT_COORDINATION.md).
- Desktop synth UI, native wrapper, HMR, generated UI, or installed synth plug-in: [`docs/DESKTOP_NATIVE_WORKFLOW.md`](docs/DESKTOP_NATIVE_WORKFLOW.md).
- iPhone/AUv3 UI, build, signing, bundle validation, install, or launch: [`docs/IOS_BUILD_AND_DEVICE.md`](docs/IOS_BUILD_AND_DEVICE.md).
- macOS host keyboard forwarding: [`KEYBOARD_INVESTIGATION.md`](KEYBOARD_INVESTIGATION.md). Generic loader and AU/VST3 compatibility: [`kit/docs/HOST_COMPATIBILITY.md`](kit/docs/HOST_COMPATIBILITY.md).
- Spectral Chord Resonator DSP, endpoints, modes, or parameters: [`fx/spectral_chord_resonator/README.md`](fx/spectral_chord_resonator/README.md).
- Audio or instrument identity icons: [`ui/assets/fontaudio/README.md`](ui/assets/fontaudio/README.md) and [`CREDITS.md`](CREDITS.md).
- Manual desktop, DAW, and device acceptance: [`HUMAN_VALIDATION.md`](HUMAN_VALIDATION.md).
