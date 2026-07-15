import { CaretDown } from "@phosphor-icons/react";

export function CompoundControls({ label, setting, targetId, onChange }) {
  if (!setting) return null;

  return (
    <div className="compound-controls" aria-label={`${label} mode`}>
      <span className="cosimo-type-label">{label}</span>
      <button
        className="compound-controls__mode"
        data-state={setting.mode === "Free" ? "selected" : undefined}
        onClick={() => onChange(targetId, { mode: "Free" })}
        type="button"
      >
        FREE
      </button>
      <button
        className="compound-controls__mode"
        data-state={setting.mode === "Sync" ? "selected" : undefined}
        onClick={() => onChange(targetId, { mode: "Sync" })}
        type="button"
      >
        SYNC
      </button>
      <span className="compound-controls__division">
        <select
          aria-label={`${label} division`}
          onChange={(event) => onChange(targetId, { division: event.target.value })}
          value={setting.division}
        >
          <option>1/4</option>
          <option>1/8</option>
          <option>1/16</option>
          <option>1/32</option>
        </select>
        <CaretDown aria-hidden="true" size={12} weight="bold" />
      </span>
    </div>
  );
}
