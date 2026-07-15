import { useAxisDrag } from "../../interactions/useAxisDrag.js";
import { SourceIdentity } from "../../design-system/IdentityMark.jsx";
import { formatSignedPercent } from "../../domain/formatting.js";

export function MappingChip({
  color,
  isSelected,
  mapping,
  onAmountChange,
  onSelect,
  onShowReadout,
  source,
  targetLabel,
}) {
  const drag = useAxisDrag({
    xValue: 0,
    yValue: mapping.amount,
    onYChange(amount) {
      onAmountChange(mapping.id, amount);
      onShowReadout(`${source.label} → ${targetLabel}  ${formatSignedPercent(amount)}`);
    },
  });

  return (
    <button
      {...drag}
      aria-label={`${source.label} mapping, ${formatSignedPercent(mapping.amount)}`}
      className="mapping-chip"
      data-state={isSelected ? "selected" : undefined}
      onClick={onSelect}
      style={{ "--cosimo-semantic-color": color }}
      type="button"
    >
      <SourceIdentity color={color} includeName source={source} size={16} />
      <output className="cosimo-value" data-value-kind="signed">
        {formatSignedPercent(mapping.amount)}
      </output>
    </button>
  );
}
