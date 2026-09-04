// The post-bootstrap boundary. The Bash installer has already verified the
// release commit and provisioned its private runtime before invoking this file.
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runSetup } from "./setup.mjs";
import { collectDoctorReport } from "./doctor.mjs";
import { readFeedBaseUrl, readToolchain, repoRoot } from "./toolchain.mjs";
import { redact, reveal } from "./redacted.mjs";

const failure = (code) => ({ ok: false, error: { code } });

function doctorFailure(report) {
    const details = [];
    const safeVersion = (text) => typeof text === "string" && /^[0-9><=~^.* |x-]+$/u.test(text) ? text : "the required version";
    if (report.platform.osOk === false || report.platform.archOk === false || report.platform.macOSOk === false) details.push("Requires macOS 15 or newer on Apple silicon.");
    for (const name of ["node", "cmake", "git"]) {
        const tool = report.tools[name];
        if (!tool.present) details.push(`${name} is missing from the project runtime PATH.`);
        else if (!tool.ok) details.push(`${name} ${safeVersion(tool.version)} does not satisfy ${safeVersion(tool.required)}.`);
    }
    if (!report.tools.xcodeCommandLineTools.ok) details.push("Apple Command Line Tools must be installed and their agreements accepted by you.");
    for (const key of ["cmaj", "cmajPlugin"]) {
        const status = report.toolchain[key]?.status;
        if (["missing", "stale", "unpinned"].includes(status)) details.push(`${key} is ${status}; its verified setup artifact is required.`);
    }
    if (!report.feed.configured) details.push("The kit download feed is not configured.");
    else if (report.feed.checked && !report.feed.reachable) details.push(Number.isInteger(report.feed.status) ? `The kit feed returned HTTP ${report.feed.status}. Check access and connectivity.` : "The kit feed could not be reached. Check connectivity.");
    if (!report.registry.ok) details.push("Plugin discovery failed; inspect the project's patch manifests and plugin configurations.");
    if (!report.nodeModules.present) details.push("npm dependencies are missing.");
    if (details.length === 0) details.push("A kit configuration check failed; ask your coding agent to inspect kit:doctor.");
    return { ok: false, error: { code: "final-checks", details } };
}

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
            if (metadata.isSymbolicLink() || (kind === "directory" ? !metadata.isDirectory() : !metadata.isFile() || metadata.nlink !== 1)) return false;
        } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    // setup writes acknowledgment, receipt and download files at this level;
    // package-internal links and existing bundle contents remain untouched.
    let entries = [];
    try { entries = await readdir(path.join(root, "build/kit-tools")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    for (const entry of entries) {
        const metadata = await lstat(path.join(root, "build/kit-tools", entry));
        if (metadata.isSymbolicLink() || (!metadata.isFile() && !metadata.isDirectory())
            || (metadata.isFile() && metadata.nlink !== 1)) return false;
    }
    return true;
}

/** Run the existing setup/check contracts without trusting a partial node_modules. */
export async function completeInstallation({ root = repoRoot, log = console.log } = {}) {
    const env = process.env;
    const expectedFeed = redact(env.BUILDER_KIT_EXPECTED_FEED ?? "");
    if (reveal(expectedFeed) === "" || !/^[0-9a-f]{64}$/u.test(env.BUILDER_KIT_EXPECTED_CMAJ_SHA256 ?? "")
        || !/^[0-9a-f]{64}$/u.test(env.BUILDER_KIT_EXPECTED_PLUGIN_SHA256 ?? "")) return failure("missing-delivery-pins");
    let stage = "release-contract";
    try {
        const toolchain = readToolchain(path.join(root, "kit/toolchain.json"));
        if (reveal(readFeedBaseUrl(path.join(root, "kit/feed.json"))) !== reveal(expectedFeed)
            || toolchain.cmaj.sha256 !== env.BUILDER_KIT_EXPECTED_CMAJ_SHA256
            || toolchain.cmajPlugin.sha256 !== env.BUILDER_KIT_EXPECTED_PLUGIN_SHA256) return failure("release-contract");
        if (!await writableSetupPathsAreLocal(root)) return {
            ok: false, error: { code: "unsafe-setup-path", details: ["A setup/npm output path is linked or has an unexpected type. It was preserved; inspect the project before retrying."] },
        };

        const npm = (args) => spawnSync("npm", args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
        let installedDependencies = false;
        const installDependencies = () => {
            log("Builder Kit: installing npm dependencies");
            const result = npm(["install"]);
            if (result.error || result.status !== 0) throw new Error("npm-install-failed");
            installedDependencies = true;
        };
        stage = "setup";
        await runSetup({ root, acceptJuceTerms: true, runNpmInstall: installDependencies, log: () => {} });
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
        if (!doctor.ok) return doctorFailure(doctor);
        log("Builder Kit: setup and strict environment checks passed");
        return { ok: true };
    } catch {
        // Existing setup/npm/Git errors can include child-process output. Do
        // not propagate it across this credential-bearing delivery boundary.
        return failure(stage);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.length !== 3 || process.argv[2] !== "--accept-juce-terms") {
        console.error("Explicit --accept-juce-terms acknowledgment is required.");
        process.exitCode = 1;
    } else {
        const result = await completeInstallation();
        if (!result.ok) {
            for (const detail of result.error.details ?? []) console.error(detail);
            console.error(`Builder Kit installation stopped at ${result.error.code}. Your project was preserved; retry the supplied command or ask your coding agent to inspect this stage.`);
            process.exitCode = 1;
        }
    }
}
