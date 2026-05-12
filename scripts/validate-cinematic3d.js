const WORLD_SCALE = 1 / 100;
const COSIMO_PANEL_IDS = [
    "wavetable",
    "filter",
    "distortion",
    "effect",
    "envelope",
    "mod",
];

function worldYFromPanel(panel, rootWidthPx, rootHeightPx) {
    return (panel.x + panel.width / 2 - rootWidthPx / 2) * WORLD_SCALE;
}

function panelRectToWorld(panel, rootWidthPx, rootHeightPx, worldScale) {
    const worldRadius = Math.min(
        Math.max(0, clampPositiveRadius(panel.width, panel.height, panel.borderRadiusPx)),
        Math.min(panel.width, panel.height) / 2,
    ) * worldScale;
    return {
        id: panel.id,
        x: (panel.x + panel.width / 2 - rootWidthPx / 2) * worldScale,
        y: -(panel.y + panel.height / 2 - rootHeightPx / 2) * worldScale,
        width: panel.width * worldScale,
        height: panel.height * worldScale,
        radius: worldRadius,
    };
}

function getPanelDepth(frame, panelIndex, maxDepth) {
    const startFrame = 20 + panelIndex * 4;
    const endFrame = startFrame + 35;

    if (frame <= startFrame) {
        return 0;
    }

    if (frame >= endFrame) {
        return maxDepth;
    }

    return maxDepth * ((frame - startFrame) / 35);
}

function clampPositiveRadius(width, height, radius) {
    const maxRadius = Math.min(width, height) / 2;
    if (!Number.isFinite(radius) || radius <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(radius, maxRadius));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function main() {
    const samplePanel = {
        id: COSIMO_PANEL_IDS[0],
        x: 100,
        y: 420,
        width: 300,
        height: 120,
        borderRadiusPx: 20,
    };
    const rootWidth = 800;
    const rootHeight = 600;
    const worldPanel = panelRectToWorld(samplePanel, rootWidth, rootHeight, WORLD_SCALE);
        const worldXFromPanel = (panel, rootW, rootH, scale) => (panel.x + panel.width / 2 - rootW / 2) * scale;
        const worldYBelowCenter = (panel, rootW, rootH, scale) => -(panel.y + panel.height / 2 - rootH / 2) * scale;

    assert(worldPanel.id === COSIMO_PANEL_IDS[0], "Panel ID should survive conversion");
    assert(worldPanel.width === 3, "Panel width should scale by WORLD_SCALE");
    assert(Math.abs(worldPanel.x - worldXFromPanel(samplePanel, rootWidth, rootHeight, WORLD_SCALE)) < 1e-9, "world X formula should match");
    assert(worldPanel.y === worldYBelowCenter(samplePanel, rootWidth, rootHeight, WORLD_SCALE), "world Y formula should match");
    assert(worldPanel.y < 0, "Panel below center should map to negative world Y");
    assert(worldPanel.radius === clampPositiveRadius(samplePanel.width, samplePanel.height, samplePanel.borderRadiusPx) * WORLD_SCALE, "Radius should be unclipped when valid");
    assert(COSIMO_PANEL_IDS.length === 6, "All expected panel IDs are present");
    assert(getPanelDepth(20, 0, 0.35) === 0, "Depth should start at 0");
    assert(getPanelDepth(21, 0, 0.35) > 0, "Depth should rise before frame 55 for panel 0");
    assert(getPanelDepth(100, 0, 0.35) === 0.35, "Depth should max out after panel end frame");

    console.log("Cosimo cinematic3d validation: OK");
}

try {
    main();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
