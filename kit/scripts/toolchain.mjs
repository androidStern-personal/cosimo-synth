// Shared reader/hasher for the Builder Kit tool contracts.
//
// kit/feed.json names the feed base URL (empty in the monorepo, stamped by the
// export) and kit/toolchain.json pins the prebuilt `cmaj` and `CmajPlugin.vst3`
// artifacts: feed-relative artifact path, sha256 of the archive (written by
// kit:release), local install path under build/kit-tools/, and the tool ranges
// a customer machine must satisfy. kit:doctor reads through this module and
// kit:setup installs through it.

import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { lstat, mkdir, readdir, readlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redact } from "./redacted.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(scriptDir, "../..");
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

export function readJsonFile(filePath) {
    let text;

    try {
        text = readFileSync(filePath, "utf8");
    } catch (error) {
        throw new Error(`Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Could not parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Read and shape-check kit/toolchain.json. Every tool needs an artifact path and a localPath under build/. */
export function readToolchain(filePath = toolchainPath()) {
    const toolchain = readJsonFile(filePath);

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

/** Read kit/feed.json; returns a structurally redacted base URL (wrapping "" when unset). */
export function readFeedBaseUrl(filePath = feedPath()) {
    let feed;
    try {
        feed = readJsonFile(filePath);
    } catch {
        // JSON.parse diagnostics may quote source text. The feed can contain a
        // capability-bearing URL, so this boundary must replace them entirely.
        throw new Error(`Could not read or parse ${filePath}.`);
    }

    if (!isPlainObject(feed))
        throw new Error(`${filePath} must contain a JSON object.`);

    return redact(normalizeBaseUrl(feed.baseUrl, filePath));
}

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
        throw new Error(`${label} must be an absolute http(s) URL.`);
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
        throw new Error(`${label} must be an absolute http(s) URL.`);

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
        const receipt = readJsonFile(filePath);
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
