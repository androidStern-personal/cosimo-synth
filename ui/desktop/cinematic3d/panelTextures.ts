import type { CaptureLayoutPx, PanelRectPx } from "./measurePanels";
import type { CosimoPanelId } from "./panelIds";

export type PanelTextureSet = {
    fullCanvas: HTMLCanvasElement | OffscreenCanvas;
    panelCanvases: Record<CosimoPanelId, HTMLCanvasElement>;
};

function roundCanvasSize(size: number): number {
    const rounded = Math.max(0, Math.round(size));
    return rounded > 0 ? rounded : 1;
}

function cropPanelCanvas(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    panel: PanelRectPx,
): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = roundCanvasSize(panel.width);
    canvas.height = roundCanvasSize(panel.height);

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error(`Could not create 2D context for panel ${panel.id} crop`);
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
        sourceCanvas,
        panel.x,
        panel.y,
        panel.width,
        panel.height,
        0,
        0,
        canvas.width,
        canvas.height,
    );

    return canvas;
}

export function cropPanelCanvases(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    layout: CaptureLayoutPx,
): Record<CosimoPanelId, HTMLCanvasElement> {
    const panelCanvases: Partial<Record<CosimoPanelId, HTMLCanvasElement>> = {};

    for (const panel of layout.panels) {
        panelCanvases[panel.id] = cropPanelCanvas(sourceCanvas, panel);
    }

    return panelCanvases as Record<CosimoPanelId, HTMLCanvasElement>;
}
