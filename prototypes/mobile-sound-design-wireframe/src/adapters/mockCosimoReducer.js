import { ARTICULATIONS, MODULES_BY_ID, TARGETS } from "../domain/catalog.js";
import { clamp, clampModAmount } from "../domain/formatting.js";
import {
  createDefaultSourceState,
  createInitialMockCosimoState,
} from "../domain/fixtures.js";
import { createMapping, defaultSourceSettings } from "../domain/policies.js";

const sourceTypeOrder = { macro: 0, envelope: 1, mseg: 2 };

function describeCandidate(candidate) {
  const target = candidate ? TARGETS[candidate.targetKey] : null;
  return candidate && target
    ? `${candidate.layer} · ${target.moduleLabel} ${target.label}`
    : null;
}

function withMotionCandidate(state, targetId, layer) {
  if (!state.audition.triggerActive) return state.audition;
  const target = TARGETS[targetId];
  const layerLabel = layer.kind === "articulationOverride"
    ? `${layer.articulationId} override`
    : "Patch base";
  const captureCandidate = {
    targetKey: targetId,
    layer: layerLabel,
    articulation: state.audition.articulation,
  };
  return {
    ...state.audition,
    captureCandidate,
    status: `Recording · ${layerLabel} · ${target.moduleLabel} ${target.label}`,
  };
}

function pruneArticulationMappingAmounts(articulationMappingAmounts, keepMappingId) {
  return Object.fromEntries(
    Object.entries(articulationMappingAmounts).map(([articulationId, amounts]) => [
      articulationId,
      Object.fromEntries(
        Object.entries(amounts).filter(([mappingId]) => keepMappingId(mappingId)),
      ),
    ]),
  );
}

function removeSourceFromPatch(patch, sourceId) {
  const mappings = patch.mappings.filter((item) => item.sourceId !== sourceId);
  const keptMappingIds = new Set(mappings.map((item) => item.id));
  return {
    ...patch,
    sources: patch.sources.filter((source) => source.id !== sourceId),
    sourceSettings: Object.fromEntries(
      Object.entries(patch.sourceSettings).filter(([id]) => id !== sourceId),
    ),
    sourceStates: Object.fromEntries(
      Object.entries(patch.sourceStates).filter(([id]) => id !== sourceId),
    ),
    mappings,
    articulationMappingAmounts: pruneArticulationMappingAmounts(
      patch.articulationMappingAmounts,
      (mappingId) => keptMappingIds.has(mappingId),
    ),
  };
}

export function mockCosimoReducer(state, action) {
  switch (action.type) {
    case "SET_PARAMETER": {
      const { targetId, value, layer } = action;
      if (!TARGETS[targetId]) return state;
      const nextValue = clamp(value);
      const patch = layer.kind === "articulationOverride"
        ? {
            ...state.patch,
            articulationOverrides: {
              ...state.patch.articulationOverrides,
              [layer.articulationId]: {
                ...state.patch.articulationOverrides[layer.articulationId],
                [targetId]: nextValue,
              },
            },
          }
        : {
            ...state.patch,
            parameterValues: {
              ...state.patch.parameterValues,
              [targetId]: nextValue,
            },
          };
      return {
        ...state,
        patch,
        audition: withMotionCandidate(state, targetId, layer),
      };
    }

    case "CLEAR_ARTICULATION_OVERRIDE": {
      const current = state.patch.articulationOverrides[action.articulationId];
      const currentAmounts = state.patch.articulationMappingAmounts[action.articulationId] || {};
      const targetMappingIds = new Set(
        state.patch.mappings
          .filter((item) => item.targetKey === action.targetId)
          .map((item) => item.id),
      );
      const hasAmountOverrides = Object.keys(currentAmounts)
        .some((mappingId) => targetMappingIds.has(mappingId));
      if ((!current || current[action.targetId] == null) && !hasAmountOverrides) return state;
      const next = { ...current };
      delete next[action.targetId];
      return {
        ...state,
        patch: {
          ...state.patch,
          articulationOverrides: {
            ...state.patch.articulationOverrides,
            [action.articulationId]: next,
          },
          articulationMappingAmounts: {
            ...state.patch.articulationMappingAmounts,
            [action.articulationId]: Object.fromEntries(
              Object.entries(currentAmounts)
                .filter(([mappingId]) => !targetMappingIds.has(mappingId)),
            ),
          },
        },
      };
    }

    case "SET_EFFECT_ENABLED": {
      if (!MODULES_BY_ID[action.effectId] || MODULES_BY_ID[action.effectId].workspace !== "effects") {
        return state;
      }
      return {
        ...state,
        patch: {
          ...state.patch,
          effectEnabled: {
            ...state.patch.effectEnabled,
            [action.effectId]: Boolean(action.enabled),
          },
        },
      };
    }

    case "REORDER_EFFECT": {
      const fromIndex = state.patch.effectOrder.indexOf(action.effectId);
      const toIndex = state.patch.effectOrder.indexOf(action.overEffectId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return state;
      const effectOrder = [...state.patch.effectOrder];
      const [moving] = effectOrder.splice(fromIndex, 1);
      effectOrder.splice(toIndex, 0, moving);
      return { ...state, patch: { ...state.patch, effectOrder } };
    }

    case "RESTORE_EFFECT_ORDER": {
      if (
        !Array.isArray(action.effectOrder)
        || action.effectOrder.length !== state.patch.effectOrder.length
        || action.effectOrder.some((id) => !state.patch.effectOrder.includes(id))
      ) return state;
      return {
        ...state,
        patch: { ...state.patch, effectOrder: [...action.effectOrder] },
      };
    }

    case "SET_COMPOUND_SETTING":
      if (!TARGETS[action.targetId]) return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          compoundSettings: {
            ...state.patch.compoundSettings,
            [action.targetId]: {
              mode: "Free",
              division: "1/8",
              ...state.patch.compoundSettings[action.targetId],
              ...action.patch,
            },
          },
        },
      };

    case "CREATE_SOURCE":
      if (!action.source || state.patch.sources.some((source) => source.id === action.source.id)) {
        return state;
      }
      return {
        ...state,
        patch: {
          ...state.patch,
          sources: [...state.patch.sources, action.source],
          sourceSettings: {
            ...state.patch.sourceSettings,
            [action.source.id]: defaultSourceSettings(action.source),
          },
          sourceStates: {
            ...state.patch.sourceStates,
            [action.source.id]: createDefaultSourceState(action.source),
          },
        },
        undo: null,
      };

    case "SET_SOURCE_SETTINGS":
      if (!state.patch.sourceSettings[action.sourceId]) return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          sourceSettings: {
            ...state.patch.sourceSettings,
            [action.sourceId]: {
              ...state.patch.sourceSettings[action.sourceId],
              ...action.patch,
            },
          },
        },
      };

    case "SET_MACRO_VALUE": {
      const current = state.patch.sourceStates[action.sourceId];
      if (current?._tag !== "macro") return state;
      const value = clamp(action.value, 0, 1);
      return {
        ...state,
        patch: {
          ...state.patch,
          sourceStates: {
            ...state.patch.sourceStates,
            [action.sourceId]: { ...current, value },
          },
          sourceSettings: {
            ...state.patch.sourceSettings,
            [action.sourceId]: {
              ...state.patch.sourceSettings[action.sourceId],
              value: value * 100,
            },
          },
        },
      };
    }

    case "RENAME_MACRO": {
      const current = state.patch.sourceStates[action.sourceId];
      if (current?._tag !== "macro") return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          sourceStates: {
            ...state.patch.sourceStates,
            [action.sourceId]: { ...current, name: action.name },
          },
        },
      };
    }

    case "SET_ENVELOPE": {
      const current = state.patch.sourceStates[action.sourceId];
      if (current?._tag !== "envelope") return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          sourceStates: {
            ...state.patch.sourceStates,
            [action.sourceId]: {
              ...current,
              envelope: { ...action.envelope },
            },
          },
        },
      };
    }

    case "SET_MSEG_SHAPE": {
      const current = state.patch.sourceStates[action.sourceId];
      if (current?._tag !== "mseg" || (action.shapeIndex !== 0 && action.shapeIndex !== 1)) {
        return state;
      }
      const shapeKey = action.shapeIndex === 0 ? "shapeA" : "shapeB";
      return {
        ...state,
        patch: {
          ...state.patch,
          sourceStates: {
            ...state.patch.sourceStates,
            [action.sourceId]: {
              ...current,
              slot: {
                ...current.slot,
                [shapeKey]: { ...action.shape },
              },
            },
          },
        },
      };
    }

    case "SET_MSEG_MORPH": {
      if (action.layer?.kind === "articulationOverride") {
        throw new Error("deferred: per-articulation morph overrides");
      }
      const current = state.patch.sourceStates[action.sourceId];
      if (current?._tag !== "mseg") return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          sourceStates: {
            ...state.patch.sourceStates,
            [action.sourceId]: {
              ...current,
              slot: { ...current.slot, morph: clamp(action.morph, 0, 1) },
            },
          },
        },
      };
    }

    case "SET_MSEG_PLAYBACK": {
      const current = state.patch.sourceStates[action.sourceId];
      if (current?._tag !== "mseg") return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          sourceStates: {
            ...state.patch.sourceStates,
            [action.sourceId]: {
              ...current,
              slot: { ...current.slot, playback: { ...action.playback } },
            },
          },
        },
      };
    }

    case "DELETE_SOURCE": {
      const source = state.patch.sources.find((candidate) => candidate.id === action.sourceId);
      if (!source) return state;
      return {
        ...state,
        patch: removeSourceFromPatch(state.patch, action.sourceId),
        undo: {
          source,
          settings: state.patch.sourceSettings[action.sourceId],
          sourceState: state.patch.sourceStates[action.sourceId],
          mappings: state.patch.mappings.filter((item) => item.sourceId === action.sourceId),
        },
        audition: { ...state.audition, status: `${source.label} deleted` },
      };
    }

    case "UNDO_DELETE_SOURCE": {
      const deleted = state.undo;
      if (!deleted) return state;
      if (state.patch.sources.some((source) => source.id === deleted.source.id)) {
        return {
          ...state,
          undo: null,
          audition: {
            ...state.audition,
            status: `Undo unavailable · ${deleted.source.label} slot was reused`,
          },
        };
      }
      const existingMappingIds = new Set(state.patch.mappings.map((item) => item.id));
      const sources = [...state.patch.sources, deleted.source].sort(
        (left, right) => sourceTypeOrder[left.type] - sourceTypeOrder[right.type]
          || left.slot - right.slot,
      );
      return {
        ...state,
        undo: null,
        patch: {
          ...state.patch,
          sources,
          sourceSettings: {
            ...state.patch.sourceSettings,
            [deleted.source.id]: { ...deleted.settings },
          },
          sourceStates: {
            ...state.patch.sourceStates,
            [deleted.source.id]: structuredClone(deleted.sourceState),
          },
          mappings: [
            ...state.patch.mappings,
            ...deleted.mappings.filter((item) => !existingMappingIds.has(item.id)),
          ],
        },
        audition: {
          ...state.audition,
          status: `${deleted.source.label} restored`,
        },
      };
    }

    case "ADD_MAPPING":
      if (
        !action.mapping ||
        !TARGETS[action.mapping.targetKey] ||
        state.patch.mappings.some((item) => item.id === action.mapping.id)
      ) {
        return state;
      }
      return {
        ...state,
        patch: {
          ...state.patch,
          mappings: [...state.patch.mappings, action.mapping],
        },
      };

    case "SET_MAPPING_FIELD":
      if (!state.patch.mappings.some((item) => item.id === action.mappingId)) return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          mappings: state.patch.mappings.map((item) =>
            item.id === action.mappingId
              ? { ...item, [action.field]: action.value }
              : item,
          ),
        },
      };

    case "SET_MAPPING_AMOUNT": {
      const mapping = state.patch.mappings.find((item) => item.id === action.mappingId);
      if (!mapping) return state;
      const nextAmount = clampModAmount(TARGETS[mapping.targetKey], action.amount);
      if (action.layer?.kind === "articulationOverride") {
        return {
          ...state,
          patch: {
            ...state.patch,
            articulationMappingAmounts: {
              ...state.patch.articulationMappingAmounts,
              [action.layer.articulationId]: {
                ...state.patch.articulationMappingAmounts[action.layer.articulationId],
                [action.mappingId]: nextAmount,
              },
            },
          },
        };
      }
      return {
        ...state,
        patch: {
          ...state.patch,
          mappings: state.patch.mappings.map((item) =>
            item.id === action.mappingId ? { ...item, amount: nextAmount } : item,
          ),
        },
      };
    }

    // Port values are already expressed in the target's modulation-amount
    // units. Keep the legacy SET_MAPPING_AMOUNT clamp for the prototype hook.
    case "SET_PORT_MAPPING_AMOUNT": {
      const mapping = state.patch.mappings.find((item) => item.id === action.mappingId);
      if (!mapping) return state;
      if (action.layer?.kind === "articulationOverride") {
        return {
          ...state,
          patch: {
            ...state.patch,
            articulationMappingAmounts: {
              ...state.patch.articulationMappingAmounts,
              [action.layer.articulationId]: {
                ...state.patch.articulationMappingAmounts[action.layer.articulationId],
                [action.mappingId]: action.amount,
              },
            },
          },
        };
      }
      return {
        ...state,
        patch: {
          ...state.patch,
          mappings: state.patch.mappings.map((item) =>
            item.id === action.mappingId ? { ...item, amount: action.amount } : item,
          ),
        },
      };
    }

    case "REMOVE_MAPPING":
      return {
        ...state,
        patch: {
          ...state.patch,
          mappings: state.patch.mappings.filter((item) => item.id !== action.mappingId),
          articulationMappingAmounts: pruneArticulationMappingAmounts(
            state.patch.articulationMappingAmounts,
            (mappingId) => mappingId !== action.mappingId,
          ),
        },
      };

    case "SET_AUDITION_ARTICULATION": {
      const known = action.articulationId === "Default"
        || state.patch.articulations.some((item) => item.id === action.articulationId);
      if (!known) return state;
      return {
        ...state,
        audition: { ...state.audition, articulation: action.articulationId },
      };
    }

    case "ADD_ARTICULATION": {
      if (!action.articulation || state.patch.articulations.some((item) => item.id === action.articulation.id)) {
        return state;
      }
      const copyFrom = action.copyOverridesFrom;
      return {
        ...state,
        patch: {
          ...state.patch,
          articulations: [...state.patch.articulations, action.articulation],
          articulationOverrides: {
            ...state.patch.articulationOverrides,
            [action.articulation.id]: { ...(copyFrom ? state.patch.articulationOverrides[copyFrom] : {}) },
          },
          articulationMappingAmounts: {
            ...state.patch.articulationMappingAmounts,
            [action.articulation.id]: { ...(copyFrom ? state.patch.articulationMappingAmounts[copyFrom] : {}) },
          },
        },
      };
    }

    case "DELETE_ARTICULATION": {
      if (!state.patch.articulations.some((item) => item.id === action.articulationId)) return state;
      const dropKey = (record) => Object.fromEntries(
        Object.entries(record).filter(([id]) => id !== action.articulationId),
      );
      return {
        ...state,
        patch: {
          ...state.patch,
          articulations: state.patch.articulations.filter((item) => item.id !== action.articulationId),
          articulationOverrides: dropKey(state.patch.articulationOverrides),
          articulationMappingAmounts: dropKey(state.patch.articulationMappingAmounts),
        },
        audition: state.audition.articulation === action.articulationId
          ? { ...state.audition, articulation: "Default" }
          : state.audition,
      };
    }

    case "SET_ARTICULATION_KEY":
      return {
        ...state,
        patch: {
          ...state.patch,
          articulations: state.patch.articulations.map((item) =>
            item.id === action.articulationId
              ? { ...item, key: clamp(Math.round(action.key), 0, 127) }
              : item,
          ),
        },
      };

    case "SET_ARTICULATION_RANGE": {
      if (action.mode !== "vel" && action.mode !== "chain") return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          articulations: state.patch.articulations.map((item) => {
            if (item.id !== action.articulationId) return item;
            const range = [...item[action.mode]];
            const value = clamp(Math.round(action.value), 0, 127);
            if (action.bound === "lo") range[0] = Math.min(value, range[1]);
            else range[1] = Math.max(value, range[0]);
            return { ...item, [action.mode]: range };
          }),
        },
      };
    }

    case "SET_ARTICULATION_TRIGGER_MODE":
      if (!["key", "vel", "chain"].includes(action.mode)) return state;
      return {
        ...state,
        patch: { ...state.patch, articulationTriggerMode: action.mode },
      };

    case "RESTORE_ARTICULATION_LAYER":
      if (!state.patch.articulations.some((item) => item.id === action.articulationId)) return state;
      return {
        ...state,
        patch: {
          ...state.patch,
          articulationOverrides: {
            ...state.patch.articulationOverrides,
            [action.articulationId]: { ...action.overrides },
          },
          articulationMappingAmounts: {
            ...state.patch.articulationMappingAmounts,
            [action.articulationId]: { ...action.mappingAmounts },
          },
        },
      };

    case "CLEAR_ARTICULATION_BASE_OVERRIDE": {
      const current = state.patch.articulationOverrides[action.articulationId];
      if (!current || current[action.targetId] == null) return state;
      const next = { ...current };
      delete next[action.targetId];
      return {
        ...state,
        patch: {
          ...state.patch,
          articulationOverrides: {
            ...state.patch.articulationOverrides,
            [action.articulationId]: next,
          },
        },
      };
    }

    case "CLEAR_ARTICULATION_MAPPING_AMOUNT": {
      const current = state.patch.articulationMappingAmounts[action.articulationId];
      if (!current || current[action.mappingId] == null) return state;
      const next = { ...current };
      delete next[action.mappingId];
      return {
        ...state,
        patch: {
          ...state.patch,
          articulationMappingAmounts: {
            ...state.patch.articulationMappingAmounts,
            [action.articulationId]: next,
          },
        },
      };
    }

    case "SET_AUDITION_NOTE":
      return { ...state, audition: { ...state.audition, note: action.note } };

    case "SET_REPEAT":
      return { ...state, audition: { ...state.audition, repeat: Boolean(action.enabled) } };

    case "SET_LATCH": {
      const latch = Boolean(action.enabled);
      const releasing = !latch && state.audition.triggerActive;
      const description = describeCandidate(state.audition.captureCandidate);
      return {
        ...state,
        audition: {
          ...state.audition,
          latch,
          triggerActive: releasing ? false : state.audition.triggerActive,
          status: releasing
            ? description ? `Ready · ${description}` : `${state.audition.note} latch released`
            : state.audition.status,
        },
      };
    }

    case "BEGIN_TRIGGER":
      if (state.audition.latch && state.audition.triggerActive) {
        const description = describeCandidate(state.audition.captureCandidate);
        return {
          ...state,
          audition: {
            ...state.audition,
            triggerActive: false,
            status: description
              ? `Ready · ${description}`
              : `${state.audition.note} latch released`,
          },
        };
      }
      return {
        ...state,
        audition: {
          ...state.audition,
          triggerActive: true,
          captureCandidate: null,
          status:
            `${state.audition.note}${
              state.audition.latch
                ? " latched"
                : state.audition.repeat
                  ? " repeating"
                  : " held"
            } · move parameter`,
        },
      };

    case "END_TRIGGER": {
      if (!state.audition.triggerActive) return state;
      if (state.audition.latch) {
        return {
          ...state,
          audition: {
            ...state.audition,
            status: `${state.audition.note} latched${state.audition.repeat ? " · repeat on" : ""}`,
          },
        };
      }
      const description = describeCandidate(state.audition.captureCandidate);
      return {
        ...state,
        audition: {
          ...state.audition,
          triggerActive: false,
          status: description ? `Ready · ${description}` : "Waiting for note",
        },
      };
    }

    case "CANCEL_TRIGGER": {
      const description = describeCandidate(state.audition.captureCandidate);
      return {
        ...state,
        audition: {
          ...state.audition,
          triggerActive: false,
          status: description ? `Ready · ${description}` : "Waiting for note",
        },
      };
    }

    case "CAPTURE_MOTION": {
      const candidate = state.audition.captureCandidate;
      if (!candidate) return state;
      if (!action.source) {
        return {
          ...state,
          audition: { ...state.audition, status: "MSEG full · delete one to capture" },
        };
      }
      const target = TARGETS[candidate.targetKey];
      const capturedSource = {
        ...action.source,
        capturedMotion: { ...candidate },
      };
      const capturedMapping = createMapping(
        candidate.targetKey,
        capturedSource.id,
        clampModAmount(TARGETS[candidate.targetKey], 100),
        "Unipolar",
        "Max",
        {
          capturedLayer: candidate.layer,
          capturedArticulation: candidate.articulation,
        },
      );
      return {
        ...state,
        undo: null,
        patch: {
          ...state.patch,
          sources: [...state.patch.sources, capturedSource],
          sourceSettings: {
            ...state.patch.sourceSettings,
            [capturedSource.id]: defaultSourceSettings(capturedSource),
          },
          sourceStates: {
            ...state.patch.sourceStates,
            [capturedSource.id]: createDefaultSourceState(capturedSource),
          },
          mappings: state.patch.mappings.some((item) => item.id === capturedMapping.id)
            ? state.patch.mappings
            : [...state.patch.mappings, capturedMapping],
        },
        audition: {
          ...state.audition,
          triggerActive: false,
          captureCandidate: null,
          status:
            `Captured · ${candidate.layer} · ${target.moduleLabel} ${target.label} · ${capturedSource.label}`,
        },
      };
    }

    case "RESET":
      return createInitialMockCosimoState();

    default:
      return state;
  }
}
