import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function makeMemory() {
    const { createPreviewNoteMemory } = await loadUIModule(
        repoRoot,
        "ui/shared/preview-note-memory.ts",
    );
    return createPreviewNoteMemory(60);
}

test("memory uses its fallback until a played group completes", async () => {
    const memory = await makeMemory();

    assert.deepEqual(memory.rememberedGroup(), [60]);
    memory.noteOn(64, true);
    assert.deepEqual(memory.rememberedGroup(), [60]);
});

test("a completed one-note group becomes the remembered group", async () => {
    const memory = await makeMemory();

    memory.noteOn(64, true);
    memory.noteOff(64);

    assert.deepEqual(memory.rememberedGroup(), [64]);
});

test("a simultaneous chord is remembered as distinct ascending pitches", async () => {
    const memory = await makeMemory();

    memory.noteOn(67, true);
    memory.noteOn(60, true);
    memory.noteOn(64, true);
    memory.noteOff(67);
    memory.noteOff(60);
    memory.noteOff(64);

    assert.deepEqual(memory.rememberedGroup(), [60, 64, 67]);
});

test("overlapping rolled notes form one remembered group", async () => {
    const memory = await makeMemory();

    memory.noteOn(60, true);
    memory.noteOn(64, true);
    memory.noteOff(60);
    memory.noteOff(64);

    assert.deepEqual(memory.rememberedGroup(), [60, 64]);
});

test("a chained overlap remains one group when its endpoints never overlap", async () => {
    const memory = await makeMemory();

    memory.noteOn(60, true);
    memory.noteOn(64, true);
    memory.noteOff(60);
    memory.noteOn(67, true);
    memory.noteOff(64);
    memory.noteOff(67);

    assert.deepEqual(memory.rememberedGroup(), [60, 64, 67]);
});

test("the building group stays private until the last held note releases", async () => {
    const memory = await makeMemory();
    memory.noteOn(64, true);
    memory.noteOff(64);

    memory.noteOn(67, true);
    memory.noteOn(71, true);
    memory.noteOff(67);
    assert.deepEqual(memory.rememberedGroup(), [64]);

    memory.noteOff(71);
    assert.deepEqual(memory.rememberedGroup(), [67, 71]);
});

test("the newest completed group replaces the previous group", async () => {
    const memory = await makeMemory();

    memory.noteOn(60, true);
    memory.noteOn(64, true);
    memory.noteOff(60);
    memory.noteOff(64);
    memory.noteOn(72, true);
    memory.noteOff(72);

    assert.deepEqual(memory.rememberedGroup(), [72]);
});

test("a duplicate note-off does not change the remembered group", async () => {
    const memory = await makeMemory();

    memory.noteOn(64, true);
    memory.noteOff(64);
    memory.noteOff(64);

    assert.deepEqual(memory.rememberedGroup(), [64]);
});

test("a pitch re-pressed inside one overlap group is remembered once", async () => {
    const memory = await makeMemory();

    memory.noteOn(60, true);
    memory.noteOn(64, true);
    memory.noteOff(60);
    memory.noteOn(60, true);
    memory.noteOff(60);
    memory.noteOff(64);

    assert.deepEqual(memory.rememberedGroup(), [60, 64]);
});

test("a replay-only group leaves the remembered group unchanged", async () => {
    const memory = await makeMemory();

    memory.noteOn(72, false);
    memory.noteOff(72);

    assert.deepEqual(memory.rememberedGroup(), [60]);
});

test("replays extend group boundaries without entering the remembered group", async () => {
    const memory = await makeMemory();

    memory.noteOn(72, false);
    memory.noteOn(64, true);
    memory.noteOff(64);
    assert.deepEqual(memory.rememberedGroup(), [60]);

    memory.noteOff(72);
    assert.deepEqual(memory.rememberedGroup(), [64]);
});
