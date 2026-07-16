import { ArrowSquareOut, X } from "@phosphor-icons/react";
import { SourceIdentity } from "../../design-system/IdentityMark.jsx";
import { formatSignedPercent } from "../../domain/formatting.js";

function SegmentedSetting({ ariaLabel, onChoose, options, value }) {
  return (
    <div aria-label={ariaLabel} className="cosimo-segmented" role="group">
      {options.map((option) => (
        <button
          aria-pressed={option === value}
          className="cosimo-type-label"
          data-state={option === value ? "selected" : undefined}
          key={option}
          onClick={() => onChoose(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

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
        <div className="mapping-detail__source">
          <span className="cosimo-type-micro">NO SOURCE</span>
        </div>
        <div className="mapping-detail__relationship">
          <span className="cosimo-type-micro">TO {targetLabel}</span>
          <output className="cosimo-value" data-value-kind="signed">—</output>
        </div>
        <div className="mapping-detail__settings" />
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
          <SourceIdentity color={color} includeName source={source} size={16} />
        </div>
      ) : (
        <button
          aria-label={`Open ${source.label} editor`}
          className="mapping-detail__source"
          onClick={() => onOpenSource(source.id)}
          type="button"
        >
          <SourceIdentity color={color} includeName source={source} size={16} />
          <ArrowSquareOut aria-hidden="true" size={13} />
        </button>
      )}

      <div className="mapping-detail__relationship">
        <span className="cosimo-type-micro">TO {targetLabel}</span>
        <output className="cosimo-value" data-value-kind="signed">
          {formatSignedPercent(mapping.amount)}
        </output>
        <button
          aria-label={`Remove ${source.label} mapping`}
          className="mapping-detail__remove"
          onClick={() => onRemove(mapping.id)}
          type="button"
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>

      <div className="mapping-detail__settings">
        <SegmentedSetting
          ariaLabel="Mapping polarity"
          onChoose={(polarity) => onSetPolarity(mapping.id, polarity)}
          options={["Bipolar", "Unipolar"]}
          value={mapping.polarity}
        />
        {needsReducer && (
          <SegmentedSetting
            ariaLabel="Per-note reducer"
            onChoose={(reducer) => onSetReducer(mapping.id, reducer)}
            options={["Max", "Mean"]}
            value={mapping.reducer}
          />
        )}
      </div>
    </div>
  );
}
