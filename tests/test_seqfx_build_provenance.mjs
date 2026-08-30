import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runtimeRoot = path.join(repoRoot, "build", "fx", "seqfx_runtime");

const artifactContracts = [
    {
        label: "SeqFX app",
        bundlePath: path.join(runtimeRoot, "view", "app.js"),
        expectedOwnedSources: [
            "fx/seqfx/view/source.tsx",
            "fx/seqfx/view/SeqFxPatchView.tsx",
        ],
        requiresDependencySources: true,
    },
    {
        label: "SeqFX worker",
        bundlePath: path.join(runtimeRoot, "worker.js"),
        expectedOwnedSources: [
            "fx/seqfx/worker/source.ts",
            "fx/seqfx/worker/seqfx-worker-service.ts",
            "ui/shared/patch-worker-services.ts",
        ],
        requiresDependencySources: false,
    },
];

function isInside(parentPath, candidatePath) {
    const relativePath = path.relative(parentPath, candidatePath);
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function sourceFilePath(mapPath, source) {
    const pathname = source.replace(/[?#].*$/, "");
    return path.resolve(path.dirname(mapPath), pathname);
}

function assertRelativeCheckoutProvenance(source, label) {
    assert.equal(path.isAbsolute(source), false, `${label} must use relative source paths: ${source}`);
    assert.doesNotMatch(
        source,
        /(?:^|[/\\])\.codex[/\\]worktrees(?:[/\\]|$)/,
        `${label} must not encode a Codex worktree path: ${source}`,
    );
    assert.doesNotMatch(
        source,
        /(?:^|[/\\])src[/\\]cosimo-synth(?:[/\\]|$)/,
        `${label} must not encode a foreign Cosimo checkout: ${source}`,
    );
    assert.doesNotMatch(source, /^[/\\]Users[/\\]/, `${label} must not encode an absolute user path: ${source}`);
}

test("SeqFX production app and worker bundles retain checkout-local source provenance", async () => {
    for (const contract of artifactContracts) {
        const mapPath = `${contract.bundlePath}.map`;
        const [bundle, sourceMapText] = await Promise.all([
            readFile(contract.bundlePath, "utf8"),
            readFile(mapPath, "utf8"),
        ]);
        const sourceMap = JSON.parse(sourceMapText);
        const expectedMapName = path.basename(mapPath);

        assert.match(
            bundle,
            new RegExp(`(?:^|\\n)//# sourceMappingURL=${expectedMapName.replaceAll(".", "\\.")}\\s*$`),
            `${contract.label} bundle must reference its external source map`,
        );
        assert.equal(sourceMap.version, 3, `${contract.label} must emit a version 3 source map`);
        assert.equal(Array.isArray(sourceMap.sources), true, `${contract.label} map must list sources`);
        assert.equal(
            Array.isArray(sourceMap.sourcesContent),
            true,
            `${contract.label} map must retain source contents`,
        );
        assert.equal(
            sourceMap.sources.length,
            sourceMap.sourcesContent.length,
            `${contract.label} sources and sourcesContent must stay index-aligned`,
        );
        assert.equal(sourceMap.sources.length > 0, true, `${contract.label} map must not be empty`);

        if (sourceMap.sourceRoot !== undefined) {
            assertRelativeCheckoutProvenance(sourceMap.sourceRoot, `${contract.label} sourceRoot`);
        }

        const ownedSourcePaths = [];
        let dependencySourceCount = 0;

        for (const [sourceIndex, source] of sourceMap.sources.entries()) {
            const sourceContent = sourceMap.sourcesContent[sourceIndex];
            assert.equal(typeof source, "string", `${contract.label} source ${sourceIndex} must be a string`);
            assert.equal(source.length > 0, true, `${contract.label} source ${sourceIndex} must be named`);
            assert.equal(
                typeof sourceContent,
                "string",
                `${contract.label} source content ${sourceIndex} must align with its source`,
            );
            assert.equal(sourceContent.length > 0, true, `${contract.label} mapped source must not be empty: ${source}`);
            assertRelativeCheckoutProvenance(source, `${contract.label} source ${sourceIndex}`);

            const checkoutPath = sourceFilePath(mapPath, source);
            if (source.includes("node_modules/")) {
                dependencySourceCount += 1;
                assert.equal(
                    isInside(path.join(repoRoot, "node_modules"), checkoutPath),
                    true,
                    `${contract.label} dependency must resolve through this checkout: ${source}`,
                );
                const checkoutDependency = await readFile(checkoutPath, "utf8");
                if (!/[?#]/.test(source)) {
                    assert.equal(
                        sourceContent,
                        checkoutDependency,
                        `${contract.label} must embed the dependency reached through this checkout: ${source}`,
                    );
                }
                continue;
            }

            assert.equal(
                isInside(repoRoot, checkoutPath),
                true,
                `${contract.label} owned source must resolve inside this checkout: ${source}`,
            );
            const checkoutSource = await readFile(checkoutPath, "utf8");
            assert.equal(checkoutSource.length > 0, true, `${contract.label} owned source must not be empty: ${source}`);
            // Vite maps ?url and ?inline assets to generated module text; ordinary sources must remain byte-exact.
            if (!/[?#]/.test(source)) {
                assert.equal(
                    sourceContent,
                    checkoutSource,
                    `${contract.label} must embed the source from this checkout: ${source}`,
                );
            }
            ownedSourcePaths.push(path.relative(repoRoot, checkoutPath));
        }

        assert.equal(ownedSourcePaths.length > 0, true, `${contract.label} must retain owned source provenance`);
        for (const expectedSource of contract.expectedOwnedSources) {
            assert.equal(
                ownedSourcePaths.includes(expectedSource),
                true,
                `${contract.label} map must retain ${expectedSource}`,
            );
        }
        if (contract.requiresDependencySources) {
            assert.equal(
                dependencySourceCount > 0,
                true,
                `${contract.label} map must prove dependency resolution through this checkout`,
            );
        }
    }
});
