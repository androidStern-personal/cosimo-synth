import type { ModulationSourceKind } from "./modulation";

/** The compact rack intentionally exposes only sources that exist in the synth engine. */
export type RackModulationSourceKind = Extract<ModulationSourceKind, "mseg" | "env" | "macro">;

export type RackModulationSource = {
    readonly sourceKind: RackModulationSourceKind;
    readonly sourceSlot: 1 | 2 | 3;
    readonly label: string;
    readonly shortLabel: string;
    readonly iconUrl: string;
    readonly identityIconUrl: string;
    readonly accent: string;
};

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

    if (source === undefined) {
        throw new Error(`Unknown rack modulation source: ${sourceKind} ${sourceSlot}`);
    }

    return source;
}
