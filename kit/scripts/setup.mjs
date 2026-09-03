// kit:setup — idempotent customer-machine setup.
//
//   node kit/scripts/setup.mjs [--accept-juce-terms] [--dry-run] [--force]
//
// 1. Shows the JUCE licensing notice and requires either --accept-juce-terms
//    or an existing build/kit-tools/juce-terms-acknowledged.json (written on
//    acceptance with a timestamp).
// 2. Downloads the pinned cmaj and CmajPlugin.vst3 archives from
//    kit/feed.json baseUrl + kit/toolchain.json artifact path, verifies the
//    archive sha256 against the pin, extracts to localPath, chmod +x cmaj, and
//    writes an install receipt beside the tool. Already-current tools are
//    skipped. Nothing is downloaded without a pinned hash or a feed URL.
// 3. Runs npm install when node_modules is missing.
//
// --dry-run prints the plan and writes nothing (no acknowledgment either).

import { chmod, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    artifactUrl,
    feedPath,
    inspectTool,
    juceAcknowledgmentPath,
    juceNoticeLines,
    kitToolsDir,
    readFeedBaseUrl,
    readJuceAcknowledgment,
    readToolchain,
    repoRoot,
    sha256Bytes,
    toolchainPath,
    toolKeys,
    writeJuceAcknowledgment,
    writeReceipt,
} from "./toolchain.mjs";
import { ensureRedacted, redact, reveal } from "./redacted.mjs";

export function parseSetupArguments(argv) {
    const options = { acceptJuceTerms: false, dryRun: false, force: false };

    for (const argument of argv) {
        if (argument === "--accept-juce-terms") options.acceptJuceTerms = true;
        else if (argument === "--dry-run") options.dryRun = true;
        else if (argument === "--force") options.force = true;
        else throw new Error("Unknown kit:setup argument. Usage: kit:setup [--accept-juce-terms] [--dry-run] [--force]");
    }

    return options;
}

/**
 * Decide what setup would do, without touching the network or the disk.
 * Each tool step is one of: skip (current), download, refuse-unpinned,
 * refuse-no-feed. Refusals are reported as errors by runSetup before any
 * download starts.
 */
export async function planSetup({ root = repoRoot, force = false, acceptJuceTerms = false } = {}) {
    const toolchain = readToolchain(toolchainPath(root));
    const baseUrl = readFeedBaseUrl(feedPath(root));
    const acknowledgment = readJuceAcknowledgment(root);
    const tools = [];

    for (const key of toolKeys) {
        const inspection = await inspectTool(toolchain, key, { root });
        const step = { key, inspection, request: null, action: null, reason: null };

        if (inspection.status === "current" && !force) {
            step.action = "skip";
            step.reason = `already present and matches the pin (${inspection.matchedBy})`;
        } else if (inspection.pin === "") {
            step.action = "refuse-unpinned";
            step.reason = `kit/toolchain.json carries no sha256 for ${key}; refusing to download an unverifiable artifact. `
                + "Pins are written by kit:release, so an unpinned toolchain means an unreleased kit checkout.";
        } else if (reveal(baseUrl) === "") {
            step.action = "refuse-no-feed";
            step.reason = "kit/feed.json baseUrl is empty, so there is nowhere to download from. "
                + "The export stamps the feed URL; in the Cosimo monorepo cmaj is built from source instead.";
        } else {
            step.action = "download";
            step.request = redact(artifactUrl(reveal(baseUrl), inspection.artifact));
            step.reason = inspection.status === "missing"
                ? "missing"
                : force ? "--force" : `present but ${inspection.status}`;
        }

        tools.push(step);
    }

    return {
        root,
        feedConfigured: reveal(baseUrl) !== "",
        juce: {
            acknowledged: acknowledgment !== null,
            acknowledgedAt: acknowledgment?.acknowledgedAt ?? null,
            willAcknowledge: acknowledgment === null && acceptJuceTerms,
            path: juceAcknowledgmentPath(root),
        },
        tools,
        npmInstall: !existsSync(path.join(root, "node_modules")),
    };
}

export function formatSetupPlan(plan) {
    const lines = [];

    if (plan.juce.acknowledged)
        lines.push(`JUCE terms: acknowledged ${plan.juce.acknowledgedAt}`);
    else if (plan.juce.willAcknowledge)
        lines.push(`JUCE terms: will record acknowledgment in ${path.relative(plan.root, plan.juce.path)}`);
    else
        lines.push("JUCE terms: not acknowledged; pass --accept-juce-terms to continue");

    for (const step of plan.tools) {
        const target = path.relative(plan.root, step.inspection.localPath);

        switch (step.action) {
            case "skip":
                lines.push(`${step.key}: skip, ${step.reason} at ${target}`);
                break;
            case "download":
                lines.push(`${step.key}: download ${step.inspection.artifact} from the configured feed (${step.reason}), verify sha256 ${step.inspection.pin}, extract to ${target}`);
                break;
            default:
                lines.push(`${step.key}: REFUSE - ${step.reason}`);
        }
    }

    lines.push(plan.npmInstall ? "npm install: node_modules is missing, will run" : "npm install: skip, node_modules present");

    return lines.join("\n");
}

async function fetchBytes(request, artifact, fetchImpl) {
    let response;
    try {
        response = await fetchImpl(reveal(request), { redirect: "follow" });
    } catch {
        throw new Error(`Download failed for ${artifact}: feed request failed.`);
    }

    if (!response.ok)
        throw new Error(`Download failed for ${artifact}: feed responded HTTP ${response.status}.`);

    return Buffer.from(await response.arrayBuffer());
}

/** Download one archive and verify it against the pin before anything is written next to the tools. */
export async function downloadVerifiedArtifact(requestInput, pin, { artifact = "tool artifact", fetchImpl = globalThis.fetch, log = () => {} } = {}) {
    const request = ensureRedacted(requestInput);
    log(`Downloading ${artifact} from the configured feed.`);

    const bytes = await fetchBytes(request, artifact, fetchImpl);
    const actual = sha256Bytes(bytes);

    if (actual !== pin) {
        throw new Error(
            `sha256 mismatch for ${artifact}: kit/toolchain.json pins ${pin}, the download hashed to ${actual}. `
            + "Nothing was installed. The feed may be serving a different release than this kit checkout expects.",
        );
    }

    return bytes;
}

function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, { encoding: "utf8", stdio: options.stdio ?? ["ignore", "pipe", "pipe"], cwd: options.cwd });

    if (result.error)
        throw new Error(`${command} ${args.join(" ")} failed: ${result.error.message}`);

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(output || `${command} ${args.join(" ")} exited ${result.status}.`);
    }
}

function extractArchive(archivePath, stagingDir, platform = process.platform) {
    if (archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tgz")) {
        runCommand("tar", ["-xzf", archivePath, "-C", stagingDir]);
    } else if (archivePath.endsWith(".zip")) {
        if (platform === "darwin")
            runCommand("/usr/bin/ditto", ["-x", "-k", archivePath, stagingDir]);
        else
            runCommand("unzip", ["-q", "-o", archivePath, "-d", stagingDir]);
    } else {
        throw new Error(`Unsupported archive type: ${archivePath} (expected .tar.gz or .zip).`);
    }
}

/**
 * Install verified archive bytes at localPath: extract into a staging
 * directory beside it, pick the entry named like the local path (or the sole
 * entry), replace the old install, chmod +x a single-file tool, and write
 * the receipt that lets kit:doctor and the next kit:setup recognise it.
 */
export async function installArtifact({ key, artifact, bytes, pin, localPath, platform = process.platform, now = new Date() }) {
    const toolsDir = path.dirname(localPath);
    const stagingDir = path.join(toolsDir, `.staging-${key}`);
    const archivePath = path.join(toolsDir, `.download-${path.posix.basename(artifact)}`);

    await mkdir(toolsDir, { recursive: true });
    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });

    try {
        await writeFile(archivePath, bytes);
        extractArchive(archivePath, stagingDir, platform);

        const entries = (await readdir(stagingDir)).filter((entry) => !entry.startsWith("."));
        const wanted = path.basename(localPath);
        const source = entries.includes(wanted)
            ? wanted
            : entries.length === 1 ? entries[0] : null;

        if (source === null) {
            throw new Error(
                `${artifact} does not contain ${wanted} (found: ${entries.join(", ") || "nothing"}); refusing to guess.`,
            );
        }

        await rm(localPath, { recursive: true, force: true });
        await rename(path.join(stagingDir, source), localPath);

        if (key === "cmaj")
            await chmod(localPath, 0o755);

        await writeReceipt(localPath, {
            key,
            artifact,
            artifactSha256: pin,
            installedAt: now.toISOString(),
        });
    } finally {
        await rm(stagingDir, { recursive: true, force: true });
        await rm(archivePath, { force: true });
    }

    return localPath;
}

function npmCommand(platform = process.platform) {
    return platform === "win32" ? "npm.cmd" : "npm";
}

/**
 * Execute setup. Refusals (unpinned hash, empty feed) fail before any download
 * so a partially pinned toolchain never half-installs.
 */
export async function runSetup({
    root = repoRoot,
    acceptJuceTerms = false,
    dryRun = false,
    force = false,
    fetchImpl = globalThis.fetch,
    log = console.log,
    platform = process.platform,
    now = () => new Date(),
    runNpmInstall = (cwd) => runCommand(npmCommand(platform), ["install"], { cwd, stdio: "inherit" }),
} = {}) {
    for (const line of juceNoticeLines())
        log(line);

    log("");

    const plan = await planSetup({ root, force, acceptJuceTerms });

    log(formatSetupPlan(plan));
    log("");

    if (dryRun) {
        log("Dry run: nothing was written.");
        return { plan, installed: [], skipped: plan.tools.filter((step) => step.action === "skip").map((step) => step.key), dryRun: true };
    }

    if (!plan.juce.acknowledged && !plan.juce.willAcknowledge) {
        throw new Error(
            "kit:setup needs your acknowledgment of the JUCE licensing notice above. "
            + "Re-run with --accept-juce-terms (recorded once in build/kit-tools/juce-terms-acknowledged.json).",
        );
    }

    const refusals = plan.tools.filter((step) => step.action.startsWith("refuse"));

    if (refusals.length > 0)
        throw new Error(refusals.map((step) => `${step.key}: ${step.reason}`).join("\n"));

    if (plan.juce.willAcknowledge) {
        const acknowledgment = await writeJuceAcknowledgment(root, { now: now() });
        log(`Recorded JUCE terms acknowledgment at ${acknowledgment.acknowledgedAt}.`);
    }

    const installed = [];
    const skipped = [];

    await mkdir(kitToolsDir(root), { recursive: true });

    for (const step of plan.tools) {
        if (step.action === "skip") {
            skipped.push(step.key);
            continue;
        }

        const bytes = await downloadVerifiedArtifact(step.request, step.inspection.pin, {
            artifact: step.inspection.artifact,
            fetchImpl,
            log,
        });

        await installArtifact({
            key: step.key,
            artifact: step.inspection.artifact,
            bytes,
            pin: step.inspection.pin,
            localPath: step.inspection.localPath,
            platform,
            now: now(),
        });

        log(`Installed ${step.key} at ${path.relative(root, step.inspection.localPath)}.`);
        installed.push(step.key);
    }

    if (plan.npmInstall) {
        log("Running npm install...");
        runNpmInstall(root);
    }

    log("kit:setup complete. Run npm run kit:doctor to review the environment.");

    return { plan, installed, skipped, dryRun: false };
}

async function main() {
    try {
        const options = parseSetupArguments(process.argv.slice(2));
        await runSetup(options);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
