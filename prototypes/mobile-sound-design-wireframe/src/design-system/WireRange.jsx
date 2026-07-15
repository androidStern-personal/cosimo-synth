export function WireRange({
  ariaLabel,
  value,
  minimum = 0,
  maximum = 100,
  defaultValue = minimum,
  accent = "currentColor",
  onChange,
}) {
  const span = maximum - minimum || 1;
  const position = ((value - minimum) / span) * 100;
  const defaultPosition = ((defaultValue - minimum) / span) * 100;

  return (
    <span className="wire-range" style={{ "--range-accent": accent }}>
      <span aria-hidden="true" className="wire-range__track">
        <span className="wire-range__fill" style={{ width: `${position}%` }} />
        <span className="wire-range__default" style={{ left: `${defaultPosition}%` }} />
        <span className="wire-range__handle" style={{ left: `${position}%` }} />
      </span>
      <input
        aria-label={ariaLabel}
        max={maximum}
        min={minimum}
        onChange={onChange}
        type="range"
        value={value}
      />
    </span>
  );
}
