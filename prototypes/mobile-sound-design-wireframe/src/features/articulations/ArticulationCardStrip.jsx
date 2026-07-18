import { useEffect, useRef, useState } from "react";
import { Copy, Play, Plus, Trash, X } from "@phosphor-icons/react";
import { ArticulationIcon } from "../../design-system/IdentityMark.jsx";
import { formatMidiNote } from "../../domain/formatting.js";

const LONG_PRESS_DELAY = 520;

function assignmentLabel(articulation, mode) {
  if (mode === "vel") return `VEL ${articulation.vel[0]}-${articulation.vel[1]}`;
  if (mode === "chain") return `CHN ${articulation.chain[0]}-${articulation.chain[1]}`;
  return `KEY ${formatMidiNote(articulation.key)}`;
}

/**
 * The articulation bank, hosted in the rack region's fixed band. Tap selects
 * the card, hold ▶ previews through the audition path, long-press manages
 * (duplicate/delete; rename deferred), Add mints the next slot.
 */
export function ArticulationCardStrip({
  articulations,
  triggerMode,
  selectedArticulationId,
  overrideCounts = {},
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onPreviewStart,
  onPreviewEnd,
  onHaptic,
}) {
  const [menuArticulationId, setMenuArticulationId] = useState(null);
  const press = useRef(null);
  const suppressClick = useRef(false);

  const clearPress = () => {
    window.clearTimeout(press.current?.timer);
    press.current = null;
  };

  useEffect(() => () => clearPress(), []);

  const menuArticulation = articulations.find((item) => item.id === menuArticulationId) || null;

  return (
    <section aria-label="Articulation bank" className="cosimo-artic-strip">
      <div className="cosimo-artic-strip__scroller" data-scroll-surface="horizontal">
        {articulations.map((articulation) => (
          <button
            aria-label={`${articulation.label}, selector ${articulation.selector}, ${overrideCounts[articulation.id] || 0} overrides`}
            aria-pressed={selectedArticulationId === articulation.id}
            className="cosimo-artic-card"
            data-selected={selectedArticulationId === articulation.id || undefined}
            key={articulation.id}
            onClick={(event) => {
              if (suppressClick.current) {
                suppressClick.current = false;
                event.preventDefault();
                return;
              }
              onSelect?.(articulation.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              clearPress();
              setMenuArticulationId(articulation.id);
            }}
            onPointerCancel={clearPress}
            onPointerDown={(event) => {
              if (event.target.closest("[data-preview]")) return;
              suppressClick.current = false;
              clearPress();
              press.current = {
                timer: window.setTimeout(() => {
                  suppressClick.current = true;
                  setMenuArticulationId(articulation.id);
                  onHaptic?.("light");
                }, LONG_PRESS_DELAY),
              };
            }}
            onPointerMove={clearPress}
            onPointerUp={clearPress}
            style={{ "--cosimo-articulation-color": articulation.color }}
            type="button"
          >
            <span className="cosimo-artic-card__identity">
              <span aria-hidden="true" className="cosimo-artic-card__mark">
                <ArticulationIcon articulation={articulation.id} size={14} />
              </span>
              <span className="cosimo-artic-card__name cosimo-type-label">{articulation.label}</span>
              <span
                aria-label={`Preview ${articulation.label}`}
                className="cosimo-artic-card__preview"
                data-preview
                onPointerCancel={() => onPreviewEnd?.()}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  onPreviewStart?.(articulation.id);
                }}
                onPointerUp={() => onPreviewEnd?.()}
                role="button"
              >
                <Play aria-hidden="true" size={11} weight="fill" />
              </span>
            </span>
            <span className="cosimo-artic-card__meta">
              <span className="cosimo-value" data-value-kind="note">{articulation.selector}</span>
              <span className="cosimo-artic-card__assignment">{assignmentLabel(articulation, triggerMode)}</span>
              <span className="cosimo-value" data-value-kind="note">{overrideCounts[articulation.id] || 0}</span>
            </span>
            <span aria-hidden="true" className="cosimo-artic-card__rule" />
          </button>
        ))}
        <button
          aria-label="Add articulation"
          className="cosimo-artic-card cosimo-artic-card--add"
          onClick={() => onAdd?.()}
          type="button"
        >
          <Plus aria-hidden="true" size={18} />
          <span className="cosimo-type-micro">ADD</span>
        </button>
      </div>

      {menuArticulation && (
        <div
          aria-label={`${menuArticulation.label} actions`}
          className="cosimo-artic-strip__menu"
          role="dialog"
        >
          <span className="cosimo-type-label">{menuArticulation.label}</span>
          <button
            onClick={() => {
              onDuplicate?.(menuArticulation.id);
              setMenuArticulationId(null);
            }}
            type="button"
          >
            <Copy aria-hidden="true" size={15} />
            <span>Duplicate</span>
          </button>
          <button
            onClick={() => {
              onDelete?.(menuArticulation.id);
              setMenuArticulationId(null);
            }}
            type="button"
          >
            <Trash aria-hidden="true" size={15} />
            <span>Delete</span>
          </button>
          <button
            aria-label="Close articulation actions"
            onClick={() => setMenuArticulationId(null)}
            type="button"
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      )}
    </section>
  );
}
