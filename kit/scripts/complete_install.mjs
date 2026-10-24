// The post-bootstrap boundary. The Bash installer has already verified the
// release commit and provisioned its private runtime before invoking this file.
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { isMainModule } from "./common.mjs";
import { collectDoctorReport } from "./doctor.mjs";
import { runSetup } from "./setup.mjs";
import { readFeedBaseUrl, readToolchain, repoRoot } from "./toolchain.mjs";

const failure = (code) => ({ ok: false, error: { code } });

/** A stage's own error for the customer. This process holds the access credential, so it is removed from the text. */
function stageFailure(stage, error, secrets) {
    let message = error instanceof Error ? error.message : String(error);
    for (const secret of secrets.filter(Boolean))
        message = message.replaceAll(secret, "<access credential>");
    return { ok: false, error: { code: stage, details: [message] } };
}

/** Identifies the dependency inputs a completed npm install was made from. */
async function dependencyFingerprint(root) {
    const hash = createHash("sha256");
    for (const name of ["package.json", "package-lock.json"]) {
        hash.update(name);
        try { hash.update(await readFile(path.join(root, name))); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    return hash.digest("hex");
}

async function writableSetupPathsAreLocal(root) {
    const paths = [
        ["build", "directory"], ["build/kit-tools", "directory"], ["node_modules", "directory"],
        ["package.json", "file"], ["package-lock.json", "file"], ["npm-shrinkwrap.json", "file"], ["yarn.lock", "file"],
        ["node_modules/.package-lock.json", "file"], [".builder-kit-install/npm-ready", "file"],
    ];
    for (const [relative, kind] of paths) {
        try {
            const metadata = await lstat(path.join(root, relative));
            if (metadata.isSymbolicLink() || (kind === "directory" ? !metadata.isDirectory() : !metadata.isFile())) return false;
        } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    // setup writes acknowledgment, receipt and download files at this level;
    // package-internal links and existing bundle contents remain untouched.
    let entries = [];
    try { entries = await readdir(path.join(root, "build/kit-tools")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    for (const entry of entries) {
        const metadata = await lstat(path.join(root, "build/kit-tools", entry));
        if (metadata.isSymbolicLink() || (!metadata.isFile() && !metadata.isDirectory())) return false;
    }
    return true;
}

/** Run the existing setup/check contracts without trusting a partial node_modules. */
export async function completeInstallation({ root = repoRoot, log = console.log, acceptJuceTerms = false } = {}) {
    if (!acceptJuceTerms)
        return failure("juce-acknowledgment-required");

    const env = process.env;
    const expectedFeed = env.BUILDER_KIT_EXPECTED_FEED ?? "";
    if (expectedFeed === "" || !/^[0-9a-f]{64}$/u.test(env.BUILDER_KIT_EXPECTED_CMAJ_SHA256 ?? "")
        || !/^[0-9a-f]{64}$/u.test(env.BUILDER_KIT_EXPECTED_PLUGIN_SHA256 ?? "")) return failure("missing-delivery-pins");
    let stage = "release-contract";
    try {
        const toolchain = readToolchain(path.join(root, "kit/toolchain.json"));
        if (readFeedBaseUrl(path.join(root, "kit/feed.json")) !== expectedFeed
            || toolchain.cmaj.sha256 !== env.BUILDER_KIT_EXPECTED_CMAJ_SHA256
            || toolchain.cmajPlugin.sha256 !== env.BUILDER_KIT_EXPECTED_PLUGIN_SHA256) return failure("release-contract");
        if (!await writableSetupPathsAreLocal(root)) return {
            ok: false, error: { code: "unsafe-setup-path", details: ["A setup/npm output path is linked or has an unexpected type. It was preserved; inspect the project before retrying."] },
        };

        // Keep delivery access out of npm lifecycle children. Also prevent an
        // inherited cache case variant from redirecting writes outside the
        // cache whose containing directory the installer has admitted.
        const npmEnv = Object.fromEntries(Object.entries(env).filter(([key]) => {
            const normalized = key.toUpperCase();
            return key.toLowerCase() !== "npm_config_cache"
                && normalized !== "BUILDER_KIT_ACCESS" && normalized !== "BUILDER_KIT_EXPECTED_FEED";
        }));
        npmEnv.npm_config_cache = path.join(root, ".builder-kit-install/npm-cache");
        const npm = (args) => spawnSync("npm", args, { cwd: root, env: npmEnv, stdio: ["ignore", "pipe", "pipe"] });
        let installedDependencies = false;
        const installDependencies = () => {
            log("Builder Kit: installing npm dependencies");
            const result = npm(["ci", "--no-audit", "--no-fund"]);
            if (result.error || result.status !== 0)
                throw new Error("npm ci failed. Source .builder-kit-install/env.sh, then run npm ci in the project folder to see npm's own output.");
            installedDependencies = true;
        };
        stage = "setup";
        await runSetup({ root, acceptJuceTerms, runNpmInstall: installDependencies, log });
        stage = "npm-dependencies";
        const receipt = path.join(root, ".builder-kit-install/npm-ready");
        let previousFingerprint = "";
        try {
            const metadata = await lstat(receipt);
            if (!metadata.isFile() || metadata.isSymbolicLink()) return failure("npm-receipt-path");
            previousFingerprint = (await readFile(receipt, "utf8")).trim();
        }
        catch (error) { if (error.code !== "ENOENT") throw error; }
        // A failed npm lifecycle may leave a valid-looking module directory.
        // Only a completed install for these dependency inputs earns a receipt.
        if (!installedDependencies && (previousFingerprint !== await dependencyFingerprint(root)
            || npm(["ls", "--depth=0", "--omit=optional"]).status !== 0)) installDependencies();
        const check = npm(["ls", "--depth=0", "--omit=optional"]);
        if (check.error || check.status !== 0) return failure("npm-dependencies");
        const pendingReceipt = `${receipt}.pending`;
        await writeFile(pendingReceipt, `${await dependencyFingerprint(root)}\n`, { mode: 0o600, flag: "wx" });
        try { await rename(pendingReceipt, receipt); }
        finally { await rm(pendingReceipt, { force: true }); }

        stage = "final-checks";
        const doctor = await collectDoctorReport({ root });
        if (!doctor.ok) return { ok: false, error: { code: "final-checks", details: doctor.problems } };
        // A warning does not block the install, but the customer should see it, such as a feed outage.
        for (const warning of doctor.warnings) log(`Builder Kit: ${warning}`);
        log("Builder Kit: setup and strict environment checks passed");
        return { ok: true };
    } catch (error) {
        return stageFailure(stage, error, [expectedFeed, env.BUILDER_KIT_ACCESS]);
    }
}

if (isMainModule(import.meta.url)) {
    if (process.argv.length !== 3 || process.argv[2] !== "--accept-juce-terms") {
        console.error("Explicit --accept-juce-terms acknowledgment is required.");
        process.exitCode = 1;
    } else {
        const result = await completeInstallation({ acceptJuceTerms: true });
        if (!result.ok) {
            for (const detail of result.error.details ?? []) console.error(detail);
            console.error(`Builder Kit installation stopped at ${result.error.code}. Your project was preserved; retry the supplied command or ask your coding agent to inspect this stage.`);
            process.exitCode = 1;
        }
    }
}
