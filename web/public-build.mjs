import fs from "node:fs/promises";
import path from "node:path";
import { enforcePublicAssetPolicy } from "./public-asset-policy.mjs";

const sitesDefaultTableName = "Core Shapes";

async function curateFactoryBank(webBuildDirectory, assetsDirectory) {
    const catalogPath = path.join(webBuildDirectory, "assets", "factory-bank-catalog.json");
    const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
    const defaultTableIndex = catalog.tables.findIndex((table) => table.name === sitesDefaultTableName);

    if (defaultTableIndex < 0) {
        throw new Error(`Could not find the Sites default wavetable: ${sitesDefaultTableName}.`);
    }

    const tables = catalog.tables.slice(0, defaultTableIndex + 1);
    const targetFactorySources = path.join(assetsDirectory, "assets", "factory_sources");
    await fs.rm(targetFactorySources, { recursive: true, force: true });

    for (const table of tables) {
        const sourceWav = table.sourceWav;

        if (typeof sourceWav !== "string" || !sourceWav.startsWith("assets/factory_sources/")) {
            throw new Error(`Invalid factory wavetable path for ${table.name ?? "unnamed table"}.`);
        }

        const sourcePath = path.resolve(webBuildDirectory, sourceWav);
        const targetPath = path.resolve(assetsDirectory, sourceWav);

        if (!sourcePath.startsWith(`${webBuildDirectory}${path.sep}`) || !targetPath.startsWith(`${assetsDirectory}${path.sep}`)) {
            throw new Error(`Factory wavetable path escaped the build directory: ${sourceWav}.`);
        }

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(sourcePath, targetPath);
    }

    await fs.writeFile(
        path.join(assetsDirectory, "assets", "factory-bank-catalog.json"),
        `${JSON.stringify({ tables }, null, 2)}\n`,
    );
}

/** Package the same approved public bank and runtime assets for either host. */
export async function preparePublicWebAssets(webBuildDirectory, assetsDirectory) {
    await fs.cp(webBuildDirectory, assetsDirectory, { recursive: true });
    await curateFactoryBank(webBuildDirectory, assetsDirectory);
    await enforcePublicAssetPolicy(assetsDirectory);
}
