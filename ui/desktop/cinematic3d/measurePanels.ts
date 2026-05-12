import { COSIMO_PANEL_IDS, COSIMO_PANEL_ID_SET, type CosimoPanelId } from "./panelIds";

export type PanelRectPx = {
    id: CosimoPanelId;
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadiusPx: number;
};

export type CaptureLayoutPx = {
    width: number;
    height: number;
    panels: PanelRectPx[];
};

function parsePixelRadius(radiusValue: string): number {
    if (!radiusValue || typeof radiusValue !== "string") {
        return 0;
    }

    if (!radiusValue.endsWith("px")) {
        return 0;
    }

    const parsed = Number.parseFloat(radiusValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }

    return parsed;
}

function parsePanelId(rawId: string | null): CosimoPanelId | null {
    if (!rawId) {
        return null;
    }

    const normalized = rawId.trim().toLowerCase();
    if (COSIMO_PANEL_ID_SET.has(normalized as CosimoPanelId)) {
        return normalized as CosimoPanelId;
    }

    return null;
}

function resolvePanelElements(root: Element): Map<CosimoPanelId, Element[]> {
    const map = new Map<CosimoPanelId, Element[]>();

    const candidates = root.querySelectorAll("[data-cosimo-panel], [data-id]");
    for (const candidate of candidates) {
        const candidateId = parsePanelId(
            candidate.getAttribute("data-cosimo-panel") ?? candidate.getAttribute("data-id"),
        );
        if (!candidateId) {
            continue;
        }

        const existing = map.get(candidateId) ?? [];
        existing.push(candidate);
        map.set(candidateId, existing);
    }

    return map;
}

function ensureUniquePanelElements(
    root: HTMLElement,
    panelElements: Map<CosimoPanelId, Element[]>,
): void {
    const duplicated = COSIMO_PANEL_IDS.filter((id) => (panelElements.get(id)?.length ?? 0) > 1);
    if (duplicated.length > 0) {
        throw new Error(`Duplicate panel IDs detected: ${duplicated.join(", ")}`);
    }

    const missing = COSIMO_PANEL_IDS.filter((id) => !panelElements.has(id));
    if (missing.length > 0) {
        throw new Error(`Missing panel IDs: ${missing.join(", ")}`);
    }
}

function clampPanelRadius(rawRadius: number, width: number, height: number): number {
    const maxRadius = Math.min(width, height) / 2;
    if (!Number.isFinite(rawRadius) || rawRadius <= 0) {
        return 0;
    }

    return Math.min(rawRadius, maxRadius);
}

export function measureCosimoPanels(root: HTMLElement): CaptureLayoutPx {
    const rootRect = root.getBoundingClientRect();
    const panelElements = resolvePanelElements(root);
    ensureUniquePanelElements(root, panelElements);

    const panels = COSIMO_PANEL_IDS.map((id) => {
        const panelElement = panelElements.get(id)![0];
        const rect = panelElement.getBoundingClientRect();
        const computedStyle = getComputedStyle(panelElement);
        const rawRadius = parsePixelRadius(computedStyle.borderTopLeftRadius);
        const width = Math.max(0, rect.width);
        const height = Math.max(0, rect.height);
        const radius = clampPanelRadius(rawRadius, width, height);
        const x = rect.left - rootRect.left;
        const y = rect.top - rootRect.top;

        return {
            id,
            x,
            y,
            width,
            height,
            borderRadiusPx: radius,
        };
    });

    for (const panel of panels) {
        if (panel.width <= 0 || panel.height <= 0) {
            throw new Error(`Invalid panel geometry for ${panel.id}: zero/negative area`);
        }

        if (
            panel.x < -0.5
            || panel.y < -0.5
            || panel.x + panel.width > rootRect.width + 0.5
            || panel.y + panel.height > rootRect.height + 0.5
        ) {
            throw new Error(`Panel ${panel.id} is outside the capture root`);
        }
    }

    return {
        width: rootRect.width,
        height: rootRect.height,
        panels,
    };
}
