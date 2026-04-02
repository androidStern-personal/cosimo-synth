import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

import { computeResponsivePatchLayout } from "../patch_gui/responsive-layout.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadPatchManifest(fileName) {
    return JSON.parse(
        await fs.readFile(path.join(repoRoot, fileName), "utf8")
    );
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

async function startDesktopViteServer({ port, readyPath }) {
    const viteBinary = path.join(repoRoot, "node_modules", ".bin", "vite");
    const outputChunks = [];

    try {
        const stats = await fs.stat(viteBinary);
        assert.equal(stats.isFile(), true, "The local Vite binary is missing; run npm install before this test.");
    } catch (error) {
        throw new Error(`The local Vite binary is missing at ${viteBinary}: ${error}`);
    }

    const child = spawn(
        viteBinary,
        [
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--config",
            "ui/vite.desktop.config.mjs",
        ],
        {
            cwd: repoRoot,
            stdio: ["ignore", "pipe", "pipe"],
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
        "cmajor/Mseg.cmajor",
        "cmajor/WavetableSynth.cmajor",
    ]);
    assert.deepEqual(desktopManifest.resources, []);
    assert.deepEqual(iosManifest.resources, []);
    assert.equal("externals" in desktopManifest, false);
    assert.equal("externals" in iosManifest, false);
});

test("desktop React UI tooling is wired for Vite dev and build loops", async () => {
    const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
    const viteConfig = await fs.readFile(path.join(repoRoot, "ui", "vite.desktop.config.mjs"), "utf8");
    const workerViteConfig = await fs.readFile(path.join(repoRoot, "ui", "vite.worker.config.mjs"), "utf8");

    assert.equal(packageJson.scripts["ui:desktop:dev"], "vite --config ui/vite.desktop.config.mjs");
    assert.equal(packageJson.scripts["ui:desktop:build"], "vite build --config ui/vite.desktop.config.mjs");
    assert.equal(packageJson.scripts["ui:worker:build"], "vite build --config ui/vite.worker.config.mjs");
    assert.equal(packageJson.scripts["ui:build"], "node ui/build.mjs");
    assert.match(viteConfig, /ensure_cmajor_runtime\.py/);
    assert.match(viteConfig, /serveHtmlEntry\("\/", path\.join\(repoRoot,\s*"ui",\s*"desktop",\s*"index\.html"\)\)/);
    assert.match(viteConfig, /serveHtmlEntry\("\/ui\/desktop\/index\.html", path\.join\(repoRoot,\s*"ui",\s*"desktop",\s*"index\.html"\)\)/);
    assert.match(viteConfig, /servePatchModuleAlias\("\/patch_gui\/desktop\/index\.js"/);
    assert.match(viteConfig, /serveStaticDirectory\("\/cmaj_api", cmajorApiRoot\)/);
    assert.doesNotMatch(viteConfig, /Vendor\/cmajor/);
    assert.match(viteConfig, /port:\s*5174/);
    assert.match(viteConfig, /outDir:\s*path\.join\(repoRoot,\s*"patch_gui",\s*"desktop"\)/);
    assert.match(workerViteConfig, /fileName:\s*\(\)\s*=>\s*"wavetable-worker\.js"/);
    assert.match(workerViteConfig, /ui",\s*"worker",\s*"wavetable-worker\.ts"/);
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
    const cmakeSource = await fs.readFile(path.join(repoRoot, "tools", "live_dev_plugin", "CMakeLists.txt"), "utf8");
    const buildScript = await fs.readFile(path.join(repoRoot, "scripts", "build_live_dev_plugin.sh"), "utf8");
    const buildAssets = await fs.readFile(path.join(repoRoot, "build_assets.py"), "utf8");

    assert.match(cmakeSource, /CMAJ_ENABLE_WEBVIEW_DEV_TOOLS=1/);
    assert.match(cmakeSource, /COSIMO_ENABLE_WEBVIEW_DEV_SERVER=1/);
    assert.match(buildScript, /npm run ui:build/);
    assert.match(buildScript, /uv run python "\$repo_root\/build_assets\.py"/);
    assert.ok(
        buildScript.indexOf("npm run ui:build") < buildScript.indexOf('uv run python "$repo_root/build_assets.py"'),
        "The Vite UI build should run before build_assets.py writes manifests",
    );
    assert.doesNotMatch(buildAssets, /sync_patch_gui_module_copies/);
    assert.doesNotMatch(buildAssets, /shutil\.copyfile/);
});

test("iPhone generator builds UI assets before Python writes manifests so copied patch_gui includes generated modules", async () => {
    const buildScript = await fs.readFile(path.join(repoRoot, "scripts", "generate_ios_auv3_plugin.sh"), "utf8");

    assert.match(buildScript, /npm run ui:build/);
    assert.match(buildScript, /uv run python "\$repo_root\/build_assets\.py"/);
    assert.ok(
        buildScript.indexOf("npm run ui:build") < buildScript.indexOf('uv run python "$repo_root/build_assets.py"'),
        "The iPhone generator should build the UI before build_assets.py copies patch_gui into app bundles",
    );
});

test("legacy patch shell resource client is emitted from the TypeScript source instead of being maintained as a second implementation", async () => {
    const uiBuild = await fs.readFile(path.join(repoRoot, "ui", "build.mjs"), "utf8");
    const generatedResourceClient = await fs.readFile(path.join(repoRoot, "patch_gui", "resource-client.js"), "utf8");

    assert.match(uiBuild, /ui\/shared\/resource-client\.ts/);
    assert.match(
        uiBuild,
        /emitGeneratedPatchGuiModule\("ui\/shared\/resource-client\.ts", "patch_gui\/resource-client\.js"\)/,
    );
    assert.match(
        generatedResourceClient,
        /Generated from ui\/shared\/resource-client\.ts by node ui\/build\.mjs\. Do not edit this file directly\./,
    );
    assert.match(generatedResourceClient, /export function createIOSResourceClient/);
    assert.doesNotMatch(generatedResourceClient, /^\s*export type /m);
});

test("the worker runtime is produced as a real Vite build output instead of a Python-generated source copy", async () => {
    const builtWorker = await fs.readFile(path.join(repoRoot, "patch_gui", "wavetable-worker.js"), "utf8");

    assert.match(builtWorker, /class WavetableWorkerController/);
    assert.doesNotMatch(builtWorker, /\.replace\("\.\/wavetable-mip\.mjs"/);
});

test("desktop wavetable badge uses a real chevron icon instead of a fake text caret hack", async () => {
    const desktopPatchView = await fs.readFile(path.join(repoRoot, "ui", "desktop", "DesktopPatchView.tsx"), "utf8");

    assert.match(desktopPatchView, /function SelectChevron/);
    assert.doesNotMatch(desktopPatchView, />v</);
});

test("desktop keyboard row uses compact transport controls instead of a duplicate frame card and separate editor button", async () => {
    const desktopPatchView = await fs.readFile(path.join(repoRoot, "ui", "desktop", "DesktopPatchView.tsx"), "utf8");

    assert.match(desktopPatchView, /new Nexus\.Number\(/);
    assert.match(desktopPatchView, /Shift keyboard up one octave/);
    assert.match(desktopPatchView, /Shift keyboard down one octave/);
    assert.match(desktopPatchView, /function VoiceModeGlyph/);
    assert.match(desktopPatchView, /function KeyboardSection/);
    assert.doesNotMatch(desktopPatchView, /Open Editor/);
    assert.doesNotMatch(desktopPatchView, /grid-cols-\[220px_minmax\(0,1fr\)\]/);
});

test("desktop keyboard routing is global and the last active control can claim left-right arrow steps", async () => {
    const desktopPatchView = await fs.readFile(path.join(repoRoot, "ui", "desktop", "DesktopPatchView.tsx"), "utf8");
    const synthInputRouter = await fs.readFile(path.join(repoRoot, "ui", "shared", "synth-input-router.ts"), "utf8");

    assert.match(desktopPatchView, /useSynthInputRouter\(keyboardElementRef\)/);
    assert.match(desktopPatchView, /keyboardRef=\{keyboardElementRef\}/);
    assert.match(desktopPatchView, /handleStepWavetable/);
    assert.match(desktopPatchView, /handleStepGlideTime/);
    assert.match(synthInputRouter, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
    assert.match(synthInputRouter, /window\.addEventListener\("keyup", handleKeyUp, true\)/);
    assert.match(synthInputRouter, /event\.key === "ArrowLeft" \|\| event\.key === "ArrowRight"/);
    assert.match(synthInputRouter, /keyboardRef\.current\?\.handleKey\?\.\(event, true\)/);
    assert.match(synthInputRouter, /keyboardRef\.current\?\.allNotesOff\?\.\(\)/);
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

test("iOS patch view applies a root-level safe-area gutter across the whole screen", async () => {
    const source = await fs.readFile(path.join(repoRoot, "patch_gui", "index.js"), "utf8");

    assert.match(source, /env\(safe-area-inset-top\)/);
    assert.match(source, /env\(safe-area-inset-bottom\)/);
    assert.match(source, /env\(safe-area-inset-left\)/);
    assert.match(source, /env\(safe-area-inset-right\)/);
    assert.match(source, /:host\s*\{[\s\S]*box-sizing:\s*border-box;/);
    assert.match(source, /--cosimo-ios-top-inset:\s*0px;/);
    assert.match(source, /--cosimo-ios-bottom-inset:\s*0px;/);
    assert.match(source, /--cosimo-ios-safe-top:\s*calc\(env\(safe-area-inset-top\)\s*\+\s*var\(--cosimo-ios-top-inset\)\);/);
    assert.match(source, /--cosimo-ios-safe-bottom:\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*var\(--cosimo-ios-bottom-inset\)\);/);
    assert.match(source, /\.ios-shell\s*\{[\s\S]*box-sizing:\s*border-box;/);
    assert.match(source, /\.ios-shell\s*\{[\s\S]*padding:\s*var\(--cosimo-ios-safe-top\)\s*env\(safe-area-inset-right\)\s*var\(--cosimo-ios-safe-bottom\)\s*env\(safe-area-inset-left\);/);
    assert.match(source, /\.ios-content\s*\{[\s\S]*padding:\s*0\s*16px;/);
    assert.match(source, /\.keyboard-footer\s*\{[\s\S]*padding:\s*0\s*12px;/);
    assert.match(source, /\.mseg-modal\s*\{[\s\S]*padding:\s*4px\s*10px\s*0;/);
});

test("patch view only exposes Poly Mono Legato play modes and no note-priority control", async () => {
    const source = await fs.readFile(path.join(repoRoot, "patch_gui", "index.js"), "utf8");

    assert.match(source, /label:\s*"Poly"/);
    assert.match(source, /label:\s*"Mono"/);
    assert.match(source, /label:\s*"Legato"/);
    assert.doesNotMatch(source, /label:\s*"Mono ST"/);
    assert.doesNotMatch(source, /label:\s*"Mono FP"/);
    assert.doesNotMatch(source, /label:\s*"Mono ST \+ FP"/);
    assert.doesNotMatch(source, /Note Priority/);
    assert.doesNotMatch(source, /Voice Routing/);
    assert.doesNotMatch(source, />Play Mode</);
});

test("iOS host lets the patch view extend to the full screen and leaves top safe-area handling to the UI", async () => {
    const source = await fs.readFile(
        path.join(repoRoot, "ios_auv3", "Source", "CosimoHostViewController.mm"),
        "utf8"
    );

    assert.match(source, /\[scrollView\.leadingAnchor constraintEqualToAnchor:self\.view\.leadingAnchor\]/);
    assert.match(source, /\[scrollView\.trailingAnchor constraintEqualToAnchor:self\.view\.trailingAnchor\]/);
    assert.match(source, /\[scrollView\.topAnchor constraintEqualToAnchor:self\.view\.topAnchor\]/);
    assert.match(source, /\[scrollView\.bottomAnchor constraintEqualToAnchor:self\.view\.bottomAnchor\]/);
    assert.match(source, /\[editorLabel\.topAnchor constraintEqualToAnchor:self\.editorOverlayView\.safeAreaLayoutGuide\.topAnchor constant:12\.0\]/);
    assert.match(source, /\[self\.editorContentView\.leadingAnchor constraintEqualToAnchor:self\.editorOverlayView\.leadingAnchor\]/);
    assert.match(source, /\[self\.editorContentView\.trailingAnchor constraintEqualToAnchor:self\.editorOverlayView\.trailingAnchor\]/);
    assert.match(source, /\[self\.editorContentView\.bottomAnchor constraintEqualToAnchor:self\.editorOverlayView\.bottomAnchor\]/);
    assert.doesNotMatch(source, /\[scrollView\.bottomAnchor constraintEqualToAnchor:safeArea\.bottomAnchor\]/);
    assert.doesNotMatch(source, /\[self\.editorContentView\.bottomAnchor constraintEqualToAnchor:self\.editorOverlayView\.safeAreaLayoutGuide\.bottomAnchor\]/);
});

test("iOS patch view pins the keyboard footer and mounts the MSEG modal above the keyboard row", async () => {
    const source = await fs.readFile(path.join(repoRoot, "patch_gui", "index.js"), "utf8");

    assert.match(source, /grid-template-rows:\s*minmax\(0,\s*1fr\)\s*auto;/);
    assert.match(source, /class="ios-top-row"/);
    assert.match(source, /class="ios-main-view"/);
    assert.match(source, /\.ios-top-row\s*\{[\s\S]*overflow:\s*hidden;/);
    assert.match(source, /\.ios-top-row\s*\{[\s\S]*display:\s*grid;/);
    assert.match(source, /\.ios-top-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    assert.match(source, /\.ios-top-row\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\);/);
    assert.match(source, /\.ios-main-view\s*\{[\s\S]*display:\s*grid;/);
    assert.match(source, /\.ios-main-view\s*\{[\s\S]*grid-column:\s*1;/);
    assert.match(source, /\.ios-main-view\s*\{[\s\S]*grid-row:\s*1;/);
    assert.match(source, /\.mseg-modal-layer\s*\{[\s\S]*grid-column:\s*1;/);
    assert.match(source, /\.mseg-modal-layer\s*\{[\s\S]*grid-row:\s*1;/);
    assert.match(source, /\.ios-scroll\s*\{[\s\S]*overflow-y:\s*auto;/);
    assert.match(source, /:host\(\[mseg-modal-open\]\)\s+\.ios-main-view\s*\{[\s\S]*display:\s*none;/);
    assert.match(source, /class="keyboard-footer"/);
    assert.match(source, /class="keyboard-toolbar"/);
    assert.match(source, /\.keyboard-footer\s*\{[\s\S]*padding:\s*0\s*12px;/);
    assert.match(source, /class="keyboard-host"/);
    assert.match(source, /class="keyboard-toolbar"[\s\S]*class="keyboard-host"/);
    assert.match(source, /class="octave-button octave-down"/);
    assert.match(source, /class="octave-button octave-up"/);
    assert.match(source, /\.keyboard-host\s*\{[\s\S]*min-height:\s*var\(--cosimo-keyboard-height\);/);
    assert.match(source, /\.keyboard\s*\{[\s\S]*height:\s*var\(--cosimo-keyboard-height\);/);
    assert.match(source, /\.keyboard\s*\{[\s\S]*border-radius:\s*14px 14px 0 0;/);
    assert.match(source, /\.keyboard\s*\{[\s\S]*padding:\s*6px 6px 0;/);
    assert.match(source, /class="wavetable-display-stack"/);
    assert.match(source, /class="bank-picker-trigger"/);
    assert.match(source, /class="table-select table-select-overlay"/);
    assert.match(source, /data-role="display-status"/);
    assert.match(source, /data-role="table-error-banner"/);
    assert.match(source, /Swipe \+ Drag/);
    assert.doesNotMatch(source, /<span class="position-label">Table<\/span>/);
    assert.doesNotMatch(source, /class="wavetable-meta"/);
    assert.doesNotMatch(source, /class="position-readout"/);
    assert.match(source, /background:\s*#04070f;/);
    assert.match(source, /\.wavetable-stage\s*\{[\s\S]*border-radius:\s*0;/);
    assert.match(source, /\.wavetable-stage\s*\{[\s\S]*background:\s*transparent;/);
    assert.match(source, /\.mseg-editor-shell\s*\{[\s\S]*border-radius:\s*0;/);
    assert.match(source, /\.mseg-editor-shell\s*\{[\s\S]*border:\s*0;/);
    assert.match(source, /\.mseg-editor-shell\s*\{[\s\S]*background:\s*transparent;/);
    assert.match(source, /class="mseg-preview-button"/);
    assert.match(source, /class="mseg-preview-footer"/);
    assert.match(source, /data-role="mseg-modal-layer"/);
    assert.match(source, /class="mseg-modal"/);
    assert.match(source, /class="mseg-rate-slider"/);
    assert.match(source, /data-role="mseg-rate-readout"/);
    assert.match(source, /data-role="mseg-launcher-rate-readout"/);
    assert.match(source, /data-role="mseg-launcher-loop-button"/);
    assert.match(source, /class="mseg-loop-button"/);
    assert.match(source, /getMsegSurfaceOrientation\(surface,\s*\{\s*showPoints = false\s*\} = \{\}\)/);
    assert.match(source, /const hostBounds = this\.getBoundingClientRect\?\.\(\) \?\? null;/);
    assert.match(source, /return height > width \? "vertical" : "horizontal";/);
    assert.match(source, /Number\(globalThis\.visualViewport\?\.height\)/);
    assert.match(source, /Number\(globalThis\.window\?\.innerHeight\)/);
    assert.match(source, /\.mseg-modal-backdrop\s*\{[\s\S]*display:\s*none;/);
    assert.match(source, /\.mseg-modal-layer\s*\{[\s\S]*position:\s*relative;/);
    assert.match(source, /\.mseg-modal-layer\s*\{[\s\S]*inset:\s*auto;/);
    assert.match(source, /\.mseg-modal\s*\{[\s\S]*position:\s*relative;/);
    assert.match(source, /\.mseg-modal\s*\{[\s\S]*min-height:\s*100%;/);
    assert.doesNotMatch(source, /\.mseg-modal\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*max\(6px,\s*env\(safe-area-inset-top\)\)\s*6px\s*0\s*6px;/);
    assert.doesNotMatch(source, /class="mseg-loop-toggle"/);
    assert.doesNotMatch(source, /Open Editor/);
    assert.doesNotMatch(source, /Delete Point/);
    assert.doesNotMatch(source, /class="hero"/);
    assert.doesNotMatch(source, /class="scan-panel"/);
    assert.doesNotMatch(source, /class="scan-slider"/);
});

test("iOS keyboard defaults to a tighter one-and-a-half-octave span starting one octave lower than before", async () => {
    const source = await fs.readFile(path.join(repoRoot, "patch_gui", "index.js"), "utf8");
    const layoutSource = await fs.readFile(path.join(repoRoot, "patch_gui", "responsive-layout.mjs"), "utf8");

    assert.match(source, /this\.keyboardRootNote = 36;/);
    assert.match(source, /this\.keyboardMinRootNote = 12;/);
    assert.match(source, /this\.keyboardMaxRootNote = 72;/);
    assert.match(source, /this\.keyboard\.setAttribute\("note-count", `\$\{this\.currentLayout\.noteCount\}`\);/);
    assert.match(source, /attributeChangedCallback\(name, oldValue, newValue\)/);
    assert.match(source, /this\.refreshHTML\(\);/);
    assert.match(source, /return `\$\{formatNote\(startNote\)\} - \$\{formatNote\(lastNote\)\}`;/);
    assert.match(layoutSource, /noteCount:\s*18,/);
});
