import { useEffect, useRef, useState } from "react";
import { Plus, Trash, X } from "@phosphor-icons/react";
import { SourceIcon } from "../../design-system/IdentityMark.jsx";
import { SourceChip } from "./SourceChip.jsx";

const DEFAULT_ADD_OPTIONS = [
  { type: "macro", label: "Macro", available: true },
  { type: "envelope", label: "Envelope", available: true },
  { type: "mseg", label: "MSEG", available: true },
];

const DRAG_THRESHOLD = 8;
const LONG_PRESS_DELAY = 520;

export function SourceShelf({
  sources,
  attachmentCounts = {},
  sourceColors = {},
  focusedSourceId = null,
  draggedSourceId = null,
  addOpen = false,
  addOptions = DEFAULT_ADD_OPTIONS,
  deletionUndo = null,
  onFocusSource,
  onAddOpenChange,
  onAddSource,
  onDeleteSource,
  onUndoDelete,
  onSourceDragStart,
  onSourceDragMove,
  onSourceDragEnd,
  onDragTargetVisibilityChange,
  onHaptic,
}) {
  const [contextSourceId, setContextSourceId] = useState(null);
  const [internalDraggedSourceId, setInternalDraggedSourceId] = useState(null);
  const press = useRef(null);
  const suppressClick = useRef(false);
  const contextSource = sources.find((source) => source.id === contextSourceId) || null;
  const effectiveDraggedSourceId = draggedSourceId || internalDraggedSourceId;
  const undoneSource = deletionUndo?.source || deletionUndo;

  const clearPress = () => {
    const current = press.current;
    window.clearTimeout(current?.timer);
    if (current?.listeners) {
      window.removeEventListener("pointermove", current.listeners.move);
      window.removeEventListener("pointerup", current.listeners.up);
      window.removeEventListener("pointercancel", current.listeners.cancel);
    }
    press.current = null;
  };

  useEffect(() => () => clearPress(), []);

  const beginPress = (event, source) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Mouse pointers do not receive the implicit capture that touch pointers
    // do. Capture immediately so the threshold can be crossed outside the
    // compact chip without losing the gesture. Touch keeps native pan-x
    // behavior until the vertical drag threshold is crossed.
    if (event.pointerType === "mouse") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    suppressClick.current = false;
    const timer = window.setTimeout(() => {
      suppressClick.current = true;
      setContextSourceId(source.id);
      onHaptic?.("light");
    }, LONG_PRESS_DELAY);
    const listeners = {
      move: (pointerEvent) => movePress(pointerEvent),
      up: (pointerEvent) => finishPress(pointerEvent),
      cancel: (pointerEvent) => finishPress(pointerEvent, true),
    };
    press.current = {
      timer,
      listeners,
      source,
      captureTarget: event.currentTarget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    window.addEventListener("pointermove", listeners.move);
    window.addEventListener("pointerup", listeners.up);
    window.addEventListener("pointercancel", listeners.cancel);
  };

  const movePress = (event) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - current.startX,
      event.clientY - current.startY,
    );
    if (distance > DRAG_THRESHOLD && !current.dragging) {
      if (Math.abs(event.clientX - current.startX) > Math.abs(event.clientY - current.startY)) {
        window.clearTimeout(current.timer);
        suppressClick.current = true;
        return;
      }
      window.clearTimeout(current.timer);
      current.dragging = true;
      suppressClick.current = true;
      current.captureTarget?.setPointerCapture?.(event.pointerId);
      setContextSourceId(null);
      setInternalDraggedSourceId(current.source.id);
      onHaptic?.("light");
      onSourceDragStart?.({ sourceId: current.source.id, source: current.source });
      onDragTargetVisibilityChange?.({
        visible: true,
        sourceId: current.source.id,
        source: current.source,
      });
    }
    if (current.dragging) {
      onSourceDragMove?.({
        sourceId: current.source.id,
        source: current.source,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }
  };

  const finishPress = (event, cancelled = false) => {
    const current = press.current;
    if (current?.dragging) {
      onSourceDragEnd?.({
        sourceId: current.source.id,
        source: current.source,
        cancelled,
      });
      onDragTargetVisibilityChange?.({
        visible: false,
        sourceId: current.source.id,
        source: current.source,
      });
      setInternalDraggedSourceId(null);
    }
    if (current?.captureTarget?.hasPointerCapture?.(event.pointerId)) {
      current.captureTarget.releasePointerCapture(event.pointerId);
    }
    clearPress();
  };

  return (
    <section
      aria-label="Patch modulation sources"
      className="cosimo-source-shelf"
    >
      <div
        className="cosimo-source-shelf__scroller"
        data-scroll-surface="horizontal"
      >
        {sources.map((source) => {
          const attachmentCount = attachmentCounts[source.id] || 0;
          return (
            <SourceChip
              attachmentCount={attachmentCount}
              dragging={effectiveDraggedSourceId === source.id}
              key={source.id}
              onFocus={(event) => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  event.preventDefault();
                  return;
                }
                onFocusSource?.(source.id);
              }}
              orphan={attachmentCount === 0}
              pointerHandlers={{
                onContextMenu(event) {
                  event.preventDefault();
                  clearPress();
                  setContextSourceId(source.id);
                },
                onPointerDown(event) {
                  beginPress(event, source);
                },
              }}
              selected={focusedSourceId === source.id}
              semanticColor={sourceColors[source.id] || source.color}
              source={source}
            />
          );
        })}
        <button
          aria-expanded={addOpen}
          aria-label="Add modulation source"
          className="cosimo-source-shelf__add"
          onClick={() => onAddOpenChange?.(!addOpen)}
          title="Add modulation source"
          type="button"
        >
          <Plus aria-hidden="true" size={22} />
        </button>
      </div>

      {addOpen && (
        <div
          aria-label="Add modulation source"
          className="cosimo-source-shelf__popover cosimo-source-shelf__add-menu"
          role="group"
        >
          {addOptions.map((option) => (
            <button
              disabled={option.available === false}
              key={option.type}
              onClick={() => onAddSource?.(option.type)}
              type="button"
            >
              <SourceIcon source={option} size={18} />
              <span>{option.label}</span>
            </button>
          ))}
          <button
            aria-label="Close add source menu"
            onClick={() => onAddOpenChange?.(false)}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      )}

      {contextSource && (
        <div
          aria-label={`${contextSource.label} actions`}
          aria-modal="false"
          className="cosimo-source-shelf__popover cosimo-source-shelf__context-menu"
          role="dialog"
        >
          <span className="cosimo-type-label">{contextSource.label}</span>
          <button
            onClick={() => {
              onDeleteSource?.(contextSource.id);
              setContextSourceId(null);
            }}
            type="button"
          >
            <Trash aria-hidden="true" size={17} />
            <span>
              Delete · {attachmentCounts[contextSource.id] || 0} mapping{attachmentCounts[contextSource.id] === 1 ? "" : "s"}
            </span>
          </button>
          <button
            aria-label="Close source actions"
            onClick={() => setContextSourceId(null)}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>
      )}

      {undoneSource && (
        <div className="cosimo-source-shelf__undo" role="status">
          <span className="cosimo-value">{undoneSource.label} deleted</span>
          <button onClick={onUndoDelete} type="button">Undo</button>
        </div>
      )}
    </section>
  );
}
