import test from "node:test";
import assert from "node:assert/strict";

import {
    MSEG_BODY_SAMPLES,
    MSEG_EDITOR_CURVE_TOLERANCE_PX,
    MSEG_CURVE_POWER_LIMIT,
    MSEG_POINT_RADIUS_PX,
    MSEG_PADDED_SAMPLES,
    clampMsegRateSeconds,
    createMsegEditorMetrics,
    createDefaultMsegPlayback,
    createDefaultMsegShape,
    evaluateMsegShape,
    findMsegPointHitIndex,
    findMsegSegmentHitIndex,
    msegEditorCoordinatesToPoint,
    normalizeMsegPlayback,
    normalizeMsegShape,
    pointToMsegEditorCoordinates,
    renderMsegShape,
    sampleMsegSegmentEditorPolyline,
    sampleRenderedMsegBuffer,
    setMsegSegmentCurvePower,
    toMsegPlaybackConfigEvent,
} from "../patch_gui/mseg.js";

function expectThrows(message, callback) {
    assert.throws(callback, new RegExp(message));
}

function powerScale(value, power) {
    if (Math.abs(power) < 0.01) {
        return value;
    }

    return (Math.exp(power * value) - 1.0) / (Math.exp(power) - 1.0);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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

    const projection = clamp(
        (((pointX - fromX) * deltaX) + ((pointY - fromY) * deltaY)) / lengthSquared,
        0.0,
        1.0,
    );
    const projectedX = fromX + (deltaX * projection);
    const projectedY = fromY + (deltaY * projection);
    const errorX = pointX - projectedX;
    const errorY = pointY - projectedY;
    return Math.sqrt((errorX * errorX) + (errorY * errorY));
}

test("default_shape_has_two_endpoints_and_default_playback", () => {
    const shape = createDefaultMsegShape();
    const playback = createDefaultMsegPlayback();

    assert.equal(shape.points.length, 2);
    assert.deepEqual(shape.points[0], { x: 0.0, y: 0.0, curvePower: 0.0 });
    assert.deepEqual(shape.points[1], { x: 1.0, y: 1.0, curvePower: 0.0 });
    assert.deepEqual(playback, {
        format: "cosimo.mseg.playback",
        version: 1,
        rate: { kind: "seconds", seconds: 1.0 },
        loop: { startX: 0.0, endX: 1.0 },
        noteOffPolicy: "finish_loop",
        legatoRestarts: false,
        holdFinalValue: true,
    });
});

test("seconds_rate_clamps_to_the_modal_editor_supported_range", () => {
    assert.equal(clampMsegRateSeconds(-1.0), 0.0);
    assert.equal(clampMsegRateSeconds(0.0), 0.0);
    assert.equal(clampMsegRateSeconds(99.0), 2.0);
});

test("playback_normalization_swaps_reversed_loops_and_disables_zero_width_loops", () => {
    const swapped = normalizeMsegPlayback({
        ...createDefaultMsegPlayback(),
        loop: { startX: 0.8, endX: 0.2 },
    });
    const disabled = normalizeMsegPlayback({
        ...createDefaultMsegPlayback(),
        loop: { startX: 0.5, endX: 0.5 },
    });

    assert.deepEqual(swapped.loop, { startX: 0.2, endX: 0.8 });
    assert.equal(disabled.loop, null);
});

test("playback_normalization_disables_zero_width_loops_and_preserves_seconds_rate", () => {
    const playback = normalizeMsegPlayback({
        ...createDefaultMsegPlayback(),
        rate: { kind: "seconds", seconds: 0.375 },
        loop: { startX: 0.6, endX: 0.6 },
    });

    assert.equal(playback.rate.kind, "seconds");
    assert.equal(playback.rate.seconds, 0.375);
    assert.equal(playback.loop, null);
});

test("playback_config_event_uses_the_flat_seconds_loop_payload", () => {
    assert.deepEqual(
        toMsegPlaybackConfigEvent({
            ...createDefaultMsegPlayback(),
            rate: { kind: "seconds", seconds: 0.375 },
            loop: { startX: 0.0, endX: 1.0 },
        }),
        {
            seconds: 0.375,
            holdFinalValue: true,
            rateKind: 0,
            loopEnabled: true,
            loopStart: 0.0,
            loopEnd: 1.0,
            noteOffPolicy: 0,
            legatoRestarts: false,
        }
    );
});

test("point_hit_testing_accepts_near_misses_inside_the_larger_pick_radius", () => {
    const shape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.0, curvePower: 0.0 },
            { x: 0.5, y: 0.5, curvePower: 0.0 },
            { x: 1.0, y: 1.0, curvePower: 0.0 },
        ],
    };

    assert.equal(findMsegPointHitIndex(shape, 312, 84, 600, 180), 1);
    assert.equal(findMsegPointHitIndex(shape, 335, 125, 600, 180), -1);
});

test("editor_metrics_keep_endpoints_clear_of_the_shell border", () => {
    const metrics = createMsegEditorMetrics(600, 180);
    const start = pointToMsegEditorCoordinates({ x: 0.0, y: 0.0 }, 600, 180);
    const end = pointToMsegEditorCoordinates({ x: 1.0, y: 1.0 }, 600, 180);

    assert.ok(start.x >= metrics.plotLeft);
    assert.ok(start.y <= metrics.plotBottom);
    assert.ok(end.x <= metrics.plotRight);
    assert.ok(end.y >= metrics.plotTop);
    assert.ok(metrics.plotLeft >= MSEG_POINT_RADIUS_PX);
    assert.ok(metrics.plotRight <= 600 - MSEG_POINT_RADIUS_PX);
});

test("vertical editor orientation maps time along the long axis and amplitude across it", () => {
    const start = pointToMsegEditorCoordinates(
        { x: 0.0, y: 0.0 },
        180,
        600,
        { orientation: "vertical" }
    );
    const end = pointToMsegEditorCoordinates(
        { x: 1.0, y: 1.0 },
        180,
        600,
        { orientation: "vertical" }
    );

    assert.ok(start.y < end.y);
    assert.ok(start.x < end.x);
    assert.deepEqual(
        msegEditorCoordinatesToPoint(start.x, start.y, 180, 600, { orientation: "vertical" }),
        { x: 0.0, y: 0.0 }
    );
    assert.deepEqual(
        msegEditorCoordinatesToPoint(end.x, end.y, 180, 600, { orientation: "vertical" }),
        { x: 1.0, y: 1.0 }
    );
});

test("segment_hit_testing_tracks_the_drawn_line_without_using_point_hits", () => {
    const shape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.0, curvePower: 0.0 },
            { x: 0.5, y: 0.5, curvePower: 0.0 },
            { x: 1.0, y: 1.0, curvePower: 0.0 },
        ],
    };
    const middleOfFirstSegment = pointToMsegEditorCoordinates({ x: 0.25, y: 0.25 }, 600, 180);

    assert.equal(
        findMsegSegmentHitIndex(shape, middleOfFirstSegment.x, middleOfFirstSegment.y, 600, 180),
        0,
    );
    assert.equal(findMsegSegmentHitIndex(shape, 120, 150, 600, 180), -1);
});

test("adaptive segment sampling keeps a steep short curve smooth into the endpoint", () => {
    const shape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.0, curvePower: 16.0 },
            { x: 0.08, y: 1.0, curvePower: 0.0 },
            { x: 1.0, y: 1.0, curvePower: 0.0 },
        ],
    };
    const polyline = sampleMsegSegmentEditorPolyline(shape, 0, 640, 240);

    assert.ok(polyline.length >= 3, "Expected the sampled segment to contain interior points.");

    const finalChordFrom = polyline.at(-2);
    const finalChordTo = polyline.at(-1);
    assert.ok(finalChordFrom);
    assert.ok(finalChordTo);

    const finalChordStart = msegEditorCoordinatesToPoint(finalChordFrom.x, finalChordFrom.y, 640, 240);
    const finalChordEnd = msegEditorCoordinatesToPoint(finalChordTo.x, finalChordTo.y, 640, 240);
    const midpointX = (finalChordStart.x + finalChordEnd.x) * 0.5;
    const midpointCoordinates = pointToMsegEditorCoordinates(
        { x: midpointX, y: evaluateMsegShape(shape, midpointX) },
        640,
        240,
    );
    const midpointErrorPx = distanceToLineSegment(
        midpointCoordinates.x,
        midpointCoordinates.y,
        finalChordFrom.x,
        finalChordFrom.y,
        finalChordTo.x,
        finalChordTo.y,
    );

    assert.ok(
        midpointErrorPx <= MSEG_EDITOR_CURVE_TOLERANCE_PX + 0.05,
        `Expected final chord error <= ${MSEG_EDITOR_CURVE_TOLERANCE_PX + 0.05}px, got ${midpointErrorPx.toFixed(3)}px`,
    );
});

test("setting_segment_curve_power_updates_the_outgoing_segment_only", () => {
    const shape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.0, curvePower: 0.0 },
            { x: 0.4, y: 0.7, curvePower: 0.0 },
            { x: 1.0, y: 0.2, curvePower: 0.0 },
        ],
    };
    const curved = setMsegSegmentCurvePower(shape, 1, -4.5);

    assert.equal(curved.points[0].curvePower, 0.0);
    assert.equal(curved.points[1].curvePower, -4.5);
    assert.equal(curved.points[2].curvePower, 0.0);
});

test("shape_validation_rejects_fewer_than_two_points", () => {
    expectThrows("at least two points", () => normalizeMsegShape({
        ...createDefaultMsegShape(),
        points: [{ x: 0.0, y: 0.5, curvePower: 0.0 }],
    }));
});

test("shape_validation_rejects_missing_fixed_endpoints", () => {
    expectThrows("start at x = 0", () => normalizeMsegShape({
        ...createDefaultMsegShape(),
        points: [
            { x: 0.25, y: 0.5, curvePower: 0.0 },
            { x: 1.0, y: 0.5, curvePower: 0.0 },
        ],
    }));
});

test("shape_validation_rejects_decreasing_x", () => {
    expectThrows("non-decreasing", () => normalizeMsegShape({
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.5, curvePower: 0.0 },
            { x: 0.75, y: 0.3, curvePower: 0.0 },
            { x: 0.5, y: 0.8, curvePower: 0.0 },
            { x: 1.0, y: 0.5, curvePower: 0.0 },
        ],
    }));
});

test("shape_validation_clamps_y_and_curve_power", () => {
    const normalized = normalizeMsegShape({
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: -1.0, curvePower: -999.0 },
            { x: 1.0, y: 4.0, curvePower: 999.0 },
        ],
    });

    assert.equal(normalized.points[0].y, 0.0);
    assert.equal(normalized.points[1].y, 1.0);
    assert.equal(normalized.points[0].curvePower, -MSEG_CURVE_POWER_LIMIT);
    assert.equal(normalized.points[1].curvePower, MSEG_CURVE_POWER_LIMIT);
});

test("render_constant_shape_produces_constant_2051_sample_buffer", () => {
    const rendered = renderMsegShape({
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.25, curvePower: 0.0 },
            { x: 1.0, y: 0.25, curvePower: 0.0 },
        ],
    });

    assert.equal(rendered.length, MSEG_PADDED_SAMPLES);
    rendered.forEach((sample) => {
        assert.equal(sample, 0.25);
    });
});

test("render_ramp_hits_exact_endpoints", () => {
    const rendered = renderMsegShape({
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.0, curvePower: 0.0 },
            { x: 1.0, y: 1.0, curvePower: 0.0 },
        ],
    });

    assert.equal(rendered[1], 0.0);
    assert.equal(rendered[MSEG_BODY_SAMPLES], 1.0);
});

test("render_ramp_uses_exact_sample_domain", () => {
    const rendered = renderMsegShape({
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.0, curvePower: 0.0 },
            { x: 1.0, y: 1.0, curvePower: 0.0 },
        ],
    });

    const quarterIndex = Math.floor((MSEG_BODY_SAMPLES - 1) * 0.25);
    const halfIndex = Math.floor((MSEG_BODY_SAMPLES - 1) * 0.5);
    assert.ok(Math.abs(rendered[quarterIndex + 1] - (quarterIndex / (MSEG_BODY_SAMPLES - 1))) <= 1e-7);
    assert.ok(Math.abs(rendered[halfIndex + 1] - (halfIndex / (MSEG_BODY_SAMPLES - 1))) <= 1e-7);
});

test("render_curve_power_matches_reference_formula", () => {
    const shape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.2, curvePower: 2.5 },
            { x: 1.0, y: 0.8, curvePower: 0.0 },
        ],
    };
    const rendered = renderMsegShape(shape);
    const probeIndices = [128, 512, 1024, 1536];

    for (const index of probeIndices) {
        const t = index / (MSEG_BODY_SAMPLES - 1);
        const expected = 0.2 + ((0.8 - 0.2) * powerScale(t, 2.5));
        assert.ok(Math.abs(rendered[index + 1] - expected) <= 1e-6);
    }
});

test("render_duplicate_x_step_is_finite_and_uses_later_point_at_exact_x", () => {
    const shape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.2, curvePower: 0.0 },
            { x: 0.5, y: 0.2, curvePower: 0.0 },
            { x: 0.5, y: 0.9, curvePower: 0.0 },
            { x: 1.0, y: 0.9, curvePower: 0.0 },
        ],
    };
    const rendered = renderMsegShape(shape);
    rendered.forEach((sample) => {
        assert.equal(Number.isFinite(sample), true);
    });

    assert.equal(evaluateMsegShape(shape, 0.5), 0.9);
    const exactIndex = Math.round(0.5 * (MSEG_BODY_SAMPLES - 1));
    assert.ok(Math.abs(rendered[exactIndex + 1] - 0.9) <= 1e-6);
});

test("render_padding_is_nonperiodic_and_clamped", () => {
    const rendered = renderMsegShape({
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.125, curvePower: 0.0 },
            { x: 1.0, y: 0.875, curvePower: 0.0 },
        ],
    });

    assert.equal(rendered[0], rendered[1]);
    assert.equal(rendered[MSEG_BODY_SAMPLES + 1], rendered[MSEG_BODY_SAMPLES]);
    assert.equal(rendered[MSEG_BODY_SAMPLES + 2], rendered[MSEG_BODY_SAMPLES]);
});

test("global_smooth_is_persisted_but_inactive_in_phase6a", () => {
    const shape = {
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.0, curvePower: 0.0 },
            { x: 0.35, y: 0.8, curvePower: -1.5 },
            { x: 1.0, y: 1.0, curvePower: 0.0 },
        ],
    };
    const smoothOff = renderMsegShape({ ...shape, globalSmooth: false });
    const smoothOn = renderMsegShape({ ...shape, globalSmooth: true });

    assert.deepEqual(Array.from(smoothOn), Array.from(smoothOff));
});

test("reference_sampler_matches_renderer_contract_at_boundaries", () => {
    const rendered = renderMsegShape({
        ...createDefaultMsegShape(),
        points: [
            { x: 0.0, y: 0.1, curvePower: 0.0 },
            { x: 1.0, y: 0.9, curvePower: 0.0 },
        ],
    });

    assert.ok(Math.abs(sampleRenderedMsegBuffer(rendered, 0.0) - 0.1) <= 1e-6);
    assert.ok(Math.abs(sampleRenderedMsegBuffer(rendered, 0.5) - 0.5) <= 0.001);
    assert.ok(sampleRenderedMsegBuffer(rendered, 0.999) >= 0.89);
    assert.ok(Math.abs(sampleRenderedMsegBuffer(rendered, 1.0) - 0.9) <= 1e-6);
});
