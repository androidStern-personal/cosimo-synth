import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadModules() {
    const [checkpoint, lane] = await Promise.all([
        loadUIModule(repoRoot, "ui/speedrun/audio/checkpoint-renderer.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    ]);
    return { checkpoint, lane };
}

function parseLane(laneModule, value) {
    const parsed = laneModule.parseLaneStateV2(value);
    if (parsed._tag === "err") throw new Error(parsed.message);
    return parsed.value;
}

function emittedParamSerials(events) {
    return events.flatMap((event) => event.endpointID === "laneSlotParams"
        && typeof event.value?.deliverySerial === "number"
        ? [event.value.deliverySerial]
        : []);
}

function assertExactFrontier(checkpoint, lane, state, expected) {
    const events = lane.buildLaneRuntimeEventsV2(state);
    const emitted = emittedParamSerials(events);
    assert.equal(Math.max(0, ...emitted), expected);
    assert.equal(checkpoint.getExpectedRackParamSerial(events), expected);
}

test("Speedrun rack readiness uses no parameter frontier for an empty lane", async () => {
    const { checkpoint, lane } = await loadModules();
    const empty = parseLane(lane, {
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {},
        chain: [],
    });

    assertExactFrontier(checkpoint, lane, empty, 0);
});

test("Speedrun rack readiness equals the last ordinary device serial", async () => {
    const { checkpoint, lane } = await loadModules();
    const ordinary = lane.createDefaultLaneStateV2();

    assertExactFrontier(checkpoint, lane, ordinary, 3);
});

test("Speedrun rack readiness includes the emitted split-marker serial exactly", async () => {
    const { checkpoint, lane } = await loadModules();
    const ordinary = lane.createDefaultLaneStateV2();
    const split = parseLane(lane, {
        ...ordinary,
        chain: [{
            kind: "split",
            groupId: "split#1",
            enabled: true,
            xoverLowHz: 640,
            xoverHighHz: 4_800,
            xoverLowKeyTrackEnabled: true,
            xoverLowKeyTrackOffsetSemitones: -12,
            xoverHighKeyTrackEnabled: true,
            xoverHighKeyTrackOffsetSemitones: 7,
            branches: ordinary.chain.map((node) => [node]),
        }],
    });

    assertExactFrontier(checkpoint, lane, split, 4);
});
