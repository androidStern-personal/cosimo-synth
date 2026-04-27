import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadEditorCurveGeometryModule() {
    return await loadUIModule(repoRoot, "ui/shared/editor-curve-geometry.ts");
}

function distanceToLineSegment(pointX, pointY, fromX, fromY, toX, toY) {
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const lengthSquared = (deltaX * deltaX) + (deltaY * deltaY);

    if (lengthSquared <= 1e-12) {
        const fallbackDeltaX = pointX - fromX;
        const fallbackDeltaY = pointY - fromY;
        return Math.sqrt((fallbackDeltaX * fallbackDeltaX) + (fallbackDeltaY * fallbackDeltaY));
    }

    const projection = Math.min(
        1,
        Math.max(
            0,
            (((pointX - fromX) * deltaX) + ((pointY - fromY) * deltaY)) / lengthSquared,
        ),
    );
    const projectedX = fromX + (deltaX * projection);
    const projectedY = fromY + (deltaY * projection);
    const errorX = pointX - projectedX;
    const errorY = pointY - projectedY;
    return Math.sqrt((errorX * errorX) + (errorY * errorY));
}

test("editor_curve_plot_rect_uses_shared_gutters_and_reserves", async () => {
    const { createEditorCurvePlotRect } = await loadEditorCurveGeometryModule();

    assert.deepEqual(createEditorCurvePlotRect(300, 220, { topReservePx: 14 }), {
        plotLeft: 15,
        plotRight: 285,
        plotTop: 34,
        plotBottom: 180,
        plotWidth: 270,
        plotHeight: 146,
    });
});

test("editor_curve_paths_map_normalized_points_and_fill_to_the_plot_baseline", async () => {
    const {
        createEditorCurvePlotRect,
        editorCurveFillPathToBaseline,
        normalizedCurvePointToPlotPoint,
        polylineToSvgPath,
    } = await loadEditorCurveGeometryModule();
    const plot = createEditorCurvePlotRect(200, 120, {
        horizontalPaddingPx: 10,
        topPaddingPx: 10,
        bottomPaddingPx: 20,
    });
    const points = [
        normalizedCurvePointToPlotPoint({ x: 0, y: 0 }, plot),
        normalizedCurvePointToPlotPoint({ x: 0.5, y: 0.75 }, plot),
        normalizedCurvePointToPlotPoint({ x: 1, y: 1 }, plot),
    ];

    assert.deepEqual(points, [
        { x: 10, y: 100 },
        { x: 100, y: 32.5 },
        { x: 190, y: 10 },
    ]);
    assert.equal(polylineToSvgPath(points, 1), "M 10.0 100.0 L 100.0 32.5 L 190.0 10.0");
    assert.equal(
        editorCurveFillPathToBaseline(points, plot, 1),
        "M 10.0 100.0 L 100.0 32.5 L 190.0 10.0 L 190.0 100.0 L 10.0 100.0 Z",
    );
});

test("adaptive_editor_curve_sampler_subdivides_until_midpoint_pixel_error_is_inside_tolerance", async () => {
    const {
        adaptiveSampleEditorCurve,
        createEditorCurvePlotRect,
        normalizedCurvePointToPlotPoint,
    } = await loadEditorCurveGeometryModule();
    const plot = createEditorCurvePlotRect(640, 240);
    const evaluate = (t) => ({
        x: t * 0.08,
        y: Math.pow(t, 16),
    });
    const polyline = adaptiveSampleEditorCurve({
        evaluate,
        plot,
        tolerancePx: 0.5,
        maxDepth: 12,
    });

    assert.ok(polyline.length >= 3, "expected adaptive sampling to insert interior points for a steep short curve");

    const finalChordFrom = polyline.at(-2);
    const finalChordTo = polyline.at(-1);
    assert.ok(finalChordFrom);
    assert.ok(finalChordTo);

    const midpointT = ((finalChordFrom.t ?? 0) + (finalChordTo.t ?? 1)) * 0.5;
    const midpoint = normalizedCurvePointToPlotPoint(evaluate(midpointT), plot);
    const midpointErrorPx = distanceToLineSegment(
        midpoint.x,
        midpoint.y,
        finalChordFrom.x,
        finalChordFrom.y,
        finalChordTo.x,
        finalChordTo.y,
    );

    assert.ok(
        midpointErrorPx <= 0.55,
        `expected final chord midpoint error <= 0.55px, got ${midpointErrorPx.toFixed(3)}px`,
    );
});

test("adaptive_editor_curve_sampler_uses_breakpoints_to_keep_narrow_local_curves_visible", async () => {
    const {
        adaptiveSampleEditorCurve,
        createEditorCurvePlotRect,
    } = await loadEditorCurveGeometryModule();
    const plot = createEditorCurvePlotRect(640, 240);
    const gate = 0.25;
    const evaluate = (t) => {
        if (t >= gate) {
            return { x: t, y: 0 };
        }

        const u = t / gate;
        return {
            x: t,
            y: u < 0.5 ? 2 * u : 2 * (1 - u),
        };
    };
    const polyline = adaptiveSampleEditorCurve({
        evaluate,
        plot,
        breakpoints: [gate],
        tolerancePx: 0.5,
        maxDepth: 12,
    });
    const highestPoint = polyline.reduce((highest, point) => (
        point.y < highest.y ? point : highest
    ), polyline[0]);

    assert.ok(
        highestPoint.y < plot.plotTop + (plot.plotHeight * 0.1),
        `expected the narrow gated triangle peak to stay visible, got y=${highestPoint.y.toFixed(2)}`,
    );
    assert.ok(
        polyline.some((point) => Math.abs((point.t ?? -1) - gate) < 0.000001),
        "expected the gate breakpoint to be included in the sampled polyline",
    );
});
