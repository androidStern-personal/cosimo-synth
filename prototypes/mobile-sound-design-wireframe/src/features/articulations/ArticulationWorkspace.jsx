import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import {
  formatMidiNote,
  formatModAmountWithSpec,
  formatValue,
} from "../../domain/formatting.js";
import { useAxisDrag } from "../../interactions/useAxisDrag.js";

const PIANO_SPAN = 18;
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const HANDLE_PX_PER_SEMITONE = 16;

function ScrubField({ label, value, formattedValue, min, max, onChange, onCommitReadout }) {
  const drag = useAxisDrag({
    xValue: value,
    xMinimum: min,
    xMaximum: max,
    onXChange(next) {
      onChange(next);
      onCommitReadout?.(next);
    },
  });
  return (
    <div className="cosimo-artic-field" {...drag}>
      <span className="cosimo-artic-field__label cosimo-type-micro">{label}</span>
      <span className="cosimo-value">{formattedValue}</span>
    </div>
  );
}

function DiffRow({ row, onEdit, onRemove, onNavigate, onShowReadout }) {
  const bounds = row.kind === "route"
    ? { min: row.modSpec.min, max: row.modSpec.max }
    : { min: 0, max: 100 };
  const span = bounds.max - bounds.min;
  const valueFraction = (row.value - bounds.min) / span;
  const baseFraction = (row.base - bounds.min) / span;
  const fillStart = Math.min(valueFraction, baseFraction) * 100;
  const fillWidth = Math.abs(valueFraction - baseFraction) * 100;
  const format = (value) => (row.kind === "route"
    ? formatModAmountWithSpec(row.modSpec, value, row.polarity)
    : formatValue(row.target, value));
  const label = row.kind === "route"
    ? `${row.source?.label || "Source"} → ${row.target.moduleLabel} · ${row.target.label}`
    : `${row.target.moduleLabel} · ${row.target.label}`;
  const drag = useAxisDrag({
    xValue: row.value,
    xMinimum: bounds.min,
    xMaximum: bounds.max,
    onXChange(next) {
      onEdit(row, next);
      onShowReadout(`${label}  ${format(next)}`);
    },
  });

  return (
    <div
      className="cosimo-artic-diff__row"
      style={{ "--cosimo-row-color": row.kind === "route" ? row.source?.color : undefined }}
    >
      <div className="cosimo-artic-diff__main" {...drag}>
        <span className="cosimo-artic-diff__line">
          <button
            aria-label={`Open ${label}`}
            className="cosimo-artic-diff__nav"
            onClick={() => onNavigate(row.targetId)}
            type="button"
          >
            <span className="cosimo-artic-diff__name cosimo-type-label">{label}</span>
            <span aria-hidden="true" className="cosimo-artic-diff__chevron">›</span>
          </button>
          <span className="cosimo-artic-diff__values">
            <span className="cosimo-artic-diff__base cosimo-value">{format(row.base)}</span>
            <span className="cosimo-value">{format(row.value)}</span>
          </span>
        </span>
        <span aria-hidden="true" className="cosimo-artic-diff__track">
          <span className="cosimo-artic-diff__basemark" style={{ insetInlineStart: `${baseFraction * 100}%` }} />
          <span className="cosimo-artic-diff__fill" style={{ insetInlineStart: `${fillStart}%`, inlineSize: `${fillWidth}%` }} />
          <span className="cosimo-artic-diff__handle" style={{ insetInlineStart: `${valueFraction * 100}%` }} />
        </span>
      </div>
      <button
        aria-label={`Remove override: ${label}`}
        className="cosimo-artic-diff__remove"
        onClick={() => onRemove(row)}
        type="button"
      >
        <X aria-hidden="true" size={15} />
      </button>
    </div>
  );
}

/**
 * The Articulations workspace body: the trigger lane (Key piano as display
 * with an occlusion-free drag handle; Vel/Chain partition strips with
 * scrubbed bounds) above the selected articulation's diff inventory.
 */
export function ArticulationWorkspace({
  articulations,
  selectedArticulation,
  triggerMode,
  diffRows,
  onSelectArticulation,
  onSetTriggerMode,
  onSetKey,
  onSetRange,
  onWear,
  onEditDiffRow,
  onRemoveDiffRow,
  onNavigateToTarget,
  onShowReadout,
}) {
  const selected = selectedArticulation;
  const [keyViewStart, setKeyViewStart] = useState(() => Math.max(
    0,
    Math.min(127 - (PIANO_SPAN - 1), (selected?.key ?? 24) - 5),
  ));
  const [cursorValue, setCursorValue] = useState(null);
  const [bumpArticulationId, setBumpArticulationId] = useState(null);
  const bumpTimer = useRef(null);
  const handleDrag = useRef(null);

  useEffect(() => () => window.clearTimeout(bumpTimer.current), []);

  useEffect(() => {
    if (!selected || triggerMode !== "key") return;
    setKeyViewStart((current) => {
      if (selected.key < current) return Math.max(0, selected.key - 2);
      if (selected.key > current + PIANO_SPAN - 1) {
        return Math.min(127 - (PIANO_SPAN - 1), selected.key - (PIANO_SPAN - 3));
      }
      return current;
    });
  }, [selected, triggerMode]);

  if (!selected) {
    return <div className="cosimo-artic-workspace cosimo-artic-workspace--empty cosimo-type-label">NO ARTICULATIONS · ADD ONE ABOVE</div>;
  }

  const moveKey = (wantKey) => {
    const walk = onSetKey(selected.id, wantKey);
    if (!walk) return;
    if (walk.touching && walk.neighborId && walk.neighborId !== bumpArticulationId) {
      setBumpArticulationId(walk.neighborId);
      window.clearTimeout(bumpTimer.current);
      bumpTimer.current = window.setTimeout(() => setBumpArticulationId(null), 260);
    }
    onShowReadout(`${selected.label} · KEY ${formatMidiNote(walk.key)}${walk.touching ? " · TOUCHING" : ""}`);
  };

  const beginHandleDrag = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    handleDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startKey: selected.key,
    };
  };

  const moveHandleDrag = (event) => {
    const current = handleDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const wantKey = current.startKey
      + Math.round((event.clientX - current.startX) / HANDLE_PX_PER_SEMITONE);
    if (wantKey !== selected.key) moveKey(wantKey);
  };

  const endHandleDrag = (event) => {
    if (handleDrag.current?.pointerId !== event.pointerId) return;
    handleDrag.current = null;
  };

  const range = triggerMode === "vel" ? selected.vel : selected.chain;
  const caughtArticulation = cursorValue == null
    ? null
    : articulations.find((item) => {
        const r = triggerMode === "vel" ? item.vel : item.chain;
        return cursorValue >= r[0] && cursorValue <= r[1];
      }) || null;

  return (
    <div className="cosimo-artic-workspace">
      <div className="cosimo-artic-lane">
        <div className="cosimo-artic-lane__head">
          <span className="cosimo-type-label cosimo-artic-lane__title">Trigger</span>
          <div aria-label="Trigger mode" className="cosimo-segmented" role="group">
            {["key", "vel", "chain"].map((mode) => (
              <button
                aria-pressed={triggerMode === mode}
                className="cosimo-type-label"
                data-state={triggerMode === mode ? "selected" : undefined}
                key={mode}
                onClick={() => onSetTriggerMode(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
          <span
            className="cosimo-artic-lane__set cosimo-type-micro"
            title="Play-to-set appears when MIDI input is connected"
          >
            SET · NO MIDI IN
          </span>
        </div>

        {triggerMode === "key" ? (
          <>
            <div className="cosimo-artic-piano-row">
              <button
                aria-label="Shift piano view down an octave"
                className="cosimo-artic-paddle"
                onClick={() => setKeyViewStart((current) => Math.max(0, current - 12))}
                type="button"
              >
                <CaretLeft aria-hidden="true" size={13} />
              </button>
              <div aria-label="Keyswitch map" className="cosimo-artic-piano" role="img">
                {Array.from({ length: PIANO_SPAN }, (_, index) => {
                  const note = keyViewStart + index;
                  return (
                    <span
                      className="cosimo-artic-piano__key"
                      data-black={BLACK_KEYS.has(((note % 12) + 12) % 12) || undefined}
                      key={note}
                    >
                      {note % 12 === 0 && (
                        <span className="cosimo-artic-piano__label cosimo-type-micro">
                          {formatMidiNote(note)}
                        </span>
                      )}
                    </span>
                  );
                })}
                {articulations.map((articulation) => {
                  if (articulation.key < keyViewStart || articulation.key > keyViewStart + PIANO_SPAN - 1) {
                    return null;
                  }
                  return (
                    <button
                      aria-label={`Select ${articulation.label} (keyswitch ${formatMidiNote(articulation.key)})`}
                      className="cosimo-artic-piano__marker"
                      data-bump={bumpArticulationId === articulation.id || undefined}
                      data-selected={selected.id === articulation.id || undefined}
                      key={articulation.id}
                      onClick={() => onSelectArticulation(articulation.id)}
                      style={{
                        "--cosimo-articulation-color": articulation.color,
                        insetInlineStart: `${((articulation.key - keyViewStart) / PIANO_SPAN) * 100}%`,
                        inlineSize: `${100 / PIANO_SPAN}%`,
                      }}
                      type="button"
                    >
                      {articulation.label.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              <button
                aria-label="Shift piano view up an octave"
                className="cosimo-artic-paddle"
                onClick={() => setKeyViewStart((current) => Math.min(127 - (PIANO_SPAN - 1), current + 12))}
                type="button"
              >
                <CaretRight aria-hidden="true" size={13} />
              </button>
            </div>
            <div className="cosimo-artic-handle-row">
              <button
                aria-label={`Move ${selected.label} keyswitch down a semitone`}
                className="cosimo-artic-nudge"
                onClick={() => moveKey(selected.key - 1)}
                type="button"
              >
                −1
              </button>
              <div
                aria-label={`Drag to move ${selected.label} keyswitch`}
                className="cosimo-artic-handle"
                onPointerCancel={endHandleDrag}
                onPointerDown={beginHandleDrag}
                onPointerMove={moveHandleDrag}
                onPointerUp={endHandleDrag}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={127}
                aria-valuenow={selected.key}
                style={{ "--cosimo-articulation-color": selected.color }}
              >
                <span aria-hidden="true" className="cosimo-artic-handle__swatch" />
                <span className="cosimo-type-label">{selected.label}</span>
                <span className="cosimo-value">KEY {formatMidiNote(selected.key)}</span>
              </div>
              <button
                aria-label={`Move ${selected.label} keyswitch up a semitone`}
                className="cosimo-artic-nudge"
                onClick={() => moveKey(selected.key + 1)}
                type="button"
              >
                +1
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="cosimo-artic-strip-lane"
              onPointerDown={(event) => {
                if (event.target.closest("button")) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                setCursorValue(Math.max(0, Math.min(
                  127,
                  ((event.clientX - bounds.left) / bounds.width) * 127,
                )));
              }}
            >
              {articulations.map((articulation) => {
                const r = triggerMode === "vel" ? articulation.vel : articulation.chain;
                return (
                  <button
                    aria-label={`Select ${articulation.label} (${r[0]}–${r[1]})`}
                    className="cosimo-artic-strip-lane__segment"
                    data-selected={selected.id === articulation.id || undefined}
                    key={articulation.id}
                    onClick={() => onSelectArticulation(articulation.id)}
                    style={{
                      "--cosimo-articulation-color": articulation.color,
                      insetInlineStart: `${(r[0] / 127) * 100}%`,
                      inlineSize: `${Math.max(1.5, ((r[1] - r[0]) / 127) * 100)}%`,
                    }}
                    type="button"
                  >
                    {r[1] - r[0] > 14 ? articulation.label.slice(0, 3) : ""}
                  </button>
                );
              })}
              {cursorValue != null && (
                <span
                  aria-hidden="true"
                  className="cosimo-artic-strip-lane__cursor"
                  style={{ insetInlineStart: `${(cursorValue / 127) * 100}%` }}
                />
              )}
            </div>
            <div className="cosimo-artic-caught cosimo-type-micro">
              {cursorValue == null
                ? "TAP THE STRIP TO PREVIEW AN INCOMING VALUE"
                : `IN ${Math.round(cursorValue)} → ${caughtArticulation ? caughtArticulation.label.toUpperCase() : "DEFAULT (NO MATCH)"}`}
            </div>
            <div className="cosimo-artic-bounds">
              <ScrubField
                formattedValue={String(range[0])}
                label={`${selected.label} · MIN`}
                max={127}
                min={0}
                onChange={(value) => onSetRange(selected.id, triggerMode, "lo", value)}
                onCommitReadout={(value) => onShowReadout(`${selected.label} · ${triggerMode.toUpperCase()} ${Math.round(value)}–${range[1]}`)}
                value={range[0]}
              />
              <ScrubField
                formattedValue={String(range[1])}
                label={`${selected.label} · MAX`}
                max={127}
                min={0}
                onChange={(value) => onSetRange(selected.id, triggerMode, "hi", value)}
                onCommitReadout={(value) => onShowReadout(`${selected.label} · ${triggerMode.toUpperCase()} ${range[0]}–${Math.round(value)}`)}
                value={range[1]}
              />
            </div>
          </>
        )}
      </div>

      <div className="cosimo-artic-diff">
        <div className="cosimo-artic-diff__head">
          <span className="cosimo-type-label">{selected.label} · diff vs patch base</span>
          <button
            className="cosimo-artic-diff__wear cosimo-type-label"
            onClick={() => onWear(selected.id)}
            type="button"
          >
            Wear {selected.label}
          </button>
        </div>
        <div className="cosimo-artic-diff__list" data-scroll-surface="vertical">
          {diffRows.map((row) => (
            <DiffRow
              key={row.id}
              onEdit={onEditDiffRow}
              onNavigate={onNavigateToTarget}
              onRemove={onRemoveDiffRow}
              onShowReadout={onShowReadout}
              row={row}
            />
          ))}
          {diffRows.length === 0 && (
            <div className="cosimo-artic-diff__empty cosimo-type-micro">
              NO OVERRIDES · {selected.label.toUpperCase()} PLAYS THE PATCH AS-IS
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
