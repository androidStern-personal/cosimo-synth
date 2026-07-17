import {
  EFFECTS,
  FIXED_SOURCES,
  MODULES_BY_ID,
  TARGETS,
} from "./catalog.js";
import { formatValue, sourceColor } from "./formatting.js";
import {
  firstAvailableSourceSlot,
  mappingNeedsReducer,
  resolveParameterEditLayer,
} from "./policies.js";

export function selectSourceLookup(patch) {
  return Object.fromEntries(
    [...patch.sources, ...FIXED_SOURCES].map((source) => [source.id, source]),
  );
}
export function selectOrderedEffects(patch) {
  return patch.effectOrder
    .map((id) => MODULES_BY_ID[id])
    .filter(Boolean);
}

export function selectArticulationOverrides(patch, articulationId) {
  return articulationId === "Default"
    ? {}
    : patch.articulationOverrides[articulationId] || {};
}

export function selectEffectiveParameterValues(patch, articulationId) {
  return {
    ...patch.parameterValues,
    ...selectArticulationOverrides(patch, articulationId),
  };
}

export function selectEffectiveParameterValue(patch, targetId, articulationId) {
  const override = selectArticulationOverrides(patch, articulationId)[targetId];
  return override ?? patch.parameterValues[targetId];
}

export function selectMappingsForTarget(patch, targetId) {
  return patch.mappings.filter((item) => item.targetKey === targetId);
}

/*
 * Articulations override route amounts, mirroring the real engine's
 * per-articulation routeAmounts. Only per-note voice targets participate;
 * global effect mappings stay patch-base, like base values.
 */
export function selectArticulationMappingAmount(patch, mapping, articulationId) {
  if (!articulationId || articulationId === "Default") return null;
  if (TARGETS[mapping.targetKey]?.workspace !== "voice") return null;
  const override = patch.articulationMappingAmounts[articulationId]?.[mapping.id];
  return override == null ? null : override;
}

export function selectEffectiveMappingAmount(patch, mapping, articulationId) {
  return selectArticulationMappingAmount(patch, mapping, articulationId) ?? mapping.amount;
}

export function selectMappingsForSource(patch, sourceId) {
  return patch.mappings.filter((item) => item.sourceId === sourceId);
}

export function selectMappingCounts(patch) {
  return patch.mappings.reduce((counts, item) => ({
    ...counts,
    [item.sourceId]: (counts[item.sourceId] || 0) + 1,
  }), {});
}

export function selectAvailableTargetsForSource(patch, sourceId) {
  return Object.values(TARGETS).filter(
    (target) => !patch.mappings.some(
      (item) => item.sourceId === sourceId && item.targetKey === target.key,
    ),
  );
}

export function selectAvailableSourcesForTarget(patch, targetId) {
  const mappedSourceIds = new Set(
    selectMappingsForTarget(patch, targetId).map((item) => item.sourceId),
  );
  return Object.values(selectSourceLookup(patch)).filter(
    (source) => !mappedSourceIds.has(source.id),
  );
}

export function selectSourceSettings(patch, sourceId) {
  return patch.sourceSettings[sourceId] || null;
}

export function selectAvailableSourceSlot(patch, type) {
  return firstAvailableSourceSlot(patch.sources, type);
}

export function selectParameterControlViewModel(
  patch,
  audition,
  targetId,
  activeSourceId = null,
) {
  const target = TARGETS[targetId];
  if (!target) return null;
  const sourceLookup = selectSourceLookup(patch);
  const targetMappings = selectMappingsForTarget(patch, targetId);
  const rawActiveMapping = targetMappings.find((item) => item.sourceId === activeSourceId)
    || targetMappings[0]
    || null;
  const activeMapping = rawActiveMapping
    ? {
        ...rawActiveMapping,
        amount: selectEffectiveMappingAmount(patch, rawActiveMapping, audition.articulation),
        hasAmountOverride:
          selectArticulationMappingAmount(patch, rawActiveMapping, audition.articulation) != null,
      }
    : null;
  const source = activeMapping ? sourceLookup[activeMapping.sourceId] : null;
  const override = selectArticulationOverrides(
    patch,
    audition.articulation,
  )[targetId];
  const value = selectEffectiveParameterValue(
    patch,
    targetId,
    audition.articulation,
  );

  return {
    target,
    targetId,
    label: target.label,
    value,
    formattedValue: formatValue(target, value),
    patchBaseValue: patch.parameterValues[targetId],
    defaultValue: target.defaultValue,
    editLayer: resolveParameterEditLayer(targetId, audition.articulation),
    articulationOverride: override == null
      ? null
      : { articulationId: audition.articulation, value: override },
    activeMapping,
    activeSource: source,
    activeSourceColor: sourceColor(source),
    mappings: targetMappings,
  };
}

export function selectReducerRequirement(patch, mappingId) {
  const item = patch.mappings.find((mapping) => mapping.id === mappingId);
  if (!item) return false;
  const source = selectSourceLookup(patch)[item.sourceId];
  return mappingNeedsReducer(source, TARGETS[item.targetKey]);
}

export function selectRackTiles(patch, lastTweakedByModule = {}) {
  const effectsById = Object.fromEntries(EFFECTS.map((effect) => [effect.id, effect]));
  return patch.effectOrder.map((effectId) => {
    const effect = effectsById[effectId];
    const quickId = lastTweakedByModule[effectId] || effect.quick;
    const target = TARGETS[`${effectId}.${quickId}`];
    const value = patch.parameterValues[target.key];
    return {
      effect,
      effectId,
      enabled: patch.effectEnabled[effectId] !== false,
      quickTarget: target,
      quickValue: value,
      formattedQuickValue: formatValue(target, value),
    };
  });
}
