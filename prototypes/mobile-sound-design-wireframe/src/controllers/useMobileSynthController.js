import { useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_MODULES,
  ARTICULATIONS,
  MODULES_BY_ID,
  TARGETS,
  VOICE_MODULES,
} from "../domain/catalog.js";
import { formatValue, modAmountSpec, sourceColor } from "../domain/formatting.js";
import { firstAvailableSourceSlot, resolveParameterEditLayer } from "../domain/policies.js";
import {
  selectArticulationMappingAmount,
  selectAvailableTargetsForSource,
  selectEffectiveMappingAmount,
  selectEffectiveParameterValue,
  selectMappingCounts,
  selectMappingsForSource,
  selectMappingsForTarget,
  selectParameterControlViewModel,
  selectReducerRequirement,
  selectSourceLookup,
} from "../domain/selectors.js";
import { useDragToTarget } from "../interactions/useDragToTarget.js";
import { useTransientReadout } from "../interactions/useTransientReadout.js";
import { triggerHaptic } from "../platform/haptics.js";

const DEFAULT_TARGET_BY_MODULE = Object.freeze(Object.fromEntries(
  ALL_MODULES.map((module) => [module.id, `${module.id}.${module.quick}`]),
));

const DEFAULT_LAST_TWEAKED_BY_MODULE = Object.freeze(Object.fromEntries(
  ALL_MODULES.map((module) => [module.id, module.quick]),
));

const toDisplay = (value) => Number(value) * 100;
const toPort = (value) => Math.max(0, Math.min(1, Number(value) / 100));

function projectNormalizedRecord(values) {
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, toDisplay(value)]),
  );
}

function projectLegacyPatch(snapshot, capturedMotionBySourceId) {
  const { patch } = snapshot;
  const sourceStates = Object.fromEntries(
    patch.sources.map((source) => [source.id, source.state]),
  );
  const sources = patch.sources
    .filter((source) => source.type !== "fixed")
    .map((source) => ({
      id: source.id,
      type: source.type,
      slot: source.slot,
      label: source.label,
      state: source.state,
      ...(capturedMotionBySourceId[source.id]
        ? { capturedMotion: capturedMotionBySourceId[source.id] }
        : null),
    }));

  return {
    parameterValues: projectNormalizedRecord(patch.parameterValues),
    mappings: patch.mappings.map((mapping) => ({
      ...mapping,
      targetKey: mapping.targetId,
    })),
    sources,
    sourceStates,
    sourceSettings: sourceStates,
    effectOrder: patch.effectOrder,
    effectEnabled: patch.effectEnabled,
    compoundSettings: patch.compoundSettings,
    articulations: patch.articulations.map((articulation) => ({
      id: articulation.id,
      label: articulation.label,
      color: articulation.color,
      icon: articulation.icon,
      selector: articulation.selector,
      key: articulation.key,
      vel: [articulation.velRange.min, articulation.velRange.max],
      chain: [articulation.chainRange.min, articulation.chainRange.max],
    })),
    articulationTriggerMode: patch.articulationTriggerMode,
    articulationOverrides: Object.fromEntries(
      Object.entries(patch.articulationOverrides).map(([articulationId, values]) => [
        articulationId,
        projectNormalizedRecord(values),
      ]),
    ),
    articulationMappingAmounts: patch.articulationMappingAmounts,
  };
}

function projectLegacyAudition(audition) {
  return {
    ...audition,
    captureCandidate: audition.captureCandidate === null
      ? null
      : {
          ...audition.captureCandidate,
          targetKey: audition.captureCandidate.targetId,
        },
  };
}

function toPortLayer(layer) {
  return layer.kind === "articulationOverride"
    ? { _tag: "articulationOverride", articulationId: layer.articulationId }
    : { _tag: "patchBase" };
}

function deriveActiveMappings(patch) {
  return patch.mappings.reduce((active, mapping) => {
    if (active[mapping.targetKey]) return active;
    return { ...active, [mapping.targetKey]: mapping.id };
  }, {});
}

const SOURCE_ADD_OPTIONS = Object.freeze([
  { type: "macro", label: "Macro" },
  { type: "envelope", label: "Envelope" },
  { type: "mseg", label: "MSEG" },
]);

/**
 * UI-session controller. Patch/audio state arrives through the adapter so
 * navigation state stays independent from the eventual iOS/Cmajor bridge.
 */
export function useMobileSynthController(adapter, initialSession = {}) {
  const { snapshot, commands } = adapter;
  const portPatch = snapshot.patch;
  const portAudition = snapshot.audition;
  const { readout, showReadout } = useTransientReadout();
  const [capturedMotionBySourceId, setCapturedMotionBySourceId] = useState({});
  const patch = useMemo(
    () => projectLegacyPatch(snapshot, capturedMotionBySourceId),
    [capturedMotionBySourceId, snapshot],
  );
  const audition = useMemo(
    () => projectLegacyAudition(portAudition),
    [portAudition],
  );
  const [workspace, setWorkspace] = useState("effects");
  const [lastInstrumentWorkspace, setLastInstrumentWorkspace] = useState("effects");
  const [moduleByWorkspace, setModuleByWorkspace] = useState({
    effects: "phaser",
    voice: "wavetable",
  });
  const [targetByModule, setTargetByModule] = useState(() => ({
    ...DEFAULT_TARGET_BY_MODULE,
    ...initialSession.targetByModule,
  }));
  const [lastTweakedByModule, setLastTweakedByModule] = useState(
    DEFAULT_LAST_TWEAKED_BY_MODULE,
  );
  const [activeMappingByTarget, setActiveMappingByTarget] = useState(
    () => deriveActiveMappings(patch),
  );
  const [sourceFocusId, setSourceFocusId] = useState(null);
  const [returnContext, setReturnContext] = useState(null);
  const [sourceReturn, setSourceReturn] = useState(null);
  const [deletedSource, setDeletedSource] = useState(null);
  const [sourceAddOpen, setSourceAddOpen] = useState(false);
  const [sourceTargetAddOpen, setSourceTargetAddOpen] = useState(false);
  const [sourceMappingId, setSourceMappingId] = useState(null);
  const [sourceScrollTop, setSourceScrollTop] = useState(0);
  // Worn edit layer: overrides are authored only while this is set.
  const [wornArticulation, setWornArticulation] = useState(null);
  const [selectedArticulationId, setSelectedArticulationId] = useState(
    patch.articulations[0]?.id || null,
  );
  const [returnToArtic, setReturnToArtic] = useState(false);
  const [navFlashTargetId, setNavFlashTargetId] = useState(null);
  const previewRestoreArticulation = useRef(null);
  const triggerFallbackTimer = useRef(null);
  const captureMetadataRef = useRef(null);

  const clearTriggerFallback = () => {
    window.clearTimeout(triggerFallbackTimer.current);
    triggerFallbackTimer.current = null;
  };

  useEffect(() => clearTriggerFallback, []);

  const clearContextNavigation = ({ preserveSourceReturn = false } = {}) => {
    setSourceFocusId(null);
    if (!preserveSourceReturn) {
      setReturnContext(null);
      setSourceReturn(null);
    }
    setSourceMappingId(null);
    setSourceAddOpen(false);
    setSourceTargetAddOpen(false);
  };

  // The Articulations workspace has no module of its own; instrument context
  // (rail, selected target) stays on the last instrument workspace.
  const instrumentWorkspace = workspace === "artic" ? lastInstrumentWorkspace : workspace;
  const activeModuleId = moduleByWorkspace[instrumentWorkspace];
  const activeModule = MODULES_BY_ID[activeModuleId];
  const selectedTargetId = targetByModule[activeModuleId] || `${activeModuleId}.${activeModule.quick}`;
  const selectedTarget = TARGETS[selectedTargetId];
  const wornArticulationId = wornArticulation?.id || null;
  const articulationsById = Object.fromEntries(
    patch.articulations.map((item) => [item.id, item]),
  );
  const selectedArticulation = articulationsById[selectedArticulationId]
    || patch.articulations[0]
    || null;

  const sourceLookup = useMemo(() => {
    const lookup = selectSourceLookup(patch);
    return Object.fromEntries(
      Object.entries(lookup).map(([id, source]) => [
        id,
        { ...source, color: sourceColor(source) },
      ]),
    );
  }, [patch]);

  const selectTarget = (targetId) => {
    const target = TARGETS[targetId];
    if (!target) return;
    setTargetByModule((current) => ({ ...current, [target.moduleId]: targetId }));
    setLastTweakedByModule((current) => ({ ...current, [target.moduleId]: target.id }));
    const mappings = selectMappingsForTarget(patch, targetId);
    if (mappings.length > 0 && !mappings.some((item) => item.id === activeMappingByTarget[targetId])) {
      setActiveMappingByTarget((current) => ({ ...current, [targetId]: mappings[0].id }));
    }
  };

  const focusModule = (moduleId) => {
    const module = MODULES_BY_ID[moduleId];
    if (!module) return;
    setWorkspace(module.workspace);
    setLastInstrumentWorkspace(module.workspace);
    setReturnToArtic(false);
    setNavFlashTargetId(null);
    setModuleByWorkspace((current) => ({ ...current, [module.workspace]: moduleId }));
    selectTarget(targetByModule[moduleId] || `${moduleId}.${module.quick}`);
    clearContextNavigation({ preserveSourceReturn: Boolean(sourceReturn) });
  };

  const chooseWorkspace = (nextWorkspace) => {
    if (!["voice", "effects", "artic"].includes(nextWorkspace)) return;
    setWorkspace(nextWorkspace);
    if (nextWorkspace !== "artic") setLastInstrumentWorkspace(nextWorkspace);
    setReturnToArtic(false);
    setNavFlashTargetId(null);
    clearContextNavigation({ preserveSourceReturn: Boolean(sourceReturn) });
  };

  const setParameter = (targetId, value) => {
    const editLayer = resolveParameterEditLayer(targetId, wornArticulation?.id || null);
    commands.setParameter({
      targetId,
      value: toPort(value),
      layer: toPortLayer(editLayer),
    });
    if (portAudition.triggerActive) {
      captureMetadataRef.current = {
        targetKey: targetId,
        layer: editLayer.kind === "articulationOverride"
          ? `${editLayer.articulationId} override`
          : "Patch base",
        articulation: editLayer.kind === "articulationOverride"
          ? editLayer.articulationId
          : "Default",
      };
    }
    selectTarget(targetId);
  };

  const addMapping = (targetId, sourceId) => {
    const result = commands.addMapping({ targetId, sourceId });
    if (result._tag === "err") {
      if (result.error._tag === "RouteBudgetExceeded") {
        showReadout(`ROUTE BUDGET FULL · ${result.error.budget} OF ${result.error.budget}`);
        triggerHaptic("light");
        return null;
      }
      if (result.error._tag === "MappingAlreadyExists") {
        setActiveMappingByTarget((current) => ({
          ...current,
          [targetId]: result.error.mappingId,
        }));
        return result.error.mappingId;
      }
      return null;
    }
    setActiveMappingByTarget((current) => ({ ...current, [targetId]: result.value }));
    showReadout(`${sourceLookup[sourceId]?.label || "Source"} → ${TARGETS[targetId]?.label || "Target"}`);
    return result.value;
  };

  const removeMapping = (mappingId) => {
    const mapping = patch.mappings.find((item) => item.id === mappingId);
    commands.removeMapping(mappingId);
    if (!mapping) return;
    const replacement = patch.mappings.find(
      (item) => item.targetKey === mapping.targetKey && item.id !== mappingId,
    );
    setActiveMappingByTarget((current) => ({
      ...current,
      [mapping.targetKey]: replacement?.id || null,
    }));
  };

  const openSource = (sourceId, { allowPending = false } = {}) => {
    // Fixed performance sources (velocity/pressure/slide) have no editor.
    if ((!allowPending && !sourceLookup[sourceId]) || sourceLookup[sourceId]?.type === "fixed") return;
    if (!sourceFocusId) {
      setReturnContext({ workspace, moduleId: activeModuleId, targetId: selectedTargetId });
    }
    setSourceFocusId(sourceId);
    setSourceMappingId(null);
    setSourceTargetAddOpen(false);
    setSourceReturn(null);
  };

  const closeSource = () => {
    setSourceFocusId(null);
    if (returnContext) {
      setWorkspace(returnContext.workspace);
      setModuleByWorkspace((current) => ({
        ...current,
        [returnContext.workspace]: returnContext.moduleId,
      }));
      selectTarget(returnContext.targetId);
    }
    setReturnContext(null);
    setSourceReturn(null);
    setSourceTargetAddOpen(false);
  };

  const openTargetFromSource = (targetId, mappingId, scrollTop = 0) => {
    const target = TARGETS[targetId];
    if (!target || !sourceFocusId) return;
    setSourceReturn({ sourceId: sourceFocusId, targetId, mappingId, scrollTop });
    setSourceFocusId(null);
    setWorkspace(target.workspace);
    setModuleByWorkspace((current) => ({ ...current, [target.workspace]: target.moduleId }));
    selectTarget(targetId);
    const mapping = patch.mappings.find((item) => item.id === mappingId)
      || patch.mappings.find(
        (item) => item.targetKey === targetId && item.sourceId === sourceFocusId,
      );
    if (mapping) {
      setActiveMappingByTarget((current) => ({ ...current, [targetId]: mapping.id }));
    }
  };

  const returnToSource = () => {
    if (!sourceReturn) return;
    setSourceFocusId(sourceReturn.sourceId);
    setSourceMappingId(sourceReturn.mappingId || null);
    setSourceScrollTop(sourceReturn.scrollTop || 0);
  };

  const sourceDrag = useDragToTarget({
    resolveTarget(clientX, clientY, sourceId) {
      const targetId = document
        .elementFromPoint(clientX, clientY)
        ?.closest?.("[data-modulation-target]")
        ?.getAttribute("data-modulation-target") || null;
      if (!targetId) return null;
      return targetId;
    },
    onDrop(sourceId, targetId) {
      selectTarget(targetId);
      const existing = patch.mappings.find(
        (mapping) => mapping.targetKey === targetId && mapping.sourceId === sourceId,
      );
      if (existing) {
        setActiveMappingByTarget((current) => ({ ...current, [targetId]: existing.id }));
        showReadout(`${sourceLookup[sourceId]?.label || "Source"} → ${TARGETS[targetId]?.label || "Target"}`);
        triggerHaptic("success");
      } else {
        const mappingId = addMapping(targetId, sourceId);
        if (mappingId) triggerHaptic("success");
      }
    },
    onTargetChange(targetId) {
      if (targetId) triggerHaptic("light");
    },
  });

  const layerArticulationId = wornArticulationId || "Default";
  const layerColor = wornArticulationId
    ? articulationsById[wornArticulationId]?.color
    : (articulationsById[audition.articulation] || ARTICULATIONS[audition.articulation])?.color;
  const mappingsForSelectedTarget = selectMappingsForTarget(patch, selectedTargetId)
    .map((mapping) => ({
      ...mapping,
      amount: selectEffectiveMappingAmount(patch, mapping, layerArticulationId),
      hasAmountOverride:
        selectArticulationMappingAmount(patch, mapping, layerArticulationId) != null,
      modSpec: modAmountSpec(TARGETS[mapping.targetKey]),
      needsReducer: selectReducerRequirement(patch, mapping.id),
    }));
  const activeMappingId = activeMappingByTarget[selectedTargetId]
    || mappingsForSelectedTarget[0]?.id
    || null;

  const parameterControls = activeModule.params.map((parameter) => {
    const targetId = `${activeModule.id}.${parameter.id}`;
    const viewModel = selectParameterControlViewModel(
      patch,
      audition,
      targetId,
      patch.mappings.find((item) => item.id === activeMappingByTarget[targetId])?.sourceId,
      wornArticulationId,
    );
    return {
      ...viewModel,
      activeMapping: viewModel.activeMapping
        ? {
            ...viewModel.activeMapping,
            source: sourceLookup[viewModel.activeMapping.sourceId],
          }
        : null,
      articulationColor: layerColor,
      formatValue: (value) => formatValue(viewModel.target, value),
      isDropEligible: true,
      dropRelation: sourceDrag.draggedId && patch.mappings.some(
        (item) => item.targetKey === targetId && item.sourceId === sourceDrag.draggedId,
      ) ? "existing" : "available",
    };
  });

  const rackTiles = patch.effectOrder.map((effectId) => {
    const effect = MODULES_BY_ID[effectId];
    const parameterId = lastTweakedByModule[effectId] || effect.quick;
    const target = TARGETS[`${effectId}.${parameterId}`];
    const value = patch.parameterValues[target.key];
    return {
      id: effectId,
      label: effect.label,
      enabled: patch.effectEnabled[effectId] !== false,
      isSelected: activeModuleId === effectId && workspace === "effects",
      quick: {
        defaultValue: target.defaultValue,
        format: (nextValue) => formatValue(target, nextValue),
        formattedValue: formatValue(target, value),
        label: target.label,
        targetId: target.key,
        value,
        valueKind: target.format,
      },
    };
  });

  const voiceTiles = VOICE_MODULES.map((module) => {
    const parameterId = lastTweakedByModule[module.id] || module.quick;
    const target = TARGETS[`${module.id}.${parameterId}`];
    const value = selectEffectiveParameterValue(patch, target.key, layerArticulationId);
    const override = layerArticulationId === "Default"
      ? null
      : patch.articulationOverrides[layerArticulationId]?.[target.key];
    return {
      id: module.id,
      label: module.label,
      enabled: true,
      isSelected: activeModuleId === module.id && workspace === "voice",
      quick: {
        defaultValue: target.defaultValue,
        format: (nextValue) => formatValue(target, nextValue),
        formattedValue: formatValue(target, value),
        label: target.label,
        targetId: target.key,
        value,
        valueKind: target.format,
        patchBaseValue: patch.parameterValues[target.key],
        articulationColor: layerColor,
        articulationOverride: override == null
          ? null
          : { articulationId: layerArticulationId, value: override },
      },
    };
  });

  const compoundParameter = activeModule.params.find((parameter) => parameter.compound);
  const compoundTargetId = compoundParameter
    ? `${activeModule.id}.${compoundParameter.id}`
    : null;
  const compoundControl = compoundTargetId
    ? {
        label: compoundParameter.label,
        targetId: compoundTargetId,
        setting: {
          mode: "Free",
          division: "1/8",
          ...patch.compoundSettings[compoundTargetId],
        },
      }
    : null;

  const focusedSource = sourceFocusId ? sourceLookup[sourceFocusId] : null;
  const focusedSourceMappings = focusedSource
    ? selectMappingsForSource(patch, focusedSource.id).map((mapping) => {
        const control = selectParameterControlViewModel(
          patch,
          audition,
          mapping.targetKey,
          focusedSource.id,
        );
        return {
          articulationColor: layerColor,
          articulationOverride: control.articulationOverride,
          baseValue: control.value,
          formatValue: (value) => formatValue(TARGETS[mapping.targetKey], value),
          formattedBaseValue: formatValue(
            TARGETS[mapping.targetKey],
            control.value,
          ),
          mapping: {
            ...mapping,
            amount: selectEffectiveMappingAmount(patch, mapping, layerArticulationId),
            hasAmountOverride:
              selectArticulationMappingAmount(patch, mapping, layerArticulationId) != null,
            modSpec: modAmountSpec(TARGETS[mapping.targetKey]),
          },
          needsReducer: selectReducerRequirement(patch, mapping.id),
          patchBaseValue: control.patchBaseValue,
          target: TARGETS[mapping.targetKey],
        };
      })
    : [];

  const articulationDiff = selectedArticulation
    ? [
        ...Object.entries(patch.articulationOverrides[selectedArticulation.id] || {})
          .map(([targetId, value]) => ({
            kind: "base",
            id: `base:${targetId}`,
            targetId,
            target: TARGETS[targetId],
            base: patch.parameterValues[targetId],
            value,
          }))
          .filter((row) => row.target),
        ...Object.entries(patch.articulationMappingAmounts[selectedArticulation.id] || {})
          .map(([mappingId, value]) => {
            const mapping = patch.mappings.find((item) => item.id === mappingId);
            if (!mapping) return null;
            const target = TARGETS[mapping.targetKey];
            return {
              kind: "route",
              id: `route:${mappingId}`,
              mappingId,
              targetId: mapping.targetKey,
              target,
              source: sourceLookup[mapping.sourceId],
              modSpec: modAmountSpec(target),
              polarity: mapping.polarity,
              base: mapping.amount,
              value,
            };
          })
          .filter(Boolean),
      ]
    : [];

  const articulationOverrideCounts = Object.fromEntries(
    patch.articulations.map((item) => [
      item.id,
      Object.keys(patch.articulationOverrides[item.id] || {}).length
        + Object.keys(patch.articulationMappingAmounts[item.id] || {}).length,
    ]),
  );

  const exitWear = (commit) => {
    if (!wornArticulation) return;
    if (!commit) {
      commands.restoreArticulationLayer(wornArticulation.id, wornArticulation.backup);
    }
    const fromArtic = wornArticulation.entry === "artic";
    setWornArticulation(null);
    if (fromArtic) setWorkspace("artic");
    showReadout(commit
      ? `${wornArticulation.id} saved`
      : `${wornArticulation.id} edits discarded`);
    triggerHaptic(commit ? "success" : "light");
  };

  return {
    state: {
      activeMappingId,
      activeMappingSourceId: mappingsForSelectedTarget
        .find((item) => item.id === activeMappingId)?.sourceId || null,
      activeModule,
      activeModuleId,
      articulations: patch.articulations,
      articulationDiff,
      articulationOverrideCounts,
      articulationTriggerMode: patch.articulationTriggerMode,
      selectedArticulation,
      wornArticulation: wornArticulation
        ? {
            id: wornArticulation.id,
            entry: wornArticulation.entry,
            label: articulationsById[wornArticulation.id]?.label || wornArticulation.id,
            color: articulationsById[wornArticulation.id]?.color,
          }
        : null,
      returnToArtic,
      navFlashTargetId,
      transportArticulations: [
        { id: "Default", label: "Default", color: ARTICULATIONS.Default.color },
        ...patch.articulations.map(({ id, label, color }) => ({ id, label, color })),
      ],
      audition,
      compoundControl,
      deletedSource,
      draggedSourceId: sourceDrag.draggedId,
      dropTargetId: sourceDrag.targetId,
      focusedSource,
      focusedSourceMappings,
      isDraggingSource: Boolean(sourceDrag.draggedId),
      mappingsForSelectedTarget,
      parameterControls,
      patch,
      rackTiles: workspace === "effects" ? rackTiles : voiceTiles,
      readout,
      returnToSource: sourceReturn,
      selectedTarget,
      selectedTargetId,
      sourceCounts: selectMappingCounts(patch),
      sourceCloseLabel: MODULES_BY_ID[returnContext?.moduleId]?.label || activeModule.label,
      sourceAddOpen,
      sourceAddOptions: SOURCE_ADD_OPTIONS.map((option) => ({
        ...option,
        available: firstAvailableSourceSlot(patch.sources, option.type) != null,
      })),
      sourceLookup,
      sources: patch.sources,
      sourceSettings: focusedSource ? patch.sourceSettings[focusedSource.id] : null,
      sourceMappingId,
      sourceScrollTop,
      sourceTargetAddOpen,
      availableTargets: focusedSource
        ? selectAvailableTargetsForSource(patch, focusedSource.id)
        : [],
      workspace,
    },
    actions: {
      addSource(type) {
        const result = commands.createSource(type);
        setSourceAddOpen(false);
        setDeletedSource(null);
        if (result._tag === "err") {
          showReadout(`ALL ${type.toUpperCase()} SLOTS IN USE`);
          return;
        }
        openSource(result.value, { allowPending: true });
      },
      beginSourceDrag: sourceDrag.begin,
      cancelSourceDrag: () => sourceDrag.finish(true),
      addSourceTarget(targetId) {
        if (!focusedSource) return;
        const mappingId = addMapping(targetId, focusedSource.id);
        if (mappingId) setSourceMappingId(mappingId);
      },
      captureMotion() {
        const targetId = portAudition.captureCandidate?.targetId;
        const sourceId = commands.captureMotion();
        if (!sourceId) return null;
        const capturedMotion = captureMetadataRef.current?.targetKey === targetId
          ? captureMetadataRef.current
          : {
              targetKey: targetId,
              layer: "Patch base",
              articulation: "Default",
            };
        setCapturedMotionBySourceId((current) => ({
          ...current,
          [sourceId]: capturedMotion,
        }));
        setDeletedSource(null);
        if (targetId) {
          const target = TARGETS[targetId];
          const mappingId = `${targetId}::${sourceId}`;
          setActiveMappingByTarget((current) => ({
            ...current,
            [targetId]: mappingId,
          }));
          setWorkspace(target.workspace);
          setModuleByWorkspace((current) => ({
            ...current,
            [target.workspace]: target.moduleId,
          }));
          setTargetByModule((current) => ({
            ...current,
            [target.moduleId]: targetId,
          }));
          setReturnContext({
            workspace: target.workspace,
            moduleId: target.moduleId,
            targetId,
          });
          setSourceFocusId(sourceId);
          setSourceMappingId(mappingId);
          setSourceScrollTop(0);
          setSourceReturn(null);
        }
        return sourceId;
      },
      cancelTrigger() {
        clearTriggerFallback();
        commands.cancelTrigger();
      },
      changeMappingAmount: (mappingId, amount) => {
        const mapping = patch.mappings.find((item) => item.id === mappingId);
        if (!mapping) return;
        commands.setMappingAmount(
          mappingId,
          amount,
          toPortLayer(resolveParameterEditLayer(
            mapping.targetKey,
            wornArticulation?.id || null,
          )),
        );
      },
      chooseWorkspace,
      wearArticulation(articulationId, entry = "latch") {
        if (!articulationsById[articulationId]) return;
        setWornArticulation({
          id: articulationId,
          entry,
          backup: {
            overrides: { ...portPatch.articulationOverrides[articulationId] },
            mappingAmounts: { ...portPatch.articulationMappingAmounts[articulationId] },
          },
        });
        if (entry === "artic") setWorkspace(lastInstrumentWorkspace);
        showReadout(`Editing ${articulationId} · ✓ keeps · ✕ discards`);
        triggerHaptic("light");
      },
      commitWear: () => exitWear(true),
      cancelWear: () => exitWear(false),
      selectArticulation: setSelectedArticulationId,
      addArticulation() {
        const result = commands.addArticulation();
        if (result._tag === "ok") setSelectedArticulationId(result.value);
      },
      duplicateArticulation(articulationId) {
        const result = commands.duplicateArticulation(articulationId);
        if (result._tag === "ok") setSelectedArticulationId(result.value);
      },
      deleteArticulation(articulationId) {
        commands.deleteArticulation(articulationId);
        if (selectedArticulationId === articulationId) {
          setSelectedArticulationId(
            patch.articulations.find((item) => item.id !== articulationId)?.id || null,
          );
        }
        if (wornArticulation?.id === articulationId) setWornArticulation(null);
      },
      setArticulationKey(articulationId, wantKey) {
        const walk = commands.setArticulationKey(articulationId, wantKey);
        if (walk?.touching) triggerHaptic("light");
        return walk;
      },
      setArticulationRange(articulationId, mode, bound, value) {
        const clamp = commands.setArticulationRange(
          articulationId,
          mode,
          bound === "lo" ? "min" : "max",
          value,
        );
        if (clamp?.touching) triggerHaptic("light");
        return clamp;
      },
      setArticulationTriggerMode: commands.setArticulationTriggerMode,
      setArticulationBaseOverride(targetId, value) {
        if (!selectedArticulation) return;
        commands.setParameter({
          targetId,
          value: toPort(value),
          layer: {
            _tag: "articulationOverride",
            articulationId: selectedArticulation.id,
          },
        });
      },
      setArticulationRouteAmount(mappingId, amount) {
        if (!selectedArticulation) return;
        commands.setMappingAmount(mappingId, amount, {
          _tag: "articulationOverride",
          articulationId: selectedArticulation.id,
        });
      },
      removeArticulationBaseOverride(targetId) {
        if (!selectedArticulation) return;
        commands.clearArticulationBaseOverride(targetId, selectedArticulation.id);
      },
      removeArticulationMappingAmount(mappingId) {
        if (!selectedArticulation) return;
        commands.clearArticulationMappingAmount(mappingId, selectedArticulation.id);
      },
      openTargetFromArticulation(targetId) {
        const target = TARGETS[targetId];
        if (!target) return;
        setWorkspace(target.workspace);
        setLastInstrumentWorkspace(target.workspace);
        setModuleByWorkspace((current) => ({ ...current, [target.workspace]: target.moduleId }));
        selectTarget(targetId);
        setReturnToArtic(true);
        setNavFlashTargetId(targetId);
      },
      returnToArticulation() {
        setWorkspace("artic");
        setReturnToArtic(false);
        setNavFlashTargetId(null);
      },
      previewArticulationStart(articulationId) {
        previewRestoreArticulation.current = audition.articulation;
        commands.setAuditionArticulation(articulationId);
        commands.beginTrigger();
      },
      previewArticulationEnd() {
        commands.endTrigger();
        if (previewRestoreArticulation.current != null) {
          commands.setAuditionArticulation(previewRestoreArticulation.current);
          previewRestoreArticulation.current = null;
        }
      },
      clearArticulationOverride(targetId = selectedTargetId) {
        const target = TARGETS[targetId];
        if (!target) return;
        if (layerArticulationId === "Default") return;
        commands.clearArticulationOverride(targetId, layerArticulationId);
        showReadout(`${layerArticulationId} · ${target.label} override cleared`);
        triggerHaptic("success");
      },
      closeSource,
      deleteSource(sourceId) {
        const source = sourceLookup[sourceId];
        const uiContext = {
          activeMappingByTarget,
          moduleByWorkspace,
          returnContext,
          sourceFocusId,
          sourceMappingId,
          sourceReturn,
          sourceScrollTop,
          targetByModule,
          workspace,
          capturedMotion: capturedMotionBySourceId[sourceId] || null,
        };
        commands.deleteSource(sourceId);
        setCapturedMotionBySourceId((current) => Object.fromEntries(
          Object.entries(current).filter(([id]) => id !== sourceId),
        ));
        setDeletedSource(source ? { source, uiContext } : null);
        if (sourceFocusId === sourceId) closeSource();
      },
      endTrigger() {
        clearTriggerFallback();
        commands.endTrigger();
      },
      fallbackTrigger() {
        clearTriggerFallback();
        commands.beginTrigger();
        if (audition.latch) return;
        triggerFallbackTimer.current = window.setTimeout(() => {
          triggerFallbackTimer.current = null;
          commands.endTrigger();
        }, 180);
      },
      focusModule,
      moveSourceDrag: sourceDrag.move,
      openSource,
      openTargetFromSource,
      removeMapping,
      reorderEffect: commands.reorderEffect,
      restoreEffectOrder: commands.restoreEffectOrder,
      returnToSource,
      selectMapping(mappingId) {
        setActiveMappingByTarget((current) => ({
          ...current,
          [selectedTargetId]: mappingId,
        }));
      },
      selectSourceMapping: setSourceMappingId,
      selectTarget,
      setArticulation: commands.setAuditionArticulation,
      setCompound: commands.setCompoundSetting,
      setEffectEnabled: commands.setEffectEnabled,
      setLatch: commands.setLatchEnabled,
      setMappingEnabled: commands.setMappingEnabled,
      setMappingPolarity: commands.setMappingPolarity,
      setMappingReducer: commands.setMappingReducer,
      setNote: commands.setAuditionNote,
      setParameter,
      setRepeat: commands.setRepeatEnabled,
      setSourceAddOpen,
      updateSource(intent) {
        if (intent.kind === "macroValue") {
          commands.setMacroValue(intent.sourceId, intent.value);
          return;
        }
        if (intent.kind === "envelope") {
          commands.setEnvelope(intent.sourceId, intent.envelope);
          return;
        }
        if (intent.kind === "msegShape") {
          commands.setMsegShape({
            sourceId: intent.sourceId,
            shapeIndex: intent.shapeIndex,
            shape: intent.shape,
          });
          return;
        }
        if (intent.kind === "msegMorph") {
          commands.setMsegMorph({
            sourceId: intent.sourceId,
            morph: intent.morph,
            layer: { _tag: "patchBase" },
          });
          return;
        }
        if (intent.kind === "msegPlayback") {
          commands.setMsegPlayback({
            sourceId: intent.sourceId,
            playback: intent.playback,
          });
        }
      },
      setSourceScrollTop,
      setSourceTargetAddOpen,
      showReadout,
      startTrigger() {
        clearTriggerFallback();
        commands.beginTrigger();
      },
      stopSourceDrag: () => sourceDrag.finish(false),
      undoDelete() {
        commands.undoDeleteSource();
        const uiContext = deletedSource?.uiContext;
        if (uiContext) {
          setActiveMappingByTarget(uiContext.activeMappingByTarget);
          setModuleByWorkspace(uiContext.moduleByWorkspace);
          setReturnContext(uiContext.returnContext);
          setSourceFocusId(uiContext.sourceFocusId);
          setSourceMappingId(uiContext.sourceMappingId);
          setSourceReturn(uiContext.sourceReturn);
          setSourceScrollTop(uiContext.sourceScrollTop);
          setTargetByModule(uiContext.targetByModule);
          setWorkspace(uiContext.workspace);
          if (uiContext.capturedMotion) {
            setCapturedMotionBySourceId((current) => ({
              ...current,
              [deletedSource.source.id]: uiContext.capturedMotion,
            }));
          }
        }
        setDeletedSource(null);
        triggerHaptic("success");
      },
    },
  };
}
