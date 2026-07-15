import { useEffect, useRef, useState } from "react";
import { ArrowSquareOut, CaretDown, Plus, Trash } from "@phosphor-icons/react";
import { SourceIcon } from "../../design-system/IdentityMark.jsx";
import { useAxisDrag } from "../../interactions/useAxisDrag.js";

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, value));

function signedPercent(value) {
  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
}

export function SourceTargetRow({
  row,
  source,
  semanticColor,
  selected,
  dropActive,
  onSelect,
  onOpenTarget,
  onBaseValueChange,
  onMappingAmountChange,
  onPolarityChange,
  onReducerChange,
  onRemove,
  onTransientValue,
  onHaptic,
}) {
  const { target, mapping } = row;
  const targetId = target.key || target.id;
  const mappingEnd = clamp(row.baseValue + mapping.amount);
  const rangeStart = Math.min(row.baseValue, mappingEnd);
  const rangeWidth = Math.abs(mappingEnd - row.baseValue);
  const dragHandlers = useAxisDrag({
    xValue: row.baseValue,
    yValue: mapping.amount,
    onBegin: () => onHaptic?.("light"),
    onXChange(value) {
      onBaseValueChange?.({ targetId, value });
      onTransientValue?.({
        targetId,
        field: "base",
        label: `${target.moduleLabel} · ${target.label}`,
        value,
        formattedValue: row.formatValue?.(value) || `${Math.round(value)}%`,
      });
    },
    onYChange(amount) {
      onMappingAmountChange?.({ mappingId: mapping.id, amount });
      onTransientValue?.({
        mappingId: mapping.id,
        field: "amount",
        label: `${source.label} → ${target.moduleLabel} ${target.label}`,
        value: amount,
        formattedValue: signedPercent(amount),
      });
    },
  });

  return (
    <article
      className="cosimo-source-target"
      data-drop-active={dropActive || undefined}
      data-expanded={selected || undefined}
      style={{ "--cosimo-source-color": semanticColor }}
    >
      <button
        aria-label={`Edit ${target.moduleLabel} ${target.label}; horizontal changes base, vertical changes ${source.label} amount`}
        aria-pressed={selected}
        className="cosimo-source-target__control"
        onClick={() => onSelect?.(mapping.id)}
        type="button"
        {...dragHandlers}
      >
        <span className="cosimo-source-target__heading">
          <span className="cosimo-type-label">{target.moduleLabel} · {target.label}</span>
          <span className="cosimo-source-target__source-mark">
            <SourceIcon source={source} size={14} />
            <span className="cosimo-value" data-value-kind="signed">{signedPercent(mapping.amount)}</span>
          </span>
        </span>
        <span aria-hidden="true" className="cosimo-source-target__track">
          <span className="cosimo-source-target__base-fill" style={{ inlineSize: `${row.baseValue}%` }} />
          <span className="cosimo-source-target__default" style={{ insetInlineStart: `${target.defaultValue}%` }} />
          <span
            className="cosimo-source-target__mapping-range"
            style={{ insetInlineStart: `${rangeStart}%`, inlineSize: `${rangeWidth}%` }}
          />
          <span className="cosimo-source-target__handle" style={{ insetInlineStart: `${row.baseValue}%` }} />
        </span>
        <span className="cosimo-source-target__values">
          <span className="cosimo-value">{row.formattedBaseValue}</span>
          <span className="cosimo-value" data-value-kind="signed">{signedPercent(mapping.amount)}</span>
        </span>
      </button>

      <button
        aria-label={`Open ${target.moduleLabel} ${target.label}`}
        className="cosimo-source-target__open"
        onClick={() => onOpenTarget?.({ targetId, mappingId: mapping.id })}
        title={`Open ${target.moduleLabel}`}
        type="button"
      >
        <ArrowSquareOut aria-hidden="true" size={18} />
      </button>

      {selected && (
        <div className="cosimo-source-target__detail">
          <label>
            <span className="cosimo-type-label">Polarity</span>
            <span className="cosimo-source-target__select">
              <select
                aria-label={`${target.label} polarity`}
                onChange={(event) => onPolarityChange?.({ mappingId: mapping.id, polarity: event.target.value })}
                value={mapping.polarity}
              >
                <option>Bipolar</option>
                <option>Unipolar</option>
              </select>
              <CaretDown aria-hidden="true" size={13} />
            </span>
          </label>
          {row.needsReducer && (
            <label>
              <span className="cosimo-type-label">Reducer</span>
              <span className="cosimo-source-target__select">
                <select
                  aria-label={`${target.label} reducer`}
                  onChange={(event) => onReducerChange?.({ mappingId: mapping.id, reducer: event.target.value })}
                  value={mapping.reducer}
                >
                  <option>Max</option>
                  <option>Mean</option>
                </select>
                <CaretDown aria-hidden="true" size={13} />
              </span>
            </label>
          )}
          <button
            aria-label={`Remove ${source.label} mapping from ${target.moduleLabel} ${target.label}`}
            className="cosimo-source-target__remove"
            onClick={() => onRemove?.(mapping.id)}
            type="button"
          >
            <Trash aria-hidden="true" size={16} />
            <span>Remove</span>
          </button>
        </div>
      )}
    </article>
  );
}

export function SourceTargetList({
  source,
  semanticColor,
  rows,
  availableTargets = [],
  selectedMappingId = null,
  dropTargetId = null,
  addOpen = false,
  restoreScrollTop = null,
  onAddOpenChange,
  onAddTarget,
  onSelectMapping,
  onOpenTarget,
  onBaseValueChange,
  onMappingAmountChange,
  onPolarityChange,
  onReducerChange,
  onRemoveMapping,
  onTransientValue,
  onScrollPositionChange,
  onHaptic,
}) {
  const [newTargetId, setNewTargetId] = useState(
    availableTargets[0]?.key || availableTargets[0]?.id || "",
  );
  const listRef = useRef(null);

  useEffect(() => {
    if (!availableTargets.some((target) => (target.key || target.id) === newTargetId)) {
      setNewTargetId(availableTargets[0]?.key || availableTargets[0]?.id || "");
    }
  }, [availableTargets, newTargetId]);

  useEffect(() => {
    if (listRef.current && restoreScrollTop != null) {
      listRef.current.scrollTop = restoreScrollTop;
    }
  }, [restoreScrollTop]);

  return (
    <section className="cosimo-source-targets">
      <header className="cosimo-source-targets__toolbar">
        <span className="cosimo-type-label">Targets</span>
        <span className="cosimo-value" data-value-kind="note">{rows.length}</span>
        <button
          aria-expanded={addOpen}
          aria-label={`Add target to ${source.label}`}
          onClick={() => onAddOpenChange?.(!addOpen)}
          type="button"
        >
          <Plus aria-hidden="true" size={18} />
        </button>
      </header>

      {addOpen && (
        <div className="cosimo-source-targets__add-menu" role="group" aria-label={`Add target to ${source.label}`}>
          <span className="cosimo-source-targets__select">
            <select
              aria-label="New modulation target"
              onChange={(event) => setNewTargetId(event.target.value)}
              value={newTargetId}
            >
              {availableTargets.map((target) => (
                <option key={target.key || target.id} value={target.key || target.id}>
                  {target.moduleLabel ? `${target.moduleLabel} · ${target.label}` : target.label}
                </option>
              ))}
            </select>
            <CaretDown aria-hidden="true" size={13} />
          </span>
          <button
            disabled={!newTargetId}
            onClick={() => {
              onAddTarget?.(newTargetId);
              onAddOpenChange?.(false);
            }}
            type="button"
          >
            Add
          </button>
        </div>
      )}

      <div
        className="cosimo-source-targets__list"
        data-scroll-surface="vertical"
        onScroll={(event) => onScrollPositionChange?.(event.currentTarget.scrollTop)}
        ref={listRef}
      >
        {rows.map((row) => (
          <SourceTargetRow
            dropActive={dropTargetId === (row.target.key || row.target.id)}
            key={row.mapping.id}
            onBaseValueChange={onBaseValueChange}
            onHaptic={onHaptic}
            onMappingAmountChange={onMappingAmountChange}
            onOpenTarget={(intent) => onOpenTarget?.({
              ...intent,
              scrollTop: listRef.current?.scrollTop || 0,
            })}
            onPolarityChange={onPolarityChange}
            onReducerChange={onReducerChange}
            onRemove={onRemoveMapping}
            onSelect={(mappingId) => onSelectMapping?.(
              mappingId === selectedMappingId ? null : mappingId,
            )}
            onTransientValue={onTransientValue}
            row={row}
            selected={selectedMappingId === row.mapping.id}
            semanticColor={semanticColor}
            source={source}
          />
        ))}
        {rows.length === 0 && (
          <div className="cosimo-source-targets__empty cosimo-type-label">No targets</div>
        )}
      </div>
    </section>
  );
}
