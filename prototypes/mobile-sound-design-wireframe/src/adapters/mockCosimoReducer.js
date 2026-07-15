import { ARTICULATIONS, MODULES_BY_ID, TARGETS } from "../domain/catalog.js";
import { clamp } from "../domain/formatting.js";
import { createInitialMockCosimoState } from "../domain/fixtures.js";
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

function removeSourceFromPatch(patch, sourceId) {
  return {
    ...patch,
    sources: patch.sources.filter((source) => source.id !== sourceId),
    sourceSettings: Object.fromEntries(
      Object.entries(patch.sourceSettings).filter(([id]) => id !== sourceId),
    ),
    mappings: patch.mappings.filter((item) => item.sourceId !== sourceId),
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

    case "DELETE_SOURCE": {
      const source = state.patch.sources.find((candidate) => candidate.id === action.sourceId);
      if (!source) return state;
      return {
        ...state,
        patch: removeSourceFromPatch(state.patch, action.sourceId),
        undo: {
          source,
          settings: state.patch.sourceSettings[action.sourceId],
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

    case "REMOVE_MAPPING":
      return {
        ...state,
        patch: {
          ...state.patch,
          mappings: state.patch.mappings.filter((item) => item.id !== action.mappingId),
        },
      };

    case "SET_AUDITION_ARTICULATION":
      if (!ARTICULATIONS[action.articulationId]) return state;
      return {
        ...state,
        audition: { ...state.audition, articulation: action.articulationId },
      };

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
        100,
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
