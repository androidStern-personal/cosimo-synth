import { ArrowLeft } from "@phosphor-icons/react";
import { TransientValueHUD } from "../../design-system/TransientValueHUD.jsx";
import { MappingDetail } from "./MappingDetail.jsx";
import { ParameterControl } from "../module-editor/ParameterControl.jsx";
import { SourceShapeEditor } from "../sources/SourceShapeEditor.jsx";

export function MappingFocusEditor({
  mapping,
  onBack,
  onChangeBase,
  onChangeAmount,
  onOpenSource,
  onRemoveMapping,
  onSetPolarity,
  onSetReducer,
  onShowReadout,
  onSourceSettingsChange,
  parameterControl,
  readout,
  source,
  sourceSettings,
  target,
}) {
  return (
    <section className="mapping-focus-editor" aria-label={`${target.label} mapping editor`}>
      <header className="mapping-focus-editor__header">
        <button onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={17} />
          <span className="cosimo-type-label">BACK TO {target.moduleLabel}</span>
        </button>
        <div>
          <strong className="cosimo-type-navigation">{target.label}</strong>
          <TransientValueHUD
            className="cosimo-type-micro"
            fallback={`${source.label} RELATIONSHIP`}
            value={readout}
          />
        </div>
      </header>
      <div className="mapping-focus-editor__target">
        <ParameterControl
          control={parameterControl}
          isSelected
          onChangeBase={onChangeBase}
          onChangeMappingAmount={onChangeAmount}
          onSelect={() => {}}
          onShowReadout={onShowReadout}
          ordinal={target.ordinal}
        />
      </div>
      <div className="mapping-focus-editor__source">
        <SourceShapeEditor
          onSettingsChange={({ patch }) => onSourceSettingsChange(source.id, patch)}
          onTransientValue={({ label, formattedValue }) => onShowReadout(`${label}  ${formattedValue}`)}
          semanticColor={source.color}
          settings={sourceSettings}
          source={source}
        />
      </div>
      <div className="mapping-focus-editor__detail">
        <MappingDetail
          color={source.color}
          mapping={mapping}
          needsReducer={mapping.needsReducer}
          onAmountChange={onChangeAmount}
          onOpenSource={onOpenSource}
          onRemove={onRemoveMapping}
          onSetPolarity={onSetPolarity}
          onSetReducer={onSetReducer}
          onShowReadout={onShowReadout}
          source={source}
          targetLabel={target.label}
        />
      </div>
    </section>
  );
}
