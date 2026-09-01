import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");
const captureScript = path.join(repoRoot, "scripts", "capture_plugin_visual_review.mjs");
const expectedCaptures = [
    { file: "wide.png", width: 1440, height: 800 },
    { file: "medium.png", width: 1060, height: 820 },
    { file: "narrow.png", width: 420, height: 640 },
];

function readPngDimensions(bytes) {
    assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("plugin visual review is adapter-gated and captures representative SeqFX at three sizes", async () => {
    const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "cosimo-plugin-visual-review-"));

    try {
        await assert.rejects(
            execFileAsync(process.execPath, [captureScript, "not-a-plugin", outputDirectory], { cwd: repoRoot }),
            (error) => {
                assert.equal(error.code, 1);
                assert.match(error.stderr, /Unknown plugin target "not-a-plugin"/);
                assert.match(error.stderr, /Supported visual-review targets: seqfx/);
                return true;
            },
        );
        await assert.rejects(
            execFileAsync(process.execPath, [captureScript, "chorus", outputDirectory], { cwd: repoRoot }),
            (error) => {
                assert.equal(error.code, 1);
                assert.match(error.stderr, /chorus.*no representative browser-review adapter/);
                assert.match(error.stderr, /Supported visual-review targets: seqfx/);
                return true;
            },
        );

        const { stdout } = await execFileAsync(
            process.execPath,
            [captureScript, "seqfx", outputDirectory],
            { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 },
        );

        assert.deepEqual((await readdir(outputDirectory)).sort(), expectedCaptures.map(({ file }) => file).sort());
        for (const expected of expectedCaptures) {
            const filePath = path.join(outputDirectory, expected.file);
            const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            assert.match(stdout, new RegExp(`${escapedPath}(?:\\n|$)`));
            assert.deepEqual(readPngDimensions(await readFile(filePath)), {
                width: expected.width,
                height: expected.height,
            });
        }
    } finally {
        await rm(outputDirectory, { recursive: true, force: true });
    }
});
