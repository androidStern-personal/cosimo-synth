import { useMemo, useReducer } from "react";
import { TARGETS } from "../domain/catalog.js";
import { clampModAmount, defaultModAmount } from "../domain/formatting.js";
import { createInitialMockCosimoState } from "../domain/fixtures.js";
import {
  createMapping,
  createSourceIdentity,
  firstAvailableSourceSlot,
  resolveParameterEditLayer,
} from "../domain/policies.js";
import { selectSourceLookup } from "../domain/selectors.js";
import { mockCosimoReducer } from "./mockCosimoReducer.js";

/** @returns {import("./CosimoMobileAdapter.js").CosimoMobileAdapter} */
export function useMockCosimoAdapter({
  createInitialState = createInitialMockCosimoState,
} = {}) {
  const [state, dispatch] = useReducer(
    mockCosimoReducer,
    undefined,
    createInitialState,
  );

  const snapshot = useMemo(
    () => ({ patch: state.patch, audition: state.audition }),
    [state.audition, state.patch],
  );

  const commands = useMemo(() => ({
    setParameter({ targetId, value, layer = null }) {
      if (!TARGETS[targetId]) return;
      dispatch({
        type: "SET_PARAMETER",
        targetId,
        value,
        layer: layer || resolveParameterEditLayer(targetId, state.audition.articulation),
      });
    },

    clearArticulationOverride(targetId, articulationId) {
      dispatch({ type: "CLEAR_ARTICULATION_OVERRIDE", targetId, articulationId });
    },

    setEffectEnabled(effectId, enabled) {
      dispatch({ type: "SET_EFFECT_ENABLED", effectId, enabled });
    },

    reorderEffect(effectId, overEffectId) {
      dispatch({ type: "REORDER_EFFECT", effectId, overEffectId });
    },

    restoreEffectOrder(effectOrder) {
      dispatch({ type: "RESTORE_EFFECT_ORDER", effectOrder });
    },

    setCompoundSetting(targetId, patch) {
      dispatch({ type: "SET_COMPOUND_SETTING", targetId, patch });
    },

    createSource(type) {
      const slot = firstAvailableSourceSlot(state.patch.sources, type);
      const source = createSourceIdentity(type, slot);
      if (!source) return null;
      dispatch({ type: "CREATE_SOURCE", source });
      return source.id;
    },

    setSourceSettings(sourceId, patch) {
      dispatch({ type: "SET_SOURCE_SETTINGS", sourceId, patch });
    },

    deleteSource(sourceId) {
      dispatch({ type: "DELETE_SOURCE", sourceId });
    },

    undoDeleteSource() {
      dispatch({ type: "UNDO_DELETE_SOURCE" });
    },

    addMapping({
      targetId,
      sourceId,
      amount = null,
      polarity = "Unipolar",
      reducer = "Max",
      metadata = {},
    }) {
      if (!TARGETS[targetId] || !selectSourceLookup(state.patch)[sourceId]) return null;
      if (state.patch.mappings.some(
        (mapping) => mapping.targetKey === targetId && mapping.sourceId === sourceId,
      )) return null;
      const item = createMapping(
        targetId,
        sourceId,
        clampModAmount(TARGETS[targetId], amount ?? defaultModAmount(TARGETS[targetId])),
        polarity,
        reducer,
        metadata,
      );
      dispatch({ type: "ADD_MAPPING", mapping: item });
      return item.id;
    },

    setMappingAmount(mappingId, amount, layer = null) {
      const mapping = state.patch.mappings.find((item) => item.id === mappingId);
      if (!mapping) return;
      dispatch({
        type: "SET_MAPPING_AMOUNT",
        mappingId,
        amount,
        layer: layer || resolveParameterEditLayer(mapping.targetKey, state.audition.articulation),
      });
    },

    setMappingEnabled(mappingId, enabled) {
      dispatch({ type: "SET_MAPPING_FIELD", mappingId, field: "enabled", value: Boolean(enabled) });
    },

    setMappingPolarity(mappingId, polarity) {
      if (polarity !== "Bipolar" && polarity !== "Unipolar") return;
      dispatch({ type: "SET_MAPPING_FIELD", mappingId, field: "polarity", value: polarity });
    },

    setMappingReducer(mappingId, reducer) {
      if (reducer !== "Max" && reducer !== "Mean") return;
      dispatch({ type: "SET_MAPPING_FIELD", mappingId, field: "reducer", value: reducer });
    },

    removeMapping(mappingId) {
      dispatch({ type: "REMOVE_MAPPING", mappingId });
    },

    setAuditionArticulation(articulationId) {
      dispatch({ type: "SET_AUDITION_ARTICULATION", articulationId });
    },

    setAuditionNote(note) {
      dispatch({ type: "SET_AUDITION_NOTE", note });
    },

    setRepeatEnabled(enabled) {
      dispatch({ type: "SET_REPEAT", enabled });
    },

    setLatchEnabled(enabled) {
      dispatch({ type: "SET_LATCH", enabled });
    },

    beginTrigger() {
      dispatch({ type: "BEGIN_TRIGGER" });
    },

    endTrigger() {
      dispatch({ type: "END_TRIGGER" });
    },

    cancelTrigger() {
      dispatch({ type: "CANCEL_TRIGGER" });
    },

    captureMotion() {
      if (!state.audition.captureCandidate) return null;
      const slot = firstAvailableSourceSlot(state.patch.sources, "mseg");
      const source = createSourceIdentity("mseg", slot);
      dispatch({ type: "CAPTURE_MOTION", source });
      return source?.id || null;
    },

    reset() {
      dispatch({ type: "RESET" });
    },
  }), [state.audition.articulation, state.audition.captureCandidate, state.patch]);

  return { snapshot, commands };
}
