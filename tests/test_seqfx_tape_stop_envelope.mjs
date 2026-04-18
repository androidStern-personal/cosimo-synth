import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envelopeModule = await loadUIModule(repoRoot, "fx/seqfx/view/tape-stop-envelope.ts");

const {
    TAPE_STOP_MODE_SPIN_UP,
    TAPE_STOP_MODE_STOP,
    TAPE_STOP_SPEED_FLOOR,
    evaluateTapeStopDisplaySpeed,
    evaluateTapeStopSpeed,
    sampleTapeStopDisplayEnvelope,
    resolveTapeStopEnvelope,
} = envelopeModule;

function integrateEnvelope(params, samples = 4096) {
    const resolved = resolveTapeStopEnvelope(params);
    let area = 0;

    for (let index = 0; index < samples; index += 1) {
        const timeMs = ((index + 0.5) / samples) * resolved.blockDurationMs;
        area += evaluateTapeStopSpeed(resolved, timeMs);
    }

    return (area / samples) * resolved.blockDurationMs;
}

test("tape_stop_envelope_stop_point_past_block_edge_shows_only_partial_slowdown", () => {
    const resolved = resolveTapeStopEnvelope({
        blockDurationMs: 1_000,
        mode: TAPE_STOP_MODE_STOP,
        stopPointPercent: 200,
        curve: 1,
        catchupPercent: 20,
        catchupCurve: 1,
    });

    assert.equal(resolved.catchupDurationMs, 0);
    assert.ok(evaluateTapeStopSpeed(resolved, 1_000) > 0.49);
});

test("tape_stop_envelope_catchup_no_longer_uses_hidden_overspeed", () => {
    const resolved = resolveTapeStopEnvelope({
        blockDurationMs: 1_000,
        mode: TAPE_STOP_MODE_STOP,
        stopPointPercent: 50,
        curve: 1,
        catchupPercent: 25,
        catchupCurve: 1,
    });

    const area = integrateEnvelope(resolved);

    assert.equal(evaluateTapeStopSpeed(resolved, 1_000), 1);
    assert.ok(evaluateTapeStopSpeed(resolved, 875) <= 1);
    assert.ok(area < 1_000, `expected tape motion area ${area} to stay below dry timeline without overspeed`);
});

test("tape_stop_envelope_keeps_independent_stop_and_catchup_percentages_with_a_hold_gap", () => {
    const resolved = resolveTapeStopEnvelope({
        blockDurationMs: 1_000,
        mode: TAPE_STOP_MODE_STOP,
        stopPointPercent: 10,
        curve: 1,
        catchupPercent: 10,
        catchupCurve: 1,
    });

    assert.equal(resolved.stopPointMs, 100);
    assert.equal(resolved.catchupStartMs, 900);
    assert.equal(resolved.catchupDurationMs, 100);
    assert.equal(evaluateTapeStopDisplaySpeed(resolved, 500), TAPE_STOP_SPEED_FLOOR);
    assert.ok(evaluateTapeStopDisplaySpeed(resolved, 950) > TAPE_STOP_SPEED_FLOOR);
});

test("tape_stop_envelope_pushes_catchup_later_when_stop_point_overlaps_it", () => {
    const resolved = resolveTapeStopEnvelope({
        blockDurationMs: 1_000,
        mode: TAPE_STOP_MODE_STOP,
        stopPointPercent: 80,
        curve: 1,
        catchupPercent: 50,
        catchupCurve: 1,
    });

    assert.equal(resolved.catchupDurationMs, 200);
    assert.equal(resolved.catchupStartMs, 800);
    assert.equal(evaluateTapeStopSpeed(resolved, 800), TAPE_STOP_SPEED_FLOOR);
});

test("tape_stop_envelope_spin_up_mode_inverts_the_first_curve_and_keeps_sync_catchup_at_the_end", () => {
    const resolved = resolveTapeStopEnvelope({
        blockDurationMs: 1_000,
        mode: TAPE_STOP_MODE_SPIN_UP,
        stopPointPercent: 25,
        curve: 1,
        catchupPercent: 25,
        catchupCurve: 1,
    });

    assert.equal(evaluateTapeStopDisplaySpeed(resolved, 0), TAPE_STOP_SPEED_FLOOR);
    assert.ok(evaluateTapeStopDisplaySpeed(resolved, 125) > TAPE_STOP_SPEED_FLOOR);
    assert.equal(evaluateTapeStopDisplaySpeed(resolved, 250), 1);
    assert.equal(evaluateTapeStopDisplaySpeed(resolved, 500), 1);
    assert.equal(resolved.catchupStartMs, 750);
    assert.equal(evaluateTapeStopSpeed(resolved, 875), 1);
});

test("tape_stop_display_envelope_matches_the_non_overspeed_return_curve", () => {
    const resolved = resolveTapeStopEnvelope({
        blockDurationMs: 1_000,
        mode: TAPE_STOP_MODE_STOP,
        stopPointPercent: 70,
        curve: 1.6,
        catchupPercent: 25,
        catchupCurve: 1.2,
    });
    const displaySamples = sampleTapeStopDisplayEnvelope(resolved, 33);
    const catchupSamples = displaySamples.filter((sample) => sample.timeMs >= resolved.catchupStartMs);

    assert.equal(evaluateTapeStopSpeed(resolved, 875), evaluateTapeStopDisplaySpeed(resolved, 875));
    assert.equal(displaySamples.at(-1).speed, 1);
    assert.ok(catchupSamples.every((sample) => sample.speed <= 1));
    assert.deepEqual(
        catchupSamples.map((sample) => sample.speed).slice(1).every((speed, index) => speed >= catchupSamples[index].speed),
        true,
    );
});
