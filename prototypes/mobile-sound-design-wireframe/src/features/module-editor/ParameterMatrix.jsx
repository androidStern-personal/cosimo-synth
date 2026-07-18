import { ParameterControl } from "./ParameterControl.jsx";

export function ParameterMatrix({
  controls,
  dropTargetId,
  flashTargetId = null,
  onChangeBase,
  onChangeMappingAmount,
  onHaptic,
  onSelect,
  onShowReadout,
  selectedTargetId,
}) {
  return (
    <div
      aria-label="Module parameters"
      className="parameter-matrix"
      data-control-count={controls.length}
      role="group"
    >
      {controls.map((control, index) => (
        <ParameterControl
          control={control}
          isDropEligible={control.isDropEligible}
          isDropTarget={dropTargetId === control.targetId}
          isFlashing={flashTargetId === control.targetId}
          isSelected={selectedTargetId === control.targetId}
          key={control.targetId}
          ordinal={index + 1}
          onChangeBase={(value) => onChangeBase(control.targetId, value)}
          onChangeMappingAmount={onChangeMappingAmount}
          onHaptic={onHaptic}
          onSelect={() => onSelect(control.targetId)}
          onShowReadout={onShowReadout}
        />
      ))}
    </div>
  );
}
