import { useAxisDrag } from "../../interactions/useAxisDrag.js";
import { ArticulationIcon, SourceIdentity } from "../../design-system/IdentityMark.jsx";
import { formatModAmount, modAmountSpec, modulationBand } from "../../domain/formatting.js";

export function ParameterControl({
  control,
  isDropEligible = true,
  isDropTarget = false,
  isSelected = false,
  onChangeBase,
  onChangeMappingAmount,
  onHaptic,
  onSelect,
  onShowReadout,
  ordinal,
}) {
  const activeMapping = control.activeMapping;
  const mappingAmount = activeMapping?.amount ?? 0;
  const modSpec = modAmountSpec(control.target);
  const band = activeMapping
    ? modulationBand(control.target, control.value, activeMapping)
    : { start: control.value, width: 0 };
  const drag = useAxisDrag({
    xValue: control.value,
    yValue: mappingAmount,
    yMinimum: modSpec.min,
    yMaximum: modSpec.max,
    onBegin: onSelect,
    onXChange(value) {
      onChangeBase(value);
      onShowReadout(`${control.label}  ${control.formatValue(value)}`);
    },
    onYChange: activeMapping
      ? (amount) => {
          onChangeMappingAmount(activeMapping.id, amount);
          onShowReadout(`${activeMapping.source.label} → ${control.label}  ${formatModAmount(control.target, amount, activeMapping.polarity)}`);
        }
      : undefined,
    onAxisLock() {
      onHaptic?.("light");
    },
    onUnsupportedAxis(axis) {
      if (axis === "y") onShowReadout(`${control.label} · choose a source mapping below`);
    },
  });

  return (
    <button
      {...drag}
      aria-label={`Edit ${control.label}`}
      className="parameter-control"
      data-drop-eligible={isDropEligible ? "true" : "false"}
      data-drop-relation={control.dropRelation || "available"}
      data-modulation-target={isDropEligible ? control.targetId : undefined}
      data-state={isSelected ? "selected" : undefined}
      data-drop-target={isDropTarget ? "true" : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const value = Math.max(0, Math.min(100, control.value + direction));
        onSelect?.();
        onChangeBase(value);
        onShowReadout(`${control.label}  ${control.formatValue(value)}`);
      }}
      type="button"
    >
      <span className="parameter-control__heading">
        <span className="cosimo-type-label">P{ordinal} {control.label}</span>
        <span className="parameter-control__identities" aria-hidden="true">
          {control.articulationOverride && (
            <span
              className="parameter-control__articulation"
              style={{ "--cosimo-semantic-color": control.articulationColor }}
            >
              <ArticulationIcon articulation={control.articulationOverride.articulationId} />
            </span>
          )}
          {control.activeSource && (
            <SourceIdentity
              color={control.activeSourceColor}
              size={15}
              source={control.activeSource}
            />
          )}
        </span>
      </span>

      <span
        aria-hidden="true"
        className="parameter-control__track"
        style={{
          "--parameter-base": `${control.value}%`,
          "--parameter-default": `${control.defaultValue}%`,
          "--parameter-mapping-start": `${band.start}%`,
          "--parameter-mapping-width": `${band.width}%`,
          "--cosimo-semantic-color": control.activeSourceColor,
          ...(control.articulationOverride
            ? { "--parameter-edit-color": control.articulationColor }
            : null),
        }}
      >
        <span className="parameter-control__base" />
        {activeMapping && (
          <span
            className="parameter-control__mapping"
            data-disabled={activeMapping.enabled === false || undefined}
          />
        )}
        <span className="parameter-control__default" />
        {control.articulationOverride && (
          <span
            className="parameter-control__patch-base"
            style={{
              borderColor: control.articulationColor,
              insetInlineStart: `${control.patchBaseValue}%`,
            }}
          />
        )}
        <span className="parameter-control__handle" />
      </span>

      <span className="parameter-control__foot">
        <span className="parameter-control__axis">X BASE</span>
        <output className="cosimo-value" data-value-kind="signed">
          {activeMapping ? `Y ${formatModAmount(control.target, mappingAmount, activeMapping.polarity)}` : (
            <>
              <span className="parameter-control__y-full">Y NO SOURCE</span>
              <span className="parameter-control__y-compact">Y —</span>
            </>
          )}
        </output>
      </span>
    </button>
  );
}
