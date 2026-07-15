import { useLayoutEffect, useRef } from "react";
import { DotsSixVertical } from "@phosphor-icons/react";
import { WireRange } from "../../design-system/WireRange.jsx";

const REORDER_THRESHOLD = 8;

function useSelectedRackTile(items) {
  const selectedTile = useRef(null);
  const selectedId = items.find((item) => item.isSelected)?.id;

  useLayoutEffect(() => {
    const node = selectedTile.current;
    if (!node) return undefined;
    const alignSelectedTile = () => node.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
    alignSelectedTile();
    const scroller = node.parentElement;
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(alignSelectedTile);
    if (scroller) observer?.observe(scroller);
    window.addEventListener("resize", alignSelectedTile);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", alignSelectedTile);
    };
  }, [items.length, selectedId]);

  return selectedTile;
}

function RackQuickControl({ item, onChange, onFocus, onReadout }) {
  const { quick } = item;

  return (
    <label className="cosimo-rack__quick">
      <span className="cosimo-rack__quick-meta">
        <span className="cosimo-type-label">{quick.label}</span>
        <output
          className="cosimo-value"
          data-value-kind={quick.valueKind || "percent"}
        >
          {quick.formattedValue}
        </output>
      </span>
      <WireRange
        accent="var(--cosimo-color-accent)"
        ariaLabel={`${item.label} ${quick.label} quick control`}
        defaultValue={quick.defaultValue}
        onChange={(event) => {
          const value = Number(event.target.value);
          onFocus?.(item.id);
          onChange?.(quick.targetId, value);
          onReadout?.({
            formattedValue: quick.format?.(value) || String(value),
            label: `${item.label} · ${quick.label}`,
            targetId: quick.targetId,
            value,
          });
        }}
        value={quick.value}
      />
    </label>
  );
}

function RackTile({
  item,
  onEnableChange,
  onFocus,
  onQuickChange,
  onReadout,
  onReorder,
  selectedRef,
}) {
  const reorderGesture = useRef(null);

  const finishReorder = (event, cancelled = false) => {
    const current = reorderGesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    reorderGesture.current = null;
    if (!cancelled) current.onCommit?.();
  };

  return (
    <article
      className="cosimo-rack__tile cosimo-surface"
      data-bypassed={item.enabled ? undefined : "true"}
      data-effect-id={item.id}
      data-state={item.isSelected ? "selected" : item.enabled ? "idle" : "bypassed"}
      ref={item.isSelected ? selectedRef : null}
    >
      <button
        aria-current={item.isSelected ? "page" : undefined}
        aria-label={`Open ${item.label} editor`}
        className="cosimo-rack__identity cosimo-type-navigation"
        onClick={() => onFocus?.(item.id)}
        type="button"
      >
        {item.label}
      </button>
      <RackQuickControl
        item={item}
        onChange={onQuickChange}
        onFocus={onFocus}
        onReadout={onReadout}
      />
      <label className="cosimo-rack__enabled cosimo-type-micro">
        <input
          aria-label={`${item.label} enabled`}
          checked={item.enabled}
          onChange={(event) => onEnableChange?.(item.id, event.target.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" className="cosimo-rack__enabled-mark" />
        <span>{item.enabled ? "On" : "Off"}</span>
      </label>
      <button
        aria-label={`Reorder ${item.label}`}
        className="cosimo-rack__handle"
        onPointerCancel={(event) => finishReorder(event, true)}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          reorderGesture.current = {
            pointerId: event.pointerId,
            lastOverId: item.id,
            startX: event.clientX,
            startY: event.clientY,
            started: false,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = reorderGesture.current;
          if (!current || current.pointerId !== event.pointerId) return;
          if (!current.started) {
            const distance = Math.hypot(
              event.clientX - current.startX,
              event.clientY - current.startY,
            );
            if (distance < REORDER_THRESHOLD) return;
            current.started = true;
          }
          const overTile = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest?.("[data-effect-id]");
          const overId = overTile?.getAttribute("data-effect-id");
          if (!overId || overId === current.lastOverId) return;
          onReorder?.(item.id, overId);
          current.lastOverId = overId;
        }}
        onPointerUp={finishReorder}
        type="button"
      >
        <DotsSixVertical aria-hidden="true" size={18} weight="bold" />
      </button>
    </article>
  );
}

/**
 * items are presentation view models:
 * { id, label, enabled, isSelected, quick: { targetId, label, value,
 * defaultValue, formattedValue, valueKind, format? } }
 */
export function EffectRack({
  items,
  onEffectEnabledChange,
  onEffectFocus,
  onQuickChange,
  onReadout,
  onReorder,
}) {
  const selectedTile = useSelectedRackTile(items);

  return (
    <section
      aria-label="Global effects rack"
      className="cosimo-rack"
      data-scroll-surface="horizontal"
    >
      <div className="cosimo-rack__list">
        {items.map((item) => (
          <RackTile
            item={item}
            key={item.id}
            onEnableChange={onEffectEnabledChange}
            onFocus={onEffectFocus}
            onQuickChange={onQuickChange}
            onReadout={onReadout}
            onReorder={onReorder}
            selectedRef={selectedTile}
          />
        ))}
      </div>
    </section>
  );
}

export function VoiceModuleStrip({ items, onModuleFocus, onQuickChange, onReadout }) {
  const selectedTile = useSelectedRackTile(items);

  return (
    <section
      aria-label="Per-note voice path"
      className="cosimo-rack cosimo-rack--voice"
      data-scroll-surface="horizontal"
    >
      <div className="cosimo-rack__list">
        {items.map((item) => (
          <article
            className="cosimo-rack__tile cosimo-rack__tile--voice cosimo-surface"
            data-state={item.isSelected ? "selected" : "idle"}
            key={item.id}
            ref={item.isSelected ? selectedTile : null}
          >
            <button
              aria-current={item.isSelected ? "page" : undefined}
              aria-label={`Open ${item.label} editor`}
              className="cosimo-rack__identity cosimo-type-navigation"
              onClick={() => onModuleFocus?.(item.id)}
              type="button"
            >
              {item.label}
            </button>
            <RackQuickControl
              item={item}
              onChange={onQuickChange}
              onFocus={onModuleFocus}
              onReadout={onReadout}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
