import fs from "node:fs/promises";
import path from "node:path";

const buildOnlyRelativePaths = Object.freeze([
    "README.md",
    path.join("assets", "factory-table-catalog.json"),
    path.join("assets", "incoming"),
]);

async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch (cause) {
        if (cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT") {
            return false;
        }
        throw cause;
    }
}

async function findSourceMaps(rootDirectory) {
    const sourceMaps = [];
    const pendingDirectories = [rootDirectory];

    while (pendingDirectories.length > 0) {
        const directory = pendingDirectories.pop();
        if (directory === undefined) {
            continue;
        }

        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                pendingDirectories.push(entryPath);
            } else if (entry.isFile() && entry.name.endsWith(".map")) {
                sourceMaps.push(entryPath);
            }
        }
    }

    return sourceMaps;
}

/**
 * Reports build inputs and debugging artifacts that must not be published by Sites.
 *
 * @param {string} assetsDirectory Root of the public asset tree.
 * @returns {Promise<ReadonlyArray<string>>} Sorted paths relative to the public asset root.
 */
export async function findPublicAssetPolicyViolations(assetsDirectory) {
    const violations = [];

    for (const relativePath of buildOnlyRelativePaths) {
        if (await pathExists(path.join(assetsDirectory, relativePath))) {
            violations.push(relativePath);
        }
    }

    for (const sourceMap of await findSourceMaps(assetsDirectory)) {
        violations.push(path.relative(assetsDirectory, sourceMap));
    }

    return violations.sort();
}

/**
 * Removes non-runtime files from a completed public asset tree.
 *
 * @param {string} assetsDirectory Root of the public asset tree.
 * @returns {Promise<void>}
 */
export async function enforcePublicAssetPolicy(assetsDirectory) {
    const sourceMaps = await findSourceMaps(assetsDirectory);
    await Promise.all([
        ...buildOnlyRelativePaths.map((relativePath) => (
            fs.rm(path.join(assetsDirectory, relativePath), { recursive: true, force: true })
        )),
        ...sourceMaps.map((sourceMap) => fs.rm(sourceMap, { force: true })),
    ]);

    const violations = await findPublicAssetPolicyViolations(assetsDirectory);
    if (violations.length > 0) {
        throw new Error(`Public bundle still contains build-only artifacts: ${violations.join(", ")}`);
    }
}
