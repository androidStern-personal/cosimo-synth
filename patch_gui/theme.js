export const DEFAULT_PATCH_THEME = {
    backgroundTop: "#161616",
    backgroundBottom: "#101010",
    backgroundRGB: [16, 16, 16],
    panelStroke: "rgba(125, 247, 255, 0.05)",
    frameBlueRGB: [125, 247, 255],
    accentBlue: "#7df7ff",
    accentBlueRGB: [125, 247, 255],
    accentBlueDeep: "#7df7ff",
    accentBlueDeepRGB: [125, 247, 255],
    guideBlue: "rgba(125, 247, 255, 0.12)",
    warmText: "#7df7ff",
    warmTextRGB: [125, 247, 255],
    highlightPink: "#7df7ff",
    highlightPinkRGB: [125, 247, 255],
    shadowColor: "rgba(125, 247, 255, 0.26)",
};

export function getPatchThemeCSSVariables(theme = DEFAULT_PATCH_THEME) {
    return {
        "--cosimo-background-top": theme.backgroundTop,
        "--cosimo-background-bottom": theme.backgroundBottom,
        "--cosimo-background-rgb": theme.backgroundRGB.join(", "),
        "--cosimo-panel-stroke": theme.panelStroke,
        "--cosimo-frame-blue-rgb": theme.frameBlueRGB.join(", "),
        "--cosimo-accent-blue": theme.accentBlue,
        "--cosimo-accent-blue-rgb": theme.accentBlueRGB.join(", "),
        "--cosimo-accent-blue-deep": theme.accentBlueDeep,
        "--cosimo-accent-blue-deep-rgb": theme.accentBlueDeepRGB.join(", "),
        "--cosimo-guide-blue": theme.guideBlue,
        "--cosimo-warm-text": theme.warmText,
        "--cosimo-warm-text-rgb": theme.warmTextRGB.join(", "),
        "--cosimo-highlight-pink": theme.highlightPink,
        "--cosimo-highlight-pink-rgb": theme.highlightPinkRGB.join(", "),
        "--cosimo-shadow-color": theme.shadowColor,
    };
}

export function createDefaultWavetableTheme(theme = DEFAULT_PATCH_THEME) {
    return {
        backgroundTop: theme.backgroundTop,
        backgroundBottom: theme.backgroundBottom,
        backgroundRGB: [...theme.backgroundRGB],
        panelStroke: theme.panelStroke,
        frameColor: [...theme.frameBlueRGB],
        meshColor: [...theme.accentBlueRGB],
        highlightColor: [...theme.highlightPinkRGB],
        guideColor: theme.guideBlue,
        textColor: `rgba(${theme.warmTextRGB.join(", ")}, 0.94)`,
        shadowColor: theme.shadowColor,
    };
}
