import type { ModulationSourceKind } from "./modulation";

/** The compact rack intentionally exposes only sources that exist in the synth engine. */
export type RackModulationSourceKind = Extract<ModulationSourceKind, "mseg" | "env" | "macro">;

export type RackModulationSource = {
    readonly sourceKind: RackModulationSourceKind;
    readonly sourceSlot: 1 | 2 | 3;
    readonly label: string;
    readonly shortLabel: string;
    readonly iconUrl: string;
    readonly accent: string;
};

type SourceFamily = {
    readonly sourceKind: RackModulationSourceKind;
    readonly label: string;
    readonly shortLabel: string;
    readonly accent: string;
    readonly icons: readonly [string, string, string];
};

const SOURCE_FAMILIES: ReadonlyArray<SourceFamily> = [
    {
        sourceKind: "mseg",
        label: "MSEG",
        shortLabel: "MSEG",
        accent: "#d978e5",
        icons: [
            new URL("../assets/modulation-sources/svg/fixed/mseg-1.svg", import.meta.url).href,
            new URL("../assets/modulation-sources/svg/fixed/mseg-2.svg", import.meta.url).href,
            new URL("../assets/modulation-sources/svg/fixed/mseg-3.svg", import.meta.url).href,
        ],
    },
    {
        sourceKind: "env",
        label: "Envelope",
        shortLabel: "ENV",
        accent: "#d978e5",
        icons: [
            new URL("../assets/modulation-sources/svg/fixed/envelope-1.svg", import.meta.url).href,
            new URL("../assets/modulation-sources/svg/fixed/envelope-2.svg", import.meta.url).href,
            new URL("../assets/modulation-sources/svg/fixed/envelope-3.svg", import.meta.url).href,
        ],
    },
    {
        sourceKind: "macro",
        label: "Macro",
        shortLabel: "MAC",
        accent: "#ff6b2c",
        icons: [
            new URL("../assets/modulation-sources/svg/fixed/macro-1.svg", import.meta.url).href,
            new URL("../assets/modulation-sources/svg/fixed/macro-2.svg", import.meta.url).href,
            new URL("../assets/modulation-sources/svg/fixed/macro-3.svg", import.meta.url).href,
        ],
    },
];

/** Three animated pages: each page shows MSEG, Envelope, and Macro for one numbered slot. */
export const RACK_MODULATION_SOURCE_PAGES: ReadonlyArray<ReadonlyArray<RackModulationSource>> = [1, 2, 3].map(
    (sourceSlot) => SOURCE_FAMILIES.map((family) => ({
        sourceKind: family.sourceKind,
        sourceSlot: sourceSlot as 1 | 2 | 3,
        label: `${family.label} ${sourceSlot}`,
        shortLabel: family.shortLabel,
        iconUrl: family.icons[sourceSlot - 1],
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
