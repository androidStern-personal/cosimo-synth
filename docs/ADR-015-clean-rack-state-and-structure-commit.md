# ADR-015: Clean rack state and atomic structure commits

Status: accepted — 2026-08-01

## Context

Cosimo's eight-effect rack is entering the deployed web synth before any rack or Chorus compatibility contract has shipped. The prototype carried a second `chorusEnabled` gate beside the rack enable mask and could write rack order repeatedly while dragging. Both would create permanent ambiguity: two Chorus truths and avoidable full-chain transitions.

## Decision

- `rack.v1` is the only persisted rack structure. It contains exactly `format`, `version`, the complete eight-module `order`, and one `enabled` boolean per stable module identity.
- Rack parameter values remain ordinary Cmajor parameters. There is no legacy Chorus migration or duplicate compatibility field.
- A missing rack state defaults all eight modules off in identity order. This preserves the audible behavior of deployed commit `c585580` while exposing the new rack without silently changing the default patch.
- Dragging is an optimistic UI preview. The DSP receives one complete order and enable commit on drop. The rack crossfades through the live dry instrument around the structural swap instead of repeatedly muting the full chain.
- Rack modulation uses a distinct `RackModulationRouteUpload`. The older voice-route event retains its shipped wire shape; voice-to-rack routes add explicit Max/Mean reduction, while macro routes remain global and unreduced.
- Correlated time-effect mixes use constant-sum dry/wet gain. Reverb adds early energy before its tank. These choices remove routine serial gain buildup without changing effect identity or making the limiter the normal gain policy.

## Consequences

- Unpublished presets, local sessions, and automation bound to the removed `chorusEnabled` endpoint can break. This is intentional compatibility debt avoidance, not a migration omission.
- A rack reorder has one audible transition and one persisted structural state.
- UI labels, ranges, endpoint bindings, sync divisions, and modulation target indices come from one rack descriptor catalog.
- A future state version must be explicit; permissive parsing of unknown or legacy fields is rejected.
