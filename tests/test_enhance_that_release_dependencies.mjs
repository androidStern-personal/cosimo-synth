import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enhanceThatNativeDependencies } from "../scripts/enhance-that-release-config.mjs";
import { seqFxReleaseConfig } from "../scripts/seqfx-release-config.mjs";
import { readDeclaredNativeDependencyProvenance } from "../scripts/build_seqfx_beta_release.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = { nativeDependencies: enhanceThatNativeDependencies };
const proposedCommit = "2fc4c2dce2a1b625c1578409e10bf312a5ac39b5";
const oldCommit = "7820a453f25e1b6eaf898d0bb2feb7e4ce01c207";

async function scratch(context) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "enhance-that-dependencies-"));
    context.after(() => rm(directory, { recursive: true, force: true }));
    return directory;
}

test("production SDK, tool producer and customer tool contract share the proposed pin", async () => {
    const production = await readDeclaredNativeDependencyProvenance(config);
    const tools = await readDeclaredNativeDependencyProvenance({ nativeDependencies: {
        ...enhanceThatNativeDependencies,
        cmajor: { ...enhanceThatNativeDependencies.cmajor, cpmName: "cosimo_cmajor_toolchain" },
    } });
    const toolchain = JSON.parse(await readFile(path.join(root, "kit/toolchain.json"), "utf8"));
    assert.equal(production.cmajor.revision, proposedCommit);
    assert.equal(tools.cmajor.revision, proposedCommit);
    assert.equal(toolchain.cmaj.forkCommit, proposedCommit);
    await assert.rejects(readDeclaredNativeDependencyProvenance(seqFxReleaseConfig),
        /Cmajor production dependency revision drift/u);
});

for (const [name, change, error] of [
    ["old Cmajor pin", text => text.replaceAll(proposedCommit, oldCommit), /Cmajor production dependency revision drift/u],
    ["wrong Cmajor repository", text => text.replaceAll("${COSIMO_CMAJOR_GIT_URL}", "https://example.invalid/wrong.git"), /Cmajor production dependency repository drift/u],
    ["wrong JUCE pin", text => text.replaceAll(enhanceThatNativeDependencies.juce.revision, "0".repeat(40)), /JUCE production dependency revision drift/u],
    ["missing production declaration", text => text.replace("NAME cosimo_cmajor\n", "NAME wrong_package\n"), /exactly one CPMAddPackage declaration/u],
]) {
    test(`Enhance That refuses ${name}`, async context => {
        const repositoryRoot = await scratch(context);
        const declaration = enhanceThatNativeDependencies.declarationPath;
        await mkdir(path.dirname(path.join(repositoryRoot, declaration)), { recursive: true });
        await writeFile(path.join(repositoryRoot, declaration), change(await readFile(path.join(root, declaration), "utf8")));
        const sources = "kit/cmake/dependency-sources.cmake";
        await writeFile(path.join(repositoryRoot, sources), await readFile(path.join(root, sources)));
        await assert.rejects(readDeclaredNativeDependencyProvenance(config, { repositoryRoot }), error);
    });
}
