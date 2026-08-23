import {
    getRackEffectDescriptor,
    getRackParameterDescriptor,
    type RackParameterChoice,
    type RackParameterDescriptor,
} from "./rack-parameter-descriptors";
import { laneMirrorRackKind, parseLaneModulationTargetKind } from "./lane-modulation-targets";
import {
    getModulationAmountBounds,
    isRackModulationTarget,
} from "./modulation";
import {
    getVoiceModulationParameterKind,
    parseVoiceModulationTargetKind,
    type ModulationTargetKind,
    type VoiceModulationTargetKind,
} from "./modulation-targets";
import {
    MOBILE_VOICE_DISPLAY_DESCRIPTORS,
    type MobileVoiceBindableControlID,
} from "./mobile-voice-display-descriptors";
import { getMobileVoiceControlSpec } from "./mobile-voice-parameter-manifest";
import { getModulationTargetDescriptor } from "./target-descriptor";

type ParameterEntryBounds = {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly defaultUnit: string;
};

type FrequencyParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "frequency";
    readonly defaultUnit: "Hz";
    readonly percentScale: "log" | null;
};

type ScalarParameterEntryUnit = "%" | "Q" | "dB" | "°" | "st" | "oct" | "ct" | "x";

type ScalarParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "scalar";
    readonly defaultUnit: ScalarParameterEntryUnit;
    readonly canonicalPerDisplayedUnit: number;
    readonly digits: number;
};

type SecondsParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "seconds";
    readonly defaultUnit: "ms" | "s";
};

type MillisecondsParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "milliseconds";
    readonly defaultUnit: "ms" | "s";
};

type PanParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "pan";
    readonly defaultUnit: "%";
};

type ChoiceParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "choice";
    readonly defaultUnit: "choice";
    readonly choices: ReadonlyArray<RackParameterChoice>;
};

type AmountParameterEntryUnit = "%" | "oct" | "st" | "dB" | "Q" | "s" | "ms" | "Hz" | "°";

type AmountParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "amount";
    readonly defaultUnit: AmountParameterEntryUnit;
    readonly canonicalPerDisplayedUnit: number;
    readonly digits: number;
    readonly percentMeaning: "native" | "depth";
    readonly baseValue: number | null;
    readonly physicalIntervalUnit: "frequency" | "milliseconds" | null;
};

type TempoSyncParameterEntrySpec = ParameterEntryBounds & {
    readonly _tag: "tempoSync";
    readonly defaultUnit: "Hz" | "ms" | "s";
    readonly freeSpec: FrequencyParameterEntrySpec | MillisecondsParameterEntrySpec;
    readonly divisions: ReadonlyArray<RackParameterChoice>;
};

/** One editable quantity's accepted vocabulary and canonical storage domain. */
export type ParameterEntrySpec =
    | FrequencyParameterEntrySpec
    | ScalarParameterEntrySpec
    | SecondsParameterEntrySpec
    | MillisecondsParameterEntrySpec
    | PanParameterEntrySpec
    | ChoiceParameterEntrySpec
    | AmountParameterEntrySpec
    | TempoSyncParameterEntrySpec;

/** Source values needed to derive a displayed-default time entry spec. */
export type SecondsParameterEntrySpecInput = {
    readonly minSeconds: number;
    readonly maxSeconds: number;
    readonly stepSeconds: number;
    readonly currentSeconds: number;
};

/** Source values needed for a frequency entry spec. */
export type FrequencyParameterEntrySpecInput = {
    readonly minHz: number;
    readonly maxHz: number;
    readonly stepHz: number;
    readonly allowLogPercent: boolean;
};

/** Source values needed for a scalar entry spec. */
export type ScalarParameterEntrySpecInput = {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly unit: ScalarParameterEntryUnit;
    readonly canonicalPerDisplayedUnit?: number;
    readonly digits?: number;
};

/** The live endpoint needed to interpret a signed physical modulation interval. */
export type ModulationAmountBaseBindingSpec = {
    readonly endpointID: string;
    readonly initialValue: number;
};

/** Canonical text shown for a value at rest and while editing. */
export type FormattedParameterEntry = {
    readonly display: string;
    readonly draft: string;
    readonly unit: string;
};

/** A normal numeric parameter write produced by exact-value entry. */
export type ParameterValueCommit = {
    readonly _tag: "value";
    readonly value: number;
    readonly mode: "free" | null;
};

/** A compound tempo-sync write produced by exact-value entry. */
export type ParameterTempoDivisionCommit = {
    readonly _tag: "tempoDivision";
    readonly mode: "sync";
    readonly divisionValue: number;
    readonly divisionLabel: string;
};

/** Every write exact-value entry can request. */
export type ParameterEntryCommit = ParameterValueCommit | ParameterTempoDivisionCommit;

/** A successful exact-value parse and the canonical value echoed to the field. */
export type AcceptedParameterEntry = {
    readonly _tag: "accepted";
    readonly commit: ParameterEntryCommit;
    readonly echo: FormattedParameterEntry;
};

/** A user-correctable exact-value rejection. */
export type RejectedParameterEntry = {
    readonly _tag: "rejected";
    readonly message: string;
};

/** The only two outcomes of parsing exact-value text. */
export type ParameterEntryResult = AcceptedParameterEntry | RejectedParameterEntry;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function quantize(value: number, spec: ParameterEntryBounds): number {
    if (!(spec.step > 0)) {
        return clamp(value, spec.min, spec.max);
    }

    const clamped = clamp(value, spec.min, spec.max);
    const stepped = spec.min + (Math.round((clamped - spec.min) / spec.step) * spec.step);
    return clamp(Number(stepped.toFixed(8)), spec.min, spec.max);
}

function formatFrequencyDisplay(value: number): string {
    if (value >= 10_000) {
        return `${(value / 1_000).toFixed(1)} kHz`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(2)} kHz`;
    }
    return `${Math.round(value)} Hz`;
}

function formatTrimmed(value: number, digits: number): string {
    return String(Number(value.toFixed(digits)));
}

function normalizeEntryText(text: string): string {
    return text.trim().toLowerCase().replace(/,/g, "");
}

function valueCommit(value: number, spec: ParameterEntrySpec, mode: "free" | null = null): AcceptedParameterEntry {
    const canonicalValue = quantize(value, spec);
    return {
        _tag: "accepted",
        commit: { _tag: "value", value: canonicalValue, mode },
        echo: formatParameterEntry(spec, canonicalValue),
    };
}

function rejectForUnit(unit: string, defaultUnit: string): RejectedParameterEntry {
    return {
        _tag: "rejected",
        message: `${unit} is not compatible with a value in ${defaultUnit}.`,
    };
}

function frequencySpec(
    min: number,
    max: number,
    step: number,
    percentScale: "log" | null,
): FrequencyParameterEntrySpec {
    return { _tag: "frequency", min, max, step, defaultUnit: "Hz", percentScale };
}

function scalarSpec({
    min,
    max,
    step,
    unit,
    canonicalPerDisplayedUnit = 1,
    digits = 3,
}: ScalarParameterEntrySpecInput): ScalarParameterEntrySpec {
    return {
        _tag: "scalar",
        min,
        max,
        step,
        defaultUnit: unit,
        canonicalPerDisplayedUnit,
        digits,
    };
}

function millisecondsSpec(
    descriptor: RackParameterDescriptor,
    currentValue: number,
): MillisecondsParameterEntrySpec {
    return {
        _tag: "milliseconds",
        min: descriptor.min,
        max: descriptor.max,
        step: 0,
        defaultUnit: currentValue < 1_000 ? "ms" : "s",
    };
}

function tempoSyncCompanion(
    descriptor: RackParameterDescriptor,
): RackParameterDescriptor | null {
    const divisionEndpointID = descriptor.endpointID === "delayTime"
        ? "delayDivision"
        : descriptor.endpointID === "phaserRate"
            ? "phaserRateDivision"
            : null;
    if (divisionEndpointID === null) {
        return null;
    }
    return getRackEffectDescriptor(descriptor.effectId).parameters.find(
        (parameter) => parameter.endpointID === divisionEndpointID,
    ) ?? null;
}

/** Derive a base-value entry spec from the authoritative rack descriptor. */
export function parameterEntrySpecForRackParameter(
    descriptor: RackParameterDescriptor,
    currentValue: number,
): ParameterEntrySpec {
    if (descriptor.choices !== undefined) {
        return {
            _tag: "choice",
            min: descriptor.min,
            max: descriptor.max,
            step: descriptor.step,
            defaultUnit: "choice",
            choices: descriptor.choices,
        };
    }

    let spec: FrequencyParameterEntrySpec | MillisecondsParameterEntrySpec | ScalarParameterEntrySpec;
    if (descriptor.unit === "Hz") {
        spec = frequencySpec(
            descriptor.min,
            descriptor.max,
            0,
            descriptor.endpointID === "globalFilterCutoff" ? "log" : null,
        );
    } else if (descriptor.unit === "ms") {
        spec = millisecondsSpec(descriptor, currentValue);
    } else if (descriptor.unit === "%") {
        spec = scalarSpec({ min: descriptor.min, max: descriptor.max, step: 0, unit: "%", digits: 4 });
    } else if (descriptor.unit === "dB") {
        spec = scalarSpec({ min: descriptor.min, max: descriptor.max, step: 0, unit: "dB", digits: 4 });
    } else if (descriptor.unit === "deg") {
        spec = scalarSpec({ min: descriptor.min, max: descriptor.max, step: 0, unit: "°", digits: 4 });
    } else if (descriptor.unit === "st") {
        spec = scalarSpec({ min: descriptor.min, max: descriptor.max, step: 0, unit: "st", digits: 4 });
    } else {
        spec = scalarSpec({
            min: descriptor.min,
            max: descriptor.max,
            step: 0,
            unit: "%",
            canonicalPerDisplayedUnit: 0.01,
            digits: 4,
        });
    }

    const divisionDescriptor = tempoSyncCompanion(descriptor);
    if (divisionDescriptor?.choices === undefined || spec._tag === "scalar") {
        return spec;
    }
    return {
        _tag: "tempoSync",
        min: spec.min,
        max: spec.max,
        step: spec.step,
        defaultUnit: spec.defaultUnit,
        freeSpec: spec,
        divisions: divisionDescriptor.choices,
    };
}

function requirePositiveLogarithmicBase(baseValue: number): void {
    if (!Number.isFinite(baseValue) || baseValue <= 0) {
        throw new RangeError("A logarithmic modulation amount requires a positive finite base value.");
    }
}

function amountSpec(args: Omit<AmountParameterEntrySpec, "_tag">): AmountParameterEntrySpec {
    return { _tag: "amount", ...args };
}

function nativePercentAmount(
    min: number,
    max: number,
    step: number,
    canonicalPerDisplayedUnit: number,
): AmountParameterEntrySpec {
    return amountSpec({
        min,
        max,
        step,
        defaultUnit: "%",
        canonicalPerDisplayedUnit,
        digits: 3,
        percentMeaning: "native",
        baseValue: null,
        physicalIntervalUnit: null,
    });
}

function voiceAmountSpec(
    targetKind: VoiceModulationTargetKind,
    baseValue: number,
): ParameterEntrySpec {
    const bounds = getModulationAmountBounds(targetKind);
    const parameterKind = getVoiceModulationParameterKind(targetKind);
    switch (parameterKind) {
        case "filterCutoffOctaves":
            requirePositiveLogarithmicBase(baseValue);
            return amountSpec({
                ...bounds,
                defaultUnit: "oct",
                canonicalPerDisplayedUnit: 1,
                digits: 3,
                percentMeaning: "depth",
                baseValue,
                physicalIntervalUnit: "frequency",
            });
        case "filterQ":
            return amountSpec({ ...bounds, defaultUnit: "Q", canonicalPerDisplayedUnit: 1, digits: 3, percentMeaning: "depth", baseValue: null, physicalIntervalUnit: null });
        case "pitchSemitones":
            return amountSpec({ ...bounds, defaultUnit: "st", canonicalPerDisplayedUnit: 1, digits: 3, percentMeaning: "depth", baseValue: null, physicalIntervalUnit: null });
        case "ampGainDb":
            return amountSpec({ ...bounds, defaultUnit: "dB", canonicalPerDisplayedUnit: 1, digits: 3, percentMeaning: "depth", baseValue: null, physicalIntervalUnit: null });
        case "mseg1Rate":
        case "mseg2Rate":
        case "mseg3Rate":
        case "env1Attack":
        case "env1Decay":
        case "env1Release":
        case "env2Attack":
        case "env2Decay":
        case "env2Release":
        case "env3Attack":
        case "env3Decay":
        case "env3Release":
            return amountSpec({ ...bounds, defaultUnit: "s", canonicalPerDisplayedUnit: 1, digits: 3, percentMeaning: "depth", baseValue: null, physicalIntervalUnit: null });
        case "pan":
            return { _tag: "pan", ...bounds, defaultUnit: "%" };
        case "wavetablePosition":
        case "warpAmount":
        case "filterMix":
        case "unisonDetune":
        case "unisonBlend":
        case "unisonWidth":
        case "unisonWavetablePositionSpread":
        case "unisonWarpSpread":
        case "mseg1Morph":
        case "mseg2Morph":
        case "mseg3Morph":
        case "env1Sustain":
        case "env2Sustain":
        case "env3Sustain":
            return nativePercentAmount(bounds.min, bounds.max, bounds.step, 0.01);
    }
}

function rackAmountSpec(
    targetKind: ModulationTargetKind,
    descriptor: RackParameterDescriptor,
    baseValue: number,
): AmountParameterEntrySpec {
    const bounds = getModulationAmountBounds(targetKind);
    if (descriptor.modulationApplication === "octaves") {
        requirePositiveLogarithmicBase(baseValue);
        return amountSpec({
            ...bounds,
            defaultUnit: "oct",
            canonicalPerDisplayedUnit: 1,
            digits: 3,
            percentMeaning: "depth",
            baseValue,
            physicalIntervalUnit: descriptor.unit === "ms" ? "milliseconds" : "frequency",
        });
    }
    if (descriptor.unit === "" && descriptor.max - descriptor.min <= 2) {
        return nativePercentAmount(bounds.min, bounds.max, bounds.step, 0.01);
    }
    if (descriptor.unit === "%") {
        return nativePercentAmount(bounds.min, bounds.max, bounds.step, 1);
    }
    const defaultUnit = descriptor.unit === "deg"
        ? "°"
        : descriptor.unit === ""
            ? "Q"
            : descriptor.unit;
    return amountSpec({
        ...bounds,
        defaultUnit,
        canonicalPerDisplayedUnit: 1,
        digits: 3,
        percentMeaning: "depth",
        baseValue: null,
        physicalIntervalUnit: null,
    });
}

/** A lane parameter's amount language is its device type's canonical (#1)
    language — pool instances defer to the same-named base-module target. */
function laneAmountAuthorityKind(targetKind: ModulationTargetKind): ModulationTargetKind {
    const parsedLane = parseLaneModulationTargetKind(targetKind);
    return parsedLane !== null ? laneMirrorRackKind(parsedLane) : targetKind;
}

/** Derive a modulation-amount spec from the canonical target and route limit table. */
export function parameterEntrySpecForModulationAmount(
    targetKind: ModulationTargetKind,
    baseValue: number,
): ParameterEntrySpec {
    const voiceTargetKind = parseVoiceModulationTargetKind(targetKind);
    if (voiceTargetKind !== null) {
        return voiceAmountSpec(voiceTargetKind, baseValue);
    }
    if (!isRackModulationTarget(laneAmountAuthorityKind(targetKind))) {
        throw new Error(`Unknown modulation target "${targetKind}".`);
    }
    const descriptor = getRackParameterDescriptor(parseLaneModulationTargetKind(targetKind)?.endpointID ?? "");
    if (descriptor === null || descriptor.modulationTargetIndex === null) {
        throw new Error(`Unknown rack modulation target "${targetKind}".`);
    }
    return rackAmountSpec(targetKind, descriptor, baseValue);
}

/**
 * Resolve the live base endpoint needed by logarithmic modulation amounts.
 * Linear amounts have no base dependency and deliberately return null.
 */
export function modulationAmountBaseBindingSpec(
    targetKind: ModulationTargetKind,
): ModulationAmountBaseBindingSpec | null {
    const voiceTargetKind = parseVoiceModulationTargetKind(targetKind);
    const authorityKind = laneAmountAuthorityKind(targetKind);
    const needsBase = voiceTargetKind === "filterCutoffOctaves"
        || (isRackModulationTarget(authorityKind)
            && getRackParameterDescriptor(parseLaneModulationTargetKind(targetKind)?.endpointID ?? "")?.modulationApplication === "octaves");
    if (!needsBase) {
        return null;
    }

    const descriptor = getModulationTargetDescriptor(authorityKind);
    if (descriptor.binding._tag !== "endpoint") {
        throw new Error(`Logarithmic modulation target "${targetKind}" has no base endpoint.`);
    }
    return {
        endpointID: descriptor.binding.endpointId,
        initialValue: descriptor.binding.toEngine(descriptor.initialValue),
    };
}

/** Derive a time spec whose bare-number unit matches the value currently displayed. */
export function parameterEntrySpecForSeconds({
    minSeconds,
    maxSeconds,
    stepSeconds,
    currentSeconds,
}: SecondsParameterEntrySpecInput): ParameterEntrySpec {
    return {
        _tag: "seconds",
        min: minSeconds,
        max: maxSeconds,
        step: stepSeconds,
        defaultUnit: currentSeconds < 1 ? "ms" : "s",
    };
}

/** Construct a frequency spec from an existing display range. */
export function parameterEntrySpecForFrequency({
    minHz,
    maxHz,
    stepHz,
    allowLogPercent,
}: FrequencyParameterEntrySpecInput): ParameterEntrySpec {
    return frequencySpec(minHz, maxHz, stepHz, allowLogPercent ? "log" : null);
}

/** Construct a scalar spec from an existing display range and unit. */
export function parameterEntrySpecForScalar(input: ScalarParameterEntrySpecInput): ParameterEntrySpec {
    return scalarSpec(input);
}

/** Derive exact-entry behavior from the authoritative mobile Voice display contract. */
export function parameterEntrySpecForMobileVoiceControl(
    controlID: MobileVoiceBindableControlID,
): ParameterEntrySpec {
    const display = MOBILE_VOICE_DISPLAY_DESCRIPTORS[controlID];
    const control = getMobileVoiceControlSpec(controlID);
    if (control.format === "pan") {
        return { _tag: "pan", min: display.min, max: display.max, step: display.step, defaultUnit: "%" };
    }
    if (control.format === "voices") {
        return scalarSpec({ ...display, unit: "x", digits: 0 });
    }
    if (control.format === "detuneCents") {
        return scalarSpec({ ...display, unit: "ct", canonicalPerDisplayedUnit: 0.02, digits: 2 });
    }
    if (control.format === "percent") {
        return scalarSpec({ ...display, unit: "%", canonicalPerDisplayedUnit: 0.01, digits: 3 });
    }
    if (control.format === "octave") {
        return scalarSpec({ ...display, unit: "oct", digits: 0 });
    }
    if (control.format === "semitone") {
        return scalarSpec({ ...display, unit: "st", digits: 0 });
    }
    if (control.format === "cents") {
        return scalarSpec({ ...display, unit: "ct", digits: 0 });
    }
    if (control.format === "decibels") {
        return scalarSpec({ ...display, unit: "dB", digits: 1 });
    }
    if (display.choices !== undefined) {
        return {
            _tag: "choice",
            min: display.min,
            max: display.max,
            step: display.step,
            defaultUnit: "choice",
            choices: display.choices.map((label, value) => ({ label, value })),
        };
    }
    throw new Error(`Mobile Voice control "${controlID}" has no exact-entry format.`);
}

function scalarDisplay(spec: ScalarParameterEntrySpec, canonicalValue: number): FormattedParameterEntry {
    const displayedValue = canonicalValue / spec.canonicalPerDisplayedUnit;
    const draft = formatTrimmed(displayedValue, spec.digits);
    if (spec.defaultUnit === "%" || spec.defaultUnit === "°" || spec.defaultUnit === "x") {
        return { display: `${draft}${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
    }
    return { display: `${draft} ${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
}

function amountDisplay(spec: AmountParameterEntrySpec, canonicalValue: number): FormattedParameterEntry {
    const displayedValue = canonicalValue / spec.canonicalPerDisplayedUnit;
    const draft = formatTrimmed(displayedValue, spec.digits);
    if (spec.defaultUnit === "%" || spec.defaultUnit === "°") {
        return { display: `${draft}${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
    }
    return { display: `${draft} ${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
}

/** Format a canonical value for idle display and a unitless editing draft. */
export function formatParameterEntry(spec: ParameterEntrySpec, value: number): FormattedParameterEntry {
    if (spec._tag === "tempoSync") {
        return formatParameterEntry(spec.freeSpec, value);
    }
    const canonicalValue = quantize(value, spec);
    if (spec._tag === "frequency") {
        return { display: formatFrequencyDisplay(canonicalValue), draft: String(canonicalValue), unit: spec.defaultUnit };
    }
    if (spec._tag === "scalar") {
        return scalarDisplay(spec, canonicalValue);
    }
    if (spec._tag === "seconds") {
        const editingValue = spec.defaultUnit === "ms" ? canonicalValue * 1_000 : canonicalValue;
        const draft = formatTrimmed(editingValue, 3);
        return { display: `${draft} ${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
    }
    if (spec._tag === "milliseconds") {
        const editingValue = spec.defaultUnit === "s" ? canonicalValue / 1_000 : canonicalValue;
        const draft = formatTrimmed(editingValue, 3);
        return { display: `${draft} ${spec.defaultUnit}`, draft, unit: spec.defaultUnit };
    }
    if (spec._tag === "pan") {
        const percent = Math.round(canonicalValue * 100);
        const draft = String(percent);
        const display = percent === 0 ? "C" : percent < 0 ? `${-percent} L` : `${percent} R`;
        return { display, draft, unit: spec.defaultUnit };
    }
    if (spec._tag === "choice") {
        const choice = spec.choices.find((candidate) => candidate.value === Math.round(canonicalValue));
        if (choice === undefined) {
            throw new RangeError(`Choice value ${canonicalValue} is absent from its parameter entry spec.`);
        }
        return { display: choice.label, draft: choice.label, unit: spec.defaultUnit };
    }
    return amountDisplay(spec, canonicalValue);
}

function parseNumericAndUnit(text: string): { readonly numericText: string; readonly unit: string | undefined } | null {
    const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z%°]+)?$/);
    const numericText = match?.[1];
    if (numericText === undefined) {
        return null;
    }
    return { numericText, unit: match?.[2] };
}

function unitIs(unit: string | undefined, ...aliases: ReadonlyArray<string>): boolean {
    return unit !== undefined && aliases.includes(unit);
}

function parseFrequency(spec: FrequencyParameterEntrySpec, text: string): ParameterEntryResult {
    const parsed = parseNumericAndUnit(text);
    if (parsed === null) {
        return { _tag: "rejected", message: "Enter a number in Hz or kHz." };
    }
    const numericValue = Number(parsed.numericText);
    if (!Number.isFinite(numericValue)) {
        return { _tag: "rejected", message: "Enter a finite number in Hz or kHz." };
    }
    if (parsed.unit === "%" && spec.percentScale === null) {
        return rejectForUnit("%", spec.defaultUnit);
    }
    if (
        parsed.unit !== undefined
        && parsed.unit !== "%"
        && !unitIs(parsed.unit, "hz", "khz", "k")
    ) {
        return rejectForUnit(parsed.unit, spec.defaultUnit);
    }
    const value = unitIs(parsed.unit, "khz", "k")
        ? numericValue * 1_000
        : parsed.unit === "%"
            ? spec.min * (spec.max / spec.min) ** (numericValue / 100)
            : numericValue;
    return valueCommit(value, spec);
}

function parseScalar(spec: ScalarParameterEntrySpec, text: string): ParameterEntryResult {
    const parsed = parseNumericAndUnit(text);
    if (parsed === null) {
        return {
            _tag: "rejected",
            message: spec.defaultUnit === "x"
                ? "Enter a finite number of voices."
                : `Enter a number in ${spec.defaultUnit}.`,
        };
    }
    const compatible = parsed.unit === undefined
        || (spec.defaultUnit === "%" && parsed.unit === "%")
        || (spec.defaultUnit === "Q" && unitIs(parsed.unit, "q"))
        || (spec.defaultUnit === "dB" && unitIs(parsed.unit, "db"))
        || (spec.defaultUnit === "°" && unitIs(parsed.unit, "°", "deg", "degree", "degrees"))
        || (spec.defaultUnit === "st" && unitIs(parsed.unit, "st", "semitone", "semitones"))
        || (spec.defaultUnit === "oct" && unitIs(parsed.unit, "oct", "octave", "octaves"))
        || (spec.defaultUnit === "ct" && unitIs(parsed.unit, "ct", "cent", "cents"))
        || (spec.defaultUnit === "x" && unitIs(parsed.unit, "x", "voice", "voices"));
    if (!compatible && parsed.unit !== undefined) {
        return rejectForUnit(parsed.unit, spec.defaultUnit);
    }
    const numericValue = Number(parsed.numericText);
    if (!Number.isFinite(numericValue)) {
        return {
            _tag: "rejected",
            message: spec.defaultUnit === "x"
                ? "Enter a finite number of voices."
                : `Enter a finite number in ${spec.defaultUnit}.`,
        };
    }
    return valueCommit(numericValue * spec.canonicalPerDisplayedUnit, spec);
}

function timeUnitKind(unit: string | undefined): "milliseconds" | "seconds" | "unknown" | "bare" {
    if (unit === undefined) return "bare";
    if (unitIs(unit, "ms", "msec", "msecs", "millisecond", "milliseconds")) return "milliseconds";
    if (unitIs(unit, "s", "sec", "secs", "second", "seconds")) return "seconds";
    return "unknown";
}

function parseTime(
    spec: SecondsParameterEntrySpec | MillisecondsParameterEntrySpec,
    text: string,
): ParameterEntryResult {
    const parsed = parseNumericAndUnit(text);
    if (parsed === null) {
        return { _tag: "rejected", message: "Enter a time in ms or s." };
    }
    const unitKind = timeUnitKind(parsed.unit);
    if (unitKind === "unknown" && parsed.unit !== undefined) {
        return rejectForUnit(parsed.unit, spec.defaultUnit);
    }
    const numericValue = Number(parsed.numericText);
    if (!Number.isFinite(numericValue)) {
        return { _tag: "rejected", message: "Enter a finite time in ms or s." };
    }
    if (spec._tag === "seconds") {
        const value = unitKind === "milliseconds" || (unitKind === "bare" && spec.defaultUnit === "ms")
            ? numericValue / 1_000
            : numericValue;
        return valueCommit(value, spec);
    }
    const value = unitKind === "seconds" || (unitKind === "bare" && spec.defaultUnit === "s")
        ? numericValue * 1_000
        : numericValue;
    return valueCommit(value, spec);
}

function parsePan(spec: PanParameterEntrySpec, text: string): ParameterEntryResult {
    if (text === "c" || text === "center" || text === "centre") {
        return valueCommit(0, spec);
    }
    const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*%?\s*([lr])?$/);
    const numericText = match?.[1];
    if (numericText === undefined) {
        return { _tag: "rejected", message: "Enter Pan as a percentage, optionally followed by L or R." };
    }
    const numericValue = Number(numericText);
    if (!Number.isFinite(numericValue)) {
        return { _tag: "rejected", message: "Enter a finite Pan percentage." };
    }
    const direction = match?.[2];
    const signedPercent = direction === "l"
        ? -Math.abs(numericValue)
        : direction === "r"
            ? Math.abs(numericValue)
            : numericValue;
    return valueCommit(signedPercent / 100, spec);
}

function parseChoice(spec: ChoiceParameterEntrySpec, text: string): ParameterEntryResult {
    const choice = spec.choices.find((candidate) => candidate.label.toLowerCase() === text);
    if (choice !== undefined) {
        return valueCommit(choice.value, spec);
    }
    const parsed = parseNumericAndUnit(text);
    if (parsed === null || parsed.unit !== undefined) {
        return { _tag: "rejected", message: "Enter one of the shown choices." };
    }
    const numericValue = Number(parsed.numericText);
    if (!Number.isFinite(numericValue)) {
        return { _tag: "rejected", message: "Enter one of the shown choices." };
    }
    return valueCommit(numericValue, spec);
}

function depthPercentValue(spec: AmountParameterEntrySpec, numericValue: number): number {
    const sideLimit = numericValue < 0 ? Math.abs(spec.min) : Math.abs(spec.max);
    return sideLimit * (numericValue / 100);
}

function parseOctavePhysicalInterval(
    spec: AmountParameterEntrySpec,
    numericText: string,
    numericValue: number,
    unit: string,
): ParameterEntryResult | null {
    if (spec.baseValue === null || spec.physicalIntervalUnit === null) {
        return null;
    }
    const isCompatiblePhysicalUnit = spec.physicalIntervalUnit === "frequency"
        ? unitIs(unit, "hz", "khz", "k")
        : timeUnitKind(unit) !== "unknown";
    if (!isCompatiblePhysicalUnit) {
        return null;
    }
    if (!/^[+-]/.test(numericText)) {
        return {
            _tag: "rejected",
            message: `Enter a signed ${spec.physicalIntervalUnit === "frequency" ? "Hz/kHz" : "ms/s"} movement.`,
        };
    }
    let movement: number;
    if (spec.physicalIntervalUnit === "frequency") {
        movement = unitIs(unit, "khz", "k") ? numericValue * 1_000 : numericValue;
    } else {
        movement = timeUnitKind(unit) === "seconds" ? numericValue * 1_000 : numericValue;
    }
    const endpoint = spec.baseValue + movement;
    if (!(endpoint > 0)) {
        return { _tag: "rejected", message: "The resulting value must be above zero." };
    }
    return valueCommit(Math.log2(endpoint / spec.baseValue), spec);
}

function amountUnitCompatible(spec: AmountParameterEntrySpec, unit: string): boolean {
    return (spec.defaultUnit === "oct" && unitIs(unit, "oct", "octave", "octaves"))
        || (spec.defaultUnit === "st" && unitIs(unit, "st", "semitone", "semitones"))
        || (spec.defaultUnit === "dB" && unitIs(unit, "db"))
        || (spec.defaultUnit === "Q" && unitIs(unit, "q"))
        || (spec.defaultUnit === "s" && timeUnitKind(unit) !== "unknown")
        || (spec.defaultUnit === "ms" && timeUnitKind(unit) !== "unknown")
        || (spec.defaultUnit === "Hz" && unitIs(unit, "hz", "khz", "k"))
        || (spec.defaultUnit === "°" && unitIs(unit, "°", "deg", "degree", "degrees"))
        || (spec.defaultUnit === "%" && unit === "%");
}

function parseAmount(spec: AmountParameterEntrySpec, text: string): ParameterEntryResult {
    const parsed = parseNumericAndUnit(text);
    if (parsed === null) {
        return { _tag: "rejected", message: `Enter an amount in ${spec.defaultUnit} or %.` };
    }
    const numericValue = Number(parsed.numericText);
    if (!Number.isFinite(numericValue)) {
        return { _tag: "rejected", message: `Enter a finite amount in ${spec.defaultUnit} or %.` };
    }
    if (parsed.unit === "%") {
        const value = spec.percentMeaning === "native"
            ? numericValue * spec.canonicalPerDisplayedUnit
            : depthPercentValue(spec, numericValue);
        return valueCommit(value, spec);
    }
    if (spec.defaultUnit === "oct" && parsed.unit !== undefined) {
        const interval = parseOctavePhysicalInterval(spec, parsed.numericText, numericValue, parsed.unit);
        if (interval !== null) {
            return interval;
        }
    }
    if (parsed.unit !== undefined && !amountUnitCompatible(spec, parsed.unit)) {
        return rejectForUnit(parsed.unit, spec.defaultUnit);
    }

    let value = numericValue * spec.canonicalPerDisplayedUnit;
    if (spec.defaultUnit === "s" && timeUnitKind(parsed.unit) === "milliseconds") {
        value = numericValue / 1_000;
    } else if (spec.defaultUnit === "ms" && timeUnitKind(parsed.unit) === "seconds") {
        value = numericValue * 1_000;
    } else if (spec.defaultUnit === "Hz" && unitIs(parsed.unit, "khz", "k")) {
        value = numericValue * 1_000;
    }
    return valueCommit(value, spec);
}

function parseTempoSync(spec: TempoSyncParameterEntrySpec, text: string): ParameterEntryResult {
    const division = spec.divisions.find((candidate) => candidate.label.toLowerCase() === text);
    if (division !== undefined) {
        return {
            _tag: "accepted",
            commit: {
                _tag: "tempoDivision",
                mode: "sync",
                divisionValue: division.value,
                divisionLabel: division.label,
            },
            echo: { display: `${division.label} Sync`, draft: division.label, unit: "Sync" },
        };
    }
    if (/^\d+\/\d+(?:\.|t)?$/i.test(text)) {
        return { _tag: "rejected", message: "That tempo division is not supported for this parameter." };
    }
    const result = spec.freeSpec._tag === "frequency"
        ? parseFrequency(spec.freeSpec, text)
        : parseTime(spec.freeSpec, text);
    if (result._tag === "rejected") {
        return result;
    }
    if (result.commit._tag !== "value") {
        throw new Error("A Free-value parser returned a tempo division.");
    }
    return {
        ...result,
        commit: { ...result.commit, mode: "free" },
    };
}

/** Parse user-entered exact-value text into a typed commit or explicit rejection. */
export function parseParameterEntry(spec: ParameterEntrySpec, text: string): ParameterEntryResult {
    const normalizedText = normalizeEntryText(text);
    if (spec._tag === "tempoSync") return parseTempoSync(spec, normalizedText);
    if (spec._tag === "frequency") return parseFrequency(spec, normalizedText);
    if (spec._tag === "scalar") return parseScalar(spec, normalizedText);
    if (spec._tag === "seconds" || spec._tag === "milliseconds") return parseTime(spec, normalizedText);
    if (spec._tag === "pan") return parsePan(spec, normalizedText);
    if (spec._tag === "choice") return parseChoice(spec, normalizedText);
    return parseAmount(spec, normalizedText);
}
