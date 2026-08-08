import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { enforcePublicAssetPolicy } from "./public-asset-policy.mjs";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDirectory, "..");
const webBuildDirectory = path.join(repoRoot, "build", "web");
const distDirectory = path.join(repoRoot, "dist");
const sitesDefaultTableName = "PWM MedicineHat";

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`);
    }
}

async function curateFactoryBank(assetsDirectory) {
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

await fs.rm(distDirectory, { recursive: true, force: true });
run("npm", ["run", "web:build"]);
await fs.mkdir(path.join(distDirectory, "server"), { recursive: true });
const assetsDirectory = path.join(distDirectory, "assets");
await fs.cp(webBuildDirectory, assetsDirectory, { recursive: true });
await curateFactoryBank(assetsDirectory);
await enforcePublicAssetPolicy(assetsDirectory);
await fs.writeFile(
    path.join(distDirectory, "server", "index.js"),
    `const worker = {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/" || url.pathname === "/favicon.ico") {
            url.pathname = url.pathname === "/" ? "/index.html" : "/favicon.svg";
            return env.ASSETS.fetch(new Request(url, request));
        }
        return env.ASSETS.fetch(request);
    },
};

export default worker;
`,
);

console.log(`Cosimo Sites bundle built at ${distDirectory}`);
