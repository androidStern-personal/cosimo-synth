# Transient Plan: Shared Effect Presets

This is a transient planning document for the effect preset system. The goal is to preserve the design decisions before implementation work starts.

## Goal

Cosimo Synth will embed standalone effects such as chorus and OTT into the synth effects rack. The standalone effect builds and the embedded synth version should use the same factory presets, the same preset JSON shape, and the same preset validation/apply logic.

The preset system must support:

- Shared factory presets for standalone effects and the embedded synth.
- User-created per-effect presets.
- DAW project recall for standalone plugins.
- Future broader synth patch recall.
- Minimal architecture: no heavy preset framework unless the feature actually needs it.

## Core Decision

Use globally stable Cmajor endpoint IDs directly in preset JSON.

Endpoint names must be camelCase Cmajor identifiers, not dotted names:

```text
chorusMix
chorusMotionMode
chorusBloomMode
chorusTone
chorusFeedback
chorusRingAmount
chorusRingOffsetMode
chorusRingFineSemitones

ottMix
ottAmount
ottTimePercent
ottBandDrive
ottEnvelopeMatch
```

Factory presets and user presets should store these same endpoint IDs:

```json
{
  "kind": "cosimo.effectPreset",
  "version": 1,
  "effectID": "ott",
  "presetID": "ott.default",
  "label": "Default Smash",
  "values": {
    "ottMix": 100,
    "ottAmount": 100,
    "ottTimePercent": 100,
    "ottBandDrive": 0
  }
}
```

This avoids a standalone-vs-embedded endpoint map, but it means endpoint names are now public preset API. They must be treated as stable.

## Important Constraint

This direct-endpoint design only works if each effect has one production parameter contract.

For chorus, the embedded synth already exposes the compact production surface:

- `chorusEnabled`
- `chorusMix`
- `chorusMotionMode`
- `chorusBloomMode`
- `chorusTone`
- `chorusFeedback`
- `chorusRingAmount`
- `chorusRingOffsetMode`
- `chorusRingFineSemitones`

The standalone chorus lab currently exposes a larger experimental surface. Before chorus presets can be shared cleanly, the standalone production/lab build must expose the same compact endpoint names. Do not add adapters for lab-only snapshot formats that never shipped.

## Single-Instance Assumption

The no-map design assumes there is at most one instance of each effect type in the synth:

```text
one chorus
one OTT
one delay
```

If the synth later supports multiple instances of the same effect type, global endpoint IDs like `chorusMix` are not enough. At that point we must either:

- use slot-prefixed endpoints such as `fx1ChorusMix` and `fx2ChorusMix`, or
- reintroduce a tiny preset-to-endpoint mapping layer.

Do not add multi-instance support silently without revisiting this plan.

## Production Persistence

Use Cmajor stored state for production preset metadata and user preset banks.

Use one stored-state key owned by one shared hook/controller:

```ts
export const EFFECT_PRESETS_STATE_KEY = "effects.presets.v1";
```

Stored state should contain:

- user preset banks
- one `activePresetByEffect` map where each effect stores `presetID`, `label`, and `dirty`

Stored state should not be the primary owner of actual sound values. Cmajor/host parameters own sound values because DAWs already restore and automate parameters.

On boot:

1. Read `effects.presets.v1` with `requestFullStoredState`.
2. Use `requestStoredStateValue` when the patch connection does not provide full-state reads.
3. Restore preset banks and labels in the UI.
4. Do not blindly replay preset values into Cmajor parameters.

Preset application is a user action:

1. Validate the preset payload.
2. Clamp and normalize allowed endpoint values.
3. Wrap parameter writes in host gesture start/end when possible.
4. Send values to Cmajor endpoints.
5. Persist active preset metadata to `effects.presets.v1`.

## No LocalStorage For Project State

`localStorage` is only acceptable for scratch lab workflow.

If A-G slots or user presets must survive DAW project save/reopen, they must be stored in Cmajor stored state, not only in `localStorage`.

The current OTT lab A-G snapshots can remain scratch-only if we explicitly accept that they are not DAW project state. If they become production presets, they must move to `effects.presets.v1`.

## Shared Factory Presets

Factory presets should live in shared repo code or assets, used by both standalone plugins and the embedded synth.

Initial recommended location:

```text
ui/shared/effects/chorus-presets.ts
ui/shared/effects/ott-presets.ts
```

TypeScript modules are preferred initially because they are easy to import in tests and can share types with validation code. If non-code editing becomes important later, move them to JSON assets.

## Shared Preset Code

Start with a small shared implementation:

```text
ui/shared/effects/effect-preset-schema.ts
ui/shared/effects/effect-preset-descriptors.ts
ui/shared/effects/effect-preset-store.ts
ui/shared/effects/use-effect-presets.ts
```

Keep the core logic mostly pure:

- `normalizeEffectPreset`
- `validateEffectPreset`
- `serializeEffectPresetState`
- `deserializeEffectPresetState`
- `applyEffectPreset`
- `captureEffectPreset`

The hook/controller should own lifecycle details:

- boot hydration
- stored-state writeback
- stored-state echo suppression
- import/export transaction boundaries
- parameter gesture wrapping during preset apply

Do not let independent effect components write the same `effects.presets.v1` blob directly. One owner must merge updates and write the full state to avoid last-writer-wins bugs.

## Descriptor Allowlist

Never serialize every Cmajor endpoint automatically.

Each effect must define an explicit preset descriptor:

```ts
const ottPresetDescriptor = {
  effectID: "ott",
  params: {
    ottMix: { min: 0, max: 100, defaultValue: 100 },
    ottAmount: { min: 0, max: 100, defaultValue: 100 },
    ottTimePercent: { min: 10, max: 1000, defaultValue: 100 },
    ottBandDrive: { min: 0, max: 100, defaultValue: 0 }
  }
};
```

The descriptor is the only allowlist for:

- export
- import
- validation
- capture
- apply

Hidden/internal endpoints such as `hostSlot0Guard` must never appear in preset JSON.

## Versioning And Migration

Preset JSON and stored state must be versioned.

Raw endpoint IDs are allowed only because we are treating them as stable API. If a rename is unavoidable before release, update descriptors and factory data together instead of adding aliases for unshipped names.

Rules:

- Unknown `kind` fails.
- Unknown `version` fails.
- Unknown `effectID` fails.
- Unknown endpoint IDs fail atomically.
- Out-of-range values are clamped only if the descriptor explicitly allows clamping.
- A failed import must not write any Cmajor parameter and must not update stored state.

## Restore Authority Rule

Host/Cmajor parameter state owns the actual sound on project restore.

`effects.presets.v1` owns preset metadata, labels, and user banks.

Do not replay preset sound values automatically on boot. A future host-specific parameter-restore bug would need a separate explicit design so it does not fight DAW automation.

## Full Test Matrix

These are acceptance tests for the production effect preset system. The existing OTT A-G localStorage snapshot strip is separate scratch workflow and should not be edited for this feature.

| Area | Test file | Test name | Acceptance criteria covered |
| --- | --- | --- | --- |
| Schema validation | `tests/test_effect_preset_schema.mjs` | `valid_v1_preset_normalizes_to_exact_endpoint_value_payload` | A valid v1 preset normalizes to the exact JSON shape and endpoint values that can be persisted or copied. |
| Schema validation | `tests/test_effect_preset_schema.mjs` | `preset_values_reject_dotted_endpoint_ids` | Preset endpoint IDs must be stable camelCase Cmajor identifiers, not dotted paths or UI labels. |
| Schema validation | `tests/test_effect_preset_schema.mjs` | `preset_values_reject_unknown_endpoint_ids_atomically` | Unknown endpoints fail validation before any Cmajor parameter write occurs. |
| Schema validation | `tests/test_effect_preset_schema.mjs` | `preset_values_reject_wrong_kind_version_effect_and_label_type` | Wrong `kind`, unsupported `version`, unknown `effectID`, and invalid `label` all fail clearly. |
| Schema validation | `tests/test_effect_preset_schema.mjs` | `preset_values_reject_missing_required_fields_and_empty_values` | Missing required fields, null payloads, and empty value objects fail before any preset can be stored or applied. |
| Schema validation | `tests/test_effect_preset_schema.mjs` | `preset_values_validate_boundaries_independently` | Ranges, boolean types, integer-only discrete values, and explicit clamping are enforced by the descriptor. |
| Capture/export | `tests/test_effect_preset_schema.mjs` | `capture_preset_exports_only_descriptor_allowlisted_values` | Capturing the current sound exports only descriptor allowlisted endpoints and excludes internal endpoints. |
| Apply | `tests/test_effect_preset_schema.mjs` | `apply_preset_writes_exact_values_inside_host_gesture` | Applying a preset writes the exact allowlisted endpoint values and wraps them in a host gesture when available. |
| Apply | `tests/test_effect_preset_schema.mjs` | `invalid_apply_is_atomic_and_does_not_touch_patch_connection` | Invalid presets do not write parameters, do not start gestures, and do not partially apply valid-looking values. |
| Factory data | `tests/test_effect_preset_contract.mjs` | `factory_presets_have_unique_ids_and_valid_values` | Factory presets have stable unique IDs and every value validates against its effect descriptor. |
| Factory data | `tests/test_effect_preset_contract.mjs` | `factory_presets_use_only_cmajor_identifier_endpoint_ids` | Factory presets never use dotted endpoint names, aliases, or hidden/internal endpoints. |
| Endpoint contract | `tests/test_effect_preset_contract.mjs` | `chorus_descriptor_endpoints_exist_in_standalone_and_embedded_cmajor_surfaces` | The shared chorus production endpoint contract exists in both standalone chorus and embedded synth Cmajor surfaces. |
| Endpoint contract | `tests/test_effect_preset_contract.mjs` | `ott_descriptor_endpoints_exist_in_standalone_and_embedded_cmajor_surfaces` | The shared OTT production endpoint contract exists in both standalone OTT and embedded synth Cmajor surfaces. |
| Endpoint contract | `tests/test_effect_preset_contract.mjs` | `descriptor_endpoint_ids_are_globally_unique_across_effects` | Direct endpoint presets remain safe by preventing duplicate endpoint IDs across effect descriptors. |
| Hidden endpoints | `tests/test_effect_preset_contract.mjs` | `hidden_and_host_guard_endpoints_are_not_preset_addressable` | `hostSlot0Guard` and other hidden/host-only endpoints cannot be exported, imported, or addressed by presets. |
| Stored state boot | `tests/test_effect_preset_state.mjs` | `boot_hydrates_preset_metadata_from_request_full_stored_state_without_replaying_values` | `effects.presets.v1` loads from full stored state and boot does not overwrite host-restored parameter values. |
| Stored state boot | `tests/test_effect_preset_state.mjs` | `boot_hydrates_active_label_and_dirty_metadata_from_stored_state` | Stored state preserves a display label plus dirty flag for the current edited preset. |
| Stored state boot | `tests/test_effect_preset_state.mjs` | `boot_reads_requested_stored_state_value_when_full_state_api_is_unavailable` | Patch connections without full-state reads still restore the current strict preset metadata object via `requestStoredStateValue`. |
| Stored state write | `tests/test_effect_preset_state.mjs` | `saving_user_preset_merges_with_existing_effect_banks_and_persists_once` | One shared owner merges updates across effects and writes the full stored-state blob exactly once. |
| Stored state write | `tests/test_effect_preset_state.mjs` | `stored_state_self_echo_does_not_recurse_or_duplicate_user_presets` | Echoed `sendStoredStateValue` messages do not cause recursive writes or duplicate saved presets. |
| Stored state apply | `tests/test_effect_preset_state.mjs` | `applying_preset_updates_active_metadata_after_successful_parameter_writes` | Successful apply writes parameters first, then updates active preset metadata in `effects.presets.v1`. |
| Stored state apply | `tests/test_effect_preset_state.mjs` | `setting_active_metadata_persists_dirty_label_without_parameter_writes` | Editing preset metadata stores label/dirty state without replaying or changing DSP parameters. |
| Stored state validation | `tests/test_effect_preset_state.mjs` | `invalid_active_metadata_shape_fails_without_parameter_or_state_writes` | Corrupt active metadata is rejected instead of being silently normalized into misleading UI state. |
| Stored state validation | `tests/test_effect_preset_state.mjs` | `unknown_active_metadata_fields_are_rejected_without_state_derivation` | Unrecognized active metadata fields are rejected instead of being treated as alternate stored-state formats. |
| Stored state validation | `tests/test_effect_preset_state.mjs` | `string_active_preset_state_is_rejected_without_state_derivation` | Partial unshipped state objects with string active preset IDs are rejected instead of being supported through alternate format derivation. |
| Atomic import | `tests/test_effect_preset_state.mjs` | `malformed_json_import_fails_without_parameter_or_state_writes` | Malformed copied JSON cannot mutate Cmajor parameters or stored state. |
| Atomic import | `tests/test_effect_preset_state.mjs` | `duplicate_endpoint_import_fails_without_parameter_or_state_writes` | Duplicate endpoint keys in pasted JSON are rejected before JSON parsing can silently keep the last value. |
| Atomic import | `tests/test_effect_preset_state.mjs` | `escaped_duplicate_endpoint_import_fails_without_parameter_or_state_writes` | Duplicate endpoint keys are still rejected when a copied JSON key uses an escape sequence that decodes to the same endpoint name. |
| Atomic import | `tests/test_effect_preset_state.mjs` | `unsupported_preset_version_fails_without_parameter_or_state_writes` | Unknown versions fail atomically. |
| Project recall | `tests/test_effect_preset_state.mjs` | `project_reload_uses_host_parameter_values_and_stored_preset_metadata` | Host/Cmajor parameters own sound on reload, while stored state owns preset label/bank metadata. |
| Platform boundary | `tests/test_effect_preset_state.mjs` | `production_preset_controller_does_not_require_local_storage` | Production presets do not depend on browser `localStorage`, which is only scratch workflow for the A-G slots. |

## Implementation Order

1. Freeze production endpoint names for chorus and OTT.
2. Decide whether standalone chorus lab becomes compact production chorus or keeps a separate experimental surface.
3. Add shared preset schema, descriptors, and factory preset modules.
4. Add pure validation/apply/capture functions.
5. Add one stored-state owner hook/controller for `effects.presets.v1`.
6. Convert standalone OTT preset/snapshot workflow to Cmajor stored state if it needs DAW recall.
7. Wire chorus first because embedded chorus already exists.
8. Wire OTT after its embedded production endpoint names are chosen.
9. Add the required tests above.

## Current Recommendation

Proceed with the simplified direct-endpoint design, but only with:

- camelCase globally stable endpoint IDs
- shared descriptors
- explicit allowlists
- strict version rejection
- Cmajor stored state for production preset persistence
- one owner for `effects.presets.v1`
- host parameters as the authority for sound values on restore

This keeps the system small while avoiding the obvious failure modes found in review.
