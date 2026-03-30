export const DEFAULT_PATCH_THEME = {
    backgroundTop: "#04070f",
    backgroundBottom: "#04070f",
    backgroundRGB: [4, 7, 15],
    panelStroke: "rgba(132, 149, 255, 0.0)",
    frameBlueRGB: [94, 118, 255],
    accentBlue: "#87d7f5",
    accentBlueRGB: [135, 215, 245],
    accentBlueDeep: "#5f7aff",
    accentBlueDeepRGB: [95, 122, 255],
    guideBlue: "rgba(129, 150, 255, 0.12)",
    warmText: "#ffd8a6",
    warmTextRGB: [255, 216, 166],
    highlightPink: "#f56cb6",
    highlightPinkRGB: [245, 108, 182],
    shadowColor: "rgba(7, 11, 28, 0.36)",
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
