import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
    access,
    lstat,
    mkdtemp,
    mkdir,
    readdir,
    readFile,
    readlink,
    realpath,
    rm,
    stat,
    symlink,
    utimes,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadBuildModules() {
    const buildModule = await import(pathToFileURL(path.join(repoRoot, "kit/fx/build-effect.mjs")));
    const prodModule = await import(pathToFileURL(path.join(repoRoot, "kit/fx/prod-effect.mjs")));
    return { buildModule, prodModule };
}

async function withFixtureFxRoot(run) {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-fx-discovery-"));
    const fxRoot = path.join(tempRoot, "fx");

    try {
        await mkdir(fxRoot, { recursive: true });
        return await run(fxRoot);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
}

async function writeJsonOrText(filePath, value) {
    await writeFile(filePath, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * Write a patch and, when given, its `<Name>.plugin.json` config. Object
 * configs get `schemaVersion: 1` unless they set one themselves, so tests read
 * like the field they exercise.
 */
async function writeFixturePlugin(fxRoot, directoryName, patchFileName, manifest, config) {
    const directoryPath = path.join(fxRoot, directoryName);

    await mkdir(directoryPath, { recursive: true });
    await writeJsonOrText(path.join(directoryPath, patchFileName), manifest);

    if (config !== undefined) {
        await writeJsonOrText(
            path.join(directoryPath, patchFileName.replace(/\.cmajorpatch$/, ".plugin.json")),
            typeof config === "string" ? config : { schemaVersion: 1, ...config },
        );
    }
}

async function loadScaffoldModule() {
    return import(pathToFileURL(path.join(repoRoot, "kit/scripts/new_plugin.mjs")));
}

/** The repository-level product-owner.json lives beside fx/. */
async function writeFixtureOwner(fxRoot, owner) {
    await writeJsonOrText(path.join(path.dirname(fxRoot), "product-owner.json"), owner);
}

const fixtureOwner = {
    manufacturer: "Cosimo",
    manufacturerCode: "Cosi",
    pluginCodePrefix: "Cs",
    bundleIdentifierPrefix: "dev.cosimo",
};

function createFixtureProduct(overrides = {}) {
    return {
        productName: "Tremolo Lab",
        manufacturerName: "Cosimo",
        bundleIdentifier: "dev.cosimo.tremolo-lab",
        pluginCode: "CsTL",
        manufacturerCode: "Cosi",
        version: "0.1.0",
        ...overrides,
    };
}

function createFixtureIdentityManifest() {
    return {
        ID: "dev.cosimo.tremolo-lab",
        version: "0.1.0",
        name: "Tremolo Lab",
        manufacturer: "Cosimo",
        plugin: { pluginCode: "CsTL", manufacturerCode: "Cosi" },
        view: { src: "view/index.js" },
    };
}

test("fx_build_all_expands_to_the_discovered_registry_for_both_pipelines", async () => {
    const { buildModule, prodModule } = await loadBuildModules();
    const allNames = buildModule.resolvePluginNames("all");
    const targetNames = buildModule.effectPluginTargetNames();

    assert.ok(allNames.length > 0);
    assert.deepEqual(allNames, buildModule.effectPluginNames());
    assert.deepEqual(prodModule.resolveProdPluginNames("all"), allNames);

    for (const pluginName of allNames) {
        assert.ok(targetNames.includes(pluginName));
        assert.notEqual(buildModule.getEffectPlugins()[pluginName].includeInAll, false);
    }

    for (const pluginName of targetNames) {
        if (!allNames.includes(pluginName))
            assert.equal(buildModule.getEffectPlugins()[pluginName].includeInAll, false);
    }
});

test("fx_build_single_plugin_still_resolves_to_only_that_plugin", async () => {
    const { buildModule, prodModule } = await loadBuildModules();

    for (const pluginName of buildModule.effectPluginTargetNames()) {
        assert.deepEqual(buildModule.resolvePluginNames(pluginName), [pluginName]);
        assert.deepEqual(prodModule.resolveProdPluginNames(pluginName), [pluginName]);
    }
});

test("every discovered target points at real patch and worker files", async () => {
    const { buildModule } = await loadBuildModules();
    const outputDirectories = new Set();

    for (const pluginName of buildModule.effectPluginTargetNames()) {
        const plugin = buildModule.getEffectPlugins()[pluginName];

        assert.match(plugin.patch, /^fx\/[^/]+\/[^/]+\.cmajorpatch$/, pluginName);
        await access(path.join(repoRoot, plugin.patch));

        for (const outputDirectory of [plugin.runtimeOut, plugin.juceOut]) {
            assert.match(outputDirectory, /^build\/.+/, pluginName);
            assert.ok(!outputDirectories.has(outputDirectory), `${pluginName} reuses ${outputDirectory}`);
            outputDirectories.add(outputDirectory);
        }

        if (plugin.workerSource)
            await access(path.join(repoRoot, plugin.workerSource));
    }
});

test("every manifest entry of every discovered target resolves to a real file inside its runtime plan", async () => {
    const { buildModule } = await loadBuildModules();

    for (const pluginName of buildModule.effectPluginTargetNames()) {
        const plugin = buildModule.getEffectPlugins()[pluginName];
        const patchRoot = path.join(repoRoot, path.dirname(plugin.patch));
        let manifest;

        try {
            manifest = JSON.parse(await readFile(path.join(repoRoot, plugin.patch), "utf8"));
        } catch {
            continue; // Discovery tolerates in-progress manifests; the build reports the parse error.
        }

        const entryPlans = buildModule.planRuntimePatchEntries(manifest, {
            reservedTargets: [path.basename(plugin.patch)],
        });

        for (const entries of Object.values(entryPlans)) {
            for (const { from, to } of entries) {
                await access(path.join(patchRoot, from));
                assert.equal(to.startsWith("../"), false, `${pluginName} runtime target escapes: ${to}`);
                assert.equal(path.posix.normalize(to), to, `${pluginName} runtime target is not normalized: ${to}`);
            }
        }
    }
});

test("discovery derives a complete build target from a bare patch directory", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", {
            name: "Tremolo Lab",
            view: { src: "view/index.js", devModule: "/fx/tremolo_lab/view/source.ts" },
        });

        const plugins = buildModule.discoverEffectPlugins({ fxRoot });

        assert.deepEqual(plugins, {
            "tremolo-lab": {
                patch: "fx/tremolo_lab/TremoloLab.cmajorpatch",
                runtimeOut: "build/fx/tremolo_lab_runtime",
                juceOut: "build/tremolo_lab_juce",
                cmakeTarget: "TremoloLab",
                productName: "TremoloLab",
                devModule: "/fx/tremolo_lab/view/source.ts",
                jitInstallRuntime: false,
            },
        });
    });
});

test("plugin config build settings override every derived default", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(
            fxRoot,
            "tremolo_lab",
            "TremoloLab.cmajorpatch",
            { name: "Tremolo Lab" },
            {
                alias: "trem",
                runtimeOut: "build/fx/custom_runtime",
                juceOut: "build/custom_juce",
                cmakeTarget: "CustomTarget",
                productName: "CustomProduct",
                disableMicrophonePermission: true,
                includeInAll: false,
                workerSource: "fx/tremolo_lab/worker/source.ts",
                workerOut: "custom-worker.js",
            },
        );

        const plugins = buildModule.discoverEffectPlugins({ fxRoot });

        assert.deepEqual(Object.keys(plugins), ["trem"]);
        assert.deepEqual(plugins.trem, {
            patch: "fx/tremolo_lab/TremoloLab.cmajorpatch",
            runtimeOut: "build/fx/custom_runtime",
            juceOut: "build/custom_juce",
            cmakeTarget: "CustomTarget",
            productName: "CustomProduct",
            disableMicrophonePermission: true,
            workerSource: "fx/tremolo_lab/worker/source.ts",
            workerOut: "custom-worker.js",
            includeInAll: false,
            jitInstallRuntime: true,
        });
    });
});

test("discovery refuses output directories that leave build/", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "escape_lab", "Escape.cmajorpatch", { name: "Escape" }, {
            runtimeOut: "build/../pwned",
        });

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /invalid "runtimeOut" value/,
        );

        await writeFixturePlugin(fxRoot, "escape_lab", "Escape.cmajorpatch", { name: "Escape" }, {
            juceOut: "/tmp/absolute",
        });

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /invalid "juceOut" value/,
        );
    });
});

test("a declared state module produces a worker-backed runtime without an author-written worker entry", async () => {
    const { buildModule } = await loadBuildModules();
    await withFixtureFxRoot(async fxRoot => {
        const manifest = { name: "State Lab", source: "StateLab.cmajor", view: { src: "view/index.js" } };
        await writeFixturePlugin(fxRoot, "state_lab", "StateLab.cmajorpatch", manifest, {
            stateSource: "fx/state_lab/state.ts",
        });
        const plugin = buildModule.discoverEffectPlugins({ fxRoot })["state-lab"];
        assert.equal(plugin.stateSource, "fx/state_lab/state.ts");
        assert.equal(plugin.workerSource, undefined);
        assert.equal(plugin.jitInstallRuntime, true);
        assert.equal(buildModule.createRuntimePatchManifest(manifest, plugin).worker, "worker.js");
        await writeJsonOrText(path.join(fxRoot, "state_lab/StateLab.plugin.json"), {
            schemaVersion: 1, stateSource: "../outside/state.ts",
        });
        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /invalid "stateSource"/);
        await writeJsonOrText(path.join(fxRoot, "state_lab/StateLab.plugin.json"), {
            schemaVersion: 1, stateSource: "fx/state_lab/state.ts", workerSource: "fx/state_lab/worker.ts",
        });
        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /cannot combine "stateSource" and "workerSource"/);
    });
});

test("build output roots resolve strictly inside build/ before anything is deleted", async () => {
    const { buildModule } = await loadBuildModules();

    assert.equal(
        buildModule.resolveBuildOutputRoot("build/fx/enhancer_runtime", "enhancer runtimeOut"),
        path.join(repoRoot, "build", "fx", "enhancer_runtime"),
    );

    for (const badValue of ["", "build", "build/", "build/..", "build/../pwned", "ui/shared", "/tmp/x", "../build/x"]) {
        assert.throws(
            () => buildModule.resolveBuildOutputRoot(badValue, "test label"),
            /test label must/,
            `expected rejection for ${JSON.stringify(badValue)}`,
        );
    }
});

test("a directory holding several patches enumerates all of them in stable sorted order", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "duo_lab", "Zeta.cmajorpatch", { name: "Zeta" }, { alias: "zeta" });
        await writeFixturePlugin(fxRoot, "duo_lab", "Alpha.cmajorpatch", { name: "Alpha" }, { alias: "alpha" });
        await writeFixturePlugin(fxRoot, "another_lab", "Solo.cmajorpatch", { name: "Solo" });

        const plugins = buildModule.discoverEffectPlugins({ fxRoot });

        assert.deepEqual(Object.keys(plugins), ["another-lab", "alpha", "zeta"]);
        assert.equal(plugins.alpha.patch, "fx/duo_lab/Alpha.cmajorpatch");
        assert.equal(plugins.zeta.patch, "fx/duo_lab/Zeta.cmajorpatch");
    });
});

test("duplicate aliases fail discovery naming both claiming patches", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "duo_lab", "First.cmajorpatch", { name: "First" });
        await writeFixturePlugin(fxRoot, "duo_lab", "Second.cmajorpatch", { name: "Second" });

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /alias "duo-lab" is claimed by both fx\/duo_lab\/First\.cmajorpatch and fx\/duo_lab\/Second\.cmajorpatch/,
        );
    });
});

test("removing a plugin directory removes its build target", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "keep_lab", "Keep.cmajorpatch", { name: "Keep" });
        await writeFixturePlugin(fxRoot, "drop_lab", "Drop.cmajorpatch", { name: "Drop" });

        assert.deepEqual(Object.keys(buildModule.discoverEffectPlugins({ fxRoot })), ["drop-lab", "keep-lab"]);

        await rm(path.join(fxRoot, "drop_lab"), { recursive: true, force: true });

        assert.deepEqual(Object.keys(buildModule.discoverEffectPlugins({ fxRoot })), ["keep-lab"]);
    });
});

test("a malformed plugin config fails discovery loudly while a malformed manifest degrades to derived names", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "broken_lab", "Broken.cmajorpatch", { name: "Broken" }, "{ not json");
        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /Broken\.plugin\.json/,
        );

        await writeFixturePlugin(fxRoot, "broken_lab", "Broken.cmajorpatch", { name: "Broken" }, { cmaketarget: "Typo" });
        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /unknown key "cmaketarget"/,
        );

        await rm(path.join(fxRoot, "broken_lab"), { recursive: true, force: true });
        await writeFixturePlugin(fxRoot, "wip_lab", "WorkInProgress.cmajorpatch", "{ not json either");

        const plugins = buildModule.discoverEffectPlugins({ fxRoot });

        assert.equal(plugins["wip-lab"].cmakeTarget, "WorkInProgress");
        assert.equal(plugins["wip-lab"].productName, "WorkInProgress");
    });
});

test("an orphan plugin config fails discovery instead of being silently ignored", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "typo_lab", "TypoLab.cmajorpatch", { name: "Typo Lab" });
        await writeJsonOrText(path.join(fxRoot, "typo_lab", "Typolab.plugin.json"), { schemaVersion: 1, cmakeTarget: "NeverApplied" });

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /Typolab\.plugin\.json matches no \.cmajorpatch/,
        );
    });
});

test("plugin config schemaVersion is required and may not exceed what kit/kit.json supports", async () => {
    const { buildModule } = await loadBuildModules();
    const { readKitManifest } = await import(pathToFileURL(path.join(repoRoot, "kit/scripts/common.mjs")));
    const kitManifest = JSON.parse(await readFile(path.join(repoRoot, "kit/kit.json"), "utf8"));

    assert.match(kitManifest.version, /^\d+\.\d+\.\d+$/);
    assert.deepEqual(kitManifest.schemaVersions, { plugin: 1, toolchain: 1, feed: 1 });
    assert.deepEqual(readKitManifest(), kitManifest);

    await withFixtureFxRoot(async (fxRoot) => {
        const fixtureRoot = path.dirname(fxRoot);
        assert.throws(() => readKitManifest(fixtureRoot), /Could not read .*kit\.json/);
        await mkdir(path.join(fixtureRoot, "kit"));
        await writeJsonOrText(path.join(fixtureRoot, "kit/kit.json"), { version: "1.0", schemaVersions: { plugin: 1 } });
        assert.throws(() => readKitManifest(fixtureRoot), /must contain \{"version".*Restore it from the kit release/);

        await writeFixturePlugin(fxRoot, "ver_lab", "Ver.cmajorpatch", { name: "Ver" }, { schemaVersion: undefined });
        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /Ver\.plugin\.json is missing required key "schemaVersion" \(this kit supports 1\)/,
        );

        await writeFixturePlugin(fxRoot, "ver_lab", "Ver.cmajorpatch", { name: "Ver" }, { schemaVersion: "1" });
        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /invalid "schemaVersion" value/);

        // A newer schema names the real fix (update the kit) rather than
        // tripping over keys this kit does not know.
        await writeFixturePlugin(fxRoot, "ver_lab", "Ver.cmajorpatch", { name: "Ver" }, { schemaVersion: 2, futureKey: true });
        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /Ver\.plugin\.json uses plugin config schema 2, newer than this kit supports \(1\)\. Update the kit/,
        );

        await writeFixturePlugin(fxRoot, "ver_lab", "Ver.cmajorpatch", { name: "Ver" }, { schemaVersion: 1 });
        assert.equal(buildModule.discoverEffectPlugins({ fxRoot })["ver-lab"].cmakeTarget, "Ver");
    });
});

test("a plugin config workerOut without workerSource fails discovery instead of being dropped", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "half_lab", "Half.cmajorpatch", { name: "Half" }, {
            workerOut: "worker.js",
        });

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /sets "workerOut" without "workerSource"/,
        );
    });
});

test("plugin config build identifiers and worker paths must be separator-free or repo-contained", async () => {
    const { buildModule } = await loadBuildModules();

    const badSidecars = [
        [{ cmakeTarget: "../Escape" }, /invalid "cmakeTarget" value/],
        [{ productName: "Evil/../../Product" }, /invalid "productName" value/],
        [{ productName: ".." }, /invalid "productName" value/],
        [{ previousProductName: "../Other" }, /invalid "previousProductName" value/],
        [{ previousProductName: ["OldName"] }, /invalid "previousProductName" value/],
        [
            { workerSource: "../outside/worker.ts", workerOut: "worker.js" },
            /invalid "workerSource" value/,
        ],
        [
            { workerSource: "fx/bad_lab/worker/source.ts", workerOut: "../escape.js" },
            /invalid "workerOut" value/,
        ],
    ];

    for (const [sidecar, expectedError] of badSidecars) {
        await withFixtureFxRoot(async (fxRoot) => {
            await writeFixturePlugin(fxRoot, "bad_lab", "Bad.cmajorpatch", { name: "Bad" }, sidecar);
            assert.throws(
                () => buildModule.discoverEffectPlugins({ fxRoot }),
                expectedError,
                JSON.stringify(sidecar),
            );
        });
    }
});

test("explicit former bundle filename reaches the installer config without changing identity", async () => {
    const { buildModule } = await loadBuildModules();
    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "renamed_tone", "Tone.cmajorpatch", { name: "Tone" }, {
            productName: "NewTone", previousProductName: "OldTone",
        });
        const plugin = buildModule.discoverEffectPlugins({ fxRoot })["renamed-tone"];
        assert.equal(plugin.productName, "NewTone");
        assert.equal(plugin.previousProductName, "OldTone");
        await writeFixturePlugin(fxRoot, "renamed_tone", "Tone.cmajorpatch", { name: "Tone" }, {
            productName: "NewTone", previousProductName: "NewTone",
        });
        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /previousProductName must differ/);
    });
});

test("the product object is read at discovery and derives the manifest-facing identity", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", createFixtureIdentityManifest(), {
            productName: "TremoloLab",
            product: createFixtureProduct({
                supportUrl: "https://example.com/support",
            }),
        });

        const plugins = buildModule.discoverEffectPlugins({ fxRoot });
        const plugin = plugins["tremolo-lab"];

        // The top-level productName is the install filename; the product
        // object's productName is the display name.
        assert.equal(plugin.productName, "TremoloLab");
        assert.deepEqual(plugin.identity, {
            ID: "dev.cosimo.tremolo-lab",
            name: "Tremolo Lab",
            manufacturer: "Cosimo",
            version: "0.1.0",
            plugin: { pluginCode: "CsTL", manufacturerCode: "Cosi" },
        });
        assert.deepEqual(plugin.identity, buildModule.deriveProductIdentity(plugin.product));
        assert.equal(plugin.product.supportUrl, "https://example.com/support");

        // The build writes the derived identity into the runtime manifest
        // without disturbing key order or any other manifest content.
        const runtimeManifest = buildModule.createRuntimePatchManifest(createFixtureIdentityManifest(), plugin);

        assert.deepEqual(runtimeManifest, createFixtureIdentityManifest());
        assert.deepEqual(Object.keys(runtimeManifest), Object.keys(createFixtureIdentityManifest()));
    });
});

test("absent identity fields derive from the plugin name, the manifest, and product-owner.json", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        // An empty product object opts into authoritative identity; nothing
        // can be derived without the owner file.
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", createFixtureIdentityManifest(), { product: {} });
        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /TremoloLab\.plugin\.json omits "product\.manufacturerName" and there is no .*product-owner\.json to derive it from/,
        );

        await writeFixtureOwner(fxRoot, { ...fixtureOwner, supportUrl: "https://example.com/owner-support" });

        const plugin = buildModule.discoverEffectPlugins({ fxRoot })["tremolo-lab"];

        assert.deepEqual(plugin.product, {
            productName: "Tremolo Lab",                 // manifest name
            manufacturerName: "Cosimo",                 // owner.manufacturer
            bundleIdentifier: "dev.cosimo.tremolo-lab", // owner prefix + alias
            pluginCode: "CsTL",                         // owner pluginCodePrefix + initials
            manufacturerCode: "Cosi",                   // owner.manufacturerCode
            version: "0.1.0",                           // manifest version
            supportUrl: "https://example.com/owner-support",
        });
        assert.equal(plugin.productName, "TremoloLab");
        assert.equal(plugin.identity.ID, "dev.cosimo.tremolo-lab");

        // Explicit keys win over every derivation, and the manifest must then agree.
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", createFixtureIdentityManifest(), {
            product: { pluginCode: "CsTr" },
        });
        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /plugin\.pluginCode \(manifest "CsTL", TremoloLab\.plugin\.json "CsTr"\)/,
        );

        // Without pluginCodePrefix the manufacturer code's first two characters lead.
        await writeFixtureOwner(fxRoot, { manufacturer: "Your Company", manufacturerCode: "Yoco", bundleIdentifierPrefix: "com.example" });
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", {
            ID: "com.example.tremolo-lab",
            version: "0.1.0",
            name: "Tremolo Lab",
            manufacturer: "Your Company",
            plugin: { pluginCode: "YoTL", manufacturerCode: "Yoco" },
        }, { product: {} });

        const derived = buildModule.discoverEffectPlugins({ fxRoot })["tremolo-lab"];

        assert.deepEqual(derived.identity, {
            ID: "com.example.tremolo-lab",
            name: "Tremolo Lab",
            manufacturer: "Your Company",
            version: "0.1.0",
            plugin: { pluginCode: "YoTL", manufacturerCode: "Yoco" },
        });

        // Owner file defects fail discovery closed.
        await writeFixtureOwner(fxRoot, { manufacturer: "Your Company", manufacturerCode: "yoco", bundleIdentifierPrefix: "com.example" });
        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /product-owner\.json has an invalid "manufacturerCode" value/);
        await writeFixtureOwner(fxRoot, { manufacturer: "Your Company", bundleIdentifierPrefix: "com.example" });
        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /product-owner\.json is missing required key "manufacturerCode"/);
        await writeFixtureOwner(fxRoot, { ...fixtureOwner, companyName: "x" });
        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /product-owner\.json has unknown key "companyName"/);
    });

    assert.equal(buildModule.derivePluginCode("demo_verb", "Cs"), "CsDV");
    assert.equal(buildModule.derivePluginCode("chorus", "Cs"), "CsCh");
    assert.equal(buildModule.derivePluginCode("x", "Cs"), null);
    assert.equal(buildModule.derivePluginDisplayName("demo_verb"), "Demo Verb");
    assert.equal(buildModule.derivePluginBaseName("demo_verb"), "DemoVerb");
    assert.equal(buildModule.ownerPluginCodePrefix({ manufacturerCode: "Yoco" }), "Yo");
    assert.equal(buildModule.ownerPluginCodePrefix({ manufacturerCode: "Cosi", pluginCodePrefix: "Cs" }), "Cs");
});

test("product object shape defects fail discovery closed like the build fields", async () => {
    const { buildModule } = await loadBuildModules();
    const badProducts = [
        [createFixtureProduct({ pluginCode: "toolong" }), /invalid "pluginCode" value/],
        [createFixtureProduct({ pluginCode: "abc" }), /invalid "pluginCode" value/],
        [createFixtureProduct({ pluginCode: "cstl" }), /invalid "pluginCode" value/],
        [createFixtureProduct({ manufacturerCode: "Co/i" }), /invalid "manufacturerCode" value/],
        [createFixtureProduct({ bundleIdentifier: "no-dots" }), /invalid "bundleIdentifier" value/],
        [createFixtureProduct({ version: "1.0" }), /invalid "version" value/],
        [createFixtureProduct({ supportUrl: "not a url" }), /invalid "supportUrl" value/],
        [createFixtureProduct({ accentColor: "#f0b867" }), /unknown key "accentColor"/],
        [createFixtureProduct({ wordmark: "assets/wordmark.png" }), /unknown key "wordmark"/],
        [createFixtureProduct({ productCode: "CsTL" }), /unknown key "productCode"/],
        [createFixtureProduct({ outputFileName: "TremoloLab" }), /unknown key "outputFileName"/],
        [createFixtureProduct({ patch: "TremoloLab.cmajorpatch" }), /unknown key "patch"/],
        ["not an object", /"product" must be a JSON object/],
    ];

    for (const [product, expectedError] of badProducts) {
        await withFixtureFxRoot(async (fxRoot) => {
            await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", createFixtureIdentityManifest(), { product });
            assert.throws(
                () => buildModule.discoverEffectPlugins({ fxRoot }),
                expectedError,
                JSON.stringify(product),
            );
        });
    }
});

test("the product object is authoritative: manifest drift fails discovery", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(
            fxRoot,
            "tremolo_lab",
            "TremoloLab.cmajorpatch",
            { ...createFixtureIdentityManifest(), version: "0.2.0" },
            { product: createFixtureProduct() },
        );

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /TremoloLab\.plugin\.json is authoritative .* disagrees with its manifest: version \(manifest "0\.2\.0", TremoloLab\.plugin\.json "0\.1\.0"\)/,
        );
    });
});

test("only <Name>.plugin.json configures a patch; other JSON files beside it are not plugin configuration", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", { name: "Tremolo Lab" });
        await writeJsonOrText(path.join(fxRoot, "tremolo_lab", "TremoloLab.build.json"), { cmakeTarget: "NotRead" });
        await writeJsonOrText(path.join(fxRoot, "tremolo_lab", "product.json"), createFixtureProduct());

        const plugin = buildModule.discoverEffectPlugins({ fxRoot })["tremolo-lab"];

        assert.equal(plugin.cmakeTarget, "TremoloLab");
        assert.equal(plugin.product, undefined);
    });
});

test("duplicate plugin codes and bundle identifiers fail discovery naming both claiming patches", async () => {
    const { buildModule } = await loadBuildModules();

    // Manifest-only identities collide with each other...
    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "first_lab", "First.cmajorpatch", {
            name: "First",
            ID: "dev.cosimo.first-lab",
            plugin: { pluginCode: "CsDu", manufacturerCode: "Cosi" },
        });
        await writeFixturePlugin(fxRoot, "second_lab", "Second.cmajorpatch", {
            name: "Second",
            ID: "dev.cosimo.second-lab",
            plugin: { pluginCode: "CsDu", manufacturerCode: "Cosi" },
        });

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /pluginCode "CsDu" is claimed by both fx\/first_lab\/First\.cmajorpatch and fx\/second_lab\/Second\.cmajorpatch/,
        );
    });

    // ...and with config-driven identities.
    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", createFixtureIdentityManifest(), {
            product: createFixtureProduct(),
        });
        await writeFixturePlugin(fxRoot, "squatter_lab", "Squatter.cmajorpatch", {
            name: "Squatter",
            ID: "dev.cosimo.tremolo-lab",
            plugin: { pluginCode: "CsSq", manufacturerCode: "Cosi" },
        });

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /bundle identifier "dev\.cosimo\.tremolo-lab" is claimed by both fx\/squatter_lab\/Squatter\.cmajorpatch and fx\/tremolo_lab\/TremoloLab\.cmajorpatch/,
        );
    });
});

test("every shipped plugin uses one <Name>.plugin.json and only enhancer_lite carries a product object", async () => {
    const { buildModule } = await loadBuildModules();
    const plugin = buildModule.getEffectPlugins()["enhancer-lite"];
    const owner = buildModule.readProductOwner();

    assert.deepEqual(owner.owner, {
        manufacturer: "Cosimo",
        manufacturerCode: "Cosi",
        pluginCodePrefix: "Cs",
        bundleIdentifierPrefix: "dev.cosimo",
        supportUrl: owner.owner.supportUrl,
    });
    assert.deepEqual(plugin.identity, {
        ID: "dev.cosimo.enhancer-lite",
        name: "Enhance That",
        manufacturer: "Cosimo",
        version: "0.1.0",
        plugin: { pluginCode: "CsEL", manufacturerCode: "Cosi" },
    });
    assert.equal(plugin.productName, "EnhanceThat");
    assert.equal(plugin.cmakeTarget, "EnhanceThat");
    assert.equal(plugin.product.supportUrl, owner.owner.supportUrl, "the support URL is inherited from product-owner.json");

    // Every other plugin keeps manifest-only identity (no product object
    // means the patch manifest is authoritative).
    for (const [pluginName, other] of Object.entries(buildModule.getEffectPlugins())) {
        if (pluginName !== "enhancer-lite") {
            assert.equal(other.identity, undefined, pluginName);
            assert.equal(other.product, undefined, pluginName);
        }
    }

    // One config per patch.
    for (const [pluginName, target] of Object.entries(buildModule.getEffectPlugins())) {
        const configPath = path.join(repoRoot, target.patch.replace(/\.cmajorpatch$/, ".plugin.json"));
        const config = JSON.parse(await readFile(configPath, "utf8"));

        assert.equal(config.schemaVersion, 1, pluginName);
        assert.equal(config.alias, pluginName);
        assert.equal(config.cmakeTarget, target.cmakeTarget);
        assert.equal(config.productName, target.productName);
    }

    // Identity claims cover all discovered plugins, config-driven or not, and
    // are collision-free across the shipped set.
    const claims = buildModule.collectEffectIdentityClaims();
    const targetCount = buildModule.effectPluginTargetNames().length;

    assert.equal(claims.pluginCodes.size, targetCount);
    assert.equal(claims.bundleIdentifiers.size, targetCount);
    assert.equal(claims.pluginCodes.get("CsEL"), "fx/enhancer_lite/EnhancerLite.cmajorpatch");
    assert.equal(claims.bundleIdentifiers.get("dev.cosimo.enhancer-lite"), "fx/enhancer_lite/EnhancerLite.cmajorpatch");

    // The runtime manifest the build writes must be identical to the source
    // manifest apart from the established escaped-source flattening — the
    // identity rewrite may never change shipped bytes.
    const sourceManifest = JSON.parse(await readFile(path.join(repoRoot, plugin.patch), "utf8"));
    const runtimeManifest = buildModule.createRuntimePatchManifest(sourceManifest, plugin);
    // The state module's generated worker is the one addition.
    const { source: rewrittenSource, worker, ...runtimeRest } = runtimeManifest;
    const { source: originalSource, ...sourceRest } = sourceManifest;

    assert.equal(plugin.stateSource, "fx/enhancer_lite/state.ts");
    assert.equal(worker, "worker.js");
    assert.deepEqual(runtimeRest, sourceRest);
    assert.deepEqual(Object.keys(runtimeManifest), [...Object.keys(sourceManifest), "worker"]);
});

test("kit/index.ts names its public surface explicitly, in groups, and covers everything shipped code imports", async () => {
    const entry = path.join(repoRoot, "kit/index.ts");
    const indexSource = await readFile(entry, "utf8");

    assert.doesNotMatch(indexSource, /^export \* from /m, "every public name is listed; only the Mseg and Native namespaces use export * as");
    assert.deepEqual([...indexSource.matchAll(/^export \* as (\w+) from /gm)].map((match) => match[1]), ["Native", "Mseg"]);
    const groups = [...indexSource.matchAll(/^\/\/ (State and history|Presets and snapshots|Controls|Patch connection|Browser preview)/gm)]
        .map((match) => match[1]);
    assert.deepEqual(groups, ["State and history", "Presets and snapshots", "Controls", "Patch connection", "Browser preview"]);
    assert.match(indexSource, /kit\/docs\/COMPATIBILITY\.md/);
    assert.match(indexSource, /Deep paths under kit\/ui are internal/);

    const { default: ts } = await import("typescript");
    const program = ts.createProgram([entry], {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX, strict: true, skipLibCheck: true, noEmit: true, types: ["vite/client"],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === entry);
    assert.deepEqual(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")), [],
        "every exported name resolves");
    const checker = program.getTypeChecker();
    const exported = new Set(checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(entry))).map((symbol) => symbol.name));
    assert.ok(exported.size >= 85 && exported.size <= 115, `the public surface stays deliberate (${exported.size} names)`);

    const shipped = [path.join(repoRoot, "kit/scripts/new_plugin.mjs")];
    for (const directory of ["fx/enhancer_lite", "kit/examples"]) {
        for (const file of await readdir(path.join(repoRoot, directory), { recursive: true })) {
            if (/\.(?:ts|tsx|mjs|js)$/.test(file)) shipped.push(path.join(repoRoot, directory, file));
        }
    }
    const missing = [];
    for (const file of shipped) {
        const source = await readFile(file, "utf8");
        for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["'](?:\.\.\/)+(?:kit\/)?index["']/g)) {
            for (const specifier of match[1].split(",")) {
                const name = specifier.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
                if (name && !exported.has(name)) missing.push(`${path.relative(repoRoot, file)}: ${name}`);
            }
        }
    }
    assert.deepEqual(missing, [], "shipped code imports only names the public entry exports");
    for (const transport of ["PluginStateDelivery", "PluginStateSubmission", "PluginStateEffect", "PluginStateDeliveryOutcome"])
        assert.equal(exported.has(transport), false, `${transport} is a transport type, not author API`);
    for (const exampleHelper of ["SPECTRUM_PLOT", "ENHANCER_SPECTRUM_PLOT", "advanceEnhancerSpectrum", "EnhancerSpectrumDisplay"])
        assert.equal(exported.has(exampleHelper), false, `${exampleHelper} belongs to the Enhance That example, not the kit`);
});

test("kit:new scaffolds a plugin discovery registers, and identity validation guards the result", async () => {
    const scaffoldModule = await loadScaffoldModule();
    const { buildModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-kit-new-"));
    const fxRoot = path.join(tempRoot, "fx");
    const testsRoot = path.join(tempRoot, "tests");

    try {
        // The loader symlink target must resolve inside the simulated repo.
        await mkdir(path.join(tempRoot, "kit/ui"), { recursive: true });
        await writeFile(path.join(tempRoot, "kit/ui/view-loader.js"), "export default () => {};\n", "utf8");
        await mkdir(fxRoot, { recursive: true });

        // No owner file, no scaffold: every identity derives from it.
        assert.throws(
            () => scaffoldModule.planPluginScaffold("demo_verb", { fxRoot, testsRoot }),
            /product-owner\.json is missing/,
        );
        await writeFixtureOwner(fxRoot, fixtureOwner);

        const plan = scaffoldModule.scaffoldPlugin("demo_verb", { fxRoot, testsRoot });

        assert.equal(plan.alias, "demo-verb");
        assert.equal(plan.pluginCode, "CsDV");
        assert.equal(plan.bundleIdentifier, "dev.cosimo.demo-verb");
        assert.equal(plan.manufacturer, "Cosimo");

        const plugin = buildModule.discoverEffectPlugins({ fxRoot })["demo-verb"];

        assert.equal(plugin.patch, "fx/demo_verb/DemoVerb.cmajorpatch");
        assert.equal(plugin.productName, "DemoVerb");
        assert.equal(plugin.cmakeTarget, "DemoVerb");
        assert.equal(plugin.devModule, "/fx/demo_verb/view/source.tsx");
        assert.deepEqual(plugin.identity, {
            ID: "dev.cosimo.demo-verb",
            name: "Demo Verb",
            manufacturer: "Cosimo",
            version: "0.1.0",
            plugin: { pluginCode: "CsDV", manufacturerCode: "Cosi" },
        });

        // One config file at the current schema.
        const config = JSON.parse(await readFile(path.join(fxRoot, "demo_verb/DemoVerb.plugin.json"), "utf8"));
        const kitManifest = JSON.parse(await readFile(path.join(repoRoot, "kit/kit.json"), "utf8"));

        assert.equal(config.schemaVersion, kitManifest.schemaVersions.plugin);
        assert.equal(config.product.bundleIdentifier, "dev.cosimo.demo-verb");

        // The view entry is a link to the shared kit loader.
        assert.equal(
            await realpath(path.join(fxRoot, "demo_verb/view/index.js")),
            await realpath(path.join(tempRoot, "kit/ui/view-loader.js")),
        );

        // The starter test and view stub follow the kit conventions.
        const starterTest = await readFile(plan.starterTestPath, "utf8");
        const viewSource = await readFile(path.join(fxRoot, "demo_verb/view/source.tsx"), "utf8");

        assert.equal(plan.starterTestPath, path.join(testsRoot, "test_demo_verb_state.mjs"));
        assert.match(starterTest, /getEffectPlugin\("demo-verb"\)/);
        assert.match(starterTest, /loadUIModule\(repoRoot, `\$\{pluginDirectory\}\/state\.ts`\)/);
        assert.match(starterTest, /is an input value in the DSP/);
        // The gain range is written once in the view; the DSP declares the same bounds.
        assert.equal(viewSource.match(/-24/g)?.length, 1, viewSource);
        assert.match(await readFile(path.join(fxRoot, "demo_verb/DemoVerb.cmajor"), "utf8"), /min: -24\.0f, max: 24\.0f/);
        assert.match(viewSource, /export default createStatefulPatchView/);
        assert.match(viewSource, /<h1>Demo Verb<\/h1>/);
        assert.equal(config.stateSource, "fx/demo_verb/state.ts");
        await access(path.join(fxRoot, "demo_verb/state.ts"));
        await access(path.join(fxRoot, "demo_verb/DemoVerb.cmajor"));

        // Identity validation catches a later duplicate pluginCode.
        await writeFixturePlugin(fxRoot, "dup_lab", "DupLab.cmajorpatch", {
            name: "Dup Lab",
            ID: "dev.cosimo.dup-lab",
            plugin: { pluginCode: "CsDV", manufacturerCode: "Cosi" },
        });
        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /pluginCode "CsDV" is claimed by both fx\/demo_verb\/DemoVerb\.cmajorpatch and fx\/dup_lab\/DupLab\.cmajorpatch/,
        );
        await rm(path.join(fxRoot, "dup_lab"), { recursive: true, force: true });

        // kit:new refuses colliding directories, aliases, codes, and ids.
        assert.throws(
            () => scaffoldModule.planPluginScaffold("demo_verb", { fxRoot, testsRoot }),
            /fx\/demo_verb already exists/,
        );
        assert.throws(
            () => scaffoldModule.planPluginScaffold("demo-verb", { fxRoot, testsRoot }),
            /fx\/demo_verb already exists/,
        );

        await writeFixturePlugin(fxRoot, "other_lab", "OtherLab.cmajorpatch", { name: "Other Lab" }, { alias: "spare-verb" });
        assert.throws(
            () => scaffoldModule.planPluginScaffold("spare_verb", { fxRoot, testsRoot }),
            /alias "spare-verb" is already claimed by fx\/other_lab\/OtherLab\.cmajorpatch/,
        );
        await rm(path.join(fxRoot, "other_lab"), { recursive: true, force: true });

        await writeFixturePlugin(fxRoot, "noise_lab", "NoiseLab.cmajorpatch", {
            name: "Noise Lab",
            ID: "dev.cosimo.noise-verb",
            plugin: { pluginCode: "CsNV", manufacturerCode: "Cosi" },
        });
        assert.throws(
            () => scaffoldModule.planPluginScaffold("noise_verb", { fxRoot, testsRoot }),
            /pluginCode "CsNV" is already claimed by fx\/noise_lab\/NoiseLab\.cmajorpatch/,
        );
        await rm(path.join(fxRoot, "noise_lab"), { recursive: true, force: true });

        await writeFixturePlugin(fxRoot, "squat_lab", "SquatLab.cmajorpatch", {
            name: "Squat Lab",
            ID: "dev.cosimo.quiet-verb",
        });
        assert.throws(
            () => scaffoldModule.planPluginScaffold("quiet_verb", { fxRoot, testsRoot }),
            /bundle identifier "dev\.cosimo\.quiet-verb" is already claimed by fx\/squat_lab\/SquatLab\.cmajorpatch/,
        );
        await rm(path.join(fxRoot, "squat_lab"), { recursive: true, force: true });

        // The kit's unedited placeholder owner is refused, naming the file and each key still to edit.
        const templateOwner = JSON.parse(await readFile(path.join(repoRoot, "kit/template/root/product-owner.json"), "utf8"));
        await writeFixtureOwner(fxRoot, templateOwner);
        assert.throws(
            () => scaffoldModule.planPluginScaffold("tape_echo", { fxRoot, testsRoot }),
            (error) => error.message.includes(path.join(tempRoot, "product-owner.json"))
                && /still holds the template's placeholder values for manufacturer, manufacturerCode, bundleIdentifierPrefix, supportUrl\./.test(error.message),
        );
        await writeFixtureOwner(fxRoot, { ...templateOwner, manufacturer: "Tape Works", supportUrl: "https://tape.example.org/help" });
        assert.throws(
            () => scaffoldModule.planPluginScaffold("tape_echo", { fxRoot, testsRoot }),
            /placeholder values for manufacturerCode, bundleIdentifierPrefix\. Replace them/,
        );
        await access(path.join(fxRoot, "demo_verb"));
        assert.equal(existsSync(path.join(fxRoot, "tape_echo")), false, "a refused scaffold writes nothing");

        // A different owner yields a different identity from the same name —
        // the scaffold carries no manufacturer of its own.
        await writeFixtureOwner(fxRoot, { manufacturer: "Tape Works", manufacturerCode: "Tawo", bundleIdentifierPrefix: "org.tapeworks" });

        const customerPlan = scaffoldModule.scaffoldPlugin("tape_echo", { fxRoot, testsRoot });
        const customerManifest = JSON.parse(await readFile(path.join(fxRoot, "tape_echo/TapeEcho.cmajorpatch"), "utf8"));

        assert.equal(customerPlan.pluginCode, "TaTE");
        assert.equal(customerPlan.bundleIdentifier, "org.tapeworks.tape-echo");
        assert.equal(customerManifest.manufacturer, "Tape Works");
        assert.deepEqual(customerManifest.plugin, { pluginCode: "TaTE", manufacturerCode: "Tawo" });
        assert.equal(buildModule.discoverEffectPlugins({ fxRoot })["tape-echo"].identity.ID, "org.tapeworks.tape-echo");

        // Next steps align every comment after the longest command.
        const steps = scaffoldModule.nextSteps(customerPlan).split("\n").filter((line) => line.includes(" # "));
        assert.equal(steps.length, 3);
        assert.equal(new Set(steps.map((line) => line.indexOf(" # "))).size, 1, steps.join("\n"));

        // Name hygiene: reserved and malformed names are refused up front.
        assert.throws(() => scaffoldModule.parsePluginName("all"), /reserved/);
        assert.throws(() => scaffoldModule.parsePluginName("Bad Name"), /Invalid plugin name/);
        assert.throws(() => scaffoldModule.parsePluginName("9lives"), /Invalid plugin name/);
        assert.throws(() => scaffoldModule.parsePluginName("x"), /too short/);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }

    // The scaffold itself names no owner: every literal comes from product-owner.json.
    const scaffoldSource = await readFile(path.join(repoRoot, "kit/scripts/new_plugin.mjs"), "utf8");

    assert.doesNotMatch(scaffoldSource, /Cosimo|"Cosi"|dev\.cosimo|cosimo-/);
});

test("kit:new CLI prints usage and fails on missing or extra arguments", () => {
    const cliPath = path.join(repoRoot, "kit/scripts/new_plugin.mjs");
    const noArguments = spawnSync(process.execPath, [cliPath], { encoding: "utf8" });
    const extraArguments = spawnSync(process.execPath, [cliPath, "demo_verb", "extra"], { encoding: "utf8" });

    assert.equal(noArguments.status, 1);
    assert.match(noArguments.stderr, /Usage: npm run kit:new -- <name>/);
    assert.equal(extraArguments.status, 1);
    assert.match(extraArguments.stderr, /Usage: npm run kit:new -- <name>/);
});

test("jit install plans pair each target with its runtime patch and build requirement", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "plain_lab", "Plain.cmajorpatch", { name: "Plain" });
        await writeFixturePlugin(fxRoot, "worker_lab", "Worker.cmajorpatch", { name: "Worker" }, {
            workerSource: "fx/worker_lab/worker/source.ts",
        });
        await writeFixturePlugin(fxRoot, "pinned_lab", "Pinned.cmajorpatch", { name: "Pinned" }, {
            jitInstallRuntime: true,
        });

        const plugins = buildModule.discoverEffectPlugins({ fxRoot });

        assert.deepEqual(buildModule.createJitInstallPlan("plain-lab", plugins), {
            name: "plain-lab",
            patch: "fx/plain_lab/Plain.cmajorpatch",
            runtimePatch: "build/fx/plain_lab_runtime/Plain.cmajorpatch",
            jitInstallRuntime: false,
        });
        assert.equal(buildModule.createJitInstallPlan("worker-lab", plugins).jitInstallRuntime, true);
        assert.equal(buildModule.createJitInstallPlan("pinned-lab", plugins).jitInstallRuntime, true);
        assert.throws(
            () => buildModule.createJitInstallPlan("missing-lab", plugins),
            /Unknown effect plugin: "missing-lab"\. Available plugins: pinned-lab, plain-lab, worker-lab\./,
        );
    });
});

test("every jit install plan points at a patch whose declared view entry will exist", async () => {
    const { buildModule } = await loadBuildModules();

    for (const pluginName of buildModule.effectPluginTargetNames()) {
        const plan = buildModule.createJitInstallPlan(pluginName);

        // Source-patch installs need the checked-in view/index.js loader next
        // to the patch; runtime installs get one copied in by the build. A
        // target with neither would install a patch whose view.src does not
        // exist (no UI). Fix: add the loader link, or set jitInstallRuntime.
        if (!plan.jitInstallRuntime)
            await access(path.join(repoRoot, path.dirname(plan.patch), "view", "index.js"));
    }

    // The enhancer family has no checked-in loader link, so their JIT installs
    // must build and point at the runtime patch (the 2.1 "JIT-installable" win).
    for (const pluginName of ["enhancer", "enhancer-lite"])
        assert.equal(buildModule.createJitInstallPlan(pluginName).jitInstallRuntime, true, pluginName);
});

test("Chorus Lab, OTT Lab and Spectral Chord Resonator declare their state through the kit and install from their built runtime", async () => {
    const { buildModule } = await loadBuildModules();

    for (const [pluginName, directory, patchFile, viewSource] of [
        ["chorus", "fx/chorus_lab", "ChorusLab.cmajorpatch", "source.ts"],
        ["ott", "fx/ott_lab", "OttLab.cmajorpatch", "source.ts"],
        ["spectral", "fx/spectral_chord_resonator", "SpectralChordResonator.cmajorpatch", "source.tsx"],
    ]) {
        const plugin = buildModule.getEffectPlugins()[pluginName];

        assert.equal(plugin.stateSource, `${directory}/state.ts`, pluginName);
        assert.equal(plugin.workerSource, undefined, `${pluginName} has no hand-written worker`);
        assert.equal(plugin.devModule, `/${directory}/view/${viewSource}`, pluginName);
        assert.equal(buildModule.createJitInstallPlan(pluginName).jitInstallRuntime, true, `${pluginName} installs the runtime that carries its state worker`);
        await assert.rejects(access(path.join(repoRoot, directory, "view", "index.js")), `${pluginName} keeps no source-patch loader link`);

        const sourceManifest = JSON.parse(await readFile(path.join(repoRoot, directory, patchFile), "utf8"));
        assert.equal(buildModule.createRuntimePatchManifest(sourceManifest, plugin).worker, "worker.js", `${pluginName} runs the generated state worker`);
    }
});

test("fx/enhancer_lite ships only the product patch; the shelves audition lives with the calibration tools", async () => {
    const { buildModule } = await loadBuildModules();
    const targetNames = buildModule.effectPluginTargetNames();

    assert.equal(targetNames.includes("enhancer-lite-shelves-audition"), false);
    assert.ok(buildModule.resolvePluginNames("all").includes("enhancer-lite"));
    await access(path.join(repoRoot, "tools/enhancer_calibration/EnhancerLiteShelvesAudition.cmajorpatch"));
    const liteEntries = await readdir(path.join(repoRoot, "fx/enhancer_lite"));
    assert.deepEqual(liteEntries.filter((entry) => entry.endsWith(".cmajorpatch")), ["EnhancerLite.cmajorpatch"]);
    assert.equal(liteEntries.includes("assets"), false, "the rejected wordmark asset no longer ships");
});

test("the enhancer target builds from the canonical T26 DSP source, not a copy", async () => {
    const { buildModule } = await loadBuildModules();
    const manifest = JSON.parse(
        await readFile(path.join(repoRoot, buildModule.getEffectPlugins().enhancer.patch), "utf8"),
    );

    assert.ok(manifest.source.includes("../../cmajor/Enhancer.cmajor"));
    await access(path.join(repoRoot, "cmajor", "Enhancer.cmajor"));
});

test("distribution builds omit runtime source maps only when FX_DISTRIBUTABLE_RUNTIME is 1", async () => {
    const { buildModule } = await loadBuildModules();
    const environmentKey = buildModule.effectDistributableRuntimeEnvironmentKey;

    assert.equal(environmentKey, "FX_DISTRIBUTABLE_RUNTIME");
    assert.equal(buildModule.shouldEmitEffectRuntimeSourceMaps({}), true);
    assert.equal(buildModule.shouldEmitEffectRuntimeSourceMaps({ [environmentKey]: "true" }), true);
    assert.equal(buildModule.shouldEmitEffectRuntimeSourceMaps({ [environmentKey]: "1" }), false);
});

test("a broken plugin folder is reported on its own while the other plugins stay discoverable", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "good_lab", "Good.cmajorpatch", { name: "Good" }, {});
        await writeFixturePlugin(fxRoot, "broken_lab", "Broken.cmajorpatch", { name: "Broken" }, "{ not json");

        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /Broken\.plugin\.json/);

        const failures = [];
        const plugins = buildModule.discoverEffectPlugins({
            fxRoot,
            onPluginError: (directory, error) => failures.push([path.basename(directory), error.message]),
        });

        assert.deepEqual(Object.keys(plugins), ["good-lab"]);
        assert.equal(failures.length, 1);
        assert.equal(failures[0][0], "broken_lab");
        assert.match(failures[0][1], /broken_lab\/Broken\.plugin\.json/);
    });
});

test("manifest entries that escape the patch directory are flattened into the runtime directory and rewritten", async () => {
    const { buildModule } = await loadBuildModules();
    const manifest = {
        source: [
            "../../cmajor/Enhancer.cmajor",
            "EnhancerPlugin.cmajor",
        ],
        resources: ["assets/wordmark.png"],
        view: { src: "view/index.js" },
    };
    const entryPlans = buildModule.planRuntimePatchEntries(manifest);

    assert.deepEqual(entryPlans.source, [
        { entry: "../../cmajor/Enhancer.cmajor", from: "../../cmajor/Enhancer.cmajor", to: "Enhancer.cmajor", escaped: true },
        { entry: "EnhancerPlugin.cmajor", from: "EnhancerPlugin.cmajor", to: "EnhancerPlugin.cmajor", escaped: false },
    ]);
    assert.deepEqual(entryPlans.resources, [
        { entry: "assets/wordmark.png", from: "assets/wordmark.png", to: "assets/wordmark.png", escaped: false },
    ]);

    const runtimeManifest = buildModule.createRuntimePatchManifest(manifest, {});

    assert.deepEqual(runtimeManifest.source, ["Enhancer.cmajor", "EnhancerPlugin.cmajor"]);
    assert.deepEqual(runtimeManifest.resources, ["assets/wordmark.png"]);
    assert.deepEqual(manifest.source, ["../../cmajor/Enhancer.cmajor", "EnhancerPlugin.cmajor"]);

    const singleStringManifest = { source: "../shared/Solo.cmajor" };
    assert.equal(buildModule.createRuntimePatchManifest(singleStringManifest, {}).source, "Solo.cmajor");
});

test("flattened runtime targets are collision-checked against each other and the runtime manifest", async () => {
    const { buildModule } = await loadBuildModules();

    assert.throws(
        () => buildModule.planRuntimePatchEntries({
            source: ["../a/Shared.cmajor", "../b/Shared.cmajor"],
        }),
        /"\.\.\/b\/Shared\.cmajor" maps to runtime path "Shared\.cmajor", which is already used by source entry "\.\.\/a\/Shared\.cmajor"/,
    );
    assert.throws(
        () => buildModule.planRuntimePatchEntries({
            source: ["Local.cmajor", "../other/Local.cmajor"],
        }),
        /already used by source entry "Local\.cmajor"/,
    );
    assert.throws(
        () => buildModule.planRuntimePatchEntries(
            { source: ["../elsewhere/Tremolo.cmajorpatch"] },
            { reservedTargets: ["Tremolo.cmajorpatch"] },
        ),
        /already used by the runtime patch manifest/,
    );
    assert.throws(
        () => buildModule.planRuntimePatchEntries({ source: [".."] }),
        /does not name a file/,
    );
});

test("production runtime manifests remove the development module path without mutating the source manifest", async () => {
    const { buildModule } = await loadBuildModules();
    const manifest = {
        source: ["SeqFx.cmajor"],
        view: {
            src: "view/index.js",
            devModule: "/fx/seqfx/view/source.tsx",
            width: 1120,
            height: 680,
        },
    };
    const localRuntime = buildModule.createRuntimePatchManifest(manifest, {}, {
        stripDevModule: false,
    });
    const distributableRuntime = buildModule.createRuntimePatchManifest(manifest, {}, {
        stripDevModule: true,
    });

    // The dev/JIT pipeline (fx:build) keeps the dev module by default; only
    // production packaging opts into stripping it.
    assert.equal(buildModule.createRuntimePatchManifest(manifest, {}).view.devModule, "/fx/seqfx/view/source.tsx");
    assert.equal(localRuntime.view.devModule, "/fx/seqfx/view/source.tsx");
    assert.equal("devModule" in distributableRuntime.view, false);
    assert.deepEqual(distributableRuntime.view, {
        src: "view/index.js",
        width: 1120,
        height: 680,
    });
    assert.equal(manifest.view.devModule, "/fx/seqfx/view/source.tsx");
});

test("the CHOC WebView marker check has one implementation shared by node and shell callers", async () => {
    const markersModule = await import(pathToFileURL(path.join(repoRoot, "kit/scripts/check_choc_markers.mjs")));
    const releaseConfigModule = await import(pathToFileURL(path.join(repoRoot, "scripts/seqfx-release-config.mjs")));

    assert.deepEqual(markersModule.requiredChocWebViewMarkers, [
        "chocHostKeyboard",
        "__chocHostKeyboardBridgeInstalled",
        "__chocUserFiles",
        "chocUserFiles",
    ]);
    assert.deepEqual(markersModule.forbiddenChocWebViewMarkers, [
        "cosimoKeyboard",
        "cosimoKeyboardProbe",
        "cosimo-keyboard-probe-panel",
        "forwarded-buffered-flags-changed",
    ]);
    assert.equal(
        releaseConfigModule.seqFxReleaseConfig.webViewMarkers.required,
        markersModule.requiredChocWebViewMarkers,
        "the release config must reference the shared list, not a copy",
    );
    assert.equal(
        releaseConfigModule.seqFxReleaseConfig.webViewMarkers.forbidden,
        markersModule.forbiddenChocWebViewMarkers,
    );

    // The release builder must consume the shared checker too — not keep a
    // parallel grep-based implementation of the same probe.
    const releaseBuilderSource = await readFile(
        path.join(repoRoot, "scripts/build_seqfx_beta_release.mjs"),
        "utf8",
    );
    assert.match(releaseBuilderSource, /findChocMarkerViolations/);
    assert.doesNotMatch(releaseBuilderSource, /"grep"/);

    // Byte-level substring semantics (grep -a -F), stricter than strings(1):
    // markers embedded between non-printable bytes must still be found.
    const patchedBinary = Buffer.concat(markersModule.requiredChocWebViewMarkers.flatMap(
        (marker) => [Buffer.from([0, 1, 2]), Buffer.from(marker)],
    ));
    assert.deepEqual(markersModule.findChocMarkerViolations(patchedBinary), { missing: [], forbidden: [] });
    assert.deepEqual(
        markersModule.findChocMarkerViolations(Buffer.from("chocHostKeyboard\x00cosimoKeyboardProbe")),
        {
            missing: ["__chocHostKeyboardBridgeInstalled", "__chocUserFiles", "chocUserFiles"],
            forbidden: ["cosimoKeyboard", "cosimoKeyboardProbe"],
        },
    );

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-choc-markers-"));

    try {
        const goodBinary = path.join(tempRoot, "good.bin");
        const staleBinary = path.join(tempRoot, "stale.bin");

        await writeFile(goodBinary, patchedBinary);
        await writeFile(staleBinary, Buffer.concat([patchedBinary, Buffer.from("cosimo-keyboard-probe-panel")]));

        const cliPath = path.join(repoRoot, "kit/scripts/check_choc_markers.mjs");
        const goodRun = spawnSync(process.execPath, [cliPath, goodBinary], { encoding: "utf8" });
        const staleRun = spawnSync(process.execPath, [cliPath, staleBinary], { encoding: "utf8" });
        const missingRun = spawnSync(process.execPath, [cliPath, path.join(tempRoot, "absent.bin")], { encoding: "utf8" });
        const usageRun = spawnSync(process.execPath, [cliPath], { encoding: "utf8" });

        assert.equal(goodRun.status, 0, goodRun.stderr);
        assert.equal(staleRun.status, 1);
        assert.match(staleRun.stderr, /Outdated marker\(s\): cosimo-keyboard-probe-panel/);
        assert.equal(missingRun.status, 1);
        assert.equal(usageRun.status, 2);
        assert.match(usageRun.stderr, /Usage: node kit\/scripts\/check_choc_markers\.mjs/);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("the production configure explicitly disables microphone permission metadata when a target opts in", async () => {
    const { prodModule, buildModule } = await loadBuildModules();
    const cmajExecutable = "/opt/fixture/bin/cmaj";
    const plugin = buildModule.getEffectPlugins().seqfx;

    assert.equal(plugin.disableMicrophonePermission, true);
    assert.deepEqual(prodModule.createJuceGenerationConfigureArgs({
        cmajExecutable,
        cmakeBuildDirectory: "/tmp/seqfx-build",
        cmakeSourceDirectory: "/repo/kit/tools/effect_plugin_build",
        disableMicrophonePermission: true,
        juceOutputDirectory: "/repo/build/seqfx_juce",
        pluginTarget: "CosimoSeqFX",
        runtimePatchPath: "/repo/build/fx/seqfx_runtime/SeqFx.cmajorpatch",
    }), [
        "-S", "/repo/kit/tools/effect_plugin_build",
        "-B", "/tmp/seqfx-build",
        "-DCMAKE_BUILD_TYPE=Release",
        "-DBUILDER_KIT_EFFECT_PATCH_PATH=/repo/build/fx/seqfx_runtime/SeqFx.cmajorpatch",
        "-DBUILDER_KIT_EFFECT_OUTPUT_DIR=/repo/build/seqfx_juce",
        "-DBUILDER_KIT_EFFECT_PLUGIN_TARGET=CosimoSeqFX",
        `-DBUILDER_KIT_CMAJ_EXECUTABLE=${cmajExecutable}`,
        "-DBUILDER_KIT_DISABLE_MICROPHONE_PERMISSION=ON",
    ]);
    const wrapperCmake = await readFile(
        path.join(repoRoot, "kit", "tools", "effect_plugin_build", "CMakeLists.txt"),
        "utf8",
    );
    assert.match(wrapperCmake, /set\(BUILDER_KIT_CMAJ_EXECUTABLE "" CACHE FILEPATH/u);
    assert.match(wrapperCmake, /IS_ABSOLUTE "\$\{BUILDER_KIT_CMAJ_EXECUTABLE\}"/u);
    assert.match(wrapperCmake, /option\(BUILDER_KIT_DISABLE_MICROPHONE_PERMISSION/u);
    assert.match(wrapperCmake, /--juceMicrophonePermissionEnabled=false/u);
    assert.doesNotMatch(wrapperCmake, /SeqFxGeneratedPluginMetadata/u);
    assert.doesNotMatch(wrapperCmake, /cosimo_disable_generated_microphone_permission/u);
});

test("the production configure resets disabled and removed options without disturbing user cache values", async () => {
    const { prodModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-config-reset-"));
    const sourceDirectory = path.join(tempRoot, "source");
    const buildDirectory = path.join(tempRoot, "build");
    const common = {
        cmajExecutable: "/opt/fixture/bin/cmaj",
        cmakeBuildDirectory: buildDirectory,
        cmakeSourceDirectory: sourceDirectory,
        juceOutputDirectory: path.join(tempRoot, "juce"),
        pluginTarget: "FixturePlugin",
        runtimePatchPath: path.join(tempRoot, "Fixture.cmajorpatch"),
    };

    try {
        await mkdir(sourceDirectory, { recursive: true });
        await writeFile(path.join(sourceDirectory, "CMakeLists.txt"), [
            "cmake_minimum_required(VERSION 3.28)",
            "project(ConfigurationReset NONE)",
            "option(BUILDER_KIT_DISABLE_MICROPHONE_PERMISSION \"fixture\" OFF)",
            "set(UNRELATED_USER_SETTING \"default\" CACHE STRING \"fixture\")",
            "file(WRITE \"${CMAKE_BINARY_DIR}/microphone.txt\" \"${BUILDER_KIT_DISABLE_MICROPHONE_PERMISSION}\\n\")",
            "file(WRITE \"${CMAKE_BINARY_DIR}/user-setting.txt\" \"${UNRELATED_USER_SETTING}\\n\")",
            "",
        ].join("\n"));

        const enabled = spawnSync("cmake", [
            ...prodModule.createJuceGenerationConfigureArgs({
                ...common,
                disableMicrophonePermission: true,
            }),
            "-DUNRELATED_USER_SETTING=customer",
        ], { encoding: "utf8" });
        assert.equal(enabled.status, 0, enabled.stderr);
        assert.equal(await readFile(path.join(buildDirectory, "microphone.txt"), "utf8"), "ON\n");
        assert.equal(await readFile(path.join(buildDirectory, "user-setting.txt"), "utf8"), "customer\n");

        const disabled = spawnSync("cmake", prodModule.createJuceGenerationConfigureArgs({
            ...common,
            disableMicrophonePermission: false,
        }), { encoding: "utf8" });
        assert.equal(disabled.status, 0, disabled.stderr);
        assert.equal(await readFile(path.join(buildDirectory, "microphone.txt"), "utf8"), "OFF\n");
        assert.equal(await readFile(path.join(buildDirectory, "user-setting.txt"), "utf8"), "customer\n");

        const reenabled = spawnSync("cmake", prodModule.createJuceGenerationConfigureArgs({
            ...common,
            disableMicrophonePermission: true,
        }), { encoding: "utf8" });
        assert.equal(reenabled.status, 0, reenabled.stderr);
        assert.equal(await readFile(path.join(buildDirectory, "microphone.txt"), "utf8"), "ON\n");

        const removed = spawnSync("cmake", prodModule.createJuceGenerationConfigureArgs(common), {
            encoding: "utf8",
        });
        assert.equal(removed.status, 0, removed.stderr);
        assert.equal(await readFile(path.join(buildDirectory, "microphone.txt"), "utf8"), "OFF\n");
        assert.equal(await readFile(path.join(buildDirectory, "user-setting.txt"), "utf8"), "customer\n");
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("SeqFX uses ordinary supported resizing without a generated editor-width patch", async () => {
    const { buildModule, prodModule } = await loadBuildModules();
    const seqFx = buildModule.getEffectPlugins().seqfx;
    const extractor = path.join(
        repoRoot,
        "kit/tools/effect_plugin_build/read_generated_plugin_info_class.cmake",
    );
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-editor-width-"));

    try {
        const generatedSource = path.join(tempRoot, "cmajor_plugin.cpp");
        const driftedSource = path.join(tempRoot, "drifted.cpp");
        await writeFile(generatedSource, [
            '#include "cmajor/helpers/cmaj_JUCEPlugin.h"',
            "juce::AudioProcessor* createPluginFilter()",
            "{",
            "    using Plugin = cmaj::plugin::GeneratedPlugin<::SeqFx>;",
            "}",
            "",
        ].join("\n"));
        await writeFile(driftedSource, "using Plugin = UnexpectedGeneratedPlugin<::SeqFx>;\n");

        const extracted = spawnSync(
            "cmake",
            [`-DBUILDER_KIT_GENERATED_PLUGIN_SOURCE=${generatedSource}`, "-P", extractor],
            { cwd: repoRoot, encoding: "utf8" },
        );
        assert.equal(extracted.status, 0, extracted.stderr);
        assert.match(`${extracted.stdout}${extracted.stderr}`, /-- SeqFx/u);

        const rejectedDrift = spawnSync(
            "cmake",
            [`-DBUILDER_KIT_GENERATED_PLUGIN_SOURCE=${driftedSource}`, "-P", extractor],
            { cwd: repoRoot, encoding: "utf8" },
        );
        assert.notEqual(rejectedDrift.status, 0);
        assert.match(rejectedDrift.stderr, /Expected exactly one generated JUCE factory type.*found 0/su);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }

    assert.equal("editorMaxWidth" in seqFx, false);
    assert.equal(JSON.parse(await readFile(path.join(repoRoot, seqFx.patch), "utf8")).view.resizable, true);
    await assert.rejects(
        access(path.join(repoRoot, "kit/tools/effect_plugin_build/CosimoBoundedGeneratedPlugin.h")),
        { code: "ENOENT" },
    );
    await assert.rejects(
        access(path.join(repoRoot, "kit/tools/effect_plugin_build/apply_generated_editor_width_ceiling.cmake")),
        { code: "ENOENT" },
    );

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "width_lab", "WidthLab.cmajorpatch", { name: "Width Lab" }, {
            editorMaxWidth: 1120,
        });
        assert.throws(() => buildModule.discoverEffectPlugins({ fxRoot }), /unknown key "editorMaxWidth"/u);
    });

    const configureArgs = prodModule.createJuceGenerationConfigureArgs({
        cmajExecutable: "/opt/fixture/bin/cmaj",
        cmakeBuildDirectory: "/tmp/build",
        cmakeSourceDirectory: "/tmp/source",
        juceOutputDirectory: "/tmp/juce",
        pluginTarget: "CosimoSeqFX",
        runtimePatchPath: "/tmp/SeqFx.cmajorpatch",
    });
    assert.equal(configureArgs.some((argument) => argument.includes("EDITOR_MAX_WIDTH")), false);
});

test("BUILDER_KIT_CMAKE names an absolute CMake for production builds", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.resolveProdBuildToolPaths({}, "darwin"), { cmake: "cmake", codesign: "/usr/bin/codesign" });
    assert.deepEqual(prodModule.resolveProdBuildToolPaths({ BUILDER_KIT_CMAKE: "/approved/cmake" }, "darwin"), {
        cmake: "/approved/cmake",
        codesign: "/usr/bin/codesign",
    });
    assert.throws(
        () => prodModule.resolveProdBuildToolPaths({ BUILDER_KIT_CMAKE: "cmake" }, "darwin"),
        /BUILDER_KIT_CMAKE must be an absolute path/u,
    );
});

test("fx_build_unknown_plugin_reports_all_and_every_discovered_target", async () => {
    const { buildModule, prodModule } = await loadBuildModules();
    const expectedNames = ["all", ...buildModule.effectPluginTargetNames()].join(", ");

    for (const resolve of [buildModule.resolvePluginNames, prodModule.resolveProdPluginNames]) {
        assert.throws(() => resolve("wat"), (error) => {
            assert.ok(error.message.includes(`Available plugins: ${expectedNames}`));
            return true;
        });
    }
});

test("effect production passes the resolved cmaj to the generator project without runtime tool lookup", async () => {
    const { prodModule } = await loadBuildModules();
    const cmajExecutable = "/opt/fixture/bin/cmaj";
    const generationProject = await readFile(
        path.join(repoRoot, "kit/tools/effect_plugin_build/CMakeLists.txt"),
        "utf8",
    );
    const commandProject = await readFile(
        path.join(repoRoot, "tools/cmajor_command_build/CMakeLists.txt"),
        "utf8",
    );

    assert.deepEqual(
        prodModule.createJuceGenerationConfigureArgs({
            cmakeSourceDirectory: "/tmp/effect-source",
            cmakeBuildDirectory: "/tmp/effect-build",
            runtimePatchPath: "/tmp/effect.cmajorpatch",
            juceOutputDirectory: "/tmp/effect-juce",
            pluginTarget: "CosimoEnhancer",
            cmajExecutable,
        }),
        [
            "-S", "/tmp/effect-source",
            "-B", "/tmp/effect-build",
            "-DCMAKE_BUILD_TYPE=Release",
            "-DBUILDER_KIT_EFFECT_PATCH_PATH=/tmp/effect.cmajorpatch",
            "-DBUILDER_KIT_EFFECT_OUTPUT_DIR=/tmp/effect-juce",
            "-DBUILDER_KIT_EFFECT_PLUGIN_TARGET=CosimoEnhancer",
            `-DBUILDER_KIT_CMAJ_EXECUTABLE=${cmajExecutable}`,
            "-DBUILDER_KIT_DISABLE_MICROPHONE_PERMISSION=OFF",
        ],
    );
    assert.equal("replaceGeneratedPluginLatency" in prodModule, false);
    assert.doesNotMatch(generationProject, /find_program\s*\([^)]*cmaj/su);
    assert.match(generationProject, /BUILDER_KIT_CMAJ_EXECUTABLE/u);
    assert.match(generationProject, /builder_kit_dependencies\(\)/u);
    assert.doesNotMatch(generationProject, /builder_kit_toolchain_dependencies\(\)/u);
    assert.doesNotMatch(generationProject, /identity_probe/u);
    assert.match(commandProject, /builder_kit_toolchain_dependencies\(\)/u);
    assert.doesNotMatch(commandProject, /builder_kit_dependencies\(\)/u);
    assert.match(commandProject, /add_subdirectory\s*\(\s*"\$\{BUILDER_KIT_CMAJOR_SOURCE_DIR\}"/su);
    assert.match(commandProject, /set\(WARNINGS_AS_ERRORS ON CACHE BOOL/u);
    assert.doesNotMatch(commandProject, /WARNINGS_AS_ERRORS OFF/u);
    assert.deepEqual(prodModule.createProdBuildChildArgs("enhancer", { clean: true }), [
        path.join(repoRoot, "kit/fx/prod-effect.mjs"),
        "build",
        "enhancer",
        "--clean",
    ]);
});

test("cmaj resolves from BUILDER_KIT_CMAJ, else the verified download, else names kit:setup", async () => {
    const { createHash } = await import("node:crypto");
    const { installArtifact } = await import("../kit/scripts/setup.mjs");
    const { resolveCmajExecutable } = await import("../kit/scripts/toolchain.mjs");
    const root = await mkdtemp(path.join(os.tmpdir(), "kit-cmaj-resolution-"));

    try {
        const downloaded = path.join(root, "build/kit-tools/cmaj");
        const artifact = "tools/cmaj-test.tar.gz";
        const writeToolchain = (sha256) => writeJsonOrText(path.join(root, "kit/toolchain.json"), {
            cmaj: { artifact, sha256, localPath: "build/kit-tools/cmaj" },
            cmajPlugin: { artifact: "tools/plugin.zip", sha256: "", localPath: "build/kit-tools/CmajPlugin.vst3" },
        });

        await mkdir(path.join(root, "kit"), { recursive: true });
        await writeToolchain("");
        await assert.rejects(resolveCmajExecutable({ root, environment: {} }), /cmaj at build\/kit-tools\/cmaj is missing\. Run npm run kit:setup/u);

        await mkdir(path.dirname(downloaded), { recursive: true });
        await writeFile(downloaded, "#!/bin/sh\necho fake cmaj\n");
        const archivePath = path.join(root, "cmaj.tar.gz");
        const packed = spawnSync("tar", ["-czf", archivePath, "-C", path.dirname(downloaded), "cmaj"], { encoding: "utf8" });
        assert.equal(packed.status, 0, packed.stderr);
        const bytes = await readFile(archivePath);
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        await installArtifact({ key: "cmaj", artifact, bytes, pin: sha256, localPath: downloaded });

        await assert.rejects(resolveCmajExecutable({ root, environment: {} }), /is unpinned\. kit\/toolchain\.json carries no sha256/u);
        await writeToolchain(sha256);
        assert.equal(await resolveCmajExecutable({ root, environment: {} }), downloaded);
        await writeToolchain("0".repeat(64));
        await assert.rejects(resolveCmajExecutable({ root, environment: {} }), /is stale\. It does not match kit\/toolchain\.json; run npm run kit:setup/u);

        // An explicit executable wins, but naming the download keeps its hash check.
        const maintainerCmaj = path.join(root, "maintainer-cmaj");
        await writeFile(maintainerCmaj, "#!/bin/sh\n", { mode: 0o755 });
        assert.equal(await resolveCmajExecutable({ root, environment: { BUILDER_KIT_CMAJ: maintainerCmaj } }), maintainerCmaj);
        await assert.rejects(resolveCmajExecutable({ root, environment: { BUILDER_KIT_CMAJ: downloaded } }), /is stale/u);
        await assert.rejects(resolveCmajExecutable({ root, environment: { BUILDER_KIT_CMAJ: "cmaj" } }), /must be an absolute path/u);
        await assert.rejects(
            resolveCmajExecutable({ root, environment: { BUILDER_KIT_CMAJ: path.join(root, "absent") } }),
            /is not an executable file\. Unset it to use the cmaj from npm run kit:setup/u,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("generated latency probe resolves the generator-authored factory type exactly once", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-generated-plugin-type-"));
    const extractor = path.join(
        repoRoot,
        "kit/tools/effect_plugin_build/read_generated_plugin_info_class.cmake",
    );
    const runExtractor = (sourcePath) => spawnSync(
        "cmake",
        [`-DBUILDER_KIT_GENERATED_PLUGIN_SOURCE=${sourcePath}`, "-P", extractor],
        { cwd: repoRoot, encoding: "utf8" },
    );

    try {
        const ottSource = path.join(tempRoot, "ott.cpp");
        const enhancerSource = path.join(tempRoot, "enhancer.cpp");
        const ambiguousSource = path.join(tempRoot, "ambiguous.cpp");
        const missingSource = path.join(tempRoot, "missing.cpp");
        const factoryLine = (infoClass) =>
            `    using Plugin = cmaj::plugin::GeneratedPlugin<::${infoClass}>;\n`;

        await writeFile(ottSource, factoryLine("OttLab"));
        await writeFile(enhancerSource, factoryLine("CosimoEnhancer"));
        await writeFile(
            ambiguousSource,
            factoryLine("OttLab") + factoryLine("CosimoEnhancer"),
        );
        await writeFile(missingSource, "juce::AudioProcessor* createPluginFilter();\n");

        const ottResult = runExtractor(ottSource);
        const enhancerResult = runExtractor(enhancerSource);
        const ambiguousResult = runExtractor(ambiguousSource);
        const missingResult = runExtractor(missingSource);

        assert.equal(ottResult.status, 0, ottResult.stderr);
        assert.match(`${ottResult.stdout}${ottResult.stderr}`, /-- OttLab/u);
        assert.equal(enhancerResult.status, 0, enhancerResult.stderr);
        assert.match(`${enhancerResult.stdout}${enhancerResult.stderr}`, /-- CosimoEnhancer/u);
        assert.notEqual(ambiguousResult.status, 0);
        assert.match(ambiguousResult.stderr, /Expected exactly one.*found 2/su);
        assert.notEqual(missingResult.status, 0);
        assert.match(missingResult.stderr, /Expected exactly one.*found 0/su);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("fx_prod_install_accepts_all_with_dry_run_without_swallowing_unknown_flags", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.parseArgs(["node", "prod-effect.mjs", "install", "all", "--dry-run"]), {
        action: "install",
        pluginName: "all",
        clean: false,
        dryRun: true,
        help: false,
    });
    assert.deepEqual(prodModule.parseArgs(["node", "prod-effect.mjs", "build", "seqfx", "--clean"]), {
        action: "build",
        pluginName: "seqfx",
        clean: true,
        dryRun: false,
        help: false,
    });
    assert.throws(
        () => prodModule.parseArgs(["node", "prod-effect.mjs", "install", "all", "--wat"]),
        /Unknown argument: --wat/,
    );
});

test("fx_prod_build_help_prints_usage_and_succeeds_without_a_plugin_name", () => {
    const help = spawnSync(process.execPath, [path.join(repoRoot, "kit/fx/prod-effect.mjs"), "build", "--help"], { encoding: "utf8" });

    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /^Usage:/u);
});

test("fx_prod_parallelism_defaults_to_three_plugin_builds_and_splits_cmake_jobs", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.resolveProdBuildParallelism(3, {}, 8), {
        pluginJobs: 3,
        cmakeJobs: 2,
    });
    assert.deepEqual(prodModule.resolveProdBuildParallelism(1, {}, 8), {
        pluginJobs: 1,
        cmakeJobs: 8,
    });
    assert.deepEqual(prodModule.resolveProdBuildParallelism(3, {}, 1), {
        pluginJobs: 1,
        cmakeJobs: 1,
    });
});

test("fx_prod_parallelism_accepts_explicit_safe_overrides", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.resolveProdBuildParallelism(
        3,
        {
            BUILDER_KIT_PLUGIN_JOBS: "3",
            BUILDER_KIT_CMAKE_JOBS: "2",
        },
        8,
    ), {
        pluginJobs: 3,
        cmakeJobs: 2,
    });
    assert.deepEqual(prodModule.resolveProdBuildParallelism(
        3,
        {
            BUILDER_KIT_PLUGIN_JOBS: "99",
        },
        8,
    ), {
        pluginJobs: 3,
        cmakeJobs: 2,
    });
});

test("fx_prod_parallelism_rejects_invalid_job_counts", async () => {
    const { prodModule } = await loadBuildModules();

    assert.throws(
        () => prodModule.resolveProdBuildParallelism(3, { BUILDER_KIT_PLUGIN_JOBS: "0" }, 8),
        /BUILDER_KIT_PLUGIN_JOBS must be a positive integer/,
    );
    assert.throws(
        () => prodModule.resolveProdBuildParallelism(3, { BUILDER_KIT_CMAKE_JOBS: "1.5" }, 8),
        /BUILDER_KIT_CMAKE_JOBS must be a positive integer/,
    );
});

test("fx_prod_cmake_build_args_include_parallel_jobs_when_available", async () => {
    const { prodModule } = await loadBuildModules();

    assert.deepEqual(prodModule.createCmakeBuildArgs("/tmp/cosimo-build", "SeqFX_VST3", 4), [
        "--build",
        "/tmp/cosimo-build",
        "--config",
        "Release",
        "--target",
        "SeqFX_VST3",
        "--parallel",
        "4",
    ]);
    assert.deepEqual(prodModule.createCmakeBuildArgs("/tmp/cosimo-build", "SeqFX_VST3"), [
        "--build",
        "/tmp/cosimo-build",
        "--config",
        "Release",
        "--target",
        "SeqFX_VST3",
    ]);
});

test("fx_prod_all_child_build_args_keep_single_plugin_builds_import_safe", async () => {
    const { prodModule } = await loadBuildModules();
    const args = prodModule.createProdBuildChildArgs("seqfx", { clean: true });

    assert.equal(path.isAbsolute(args[0]), true);
    assert.equal(args[0], path.join(repoRoot, "kit/fx/prod-effect.mjs"));
    assert.deepEqual(args.slice(1), ["build", "seqfx", "--clean"]);
});

test("fx_prod_prepare preserves the CMake build tree and durable generated files", async () => {
    const { prodModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-prod-prepare-"));
    const juceOut = path.join(tempRoot, "seqfx_juce");

    try {
        await mkdir(path.join(juceOut, "_build", "objects"), { recursive: true });
        await mkdir(path.join(juceOut, "stale-dir"), { recursive: true });
        await writeFile(path.join(juceOut, "_build", "objects", "cmajor_plugin.o"), "compiled object");
        await writeFile(path.join(juceOut, "CMakeLists.txt"), "old generated cmake");
        await writeFile(path.join(juceOut, "cmajor_plugin.cpp"), "old generated source");
        await writeFile(path.join(juceOut, "stale-dir", "old.cpp"), "stale source");

        await prodModule.prepareJuceProjectOutput(juceOut);

        assert.equal(await readFile(path.join(juceOut, "_build", "objects", "cmajor_plugin.o"), "utf8"), "compiled object");
        assert.equal(await readFile(path.join(juceOut, "CMakeLists.txt"), "utf8"), "old generated cmake");
        assert.equal(await readFile(path.join(juceOut, "cmajor_plugin.cpp"), "utf8"), "old generated source");
        assert.equal(await readFile(path.join(juceOut, "stale-dir", "old.cpp"), "utf8"), "stale source");
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("fx_prod_prepare_discards_a_cmake_tree_owned_by_the_legacy_generated_project", async () => {
    const { prodModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-prod-owner-migration-"));
    const juceOut = path.join(tempRoot, "seqfx_juce");
    const wrapperSource = path.join(tempRoot, "kit", "tools", "effect_plugin_build");

    try {
        await mkdir(path.join(juceOut, "_build", "objects"), { recursive: true });
        await mkdir(wrapperSource, { recursive: true });
        await writeFile(
            path.join(juceOut, "_build", "CMakeCache.txt"),
            `CMAKE_HOME_DIRECTORY:INTERNAL=${juceOut}\n`,
        );
        await writeFile(path.join(juceOut, "_build", "objects", "legacy.o"), "legacy object");

        await prodModule.prepareJuceProjectOutput(juceOut, {
            cmakeSourceDirectory: wrapperSource,
        });

        await assert.rejects(readFile(path.join(juceOut, "_build", "CMakeCache.txt"), "utf8"), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(juceOut, "_build", "objects", "legacy.o"), "utf8"), { code: "ENOENT" });
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("fx_prod_prepare_preserves_a_cmake_tree_owned_by_the_wrapper_project", async () => {
    const { prodModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-prod-owner-match-"));
    const juceOut = path.join(tempRoot, "seqfx_juce");
    const wrapperSource = path.join(tempRoot, "kit", "tools", "effect_plugin_build");
    const cachePath = path.join(juceOut, "_build", "CMakeCache.txt");
    const objectPath = path.join(juceOut, "_build", "objects", "current.o");

    try {
        await mkdir(path.dirname(objectPath), { recursive: true });
        await mkdir(wrapperSource, { recursive: true });
        await writeFile(cachePath, `CMAKE_HOME_DIRECTORY:INTERNAL=${wrapperSource}\n`);
        await writeFile(objectPath, "current object");
        await writeFile(path.join(juceOut, "cmajor_plugin.cpp"), "stale generated source");

        await prodModule.prepareJuceProjectOutput(juceOut, {
            cmakeSourceDirectory: wrapperSource,
        });

        assert.equal(await readFile(cachePath, "utf8"), `CMAKE_HOME_DIRECTORY:INTERNAL=${wrapperSource}\n`);
        assert.equal(await readFile(objectPath, "utf8"), "current object");
        assert.equal(await readFile(path.join(juceOut, "cmajor_plugin.cpp"), "utf8"), "stale generated source");
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("fx_prod_prepare_clean_removes_the_cmake_build_tree", async () => {
    const { prodModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-prod-clean-"));
    const juceOut = path.join(tempRoot, "seqfx_juce");

    try {
        await mkdir(path.join(juceOut, "_build"), { recursive: true });
        await writeFile(path.join(juceOut, "_build", "CMakeCache.txt"), "cache");
        await writeFile(path.join(juceOut, "CMakeLists.txt"), "old generated cmake");

        await prodModule.prepareJuceProjectOutput(juceOut, { clean: true });

        await assert.rejects(readFile(path.join(juceOut, "_build", "CMakeCache.txt"), "utf8"), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(juceOut, "CMakeLists.txt"), "utf8"), { code: "ENOENT" });
        await writeFile(path.join(juceOut, "generation-can-write-here.txt"), "ok");
        assert.equal(await readFile(path.join(juceOut, "generation-can-write-here.txt"), "utf8"), "ok");
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("generated project synchronization preserves equal files and reconciles the complete staged tree", async () => {
    const syncScript = path.join(
        repoRoot,
        "kit/tools/effect_plugin_build/sync_generated_project.cmake",
    );
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-generated-sync-"));
    const source = path.join(tempRoot, "stage");
    const destination = path.join(tempRoot, "durable");
    const stableTimestamp = new Date("2025-01-02T03:04:05.000Z");
    const runSync = (sourceDirectory = source, destinationDirectory = destination) => spawnSync("cmake", [
        `-DBUILDER_KIT_GENERATED_PROJECT_SOURCE=${sourceDirectory}`,
        `-DBUILDER_KIT_GENERATED_PROJECT_DESTINATION=${destinationDirectory}`,
        "-P", syncScript,
    ], { cwd: repoRoot, encoding: "utf8" });

    try {
        await mkdir(path.join(source, "nested"), { recursive: true });
        await mkdir(path.join(destination, "_build", "objects"), { recursive: true });
        await mkdir(path.join(destination, "stale-directory"), { recursive: true });
        await mkdir(path.join(destination, "file-shape"), { recursive: true });
        await writeFile(path.join(source, "stable.cpp"), "same bytes\n");
        await writeFile(path.join(destination, "stable.cpp"), "same bytes\n");
        await utimes(path.join(destination, "stable.cpp"), stableTimestamp, stableTimestamp);
        await writeFile(path.join(source, "changed.h"), "new bytes\n");
        await writeFile(path.join(destination, "changed.h"), "old bytes\n");
        await writeFile(path.join(source, "missing.cpp"), "recovered\n");
        await writeFile(path.join(source, ".metadata"), "hidden\n");
        await writeFile(path.join(source, "file-shape"), "now a file\n");
        await writeFile(path.join(source, "nested", "now-directory.txt"), "directory child\n");
        await writeFile(path.join(destination, "nested"), "was a file\n");
        await writeFile(path.join(destination, "stale.txt"), "stale\n");
        await writeFile(path.join(destination, "stale-directory", "old.cpp"), "stale\n");
        await writeFile(path.join(destination, "_build", "objects", "plugin.o"), "object\n");
        await symlink("stable.cpp", path.join(source, "generated-link"));
        await writeFile(path.join(destination, "generated-link"), "was a file\n");
        await symlink("changed.h", path.join(destination, "link-to-file"));
        await writeFile(path.join(source, "link-to-file"), "now a file\n");

        const first = runSync();
        assert.equal(first.status, 0, first.stderr);
        assert.equal((await stat(path.join(destination, "stable.cpp"))).mtimeMs, stableTimestamp.getTime());
        assert.equal(await readFile(path.join(destination, "changed.h"), "utf8"), "new bytes\n");
        assert.equal(await readFile(path.join(destination, "missing.cpp"), "utf8"), "recovered\n");
        assert.equal(await readFile(path.join(destination, ".metadata"), "utf8"), "hidden\n");
        assert.equal(await readFile(path.join(destination, "file-shape"), "utf8"), "now a file\n");
        assert.equal(await readFile(path.join(destination, "nested", "now-directory.txt"), "utf8"), "directory child\n");
        assert.equal((await lstat(path.join(destination, "generated-link"))).isSymbolicLink(), true);
        assert.equal(await readlink(path.join(destination, "generated-link")), "stable.cpp");
        assert.equal((await lstat(path.join(destination, "link-to-file"))).isFile(), true);
        await assert.rejects(access(path.join(destination, "stale.txt")), { code: "ENOENT" });
        await assert.rejects(access(path.join(destination, "stale-directory")), { code: "ENOENT" });
        assert.equal(await readFile(path.join(destination, "_build", "objects", "plugin.o"), "utf8"), "object\n");

        const changedTime = (await stat(path.join(destination, "changed.h"))).mtimeMs;
        const recoveredTime = (await stat(path.join(destination, "missing.cpp"))).mtimeMs;
        const second = runSync();
        assert.equal(second.status, 0, second.stderr);
        assert.equal((await stat(path.join(destination, "changed.h"))).mtimeMs, changedTime);
        assert.equal((await stat(path.join(destination, "missing.cpp"))).mtimeMs, recoveredTime);

        const cleanDestination = path.join(tempRoot, "clean");
        const clean = runSync(source, cleanDestination);
        assert.equal(clean.status, 0, clean.stderr);
        assert.deepEqual(
            (await readdir(destination)).filter((entry) => entry !== "_build").sort(),
            (await readdir(cleanDestination)).sort(),
        );
        for (const relative of [
            ".metadata",
            "changed.h",
            "file-shape",
            "link-to-file",
            "missing.cpp",
            "nested/now-directory.txt",
            "stable.cpp",
        ]) {
            assert.deepEqual(
                await readFile(path.join(destination, relative)),
                await readFile(path.join(cleanDestination, relative)),
            );
        }
        assert.equal(
            await readlink(path.join(destination, "generated-link")),
            await readlink(path.join(cleanDestination, "generated-link")),
        );

        const leakingSource = path.join(tempRoot, "leaking-stage");
        await mkdir(leakingSource);
        await writeFile(path.join(leakingSource, "cmajor_plugin.cpp"), `const char* bad = ${JSON.stringify(leakingSource)};\n`);
        const leak = runSync(leakingSource);
        assert.notEqual(leak.status, 0);
        assert.match(leak.stderr, /contains its staging directory path/u);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("the wrapper generates into a fresh stage before synchronizing the durable project", async () => {
    const wrapperCmake = await readFile(
        path.join(repoRoot, "kit/tools/effect_plugin_build/CMakeLists.txt"),
        "utf8",
    );

    assert.match(wrapperCmake, /sync_generated_project\.cmake/u);
    assert.match(wrapperCmake, /--output=\$\{_builder_kit_generated_project_stage\}/u);
    assert.match(wrapperCmake, /builder_kit_sync_generated_project/u);
    assert.match(wrapperCmake, /file\(REMOVE_RECURSE "\$\{_builder_kit_generated_project_stage\}"\)/u);
    assert.doesNotMatch(wrapperCmake, /--output=\$\{BUILDER_KIT_EFFECT_OUTPUT_DIR\}/u);
});
