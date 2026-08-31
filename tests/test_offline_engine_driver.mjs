import assert from "node:assert/strict";
import test from "node:test";

import { renderScore } from "./tools/offline-engine-driver.mjs";

class RecordingPerformer {
    constructor() {
        this.frame = 0;
        this.applied = [];
        this.advances = [];
    }

    advance(count) {
        this.advances.push([this.frame, this.frame + count]);
        this.frame += count;
    }

    getOutputFrames_audioOut(channels, count) {
        channels[0].fill(this.frame, 0, count);
        channels[1].fill(-this.frame, 0, count);
    }

    sendInputEvent_marker(value) {
        this.applied.push([this.frame, "marker", value]);
    }

    setInputValue_gain(value) {
        this.applied.push([this.frame, "gain", value]);
    }

    sendInputEvent_midiIn(value) {
        this.applied.push([this.frame, "midi", value.message]);
    }
}

test("offline engine scores apply events at exact frames in stable same-frame order", () => {
    const performer = new RecordingPerformer();
    const rendered = renderScore(performer, [
        { atFrame: 96, midi: [0x90, 60, 100] },
        { atFrame: 32, event: "marker", value: "first-at-32" },
        { atFrame: 0, event: "marker", value: "at-zero" },
        { atFrame: 64, parameter: "gain", value: 0.25 },
        { atFrame: 32, event: "marker", value: "second-at-32" },
    ], 160);

    assert.deepEqual(performer.applied, [
        [0, "marker", "at-zero"],
        [32, "marker", "first-at-32"],
        [32, "marker", "second-at-32"],
        [64, "gain", 0.25],
        [96, "midi", (0x90 << 16) | (60 << 8) | 100],
    ]);
    assert.deepEqual(performer.advances, [
        [0, 32],
        [32, 64],
        [64, 96],
        [96, 160],
    ]);
    assert.equal(rendered.samples.length, 320);
});
