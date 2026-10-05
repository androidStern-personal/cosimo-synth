// Frequency, amount and Q: the band's three continuous controls. The readouts
// and the response graph share each one's range, text, drag and keyboard laws
// and exact entry, so a pixel or a key step means the same thing on both.
import { formatFrequencyDisplay, normalizeEntryText, parseNumericAndUnit, unitIs } from "../../../kit/index";

/** Typed text as a value to store, or a message saying what to type instead. */
export type Entry = { readonly value: number } | { readonly error: string };

export type Quantity = {
    readonly min: number;
    readonly max: number;
    /** The readout's units per stored unit: amount is stored 0 to 1 and shown as 0 to +12 dB. */
    readonly shownPerStored: number;
    readonly format: (value: number) => string;
    /** The value a drag reaches from `origin` after `pixels` of rightward or upward travel. */
    readonly drag: (origin: number, pixels: number) => number;
    /** One arrow-key step up (+1) or down (-1). */
    readonly step: (value: number, direction: 1 | -1) => number;
    readonly parse: (text: string) => Entry;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Parse a number with an optional unit; `toValue` converts it, or returns null for a unit it does not accept. */
function parser(range: { readonly min: number; readonly max: number }, prompt: string,
    toValue: (number: number, unit: string | undefined) => number | null): (text: string) => Entry {
    return text => {
        const parsed = parseNumericAndUnit(normalizeEntryText(text));
        const value = parsed && toValue(Number(parsed.numericText), parsed.unit);
        return value === null || !Number.isFinite(value) ? { error: prompt } : { value: clamp(value, range.min, range.max) };
    };
}

const frequencyRange = { min: 20, max: 20_000 };
/** One octave per 80 pixels of horizontal travel; one semitone per arrow key. */
export const frequency: Quantity = {
    ...frequencyRange,
    shownPerStored: 1,
    format: formatFrequencyDisplay,
    drag: (origin, pixels) => clamp(origin * 2 ** (pixels / 80), frequencyRange.min, frequencyRange.max),
    step: (value, direction) => clamp(value * 2 ** (direction / 12), frequencyRange.min, frequencyRange.max),
    parse: parser(frequencyRange, "Type a frequency such as 440 or 2.5k.", (number, unit) =>
        unit === undefined || unitIs(unit, "hz") ? number : unitIs(unit, "k", "khz") ? number * 1000 : null),
};

const amountRange = { min: 0, max: 1 };
/** The boost's 0 to +12 dB range over 240 pixels of upward travel; 1% of it per arrow key. */
export const amount: Quantity = {
    ...amountRange,
    shownPerStored: 12,
    format: value => `+${(value * 12).toFixed(1)} dB`,
    drag: (origin, pixels) => clamp(origin + pixels / 240, amountRange.min, amountRange.max),
    step: (value, direction) => clamp(value + direction * 0.01, amountRange.min, amountRange.max),
    parse: parser(amountRange, "Type a boost from 0 to 12 dB.", (number, unit) =>
        unit === undefined || unitIs(unit, "db") ? number / 12 : null),
};

const qRange = { min: 0.1, max: 10 };
/** Q doubles over 40 pixels of upward travel; six arrow-key steps double it. */
export const q: Quantity = {
    ...qRange,
    shownPerStored: 1,
    format: value => value.toFixed(2),
    drag: (origin, pixels) => clamp(origin * 2 ** (pixels / 40), qRange.min, qRange.max),
    step: (value, direction) => clamp(value * 2 ** (direction / 6), qRange.min, qRange.max),
    parse: parser(qRange, "Type a Q from 0.1 to 10.", (number, unit) =>
        unit === undefined || unitIs(unit, "q") ? number : null),
};
