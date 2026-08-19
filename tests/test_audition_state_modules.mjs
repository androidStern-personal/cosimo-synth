import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("auto-preview preference round-trips and rejects garbage", async () => {
    const { serializeAutoPreviewEnabled, parseStoredAutoPreviewEnabled } = await loadUIModule(
        repoRoot,
        "ui/shared/audition-preferences.ts",
    );

    assert.equal(parseStoredAutoPreviewEnabled(serializeAutoPreviewEnabled(true)), true);
    assert.equal(parseStoredAutoPreviewEnabled(serializeAutoPreviewEnabled(false)), false);

    // Stored state is external input: unreadable values yield null and the
    // caller applies the default (off before first use).
    assert.equal(parseStoredAutoPreviewEnabled(null), null);
    assert.equal(parseStoredAutoPreviewEnabled("banana"), null);
    assert.equal(parseStoredAutoPreviewEnabled(JSON.stringify({ enabled: "yes" })), null);
});

test("intentional pitch memory starts at middle C and follows valid intentional notes", async () => {
    const { createIntentionalPitchMemory } = await loadUIModule(
        repoRoot,
        "ui/shared/intentional-pitch.ts",
    );

    const memory = createIntentionalPitchMemory();
    assert.equal(memory.current(), 60);

    memory.noteOn(64);
    assert.equal(memory.current(), 64);
    memory.noteOn(0);
    assert.equal(memory.current(), 0);
    memory.noteOn(127);
    assert.equal(memory.current(), 127);
});

test("intentional pitch memory ignores out-of-domain notes", async () => {
    const { createIntentionalPitchMemory } = await loadUIModule(
        repoRoot,
        "ui/shared/intentional-pitch.ts",
    );

    const memory = createIntentionalPitchMemory();
    memory.noteOn(72);
    memory.noteOn(-1);
    memory.noteOn(128);
    memory.noteOn(60.5);
    memory.noteOn(Number.NaN);
    assert.equal(memory.current(), 72);
});
