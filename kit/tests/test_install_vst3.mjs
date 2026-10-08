import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { installVST3Bundle } from "../scripts/install_vst3.mjs";

const patchedBinary = "chocHostKeyboard\n__chocHostKeyboardBridgeInstalled\n__chocUserFiles\nchocUserFiles\n";

async function writeBundle(bundle, binary) {
    const name = path.basename(bundle, ".vst3");
    await mkdir(path.join(bundle, "Contents/MacOS"), { recursive: true });
    await writeFile(path.join(bundle, "Contents/MacOS", name), binary);
}

async function withScratch(run) {
    const scratch = await mkdtemp(path.join(os.tmpdir(), "kit-install-vst3-"));
    // codesign exists only on macOS; this stand-in accepts every bundle.
    const codesign = path.join(scratch, "codesign");
    await writeFile(codesign, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    try {
        await run({ scratch, codesign, installDirectory: path.join(scratch, "VST3"), log: () => {} });
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}

test("install replaces the previous copy, leaves other plugins alone, and reports the installed path", async () => {
    await withScratch(async ({ scratch, codesign, installDirectory, log }) => {
        const bundle = path.join(scratch, "built/Tone.vst3");
        await writeBundle(bundle, `${patchedBinary}new build\n`);
        await writeBundle(path.join(installDirectory, "Tone.vst3"), `${patchedBinary}old build\n`);
        await writeBundle(path.join(installDirectory, "Other.vst3"), `${patchedBinary}another plugin\n`);

        const preview = await installVST3Bundle({ bundle, installDirectory, dryRun: true, codesign, log });
        assert.equal(preview, path.join(installDirectory, "Tone.vst3"));
        assert.match(await readFile(path.join(installDirectory, "Tone.vst3/Contents/MacOS/Tone"), "utf8"), /old build/u, "a dry run copies nothing");

        const lines = [];
        const installed = await installVST3Bundle({ bundle, installDirectory, codesign, log: (line) => lines.push(line) });
        assert.equal(installed, path.join(installDirectory, "Tone.vst3"));
        assert.match(await readFile(path.join(installed, "Contents/MacOS/Tone"), "utf8"), /new build/u);
        assert.match(await readFile(path.join(installDirectory, "Other.vst3/Contents/MacOS/Other"), "utf8"), /another plugin/u);
        assert.equal(existsSync(path.join(installDirectory, ".Tone.vst3.installing")), false);
        assert.deepEqual(lines, [`Installed Tone.vst3: ${installed}`]);
    });
});

test("a bundle without the patched CHOC WebView is refused before anything is copied", async () => {
    await withScratch(async ({ scratch, codesign, installDirectory, log }) => {
        const bundle = path.join(scratch, "built/Tone.vst3");
        await writeBundle(bundle, "an unpatched build\n");
        await writeBundle(path.join(installDirectory, "Tone.vst3"), `${patchedBinary}old build\n`);

        await assert.rejects(installVST3Bundle({ bundle, installDirectory, codesign, log }), /patched CHOC WebView/u);
        assert.match(await readFile(path.join(installDirectory, "Tone.vst3/Contents/MacOS/Tone"), "utf8"), /old build/u);
    });
});

test("a bundle whose signature does not verify is refused", async () => {
    await withScratch(async ({ scratch, installDirectory, log }) => {
        const bundle = path.join(scratch, "built/Tone.vst3");
        const rejectingCodesign = path.join(scratch, "codesign-rejects");
        await writeFile(rejectingCodesign, "#!/bin/sh\necho 'invalid signature' >&2\nexit 1\n", { mode: 0o755 });
        await writeBundle(bundle, patchedBinary);

        await assert.rejects(installVST3Bundle({ bundle, installDirectory, codesign: rejectingCodesign, log }), /invalid signature/u);
        assert.equal(existsSync(path.join(installDirectory, "Tone.vst3")), false);
    });
});
