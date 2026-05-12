import { Shape } from "three";

import type { PanelRectPx } from "./measurePanels";
import { type CosimoPanelId, COSIMO_PANEL_IDS } from "./panelIds";

export const WORLD_SCALE = 1 / 100;

export type WorldRect = {
    id: CosimoPanelId;
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
};

export function panelRectToWorld(
    panel: PanelRectPx,
    rootWidthPx: number,
    rootHeightPx: number,
    worldScale: number,
): WorldRect {
    const worldRadius = clampRadius(panel.width * worldScale, panel.height * worldScale, panel.borderRadiusPx * worldScale);
    const worldX = (panel.x + panel.width / 2 - rootWidthPx / 2) * worldScale;
    const worldY = -(panel.y + panel.height / 2 - rootHeightPx / 2) * worldScale;
    const worldWidth = panel.width * worldScale;
    const worldHeight = panel.height * worldScale;

    return {
        id: panel.id,
        x: worldX,
        y: worldY,
        width: worldWidth,
        height: worldHeight,
        radius: worldRadius,
    };
}

function clampRadius(width: number, height: number, radius: number): number {
    if (!Number.isFinite(radius) || radius <= 0) {
        return 0;
    }

    const maxRadius = Math.min(width, height) / 2;
    return Math.min(Math.max(0, radius), maxRadius);
}

export function makeRoundedRectShape(width: number, height: number, radius: number): Shape {
    const boundedWidth = Math.max(0, width);
    const boundedHeight = Math.max(0, height);
    const boundedRadius = clampRadius(boundedWidth, boundedHeight, radius);
    const halfWidth = boundedWidth / 2;
    const halfHeight = boundedHeight / 2;
    const shape = new Shape();

    if (boundedWidth === 0 || boundedHeight === 0) {
        return shape;
    }

    shape.moveTo(-halfWidth, -halfHeight + boundedRadius);
    shape.absarc(-halfWidth + boundedRadius, -halfHeight + boundedRadius, boundedRadius, Math.PI, Math.PI * 1.5, false);
    shape.lineTo(halfWidth - boundedRadius, -halfHeight);
    shape.absarc(halfWidth - boundedRadius, -halfHeight + boundedRadius, boundedRadius, Math.PI * 1.5, Math.PI * 2, false);
    shape.lineTo(halfWidth, halfHeight - boundedRadius);
    shape.absarc(halfWidth - boundedRadius, halfHeight - boundedRadius, boundedRadius, 0, Math.PI * 0.5, false);
    shape.lineTo(-halfWidth + boundedRadius, halfHeight);
    shape.absarc(-halfWidth + boundedRadius, halfHeight - boundedRadius, boundedRadius, Math.PI * 0.5, Math.PI, false);
    shape.lineTo(-halfWidth, -halfHeight + boundedRadius);

    return shape;
}

export function getPanelDepth(frame: number, panelIndex: number, maxDepth: number) {
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

export function orderedCosimoPanelIds(): readonly CosimoPanelId[] {
    return COSIMO_PANEL_IDS;
}
