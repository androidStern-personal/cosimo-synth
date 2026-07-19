import { useMemo } from "react";
import { useMockCosimoAdapter } from "./adapters/index.js";
import { FIXED_SOURCES, SOURCE_COLORS, TARGETS } from "./domain/catalog.js";
import {
  createInitialMockCosimoState,
  createStressMockCosimoState,
} from "./domain/fixtures.js";
import { formatModAmount } from "./domain/formatting.js";
import { useMobileSynthController } from "./controllers/useMobileSynthController.js";
import {
  InstrumentHeader,
  MobileSynthShell,
} from "./features/shell/index.js";
import { EffectRack, VoiceModuleStrip } from "./features/rack/index.js";
import { ModuleEditor } from "./features/module-editor/ModuleEditor.jsx";
import { SourceEditor, SourceRail } from "./features/sources/index.js";
import { ArticulationCardStrip, ArticulationWorkspace } from "./features/articulations/index.js";
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
      [...state.sources, ...FIXED_SOURCES].map(
        (source) => [source.id, SOURCE_COLORS[source.id]],
      ),
    ),
    [state.sources],
  );
  const litMappings = useMemo(
    () => Object.fromEntries(
      state.mappingsForSelectedTarget.map((mapping) => [mapping.sourceId, mapping]),
    ),
    [state.mappingsForSelectedTarget],
  );

  const header = (
    <InstrumentHeader
      activeWorkspaceId={state.workspace}
      isPatchDirty
      onCancelWear={actions.cancelWear}
      onCommitWear={actions.commitWear}
      onWorkspaceChange={actions.chooseWorkspace}
      patchName="Glass Pluck"
      wornArticulation={state.wornArticulation}
      workspaces={[
        { id: "voice", label: "Voice / Oscillator" },
        { id: "effects", label: "Effects" },
        { id: "artic", label: "Articulations" },
      ]}
    />
  );

  const rack = state.workspace === "artic" ? (
    <ArticulationCardStrip
      articulations={state.articulations}
      onAdd={actions.addArticulation}
      onDelete={actions.deleteArticulation}
      onDuplicate={actions.duplicateArticulation}
      onHaptic={triggerHaptic}
      onPreviewEnd={actions.previewArticulationEnd}
      onPreviewStart={actions.previewArticulationStart}
      onSelect={actions.selectArticulation}
      overrideCounts={state.articulationOverrideCounts}
      selectedArticulationId={state.selectedArticulation?.id || null}
      triggerMode={state.articulationTriggerMode}
    />
  ) : state.workspace === "effects" ? (
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

  const sourceRail = (
    <SourceRail
      addOptions={state.sourceAddOptions}
      addOpen={state.sourceAddOpen}
      attachmentCounts={state.sourceCounts}
      deletionUndo={state.deletedSource}
      draggedSourceId={state.draggedSourceId}
      fixedSources={FIXED_SOURCES}
      focusedSourceId={state.focusedSource?.id || state.activeMappingSourceId}
      litMappings={litMappings}
      onAddOpenChange={actions.setSourceAddOpen}
      onAddSource={actions.addSource}
      onDeleteSource={actions.deleteSource}
      onFocusMapping={actions.selectMapping}
      onFocusSource={actions.openSource}
      onHaptic={triggerHaptic}
      onRemoveMapping={actions.removeMapping}
      onScrubMappingAmount={(mappingId, amount) => {
        actions.changeMappingAmount(mappingId, amount);
        const mapping = state.mappingsForSelectedTarget.find(
          (item) => item.id === mappingId,
        );
        const sourceLabel = state.sourceLookup[mapping?.sourceId]?.label || "Source";
        actions.showReadout(
          `${sourceLabel} → ${state.selectedTarget.label}  ${formatModAmount(state.selectedTarget, amount, mapping?.polarity)}`,
        );
      }}
      onSetMappingEnabled={actions.setMappingEnabled}
      onSetMappingPolarity={actions.setMappingPolarity}
      onSourceDragEnd={({ cancelled }) => (
        cancelled ? actions.cancelSourceDrag() : actions.stopSourceDrag()
      )}
      onSourceDragMove={({ clientX, clientY }) => actions.moveSourceDrag(clientX, clientY)}
      onSourceDragStart={({ sourceId }) => actions.beginSourceDrag(sourceId)}
      onUndoDelete={actions.undoDelete}
      sourceColors={sourceColors}
      sources={state.sources}
      targetLabel={state.selectedTarget.label}
    />
  );

  const audition = (
    <AuditionTransport
      articulationId={state.audition.articulation}
      articulations={state.transportArticulations}
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
      onToggleWear={(articulationId) => (
        state.wornArticulation?.id === articulationId
          ? actions.commitWear()
          : actions.wearArticulation(articulationId, "latch")
      )}
      repeat={state.audition.repeat}
      status={state.audition.status}
      triggerActive={state.audition.triggerActive}
      wearingArticulationId={state.wornArticulation?.id || null}
    />
  );

  return (
    <MobileSynthShell
      audition={audition}
      className={[
        state.isDraggingSource ? "is-dragging-source" : "",
        state.wornArticulation ? "is-wearing" : "",
      ].join(" ").trim()}
      header={header}
      readout={state.readout}
      rack={rack}
      sourceRail={sourceRail}
      style={{
        "--drag-source-color": state.sourceLookup[state.draggedSourceId]?.color,
        "--cosimo-worn-color": state.wornArticulation?.color,
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
          onSourceSettingsChange={actions.updateSource}
          onTransientValue={({ label, formattedValue }) => actions.showReadout(`${label}  ${formattedValue}`)}
          restoreScrollTop={state.sourceScrollTop}
          returnLabel={state.sourceCloseLabel}
          selectedMappingId={state.sourceMappingId}
          semanticColor={state.focusedSource.color}
          settings={state.sourceSettings}
          source={state.focusedSource}
          targetRows={state.focusedSourceMappings}
        />
      ) : state.workspace === "artic" ? (
        <ArticulationWorkspace
          articulations={state.articulations}
          diffRows={state.articulationDiff}
          onEditDiffRow={(row, value) => (row.kind === "base"
            ? actions.setArticulationBaseOverride(row.targetId, value)
            : actions.setArticulationRouteAmount(row.mappingId, value))}
          onNavigateToTarget={actions.openTargetFromArticulation}
          onRemoveDiffRow={(row) => (row.kind === "base"
            ? actions.removeArticulationBaseOverride(row.targetId)
            : actions.removeArticulationMappingAmount(row.mappingId))}
          onSelectArticulation={actions.selectArticulation}
          onSetKey={actions.setArticulationKey}
          onSetRange={actions.setArticulationRange}
          onSetTriggerMode={actions.setArticulationTriggerMode}
          onShowReadout={actions.showReadout}
          onWear={(articulationId) => actions.wearArticulation(articulationId, "artic")}
          selectedArticulation={state.selectedArticulation}
          triggerMode={state.articulationTriggerMode}
        />
      ) : (
        <div className="cosimo-workspace-stack">
          <ModuleEditor
            compoundControl={state.compoundControl}
            controls={state.parameterControls}
            dropTargetId={state.dropTargetId}
            flashTargetId={state.navFlashTargetId}
            module={state.activeModule}
            onBackToArticulations={actions.returnToArticulation}
            onChangeBase={actions.setParameter}
            onChangeCompound={actions.setCompound}
            onChangeMappingAmount={actions.changeMappingAmount}
            onClearArticulationOverride={actions.clearArticulationOverride}
            onHaptic={triggerHaptic}
            onSelectTarget={actions.selectTarget}
            onShowReadout={actions.showReadout}
            returnAction={state.returnToSource ? {
              label: `Back to ${state.sourceLookup[state.returnToSource.sourceId]?.label || "source"}`,
              onReturn: actions.returnToSource,
            } : null}
            selectedTargetId={state.selectedTargetId}
            showBackToArticulations={state.returnToArtic}
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
