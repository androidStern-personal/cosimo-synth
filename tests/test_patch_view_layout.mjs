import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

import { computeResponsivePatchLayout } from "../patch_gui/responsive-layout.mjs";
import {
    desktopHarnessNpmCommand,
    desktopHarnessSpawnSpec,
    pathStaysWithinRepoRoot,
    startStaticRepoServer,
} from "./helpers/desktop_harness_browser.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function localViteCommand(platform = process.platform) {
    return path.join(repoRoot, "node_modules", ".bin", platform === "win32" ? "vite.cmd" : "vite");
}

function desktopViteSpawnSpec(port, platform = process.platform) {
    return {
        command: localViteCommand(platform),
        args: [
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--config",
            "ui/vite.desktop.config.mjs",
        ],
        shell: platform === "win32",
    };
}

async function loadPatchManifest(fileName) {
    return JSON.parse(
        await fs.readFile(path.join(repoRoot, fileName), "utf8")
    );
}

async function runUiBuild(extraEnv = {}) {
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["ui/build.mjs"], {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
                ...process.env,
                ...extraEnv,
            },
        });
        let stderr = "";
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
        child.once("error", reject);
        child.once("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`node ui/build.mjs exited with code ${code}\n${stderr}`));
        });
    });
}

async function pickUnusedLocalPort() {
    return await new Promise((resolve, reject) => {
        const server = createServer();

        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();

            if (!address || typeof address === "string") {
                server.close();
                reject(new Error("Could not determine an unused local port"));
                return;
            }

            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(address.port);
            });
        });
    });
}

async function requestRawPathStatus(baseUrl, requestPath) {
    const url = new URL(baseUrl);

    return await new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: url.hostname,
                port: url.port,
                path: requestPath,
                method: "GET",
            },
            (response) => {
                response.resume();
                response.once("end", () => resolve(response.statusCode ?? 0));
            },
        );

        request.once("error", reject);
        request.end();
    });
}

async function startDesktopViteServer({ port, readyPath }) {
    const spawnSpec = desktopViteSpawnSpec(port);
    const viteBinary = spawnSpec.command;
    const outputChunks = [];

    try {
        const stats = await fs.stat(viteBinary);
        assert.equal(stats.isFile(), true, "The local Vite binary is missing; run npm install before this test.");
    } catch (error) {
        throw new Error(`The local Vite binary is missing at ${viteBinary}: ${error}`);
    }

    const child = spawn(
        spawnSpec.command,
        spawnSpec.args,
        {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
            shell: spawnSpec.shell,
        },
    );

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => outputChunks.push(chunk));
    child.stderr.on("data", (chunk) => outputChunks.push(chunk));

    const rootUrl = `http://127.0.0.1:${port}/`;
    const readyUrl = new URL(readyPath, rootUrl);
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Desktop Vite server exited early:\n${outputChunks.join("")}`);
        }

        try {
            const response = await fetch(readyUrl);

            if (response.ok) {
                return {
                    rootUrl,
                    async stop() {
                        if (child.exitCode !== null) {
                            return;
                        }

                        child.kill("SIGTERM");
                        await new Promise((resolve) => {
                            child.once("exit", resolve);
                            setTimeout(() => {
                                if (child.exitCode === null) {
                                    child.kill("SIGKILL");
                                }
                            }, 5_000);
                        });
                    },
                };
            }
        } catch {
            // Wait for the server to finish starting.
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (child.exitCode === null) {
        child.kill("SIGTERM");
    }

    throw new Error(`Timed out waiting for the desktop Vite server at ${rootUrl}\n${outputChunks.join("")}`);
}

test("iOS patch manifest keeps the synth graph but switches to the mobile editor entry point", async () => {
    const desktopManifest = await loadPatchManifest("WavetableSynth.cmajorpatch");
    const iosManifest = await loadPatchManifest("WavetableSynth.iOS.cmajorpatch");

    assert.equal(desktopManifest.view.src, "patch_gui/desktop/index.js");
    assert.equal(desktopManifest.view.width, 1120);
    assert.equal(desktopManifest.view.height, 680);
    assert.equal(iosManifest.view.src, "patch_gui/index.ios.js");
    assert.equal("width" in iosManifest.view, false);
    assert.equal("height" in iosManifest.view, false);
    assert.equal(iosManifest.view.resizable, true);
    assert.deepEqual(iosManifest.source, desktopManifest.source);
    assert.deepEqual(desktopManifest.source, [
        "cmajor/FixedFrameOscillator.cmajor",
        "cmajor/FilterSpectrumCommon.cmajor",
        "cmajor/FilterSpectrumAnalyzer.cmajor",
        "cmajor/Mseg.cmajor",
        "cmajor/WavetableSynth.cmajor",
    ]);
    assert.deepEqual(desktopManifest.resources, []);
    assert.deepEqual(iosManifest.resources, []);
    assert.equal("externals" in desktopManifest, false);
    assert.equal("externals" in iosManifest, false);
});

test("desktop and iPhone React UI tooling are wired for Vite dev and build loops", async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
    const sharedViteHelpers = await fs.readFile(path.join(repoRoot, "ui", "vite.shared.mjs"), "utf8");
    const viteConfig = await fs.readFile(path.join(repoRoot, "ui", "vite.desktop.config.mjs"), "utf8");
    const iosViteConfig = await fs.readFile(path.join(repoRoot, "ios_auv3", "vite.config.mjs"), "utf8");
    const workerViteConfig = await fs.readFile(path.join(repoRoot, "ui", "vite.worker.config.mjs"), "utf8");
    const buildScript = await fs.readFile(path.join(repoRoot, "ui", "build.mjs"), "utf8");

    assert.equal(packageJson.scripts["ui:desktop:dev"], "vite --config ui/vite.desktop.config.mjs");
    assert.equal(packageJson.scripts["ui:desktop:build"], "vite build --config ui/vite.desktop.config.mjs");
    assert.equal(packageJson.scripts["desktop:native:build"], "./scripts/build_desktop_native.sh");
    assert.equal(
        packageJson.scripts["desktop:native:dev"],
        "COSIMO_DESKTOP_UI_SOURCE_MODE=dev-server COSIMO_DESKTOP_DEV_SERVER_ORIGIN=http://127.0.0.1:5174 ./scripts/build_desktop_native.sh",
    );
    assert.equal("ui:ios:dev" in packageJson.scripts, false);
    assert.equal("ui:ios:build" in packageJson.scripts, false);
    assert.equal(packageJson.scripts["ios:ui:dev"], "vite --config ios_auv3/vite.config.mjs");
    assert.equal(packageJson.scripts["ios:ui:build"], "node ui/build.mjs --ios");
    assert.equal(packageJson.scripts["ios:project"], "./scripts/generate_ios_auv3_xcode_project.sh build/ios_device_run");
    assert.equal(packageJson.scripts["ui:worker:build"], "vite build --config ui/vite.worker.config.mjs");
    assert.equal(packageJson.scripts["ui:build"], "node ui/build.mjs");
    assert.match(sharedViteHelpers, /ensure_cmajor_runtime\.py/);
    assert.match(sharedViteHelpers, /export function createViteRepoContext/);
    assert.match(sharedViteHelpers, /export function serveStaticDirectory/);
    assert.match(sharedViteHelpers, /export function serveStaticFile/);
    assert.match(sharedViteHelpers, /export function servePatchModuleAlias/);
    assert.match(sharedViteHelpers, /export function serveHtmlEntry/);
    assert.match(viteConfig, /from "\.\/vite\.shared\.mjs"/);
    assert.match(viteConfig, /createViteRepoContext\(import\.meta\.url\)/);
    assert.match(viteConfig, /serveHtmlEntry\(\{/);
    assert.match(viteConfig, /urlPath:\s*"\/"/);
    assert.match(viteConfig, /urlPath:\s*"\/ui\/desktop\/index\.html"/);
    assert.match(viteConfig, /urlPath:\s*"\/tests\/helpers\/module_test_shell\.html"/);
    assert.match(viteConfig, /urlPath:\s*"\/patch_gui\/desktop\/index\.js"/);
    assert.match(viteConfig, /serveStaticDirectory\("\/cmaj_api", cmajorApiRoot\)/);
    assert.doesNotMatch(viteConfig, /Vendor\/cmajor/);
    assert.match(viteConfig, /port:\s*5174/);
    assert.match(viteConfig, /outDir:\s*path\.join\(repoRoot,\s*"patch_gui",\s*"desktop"\)/);
    assert.match(viteConfig, /fileName:\s*\(\)\s*=>\s*"app\.js"/);
    assert.match(iosViteConfig, /from "\.\.\/ui\/vite\.shared\.mjs"/);
    assert.match(iosViteConfig, /createViteRepoContext\(import\.meta\.url\)/);
    assert.match(iosViteConfig, /react\(\)/);
    assert.match(iosViteConfig, /tailwindcss\(\)/);
    assert.match(iosViteConfig, /urlPath:\s*"\/patch_gui\/index\.ios\.html"/);
    assert.match(iosViteConfig, /sourceFile:\s*iosHostPageSource/);
    assert.match(iosViteConfig, /urlPath:\s*"\/patch_gui\/index\.ios-host\.js"/);
    assert.match(iosViteConfig, /sourceFile:\s*iosHostRuntimeSource/);
    assert.match(iosViteConfig, /urlPath:\s*"\/patch_gui\/index\.ios\.js"/);
    assert.match(iosViteConfig, /serveStaticDirectory\("\/patch_gui", path\.join\(repoRoot,\s*"patch_gui"\)\)/);
    assert.match(iosViteConfig, /serveStaticDirectory\("\/cmaj_api", cmajorApiRoot\)/);
    assert.match(iosViteConfig, /port:\s*5173/);
    assert.match(iosViteConfig, /outDir:\s*path\.join\(repoRoot,\s*"patch_gui"\)/);
    assert.match(iosViteConfig, /fileName:\s*\(\)\s*=>\s*"index\.ios\.js"/);
    assert.match(buildScript, /copyTextFileIfChanged\("ui\/ios\/runtime-shell\.html", "patch_gui\/index\.ios\.html"\)/);
    assert.match(buildScript, /emitGeneratedPatchGuiModule\("ui\/ios\/runtime-host\.js", "patch_gui\/index\.ios-host\.js"\)/);
    assert.match(buildScript, /runBuild\("\.\.\/ios_auv3\/vite\.config\.mjs"\)/);
    assert.match(buildScript, /emitGeneratedPatchGuiModule\("ui\/desktop\/standalone-loader\.js", "patch_gui\/desktop\/index\.js"\)/);
    assert.match(buildScript, /shouldBuild\("--ios"\)/);
    assert.match(buildScript, /shouldBuild\("--desktop"\)/);
    assert.doesNotMatch(buildScript, /COSIMO_DESKTOP_UI_SOURCE/);
    assert.match(workerViteConfig, /fileName:\s*\(\)\s*=>\s*"wavetable-worker\.js"/);
    assert.match(workerViteConfig, /ui",\s*"worker",\s*"wavetable-worker\.ts"/);
});

test("desktop patch entry loads React Grab and the official MCP client only in Vite dev mode", async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
    const desktopPatchEntry = await fs.readFile(
        path.join(repoRoot, "ui", "desktop", "patch-view-entry.tsx"),
        "utf8",
    );

    assert.equal(packageJson.devDependencies["react-grab"], "0.1.29");
    assert.equal(packageJson.devDependencies["@react-grab/mcp"], "0.1.29");
    assert.match(desktopPatchEntry, /if \(import\.meta\.env\.DEV\) \{/);
    assert.match(desktopPatchEntry, /void import\("react-grab"\);/);
    assert.match(desktopPatchEntry, /void import\("@react-grab\/mcp\/client"\);/);
});

test("desktop standalone loader is emitted from source and stays host-configurable after repeated builds", async () => {
    const generatedLoaderPath = path.join(repoRoot, "patch_gui", "desktop", "index.js");
    const generatedAppPath = path.join(repoRoot, "patch_gui", "desktop", "app.js");
    await runUiBuild();
    const originalLoader = await fs.readFile(generatedLoaderPath, "utf8");
    const originalApp = await fs.readFile(generatedAppPath, "utf8");
    const loaderSentinel = "\n// TEST SENTINEL: desktop loader build must remove this line.\n";
    const appSentinel = "\n// TEST SENTINEL: desktop app build must remove this line.\n";

    await fs.writeFile(generatedLoaderPath, `${originalLoader}${loaderSentinel}`, "utf8");
    await fs.writeFile(generatedAppPath, `${originalApp}${appSentinel}`, "utf8");

    await runUiBuild({
        COSIMO_DESKTOP_UI_SOURCE: "dev-server",
        COSIMO_DESKTOP_DEV_SERVER_ORIGIN: "http://example.invalid:9777",
    });

    const generatedLoader = await fs.readFile(generatedLoaderPath, "utf8");
    const generatedApp = await fs.readFile(generatedAppPath, "utf8");

    assert.doesNotMatch(generatedLoader, /desktop loader build must remove this line/);
    assert.match(
        generatedLoader,
        /Generated from ui\/desktop\/standalone-loader\.js by node ui\/build\.mjs\. Do not edit this file directly\./,
    );
    assert.match(generatedLoader, /const DEFAULT_DESKTOP_UI_SOURCE_MODE = "compiled";/);
    assert.match(generatedLoader, /__COSIMO_DESKTOP_UI_SOURCE_MODE__/);
    assert.match(generatedLoader, /__COSIMO_DESKTOP_DEV_SERVER_ORIGIN__/);
    assert.match(generatedLoader, /new URL\("\.\/app\.js", baseUrl\)\.href/);
    assert.doesNotMatch(generatedLoader, /const DESKTOP_UI_SOURCE_MODE = "dev-server";/);
    assert.doesNotMatch(generatedLoader, /http:\/\/example\.invalid:9777/);

    assert.doesNotMatch(generatedApp, /desktop app build must remove this line/);
    assert.match(generatedApp, /function createDesktopPatchView/);
    assert.doesNotMatch(
        generatedApp,
        /Generated from ui\/desktop\/standalone-loader\.js by node ui\/build\.mjs\. Do not edit this file directly\./,
    );
});

test("desktop browser harness launch spec resolves the correct command and args for each platform", () => {
    assert.equal(desktopHarnessNpmCommand("darwin"), "npm");
    assert.equal(desktopHarnessNpmCommand("linux"), "npm");
    assert.equal(desktopHarnessNpmCommand("win32"), "npm.cmd");
    assert.deepEqual(desktopHarnessSpawnSpec(5174, "darwin"), {
        command: "npm",
        args: ["run", "ui:desktop:dev", "--", "--host", "127.0.0.1", "--port", "5174", "--strictPort"],
        shell: false,
    });
    assert.deepEqual(desktopHarnessSpawnSpec(5174, "win32"), {
        command: "npm.cmd",
        args: ["run", "ui:desktop:dev", "--", "--host", "127.0.0.1", "--port", "5174", "--strictPort"],
        shell: true,
    });
});

test("desktop Vite helper launch spec resolves the correct command and args for each platform", () => {
    assert.deepEqual(desktopViteSpawnSpec(5174, "darwin"), {
        command: path.join(repoRoot, "node_modules", ".bin", "vite"),
        args: ["--host", "127.0.0.1", "--port", "5174", "--config", "ui/vite.desktop.config.mjs"],
        shell: false,
    });
    assert.deepEqual(desktopViteSpawnSpec(5174, "linux"), {
        command: path.join(repoRoot, "node_modules", ".bin", "vite"),
        args: ["--host", "127.0.0.1", "--port", "5174", "--config", "ui/vite.desktop.config.mjs"],
        shell: false,
    });
    assert.deepEqual(desktopViteSpawnSpec(5174, "win32"), {
        command: path.join(repoRoot, "node_modules", ".bin", "vite.cmd"),
        args: ["--host", "127.0.0.1", "--port", "5174", "--config", "ui/vite.desktop.config.mjs"],
        shell: true,
    });
});

test("desktop repo-boundary helper rejects sibling paths that only share the repo prefix", () => {
    const nestedFile = path.join(repoRoot, "patch_gui", "desktop", "index.js");
    const siblingWithSharedPrefix = path.join(path.dirname(repoRoot), `${path.basename(repoRoot)}-other`, "secret.txt");

    assert.equal(pathStaysWithinRepoRoot(repoRoot, nestedFile), true);
    assert.equal(pathStaysWithinRepoRoot(repoRoot, siblingWithSharedPrefix), false);
});

test("desktop static repo server rejects repo-local symlinks that point outside the repo", async (t) => {
    const repoTempDir = await fs.mkdtemp(path.join(repoRoot, ".tmp-harness-root-"));
    const siblingRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-harness-outside-"));
    const server = await startStaticRepoServer();

    t.after(async () => {
        await server.stop();
        await fs.rm(repoTempDir, { recursive: true, force: true });
        await fs.rm(siblingRoot, { recursive: true, force: true });
    });

    const outsideFile = path.join(siblingRoot, "secret.txt");
    const symlinkPath = path.join(repoTempDir, "escape.txt");

    await fs.writeFile(outsideFile, "secret", "utf8");
    try {
        await fs.symlink(outsideFile, symlinkPath);
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && (error.code === "EPERM" || error.code === "ENOTSUP")) {
            t.skip(`Symlink creation is not permitted on this platform: ${error.code}`);
            return;
        }
        throw error;
    }

    const status = await requestRawPathStatus(server.baseUrl, `/${path.basename(repoTempDir)}/escape.txt`);
    assert.equal(status, 403);
});

test("desktop Vite dev server serves the real Cmajor browser helpers and the desktop patch bundle", async (t) => {
    const port = await pickUnusedLocalPort();
    const server = await startDesktopViteServer({
        port,
        readyPath: "ui/desktop/index.html",
    });

    t.after(async () => {
        await server.stop();
    });

    const patchViewResponse = await fetch(new URL("cmaj_api/cmaj-patch-view.js", server.rootUrl));
    assert.equal(patchViewResponse.status, 200);
    const patchViewSource = await patchViewResponse.text();
    assert.match(patchViewSource, /createPatchViewHolder/);

    const patchConnectionResponse = await fetch(new URL("cmaj_api/cmaj-patch-connection.js", server.rootUrl));
    assert.equal(patchConnectionResponse.status, 200);
    const patchConnectionSource = await patchConnectionResponse.text();
    assert.match(patchConnectionSource, /class PatchConnection/);

    const desktopBundleResponse = await fetch(new URL("patch_gui/desktop/index.js", server.rootUrl));
    assert.equal(desktopBundleResponse.status, 200);
    const desktopBundleSource = await desktopBundleResponse.text();
    assert.match(desktopBundleSource, /createDesktopPatchView/);

    const desktopHtmlResponse = await fetch(new URL("ui/desktop/index.html", server.rootUrl));
    assert.equal(desktopHtmlResponse.status, 200);
    const desktopHtmlSource = await desktopHtmlResponse.text();
    assert.match(desktopHtmlSource, /@vite\/client/);
    assert.match(desktopHtmlSource, /ui\/desktop\/harness-main\.tsx/);
});

test("desktop dev plug-in build enables the webview dev server and lets Vite build UI assets before Python writes manifests", async () => {
    const cmakeSource = await fs.readFile(path.join(repoRoot, "tools", "desktop_native", "CMakeLists.txt"), "utf8");
    const buildScript = await fs.readFile(path.join(repoRoot, "scripts", "build_desktop_native.sh"), "utf8");
    const patchLoaderPluginSource = await fs.readFile(
        path.join(repoRoot, "tools", "desktop_native", "Source", "cmaj_PatchLoaderPlugin.cpp"),
        "utf8",
    );
    const buildAssets = await fs.readFile(path.join(repoRoot, "build_assets.py"), "utf8");

    assert.match(cmakeSource, /CMAJ_ENABLE_WEBVIEW_DEV_TOOLS=1/);
    assert.match(cmakeSource, /COSIMO_ENABLE_WEBVIEW_DEV_SERVER=1/);
    assert.match(cmakeSource, /COSIMO_DESKTOP_UI_SOURCE_MODE="\$\{COSIMO_DESKTOP_UI_SOURCE_MODE\}"/);
    assert.match(cmakeSource, /COSIMO_DESKTOP_DEV_SERVER_ORIGIN="\$\{COSIMO_DESKTOP_DEV_SERVER_ORIGIN\}"/);
    assert.match(buildScript, /desktop_ui_source_mode="\$\{COSIMO_DESKTOP_UI_SOURCE_MODE:-compiled\}"/);
    assert.match(buildScript, /desktop_dev_server_origin="\$\{COSIMO_DESKTOP_DEV_SERVER_ORIGIN:-http:\/\/127\.0\.0\.1:5174\}"/);
    assert.match(buildScript, /npm run ui:build/);
    assert.doesNotMatch(buildScript, /COSIMO_DESKTOP_UI_SOURCE=dev-server npm run ui:build/);
    assert.match(buildScript, /curl --fail --silent --show-error "\$desktop_dev_server_module_url"/);
    assert.match(buildScript, /-DCOSIMO_DESKTOP_UI_SOURCE_MODE="\$desktop_ui_source_mode"/);
    assert.match(buildScript, /-DCOSIMO_DESKTOP_DEV_SERVER_ORIGIN="\$desktop_dev_server_origin"/);
    assert.match(buildScript, /build_dir="\$repo_root\/build\/desktop_native"/);
    assert.match(buildScript, /au_install_dir="\$HOME\/Library\/Audio\/Plug-Ins\/Components"/);
    assert.match(buildScript, /au_bundle="\$au_install_dir\/CosimoDesktopNative\.component"/);
    assert.match(buildScript, /CosimoDesktopNative_artefacts\/Release\/AU\/CosimoDesktopNative\.component/);
    assert.match(buildScript, /CosimoDesktopNative_artefacts\/Release\/Standalone\/CosimoDesktopNative\.app/);
    assert.doesNotMatch(buildScript, /vst3/i);
    assert.match(buildScript, /uv run python "\$repo_root\/build_assets\.py"/);
    assert.match(patchLoaderPluginSource, /if \(getDesktopUISourceMode\(\) == "dev-server"\)/);
    assert.match(patchLoaderPluginSource, /rule\.selectorText !== "\*"/);
    assert.match(patchLoaderPluginSource, /rule\.style\.removeProperty\("padding"\)/);
    assert.match(patchLoaderPluginSource, /rule\.style\.removeProperty\("margin"\)/);
    assert.match(patchLoaderPluginSource, /rule\.style\.removeProperty\("border"\)/);
    assert.ok(
        buildScript.indexOf("npm run ui:build") < buildScript.indexOf('uv run python "$repo_root/build_assets.py"'),
        "The Vite UI build should run before build_assets.py writes manifests",
    );
    assert.doesNotMatch(buildAssets, /sync_patch_gui_module_copies/);
    assert.doesNotMatch(buildAssets, /shutil\.copyfile/);
});

test("iPhone generator builds UI assets before Python writes manifests so copied patch_gui includes generated modules", async () => {
    const buildScript = await fs.readFile(path.join(repoRoot, "scripts", "generate_ios_auv3_plugin.sh"), "utf8");

    assert.match(buildScript, /\(\s*cd "\$repo_root"\s*npm run ui:build\s*\)/s);
    assert.match(buildScript, /\(\s*cd "\$repo_root"\s*uv run python build_assets\.py\s*\)/s);
    assert.ok(
        buildScript.indexOf("npm run ui:build") < buildScript.indexOf("uv run python build_assets.py"),
        "The iPhone generator should build the UI before build_assets.py copies patch_gui into app bundles",
    );
});

test("legacy patch shell resource client is emitted from the TypeScript source instead of being maintained as a second implementation", async () => {
    const generatedResourceClientPath = path.join(repoRoot, "patch_gui", "resource-client.js");
    const originalGeneratedResourceClient = await fs.readFile(generatedResourceClientPath, "utf8");
    const sentinel = "\n// TEST SENTINEL: build must remove this line.\n";
    await fs.writeFile(generatedResourceClientPath, `${originalGeneratedResourceClient}${sentinel}`, "utf8");

    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["ui/build.mjs"], {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
        child.once("error", reject);
        child.once("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`node ui/build.mjs exited with code ${code}\n${stderr}`));
        });
    });

    const generatedResourceClient = await fs.readFile(generatedResourceClientPath, "utf8");

    assert.doesNotMatch(
        generatedResourceClient,
        /TEST SENTINEL: build must remove this line\./,
        "node ui/build.mjs should rewrite patch_gui/resource-client.js from the TypeScript source",
    );
    assert.match(
        generatedResourceClient,
        /Generated from ui\/shared\/resource-client\.ts by node ui\/build\.mjs\. Do not edit this file directly\./,
    );
    assert.match(generatedResourceClient, /export function createIOSResourceClient/);
    assert.doesNotMatch(generatedResourceClient, /^\s*export type /m);
});

test("the iPhone host shell and runtime are emitted from ui/ios sources instead of being hand-maintained in patch_gui", async () => {
    const builtHostHtml = await fs.readFile(path.join(repoRoot, "patch_gui", "index.ios.html"), "utf8");
    const sourceHostHtml = await fs.readFile(path.join(repoRoot, "ui", "ios", "runtime-shell.html"), "utf8");
    const builtHostRuntime = await fs.readFile(path.join(repoRoot, "patch_gui", "index.ios-host.js"), "utf8");

    assert.equal(builtHostHtml, sourceHostHtml);
    assert.match(
        builtHostRuntime,
        /Generated from ui\/ios\/runtime-host\.js by node ui\/build\.mjs\. Do not edit this file directly\./,
    );
    assert.match(builtHostRuntime, /import \{ createIOSResourceClient \} from "\.\/resource-client\.js";/);
    assert.match(builtHostRuntime, /globalThis\.__cosimoInspectHostPage/);
});

test("the iPhone patch view is emitted as a real React bundle instead of a wrapper around patch_gui/index.js", async () => {
    const builtIOSPatchView = await fs.readFile(path.join(repoRoot, "patch_gui", "index.ios.js"), "utf8");
    const legacyPatchViewPath = path.join(repoRoot, "patch_gui", "index.js");

    assert.match(builtIOSPatchView, /class CosimoIOSReactViewElement extends HTMLElement/);
    assert.match(builtIOSPatchView, /function createIOSPatchView/);
    assert.match(builtIOSPatchView, /"cosimo-synth-view"/);
    assert.match(builtIOSPatchView, /Swipe \+ Drag/);
    assert.doesNotMatch(builtIOSPatchView, /createPatchViewWithOptions/);
    assert.doesNotMatch(builtIOSPatchView, /import \{ createPatchViewWithOptions \} from "\.\/index\.js"/);
    await assert.rejects(
        fs.access(legacyPatchViewPath),
        /ENOENT/,
        "The old monolithic iPhone browser UI should be deleted once the React bundle replaces it",
    );
});

test("desktop and iPhone wavetable views share the same renderer implementation", async () => {
    const sharedRenderer = await fs.readFile(path.join(repoRoot, "ui", "shared", "wavetable-display.ts"), "utf8");

    assert.match(
        sharedRenderer,
        /export \{ CanvasWavetableDisplay \} from "\.\.\/\.\.\/patch_gui\/wavetable-display\.js";/,
    );
});

test("the worker runtime is produced as a real Vite build output instead of a Python-generated source copy", async () => {
    const builtWorker = await fs.readFile(path.join(repoRoot, "patch_gui", "wavetable-worker.js"), "utf8");

    assert.match(builtWorker, /class WavetableWorkerController/);
    assert.doesNotMatch(builtWorker, /\.replace\("\.\/wavetable-mip\.mjs"/);
});

test("generated factory bank catalog points at real bundled source wavetable files", async () => {
    const desktopManifest = await loadPatchManifest("WavetableSynth.cmajorpatch");
    const iosManifest = await loadPatchManifest("WavetableSynth.iOS.cmajorpatch");
    const catalog = JSON.parse(
        await fs.readFile(path.join(repoRoot, "assets", "factory-bank-catalog.json"), "utf8")
    );

    assert.deepEqual(desktopManifest.resources, []);
    assert.deepEqual(iosManifest.resources, []);
    assert.equal("externals" in desktopManifest, false);
    assert.equal("externals" in iosManifest, false);
    assert.ok(Array.isArray(catalog.tables));
    assert.ok(catalog.tables.length >= 2);
    assert.equal("sampleBlob" in catalog, false);

    for (const table of catalog.tables) {
        assert.equal(typeof table.tableId, "string");
        assert.ok(table.tableId.length > 0);
        assert.equal(typeof table.name, "string");
        assert.ok(table.name.length > 0);
        assert.equal(typeof table.sourceWav, "string");
        assert.match(table.sourceWav, /^assets\/factory_sources\//);
        assert.equal(Number.isInteger(table.frameCount), true);
        assert.ok(table.frameCount > 0);
        assert.equal("sampleOffset" in table, false);

        const sourcePath = path.join(repoRoot, table.sourceWav);
        const sourceStats = await fs.stat(sourcePath);
        assert.equal(sourceStats.isFile(), true);
    }
});

test("phone portrait layout uses a full-width scan rail and a compact host-keyboard dock", () => {
    const layout = computeResponsivePatchLayout({
        width: 390,
        height: 844,
        platform: "ios",
    });

    assert.equal(layout.isCompact, true);
    assert.equal(layout.headerStacks, true);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr)");
    assert.equal(layout.controlStyle, "scan-rail");
    assert.equal(layout.noteCount, 18);
    assert.equal(layout.stageMinHeight, 216);
    assert.equal(layout.controlHeight, 54);
    assert.equal(layout.keyboardHeight, 94);
    assert.equal(layout.keyboardNaturalNoteWidth, 22);
    assert.equal(layout.keyboardAccidentalWidth, 12);
});

test("tablet landscape keeps the flatter iOS hierarchy while using a wider keyboard dock", () => {
    const layout = computeResponsivePatchLayout({
        width: 1024,
        height: 768,
        platform: "ios",
    });

    assert.equal(layout.isCompact, false);
    assert.equal(layout.headerStacks, false);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr)");
    assert.equal(layout.controlStyle, "scan-rail");
    assert.equal(layout.noteCount, 18);
    assert.equal(layout.stageMinHeight, 252);
    assert.equal(layout.controlHeight, 54);
    assert.equal(layout.keyboardHeight, 102);
    assert.equal(layout.keyboardNaturalNoteWidth, 24);
    assert.equal(layout.keyboardAccidentalWidth, 13);
});

test("short landscape heights keep every interactive area above the minimum tap-safe size", () => {
    const layout = computeResponsivePatchLayout({
        width: 844,
        height: 390,
        platform: "ios",
    });

    assert.equal(layout.isCompact, false);
    assert.equal(layout.headerStacks, false);
    assert.equal(layout.gridTemplateColumns, "minmax(0, 1fr)");
    assert.equal(layout.controlStyle, "scan-rail");
    assert.equal(layout.noteCount, 18);
    assert.equal(layout.stageMinHeight, 180);
    assert.equal(layout.controlHeight, 48);
    assert.equal(layout.keyboardHeight, 88);
    assert.equal(layout.keyboardNaturalNoteWidth, 20);
    assert.equal(layout.keyboardAccidentalWidth, 11);
});
