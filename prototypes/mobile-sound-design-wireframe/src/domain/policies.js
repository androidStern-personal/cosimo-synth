import { ARTICULATION_SLOT_COLORS, ARTICULATIONS, TARGETS } from "./catalog.js";

export const SOURCE_LIMITS = Object.freeze({ macro: 4, envelope: 3, mseg: 3 });

/*
 * Keyswitch movement walks semitone by semitone and stops flush against the
 * first occupied key, so articulations can touch but never pass through or
 * stack. Returns the landing key plus contact info for haptics.
 */
export function walkArticulationKey(articulations, articulationId, wantKey) {
  const current = articulations.find((item) => item.id === articulationId);
  if (!current) return null;
  const target = Math.max(0, Math.min(127, Math.round(wantKey)));
  const others = articulations.filter((item) => item.id !== articulationId);
  const direction = target > current.key ? 1 : -1;
  let key = current.key;
  while (key !== target) {
    const step = key + direction;
    if (step < 0 || step > 127 || others.some((other) => other.key === step)) break;
    key = step;
  }
  const neighbor = others.find((other) => Math.abs(other.key - key) === 1) || null;
  return { key, touching: Boolean(neighbor), neighborId: neighbor ? neighbor.id : null };
}

/*
 * Vel/Chain ranges may never overlap. A dragged bound stops flush against
 * the neighboring range's edge — growing into a neighbor requires
 * shrinking the neighbor first. Same physics (and haptic) as keyswitches.
 */
export function clampArticulationRange(articulations, articulationId, mode, bound, wantValue) {
  const current = articulations.find((item) => item.id === articulationId);
  if (!current || (mode !== "vel" && mode !== "chain")) return null;
  const range = current[mode];
  const others = articulations.filter((item) => item.id !== articulationId);
  let value = Math.max(0, Math.min(127, Math.round(wantValue)));
  let touching = false;
  let neighborId = null;
  if (bound === "lo") {
    const below = others.filter((other) => other[mode][1] < range[1]);
    const floor = Math.max(-1, ...below.map((other) => other[mode][1]));
    value = Math.min(Math.max(value, floor + 1), range[1]);
    touching = floor >= 0 && value === floor + 1;
    neighborId = touching ? below.find((other) => other[mode][1] === floor).id : null;
  } else {
    const above = others.filter((other) => other[mode][0] > range[0]);
    const ceiling = Math.min(128, ...above.map((other) => other[mode][0]));
    value = Math.max(Math.min(value, ceiling - 1), range[0]);
    touching = ceiling <= 127 && value === ceiling - 1;
    neighborId = touching ? above.find((other) => other[mode][0] === ceiling).id : null;
  }
  return { value, touching, neighborId };
}

// ADR-014: selectors are allocated lowest-free from 0 and never reused while
// occupied — identical policy to the engine bridge's lowestFreeRuntimeSlot.
function lowestFreeSelector(articulations) {
  const occupied = new Set(articulations.map((item) => item.selector));
  let selector = 0;
  while (occupied.has(selector)) selector += 1;
  return selector;
}

export function nextArticulationIdentity(articulations) {
  const selector = lowestFreeSelector(articulations);
  const color = ARTICULATION_SLOT_COLORS[
    (articulations.length - 3 + ARTICULATION_SLOT_COLORS.length * 8) % ARTICULATION_SLOT_COLORS.length
  ];
  let ordinal = articulations.length + 1;
  while (articulations.some((item) => item.id === `Artic ${ordinal}`)) ordinal += 1;
  return {
    id: `Artic ${ordinal}`,
    label: `Artic ${ordinal}`,
    color,
    icon: "circle",
    selector,
    key: freeArticulationKey(articulations, 30),
    vel: [0, 127],
    chain: [0, 127],
  };
}

export function duplicateArticulationIdentity(articulations, source) {
  const selector = lowestFreeSelector(articulations);
  let ordinal = 2;
  while (articulations.some((item) => item.id === `${source.id} ${ordinal}`)) ordinal += 1;
  return {
    ...source,
    id: `${source.id} ${ordinal}`,
    label: `${source.label} ${ordinal}`,
    selector,
    key: freeArticulationKey(articulations, source.key + 1),
    vel: [...source.vel],
    chain: [...source.chain],
  };
}

function freeArticulationKey(articulations, from) {
  const occupied = new Set(articulations.map((item) => item.key));
  for (let key = from; key <= 127; key += 1) if (!occupied.has(key)) return key;
  for (let key = from - 1; key >= 0; key -= 1) if (!occupied.has(key)) return key;
  return from;
}

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

/*
 * The edit layer is decided by the WORN articulation, never the audition
 * selection: pass the worn id (or null). Dynamic bank slots are valid layer
 * ids, so membership in the static ARTICULATIONS map is not required.
 */
export function resolveParameterEditLayer(targetId, wornArticulationId) {
  const target = TARGETS[targetId];
  const editsOverride =
    target?.workspace === "voice" &&
    Boolean(wornArticulationId) &&
    wornArticulationId !== "Default";

  return editsOverride
    ? { kind: "articulationOverride", articulationId: wornArticulationId }
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
