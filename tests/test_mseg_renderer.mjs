import test from "node:test";
import assert from "node:assert/strict";

import {
    MSEG_BODY_SAMPLES,
    MSEG_CURVE_POWER_LIMIT,
    MSEG_PADDED_SAMPLES,
    createDefaultMsegPlayback,
    createDefaultMsegShape,
    evaluateMsegShape,
    findMsegPointHitIndex,
    normalizeMsegShape,
    renderMsegShape,
    sampleRenderedMsegBuffer,
} from "../patch_gui/mseg.mjs";

function expectThrows(message, callback) {
    assert.throws(callback, new RegExp(message));
}

function powerScale(value, power) {
    if (Math.abs(power) < 0.01) {
        return value;
    }

    return (Math.exp(power * value) - 1.0) / (Math.exp(power) - 1.0);
}

test("default_shape_has_two_endpoints_and_default_playback", () => {
    const shape = createDefaultMsegShape();
    const playback = createDefaultMsegPlayback();

    assert.equal(shape.points.length, 2);
    assert.deepEqual(shape.points[0], { x: 0.0, y: 0.0, curvePower: 0.0 });
    assert.deepEqual(shape.points[1], { x: 1.0, y: 1.0, curvePower: 0.0 });
    assert.equal(playback.rate.kind, "seconds");
    assert.equal(playback.rate.seconds, 1.0);
    assert.equal(playback.loop, null);
    assert.equal(playback.holdFinalValue, true);
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
