import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DESKTOP_HARNESS_READINESS_TIMEOUT_MS = 90_000;
const SERVER_READINESS_POLL_INTERVAL_MS = 250;
let cmajorApiRootPromise;

export function desktopHarnessNpmCommand(platform = process.platform) {
    return platform === "win32" ? "npm.cmd" : "npm";
}

export function desktopHarnessSpawnSpec(port, platform = process.platform) {
    return {
        command: desktopHarnessNpmCommand(platform),
        args: ["run", "ui:desktop:dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
        shell: platform === "win32",
    };
}

export function pathStaysWithinRepoRoot(rootPath, candidatePath) {
    const repoRelativePath = path.relative(rootPath, candidatePath);

    return !(repoRelativePath.startsWith("..") || path.isAbsolute(repoRelativePath));
}

async function resolveCmajorApiRoot(rootPath) {
    if (!cmajorApiRootPromise) {
        cmajorApiRootPromise = (async () => {
            const result = execFileSync(
                "python3",
                [path.join(rootPath, "scripts", "resolve_build_dependencies.py")],
                { cwd: rootPath, encoding: "utf8" },
            );
            const resolution = JSON.parse(result);
            const { cmajor, choc, juce } = resolution.dependencies;
            console.log(
                `Cosimo CPM dependencies: Cmajor@${cmajor.commit}, CHOC@${choc.commit}, JUCE@${juce.commit} (${resolution.cacheRoot})`,
            );
            return path.join(cmajor.path, "javascript", "cmaj_api");
        })();
    }

    return cmajorApiRootPromise;
}

export async function resolveRepoServedPath(rootPath, candidatePath) {
    const realRootPath = await fs.realpath(rootPath);
    let resolvedCandidatePath = candidatePath;

    try {
        resolvedCandidatePath = await fs.realpath(candidatePath);
    } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
            throw error;
        }
    }

    if (!pathStaysWithinRepoRoot(realRootPath, resolvedCandidatePath)) {
        return null;
    }

    return candidatePath;
}

async function nextHarnessPort() {
    const probe = createNetServer();

    return new Promise((resolve, reject) => {
        probe.once("error", reject);
        probe.listen(0, "127.0.0.1", () => {
            const address = probe.address();
            const port = typeof address === "object" && address ? address.port : null;
            probe.close((closeError) => {
                if (closeError) {
                    reject(closeError);
                    return;
                }

                if (!port) {
                    reject(new Error("Could not allocate a free desktop harness port."));
                    return;
                }

                resolve(port);
            });
        });
    });
}

function contentTypeFor(filePath) {
    if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
        return "text/javascript; charset=utf-8";
    }

    if (filePath.endsWith(".css")) {
        return "text/css; charset=utf-8";
    }

    if (filePath.endsWith(".html")) {
        return "text/html; charset=utf-8";
    }

    if (filePath.endsWith(".json") || filePath.endsWith(".cmajorpatch")) {
        return "application/json; charset=utf-8";
    }

    if (filePath.endsWith(".wav")) {
        return "audio/wav";
    }

    return "application/octet-stream";
}

async function waitForServer(baseUrl, child) {
    let stderr = "";
    let stdout = "";

    child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
    });
    child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
    });

    const maximumAttempts = Math.ceil(
        DESKTOP_HARNESS_READINESS_TIMEOUT_MS / SERVER_READINESS_POLL_INTERVAL_MS,
    );

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
        if (child.exitCode !== null) {
            throw new Error(
                `Desktop harness server exited early with code ${child.exitCode}.\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`,
            );
        }

        try {
            const response = await fetch(baseUrl);

            if (response.ok) {
                return;
            }
        } catch {
            // Keep polling until the dev server is ready or exits.
        }

        await delay(SERVER_READINESS_POLL_INTERVAL_MS);
    }

    throw new Error(`Desktop harness server did not become ready at ${baseUrl}.\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`);
}

export async function startDesktopHarnessServer() {
    const port = await nextHarnessPort();
    const baseUrl = `http://127.0.0.1:${port}/`;
    const spawnSpec = desktopHarnessSpawnSpec(port);
    const child = spawn(
        spawnSpec.command,
        spawnSpec.args,
        {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
            shell: spawnSpec.shell,
            // npm inserts a shell between the test and Vite. Give that tree
            // its own Unix process group so teardown can close inherited
            // stdout/stderr pipes instead of deadlocking on an orphaned Vite.
            detached: process.platform !== "win32",
            env: {
                ...process.env,
                BROWSER: "none",
                // Harness servers skip file watching (tests never use HMR;
                // repo-wide 120ms polling costs ~4 CPU cores per server) and
                // self-exit when their spawner dies, so killed runs cannot
                // leave core-burning orphans behind (T17B).
                COSIMO_TEST_HARNESS: "1",
                COSIMO_HARNESS_SPAWNER_PID: String(process.pid),
            },
        },
    );

    await waitForServer(baseUrl, child);

    return {
        baseUrl,
        async stop() {
            if (child.exitCode !== null) {
                return;
            }

            const signalTree = (signal) => {
                if (process.platform === "win32") {
                    child.kill(signal);
                    return;
                }
                try {
                    process.kill(-child.pid, signal);
                } catch (error) {
                    if (!error || typeof error !== "object" || error.code !== "ESRCH") {
                        throw error;
                    }
                }
            };

            signalTree("SIGTERM");

            for (let attempt = 0; attempt < 20; attempt += 1) {
                if (child.exitCode !== null) {
                    return;
                }

                await delay(100);
            }

            signalTree("SIGKILL");
        },
    };
}

export async function startStaticRepoServer() {
    const port = await nextHarnessPort();
    const cmajorApiRoot = await resolveCmajorApiRoot(repoRoot);

    const server = createHttpServer(async (request, response) => {
        try {
            const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
            const decodedPath = decodeURIComponent(requestUrl.pathname);
            const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
            const servingCmajorApi = relativePath === "/cmaj_api" || relativePath.startsWith("/cmaj_api/");
            const servingRoot = servingCmajorApi ? cmajorApiRoot : repoRoot;
            const rootRelativePath = servingCmajorApi
                ? relativePath.replace(/^\/cmaj_api/, "") || "/index.html"
                : relativePath;
            const filePath = path.resolve(servingRoot, `.${rootRelativePath}`);
            const repoServedPath = await resolveRepoServedPath(servingRoot, filePath);

            if (!repoServedPath) {
                response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
                response.end("Forbidden");
                return;
            }

            const fileContents = await fs.readFile(repoServedPath);
            response.writeHead(200, { "content-type": contentTypeFor(repoServedPath) });
            response.end(fileContents);
        } catch (error) {
            const status = error && typeof error === "object" && "code" in error && error.code === "ENOENT"
                ? 404
                : 500;
            response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
            response.end(status === 404 ? "Not found" : String(error));
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
    });

    return {
        baseUrl: `http://127.0.0.1:${port}/`,
        async stop() {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        },
    };
}

export async function waitForHarnessReady(page) {
    await page.waitForFunction(() => {
        const renderedState = window.__COSIMO_DESKTOP_HARNESS__?.getRenderedState?.();
        return Boolean(renderedState && (renderedState.hasCanvas || renderedState.errorText));
    }, undefined, { timeout: DESKTOP_HARNESS_READINESS_TIMEOUT_MS });
}

export async function getHarnessSnapshot(page) {
    return page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot());
}

export async function getHarnessRenderedState(page) {
    return page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState());
}

export async function clearHarnessDebugLog(page) {
    await page.evaluate(() => {
        window.__COSIMO_DESKTOP_HARNESS__.clearDebugLog();
    });
}

export async function setHarnessRuntimeState(page, nextState) {
    await page.evaluate((state) => {
        window.__COSIMO_DESKTOP_HARNESS__.setRuntimeState(state);
    }, nextState);
}

export async function setHarnessStoredState(page, key, value) {
    await page.evaluate(({ nextKey, nextValue }) => {
        window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(nextKey, nextValue);
    }, {
        nextKey: key,
        nextValue: value,
    });
}

export async function getKeyboardDebug(page) {
    return page.evaluate(() => window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardDebug);
}
