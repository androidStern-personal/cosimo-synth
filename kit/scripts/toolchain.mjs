// Reader and hasher for the Builder Kit tool contracts.
//
// kit/feed.json names the download feed and kit/toolchain.json pins the
// prebuilt `cmaj` and `CmajPlugin.vst3` archives: feed-relative artifact path,
// sha256 of the archive, local install path under build/kit-tools/, and the
// tool ranges a machine must satisfy. kit:doctor reads through this module,
// kit:setup installs through it, and the build commands find their verified
// tools with resolveCmajExecutable and requireCurrentTool.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, createReadStream, existsSync } from "node:fs";
import { access, lstat, mkdir, readdir, readlink, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { isPlainObject, projectRoot, readJson } from "./common.mjs";

export const repoRoot = projectRoot;
export const toolKeys = ["cmaj", "cmajPlugin"];
export const kitToolsRelativeDir = "build/kit-tools";
export const juceAcknowledgmentFileName = "juce-terms-acknowledged.json";
export const juceLicenseUrl = "https://juce.com/legal/juce-9-licence/";

export function toolchainPath(root = repoRoot) {
    return path.join(root, "kit", "toolchain.json");
}

export function feedPath(root = repoRoot) {
    return path.join(root, "kit", "feed.json");
}

export function kitToolsDir(root = repoRoot) {
    return path.join(root, kitToolsRelativeDir);
}

export function juceAcknowledgmentPath(root = repoRoot) {
    return path.join(kitToolsDir(root), juceAcknowledgmentFileName);
}

/** Read and shape-check kit/toolchain.json. Every tool needs an artifact path and a localPath under build/. */
export function readToolchain(filePath = toolchainPath()) {
    const toolchain = readJson(filePath);

    if (!isPlainObject(toolchain))
        throw new Error(`${filePath} must contain a JSON object.`);

    for (const key of toolKeys) {
        const tool = toolchain[key];

        if (!isPlainObject(tool))
            throw new Error(`${filePath} is missing the "${key}" tool entry.`);

        if (typeof tool.artifact !== "string" || tool.artifact === "" || tool.artifact.startsWith("/"))
            throw new Error(`${filePath} "${key}.artifact" must be a non-empty feed-relative path.`);

        if (typeof tool.localPath !== "string" || !path.posix.normalize(tool.localPath).startsWith("build/"))
            throw new Error(`${filePath} "${key}.localPath" must be a repo-relative path inside build/.`);

        if (tool.sha256 !== undefined && typeof tool.sha256 !== "string")
            throw new Error(`${filePath} "${key}.sha256" must be a string.`);
    }

    if (!isPlainObject(toolchain.requirements))
        toolchain.requirements = {};

    return toolchain;
}

/** Read kit/feed.json; "" when no feed is configured. */
export function readFeedBaseUrl(filePath = feedPath()) {
    let feed;
    try {
        feed = readJson(filePath);
    } catch {
        // JSON.parse diagnostics quote the source text, and the feed URL carries
        // the delivery's access path, so the message names only the file.
        throw new Error(`Could not read or parse ${filePath}. Restore it from your delivery (kit-update skill).`);
    }

    if (!isPlainObject(feed))
        throw new Error(`${filePath} must contain a JSON object.`);

    return normalizeBaseUrl(feed.baseUrl, filePath);
}

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function normalizeBaseUrl(value, label = "feed baseUrl") {
    if (value === undefined || value === null)
        return "";

    if (typeof value !== "string")
        throw new Error(`${label} must be a string.`);

    const trimmed = value.trim();

    if (trimmed === "")
        return "";

    let parsed;

    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error(`${label} must be an absolute https URL.`);
    }

    // Plain http is accepted only on this machine, for local test feeds.
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopbackHosts.has(parsed.hostname)))
        throw new Error(`${label} must be an absolute https URL.`);

    return trimmed.replace(/\/+$/, "");
}

export function artifactUrl(baseUrl, artifact) {
    return `${baseUrl}/${artifact.replace(/^\/+/, "")}`;
}

/** A pinned hash is 64 lowercase hex characters; anything else is "unpinned" (empty) or malformed. */
export function normalizePin(value) {
    if (typeof value !== "string")
        return "";

    const pin = value.trim().toLowerCase();

    if (pin === "")
        return "";

    if (!/^[0-9a-f]{64}$/.test(pin))
        throw new Error(`sha256 pin must be 64 hex characters, got: ${JSON.stringify(value)}`);

    return pin;
}

export async function sha256File(filePath) {
    const hash = createHash("sha256");

    for await (const chunk of createReadStream(filePath))
        hash.update(chunk);

    return hash.digest("hex");
}

export function sha256Bytes(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

/** Hash installed bytes, names, modes and link targets without following links. */
export async function hashInstalledPayload(localPath) {
    const hash = createHash("sha256").update("kit-payload-v1\n");
    async function visit(absolutePath, relativePath) {
        const stat = await lstat(absolutePath);
        let record;
        if (stat.isSymbolicLink())
            record = [relativePath, "symlink", await readlink(absolutePath)];
        else if (stat.isFile())
            record = [relativePath, "file", stat.mode & 0o7777, await sha256File(absolutePath)];
        else if (stat.isDirectory())
            record = [relativePath, "directory", stat.mode & 0o7777];
        else
            throw new Error("Unsupported entry in installed tool payload.");
        hash.update(`${JSON.stringify(record)}\n`);
        if (stat.isDirectory()) {
            for (const name of (await readdir(absolutePath)).sort())
                await visit(path.join(absolutePath, name), relativePath ? `${relativePath}/${name}` : name);
        }
    }
    await visit(localPath, "");
    return hash.digest("hex");
}

export function receiptPath(localPath) {
    return `${localPath}.receipt.json`;
}

function readReceipt(filePath) {
    if (!existsSync(filePath))
        return null;

    try {
        const receipt = readJson(filePath);
        return isPlainObject(receipt) ? receipt : null;
    } catch {
        return null;
    }
}

/** Store setup's verified archive identity and installed-payload digest. */
export async function writeReceipt(localPath, receipt) {
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(receiptPath(localPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

/**
 * Inspect one pinned tool on disk. status:
 *   "missing"  - nothing at localPath
 *   "current"  - verified archive identity AND its installed payload match
 *   "stale"    - missing/old receipt or changed archive identity/payload
 *   "unpinned" - present, but the toolchain carries no sha256 to check against
 */
export async function inspectTool(toolchain, key, { root = repoRoot, localPath: installedPath } = {}) {
    const tool = toolchain[key];
    const localPath = installedPath ?? path.resolve(root, tool.localPath);
    const pin = normalizePin(tool.sha256);
    const result = {
        key,
        artifact: tool.artifact,
        localPath,
        relativePath: tool.localPath,
        pin,
        present: existsSync(localPath),
        kind: null,
        payloadSha256: null,
        receipt: readReceipt(receiptPath(localPath)),
        status: "missing",
        matchedBy: null,
    };

    if (!result.present)
        return result;

    const stat = await lstat(localPath);
    result.kind = stat.isDirectory() ? "directory" : "file";

    if (pin === "") {
        result.status = "unpinned";
        return result;
    }

    result.status = "stale";
    const receipt = result.receipt;
    if (receipt?.schemaVersion !== 2 || receipt.key !== key || receipt.artifact !== tool.artifact
        || receipt.artifactSha256 !== pin || !/^[0-9a-f]{64}$/.test(receipt.payloadSha256 ?? "")
        || (key === "cmaj" ? !stat.isFile() : !stat.isDirectory()))
        return result;

    try {
        result.payloadSha256 = await hashInstalledPayload(localPath);
    } catch {
        return result;
    }
    if (result.payloadSha256 === receipt.payloadSha256) {
        result.status = "current";
        result.matchedBy = "archive-and-payload";
    }

    return result;
}

const toolFixes = {
    missing: "Run npm run kit:setup to download it.",
    stale: "It does not match kit/toolchain.json; run npm run kit:setup to download the pinned version again.",
    unpinned: "kit/toolchain.json carries no sha256 for it, so it cannot be verified. Install the kit from a release delivery (kit-update skill).",
};

/** The verified local path of one pinned tool, or an error naming the fix. */
export async function requireCurrentTool(key, { root = repoRoot } = {}) {
    const inspection = await inspectTool(readToolchain(toolchainPath(root)), key, { root });

    if (inspection.status !== "current")
        throw new Error(`${key} at ${inspection.relativePath} is ${inspection.status}. ${toolFixes[inspection.status]}`);

    return inspection.localPath;
}

export const cmajOverrideVariable = "BUILDER_KIT_CMAJ";

/**
 * The Cmajor command a build uses: BUILDER_KIT_CMAJ when set (an absolute
 * path to an executable; for a maintainer's source build of the same pinned
 * fork), otherwise the hash-verified download at kit/toolchain.json
 * cmaj.localPath.
 */
export async function resolveCmajExecutable({ root = repoRoot, environment = process.env } = {}) {
    const override = environment[cmajOverrideVariable];

    if (override === undefined || override === "")
        return requireCurrentTool("cmaj", { root });

    if (!path.isAbsolute(override))
        throw new Error(`${cmajOverrideVariable} must be an absolute path to a cmaj executable (got ${JSON.stringify(override)}).`);

    const downloaded = path.resolve(root, readToolchain(toolchainPath(root)).cmaj.localPath);

    // Naming the downloaded tool explicitly must not skip its hash check.
    if (path.resolve(override) === downloaded)
        return requireCurrentTool("cmaj", { root });

    try {
        if (!(await stat(override)).isFile())
            throw new Error("not a file");
        await access(override, constants.X_OK);
    } catch {
        throw new Error(`${cmajOverrideVariable} names ${override}, which is not an executable file. Unset it to use the cmaj from npm run kit:setup.`);
    }

    return override;
}

// ---------------------------------------------------------------------------
// JUCE licensing acknowledgment

export function juceNoticeLines() {
    return [
        "JUCE licensing notice",
        "  The dedicated plugin build (fx:prod:build) links your plugin against the",
        "  JUCE framework. JUCE is dual-licensed: closed-source plugins need a JUCE",
        "  license from the JUCE team, which the Builder Kit does not include.",
        `  Terms: ${juceLicenseUrl}`,
        "  kit:setup records your acknowledgment of this notice in",
        `  ${kitToolsRelativeDir}/${juceAcknowledgmentFileName}.`,
    ];
}

export function readJuceAcknowledgment(root = repoRoot) {
    const acknowledgment = readReceipt(juceAcknowledgmentPath(root));

    if (!acknowledgment || acknowledgment.acknowledged !== true || typeof acknowledgment.acknowledgedAt !== "string")
        return null;

    return acknowledgment;
}

export async function writeJuceAcknowledgment(root = repoRoot, { now = new Date() } = {}) {
    const acknowledgment = {
        acknowledged: true,
        acknowledgedAt: now.toISOString(),
        licenseUrl: juceLicenseUrl,
        notice: "Closed-source JUCE plugins require a JUCE license obtained by the plugin author.",
    };

    await mkdir(kitToolsDir(root), { recursive: true });
    await writeFile(juceAcknowledgmentPath(root), `${JSON.stringify(acknowledgment, null, 2)}\n`, "utf8");

    return acknowledgment;
}

// ---------------------------------------------------------------------------
// Version ranges (">=22", ">=3.28") against reported versions ("22.22.2").

export function parseVersion(text) {
    const match = typeof text === "string" ? text.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/) : null;

    if (!match)
        return null;

    return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

export function compareVersions(left, right) {
    for (let index = 0; index < 3; index += 1) {
        if (left[index] !== right[index])
            return left[index] < right[index] ? -1 : 1;
    }

    return 0;
}

/** Supports ">=X[.Y[.Z]]" and a bare minimum "X[.Y[.Z]]"; unknown ranges are not enforced (null). */
export function satisfiesRange(version, range) {
    if (typeof range !== "string" || range.trim() === "")
        return null;

    const match = range.trim().match(/^(>=)?\s*v?(\d+(?:\.\d+){0,2})$/);
    const actual = parseVersion(version);

    if (!match || !actual)
        return actual ? null : false;

    return compareVersions(actual, parseVersion(match[2])) >= 0;
}

// ---------------------------------------------------------------------------
// The machine against toolchain.requirements (os, arch, minMacOS).

const platformNames = { darwin: "macOS", linux: "Linux", win32: "Windows" };

/** The running machine in the vocabulary toolchain.requirements uses. */
export function describeMachine({ platform = process.platform, arch = process.arch } = {}) {
    let macOSVersion = null;

    if (platform === "darwin") {
        const probe = spawnSync("sw_vers", ["-productVersion"], { encoding: "utf8", timeout: 10000 });
        if (!probe.error && probe.status === 0)
            macOSVersion = probe.stdout.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null;
    }

    return { os: platformNames[platform] ?? platform, arch, macOSVersion };
}

/**
 * Compare a machine with toolchain.requirements. Each *Ok is null when the
 * requirement is absent or the machine fact is unknown; problems holds one
 * plain sentence per failed requirement.
 */
export function checkPlatform(requirements, machine) {
    const osOk = requirements.os ? requirements.os === machine.os : null;
    const archOk = requirements.arch ? requirements.arch === machine.arch : null;
    const macOSOk = requirements.minMacOS && machine.macOSVersion
        ? satisfiesRange(machine.macOSVersion, `>=${requirements.minMacOS}`) !== false
        : null;
    const problems = [];

    if (osOk === false)
        problems.push(`This machine runs ${machine.os}/${machine.arch}; the kit targets ${requirements.os}/${requirements.arch ?? "any arch"}.`);
    else if (archOk === false)
        problems.push(`This machine is ${machine.arch}; the kit targets ${requirements.arch}.`);

    if (macOSOk === false)
        problems.push(`macOS ${machine.macOSVersion} is older than the required ${requirements.minMacOS}.`);

    return { osOk, archOk, macOSOk, problems };
}
