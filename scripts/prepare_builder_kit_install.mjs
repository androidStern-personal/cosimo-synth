// Produces private customer delivery files; never prints the populated line.
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReleaseDestination, readCapabilityFromKeychain, readDestinationConfig } from "./release_builder_kit.mjs";
import { renderInstallation } from "./builder-kit-install.mjs";
import { reveal } from "../kit/scripts/redacted.mjs";

async function outsideGit(outputDir) {
    let directory = path.resolve(outputDir);
    for (;;) {
        try { directory = await realpath(directory); break; }
        catch (error) {
            if (error.code !== "ENOENT") throw error;
            directory = path.dirname(directory);
        }
    }
    for (;;) {
        try { await lstat(path.join(directory, ".git")); return false; }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        const parent = path.dirname(directory);
        if (parent === directory) return true;
        directory = parent;
    }
}

export async function prepareInstallation({ manifest, destinationConfig, capability, projectDir, outputDir, installerOrigin, kitOrigin, runtimes }) {
    const rendered = await renderInstallation({
        manifest, feedOrigin: reveal(destinationConfig.feedOrigin), capability, projectDir, installerOrigin, kitOrigin, runtimes,
    });
    if (!rendered.ok) return rendered;
    try {
        if (!await outsideGit(outputDir)) return { ok: false, error: { code: "private-delivery-must-be-outside-git" } };
        // A fresh private output folder avoids overwriting another delivery.
        await mkdir(outputDir, { mode: 0o700 });
        const { artifact, script, command, delivery, sha256 } = rendered.value;
        await mkdir(path.join(outputDir, "feed/installers"), { recursive: true, mode: 0o700 });
        await writeFile(path.join(outputDir, "feed", artifact), script, { mode: 0o600, flag: "wx" });
        await writeFile(path.join(outputDir, "command.sh"), `${reveal(command)}\n`, { mode: 0o600, flag: "wx" });
        await writeFile(path.join(outputDir, "delivery.txt"), reveal(delivery), { mode: 0o600, flag: "wx" });
        return { ok: true, value: { outputDir, artifact, sha256 } };
    } catch { return { ok: false, error: { code: "delivery-output-failed" } }; }
}

const usage = "Usage: node scripts/prepare_builder_kit_install.mjs --manifest <release manifest> --destination-config <non-secret config> --project-dir <absolute customer folder> --output-dir <new private folder> [--installer-origin <HTTPS or loopback origin>] [--kit-origin <HTTPS or loopback origin>]";
async function main() {
    const options = {};
    const flags = new Map([
        ["--manifest", "manifest"], ["--destination-config", "destinationConfig"], ["--project-dir", "projectDir"],
        ["--output-dir", "outputDir"], ["--installer-origin", "installerOrigin"], ["--kit-origin", "kitOrigin"],
    ]);
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 2) {
        const key = flags.get(args[index]);
        if (!key || options[key] !== undefined || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(usage);
        options[key] = args[index + 1];
    }
    if (!["manifest", "destinationConfig", "projectDir", "outputDir"].every((key) => options[key])) throw new Error(usage);
    const destinationConfig = await readDestinationConfig(options.destinationConfig);
    const capability = readCapabilityFromKeychain({ service: destinationConfig.keychainService });
    createReleaseDestination(destinationConfig, capability);
    const manifest = JSON.parse(await readFile(options.manifest, "utf8"));
    const result = await prepareInstallation({ ...options, outputDir: path.resolve(options.outputDir), destinationConfig, capability, manifest });
    if (!result.ok) throw new Error(`Delivery preparation failed: ${result.error.code}.`);
    console.log(`Private customer delivery written to ${result.value.outputDir}`);
    console.log(`Installer SHA-256: ${result.value.sha256}`);
    console.log("No installer or release was published. Deliver command.sh or delivery.txt privately; never commit or log their contents.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { await main(); }
    catch { console.error(`Could not prepare the private Builder Kit installation delivery. ${usage}`); process.exitCode = 1; }
}
