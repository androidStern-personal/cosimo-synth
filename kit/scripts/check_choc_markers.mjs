#!/usr/bin/env node
/**
 * The patched-CHOC WebView marker check, shared by every build and install
 * command (`node kit/scripts/check_choc_markers.mjs <binary>` from a shell).
 *
 * The pinned CHOC fork already guarantees the patched WebView at source level,
 * so this byte-level probe of a built binary is a sanity check that a stale or
 * unpatched build did not slip through, not a security gate. Markers are
 * matched as raw byte substrings (`grep -a -F` semantics), which is stricter
 * than strings(1).
 */
import fs from "node:fs";

import { isMainModule } from "./common.mjs";

export const requiredChocWebViewMarkers = Object.freeze([
    "chocHostKeyboard",
    "__chocHostKeyboardBridgeInstalled",
    "__chocUserFiles",
    "chocUserFiles",
]);

// These are markers of an older revision of the Cmajor fork's keyboard bridge,
// rejected because a binary that still carries them forwards DAW keyboard input
// with the old, unreliable bridge.
export const forbiddenChocWebViewMarkers = Object.freeze([
    "cosimoKeyboard",
    "cosimoKeyboardProbe",
    "cosimo-keyboard-probe-panel",
    "forwarded-buffered-flags-changed",
]);

export function findChocMarkerViolations(binaryBytes) {
    return {
        missing: requiredChocWebViewMarkers.filter((marker) => !binaryBytes.includes(marker)),
        forbidden: forbiddenChocWebViewMarkers.filter((marker) => binaryBytes.includes(marker)),
    };
}

export function assertPatchedChocWebViewBinary(binaryPath) {
    const { missing, forbidden } = findChocMarkerViolations(fs.readFileSync(binaryPath));

    if (missing.length > 0) {
        throw new Error([
            `Binary was not built with the required patched CHOC WebView features: ${binaryPath}`,
            `Missing marker(s): ${missing.join(", ")}`,
        ].join("\n"));
    }

    if (forbidden.length > 0) {
        throw new Error([
            `Binary was built from an outdated keyboard bridge: ${binaryPath}`,
            `Outdated marker(s): ${forbidden.join(", ")}`,
            "Run npm run kit:setup for the pinned tools, then rebuild or reinstall.",
        ].join("\n"));
    }
}

function main() {
    const [, , binaryPath, ...extraArguments] = process.argv;

    if (!binaryPath || extraArguments.length > 0) {
        console.error("Usage: node kit/scripts/check_choc_markers.mjs <binary>");
        process.exitCode = 2;
        return;
    }

    try {
        assertPatchedChocWebViewBinary(binaryPath);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

if (isMainModule(import.meta.url))
    main();
