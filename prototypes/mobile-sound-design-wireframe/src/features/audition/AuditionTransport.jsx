import { useEffect, useRef } from "react";
import { CaretDown, Circle } from "@phosphor-icons/react";
import { ArticulationIcon } from "../../design-system/IdentityMark.jsx";

function TransportSelect({ ariaLabel, children, onChange, value }) {
  return (
    <span className="cosimo-audition__select">
      <select aria-label={ariaLabel} onChange={onChange} value={value}>
        {children}
      </select>
      <CaretDown aria-hidden="true" size={14} weight="bold" />
    </span>
  );
}

function TriggerControl({
  active,
  latch,
  onCancel,
  onEnd,
  onFallback,
  onStart,
}) {
  const activeInput = useRef(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (active) return;
    // A latched note can become inactive on pointer-down. Preserve the
    // in-flight gesture until pointer-up/click so that the synthetic click is
    // suppressed instead of immediately starting a fresh note.
    if (activeInput.current) return;
    activeInput.current = null;
    suppressClick.current = false;
  }, [active]);

  const begin = (kind, event) => {
    if (activeInput.current) return;
    activeInput.current = { kind, pointerId: event?.pointerId };
    suppressClick.current = true;
    if (kind === "pointer") event.currentTarget.setPointerCapture?.(event.pointerId);
    onStart?.();
  };

  const finish = (kind, event, cancelled = false) => {
    const current = activeInput.current;
    if (!current || current.kind !== kind) return;
    activeInput.current = null;
    if (kind === "pointer" && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) {
      suppressClick.current = false;
      onCancel?.();
      return;
    }
    onEnd?.();
  };

  return (
    <button
      aria-label={active ? "Release triggered note" : "Trigger note"}
      aria-pressed={active}
      className="cosimo-audition__trigger"
      onBlur={() => {
        if (latch || !activeInput.current) return;
        activeInput.current = null;
        suppressClick.current = false;
        onCancel?.();
      }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onFallback?.();
      }}
      onKeyDown={(event) => {
        if ((event.key !== " " && event.key !== "Enter") || event.repeat) return;
        event.preventDefault();
        begin("keyboard", event);
      }}
      onKeyUp={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        finish("keyboard", event);
      }}
      onPointerCancel={(event) => finish("pointer", event, true)}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        begin("pointer", event);
      }}
      onPointerLeave={(event) => {
        if (
          event.buttons
          && activeInput.current
          && !event.currentTarget.hasPointerCapture?.(event.pointerId)
        ) finish("pointer", event);
      }}
      onPointerUp={(event) => finish("pointer", event)}
      type="button"
    >
      <Circle aria-hidden="true" size={15} weight={active ? "fill" : "regular"} />
    </button>
  );
}

/**
 * Persistent audition view. Articulation options are semantic identities:
 * { id, label, color }. Trigger callbacks are held-note events, not clicks.
 */
export function AuditionTransport({
  articulationId,
  articulations,
  canCapture,
  captureContext = null,
  captureLabel = "Capture motion",
  latch,
  note,
  notes = ["C2", "C3", "C4"],
  onArticulationChange,
  onCapture,
  onDefaultArticulation,
  onLatchChange,
  onNoteChange,
  onRepeatChange,
  onTriggerCancel,
  onTriggerEnd,
  onTriggerFallback,
  onTriggerStart,
  onToggleWear,
  repeat,
  status,
  triggerActive,
  wearingArticulationId = null,
}) {
  const articulation = articulations.find((item) => item.id === articulationId)
    || articulations[0];

  useEffect(() => {
    if (!triggerActive) return undefined;
    const cancelHeldNote = () => onTriggerCancel?.();
    const cancelWhenHidden = () => {
      if (document.visibilityState === "hidden") cancelHeldNote();
    };
    window.addEventListener("blur", cancelHeldNote);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () => {
      window.removeEventListener("blur", cancelHeldNote);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
    };
  }, [onTriggerCancel, triggerActive]);

  return (
    <section
      aria-label="Persistent audition controls"
      className="cosimo-audition"
      style={{ "--cosimo-articulation-color": articulation.color }}
    >
      <div className="cosimo-audition__primary">
        <label className="cosimo-audition__field cosimo-audition__articulation">
          <span className="cosimo-audition__label cosimo-type-label">Articulation</span>
          <span className="cosimo-audition__articulation-control">
            <span className="cosimo-audition__articulation-mark">
              <ArticulationIcon articulation={articulation.id} size={14} />
            </span>
            <TransportSelect
              ariaLabel="Articulation"
              onChange={(event) => onArticulationChange?.(event.target.value)}
              value={articulationId}
            >
              {articulations.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </TransportSelect>
          </span>
        </label>
        <button
          aria-label="Use Default articulation"
          className="cosimo-audition__default cosimo-type-label"
          data-quiet={articulationId === "Default" ? "true" : undefined}
          onClick={() => {
            if (onDefaultArticulation) onDefaultArticulation();
            else onArticulationChange?.("Default");
          }}
          type="button"
        >
          <span>Default</span>
        </button>
        <span className="cosimo-audition__field cosimo-audition__edit-field">
          <span className="cosimo-audition__label cosimo-type-label">Edit</span>
          {articulationId === "Default" ? (
            <span aria-hidden="true" className="cosimo-audition__edit-empty" />
          ) : (
            <button
              aria-label={wearingArticulationId === articulationId
                ? `Done editing ${articulation.label}`
                : `Edit ${articulation.label} overrides`}
              aria-pressed={wearingArticulationId === articulationId}
              className="cosimo-audition__edit-latch cosimo-type-label"
              data-on={wearingArticulationId === articulationId || undefined}
              onClick={() => onToggleWear?.(articulationId)}
              type="button"
            >
              {wearingArticulationId === articulationId ? "✓" : "Edit"}
            </button>
          )}
        </span>
        <label className="cosimo-audition__field cosimo-audition__note">
          <span className="cosimo-audition__label cosimo-type-label">Note</span>
          <TransportSelect
            ariaLabel="Audition note"
            onChange={(event) => onNoteChange?.(event.target.value)}
            value={note}
          >
            {notes.map((item) => <option key={item}>{item}</option>)}
          </TransportSelect>
        </label>
        <span className="cosimo-audition__field cosimo-audition__trigger-field">
          <span className="cosimo-audition__label cosimo-type-label">Trigger</span>
          <TriggerControl
            active={triggerActive}
            latch={latch}
            onCancel={onTriggerCancel}
            onEnd={onTriggerEnd}
            onFallback={onTriggerFallback}
            onStart={onTriggerStart}
          />
        </span>
      </div>
      <div className="cosimo-audition__secondary">
        <label className="cosimo-audition__toggle cosimo-type-label">
          <input
            aria-label="Repeat trigger"
            checked={repeat}
            onChange={(event) => onRepeatChange?.(event.target.checked)}
            type="checkbox"
          />
          <span aria-hidden="true" />
          Repeat
        </label>
        <label className="cosimo-audition__toggle cosimo-type-label">
          <input
            aria-label="Latch trigger"
            checked={latch}
            onChange={(event) => onLatchChange?.(event.target.checked)}
            type="checkbox"
          />
          <span aria-hidden="true" />
          Latch
        </label>
        <button
          className="cosimo-audition__capture cosimo-type-label"
          disabled={!canCapture}
          onClick={onCapture}
          type="button"
        >
          {captureLabel}
        </button>
        <output
          aria-label={status}
          aria-live="polite"
          className="cosimo-audition__status cosimo-type-value"
        >
          <span aria-hidden="true" className="cosimo-audition__status-full">
            {status}
          </span>
          <span aria-hidden="true" className="cosimo-audition__status-compact">
            {captureContext
              ? `${captureContext.phase} · ${captureContext.articulation} · ${captureContext.target} · ${captureContext.layer}`
              : status}
          </span>
        </output>
      </div>
    </section>
  );
}
