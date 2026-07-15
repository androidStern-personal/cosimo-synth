import { useAxisDrag } from "../../interactions/useAxisDrag.js";
import { ArrowsHorizontal, ArrowsVertical } from "@phosphor-icons/react";
import { ArticulationIcon, SourceIdentity } from "../../design-system/IdentityMark.jsx";

function percent(value) {
  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
}

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
  const mappedValue = Math.max(
    0,
    Math.min(100, control.value + mappingAmount / 2),
  );
  const mappingStart = Math.min(control.value, mappedValue);
  const mappingWidth = Math.abs(mappedValue - control.value);
  const drag = useAxisDrag({
    xValue: control.value,
    yValue: mappingAmount,
    onBegin: onSelect,
    onXChange(value) {
      onChangeBase(value);
      onShowReadout(`${control.label}  ${control.formatValue(value)}`);
    },
    onYChange: activeMapping
      ? (amount) => {
          onChangeMappingAmount(activeMapping.id, amount);
          onShowReadout(`${activeMapping.source.label} → ${control.label}  ${percent(amount)}`);
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
          "--parameter-mapping-start": `${mappingStart}%`,
          "--parameter-mapping-width": `${mappingWidth}%`,
          "--cosimo-semantic-color": control.activeSourceColor,
          "--parameter-edit-color": control.articulationOverride
            ? control.articulationColor
            : "var(--cosimo-color-accent)",
        }}
      >
        <span className="parameter-control__base" />
        {activeMapping && <span className="parameter-control__mapping" />}
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
        <span className="parameter-control__axis"><ArrowsHorizontal aria-hidden="true" size={10} /> X BASE</span>
        <output className="cosimo-value" data-value-kind="signed">
          <ArrowsVertical aria-hidden="true" size={10} />{activeMapping ? `Y ${percent(mappingAmount)}` : "Y NO SOURCE"}
        </output>
      </span>
    </button>
  );
}
