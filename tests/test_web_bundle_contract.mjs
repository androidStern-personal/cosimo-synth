import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import {
    enforcePublicAssetPolicy,
    findPublicAssetPolicyViolations,
} from "../web/public-asset-policy.mjs";
import {
    adaptCosimoAudioWorkletModuleLoading,
    fixCosimoAudioWorkletListenerRemoval,
    instrumentCosimoAudioWorkletSource,
} from "../web/audio-worklet-instrumentation.mjs";
import { installBrowserPatchStatePersistence } from "../web/browser-patch-state.mjs";
import { copyWebHostAssets } from "../web/web-host-assets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopBundleBudgetBytes = 3_200_000;
// The worker owns stored-state parsing, sparse compilation, and acknowledged
// delivery. Keep measured raw-parse and transfer ceilings on that complete
// production unit instead of budgeting only the old 12-slot publisher.
// The 2026-08-15 generator-control cut adds 18 strict target identities and
// their range validation to the worker's accepted modulation domain.
// The 2026-08-19 Voice filter Mix append (T05) adds one shared voice target
// plus its catalog descriptor and amount policy; re-measured at 142,969 raw
// and 34,341 gzipped.
// Raised 2026-08-21 for the T22 batched mip-upload protocol (+700 raw /
// +103 gzip): batch assembly and per-batch ack matching are deliberate
// features, not drift. Keep the headroom tight.
// Re-measured 2026-08-23 after the effects-lane dynamic-target grammar landed
// (be5309e..367922d): 149,732 raw and 36,209 gzipped with Node's level-9
// encoder. The added descriptor/instance vocabulary is the intended product
// contract; these ceilings retain less than 1.5% headroom.
// Re-measured 2026-08-24 after merging the lane.v2 topology compiler at
// 90e9a28: 157,762 raw and 38,295 gzipped. The worker must deserialize and
// replay that current lane contract while no editor is open; keep the renewed
// ceilings at roughly 1.5% headroom so future accidental growth still fails.
const wavetableWorkerBudgetBytes = 160_000;
const wavetableWorkerGzipBudgetBytes = 38_800;

test("compiled desktop production entry stays within its browser parse budget", async () => {
    const bundlePath = path.join(repoRoot, "patch_gui", "desktop", "app.js");
    const bundle = await fs.stat(bundlePath);

    assert.ok(
        bundle.size <= desktopBundleBudgetBytes,
        `Expected ${bundlePath} to be at most ${desktopBundleBudgetBytes} bytes, received ${bundle.size}.`,
    );
});

test("compiled wavetable worker stays within its startup parse budget", async () => {
    const bundlePath = path.join(repoRoot, "patch_gui", "wavetable-worker.js");
    const [bundle, source] = await Promise.all([
        fs.stat(bundlePath),
        fs.readFile(bundlePath),
    ]);

    assert.ok(
        bundle.size <= wavetableWorkerBudgetBytes,
        `Expected ${bundlePath} to be at most ${wavetableWorkerBudgetBytes} bytes, received ${bundle.size}.`,
    );
    const compressedSize = gzipSync(source, { level: 9 }).byteLength;
    assert.ok(
        compressedSize <= wavetableWorkerGzipBudgetBytes,
        `Expected ${bundlePath} to gzip to at most ${wavetableWorkerGzipBudgetBytes} bytes, received ${compressedSize}.`,
    );
});

test("the generated modulation module ships its canonical identity dependency", async () => {
    const [buildScript, generatedTargets] = await Promise.all([
        fs.readFile(path.join(repoRoot, "ui", "build.mjs"), "utf8"),
        fs.readFile(path.join(repoRoot, "patch_gui", "modulation-targets.js"), "utf8"),
    ]);

    assert.match(
        buildScript,
        /emitGeneratedPatchGuiModule\("ui\/shared\/modulation-targets\.ts", "patch_gui\/modulation-targets\.js"\)/,
    );
    assert.match(generatedTargets, /^\/\/ Generated from ui\/shared\/modulation-targets\.ts /);
});

test("the product web build uses the renderer-aware generator", async () => {
    const buildSource = await fs.readFile(path.join(repoRoot, "web", "build.mjs"), "utf8");

    assert.match(buildSource, /generate_cmajor_javascript_with_renderer\.mjs/);
    assert.doesNotMatch(buildSource, /"cmaj", \[\s*"generate"/);
});

test("browser stress artifact includes its exclusive runtime-lane worker", async () => {
    await fs.access(path.join(repoRoot, "build", "web", "patch_gui", "wavetable-test-worker.js"));
});

test("Bounce ships a class-only performer and a background render worker", async () => {
    const [offlineClass, worker] = await Promise.all([
        fs.readFile(path.join(repoRoot, "build", "web", "cmaj_Cosimo_Synth.offline.js"), "utf8"),
        fs.readFile(path.join(repoRoot, "build", "web", "patch_gui", "bounce-render-worker.js"), "utf8"),
    ]);

    assert.doesNotMatch(offlineClass, /cmaj-audio-worklet-helper/);
    assert.match(offlineClass, /export default WavetableSynth/);
    assert.match(worker, /render-root-complete/);
});

test("speedrun audio ships its typed checkpoint worker beside the Bounce worker", async () => {
    const worker = await fs.readFile(
        path.join(repoRoot, "build", "web", "patch_gui", "speedrun-checkpoint-worker.js"),
        "utf8",
    );
    assert.match(worker, /SpeedrunInstallError/);
    assert.match(worker, /render-root-complete/);
});

test("Bounce Video ships as a browser-only lazy renderer outside the synth startup bundle", async () => {
    const [desktopApp, renderer, rendererStyles, webHost] = await Promise.all([
        fs.readFile(path.join(repoRoot, "build", "web", "patch_gui", "desktop", "app.js"), "utf8"),
        fs.readFile(path.join(repoRoot, "build", "web", "video-bounce", "index.js"), "utf8"),
        fs.readFile(path.join(repoRoot, "build", "web", "video-bounce", "style.css"), "utf8"),
        fs.readFile(path.join(repoRoot, "build", "web", "cosimo-web-host.js"), "utf8"),
    ]);

    assert.doesNotMatch(desktopApp, /cosimo-sound-speedrun/);
    assert.match(renderer, /cosimo-sound-speedrun/);
    assert.match(rendererStyles, /speedrun-video-frame/);
    assert.match(webHost, /__COSIMO_VIDEO_BOUNCE_MODULE_URL__/);
});

test("Bounce ships the OPFS persistence and safe runtime-restore modules", async () => {
    await Promise.all([
        fs.access(path.join(repoRoot, "build", "web", "bounce", "browser-bank-store.mjs")),
        fs.access(path.join(repoRoot, "build", "web", "bounce", "runtime-restorer.mjs")),
        fs.access(path.join(repoRoot, "build", "web", "bounce", "document.mjs")),
    ]);
});

test("public asset policy removes build-only artifacts without touching runtime files", async (context) => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-public-assets-"));
    context.after(async () => fs.rm(fixtureRoot, { recursive: true, force: true }));

    const files = [
        "README.md",
        "assets/factory-bank-catalog.json",
        "assets/factory-table-catalog.json",
        "assets/factory_sources/default.wav",
        "assets/incoming/source.zip",
        "patch_gui/desktop/app.js",
        "patch_gui/desktop/app.js.map",
        "patch_gui/wavetable-test-worker.js",
    ];
    await Promise.all(files.map(async (relativePath) => {
        const filePath = path.join(fixtureRoot, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, relativePath);
    }));

    assert.deepEqual(await findPublicAssetPolicyViolations(fixtureRoot), [
        "README.md",
        "assets/factory-table-catalog.json",
        "assets/incoming",
        "patch_gui/desktop/app.js.map",
        "patch_gui/wavetable-test-worker.js",
    ]);

    await enforcePublicAssetPolicy(fixtureRoot);

    assert.deepEqual(await findPublicAssetPolicyViolations(fixtureRoot), []);
    await assert.rejects(
        fs.access(path.join(fixtureRoot, "patch_gui", "wavetable-test-worker.js")),
        (error) => error?.code === "ENOENT",
    );
    await Promise.all([
        fs.access(path.join(fixtureRoot, "assets", "factory-bank-catalog.json")),
        fs.access(path.join(fixtureRoot, "assets", "factory_sources", "default.wav")),
        fs.access(path.join(fixtureRoot, "patch_gui", "desktop", "app.js")),
    ]);
});

test("audio-worklet instrumentation measures render load without allocating a bound clock per block", () => {
    const source = `class TestProcessor {
                    receive (msg)
                    {
                    switch (msg.type)
                    {
                        case "req_status":
                            break;
                        case "send_value":
                        {
                            const endpointID = msg.id;
                            const inputEndpoint = {};
                            if (inputEndpoint)
                            {
                                inputEndpoint.update (msg.value);
                            }
                            break;
                        }
                    }
                    }

        process (inputs, outputs)
        {
            const input = inputs[0];
            const output = outputs[0];

            this.processImpl?.(input, output);
            this.consumeOutputEvents?.();

            return true;
        }
}`;

    const instrumented = instrumentCosimoAudioWorkletSource(source);

    assert.match(instrumented, /cosimo-perf-config/);
    assert.match(instrumented, /cosimo-perf-gap-probe/);
    assert.match(instrumented, /cosimo-perf-process-multiplier/);
    assert.match(instrumented, /endpointID === "modulationProgram"/);
    assert.match(instrumented, /eventAdjacentGapLoadSum/);
    assert.match(instrumented, /frameDiscontinuityBlocks/);
    assert.match(instrumented, /quantizedAverageLoad/);
    assert.match(instrumented, /clockSource/);
    assert.doesNotMatch(instrumented, /timerResolutionMilliseconds/);
    assert.match(instrumented, /if \(! this\.cosimoPerfEnabled\)/);
    assert.match(instrumented, /const startedAt = globalThis\.performance \? globalThis\.performance\.now\(\) : Date\.now\(\);/);
    assert.match(instrumented, /type: "cosimo-perf"/);
    assert.doesNotMatch(instrumented, /\.bind\s*\(/);
    assert.throws(
        () => instrumentCosimoAudioWorkletSource("class TestProcessor {}"),
        /Could not instrument the generated Cmajor AudioWorklet process block/,
    );
});

test("audio-worklet modules use a same-origin blob URL that WebKit accepts", () => {
    const source = `async function serialiseWorkletProcessorFactoryToDataURI (CmajorClass, workletName, hostDescription)
{
    const serialisedInvocation = \`(\${registerWorkletProcessor.toString()}) ("\${workletName}", \${CmajorClass.toString()}, "\${hostDescription}");\`

    let reader = new FileReader();
    reader.readAsDataURL (new Blob ([serialisedInvocation], { type: "text/javascript" }));

    return await new Promise (res => { reader.onloadend = () => res (reader.result); });
}

        const dataURI = await serialiseWorkletProcessorFactoryToDataURI (CmajorClass, workletName, hostDescription);
        await audioContext.audioWorklet.addModule (dataURI);`;

    const adapted = adaptCosimoAudioWorkletModuleLoading(source);
    assert.match(adapted, /URL\.createObjectURL/);
    assert.match(adapted, /URL\.revokeObjectURL/);
    assert.doesNotMatch(adapted, /FileReader/);
    assert.throws(
        () => adaptCosimoAudioWorkletModuleLoading("unrecognised helper"),
        /Could not adapt the generated Cmajor AudioWorklet module loader/,
    );
});

test("audio-worklet endpoint listener removal matches the stored listener object", () => {
    const generated = "                                const index = listeners.indexOf (msg?.replyType);";
    const fixed = fixCosimoAudioWorkletListenerRemoval(generated);

    assert.match(fixed, /findIndex \(\(listener\) => listener\.replyType === msg\?\.replyType\)/);
    assert.doesNotMatch(fixed, /listeners\.indexOf/);
});

test("browser patch persistence never blocks a runtime state write when storage fails", () => {
    const runtimeWrites = [];
    const connection = {
        sendStoredStateValue(key, value) {
            runtimeWrites.push([key, value]);
        },
    };
    const storage = {
        getItem() {
            return "{}";
        },
        setItem() {
            throw new DOMException("Storage quota exceeded", "QuotaExceededError");
        },
    };

    installBrowserPatchStatePersistence(connection, { storage });

    assert.doesNotThrow(() => connection.sendStoredStateValue("lane.v1", "enabled"));
    assert.deepEqual(runtimeWrites, [["lane.v1", "enabled"]]);
});

test("browser patch persistence does not store a state write rejected by the runtime", () => {
    const storageWrites = [];
    const connection = {
        sendStoredStateValue() {
            throw new Error("Runtime rejected stored state.");
        },
    };
    const storage = {
        getItem() {
            return "{}";
        },
        setItem(key, value) {
            storageWrites.push([key, value]);
        },
    };

    installBrowserPatchStatePersistence(connection, { storage });

    assert.throws(
        () => connection.sendStoredStateValue("lane.v1", "rejected"),
        /Runtime rejected stored state/,
    );
    assert.deepEqual(storageWrites, []);
});

test("browser patch persistence restores once and coalesces echoed storage writes", () => {
    const runtimeWrites = [];
    const storageWrites = [];
    let storedStateListener;
    const connection = {
        addStoredStateValueListener(listener) {
            storedStateListener = listener;
        },
        sendStoredStateValue(key, value) {
            runtimeWrites.push([key, value]);
        },
    };
    const storage = {
        getItem() {
            return JSON.stringify({
                format: "cosimo.browserPatchState",
                version: 3,
                sound: {
                    parameters: {},
                    storedState: { "lane.v1": "restored" },
                },
                auxiliary: {},
            });
        },
        setItem(key, value) {
            storageWrites.push([key, value]);
        },
    };

    installBrowserPatchStatePersistence(connection, { storage, storageKey: "test.patch-state" });

    assert.deepEqual(runtimeWrites, [["lane.v1", "restored"]]);
    connection.sendStoredStateValue("lane.v1", "updated");
    storedStateListener({ event: { key: "lane.v1", value: "updated" } });

    assert.deepEqual(runtimeWrites, [
        ["lane.v1", "restored"],
        ["lane.v1", "updated"],
    ]);
    assert.deepEqual(storageWrites, [[
        "test.patch-state",
        JSON.stringify({
            format: "cosimo.browserPatchState",
            version: 3,
            sound: {
                parameters: {},
                storedState: { "lane.v1": "updated" },
            },
            auxiliary: {},
        }),
    ]]);
});

test("browser patch persistence restores distinct A/B/C parameters before structured state", () => {
    const runtimeWrites = [];
    const storageWrites = [];
    const connection = {
        inputEndpoints: [
            { endpointID: "oscAPan", purpose: "parameter" },
            { endpointID: "oscBPan", purpose: "parameter" },
            { endpointID: "oscCPan", purpose: "parameter" },
            { endpointID: "runtimeState", purpose: "event" },
        ],
        sendEventOrValue(endpointID, value) {
            runtimeWrites.push(["parameter", endpointID, value]);
        },
        sendStoredStateValue(key, value) {
            runtimeWrites.push(["stored", key, value]);
        },
    };
    const storage = {
        getItem() {
            return JSON.stringify({
                format: "cosimo.browserPatchState",
                version: 3,
                sound: {
                    parameters: { oscAPan: -0.25, oscBPan: 0.5, oscCPan: 0.75 },
                    storedState: { "lane.v1": "restored-rack" },
                },
                auxiliary: {},
            });
        },
        setItem(key, value) {
            storageWrites.push([key, value]);
        },
    };

    installBrowserPatchStatePersistence(connection, { storage, storageKey: "test.patch-state" });

    assert.deepEqual(runtimeWrites, [
        ["parameter", "oscAPan", -0.25],
        ["parameter", "oscBPan", 0.5],
        ["parameter", "oscCPan", 0.75],
        ["stored", "lane.v1", "restored-rack"],
    ]);

    connection.sendEventOrValue("oscBPan", -0.6);
    assert.deepEqual(JSON.parse(storageWrites.at(-1)[1]), {
        format: "cosimo.browserPatchState",
        version: 3,
        sound: {
            parameters: { oscAPan: -0.25, oscBPan: -0.6, oscCPan: 0.75 },
            storedState: { "lane.v1": "restored-rack" },
        },
        auxiliary: {},
    });
});

test("deferred sampled mode ignores safety echoes until an explicit user write", () => {
    const storageWrites = [];
    const parameterListeners = new Map();
    const runtimeWrites = [];
    const connection = {
        inputEndpoints: [{ endpointID: "sourceMode", purpose: "parameter" }],
        addParameterListener(endpointID, listener) {
            parameterListeners.set(endpointID, listener);
        },
        requestParameterValue(endpointID) {
            parameterListeners.get(endpointID)?.(0);
        },
        sendEventOrValue(endpointID, value) {
            runtimeWrites.push([endpointID, value]);
            parameterListeners.get(endpointID)?.(value);
        },
        sendStoredStateValue() {},
    };
    const initial = {
        format: "cosimo.browserPatchState",
        version: 3,
        sound: {
            parameters: { sourceMode: 1 },
            storedState: { "bounce.v1": "reference" },
        },
        auxiliary: {},
    };
    const storage = {
        getItem() { return JSON.stringify(initial); },
        setItem(_key, value) { storageWrites.push(JSON.parse(value)); },
    };

    const persistence = installBrowserPatchStatePersistence(connection, {
        storage,
        deferParameterRestore: (endpointID) => endpointID === "sourceMode",
    });
    // Another host observer may request the temporary engine default. It is
    // runtime state, not a durable edit.
    parameterListeners.get("sourceMode")(0);
    persistence.sendRuntimeEventOrValue("sourceMode", 0);
    assert.deepEqual(storageWrites, []);
    assert.deepEqual(runtimeWrites, [["sourceMode", 0]]);

    connection.sendEventOrValue("sourceMode", 0);
    assert.equal(storageWrites.length, 1);
    assert.equal(storageWrites[0].sound.parameters.sourceMode, 0);
});

test("web host packaging includes every runtime-owned module", async (context) => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-web-host-assets-"));
    context.after(async () => fs.rm(fixtureRoot, { recursive: true, force: true }));
    const sourceDirectory = path.join(fixtureRoot, "source");
    const outputDirectory = path.join(fixtureRoot, "output");
    const fixtureFiles = [
        "index.html",
        "favicon.svg",
        "cosimo-web-host.js",
        "browser-audio-lifecycle.mjs",
        "browser-patch-state.mjs",
        "desktop-production-loader.js",
    ];
    await Promise.all(fixtureFiles.map(async (relativePath) => {
        const filePath = path.join(sourceDirectory, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(
            filePath,
            relativePath === "desktop-production-loader.js"
                ? "export { default } from \"./app.js?v=__COSIMO_DESKTOP_APP_HASH__\";\n"
                : relativePath,
        );
    }));

    const desktopAppSource = "export default function createDesktopPatchView() {}\n";
    const desktopAppPath = path.join(outputDirectory, "patch_gui", "desktop", "app.js");
    await fs.mkdir(path.dirname(desktopAppPath), { recursive: true });
    await fs.writeFile(desktopAppPath, desktopAppSource);

    await copyWebHostAssets({ sourceDirectory, outputDirectory });

    await Promise.all([
        fs.access(path.join(outputDirectory, "index.html")),
        fs.access(path.join(outputDirectory, "favicon.svg")),
        fs.access(path.join(outputDirectory, "cosimo-web-host.js")),
        fs.access(path.join(outputDirectory, "browser-audio-lifecycle.mjs")),
        fs.access(path.join(outputDirectory, "browser-patch-state.mjs")),
        fs.access(path.join(outputDirectory, "patch_gui", "desktop", "index.js")),
    ]);

    const expectedFingerprint = createHash("sha256").update(desktopAppSource).digest("hex").slice(0, 16);
    const productionLoader = await fs.readFile(
        path.join(outputDirectory, "patch_gui", "desktop", "index.js"),
        "utf8",
    );
    assert.match(productionLoader, new RegExp(`\\./app\\.js\\?v=${expectedFingerprint}`));
    assert.doesNotMatch(productionLoader, /__COSIMO_DESKTOP_APP_HASH__/);
});
