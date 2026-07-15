import { Plus } from "@phosphor-icons/react";
import { ArticulationIcon } from "../../design-system/IdentityMark.jsx";
import { MappingChip } from "./MappingChip.jsx";
import { MappingDetail } from "./MappingDetail.jsx";

export function ModulationInspector({
  activeMappingId,
  articulationOverride,
  articulationColor,
  availableSources,
  mappings,
  onAddMapping,
  onChangeAmount,
  onClearArticulationOverride,
  onHaptic,
  onOpenSource,
  onRemoveMapping,
  onSelectMapping,
  onSetPolarity,
  onSetReducer,
  onShowReadout,
  sourceLookup,
  target,
}) {
  const activeMapping = mappings.find((item) => item.id === activeMappingId)
    || mappings[0]
    || null;
  return (
    <section className="modulation-inspector cosimo-inspector-slot" aria-label={`${target.label} mappings`}>
      <div className="modulation-inspector__chips" data-scroll-surface="horizontal">
        {articulationOverride && (
          <button
            aria-label={`Clear ${articulationOverride.articulationId} override for ${target.label}`}
            className="articulation-override-chip"
            onClick={onClearArticulationOverride}
            style={{ "--cosimo-semantic-color": articulationColor }}
            type="button"
          >
            <ArticulationIcon articulation={articulationOverride.articulationId} />
            <span>{articulationOverride.articulationId} OVERRIDE</span>
            <span aria-hidden="true">×</span>
          </button>
        )}
        {mappings.map((mapping) => {
          const source = sourceLookup[mapping.sourceId];
          if (!source) return null;
          return (
            <MappingChip
              color={source.color}
              isSelected={mapping.id === activeMapping?.id}
              key={mapping.id}
              mapping={mapping}
              onAmountChange={onChangeAmount}
              onHaptic={onHaptic}
              onSelect={() => onSelectMapping(mapping.id)}
              onShowReadout={onShowReadout}
              source={source}
              targetLabel={target.label}
            />
          );
        })}
        <div className="modulation-inspector__add">
          <span aria-hidden="true" className="modulation-inspector__add-glyph">
            <Plus aria-hidden="true" size={18} />
          </span>
          {availableSources.length > 0 && (
            <select
              aria-label="Choose modulation source"
              onChange={(event) => {
                if (event.target.value) onAddMapping(event.target.value);
                event.target.value = "";
              }}
              value=""
            >
              <option value="">ADD</option>
              {availableSources.map((source) => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <MappingDetail
        color={activeMapping ? sourceLookup[activeMapping.sourceId]?.color : undefined}
        mapping={activeMapping}
        needsReducer={activeMapping?.needsReducer}
        onOpenSource={onOpenSource}
        onRemove={onRemoveMapping}
        onSetPolarity={onSetPolarity}
        onSetReducer={onSetReducer}
        source={activeMapping ? sourceLookup[activeMapping.sourceId] : null}
        targetLabel={target.label}
      />
    </section>
  );
}
