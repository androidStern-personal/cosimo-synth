#!/usr/bin/env node
/**
 * The single source of truth for the patched-CHOC WebView marker check.
 *
 * The pinned CHOC fork already guarantees the patched WebView at source level,
 * so this byte-level probe of a built binary is a sanity check that a stale or
 * unpatched build did not slip through — not a security gate. Markers are
 * matched as raw byte substrings (`grep -a -F` semantics), which is stricter
 * than strings(1).
 *
 * Callers:
 * - kit/fx/prod-effect.mjs, scripts/build_seqfx_beta_release.mjs, and
 *   scripts/seqfx-release-config.mjs import the lists and check from here.
 * - kit/scripts/install_fx_cmajplugin.sh, kit/scripts/build_cmajplugin_vst3.sh,
 *   and kit/scripts/install_cmajplugin_vst3.sh run
 *   `node kit/scripts/check_choc_markers.mjs <binary>`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const requiredChocWebViewMarkers = Object.freeze([
    "chocHostKeyboard",
    "__chocHostKeyboardBridgeInstalled",
    "__chocUserFiles",
    "chocUserFiles",
]);

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
            `Binary still contains old keyboard probe marker(s): ${binaryPath}`,
            `Forbidden marker(s): ${forbidden.join(", ")}`,
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    main();
