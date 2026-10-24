// Small helpers every kit command shares: JSON files, kit/kit.json, path
// containment, child processes and the "run as a script" guard.

import { readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Parse a JSON file; the error names the file and what went wrong. */
export function readJson(filePath) {
    let text;

    try {
        text = readFileSync(filePath, "utf8");
    } catch (error) {
        throw new Error(`Could not read ${filePath}: ${error.message}`);
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Could not parse ${filePath}: ${error.message}`);
    }
}

export function readJsonObject(filePath) {
    const value = readJson(filePath);

    if (!isPlainObject(value))
        throw new Error(`${filePath} must contain a JSON object.`);

    return value;
}

/** The placeholder product-owner.json a new project starts from and must edit. */
export const productOwnerTemplatePath = path.join(projectRoot, "kit", "template", "root", "product-owner.json");

/** Keys of a product-owner.json object that still hold the template's placeholder value. */
export function placeholderOwnerKeys(owner, template = readJsonObject(productOwnerTemplatePath)) {
    return Object.entries(template).filter(([key, placeholder]) => owner[key] === placeholder).map(([key]) => key);
}

/** True when `candidate` lies strictly inside `directory` (compared as given; realpath both first to follow links). */
export function isInsideDirectory(directory, candidate) {
    const relative = path.relative(directory, candidate);

    return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** True when the module at `importMetaUrl` is the script node was started with. */
export function isMainModule(importMetaUrl) {
    if (!process.argv[1])
        return false;

    try {
        return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(importMetaUrl));
    } catch {
        return false;
    }
}

const kitSchemaKeys = ["plugin", "toolchain", "feed"];

/** kit/kit.json: the kit version and the config schema versions this kit reads. */
export function readKitManifest(root = projectRoot) {
    const filePath = path.join(root, "kit", "kit.json");
    const manifest = readJsonObject(filePath);
    const schemaVersions = manifest.schemaVersions;
    const wellFormed = typeof manifest.version === "string"
        && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)
        && isPlainObject(schemaVersions)
        && kitSchemaKeys.every((key) => Number.isInteger(schemaVersions[key]) && schemaVersions[key] >= 1);

    if (!wellFormed) {
        throw new Error(
            `${filePath} must contain {"version": "<semver>", "schemaVersions": {"plugin": <int>, "toolchain": <int>, "feed": <int>}}. `
            + "Restore it from the kit release (kit-update skill).",
        );
    }

    return { version: manifest.version, schemaVersions: Object.fromEntries(kitSchemaKeys.map((key) => [key, schemaVersions[key]])) };
}

/**
 * Run a command to completion and return its trimmed stdout. Failures throw
 * with the command's own output; `missingFix` names what to do when the
 * executable is not installed.
 */
export function runCommand(command, args, { cwd = projectRoot, env, capture = true, missingFix } = {}) {
    const result = spawnSync(command, args, {
        cwd,
        env,
        encoding: "utf8",
        stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    if (result.error?.code === "ENOENT")
        throw new Error(`${command} was not found. ${missingFix ?? "Install it or put it on PATH, then retry."}`);

    if (result.error)
        throw new Error(`${command} could not start: ${result.error.message}`);

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        const outcome = result.signal ? `was stopped by ${result.signal}` : `exited with code ${result.status}`;

        throw new Error(output ? `${command} ${args.join(" ")} ${outcome}:\n${output}` : `${command} ${args.join(" ")} ${outcome}.`);
    }

    return result.stdout?.trim() ?? "";
}
