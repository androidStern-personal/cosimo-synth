import { SOURCE_COLORS } from "./catalog.js";

export function clamp(value, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function formatValue(target, value) {
  if (!target) return `${Math.round(value)}%`;
  if (target.format === "frequency") {
    const hz = Math.round(20 * 1000 ** (value / 100));
    return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz} Hz`;
  }
  if (target.format === "rate") {
    return `${(0.05 + (value / 100) * 9.95).toFixed(2)} Hz`;
  }
  if (target.format === "phase") return `${Math.round((value / 100) * 360)}°`;
  if (target.format === "signed") return `${Math.round((value - 50) * 2)}%`;
  if (target.format === "semitone") {
    return `${value >= 50 ? "+" : ""}${Math.round((value - 50) / 2)} st`;
  }
  return `${Math.round(value)}%`;
}

export function formatSignedPercent(value) {
  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
}

export function sourceColor(source) {
  return SOURCE_COLORS[source?.id] || "var(--cosimo-color-articulation-default)";
}
