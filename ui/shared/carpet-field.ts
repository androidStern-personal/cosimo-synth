/**
 * Pin-carpet lattice for the filter analyzer: the ELECTRIC++CARPET adaptation.
 * A dot lattice where columns are frequency (the SAME tuned 20–20k log axis as
 * the cutoff drag surface), rows are time-into-the-past, and dot displacement
 * is band magnitude. Tone is quantized into the video's three faithful states
 * (rest gray / mid white / crest acid yellow) — never continuous alpha.
 *
 * This module is pure geometry + painting. Audio analysis, filter response,
 * and history capture stay owned by their production modules.
 */

import { filterCutoffHzToNormalized } from "./filter-response";

/** One frequency column: FFT bin window plus its position on the tuned axis. */
export type CarpetColumn = {
    readonly centerHz: number;
    readonly binStart: number;
    readonly binEnd: number;
    readonly xNorm: number;
};

/** Per-row lattice geometry; index 0 is the front (live) row. */
export type CarpetRowGeometry = {
    readonly baseY: number;
    readonly xLeft: number;
    readonly xSpan: number;
    readonly dotRadius: number;
    readonly heightPx: number;
    readonly depthT: number;
};

export type CarpetLayoutParams = {
    readonly width: number;
    readonly height: number;
    readonly padPx: number;
    readonly rows: number;
    readonly depthSpanRatio: number;
    readonly depthInsetRatio: number;
    readonly frontBaseRatio: number;
    readonly heightRatio: number;
    readonly frontDotRadiusPx: number;
    readonly backScale: number;
};

export type CarpetToneState = "rest" | "mid" | "crest";

export type CarpetPalette = {
    readonly rest: readonly [number, number, number];
    readonly mid: readonly [number, number, number];
    readonly crest: readonly [number, number, number];
};

/** Faithful to the reference video: gray pins, white risers, acid-yellow crests. */
export const CARPET_PALETTE: CarpetPalette = {
    rest: [104, 108, 114],
    mid: [242, 243, 245],
    crest: [203, 255, 46],
};

export type CarpetPaintOptions = {
    readonly layout: ReadonlyArray<CarpetRowGeometry>;
    readonly columns: ReadonlyArray<CarpetColumn>;
    /** Index 0 is the live (front) row; older captures follow. */
    readonly rowMagnitudes: ReadonlyArray<ReadonlyArray<number>>;
    readonly toneT1: number;
    readonly toneT2: number;
    readonly palette?: CarpetPalette;
    /**
     * Called after each row's dots are painted, still inside the back-to-front
     * order, so callers can interleave per-plane overlays (e.g. the cube-chain
     * filter trail) with correct occlusion.
     */
    readonly onRowPainted?: (rowIndex: number, row: CarpetRowGeometry) => void;
};

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

/** Map an analyzer dB reading into 0..1 magnitude; non-finite input is silence. */
export function magnitudeFromDb(db: number, floorDb: number, ceilDb: number): number {
    if (!Number.isFinite(db)) {
        return 0;
    }
    const span = ceilDb - floorDb;
    if (span <= 0) {
        return db >= ceilDb ? 1 : 0;
    }
    return clamp((db - floorDb) / span, 0, 1);
}

/**
 * Log-spaced frequency columns over [minHz, maxHz], each owning a contiguous
 * FFT bin window. xNorm is the tuned cutoff axis so the lattice, the hero
 * response curve, and the drag surface agree about where a frequency lives.
 */
export function buildCarpetColumnMap({
    fftSize,
    sampleRate,
    columnCount,
    minHz,
    maxHz,
}: {
    readonly fftSize: number;
    readonly sampleRate: number;
    readonly columnCount: number;
    readonly minHz: number;
    readonly maxHz: number;
}): CarpetColumn[] {
    if (columnCount < 1 || fftSize < 2 || sampleRate <= 0 || minHz <= 0 || maxHz <= minHz) {
        throw new Error("buildCarpetColumnMap: invalid configuration");
    }

    const binCount = Math.floor(fftSize / 2);
    const binWidthHz = sampleRate / fftSize;
    const logMin = Math.log(minHz);
    const logSpan = Math.log(maxHz) - logMin;

    const columns: CarpetColumn[] = [];
    for (let index = 0; index < columnCount; index += 1) {
        const edgeLoHz = Math.exp(logMin + (logSpan * (index / columnCount)));
        const edgeHiHz = Math.exp(logMin + (logSpan * ((index + 1) / columnCount)));
        const binStart = clamp(Math.floor(edgeLoHz / binWidthHz), 0, binCount - 1);
        const binEnd = clamp(Math.floor(edgeHiHz / binWidthHz), binStart, binCount - 1);
        const centerHz = Math.sqrt(edgeLoHz * edgeHiHz);
        columns.push({
            centerHz,
            binStart,
            binEnd,
            xNorm: filterCutoffHzToNormalized(centerHz),
        });
    }
    return columns;
}

/**
 * Axonometric lattice layout, front row at the bottom. Fit is guaranteed by
 * construction: each row's excursion is clamped so a full-scale dot crest can
 * never leave the padded frame (the filter-table overflow lesson, made law).
 */
export function computeCarpetLayout({
    width,
    height,
    padPx,
    rows,
    depthSpanRatio,
    depthInsetRatio,
    frontBaseRatio,
    heightRatio,
    frontDotRadiusPx,
    backScale,
}: CarpetLayoutParams): CarpetRowGeometry[] {
    const rowCount = Math.max(1, Math.floor(rows));
    const plotW = Math.max(1, width - (padPx * 2));
    const plotH = Math.max(1, height - (padPx * 2));
    const frontBaseY = Math.min(
        padPx + (plotH * clamp(frontBaseRatio, 0, 1)),
        height - padPx - frontDotRadiusPx,
    );
    const depthSpanY = plotH * clamp(depthSpanRatio, 0, 1);

    const layout: CarpetRowGeometry[] = [];
    for (let index = 0; index < rowCount; index += 1) {
        const depthT = rowCount > 1 ? index / (rowCount - 1) : 0;
        const scale = 1 - ((1 - clamp(backScale, 0, 1)) * depthT);
        const baseY = frontBaseY - (depthSpanY * depthT);
        const dotRadius = frontDotRadiusPx * scale;
        const inset = plotW * clamp(depthInsetRatio, 0, 0.45) * depthT;
        const available = Math.max(0, baseY - padPx - dotRadius - 0.5);
        const desired = plotH * clamp(heightRatio, 0, 1) * scale;
        layout.push({
            baseY,
            xLeft: padPx + inset,
            xSpan: plotW - (inset * 2),
            dotRadius,
            heightPx: Math.min(desired, available),
            depthT,
        });
    }
    return layout;
}

/**
 * Spatial mesh smoothing: a [0.25, 0.5, 0.25] kernel run `passes` times with
 * clamped edges, so neighboring frequency columns move together the way a
 * physical surface does. Interior energy is conserved.
 */
export function smoothColumns(values: ReadonlyArray<number>, passes: number): number[] {
    let current = [...values];
    const passCount = Math.max(0, Math.floor(passes));
    for (let pass = 0; pass < passCount; pass += 1) {
        const next = new Array<number>(current.length);
        for (let index = 0; index < current.length; index += 1) {
            const left = current[Math.max(0, index - 1)];
            const right = current[Math.min(current.length - 1, index + 1)];
            next[index] = (0.25 * left) + (0.5 * current[index]) + (0.25 * right);
        }
        current = next;
    }
    return current;
}

/**
 * Temporal glide: per-column asymmetric smoothing toward the new frame — fast
 * on the rise so transients land, slow on the fall so the surface settles
 * instead of twitching. A column-count change adopts the new frame outright.
 */
export function glideColumns(
    previous: ReadonlyArray<number>,
    next: ReadonlyArray<number>,
    riseFraction: number,
    fallFraction: number,
): number[] {
    if (previous.length !== next.length) {
        return [...next];
    }
    const rise = clamp(riseFraction, 0, 1);
    const fall = clamp(fallFraction, 0, 1);
    return next.map((target, index) => {
        const from = previous[index];
        const fraction = target > from ? rise : fall;
        return from + ((target - from) * fraction);
    });
}

/** Three faithful states: rest below t1, crest at/above t2, mid between. */
export function quantizeCarpetTone(magnitude: number, t1: number, t2: number): CarpetToneState {
    if (magnitude >= t2) {
        return "crest";
    }
    if (magnitude < t1) {
        return "rest";
    }
    return "mid";
}

function fillColor(rgb: readonly [number, number, number], alpha: number): string {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha, 0, 1)})`;
}

/**
 * Paint the lattice back-to-front so near rows occlude far rows by paint
 * order. Depth reads as row recession + dot shrink + dimming; the signal only
 * ever moves dots — no fills, no accumulated alpha.
 */
export function paintCarpetField(
    context: CanvasRenderingContext2D,
    { layout, columns, rowMagnitudes, toneT1, toneT2, palette = CARPET_PALETTE, onRowPainted }: CarpetPaintOptions,
): void {
    context.save();
    for (let rowIndex = layout.length - 1; rowIndex >= 0; rowIndex -= 1) {
        const row = layout[rowIndex];
        if (row === undefined) {
            continue;
        }
        const magnitudes = rowMagnitudes[rowIndex];
        if (magnitudes === undefined) {
            onRowPainted?.(rowIndex, row);
            continue;
        }

        for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
            const column = columns[colIndex];
            const magnitude = clamp(magnitudes[colIndex] ?? 0, 0, 1);
            const x = row.xLeft + (column.xNorm * row.xSpan);
            const y = row.baseY - (magnitude * row.heightPx);
            const tone = quantizeCarpetTone(magnitude, toneT1, toneT2);

            let radius = row.dotRadius;
            let color: string;
            if (tone === "crest") {
                radius *= 1.05;
                color = fillColor(palette.crest, 1 - (0.22 * row.depthT));
            } else if (tone === "mid") {
                color = fillColor(palette.mid, 1 - (0.28 * row.depthT));
            } else {
                radius *= 0.82;
                color = fillColor(palette.rest, 0.85 * (1 - (0.68 * row.depthT)));
            }

            context.fillStyle = color;
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();
        }

        onRowPainted?.(rowIndex, row);
    }
    context.restore();
}
