/**
 * Exact-value text entry. A spec names a quantity's range, step and unit;
 * formatParameterEntry turns a stored value into display text and an editing
 * draft, and parseParameterEntry turns typed text back into a clamped, stepped
 * value or a message that says what to type instead.
 */

export type ParameterEntryBounds = {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly defaultUnit: string;
};

export type FrequencyParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "frequency";
    readonly defaultUnit: "Hz";
    /** "log" also accepts a percentage of the range, measured on a log scale. */
    readonly percentScale: "log" | null;
};

/** "x" is a multiplier, such as a playback speed of 1.5x. */
export type ScalarParameterEntryUnit = "" | "%" | "BPM" | "Q" | "dB" | "°" | "st" | "oct" | "ct" | "x";

export type ScalarParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "scalar";
    readonly defaultUnit: ScalarParameterEntryUnit;
    /** Stored value per displayed unit, e.g. 0.01 for a 0-1 value shown in %. */
    readonly canonicalPerDisplayedUnit: number;
    readonly digits: number;
};

/** A time stored in seconds. */
export type SecondsParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "seconds";
    readonly defaultUnit: "ms" | "s";
};

/** A time stored in milliseconds. */
export type MillisecondsParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "milliseconds";
    readonly defaultUnit: "ms" | "s";
};

/** One editable quantity's accepted vocabulary and stored range. */
export type ParameterEntrySpec =
    | FrequencyParameterEntrySpec
    | ScalarParameterEntrySpec
    | SecondsParameterEntrySpec
    | MillisecondsParameterEntrySpec;

export type SecondsParameterEntrySpecInput = {
    readonly minSeconds: number;
    readonly maxSeconds: number;
    readonly stepSeconds: number;
    readonly currentSeconds: number;
    /** Unit for a bare number; defaults to ms below one second so typing matches the readout. */
    readonly displayUnit?: "ms" | "s";
};

export type MillisecondsParameterEntrySpecInput = {
    readonly minMilliseconds: number;
    readonly maxMilliseconds: number;
    readonly stepMilliseconds: number;
    readonly currentMilliseconds: number;
    /** Unit for a bare number; defaults to s from one second up so typing matches the readout. */
    readonly displayUnit?: "ms" | "s";
};

export type FrequencyParameterEntrySpecInput = {
    readonly minHz: number;
    readonly maxHz: number;
    readonly stepHz: number;
    readonly allowLogPercent: boolean;
};

export type ScalarParameterEntrySpecInput = {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly unit: ScalarParameterEntryUnit;
    readonly canonicalPerDisplayedUnit?: number;
    readonly digits?: number;
};

/** Text shown for a value at rest, the draft placed in the field while editing, and its unit. */
export type FormattedParameterEntry = {
    readonly display: string;
    readonly draft: string;
    readonly unit: string;
};

export type ParameterValueCommit = {
    readonly _tag: "value";
    readonly value: number;
};

/** A successful parse, with the stored value echoed back as text. */
export type AcceptedParameterEntry = {
    readonly _tag: "accepted";
    readonly commit: ParameterValueCommit;
    readonly echo: FormattedParameterEntry;
};

/** A parse the user can correct; `message` says what to type. */
export type RejectedParameterEntry = {
    readonly _tag: "rejected";
    readonly message: string;
};

export type ParameterEntryResult = AcceptedParameterEntry | RejectedParameterEntry;

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function formatFrequencyDisplay(value: number): string {
    if (value >= 10_000) {
        return `${(value / 1_000).toFixed(1)} kHz`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(2)} kHz`;
    }
    return `${Math.round(value)} Hz`;
}

/** Lower-cases typed text and removes surrounding space and thousands separators. */
export function normalizeEntryText(text: string): string {
    return text.trim().toLowerCase().replace(/,/g, "");
}

/** Splits normalized text such as "1.5 khz" into its number and optional unit, or null. */
export function parseNumericAndUnit(text: string): { readonly numericText: string; readonly unit: string | undefined } | null {
    const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z%°]+)?$/);
    const numericText = match?.[1];
    if (numericText === undefined) {
        return null;
    }
    return { numericText, unit: match?.[2] };
}

export function unitIs(unit: string | undefined, ...aliases: ReadonlyArray<string>): boolean {
    return unit !== undefined && aliases.includes(unit);
}

export function parameterEntrySpecForSeconds({
    minSeconds,
    maxSeconds,
    stepSeconds,
    currentSeconds,
    displayUnit,
}: SecondsParameterEntrySpecInput): SecondsParameterEntrySpec {
    return {
        _tag: "seconds",
        min: minSeconds,
        max: maxSeconds,
        step: stepSeconds,
        defaultUnit: displayUnit ?? (currentSeconds < 1 ? "ms" : "s"),
    };
}

export function parameterEntrySpecForMilliseconds({
    minMilliseconds,
    maxMilliseconds,
    stepMilliseconds,
    currentMilliseconds,
    displayUnit,
}: MillisecondsParameterEntrySpecInput): MillisecondsParameterEntrySpec {
    return {
        _tag: "milliseconds",
        min: minMilliseconds,
        max: maxMilliseconds,
        step: stepMilliseconds,
        defaultUnit: displayUnit ?? (currentMilliseconds < 1_000 ? "ms" : "s"),
    };
}

export function parameterEntrySpecForFrequency({
    minHz,
    maxHz,
    stepHz,
    allowLogPercent,
}: FrequencyParameterEntrySpecInput): FrequencyParameterEntrySpec {
    return {
        _tag: "frequency",
        min: minHz,
        max: maxHz,
        step: stepHz,
        defaultUnit: "Hz",
        percentScale: allowLogPercent ? "log" : null,
    };
}

export function parameterEntrySpecForScalar({
    min,
    max,
    step,
    unit,
    canonicalPerDisplayedUnit = 1,
    digits = 3,
}: ScalarParameterEntrySpecInput): ScalarParameterEntrySpec {
    return { _tag: "scalar", min, max, step, defaultUnit: unit, canonicalPerDisplayedUnit, digits };
}

function quantize(value: number, spec: ParameterEntryBounds): number {
    const clamped = clamp(value, spec.min, spec.max);
    if (!(spec.step > 0)) {
        return clamped;
    }
    const stepped = spec.min + (Math.round((clamped - spec.min) / spec.step) * spec.step);
    // toFixed(8) drops binary noise such as 0.30000000000000004 before the final clamp.
    return clamp(Number(stepped.toFixed(8)), spec.min, spec.max);
}

function formatTrimmed(value: number, digits: number): string {
    return String(Number(value.toFixed(digits)));
}

function accept(value: number, spec: ParameterEntrySpec): AcceptedParameterEntry {
    const storedValue = quantize(value, spec);
    return {
        _tag: "accepted",
        commit: { _tag: "value", value: storedValue },
        echo: formatParameterEntry(spec, storedValue),
    };
}

function rejectUnit(unit: string, spec: ParameterEntrySpec): RejectedParameterEntry {
    if (spec.defaultUnit === "") {
        return { _tag: "rejected", message: `${unit} is not compatible with a unitless value.` };
    }
    return { _tag: "rejected", message: `${unit} is not compatible with a value in ${spec.defaultUnit}.` };
}

function formatScalar(spec: ScalarParameterEntrySpec, storedValue: number): FormattedParameterEntry {
    const draft = formatTrimmed(storedValue / spec.canonicalPerDisplayedUnit, spec.digits);
    if (spec.defaultUnit === "") {
        return { display: draft, draft, unit: "" };
    }
    if (spec.defaultUnit === "%" || spec.defaultUnit === "°" || spec.defaultUnit === "x") {
        return { display: `${draft}${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
    }
    return { display: `${draft} ${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
}

export function formatParameterEntry(spec: ParameterEntrySpec, value: number): FormattedParameterEntry {
    const storedValue = quantize(value, spec);
    if (spec._tag === "frequency") {
        return { display: formatFrequencyDisplay(storedValue), draft: String(storedValue), unit: spec.defaultUnit };
    }
    if (spec._tag === "scalar") {
        return formatScalar(spec, storedValue);
    }
    const shownValue = spec._tag === "seconds"
        ? (spec.defaultUnit === "ms" ? storedValue * 1_000 : storedValue)
        : (spec.defaultUnit === "s" ? storedValue / 1_000 : storedValue);
    const draft = formatTrimmed(shownValue, 3);
    return { display: `${draft} ${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
}

/** Accepts Hz, kHz ("k" for short) and, when the spec allows it, a log-scale percentage of the range. */
export function parseFrequency(spec: FrequencyParameterEntrySpec, text: string): ParameterEntryResult {
    const parsed = parseNumericAndUnit(text);
    if (parsed === null) {
        return { _tag: "rejected", message: "Enter a number in Hz or kHz." };
    }
    const numericValue = Number(parsed.numericText);
    if (!Number.isFinite(numericValue)) {
        return { _tag: "rejected", message: "Enter a finite number in Hz or kHz." };
    }
    if (parsed.unit === "%" && spec.percentScale === null) {
        return rejectUnit("%", spec);
    }
    if (parsed.unit !== undefined && parsed.unit !== "%" && !unitIs(parsed.unit, "hz", "khz", "k")) {
        return rejectUnit(parsed.unit, spec);
    }
    const value = unitIs(parsed.unit, "khz", "k")
        ? numericValue * 1_000
        : parsed.unit === "%"
            ? spec.min * (spec.max / spec.min) ** (numericValue / 100)
            : numericValue;
    return accept(value, spec);
}

function scalarPrompt(spec: ScalarParameterEntrySpec, finite: boolean): string {
    if (spec.defaultUnit === "") {
        return finite ? "Enter a finite unitless number." : "Enter a unitless number.";
    }
    if (spec.defaultUnit === "x") {
        return finite ? "Enter a finite multiplier, such as 1.5x." : "Enter a multiplier, such as 1.5x.";
    }
    return `Enter ${finite ? "a finite number" : "a number"} in ${spec.defaultUnit}.`;
}

function scalarUnitCompatible(spec: ScalarParameterEntrySpec, unit: string): boolean {
    switch (spec.defaultUnit) {
        case "%": return unit === "%";
        case "BPM": return unitIs(unit, "bpm");
        case "Q": return unitIs(unit, "q");
        case "dB": return unitIs(unit, "db");
        case "°": return unitIs(unit, "°", "deg", "degree", "degrees");
        case "st": return unitIs(unit, "st", "semitone", "semitones", "ct", "cent", "cents");
        case "oct": return unitIs(unit, "oct", "octave", "octaves");
        case "ct": return unitIs(unit, "ct", "cent", "cents");
        case "x": return unit === "x";
        case "": return false;
    }
}

function parseScalar(spec: ScalarParameterEntrySpec, text: string): ParameterEntryResult {
    const parsed = parseNumericAndUnit(text);
    if (parsed === null) {
        return { _tag: "rejected", message: scalarPrompt(spec, false) };
    }
    if (parsed.unit !== undefined && !scalarUnitCompatible(spec, parsed.unit)) {
        return rejectUnit(parsed.unit, spec);
    }
    const numericValue = Number(parsed.numericText);
    if (!Number.isFinite(numericValue)) {
        return { _tag: "rejected", message: scalarPrompt(spec, true) };
    }
    // A semitone field also takes cents: "50 ct" is half a semitone.
    const centsScale = spec.defaultUnit === "st" && unitIs(parsed.unit, "ct", "cent", "cents") ? 0.01 : 1;
    return accept(numericValue * centsScale * spec.canonicalPerDisplayedUnit, spec);
}

function parseTime(spec: SecondsParameterEntrySpec | MillisecondsParameterEntrySpec, text: string): ParameterEntryResult {
    const parsed = parseNumericAndUnit(text);
    if (parsed === null) {
        return { _tag: "rejected", message: "Enter a time in ms or s." };
    }
    const typedMilliseconds = unitIs(parsed.unit, "ms", "msec", "msecs", "millisecond", "milliseconds");
    const typedSeconds = unitIs(parsed.unit, "s", "sec", "secs", "second", "seconds");
    if (parsed.unit !== undefined && !typedMilliseconds && !typedSeconds) {
        return rejectUnit(parsed.unit, spec);
    }
    const numericValue = Number(parsed.numericText);
    if (!Number.isFinite(numericValue)) {
        return { _tag: "rejected", message: "Enter a finite time in ms or s." };
    }
    const inMilliseconds = typedMilliseconds || (parsed.unit === undefined && spec.defaultUnit === "ms");
    if (spec._tag === "seconds") {
        return accept(inMilliseconds ? numericValue / 1_000 : numericValue, spec);
    }
    return accept(inMilliseconds ? numericValue : numericValue * 1_000, spec);
}

/** Parses typed text into the value to store, or a message saying what to type instead. */
export function parseParameterEntry(spec: ParameterEntrySpec, text: string): ParameterEntryResult {
    const normalizedText = normalizeEntryText(text);
    if (spec._tag === "frequency") return parseFrequency(spec, normalizedText);
    if (spec._tag === "scalar") return parseScalar(spec, normalizedText);
    return parseTime(spec, normalizedText);
}
