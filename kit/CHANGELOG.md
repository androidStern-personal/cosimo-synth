# Builder Kit changelog

## Unreleased — Plugin state and shared audio data

### Added

- A declarative state API: `definePluginState`, `parameter`, `storedValue`, and `preparedState`. The build generates the persistent state owner and connects each GUI to it.
- Shared Undo/Redo across ordinary parameters and editable complex values. A drag of one field forms one history entry; `edit(...)` can change several fields as one action. History has a configurable entry limit.
- The included Enhance That controls and newly generated plugins use the state framework, with Undo/Redo available in their interfaces. Enhance That retains its sound, parameter identities, and existing preset/snapshot formats.
- Automatic GUI reconnection, field-version conflict checks, and protection against delayed reports overwriting newer edits. Host automation remains distinct from user Undo history.
- One per-field UI status: `loading`, `invalid`, `unavailable`, `updating`, or `idle`. Values stay editable during updates and recoverable failures, with one current error and a guarded retry action. Invalid saved values require an explicit replacement. Retrying does not add another Undo entry.
- Direct preparation into shared audio storage on native JIT, compiled native, and browser WebAssembly. The framework handles allocation within the supplied budget, cancellation, complete-data publication at an audio-block boundary, and releasing replaced data.
- Fixed-size preparation and a load-once preparation plan for data whose size is discovered after loading. Generated `PluginState.cmajor` references connect declared data to DSP readers.
- Reusable MSEG curve state, math, rendering, editing interactions, composable surfaces, and a Cmajor reader/player. The editor handles one curve without requiring a drawer or A/B morphing.
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

### Scope and updating

Existing plugins are not automatically rewritten to use the new state API. An agent or plugin author adopts it deliberately. Custom DSP still defines how values affect sound and how custom data is interpreted. Undo does not retain deleted external source files for you, and shared data uses the memory budget you supply.

The supported customer installation target remains Apple silicon on macOS 15 or newer. Browser shared-memory execution needs cross-origin isolation. This release does not promise Windows/Intel qualification, background CPU execution for every preparation callback, or a newly extracted composable knob/context-menu package.

See [Plugin state](docs/PLUGIN_STATE.md), [Shared audio data](docs/SHARED_DATA.md), and the [kit-update skill](skills/kit-update/SKILL.md).

## 0.1.5 — 2026-09-09

This is the verified released baseline for the new entries above. It included the guided Documents-folder setup, the user's choice of first task, a tracked dependency lockfile, and an update flow that preserves local plugin edits. The state framework and direct shared-data APIs above were added after this release.

Older releases are retained in the customer release history. Their notes have not been reconstructed here from unverified recollection.
