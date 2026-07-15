import { ArrowLeft } from "@phosphor-icons/react";
import { SourceIcon } from "../../design-system/IdentityMark.jsx";
import { TransientValueHUD } from "../../design-system/TransientValueHUD.jsx";
import { SourceShapeEditor } from "./SourceShapeEditor.jsx";
import { SourceTargetList } from "./SourceTargetList.jsx";

export function SourceEditor({
  source,
  settings,
  semanticColor,
  readout,
  returnLabel,
  capturedSummary = null,
  targetRows,
  availableTargets,
  selectedMappingId,
  dropTargetId,
  addTargetOpen,
  restoreScrollTop,
  onBack,
  onSourceSettingsChange,
  onTransientValue,
  onSelectMapping,
  onOpenTarget,
  onBaseValueChange,
  onMappingAmountChange,
  onPolarityChange,
  onReducerChange,
  onRemoveMapping,
  onAddTargetOpenChange,
  onAddTarget,
  onScrollPositionChange,
  onHaptic,
}) {
  return (
    <section aria-label={`${source.label} source editor`} className="cosimo-source-editor">
      <section className="cosimo-source-editor__primary">
        <header className="cosimo-source-editor__header">
          <span
            aria-hidden="true"
            className="cosimo-source-editor__identity"
            style={{ "--cosimo-source-color": semanticColor }}
          >
            <SourceIcon source={source} size={18} />
          </span>
          <span className="cosimo-source-editor__title">
            <strong className="cosimo-type-navigation">{source.label}</strong>
            <TransientValueHUD
              className="cosimo-type-micro"
              fallback={capturedSummary || `${targetRows.length} target${targetRows.length === 1 ? "" : "s"}`}
              value={readout}
            />
          </span>
          <button
            aria-label={`Back to ${returnLabel}`}
            className="cosimo-source-editor__back"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            <span className="cosimo-type-label">{returnLabel}</span>
          </button>
        </header>
        <SourceShapeEditor
          onHaptic={onHaptic}
          onSettingsChange={onSourceSettingsChange}
          onTransientValue={onTransientValue}
          semanticColor={semanticColor}
          settings={settings}
          source={source}
        />
      </section>

      <SourceTargetList
        addOpen={addTargetOpen}
        availableTargets={availableTargets}
        dropTargetId={dropTargetId}
        onAddOpenChange={onAddTargetOpenChange}
        onAddTarget={onAddTarget}
        onBaseValueChange={onBaseValueChange}
        onHaptic={onHaptic}
        onMappingAmountChange={onMappingAmountChange}
        onOpenTarget={onOpenTarget}
        onPolarityChange={onPolarityChange}
        onReducerChange={onReducerChange}
        onRemoveMapping={onRemoveMapping}
        onScrollPositionChange={onScrollPositionChange}
        onSelectMapping={onSelectMapping}
        onTransientValue={onTransientValue}
        restoreScrollTop={restoreScrollTop}
        rows={targetRows}
        selectedMappingId={selectedMappingId}
        semanticColor={semanticColor}
        source={source}
      />
    </section>
  );
}
