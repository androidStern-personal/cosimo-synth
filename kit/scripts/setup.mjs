// kit:setup — idempotent customer-machine setup.
//
//   node kit/scripts/setup.mjs [--accept-juce-terms] [--dry-run] [--force]
//
// 1. Refuses a machine outside kit/toolchain.json requirements (OS, arch,
//    minimum macOS), since the pinned tools would not run there.
// 2. Shows the JUCE licensing notice and requires either --accept-juce-terms
//    or an existing build/kit-tools/juce-terms-acknowledged.json (written on
//    acceptance with a timestamp).
// 3. Downloads the pinned cmaj and CmajPlugin.vst3 archives from
//    kit/feed.json baseUrl + kit/toolchain.json artifact path, verifies the
//    archive sha256 against the pin, extracts to localPath, chmod +x cmaj, and
//    writes an install receipt beside the tool. Already-current tools are
//    skipped. Nothing is downloaded without a pinned hash or a feed URL.
// 4. Runs npm ci against the tracked lockfile when node_modules is missing.
//
// --dry-run prints the plan and writes nothing (no acknowledgment either).

import { chmod, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { isMainModule, runCommand } from "./common.mjs";

import {
    artifactUrl,
    checkPlatform,
    describeMachine,
    feedPath,
    hashInstalledPayload,
    inspectTool,
    juceAcknowledgmentPath,
    juceNoticeLines,
    kitToolsDir,
    normalizePin,
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

const juceAcknowledgmentInstructions = [
    "Read the JUCE licensing notice above. If you agree, run this command from your Builder Kit project folder:",
    "npm run kit:setup -- --accept-juce-terms",
].join("\n");

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

function describeRequirements(requirements) {
    const os = requirements.os ?? "any OS";
    const version = requirements.minMacOS ? ` ${requirements.minMacOS} or newer` : "";
    const arch = requirements.arch ? ` on ${requirements.arch}` : "";

    return `${os}${version}${arch}`;
}

/**
 * Decide what setup would do, without touching the network or the disk.
 * `platform.problems` lists every toolchain requirement this machine misses.
 * Each tool step is one of: skip (current), download, refuse-unpinned,
 * refuse-no-feed. runSetup reports platform problems and refusals as errors
 * before any download starts.
 */
export async function planSetup({ root = repoRoot, force = false, acceptJuceTerms = false, machine = describeMachine() } = {}) {
    const toolchain = readToolchain(toolchainPath(root));
    const platformCheck = checkPlatform(toolchain.requirements, machine);
    const baseUrl = readFeedBaseUrl(feedPath(root));
    const acknowledgment = readJuceAcknowledgment(root);
    const tools = [];

    for (const key of toolKeys) {
        const inspection = await inspectTool(toolchain, key, { root });
        const step = { key, inspection, action: null, reason: null };

        if (inspection.status === "current" && !force) {
            step.action = "skip";
            step.reason = `already present and matches the pin (${inspection.matchedBy})`;
        } else if (inspection.pin === "") {
            step.action = "refuse-unpinned";
            step.reason = `kit/toolchain.json carries no sha256 for ${key}; refusing to download an unverifiable artifact. `
                + "Pins are written by kit:release, so an unpinned toolchain means an unreleased kit checkout.";
        } else if (baseUrl === "") {
            step.action = "refuse-no-feed";
            step.reason = "kit/feed.json baseUrl is empty, so there is nowhere to download from. "
                + "Delivered kits carry this URL; install from the command you were given, or ask the kit owner for a fresh copy.";
        } else {
            step.action = "download";
            step.reason = inspection.status === "missing"
                ? "missing"
                : force ? "--force" : `present but ${inspection.status}`;
        }

        tools.push(step);
    }

    return {
        root,
        platform: {
            machine,
            required: describeRequirements(toolchain.requirements),
            problems: platformCheck.problems,
        },
        feedConfigured: baseUrl !== "",
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

    if (plan.platform.problems.length > 0)
        lines.push(`Platform: REFUSE - ${plan.platform.problems.join(" ")} The pinned tools need ${plan.platform.required}.`);
    else
        lines.push(`Platform: ${plan.platform.machine.os}/${plan.platform.machine.arch} meets ${plan.platform.required}`);

    if (plan.juce.acknowledged)
        lines.push(`JUCE terms: acknowledged ${plan.juce.acknowledgedAt}`);
    else if (plan.juce.willAcknowledge)
        lines.push(`JUCE terms: will record acknowledgment in ${path.relative(plan.root, plan.juce.path)}`);
    else
        lines.push("JUCE terms: not acknowledged yet");

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

    lines.push(plan.npmInstall ? "npm ci: node_modules is missing, will run" : "npm ci: skip, node_modules present");

    return lines.join("\n");
}

const retryAdvice = "Check the internet connection and retry; if it keeps failing, contact support with this message.";

// Messages name the artifact, never the request URL: the URL carries the
// delivery's access path and these messages end up in logs and support mail.
async function fetchBytes(request, artifact, fetchImpl) {
    let response;
    try {
        response = await fetchImpl(request, { redirect: "follow" });
    } catch (error) {
        const reason = error?.cause?.code ?? (error?.name === "TimeoutError" ? "timed out" : "network error");
        throw new Error(`Download failed for ${artifact}: the feed could not be reached (${reason}). ${retryAdvice}`);
    }

    if (new URL(response.url || request).protocol !== new URL(request).protocol)
        throw new Error(`Download failed for ${artifact}: the feed redirected to a different protocol. Contact support with this message.`);

    if (!response.ok)
        throw new Error(`Download failed for ${artifact}: the feed responded HTTP ${response.status}. ${response.status === 403 || response.status === 404 ? "Your delivery may be out of date; contact support with this message." : retryAdvice}`);

    try {
        return Buffer.from(await response.arrayBuffer());
    } catch {
        throw new Error(`Download failed for ${artifact}: response body read failed.`);
    }
}

/** Download one archive and verify it against the pin before anything is written next to the tools. */
export async function downloadVerifiedArtifact(request, pin, { artifact = "tool artifact", fetchImpl = globalThis.fetch, log = () => {} } = {}) {
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

function extractArchive(archivePath, stagingDir) {
    if (archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tgz")) {
        runCommand("tar", ["-xzf", archivePath, "-C", stagingDir]);
    } else if (archivePath.endsWith(".zip")) {
        if (process.platform === "darwin")
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
export async function installArtifact({ key, artifact, bytes, pin, localPath, now = new Date() }) {
    const archiveSha256 = normalizePin(pin);
    if (archiveSha256 === "" || sha256Bytes(bytes) !== archiveSha256)
        throw new Error(`sha256 mismatch for ${artifact}; nothing was installed.`);
    const toolsDir = path.dirname(localPath);
    const stagingDir = path.join(toolsDir, `.staging-${key}`);
    const archivePath = path.join(toolsDir, `.download-${path.posix.basename(artifact)}`);

    await mkdir(toolsDir, { recursive: true });
    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });

    try {
        await writeFile(archivePath, bytes);
        extractArchive(archivePath, stagingDir);

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
            schemaVersion: 2,
            key,
            artifact,
            artifactSha256: archiveSha256,
            payloadSha256: await hashInstalledPayload(localPath),
            installedAt: now.toISOString(),
        });
    } finally {
        await rm(stagingDir, { recursive: true, force: true });
        await rm(archivePath, { force: true });
    }

    return localPath;
}

/**
 * Execute setup. Refusals (unsupported machine, unpinned hash, empty feed)
 * fail before any download so a partially pinned toolchain never half-installs.
 */
export async function runSetup({
    root = repoRoot,
    acceptJuceTerms = false,
    dryRun = false,
    force = false,
    fetchImpl = globalThis.fetch,
    log = console.log,
    machine = describeMachine(),
    now = () => new Date(),
    runNpmInstall = (cwd) => runCommand("npm", ["ci", "--no-audit", "--no-fund"], { cwd, capture: false }),
} = {}) {
    for (const line of juceNoticeLines())
        log(line);

    log("");

    const plan = await planSetup({ root, force, acceptJuceTerms, machine });
    const juceAccepted = plan.juce.acknowledged || plan.juce.willAcknowledge;

    log(formatSetupPlan(plan));
    log("");

    if (dryRun) {
        if (!juceAccepted)
            log(juceAcknowledgmentInstructions);
        log("Dry run: nothing was written.");
        return { plan, installed: [], skipped: plan.tools.filter((step) => step.action === "skip").map((step) => step.key), dryRun: true };
    }

    if (plan.platform.problems.length > 0) {
        throw new Error(`${plan.platform.problems.join(" ")} The pinned cmaj and CmajPlugin.vst3 need `
            + `${plan.platform.required}; run kit:setup on a machine that meets this. Nothing was downloaded.`);
    }

    if (!juceAccepted)
        throw new Error(juceAcknowledgmentInstructions);

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

        // The URL is built here, not kept in the plan, so the plan (which is
        // printed and returned) never carries the delivery's access path.
        const request = artifactUrl(readFeedBaseUrl(feedPath(root)), step.inspection.artifact);
        const bytes = await downloadVerifiedArtifact(request, step.inspection.pin, {
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
            now: now(),
        });

        log(`Installed ${step.key} at ${path.relative(root, step.inspection.localPath)}.`);
        installed.push(step.key);
    }

    if (plan.npmInstall) {
        log("Running npm ci...");
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

if (isMainModule(import.meta.url))
    await main();
