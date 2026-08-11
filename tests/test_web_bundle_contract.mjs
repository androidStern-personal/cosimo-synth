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
import { instrumentCosimoAudioWorkletSource } from "../web/audio-worklet-instrumentation.mjs";
import { installBrowserPatchStatePersistence } from "../web/browser-patch-state.mjs";
import { copyWebHostAssets } from "../web/web-host-assets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopBundleBudgetBytes = 3_200_000;
// The worker owns stored-state parsing, sparse compilation, and acknowledged
// delivery. Keep measured raw-parse and transfer ceilings on that complete
// production unit instead of budgeting only the old 12-slot publisher.
const wavetableWorkerBudgetBytes = 138_000;
const wavetableWorkerGzipBudgetBytes = 34_000;

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

test("browser stress artifact includes its exclusive runtime-lane worker", async () => {
    await fs.access(path.join(repoRoot, "build", "web", "patch_gui", "wavetable-test-worker.js"));
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

    assert.doesNotThrow(() => connection.sendStoredStateValue("rack.v1", "enabled"));
    assert.deepEqual(runtimeWrites, [["rack.v1", "enabled"]]);
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
        () => connection.sendStoredStateValue("rack.v1", "rejected"),
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
            return JSON.stringify({ "rack.v1": "restored" });
        },
        setItem(key, value) {
            storageWrites.push([key, value]);
        },
    };

    installBrowserPatchStatePersistence(connection, { storage, storageKey: "test.patch-state" });

    assert.deepEqual(runtimeWrites, [["rack.v1", "restored"]]);
    connection.sendStoredStateValue("rack.v1", "updated");
    storedStateListener({ event: { key: "rack.v1", value: "updated" } });

    assert.deepEqual(runtimeWrites, [
        ["rack.v1", "restored"],
        ["rack.v1", "updated"],
    ]);
    assert.deepEqual(storageWrites, [[
        "test.patch-state",
        JSON.stringify({ "rack.v1": "updated" }),
    ]]);
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
