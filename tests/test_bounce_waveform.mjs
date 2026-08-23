import test from "node:test";
import assert from "node:assert/strict";

import { buildBounceBank } from "../bounce/bank-format.mjs";
import {
    createBounceWaveformEnvelope,
    nearestBounceRootIndex,
} from "../bounce/waveform.mjs";

test("Bounce waveform selects the root nearest the last note and preserves peaks", () => {
    const bank = buildBounceBank({
        sampleRate: 48_000,
        roots: [
            { note: 48, samples: Int16Array.from([0, 0, 100, -200, 0, 0, 0, 0]) },
            { note: 60, samples: Int16Array.from([0, 0, 16_384, -32_768, 0, 0, -8_192, 4_096]) },
            { note: 72, samples: Int16Array.from([0, 0, 300, -400, 0, 0, 0, 0]) },
        ],
    });

    assert.equal(nearestBounceRootIndex(bank, 58), 1);
    assert.equal(nearestBounceRootIndex(bank, 54), 0, "ties choose the lower root");
    const envelope = createBounceWaveformEnvelope(bank, { note: 58, columnCount: 8 });
    assert.equal(envelope.rootNote, 60);
    assert.equal(envelope.columns.length, 8);
    assert.equal(Math.min(...envelope.columns.map((column) => column.minimum)), -1);
    assert.equal(Math.max(...envelope.columns.map((column) => column.maximum)), 0.5);
});
