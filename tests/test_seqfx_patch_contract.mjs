import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("SeqFX exposes named stereo host buses", async () => {
    const source = await readFile(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"), "utf8");
    assert.match(source, /input stream float32<2> audioIn \[\[ name: "Input" \]\]/);
    assert.match(source, /output stream float32<2> audioOut \[\[ name: "Output" \]\]/);
});

