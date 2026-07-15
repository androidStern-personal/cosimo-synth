import { SourceIcon } from "../../design-system/IdentityMark.jsx";

export function SourceChip({
  source,
  attachmentCount = 0,
  semanticColor,
  selected = false,
  orphan = false,
  dragging = false,
  onFocus,
  pointerHandlers,
}) {
  return (
    <button
      aria-label={`${source.label}, ${attachmentCount} target${attachmentCount === 1 ? "" : "s"}`}
      aria-pressed={selected}
      className="cosimo-source-chip"
      data-dragging={dragging || undefined}
      data-orphan={orphan || undefined}
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
      <span className="cosimo-source-chip__count">{attachmentCount}</span>
      <span aria-hidden="true" className="cosimo-source-chip__semantic-rule" />
    </button>
  );
}
