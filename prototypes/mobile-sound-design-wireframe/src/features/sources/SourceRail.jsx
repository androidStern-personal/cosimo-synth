import { useEffect, useRef, useState } from "react";
import { Plus, Trash, X } from "@phosphor-icons/react";
import { SourceIcon } from "../../design-system/IdentityMark.jsx";
import { calculateDragValue } from "../../interactions/useAxisDrag.js";
import { SourceChip } from "./SourceChip.jsx";

const DEFAULT_ADD_OPTIONS = [
  { type: "macro", label: "Macro", available: true },
  { type: "envelope", label: "Envelope", available: true },
  { type: "mseg", label: "MSEG", available: true },
];

const DRAG_THRESHOLD = 8;
const LONG_PRESS_DELAY = 520;

/**
 * The unified source rail: every source appears exactly once. Chips attached
 * to the selected parameter light up with their amounts; everything else
 * recedes. Gesture contract: tap opens the source editor, a lit chip's
 * vertical drag always scrubs its amount, an unlit chip's vertical drag
 * always carries for assignment (a ghost chip follows the pointer), and
 * long-press manages — including removing just this source from the selected
 * parameter.
 */
export function SourceRail({
  sources,
  fixedSources = [],
  litMappings = {},
  attachmentCounts = {},
  sourceColors = {},
  focusedSourceId = null,
  draggedSourceId = null,
  targetLabel = "",
  addOpen = false,
  addOptions = DEFAULT_ADD_OPTIONS,
  deletionUndo = null,
  onFocusSource,
  onFocusMapping,
  onScrubMappingAmount,
  onRemoveMapping,
  onSetMappingPolarity,
  onSetMappingEnabled,
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
  const [ghost, setGhost] = useState(null);
  const press = useRef(null);
  const suppressClick = useRef(false);
  const railSources = [...sources, ...fixedSources];
  const contextSource = railSources.find((source) => source.id === contextSourceId) || null;
  const contextMapping = contextSource ? litMappings[contextSource.id] || null : null;
  const effectiveDraggedSourceId = draggedSourceId || internalDraggedSourceId;
  const undoneSource = deletionUndo?.source || deletionUndo;

  const endDrag = (current, cancelled) => {
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
    setGhost(null);
  };

  const clearPress = ({ cancelDrag = false } = {}) => {
    const current = press.current;
    if (!current) return;
    window.clearTimeout(current.longPressTimer);
    if (cancelDrag && current.mode === "drag") endDrag(current, true);
    if (current.listeners) {
      window.removeEventListener("pointermove", current.listeners.move);
      window.removeEventListener("pointerup", current.listeners.up);
      window.removeEventListener("pointercancel", current.listeners.cancel);
    }
    press.current = null;
  };

  useEffect(() => () => clearPress({ cancelDrag: true }), []);

  const canDeleteSource = (source) => source.type !== "fixed" && source.id !== "amp-envelope";
  const canManage = (source, mapping) => canDeleteSource(source) || Boolean(mapping);

  const beginPress = (event, source, mapping) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Mouse pointers do not receive the implicit capture that touch pointers
    // do. Capture immediately so the threshold can be crossed outside the
    // compact chip without losing the gesture. Touch keeps native pan-x
    // behavior until a vertical gesture claims the pointer.
    if (event.pointerType === "mouse") {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    suppressClick.current = false;
    const longPressTimer = canManage(source, mapping)
      ? window.setTimeout(() => {
          if (press.current?.mode) return;
          suppressClick.current = true;
          setContextSourceId(source.id);
          onHaptic?.("light");
        }, LONG_PRESS_DELAY)
      : null;
    const listeners = {
      move: (pointerEvent) => movePress(pointerEvent),
      up: (pointerEvent) => finishPress(pointerEvent),
      cancel: (pointerEvent) => finishPress(pointerEvent, true),
    };
    press.current = {
      longPressTimer,
      listeners,
      source,
      mapping,
      captureTarget: event.currentTarget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startAmount: mapping?.amount ?? 0,
      extent: Math.max(event.currentTarget.getBoundingClientRect().height, 44),
      mode: null,
    };
    window.addEventListener("pointermove", listeners.move);
    window.addEventListener("pointerup", listeners.up);
    window.addEventListener("pointercancel", listeners.cancel);
  };

  const beginDrag = (current, event) => {
    window.clearTimeout(current.longPressTimer);
    current.mode = "drag";
    suppressClick.current = true;
    current.captureTarget?.setPointerCapture?.(event.pointerId);
    setContextSourceId(null);
    setInternalDraggedSourceId(current.source.id);
    setGhost({ source: current.source, x: event.clientX, y: event.clientY });
    onHaptic?.("light");
    onSourceDragStart?.({ sourceId: current.source.id, source: current.source });
    onDragTargetVisibilityChange?.({
      visible: true,
      sourceId: current.source.id,
      source: current.source,
    });
  };

  const movePress = (event) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.mode === "scrub") {
      onScrubMappingAmount?.(current.mapping.id, calculateDragValue({
        startValue: current.startAmount,
        delta: event.clientY - current.startY,
        extent: current.extent,
        minimum: current.mapping.modSpec.min,
        maximum: current.mapping.modSpec.max,
        inverted: true,
      }));
      return;
    }
    if (current.mode === "drag") {
      setGhost({ source: current.source, x: event.clientX, y: event.clientY });
      onSourceDragMove?.({
        sourceId: current.source.id,
        source: current.source,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    if (current.mode === "dead") return;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (Math.hypot(deltaX, deltaY) <= DRAG_THRESHOLD) return;
    window.clearTimeout(current.longPressTimer);
    if (current.mapping) {
      // A lit chip only scrubs, and only vertically; a horizontal drag on it
      // is deliberately inert so a sloppy scrub can't become anything else.
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        current.mode = "dead";
        suppressClick.current = true;
        return;
      }
      current.mode = "scrub";
      suppressClick.current = true;
      current.captureTarget?.setPointerCapture?.(event.pointerId);
      onFocusMapping?.(current.mapping.id);
      onHaptic?.("light");
      movePress(event);
      return;
    }
    // The rail never scrolls, so an unlit chip assigns in ANY direction.
    beginDrag(current, event);
  };

  const finishPress = (event, cancelled = false) => {
    const current = press.current;
    if (current?.mode === "drag") endDrag(current, cancelled);
    if (current?.captureTarget?.hasPointerCapture?.(event.pointerId)) {
      current.captureTarget.releasePointerCapture(event.pointerId);
    }
    // A completed gesture must not leave the browser's focus ring behind.
    if (current?.mode) current.captureTarget?.blur?.();
    clearPress();
  };

  return (
    <section
      aria-label="Modulation sources"
      className="cosimo-source-rail"
    >
      <div className="cosimo-source-rail__grid">
        {railSources.map((source) => {
          const attachmentCount = attachmentCounts[source.id] || 0;
          const mapping = litMappings[source.id] || null;
          return (
            <SourceChip
              attachmentCount={attachmentCount}
              dragging={effectiveDraggedSourceId === source.id}
              key={source.id}
              mapping={mapping}
              onFocus={(event) => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  event.preventDefault();
                  return;
                }
                onFocusSource?.(source.id);
              }}
              pointerHandlers={{
                onContextMenu(event) {
                  event.preventDefault();
                  if (!canManage(source, mapping)) return;
                  clearPress({ cancelDrag: true });
                  setContextSourceId(source.id);
                },
                onPointerDown(event) {
                  beginPress(event, source, mapping);
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
          className="cosimo-source-rail__add"
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
          className="cosimo-source-rail__popover cosimo-source-rail__add-menu"
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
          className="cosimo-source-rail__popover cosimo-source-rail__context-menu"
          role="dialog"
        >
          <span className="cosimo-type-label">{contextSource.label}</span>
          {contextMapping && (
            <button
              aria-label={`${contextSource.label} polarity: ${contextMapping.polarity}`}
              onClick={() => onSetMappingPolarity?.(
                contextMapping.id,
                contextMapping.polarity === "Bipolar" ? "Unipolar" : "Bipolar",
              )}
              type="button"
            >
              <span aria-hidden="true" className="cosimo-value">
                {contextMapping.polarity === "Bipolar" ? "±" : "+"}
              </span>
              <span>{contextMapping.polarity}</span>
            </button>
          )}
          {contextMapping && (
            <button
              onClick={() => onSetMappingEnabled?.(
                contextMapping.id,
                contextMapping.enabled === false,
              )}
              type="button"
            >
              <span>{contextMapping.enabled === false ? "Enable" : "Disable"}</span>
            </button>
          )}
          {contextMapping && (
            <button
              onClick={() => {
                onRemoveMapping?.(contextMapping.id);
                setContextSourceId(null);
              }}
              type="button"
            >
              <X aria-hidden="true" size={17} />
              <span>Remove from {targetLabel}</span>
            </button>
          )}
          {canDeleteSource(contextSource) && (
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
          )}
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
        <div className="cosimo-source-rail__undo" role="status">
          <span className="cosimo-value">{undoneSource.label} deleted</span>
          <button onClick={onUndoDelete} type="button">Undo</button>
        </div>
      )}

      {ghost && (
        <div
          aria-hidden="true"
          className="cosimo-source-rail__ghost"
          style={{
            insetInlineStart: `${ghost.x}px`,
            insetBlockStart: `${ghost.y}px`,
            "--cosimo-source-color": sourceColors[ghost.source.id] || ghost.source.color,
          }}
        >
          <SourceIcon source={ghost.source} size={18} />
          <span className="cosimo-type-label">{ghost.source.label}</span>
        </div>
      )}
    </section>
  );
}
