import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const APPROVED_ASSETS = [
    ["mseg-face.png", "225e27d468cdbd2c342d0e80c41a45b72c16c2991bd46cd47ecb2be79554d804"],
    ["envelope-face.png", "54bf7d2f16ac59adfb0cd6d6a33e33c497a1a27c2c5b642992b47699c6306ba3"],
    ["macro-face.png", "6e74161dd8c1b906a79bd1cd69c7b95781867d678c724281f4499ace715b753d"],
];

test("shipped modulation faces remain byte-identical to the approved Variant D artwork", async () => {
    for (const [filename, expectedDigest] of APPROVED_ASSETS) {
        const data = await readFile(new URL(`../ui/assets/modulation-sources/approved-generated/${filename}`, import.meta.url));
        const digest = createHash("sha256").update(data).digest("hex");
        assert.equal(digest, expectedDigest, `${filename} must not be redrawn or mechanically approximated`);
    }
});
