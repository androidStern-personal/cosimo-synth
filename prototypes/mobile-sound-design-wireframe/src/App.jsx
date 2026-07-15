import { useMemo } from "react";
import { useMockCosimoAdapter } from "./adapters/index.js";
import { ARTICULATIONS, SOURCE_COLORS, TARGETS } from "./domain/catalog.js";
import {
  createInitialMockCosimoState,
  createStressMockCosimoState,
} from "./domain/fixtures.js";
import { useMobileSynthController } from "./controllers/useMobileSynthController.js";
import {
  InstrumentHeader,
  MobileSynthShell,
} from "./features/shell/index.js";
import { EffectRack, VoiceModuleStrip } from "./features/rack/index.js";
import { ModuleEditor } from "./features/module-editor/ModuleEditor.jsx";
import { ModulationInspector } from "./features/modulation/ModulationInspector.jsx";
import { SourceEditor, SourceShelf } from "./features/sources/index.js";
import { AuditionTransport } from "./features/audition/index.js";
import { triggerHaptic } from "./platform/haptics.js";

/**
 * Port-ready product surface. The React tree depends only on the mobile
 * adapter contract; the prototype fixture is injected by App below.
 */
export function CosimoMobileExperience({ adapter, initialSession }) {
  const { state, actions } = useMobileSynthController(adapter, initialSession);
  const sourceColors = useMemo(
    () => Object.fromEntries(
      state.sources.map((source) => [source.id, SOURCE_COLORS[source.id]]),
    ),
    [state.sources],
  );
  const articulations = useMemo(
    () => Object.values(ARTICULATIONS).map((item) => ({
      color: item.color,
      id: item.id,
      label: item.id,
    })),
    [],
  );

  const header = (
    <InstrumentHeader
      activeWorkspaceId={state.workspace}
      isPatchDirty
      onWorkspaceChange={actions.chooseWorkspace}
      patchName="Glass Pluck"
    />
  );

  const rack = state.workspace === "effects" ? (
    <EffectRack
      items={state.rackTiles}
      onEffectEnabledChange={actions.setEffectEnabled}
      onEffectFocus={actions.focusModule}
      onQuickChange={actions.setParameter}
      onReadout={({ label, formattedValue }) => actions.showReadout(`${label}  ${formattedValue}`)}
      onReorder={actions.reorderEffect}
      onRestoreOrder={actions.restoreEffectOrder}
      onHaptic={triggerHaptic}
    />
  ) : (
    <VoiceModuleStrip
      items={state.rackTiles}
      onModuleFocus={actions.focusModule}
      onQuickChange={actions.setParameter}
      onReadout={({ label, formattedValue }) => actions.showReadout(`${label}  ${formattedValue}`)}
    />
  );

  const sourceShelf = (
    <SourceShelf
      addOptions={state.sourceAddOptions}
      addOpen={state.sourceAddOpen}
      attachmentCounts={state.sourceCounts}
      deletionUndo={state.deletedSource}
      draggedSourceId={state.draggedSourceId}
      focusedSourceId={state.focusedSource?.id || state.activeMappingSourceId}
      onAddOpenChange={actions.setSourceAddOpen}
      onAddSource={actions.addSource}
      onDeleteSource={actions.deleteSource}
      onFocusSource={actions.openSource}
      onHaptic={triggerHaptic}
      onSourceDragEnd={({ cancelled }) => (
        cancelled ? actions.cancelSourceDrag() : actions.stopSourceDrag()
      )}
      onSourceDragMove={({ clientX, clientY }) => actions.moveSourceDrag(clientX, clientY)}
      onSourceDragStart={({ sourceId }) => actions.beginSourceDrag(sourceId)}
      onUndoDelete={actions.undoDelete}
      sourceColors={sourceColors}
      sources={state.sources}
    />
  );

  const audition = (
    <AuditionTransport
      articulationId={state.audition.articulation}
      articulations={articulations}
      canCapture={Boolean(state.audition.captureCandidate)}
      captureContext={state.audition.captureCandidate
        ? {
            phase: state.audition.triggerActive ? "REC" : "READY",
            articulation: state.audition.captureCandidate.articulation,
            layer: state.audition.captureCandidate.layer,
            target: `${TARGETS[state.audition.captureCandidate.targetKey]?.moduleLabel || "Target"} ${TARGETS[state.audition.captureCandidate.targetKey]?.label || ""}`.trim(),
          }
        : null}
      latch={state.audition.latch}
      note={state.audition.note}
      onArticulationChange={actions.setArticulation}
      onCapture={() => {
        const sourceId = actions.captureMotion();
        triggerHaptic(sourceId ? "success" : "error");
      }}
      onDefaultArticulation={() => actions.setArticulation("Default")}
      onLatchChange={actions.setLatch}
      onNoteChange={actions.setNote}
      onRepeatChange={actions.setRepeat}
      onTriggerCancel={actions.cancelTrigger}
      onTriggerEnd={actions.endTrigger}
      onTriggerFallback={() => {
        triggerHaptic("light");
        actions.fallbackTrigger();
      }}
      onTriggerStart={() => {
        triggerHaptic("light");
        actions.startTrigger();
      }}
      repeat={state.audition.repeat}
      status={state.audition.status}
      triggerActive={state.audition.triggerActive}
    />
  );

  return (
    <MobileSynthShell
      audition={audition}
      className={state.isDraggingSource ? "is-dragging-source" : ""}
      header={header}
      readout={state.readout}
      rack={rack}
      sourceShelf={sourceShelf}
      style={{
        "--drag-source-color": state.sourceLookup[state.draggedSourceId]?.color,
      }}
    >
      {state.focusedSource ? (
        <SourceEditor
          addTargetOpen={state.sourceTargetAddOpen}
          availableTargets={state.availableTargets}
          capturedSummary={state.focusedSource.capturedMotion
            ? `Captured · ${TARGETS[state.focusedSource.capturedMotion.targetKey]?.moduleLabel || "Target"} ${TARGETS[state.focusedSource.capturedMotion.targetKey]?.label || ""} · ${state.focusedSource.capturedMotion.layer}`
            : null}
          draggedSourceId={state.draggedSourceId}
          dropTargetId={state.dropTargetId}
          onAddTarget={actions.addSourceTarget}
          onAddTargetOpenChange={actions.setSourceTargetAddOpen}
          onBack={actions.closeSource}
          onBaseValueChange={({ targetId, value }) => actions.setParameter(targetId, value)}
          onHaptic={triggerHaptic}
          onMappingAmountChange={({ mappingId, amount }) => actions.changeMappingAmount(mappingId, amount)}
          onClearArticulationOverride={actions.clearArticulationOverride}
          onOpenTarget={({ targetId, mappingId, scrollTop }) => (
            actions.openTargetFromSource(targetId, mappingId, scrollTop)
          )}
          onPolarityChange={({ mappingId, polarity }) => actions.setMappingPolarity(mappingId, polarity)}
          onReducerChange={({ mappingId, reducer }) => actions.setMappingReducer(mappingId, reducer)}
          onRemoveMapping={actions.removeMapping}
          onScrollPositionChange={actions.setSourceScrollTop}
          onSelectMapping={actions.selectSourceMapping}
          onSourceSettingsChange={({ sourceId, patch }) => actions.setSourceSettings(sourceId, patch)}
          onTransientValue={({ label, formattedValue }) => actions.showReadout(`${label}  ${formattedValue}`)}
          restoreScrollTop={state.sourceScrollTop}
          returnLabel={state.sourceCloseLabel}
          selectedMappingId={state.sourceMappingId}
          semanticColor={state.focusedSource.color}
          settings={state.sourceSettings}
          source={state.focusedSource}
          targetRows={state.focusedSourceMappings}
        />
      ) : (
        <div className="cosimo-workspace-stack">
          <ModuleEditor
            compoundControl={state.compoundControl}
            controls={state.parameterControls}
            dropTargetId={state.dropTargetId}
            module={state.activeModule}
            onChangeBase={actions.setParameter}
            onChangeCompound={actions.setCompound}
            onChangeMappingAmount={actions.changeMappingAmount}
            onHaptic={triggerHaptic}
            onSelectTarget={actions.selectTarget}
            onShowReadout={actions.showReadout}
            returnAction={state.returnToSource ? {
              label: `Back to ${state.sourceLookup[state.returnToSource.sourceId]?.label || "source"}`,
              onReturn: actions.returnToSource,
            } : null}
            selectedTargetId={state.selectedTargetId}
          />
          <ModulationInspector
            activeMappingId={state.activeMappingId}
            articulationColor={state.selectedTargetControl.articulationColor}
            articulationOverride={state.selectedTargetControl.articulationOverride}
            availableSources={state.availableSources}
            mappings={state.mappingsForSelectedTarget}
            onAddMapping={actions.addMapping}
            onChangeAmount={actions.changeMappingAmount}
            onClearArticulationOverride={actions.clearArticulationOverride}
            onHaptic={triggerHaptic}
            onOpenSource={actions.openSource}
            onRemoveMapping={actions.removeMapping}
            onSelectMapping={actions.selectMapping}
            onSetPolarity={actions.setMappingPolarity}
            onSetReducer={actions.setMappingReducer}
            onShowReadout={actions.showReadout}
            sourceLookup={state.sourceLookup}
            target={state.selectedTarget}
          />
        </div>
      )}
    </MobileSynthShell>
  );
}

/** Prototype entry point. Production can render CosimoMobileExperience with
 * the iOS/Cmajor adapter without changing any feature component. */
export function App() {
  const fixture = new URLSearchParams(window.location.search).get("fixture");
  const adapter = useMockCosimoAdapter({
    createInitialState: fixture === "stress"
      ? createStressMockCosimoState
      : createInitialMockCosimoState,
  });
  return (
    <CosimoMobileExperience
      adapter={adapter}
      initialSession={{ targetByModule: { phaser: "phaser.depth" } }}
    />
  );
}
