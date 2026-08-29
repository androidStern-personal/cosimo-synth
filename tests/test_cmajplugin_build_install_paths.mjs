import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");

test("CmajPlugin build and dry-run install share the wrapper artifact path", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-cmajplugin-path-"));
    const buildDirectory = path.join(tempRoot, "build");
    const bundlePath = path.join(
        buildDirectory,
        "cmajplugin",
        "CmajPlugin_artefacts",
        "Release",
        "VST3",
        "CmajPlugin.vst3",
    );
    const binaryPath = path.join(bundlePath, "Contents", "MacOS", "CmajPlugin");

    try {
        await mkdir(path.dirname(binaryPath), { recursive: true });
        await writeFile(binaryPath, [
            "chocHostKeyboard",
            "__chocHostKeyboardBridgeInstalled",
            "__chocUserFiles",
            "chocUserFiles",
        ].join("\n"));

        const { stdout } = await execFileAsync(
            path.join(repoRoot, "scripts", "install_cmajplugin_vst3.sh"),
            ["--dry-run"],
            {
                cwd: repoRoot,
                env: {
                    ...process.env,
                    CMAJPLUGIN_BUILD_DIR: buildDirectory,
                    HOME: tempRoot,
                },
            },
        );

        assert.match(stdout, new RegExp(`Validated patched CmajPlugin VST3: ${bundlePath}`));
        assert.match(stdout, /Would install to:/u);

        const buildScript = await readFile(path.join(repoRoot, "scripts", "build_cmajplugin_vst3.sh"), "utf8");
        const installScript = await readFile(path.join(repoRoot, "scripts", "install_cmajplugin_vst3.sh"), "utf8");
        assert.match(buildScript, /cmajplugin_paths\.sh/u);
        assert.match(installScript, /cmajplugin_paths\.sh/u);
        assert.doesNotMatch(buildScript, /CmajPlugin_artefacts/u);
        assert.doesNotMatch(installScript, /CmajPlugin_artefacts/u);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});
