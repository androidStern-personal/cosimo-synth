/**
 * One stable value-feedback surface for every continuous edit context.
 * Its container owns the width, so changing values never changes layout.
 */
export function TransientValueHUD({ className = "", fallback = "", value = "" }) {
  return (
    <output
      aria-live="polite"
      className={`cosimo-transient-hud cosimo-value ${className}`.trim()}
      data-active={value ? "true" : undefined}
      data-value-kind="status"
    >
      {value || fallback}
    </output>
  );
}
