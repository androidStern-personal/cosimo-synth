import type { ModulationSourceKind } from "./modulation";

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

/** Three animated pages: each page shows MSEG, Envelope, and Macro for one numbered slot. */
export const RACK_MODULATION_SOURCE_PAGES: ReadonlyArray<ReadonlyArray<RackModulationSource>> = [1, 2, 3].map(
    (sourceSlot) => SOURCE_FAMILIES.map((family) => ({
        sourceKind: family.sourceKind,
        sourceSlot: sourceSlot as 1 | 2 | 3,
        label: `${family.label} ${sourceSlot}`,
        shortLabel: family.shortLabel,
        iconUrl: family.iconUrl,
        identityIconUrl: family.identityIconUrl,
        accent: family.accent,
    })),
);

export function findRackModulationSource(
    sourceKind: RackModulationSourceKind,
    sourceSlot: number,
): RackModulationSource {
    const source = RACK_MODULATION_SOURCE_PAGES[sourceSlot - 1]?.find(
        (candidate) => candidate.sourceKind === sourceKind,
    );

    if (source !== undefined) {
        return source;
    }

    if (sourceSlot === 4 && sourceKind === "env") {
        const family = SOURCE_FAMILIES.find((candidate) => candidate.sourceKind === "env");
        if (family !== undefined) {
            return {
                sourceKind,
                sourceSlot,
                label: "Amp Envelope",
                shortLabel: "AMP",
                iconUrl: family.iconUrl,
                identityIconUrl: family.identityIconUrl,
                accent: family.accent,
            };
        }
    }

    throw new Error(`Unknown rack modulation source: ${sourceKind} ${sourceSlot}`);
}
