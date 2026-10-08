import {
    AMP_ENVELOPE_SOURCE_SLOT,
    MODULATION_ENV_SLOT_COUNT,
    MODULATION_MACRO_SLOT_COUNT,
    MODULATION_MSEG_SLOT_COUNT,
    type ModulationSourceKind,
} from "./modulation";

/** The compact rack intentionally exposes only sources that exist in the synth engine. */
export type RackModulationSourceKind = Extract<ModulationSourceKind, "mseg" | "env" | "macro">;

export type RackModulationSource = {
    readonly sourceKind: RackModulationSourceKind;
    readonly sourceSlot: 1 | 2 | 3 | 4;
    readonly label: string;
    readonly shortLabel: string;
    readonly iconUrl: string;
    readonly identityIconUrl: string;
    readonly accent: string;
};

type RackModulationSourceAddress = {
    readonly sourceKind: string;
    readonly sourceSlot: number | null;
};
type RackModulationSourceShortIdentity = RackModulationSourceAddress & { readonly shortLabel: string };

function isAmpEnvelopeRackModulationSource(source: RackModulationSourceAddress): boolean {
    return source.sourceKind === "env" && source.sourceSlot === 4;
}

/** The art badge is a slot number for numbered sources and AMP for the permanent envelope. */
export function rackModulationSourceBadgeLabel(source: RackModulationSourceAddress): string {
    return isAmpEnvelopeRackModulationSource(source) ? "AMP" : String(source.sourceSlot ?? "");
}

/** Compact HUD identity without inventing a numbered fourth envelope. */
export function rackModulationSourceShortIdentity(source: RackModulationSourceShortIdentity): string {
    if (isAmpEnvelopeRackModulationSource(source) || source.sourceSlot === null) {
        return source.shortLabel;
    }
    return `${source.shortLabel} ${source.sourceSlot}`;
}

type SourceFamily = {
    readonly sourceKind: RackModulationSourceKind;
    readonly label: string;
    readonly shortLabel: string;
    readonly accent: string;
    readonly iconUrl: string;
    readonly identityIconUrl: string;
};

const SOURCE_FAMILIES: ReadonlyArray<SourceFamily> = [
    {
        sourceKind: "mseg",
        label: "MSEG",
        shortLabel: "MSEG",
        accent: "#cc59d2",
        iconUrl: new URL("../assets/modulation-sources/approved-generated/mseg-face.png", import.meta.url).href,
        identityIconUrl: new URL("../assets/fontaudio/fad-automation-4p.svg", import.meta.url).href,
    },
    {
        sourceKind: "env",
        label: "Envelope",
        shortLabel: "ENV",
        accent: "#b8e236",
        iconUrl: new URL("../assets/modulation-sources/approved-generated/envelope-face.png", import.meta.url).href,
        identityIconUrl: new URL("../assets/fontaudio/fad-ADSR.svg", import.meta.url).href,
    },
    {
        sourceKind: "macro",
        label: "Macro",
        shortLabel: "MAC",
        accent: "#ff6428",
        iconUrl: new URL("../assets/modulation-sources/approved-generated/macro-face.png", import.meta.url).href,
        identityIconUrl: new URL("../assets/fontaudio/fad-slider-round-1.svg", import.meta.url).href,
    },
];

type RackModulationSourceSlot = RackModulationSource["sourceSlot"];

function describeSource(family: SourceFamily, sourceSlot: RackModulationSourceSlot): RackModulationSource {
    return {
        sourceKind: family.sourceKind,
        sourceSlot,
        label: `${family.label} ${sourceSlot}`,
        shortLabel: family.shortLabel,
        iconUrl: family.iconUrl,
        identityIconUrl: family.identityIconUrl,
        accent: family.accent,
    };
}

/** How many numbered slots each source family has in the synth engine. */
const NUMBERED_SLOT_COUNTS: Readonly<Record<RackModulationSourceKind, number>> = {
    mseg: MODULATION_MSEG_SLOT_COUNT,
    env: MODULATION_ENV_SLOT_COUNT,
    macro: MODULATION_MACRO_SLOT_COUNT,
};

function sourceKey(sourceKind: RackModulationSourceKind, sourceSlot: number): string {
    return `${sourceKind} ${sourceSlot}`;
}

/**
 * Every source slot the synth has, built once so callers get the same object for the same
 * source on every lookup. The Amp Envelope sits one past the numbered envelopes and keeps its
 * own name.
 */
const SOURCES_BY_KEY: ReadonlyMap<string, RackModulationSource> = new Map(
    SOURCE_FAMILIES.flatMap((family) => {
        const numbered = Array.from(
            { length: NUMBERED_SLOT_COUNTS[family.sourceKind] },
            (_, index) => describeSource(family, (index + 1) as RackModulationSourceSlot),
        );
        const ampEnvelope = family.sourceKind === "env"
            ? [{ ...describeSource(family, AMP_ENVELOPE_SOURCE_SLOT), label: "Amp Envelope", shortLabel: "AMP" }]
            : [];
        return [...numbered, ...ampEnvelope];
    }).map((source) => [sourceKey(source.sourceKind, source.sourceSlot), source]),
);

/** Describes any source slot the synth has; throws for a slot it does not have. */
export function findRackModulationSource(
    sourceKind: RackModulationSourceKind,
    sourceSlot: number,
): RackModulationSource {
    const source = SOURCES_BY_KEY.get(sourceKey(sourceKind, sourceSlot));
    if (source === undefined) {
        throw new Error(`Unknown rack modulation source: ${sourceKind} ${sourceSlot}`);
    }
    return source;
}

/**
 * Three animated pages: each page shows MSEG, Envelope, and Macro for one numbered slot.
 * Macro 4 and the Amp Envelope have no page; findRackModulationSource still describes them.
 */
export const RACK_MODULATION_SOURCE_PAGES: ReadonlyArray<ReadonlyArray<RackModulationSource>> = [1, 2, 3].map(
    (sourceSlot) => SOURCE_FAMILIES.map((family) => findRackModulationSource(family.sourceKind, sourceSlot)),
);
