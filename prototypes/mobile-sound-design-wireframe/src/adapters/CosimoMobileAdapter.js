/**
 * @typedef {string} TargetId
 * @typedef {string} SourceId
 * @typedef {string} MappingId
 * @typedef {string} EffectId
 * @typedef {"macro" | "envelope" | "mseg" | "fixed"} SourceType
 * @typedef {"Bipolar" | "Unipolar"} MappingPolarity
 * @typedef {"Max" | "Mean"} MappingReducer
 *
 * @typedef {{kind: "patchBase"} | {
 *   kind: "articulationOverride",
 *   articulationId: string,
 * }} ParameterEditLayer
 *
 * @typedef {Object} CosimoMobileSnapshot
 * @property {Object} patch Patch-owned sound-design state.
 * @property {Object} audition Current audition and retrospective-capture state.
 *
 * @typedef {Object} CosimoMobileCommands
 * @property {(input: {
 *   targetId: TargetId,
 *   value: number,
 *   layer?: ParameterEditLayer,
 * }) => void} setParameter
 * @property {(targetId: TargetId, articulationId: string) => void} clearArticulationOverride
 * @property {(effectId: EffectId, enabled: boolean) => void} setEffectEnabled
 * @property {(effectId: EffectId, overEffectId: EffectId) => void} reorderEffect
 * @property {(effectOrder: EffectId[]) => void} restoreEffectOrder
 * @property {(targetId: TargetId, patch: Object) => void} setCompoundSetting
 * @property {(type: SourceType) => SourceId | null} createSource
 * @property {(sourceId: SourceId, patch: Object) => void} setSourceSettings
 * @property {(sourceId: SourceId) => void} deleteSource
 * @property {() => void} undoDeleteSource
 * @property {(input: {
 *   targetId: TargetId,
 *   sourceId: SourceId,
 *   amount?: number,
 *   polarity?: MappingPolarity,
 *   reducer?: MappingReducer,
 *   metadata?: Object,
 * }) => MappingId | null} addMapping
 * @property {(mappingId: MappingId, amount: number) => void} setMappingAmount
 * @property {(mappingId: MappingId, polarity: MappingPolarity) => void} setMappingPolarity
 * @property {(mappingId: MappingId, reducer: MappingReducer) => void} setMappingReducer
 * @property {(mappingId: MappingId) => void} removeMapping
 * @property {(articulationId: string) => void} setAuditionArticulation
 * @property {(note: string) => void} setAuditionNote
 * @property {(repeat: boolean) => void} setRepeatEnabled
 * @property {(latch: boolean) => void} setLatchEnabled
 * @property {() => void} beginTrigger
 * @property {() => void} endTrigger
 * @property {() => void} cancelTrigger
 * @property {() => SourceId | null} captureMotion
 *
 * @typedef {Object} CosimoMobileAdapter
 * @property {CosimoMobileSnapshot} snapshot
 * @property {CosimoMobileCommands} commands
 */

export const COSIMO_MOBILE_ADAPTER_VERSION = 1;
