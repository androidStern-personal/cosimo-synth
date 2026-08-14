# Cosimo Adapter Command Map

Phase-1 audit artifact (roadmap acceptance) and the build spec for the Phase-3
`CosimoBridgeAdapter`. One row per port command (`ui/shared/cosimo-adapter-port.ts`):
what the mock does, what the bridge must do, and where the engine still has a gap.
Mechanism vocabulary: **EP** = `sendEventOrValue(endpointId, …)`; **SS(key)** = stored-state
write via `sendStoredStateValue`; **RESOLVE** = recompile affected selector images via
`resolveArticulationImages`/`affectedSelectors` (ADR-014); RT-01 connected the exact image shape to
the Cmajor `articulationSnapshot` endpoint, while HOST-02 still owns production worker publication.
**MODBRIDGE** = `ModulationRuntimeBridge`
over `modulation.v4` (rebuild + runtime events).

Persistence note: values for `unbacked` targets (rack params pending DSP, tune/level/attack/
release pending endpoints) persist in **SS(uiPatchValues.v2)** — a UI-owned bag so patches
round-trip; they make no sound until their engine work lands. This is patch state, not a
per-adapter divergence: both adapters model it, neither sounds it.

| Command | Mock | Bridge | Engine gap |
|---|---|---|---|
| setParameter (bound voice target, patchBase) | reducer | EP via descriptor `toEngine` + SS(uiPatchValues.v2) + RESOLVE (base change re-uploads non-overriding selectors after HOST-02) | — |
| setParameter (articulationOverride layer) | reducer override map | SS(articulations.v4) + RESOLVE (that selector after HOST-02) | production worker composition deferred to HOST-02 |
| setParameter (unbacked target) | reducer | SS(uiPatchValues.v2) only | rack-dsp / no-endpoint per catalog |
| addMapping / removeMapping | policy + reducer | MODBRIDGE route add/remove (targetKind via descriptor `modulationTargetKind`) + RESOLVE (route order affects all selectors) | rack targets: `modulationTargetKind` null → route unrepresentable until rack DSP (UI already scopes rail to modulatable targets) |
| setMappingAmount (patchBase) | reducer | MODBRIDGE route amount (unit conversion: ModAmountSpec units → route units) | — |
| setMappingAmount (articulation layer) | reducer amount map | SS(articulations.v4) routeAmounts + RESOLVE after HOST-02 | production worker composition deferred to HOST-02 |
| setMappingEnabled | reducer | MODBRIDGE route enabled | — |
| setMappingPolarity | reducer | MODBRIDGE route polarity | — |
| setMappingReducer | reducer | SS(modulation.v4) route metadata only | engine has no reducer stage (activates with rack DSP global targets, ledger §9) |
| createSource (envelope/mseg) | policy + reducer | slot allocation over modulation.v4 fixed slots; MODBRIDGE | — |
| createSource (macro) | policy + reducer | macro slots are fixed engine parameters; "create" = reveal per ADR-010 progressive disclosure (SS-tracked visibility) | — |
| deleteSource / undoDeleteSource | reducer + undo buffer | MODBRIDGE (clear slot + routes); undo is adapter-local buffer replay | — |
| setMacroValue | reducer | EP macro1..macro4 | — |
| renameMacro | reducer | SS(modulation.v4) macroNames | — |
| setEnvelope | reducer sourceStates | MODBRIDGE envelope slot | — |
| setMsegShape / setMsegPlayback | reducer sourceStates | MODBRIDGE mseg slot (2051-float buffer upload / playback upload) | — |
| setMsegMorph (patchBase) | reducer sourceStates | EP mseg1..3Morph | — |
| setMsegMorph (articulation layer) | reducer override map | SS(articulations.v4) (`msegMorphN`) | image publication deferred to HOST-02 |
| addArticulation / duplicateArticulation | policy + reducer | SS(articulations.v4) (selector = lowestFreeRuntimeSlot) + RESOLVE after HOST-02 | production worker composition deferred to HOST-02 |
| deleteArticulation | reducer pruning | SS(articulations.v4); HOST-02 uploads the disabled image for the freed selector | production worker composition deferred to HOST-02 |
| setArticulationKey / setArticulationRange | walk/clamp policy + reducer | same policies + SS(articulations.v4) + `sendNativeArticulationTriggerConfig` + SS(articulationTriggerConfig.v1) | — |
| setArticulationTriggerMode | reducer | SS(articulationTriggerConfig.v1) + native config | — |
| clearArticulationOverride / clearArticulationBaseOverride / clearArticulationMappingAmount | reducer | SS(articulations.v4) + RESOLVE after HOST-02 | production worker composition deferred to HOST-02 |
| restoreArticulationLayer | reducer | SS(articulations.v4) wholesale layer replace + RESOLVE after HOST-02 | production worker composition deferred to HOST-02 |
| setEffectEnabled / reorderEffect / restoreEffectOrder | reducer | SS(rackState.v1) only | rack DSP (ADR-001…009) not implemented |
| setCompoundSetting | reducer | SS(uiPatchValues.v2) only | no Free/Sync endpoint |
| setAuditionArticulation | reducer | force-selector path: see OPEN below | OPEN: engine articulation choice is trigger-driven (chain/key/vel); transport needs a "force selector for auditioned notes" path — candidate: temporary chain-config pin via native trigger config |
| setAuditionNote / begin/end/cancelTrigger | reducer | `sendMIDIInputEvent` noteOn/noteOff | — |
| setRepeatEnabled / setLatchEnabled | reducer | adapter-local audition state | — |
| captureMotion | reducer synthetic candidate → mseg + mapping | same UI-side candidate flow; committed shape uses REAL sampled motion once capture buffers exist | motion sample buffer + note timing (ledger §22.1:852) — until then the committed MSEG is shape-derived, not motion-derived |
| reset | reducer initial state | re-send initial stored state + defaults; full RESOLVE + MODBRIDGE rebuild | — |

## Open items carried to Phase 3

1. **Audition articulation forcing** (above) — resolve during bridge build against
   `articulationTriggerConfig` semantics; the mock's behavior is the product spec.
2. **Route-amount unit conversion**: ModAmountSpec units (oct/st/dB/pan/%) vs
   `ROUTE_AMOUNT_LIMITS` route units per targetKind — one conversion table in the
   descriptor layer, property-tested for roundtrip, before the bridge sends amounts.
3. **`skipMissingInputs` hydration**: bridge boot parses `modulation.v4`,
   `articulations.v4`, `articulationTriggerConfig.v1`, `rackState.v1`,
   `uiPatchValues.v2`; a malformed document is a typed parse error surfaced as
   `ConnectionState.detached` — never a silent default (fail fast).
