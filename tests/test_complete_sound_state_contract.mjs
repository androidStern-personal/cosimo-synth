import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("the shared native complete-sound contract is T78 and requires all 40 trims", async (context) => {
    const [contractSource, trim] = await Promise.all([
        fs.readFile(path.join(repoRoot, "native/CompleteSoundState.h"), "utf8"),
        loadUIModule(repoRoot, "ui/shared/effect-output-trim.ts"),
    ]);
    const nativeEndpointIDs = [...contractSource.matchAll(
        /"(lane[A-Za-z]+[1-5]OutputTrimDb)"/g,
    )].map((match) => match[1]);
    assert.deepEqual(nativeEndpointIDs, trim.allEffectOutputTrimHostEndpointIDs(),
        "native complete-sound intake must require the exact UI/host trim bank");

    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-t78-state-"));
    context.after(async () => fs.rm(temporaryDirectory, { recursive: true, force: true }));
    const binaryPath = path.join(temporaryDirectory, "complete-sound-state-contract");

    execFileSync("c++", [
        "-std=c++17",
        "-I", repoRoot,
        path.join(repoRoot, "tests/native/CompleteSoundStateContract.cpp"),
        "-o", binaryPath,
    ], { stdio: "pipe" });
    execFileSync(binaryPath, [], { stdio: "pipe" });
});

test("desktop and iOS reject incomplete native chunks before any restore mutation", async () => {
    const [desktop, ios] = await Promise.all([
        fs.readFile(path.join(repoRoot, "tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp"), "utf8"),
        fs.readFile(path.join(repoRoot, "ios_auv3/Source/CosimoCmajorPlugin.h"), "utf8"),
    ]);

    for (const source of [desktop, ios]) {
        assert.match(source, /native\/CompleteSoundState\.h/);
        assert.match(source, /cosimo::complete_sound::version/);
        assert.match(source, /isCurrentT78CompleteSoundState/);
        assert.match(source, /version == nullptr \|\| \(! version->isInt\(\) && ! version->isInt64\(\)\)/);
    }

    assert.ok(
        desktop.indexOf("isCurrentCompleteSoundState (restoredState)")
            < desktop.indexOf("lastLoadedStateHash != stateHash"),
    );
    assert.ok(
        desktop.indexOf("isCurrentCompleteSoundState (restoredState)")
            < desktop.indexOf("setFixedStateSynchronously (restoredState)"),
    );
    assert.ok(
        ios.indexOf("isCurrentCompleteSoundState (restoredState)")
            < ios.indexOf("lastLoadedStateHash != stateHash"),
    );
    const iosRestore = ios.slice(ios.indexOf("void setNewState (const juce::ValueTree& newState)"));
    assert.ok(iosRestore.indexOf("isCurrentCompleteSoundState (newState)")
        < iosRestore.indexOf("readParametersFromState (loadParams, newState)"));
    assert.ok(iosRestore.indexOf("isCurrentCompleteSoundState (newState)")
        < iosRestore.indexOf("patch->setStoredStateValue"));
});
