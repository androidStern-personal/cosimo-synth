import path from "node:path";
import { fileURLToPath } from "node:url";

import { stageCmajorWebRuntime } from "../../ui/vite.shared.mjs";
import { startStaticWebServer } from "./static_web_server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function findCmajorApiRoot() {
    return stageCmajorWebRuntime(repoRoot, {
        buildDirectory: path.join(repoRoot, "build", "cmajor_web_runtime-live-review"),
        outputDirectory: path.join(repoRoot, "build", "cmajor_web_runtime-live-review", "cmaj_api"),
    });
}

/**
 * Static server for live-performance pages in environments without a full
 * web build: build/web first, repo root as a fallback (factory catalogs and
 * wavetable sources live in assets/), and /cmaj_api/ mapped to the Cmajor
 * runtime under build/deps — all served by the shared static web server.
 */
export async function startLiveReviewServer() {
    return startStaticWebServer(path.join(repoRoot, "build", "web"), {
        fallbackRoots: [repoRoot],
        mounts: { "/cmaj_api": findCmajorApiRoot },
    });
}
