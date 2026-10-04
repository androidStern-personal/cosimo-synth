# Builder Kit changelog

## Unreleased — Plugin state, Global Undo and composable controls

### Added

- A declarative state API: `definePluginState`, `parameter`, `storedValue`, and `preparedState`. The build generates the persistent state owner and connects each GUI to it.
- Shared Undo/Redo across ordinary parameters and editable complex values. A drag of one field forms one history entry; `edit(...)` can change several fields as one action. History has a configurable entry limit.
- The included Enhance That controls and newly generated plugins use the state framework, with Undo/Redo available in their interfaces. Enhance That retains its sound, parameter identities, and existing preset/snapshot formats.
- Automatic GUI reconnection, field-version conflict checks, and protection against delayed reports overwriting newer edits. Host automation remains distinct from user Undo history.
- One per-field UI status: `loading`, `invalid`, `unavailable`, `updating`, or `idle`. Values stay editable during updates and recoverable failures, with one current error and a guarded retry action. Invalid saved values require an explicit replacement. Retrying does not add another Undo entry.
- Direct preparation into shared audio storage on native JIT, compiled native, and browser WebAssembly. The framework handles allocation within the supplied budget, cancellation, complete-data publication at an audio-block boundary, and releasing replaced data.
- Fixed-size preparation and a load-once preparation plan for data whose size is discovered after loading. Generated `PluginState.cmajor` references connect declared data to DSP readers.
- Reusable MSEG curve state, math, rendering, editing interactions, composable surfaces, and a Cmajor reader/player. The editor handles one curve without requiring a drawer or A/B morphing.
- Composable knobs: complete controls and independent input, dial, label, readout, exact-entry, range and live-marker parts. Linear/log/custom scales, two-axis input, menu composition and custom artwork share the same editing behavior.
- Composable MSEG Root/Surface/layers, custom point artwork, inspector commands, reference curves, sampled plots, time axes and live playheads. The included Reader reports observed playback with activity and retrigger identity; the public adapter handles subscription, stale reports and cleanup.
- Shared filter editor with cutoff bands or two-dimensional modulation handles, live response, optional FFT overlays and per-root style installation. `FilterRangeEditor` remains a compatible alias.
- Focused Preview/Code reference pages for knobs, MSEGs, filters and sliders, including an offline real-DSP MSEG playback example. Agent documentation ships under `kit/docs/` and is linked from the kit guide.
- Segmented sliders with usable defaults, ordinary root styling and refs, standalone styles, and gesture grouping for value and modulation edits. Disabling or unmounting a control ends its active gesture.
- Typed native settings through `nativeValue` and `Native` codecs, with matching generated C++ readers.
- An independently reusable `UndoHistory` module and documented extension points for specialized delivery protocols.

### Fixed

- Optimistic values no longer display an older value's error. Current save failures stay visible during preparation, and unavailable dependencies do not leave an endless progress indicator.

- Late scalar-parameter observations could rewind an active drag or replay old values after release. Native and browser delivery now preserve write identity and ordering.
- Compound edits could incorrectly appear settled while awaiting acceptance.
- Unrelated controls and history consumers could rerender on every state update. Subscriptions now retain the relevant field/history selection, and duplicate state messages are suppressed.
- Failed native sends could make an equal-value retry appear successful without reaching DSP. Restore failures now stop before falsely reporting replacement success.
- Saved-state mirror callbacks could outlive the document they belonged to. Cleanup now continues when another cleanup callback fails.
- Customer React and React DOM versions are pinned together, and the exported lockfile is checked through a separate dependency installation.
- Compiler, native headers, and browser support use the same Cmajor dependency selection. Source builds and verified downloaded tools retain explicit, checked identities.
- Release tool provenance is derived from the committed CMake pin instead of a second hand-maintained revision. New release commits and tags use a neutral product identity.

### Update instructions — 0.2.0

Copyable release prompt:

> Update Builder Kit to 0.2.0 using the kit-update skill. Follow this release's Update instructions in the target release's kit/CHANGELOG.md before merging. Preserve my plugin changes and verify that my existing plugins still build. Then summarize how the new state management, Global Undo, and composable controls apply to my project. Keep optional adoption separate from the kit update.

- **Required:** this release updates the dependency lockfile and pinned tool manifest. Carry those changes through the normal kit merge, run `npm ci` for changed dependencies, and refresh tools through `kit:setup` when strict doctor reports a mismatch. Verify the customer's existing plugins through the skill's normal checks.
- **Existing plugins:** updating the kit does not require adopting the new state API or replacing custom controls. Preserve DSP behavior, parameter identities and saved preset formats. If an existing API use no longer compiles, explain the concrete repair before changing customer code.
- **Optional adoption:** use [Plugin state](docs/PLUGIN_STATE.md) for state and shared Undo, [Shared audio data](docs/SHARED_DATA.md) for prepared data, and [Knobs](docs/KNOBS.md), [MSEGs](docs/MSEG.md), or [Filters](docs/FILTERS.md) for composing controls. Propose relevant changes after the existing plugin passes its update checks; adoption is a separate customer decision.

### Scope and updating

Existing plugins are not automatically rewritten to use the new state API. An agent or plugin author adopts it deliberately. Custom DSP still defines how values affect sound and how custom data is interpreted. Undo does not retain deleted external source files for you, and shared data uses the memory budget you supply.

The supported customer installation target remains Apple silicon on macOS 15 or newer. Browser shared-memory execution needs cross-origin isolation. This release does not promise Windows/Intel qualification, background CPU execution for every preparation callback, or a general-purpose ADSR editor.

See [Plugin state](docs/PLUGIN_STATE.md), [Shared audio data](docs/SHARED_DATA.md), [Knobs](docs/KNOBS.md), [MSEGs](docs/MSEG.md), [Filters](docs/FILTERS.md), and the [kit-update skill](skills/kit-update/SKILL.md).

## 0.1.5 — 2026-09-09

This is the verified released baseline for the new entries above. It included the guided Documents-folder setup, the user's choice of first task, a tracked dependency lockfile, and an update flow that preserves local plugin edits. The state framework and direct shared-data APIs above were added after this release.

Older releases are retained in the customer release history. Their notes have not been reconstructed here from unverified recollection.
