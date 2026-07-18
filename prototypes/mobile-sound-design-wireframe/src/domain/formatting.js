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

/*
 * Modulation amounts mirror the real synth: a signed value in the target's
 * own units, not a uniform percent. Frequency-shaped targets move in
 * octaves, semitone targets in semitones, amp level in dB (asymmetric),
 * everything else in percent of range.
 */
export function modAmountSpec(target) {
  if (target?.format === "frequency") return { min: -6, max: 6, unit: "oct", digits: 1 };
  if (target?.format === "semitone") return { min: -48, max: 48, unit: "st", digits: 0 };
  if (target?.key === "amp-pan.level") return { min: -48, max: 6, unit: "dB", digits: 0 };
  if (target?.key === "amp-pan.pan") return { min: -100, max: 100, unit: "pan", digits: 0 };
  return { min: -100, max: 100, unit: "%", digits: 0 };
}

export function clampModAmount(target, amount) {
  const spec = modAmountSpec(target);
  return clamp(amount, spec.min, spec.max);
}

export function defaultModAmount(target) {
  const spec = modAmountSpec(target);
  const magnitudeLimit = Math.max(Math.abs(spec.min), Math.abs(spec.max));
  return Math.round(magnitudeLimit * 0.25 * 10) / 10;
}

/*
 * Polarity is part of the readout, exactly like the real synth: unipolar
 * pushes one way (+X / -X), bipolar swings both ways (±X). Pan reads as
 * L/R when unipolar.
 */
export function formatModAmountWithSpec(spec, amount, polarity = "Unipolar") {
  const clamped = clamp(amount, spec.min, spec.max);
  const magnitude = Math.abs(clamped).toFixed(spec.digits);
  if (Number(magnitude) === 0) return spec.unit === "pan" ? "0%" : `0${spec.unit}`;
  if (spec.unit === "pan") {
    if (polarity === "Bipolar") return `±${magnitude}%`;
    return `${magnitude}%${clamped < 0 ? "L" : "R"}`;
  }
  const prefix = polarity === "Bipolar" ? "±" : clamped > 0 ? "+" : "-";
  return `${prefix}${magnitude}${spec.unit}`;
}

export function formatModAmount(target, amount, polarity = "Unipolar") {
  return formatModAmountWithSpec(modAmountSpec(target), amount, polarity);
}

/*
 * The visual swing of a mapping on a 0-100 parameter track. Unipolar
 * extends from the base in the amount's direction; bipolar straddles the
 * base symmetrically. Matches the engine: contribution = source × amount,
 * where a unipolar source is 0..1 and a bipolar source is -1..+1.
 */
export function modulationBand(target, baseValue, mapping) {
  const spec = modAmountSpec(target);
  const magnitudeLimit = Math.max(Math.abs(spec.min), Math.abs(spec.max));
  const swing = (Math.abs(mapping.amount) / magnitudeLimit) * 100;
  const isBipolar = mapping.polarity === "Bipolar";
  const upper = isBipolar || mapping.amount > 0 ? clamp(baseValue + swing) : baseValue;
  const lower = isBipolar || mapping.amount < 0 ? clamp(baseValue - swing) : baseValue;
  return { start: lower, width: upper - lower };
}

const MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function formatMidiNote(note) {
  const rounded = Math.round(note);
  return `${MIDI_NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 2}`;
}

export function sourceColor(source) {
  return SOURCE_COLORS[source?.id] || "var(--cosimo-color-articulation-default)";
}
