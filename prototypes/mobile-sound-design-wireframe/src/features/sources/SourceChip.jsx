import { SourceIcon } from "../../design-system/IdentityMark.jsx";
import { formatModAmountWithSpec } from "../../domain/formatting.js";

export function SourceChip({
  source,
  mapping = null,
  attachmentCount = 0,
  semanticColor,
  selected = false,
  dragging = false,
  onFocus,
  pointerHandlers,
}) {
  const formattedAmount = mapping
    ? formatModAmountWithSpec(mapping.modSpec, mapping.amount, mapping.polarity)
    : "";
  const disabled = mapping ? mapping.enabled === false : false;
  return (
    <button
      aria-label={mapping
        ? `${source.label}, ${formattedAmount} to the selected parameter${disabled ? ", disabled" : ""}`
        : `${source.label}, ${attachmentCount} target${attachmentCount === 1 ? "" : "s"}`}
      aria-pressed={selected}
      className="cosimo-source-chip"
      data-disabled={disabled || undefined}
      data-dragging={dragging || undefined}
      data-lit={mapping ? "true" : undefined}
      data-selected={selected || undefined}
      onClick={onFocus}
      style={{ "--cosimo-source-color": semanticColor }}
      title={source.label}
      type="button"
      {...pointerHandlers}
    >
      <span aria-hidden="true" className="cosimo-source-chip__identity">
        <SourceIcon source={source} size={20} />
        {source.slot != null && (
          <span className="cosimo-source-chip__slot">{source.slot}</span>
        )}
      </span>
      <output
        aria-hidden={mapping ? undefined : "true"}
        className="cosimo-value cosimo-source-chip__amount"
        data-value-kind="signed"
      >
        {formattedAmount}
      </output>
      <span className="cosimo-source-chip__count">{attachmentCount}</span>
      <span aria-hidden="true" className="cosimo-source-chip__semantic-rule" />
    </button>
  );
}
