function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function computeResponsivePatchLayout({
    width = 1120,
    height = 680,
    platform = "desktop",
} = {}) {
    const safeWidth = Math.max(Number(width) || 0, 0);
    const safeHeight = Math.max(Number(height) || 0, 0);

    if (platform !== "ios") {
        return {
            isCompact: safeWidth < 760,
            headerStacks: safeWidth < 520,
            gridTemplateColumns: safeWidth < 760 ? "minmax(0, 1fr)" : "minmax(0, 1fr) 208px",
            noteCount: safeWidth < 760 ? 17 : 25,
            knobSize: safeWidth < 760 ? 126 : 150,
            stageMinHeight: safeWidth < 760 ? 220 : 280,
            keyboardHeight: safeWidth < 760 ? 110 : 122,
            controlColumnWidth: safeWidth < 760 ? safeWidth : 208,
            panelPadding: safeWidth < 760 ? 14 : 18,
            cardPadding: safeWidth < 760 ? 14 : 18,
            sectionGap: safeWidth < 760 ? 12 : 16,
            titleFontSize: safeWidth < 760 ? 13 : 14,
            subtitleFontSize: safeWidth < 760 ? 18 : 22,
            keyboardNaturalNoteWidth: safeWidth < 760 ? 18 : 22,
            keyboardAccidentalWidth: safeWidth < 760 ? 10 : 13,
        };
    }

    const shortLandscape = safeHeight < 460;
    const compact = safeWidth < 760;
    const controlColumnWidth = shortLandscape ? 180 : 220;

    return {
        isCompact: compact,
        headerStacks: safeWidth < 420,
        gridTemplateColumns: compact ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${controlColumnWidth}px`,
        noteCount: compact ? 13 : (shortLandscape ? 17 : 25),
        knobSize: compact ? 112 : (shortLandscape ? 108 : 140),
        stageMinHeight: compact ? 210 : (shortLandscape ? 180 : 260),
        keyboardHeight: compact ? 98 : (shortLandscape ? 92 : 118),
        controlColumnWidth,
        panelPadding: compact ? 12 : 16,
        cardPadding: compact ? 12 : 16,
        sectionGap: compact ? 12 : 14,
        titleFontSize: compact ? 12 : 13,
        subtitleFontSize: compact ? 18 : 20,
        keyboardNaturalNoteWidth: compact ? 16 : (shortLandscape ? 17 : 20),
        keyboardAccidentalWidth: compact ? 9 : (shortLandscape ? 10 : 12),
    };
}

export function getLayoutCSSVariables(layout) {
    return {
        "--cosimo-panel-padding": `${clamp(layout.panelPadding, 10, 20)}px`,
        "--cosimo-card-padding": `${clamp(layout.cardPadding, 10, 20)}px`,
        "--cosimo-section-gap": `${clamp(layout.sectionGap, 10, 18)}px`,
        "--cosimo-main-grid-columns": layout.gridTemplateColumns,
        "--cosimo-control-column-width": `${clamp(layout.controlColumnWidth, 160, 220)}px`,
        "--cosimo-knob-size": `${clamp(layout.knobSize, 96, 150)}px`,
        "--cosimo-stage-min-height": `${clamp(layout.stageMinHeight, 180, 320)}px`,
        "--cosimo-keyboard-height": `${clamp(layout.keyboardHeight, 92, 122)}px`,
        "--cosimo-title-font-size": `${clamp(layout.titleFontSize, 12, 14)}px`,
        "--cosimo-subtitle-font-size": `${clamp(layout.subtitleFontSize, 18, 22)}px`,
    };
}
