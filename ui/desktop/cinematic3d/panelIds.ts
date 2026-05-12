export const COSIMO_PANEL_IDS = [
    "wavetable",
    "filter",
    "distortion",
    "effect",
    "envelope",
    "mod",
] as const;

export type CosimoPanelId = (typeof COSIMO_PANEL_IDS)[number];

export const COSIMO_PANEL_ID_SET = new Set<string>(COSIMO_PANEL_IDS);
