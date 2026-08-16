/**
 * Cube-chain curve rendering: the filter response drawn as a chain of small
 * isometric cubes (the LINE++DROP++CUBIC reference), a second geometric
 * vocabulary in the carpet scene — dots are the signal, cubes are the machine.
 * Faithful to the reference: vibrant three-face voxel coloring.
 */

export type CubePoint = {
    readonly x: number;
    readonly y: number;
};

export type CubeCurvePalette = {
    readonly top: string;
    readonly left: string;
    readonly right: string;
    readonly edge: string;
};

/** Sampled from the reference posters: cyan tops, magenta lefts, green rights. */
export const CUBE_PALETTE: CubeCurvePalette = {
    top: "#5FD3F0",
    left: "#D24BE8",
    right: "#8BE84A",
    edge: "#0A0A0C",
};

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Resample a polyline at even arc-length spacing. The first point anchors the
 * chain; a cube is emitted at every `spacing` of travel along the line.
 */
export function buildCubeChain(points: ReadonlyArray<CubePoint>, spacing: number): CubePoint[] {
    if (points.length === 0) {
        return [];
    }
    const chain: CubePoint[] = [{ x: points[0].x, y: points[0].y }];
    if (points.length === 1 || spacing <= 0) {
        return chain;
    }

    let traveled = 0;
    let nextMark = spacing;
    for (let index = 1; index < points.length; index += 1) {
        const ax = points[index - 1].x;
        const ay = points[index - 1].y;
        const bx = points[index].x;
        const by = points[index].y;
        const segmentLength = Math.hypot(bx - ax, by - ay);
        if (segmentLength === 0) {
            continue;
        }
        while (nextMark <= traveled + segmentLength + 1e-9) {
            const t = clamp((nextMark - traveled) / segmentLength, 0, 1);
            chain.push({ x: ax + ((bx - ax) * t), y: ay + ((by - ay) * t) });
            nextMark += spacing;
        }
        traveled += segmentLength;
    }
    return chain;
}

/**
 * Paint a chain of isometric cubes centered on their curve points, back to
 * front left-to-right is irrelevant — cubes in a chain never overlap because
 * the chain spacing exceeds the cube width by construction.
 */
export function paintCubeChain(
    context: CanvasRenderingContext2D,
    centers: ReadonlyArray<CubePoint>,
    size: number,
    { palette = CUBE_PALETTE, alpha = 1 }: { palette?: CubeCurvePalette; alpha?: number } = {},
): void {
    if (size <= 0 || centers.length === 0) {
        return;
    }
    const w = size;
    const h = size * 0.5;
    const d = size * 0.95;

    context.save();
    context.globalAlpha = clamp(alpha, 0, 1);
    context.lineWidth = Math.max(0.5, size * 0.14);
    context.lineJoin = "round";
    context.strokeStyle = palette.edge;

    for (const center of centers) {
        const topY = center.y - (d / 2);

        context.fillStyle = palette.top;
        context.beginPath();
        context.moveTo(center.x, topY - h);
        context.lineTo(center.x + w, topY);
        context.lineTo(center.x, topY + h);
        context.lineTo(center.x - w, topY);
        context.closePath();
        context.fill();
        context.stroke();

        context.fillStyle = palette.left;
        context.beginPath();
        context.moveTo(center.x - w, topY);
        context.lineTo(center.x, topY + h);
        context.lineTo(center.x, topY + h + d);
        context.lineTo(center.x - w, topY + d);
        context.closePath();
        context.fill();
        context.stroke();

        context.fillStyle = palette.right;
        context.beginPath();
        context.moveTo(center.x + w, topY);
        context.lineTo(center.x, topY + h);
        context.lineTo(center.x, topY + h + d);
        context.lineTo(center.x + w, topY + d);
        context.closePath();
        context.fill();
        context.stroke();
    }
    context.restore();
}
