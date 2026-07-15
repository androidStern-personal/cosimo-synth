import { ArrowSquareOut, Trash } from "@phosphor-icons/react";
import { SourceIdentity } from "../../design-system/IdentityMark.jsx";
import { formatSignedPercent } from "../../domain/formatting.js";

export function MappingDetail({
  color,
  mapping,
  needsReducer,
  onOpenSource,
  onRemove,
  onSetPolarity,
  onSetReducer,
  source,
  targetLabel,
}) {
  if (!mapping || !source) {
    return (
      <div className="mapping-detail mapping-detail--empty">
        <span className="cosimo-type-micro">SELECT A SOURCE OR ADD A MAPPING</span>
      </div>
    );
  }

  return (
    <div
      className="mapping-detail"
      data-needs-reducer={needsReducer ? "true" : "false"}
      style={{ "--cosimo-semantic-color": color }}
    >
      {source.type === "fixed" ? (
        <div className="mapping-detail__source" data-navigable="false">
          <SourceIdentity color={color} includeName source={source} size={21} />
        </div>
      ) : (
        <button
          className="mapping-detail__source"
          onClick={() => onOpenSource(source.id)}
          type="button"
        >
          <SourceIdentity color={color} includeName source={source} size={21} />
          <ArrowSquareOut aria-hidden="true" size={15} />
        </button>
      )}

      <div className="mapping-detail__relationship">
        <span className="cosimo-type-micro">TO {targetLabel}</span>
        <output className="cosimo-value" data-value-kind="signed">
          {formatSignedPercent(mapping.amount)}
        </output>
      </div>

      <div className="mapping-detail__settings">
        <select
          aria-label="Mapping polarity"
          className="mapping-detail__select"
          onChange={(event) => onSetPolarity(mapping.id, event.target.value)}
          value={mapping.polarity}
        >
          <option>Bipolar</option>
          <option>Unipolar</option>
        </select>
        {needsReducer && (
          <select
            aria-label="Per-note reducer"
            className="mapping-detail__select"
            onChange={(event) => onSetReducer(mapping.id, event.target.value)}
            value={mapping.reducer}
          >
            <option>Max</option>
            <option>Mean</option>
          </select>
        )}
        <button
          aria-label={`Remove ${source.label} mapping`}
          className="mapping-detail__remove"
          onClick={() => onRemove(mapping.id)}
          type="button"
        >
          <Trash aria-hidden="true" size={17} />
          <span>REMOVE</span>
        </button>
      </div>
    </div>
  );
}
