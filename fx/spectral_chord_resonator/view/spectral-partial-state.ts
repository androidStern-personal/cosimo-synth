export const SPECTRAL_PARTIAL_STATE_KEY = "spectral.partialShape.v1";
export const SPECTRAL_PARTIAL_SCHEMA_VERSION = 1;
export const SPECTRAL_PARTIAL_COUNT = 64;
export const SPECTRAL_DEFAULT_ACTIVE_PARTIALS = 32;

export const SPECTRAL_PARTIAL_PRESETS = [
    "flat",
    "saw",
    "square",
    "triangle",
    "organ",
    "nasal",
    "air",
    "pluck",
    "custom",
] as const;

export type SpectralPartialPreset = typeof SPECTRAL_PARTIAL_PRESETS[number];

export type SpectralPartialShapeState = {
    version: 1;
    count: number;
    values: number[];
    preset: SpectralPartialPreset;
};

export type PartialShapeUpload = {
    count: number;
    strengths: number[];
};

const presetSet = new Set<string>(SPECTRAL_PARTIAL_PRESETS);

function clampNumber(value: unknown, minValue: number, maxValue: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return minValue;
    }

    return Math.min(maxValue, Math.max(minValue, numeric));
}

function clamp01(value: unknown) {
    return clampNumber(value, 0, 1);
}

function normalizeCount(value: unknown) {
    return Math.round(clampNumber(value, 1, SPECTRAL_PARTIAL_COUNT));
}

function normalizePreset(value: unknown): SpectralPartialPreset {
    return typeof value === "string" && presetSet.has(value)
        ? value as SpectralPartialPreset
        : "custom";
}

function presetRawValue(preset: Exclude<SpectralPartialPreset, "custom">, index: number) {
    const harmonic = index + 1;

    if (preset === "flat") {
        return 1;
    }

    if (preset === "saw") {
        return 1 / harmonic;
    }

    if (preset === "square") {
        return harmonic % 2 === 1 ? 1 / harmonic : 0;
    }

    if (preset === "triangle") {
        return harmonic % 2 === 1 ? 1 / (harmonic * harmonic) : 0;
    }

    if (preset === "organ") {
        const drawbars = [1, 0.25, 0.75, 0.5, 0.18, 0.34, 0.08, 0.2, 0.12, 0.05, 0.03, 0.04, 0.02, 0.015, 0.012, 0.01];
        return drawbars[index] ?? 0;
    }

    if (preset === "nasal") {
        const peak = Math.exp(-0.5 * ((harmonic - 5) / 1.6) ** 2) * 0.95;
        return clamp01(peak + (harmonic % 2 === 1 ? 0.11 / harmonic : 0.03 / harmonic));
    }

    if (preset === "air") {
        const low = Math.exp(-0.5 * ((harmonic - 2) / 1.4) ** 2) * 0.12;
        const high = Math.exp(-0.5 * ((harmonic - 18) / 7) ** 2) * 0.74;
        return clamp01(low + high);
    }

    return clamp01(Math.exp(-harmonic / 8) * (0.8 + 0.2 * Math.cos(harmonic * 1.7)));
}

function normalizePresetValues(values: number[]) {
    const maxValue = Math.max(0.000001, ...values);
    return values.map((value) => clamp01(value / maxValue));
}

export function buildSpectralPartialPresetValues(preset: Exclude<SpectralPartialPreset, "custom">) {
    return normalizePresetValues(
        Array.from({ length: SPECTRAL_PARTIAL_COUNT }, (_unused, index) => presetRawValue(preset, index)),
    );
}

export function createDefaultSpectralPartialState(): SpectralPartialShapeState {
    return {
        version: SPECTRAL_PARTIAL_SCHEMA_VERSION,
        count: SPECTRAL_DEFAULT_ACTIVE_PARTIALS,
        values: buildSpectralPartialPresetValues("saw"),
        preset: "saw",
    };
}

export function normalizeSpectralPartialState(rawState: unknown): SpectralPartialShapeState {
    const fallback = createDefaultSpectralPartialState();
    const raw = rawState && typeof rawState === "object"
        ? rawState as Partial<SpectralPartialShapeState>
        : {};
    const rawValues = Array.isArray(raw.values) ? raw.values : fallback.values;
    const values = Array.from({ length: SPECTRAL_PARTIAL_COUNT }, (_unused, index) => clamp01(rawValues[index] ?? fallback.values[index]));

    return {
        version: SPECTRAL_PARTIAL_SCHEMA_VERSION,
        count: normalizeCount(raw.count ?? fallback.count),
        values,
        preset: normalizePreset(raw.preset ?? fallback.preset),
    };
}

export function parseStrictSpectralPartialStateV1(value: unknown): SpectralPartialShapeState {
    const raw = typeof value === "string" ? JSON.parse(value) : value;

    if (!raw || typeof raw !== "object") {
        throw new Error("Spectral partial state must be an object.");
    }

    const state = raw as Partial<SpectralPartialShapeState>;
    if (state.version !== SPECTRAL_PARTIAL_SCHEMA_VERSION) {
        throw new Error(`Spectral partial state version must be ${SPECTRAL_PARTIAL_SCHEMA_VERSION}.`);
    }

    if (!Array.isArray(state.values) || state.values.length !== SPECTRAL_PARTIAL_COUNT) {
        throw new Error(`Spectral partial state must contain ${SPECTRAL_PARTIAL_COUNT} values.`);
    }

    return normalizeSpectralPartialState(state);
}

export function serializeSpectralPartialState(state: SpectralPartialShapeState) {
    return JSON.stringify(normalizeSpectralPartialState(state));
}

export function applySpectralPartialPreset(state: SpectralPartialShapeState, preset: Exclude<SpectralPartialPreset, "custom">): SpectralPartialShapeState {
    return normalizeSpectralPartialState({
        ...state,
        values: buildSpectralPartialPresetValues(preset),
        preset,
    });
}

export function setSpectralPartialValue(state: SpectralPartialShapeState, index: number, value: number): SpectralPartialShapeState {
    const next = normalizeSpectralPartialState(state);
    const resolvedIndex = Math.round(clampNumber(index, 0, SPECTRAL_PARTIAL_COUNT - 1));
    next.values[resolvedIndex] = clamp01(value);
    next.preset = "custom";
    return next;
}

export function setSpectralPartialCount(state: SpectralPartialShapeState, count: number): SpectralPartialShapeState {
    return normalizeSpectralPartialState({
        ...state,
        count,
        preset: "custom",
    });
}

export function smoothSpectralPartialState(state: SpectralPartialShapeState): SpectralPartialShapeState {
    const source = normalizeSpectralPartialState(state);
    const values = [...source.values];

    for (let index = 0; index < source.count; index += 1) {
        const left = source.values[Math.max(0, index - 1)];
        const mid = source.values[index];
        const right = source.values[Math.min(source.count - 1, index + 1)];
        values[index] = clamp01((left + (mid * 2) + right) / 4);
    }

    return normalizeSpectralPartialState({
        ...source,
        values,
        preset: "custom",
    });
}

export function normalizeSpectralPartialMagnitudes(state: SpectralPartialShapeState): SpectralPartialShapeState {
    const source = normalizeSpectralPartialState(state);
    const activeValues = source.values.slice(0, source.count);
    const maxValue = Math.max(0.000001, ...activeValues);
    const values = source.values.map((value, index) => index < source.count ? clamp01(value / maxValue) : value);

    return normalizeSpectralPartialState({
        ...source,
        values,
        preset: "custom",
    });
}

export function invertSpectralPartialState(state: SpectralPartialShapeState): SpectralPartialShapeState {
    const source = normalizeSpectralPartialState(state);
    const values = source.values.map((value, index) => index < source.count ? 1 - value : value);

    return normalizeSpectralPartialState({
        ...source,
        values,
        preset: "custom",
    });
}

export function clearSpectralPartialState(state: SpectralPartialShapeState): SpectralPartialShapeState {
    const source = normalizeSpectralPartialState(state);
    const values = source.values.map((value, index) => index < source.count ? 0 : value);

    return normalizeSpectralPartialState({
        ...source,
        values,
        preset: "custom",
    });
}

export function buildPartialShapeUpload(state: SpectralPartialShapeState): PartialShapeUpload {
    const normalized = normalizeSpectralPartialState(state);
    return {
        count: normalized.count,
        strengths: [...normalized.values],
    };
}
