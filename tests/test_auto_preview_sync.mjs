import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const CONFIG = {
    minSyncPeriodMs: 120,
    waitBudgetLeadingMs: 150,
    waitBudgetOtherMs: 300,
    minSubdivisionMs: 120,
    slowLoopPolicy: "subdivision",
};

async function loadQuantizer() {
    const { quantizeStrikeTime } = await loadUIModule(repoRoot, "ui/shared/auto-preview-sync.ts");
    return (input) => quantizeStrikeTime({ config: CONFIG, ...input });
}

test("no eligible loop or an invalid source strikes immediately", async () => {
    const quantize = await loadQuantizer();

    assert.equal(quantize({ now: 500, kind: "inMotion", source: null }), 500);
    assert.equal(quantize({ now: 500, kind: "inMotion", source: { periodMs: 0, anchorMs: 0 } }), 500);
    assert.equal(quantize({ now: 500, kind: "inMotion", source: { periodMs: -200, anchorMs: 0 } }), 500);
    assert.equal(quantize({ now: 500, kind: "inMotion", source: { periodMs: Number.NaN, anchorMs: 0 } }), 500);
    // An anchor in the future is clock nonsense, not a rhythm to wait for.
    assert.equal(quantize({ now: 500, kind: "inMotion", source: { periodMs: 200, anchorMs: 900 } }), 500);
});

test("loops faster than the sync floor never defer", async () => {
    const quantize = await loadQuantizer();

    assert.equal(quantize({ now: 1000, kind: "trailing", source: { periodMs: 119, anchorMs: 0 } }), 1000);
    // At the floor itself, sync engages.
    assert.equal(quantize({ now: 1010, kind: "trailing", source: { periodMs: 120, anchorMs: 1000 } }), 1120);
});

test("sweet-band strikes land on the next cycle boundary from the note-on anchor", async () => {
    const quantize = await loadQuantizer();
    // 200ms period sits inside the in-motion/trailing budget (300) but past
    // the leading budget (150) — sweet-band behavior belongs to the former.
    const source = { periodMs: 200, anchorMs: 1000 };

    assert.equal(quantize({ now: 1310, kind: "inMotion", source }), 1400);
    assert.equal(quantize({ now: 1401, kind: "inMotion", source }), 1600);
    // Exactly on a boundary fires immediately.
    assert.equal(quantize({ now: 1400, kind: "inMotion", source }), 1400);
    // The wait can never exceed one period in the sweet band.
    for (const now of [1000, 1050, 1130, 1199]) {
        const strikeAt = quantize({ now, kind: "trailing", source });
        assert.ok(strikeAt >= now && strikeAt - now < 200, `wait bounded at now=${now}`);
        assert.equal((strikeAt - 1000) % 200, 0, `on-grid at now=${now}`);
    }
});

test("the wait budget depends on the strike kind", async () => {
    const quantize = await loadQuantizer();
    // 280ms period: inside the in-motion/trailing budget (300) but past the
    // leading budget (150), so the same due moment resolves differently.
    const source = { periodMs: 280, anchorMs: 0 };

    assert.equal(quantize({ now: 300, kind: "inMotion", source }), 560);
    assert.equal(quantize({ now: 300, kind: "trailing", source }), 560);
    // Leading falls into the slow-loop policy; subdivision grid 140 (280/2)
    // fits [120, 150]: next grid boundary after 300 is 420, wait 120 <= 150.
    assert.equal(quantize({ now: 300, kind: "leading", source }), 420);
});

test("opportunistic slow loops defer only when the boundary is within budget", async () => {
    const { quantizeStrikeTime } = await loadUIModule(repoRoot, "ui/shared/auto-preview-sync.ts");
    const config = { ...CONFIG, slowLoopPolicy: "opportunistic" };
    const source = { periodMs: 1000, anchorMs: 0 };

    assert.equal(quantizeStrikeTime({ now: 920, kind: "inMotion", source, config }), 1000);
    assert.equal(quantizeStrikeTime({ now: 700, kind: "inMotion", source, config }), 1000);
    // Boundary 600ms away exceeds the 300ms budget: fire immediately.
    assert.equal(quantizeStrikeTime({ now: 400, kind: "inMotion", source, config }), 400);
});

test("subdivision slow loops quantize to the finest binary grid within budget and floor", async () => {
    const quantize = await loadQuantizer();
    const source = { periodMs: 1000, anchorMs: 0 };

    // Grids: 500, 250, 125 (>= the 120 floor), 62.5 (below it). The finest
    // fitting grid is 125 — eighths of the cycle. Raising minSubdivisionMs is
    // the tuning knob if eighths feel too permissive.
    assert.equal(quantize({ now: 610, kind: "inMotion", source }), 625);
    assert.equal(quantize({ now: 751, kind: "inMotion", source }), 875);
    assert.equal(quantize({ now: 500, kind: "inMotion", source }), 500);
    // The wait stays inside the budget everywhere on the cycle.
    for (const now of [0, 90, 260, 490, 620, 940]) {
        const strikeAt = quantize({ now, kind: "trailing", source });
        assert.ok(strikeAt - now <= 300, `budget respected at now=${now}`);
        assert.equal((strikeAt - 0) % 125, 0, `on the 125ms grid at now=${now}`);
    }
});

test("a grid below the subdivision floor falls back to opportunistic on the coarser grid", async () => {
    const quantize = await loadQuantizer();
    // 400ms loop, leading budget 150: grid 200 exceeds the budget, grid 100 is
    // under the 120ms floor. Fall back to opportunistic against the 200ms grid.
    const source = { periodMs: 400, anchorMs: 0 };

    assert.equal(quantize({ now: 390, kind: "leading", source }), 400);
    assert.equal(quantize({ now: 250, kind: "leading", source }), 400);
    // Next 200-grid boundary is 190ms away: over the leading budget, fire now.
    assert.equal(quantize({ now: 210, kind: "leading", source }), 210);
});

test("anchors far in the past still produce an on-grid boundary", async () => {
    const quantize = await loadQuantizer();
    const source = { periodMs: 250, anchorMs: 3 };

    const strikeAt = quantize({ now: 100_000, kind: "trailing", source });
    assert.ok(strikeAt >= 100_000 && strikeAt - 100_000 < 250);
    assert.equal((strikeAt - 3) % 250, 0);
});
