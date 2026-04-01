import path from "node:path";
import { fileURLToPath } from "node:url";

import { build, loadConfigFromFile } from "vite";

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));

async function runBuild(configRelativePath) {
    const configFile = path.resolve(thisDirectory, configRelativePath);
    const loadedConfig = await loadConfigFromFile(
        { command: "build", mode: "production" },
        configFile,
    );

    if (!loadedConfig) {
        throw new Error(`Could not load Vite config ${configFile}`);
    }

    await build(loadedConfig.config);
}

await runBuild("./vite.desktop.config.mjs");
await runBuild("./vite.worker.config.mjs");
