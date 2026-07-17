import { ARTICULATIONS, TARGETS } from "./catalog.js";

export const SOURCE_LIMITS = Object.freeze({ macro: 4, envelope: 3, mseg: 3 });

export function mappingNeedsReducer(source, target) {
  return target?.workspace === "effects" && source?.type !== "macro";
}
export function defaultSourceSettings(source) {
  if (source.type === "macro") return { value: 45 };
  if (source.type === "envelope") {
    return { attack: 20, decay: 32, sustain: 65, release: 35 };
  }
  if (source.type === "fixed") return { value: 52 };
  return { time: 55, scale: 80, curve: 50 };
}

export function resolveParameterEditLayer(targetId, articulationId) {
  const target = TARGETS[targetId];
  const editsOverride =
    target?.workspace === "voice" &&
    articulationId &&
    articulationId !== "Default" &&
    Boolean(ARTICULATIONS[articulationId]);

  return editsOverride
    ? { kind: "articulationOverride", articulationId }
    : { kind: "patchBase" };
}

export function firstAvailableSourceSlot(sources, type) {
  const limit = SOURCE_LIMITS[type];
  if (!limit) return null;
  const occupied = new Set(
    sources.filter((source) => source.type === type).map((source) => source.slot),
  );
  return Array.from({ length: limit }, (_, index) => index + 1)
    .find((slot) => !occupied.has(slot)) ?? null;
}

export function createSourceIdentity(type, slot) {
  const labels = { macro: "Macro", envelope: "Envelope", mseg: "MSEG" };
  if (!labels[type] || slot == null) return null;
  return {
    id: `${type}-${slot}`,
    type,
    slot,
    label: `${labels[type]} ${slot}`,
  };
}

// Unipolar is the default everywhere, matching the real synth: no Cosimo
// source rests mid-travel, so bipolar is always an explicit choice.
export function createMapping(
  targetKey,
  sourceId,
  amount,
  polarity = "Unipolar",
  reducer = "Max",
  metadata = {},
) {
  return {
    id: `${targetKey}::${sourceId}`,
    targetKey,
    sourceId,
    amount,
    polarity,
    reducer,
    enabled: true,
    ...metadata,
  };
}
