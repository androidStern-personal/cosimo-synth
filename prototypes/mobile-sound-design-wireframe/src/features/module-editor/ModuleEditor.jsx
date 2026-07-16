import { CompoundControls } from "./CompoundControls.jsx";
import { ArrowLeft } from "@phosphor-icons/react";
import { ModuleGraphicSurface } from "./graphics/index.js";
import { ParameterMatrix } from "./ParameterMatrix.jsx";

export function ModuleEditor({
  compoundControl,
  controls,
  dropTargetId,
  module,
  onChangeBase,
  onChangeCompound,
  onChangeMappingAmount,
  onHaptic,
  onSelectTarget,
  onShowReadout,
  returnAction = null,
  selectedTargetId,
}) {
  const values = Object.fromEntries(
    controls.map((control) => [control.target.id, control.value]),
  );

  return (
    <section className="module-editor" aria-labelledby="module-editor-title">
      <header className="module-editor__header">
        <div className="module-editor__title">
          <h1 className="cosimo-type-display" id="module-editor-title">{module.label}</h1>
          <p className="cosimo-type-micro">
            {module.workspace === "effects" ? "GLOBAL EFFECT · PATCH BASE" : "PER-NOTE VOICE"}
          </p>
        </div>
        <div className="module-editor__context">
          {returnAction && (
            <button className="module-editor__return" onClick={returnAction.onReturn} type="button">
              <ArrowLeft aria-hidden="true" size={13} />
              <span className="cosimo-type-label">{returnAction.label}</span>
            </button>
          )}
        </div>
      </header>

      <div className="module-editor__graphic cosimo-frame">
        <ModuleGraphicSurface
          ariaLabel={module.graphicLabel}
          className="module-editor__canvas"
          moduleId={module.id}
          onAxesChange={({ changes, parameterId, phase }) => {
            Object.entries(changes).forEach(([changedParameterId, value]) => {
              const targetId = `${module.id}.${changedParameterId}`;
              onChangeBase(targetId, value);
              if (phase !== "end") {
                const control = controls.find((item) => item.targetId === targetId);
                if (control) onShowReadout(`${control.label}  ${control.formatValue(value)}`);
              }
            });
            if (phase === "start") onSelectTarget(`${module.id}.${parameterId}`);
          }}
          onGraphicFocus={({ parameterId }) => onSelectTarget(`${module.id}.${parameterId}`)}
          onHaptic={onHaptic}
          values={values}
        />
        {compoundControl && (
          <CompoundControls
            label={compoundControl.label}
            onChange={onChangeCompound}
            setting={compoundControl.setting}
            targetId={compoundControl.targetId}
          />
        )}
      </div>

      <ParameterMatrix
        controls={controls}
        dropTargetId={dropTargetId}
        onChangeBase={onChangeBase}
        onChangeMappingAmount={onChangeMappingAmount}
        onHaptic={onHaptic}
        onSelect={onSelectTarget}
        onShowReadout={onShowReadout}
        selectedTargetId={selectedTargetId}
      />
    </section>
  );
}
