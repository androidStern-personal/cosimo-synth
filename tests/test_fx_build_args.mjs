import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
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

async function writeFixturePlugin(fxRoot, directoryName, patchFileName, manifest, sidecar) {
    const directoryPath = path.join(fxRoot, directoryName);

    await mkdir(directoryPath, { recursive: true });
    await writeFile(
        path.join(directoryPath, patchFileName),
        typeof manifest === "string" ? manifest : `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
    );

    if (sidecar !== undefined) {
        await writeFile(
            path.join(directoryPath, patchFileName.replace(/\.cmajorpatch$/, ".build.json")),
            typeof sidecar === "string" ? sidecar : `${JSON.stringify(sidecar, null, 2)}\n`,
            "utf8",
        );
    }
}

async function loadScaffoldModule() {
    return import(pathToFileURL(path.join(repoRoot, "kit/scripts/new_plugin.mjs")));
}

async function writeFixtureProduct(fxRoot, directoryName, product) {
    const directoryPath = path.join(fxRoot, directoryName);

    await mkdir(directoryPath, { recursive: true });
    await writeFile(
        path.join(directoryPath, "product.json"),
        typeof product === "string" ? product : `${JSON.stringify(product, null, 2)}\n`,
        "utf8",
    );
}

function createFixtureProduct(overrides = {}) {
    return {
        productName: "Tremolo Lab",
        manufacturerName: "Cosimo",
        bundleIdentifier: "dev.cosimo.tremolo-lab",
        pluginCode: "CsTL",
        manufacturerCode: "Cosi",
        version: "0.1.0",
        outputFileName: "TremoloLab",
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
        assert.notEqual(buildModule.effectPlugins[pluginName].includeInAll, false);
    }

    for (const pluginName of targetNames) {
        if (!allNames.includes(pluginName))
            assert.equal(buildModule.effectPlugins[pluginName].includeInAll, false);
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
        const plugin = buildModule.effectPlugins[pluginName];

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
        const plugin = buildModule.effectPlugins[pluginName];
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

test("sidecar build settings override every derived default", async () => {
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

test("a malformed sidecar fails discovery loudly while a malformed manifest degrades to derived names", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "broken_lab", "Broken.cmajorpatch", { name: "Broken" }, "{ not json");
        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /Broken\.build\.json/,
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

test("an orphan sidecar fails discovery instead of being silently ignored", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "typo_lab", "TypoLab.cmajorpatch", { name: "Typo Lab" });
        await writeFile(
            path.join(fxRoot, "typo_lab", "Typolab.build.json"),
            `${JSON.stringify({ cmakeTarget: "NeverApplied" }, null, 2)}\n`,
            "utf8",
        );

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /Typolab\.build\.json matches no \.cmajorpatch/,
        );
    });
});

test("a sidecar workerOut without workerSource fails discovery instead of being dropped", async () => {
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

test("sidecar build identifiers and worker paths must be separator-free or repo-contained", async () => {
    const { buildModule } = await loadBuildModules();

    const badSidecars = [
        [{ cmakeTarget: "../Escape" }, /invalid "cmakeTarget" value/],
        [{ productName: "Evil/../../Product" }, /invalid "productName" value/],
        [{ productName: ".." }, /invalid "productName" value/],
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

test("product.json identity is read at discovery and derives the manifest-facing identity", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", createFixtureIdentityManifest());
        await writeFixtureProduct(fxRoot, "tremolo_lab", createFixtureProduct({
            supportUrl: "https://example.com/support",
            accentColor: "#f0b867",
        }));

        const plugins = buildModule.discoverEffectPlugins({ fxRoot });
        const plugin = plugins["tremolo-lab"];

        // outputFileName owns the install filename when product.json exists.
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
        assert.equal(plugin.product.accentColor, "#f0b867");

        // The build writes the derived identity into the runtime manifest
        // without disturbing key order or any other manifest content.
        const runtimeManifest = buildModule.createRuntimePatchManifest(createFixtureIdentityManifest(), plugin);

        assert.deepEqual(runtimeManifest, createFixtureIdentityManifest());
        assert.deepEqual(Object.keys(runtimeManifest), Object.keys(createFixtureIdentityManifest()));
    });
});

test("product.json shape defects fail discovery closed like the build sidecars", async () => {
    const { buildModule } = await loadBuildModules();
    const badProducts = [
        ["{ not json", /Could not parse .*product\.json/],
        [createFixtureProduct({ pluginCode: "toolong" }), /invalid "pluginCode" value/],
        [createFixtureProduct({ pluginCode: "abc" }), /invalid "pluginCode" value/],
        [createFixtureProduct({ pluginCode: "cstl" }), /invalid "pluginCode" value/],
        [createFixtureProduct({ manufacturerCode: "Co/i" }), /invalid "manufacturerCode" value/],
        [createFixtureProduct({ bundleIdentifier: "no-dots" }), /invalid "bundleIdentifier" value/],
        [createFixtureProduct({ version: "1.0" }), /invalid "version" value/],
        [createFixtureProduct({ outputFileName: "../Escape" }), /invalid "outputFileName" value/],
        [createFixtureProduct({ supportUrl: "not a url" }), /invalid "supportUrl" value/],
        [createFixtureProduct({ accentColor: "orange" }), /invalid "accentColor" value/],
        [createFixtureProduct({ productCode: "CsTL" }), /unknown key "productCode"/],
        [createFixtureProduct({ outputFileName: undefined }), /missing required key "outputFileName"/],
        [createFixtureProduct({ wordmark: "assets/absent.png" }), /wordmark file that does not exist/],
        [createFixtureProduct({ patch: "Renamed.cmajorpatch" }), /matches no \.cmajorpatch/],
    ];

    for (const [product, expectedError] of badProducts) {
        await withFixtureFxRoot(async (fxRoot) => {
            await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", createFixtureIdentityManifest());
            await writeFixtureProduct(fxRoot, "tremolo_lab", product);
            assert.throws(
                () => buildModule.discoverEffectPlugins({ fxRoot }),
                expectedError,
                typeof product === "string" ? product : JSON.stringify(product),
            );
        });
    }
});

test("product.json is authoritative: manifest drift and duplicated filename authority fail discovery", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(
            fxRoot,
            "tremolo_lab",
            "TremoloLab.cmajorpatch",
            { ...createFixtureIdentityManifest(), version: "0.2.0" },
        );
        await writeFixtureProduct(fxRoot, "tremolo_lab", createFixtureProduct());

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /product\.json is authoritative .* disagrees with its manifest: version \(manifest "0\.2\.0", product\.json "0\.1\.0"\)/,
        );

        await writeFixturePlugin(
            fxRoot,
            "tremolo_lab",
            "TremoloLab.cmajorpatch",
            createFixtureIdentityManifest(),
            { productName: "TremoloLab" },
        );

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /product\.json owns the install filename .* remove "productName" from the build sidecar/,
        );
    });
});

test("a product.json in a directory holding several patches must bind to one of them", async () => {
    const { buildModule } = await loadBuildModules();

    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "duo_lab", "Alpha.cmajorpatch", { name: "Alpha" }, { alias: "alpha" });
        await writeFixturePlugin(fxRoot, "duo_lab", "Tremolo.cmajorpatch", createFixtureIdentityManifest(), { alias: "trem" });
        await writeFixtureProduct(fxRoot, "duo_lab", createFixtureProduct());

        assert.throws(
            () => buildModule.discoverEffectPlugins({ fxRoot }),
            /product\.json is ambiguous: its directory holds 2 patches/,
        );

        await writeFixtureProduct(fxRoot, "duo_lab", createFixtureProduct({ patch: "Tremolo.cmajorpatch" }));

        const plugins = buildModule.discoverEffectPlugins({ fxRoot });

        assert.equal(plugins.alpha.identity, undefined, "the unbound patch keeps manifest-only identity");
        assert.equal(plugins.trem.identity.ID, "dev.cosimo.tremolo-lab");
        assert.equal(plugins.trem.productName, "TremoloLab");
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

    // ...and with product.json-driven identities.
    await withFixtureFxRoot(async (fxRoot) => {
        await writeFixturePlugin(fxRoot, "tremolo_lab", "TremoloLab.cmajorpatch", createFixtureIdentityManifest());
        await writeFixtureProduct(fxRoot, "tremolo_lab", createFixtureProduct());
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

test("enhancer_lite ships the only checked-in product.json and it is a no-op against its manifest", async () => {
    const { buildModule } = await loadBuildModules();
    const plugin = buildModule.effectPlugins["enhancer-lite"];

    assert.deepEqual(plugin.identity, {
        ID: "dev.cosimo.enhancer-lite",
        name: "Cosimo Enhancer Lite",
        manufacturer: "Cosimo",
        version: "0.1.0",
        plugin: { pluginCode: "CsEL", manufacturerCode: "Cosi" },
    });
    assert.equal(plugin.productName, "CosimoEnhancerLite");
    assert.equal(plugin.product.outputFileName, "CosimoEnhancerLite");
    assert.equal(plugin.product.wordmark, "assets/enhancer-lite-wordmark.png");

    // Every other plugin keeps manifest-only identity (no product.json means
    // the patch manifest is authoritative).
    for (const [pluginName, other] of Object.entries(buildModule.effectPlugins)) {
        if (pluginName !== "enhancer-lite") {
            assert.equal(other.identity, undefined, pluginName);
            assert.equal(other.product, undefined, pluginName);
        }
    }

    // Identity claims cover all discovered plugins, product.json or not, and
    // are collision-free across the shipped set.
    const claims = buildModule.collectEffectIdentityClaims();
    const targetCount = buildModule.effectPluginTargetNames().length;

    assert.equal(claims.pluginCodes.size, targetCount);
    assert.equal(claims.bundleIdentifiers.size, targetCount);
    assert.equal(claims.pluginCodes.get("CsEL"), "fx/enhancer_lite/EnhancerLite.cmajorpatch");
    assert.equal(claims.bundleIdentifiers.get("dev.cosimo.enhancer-lite"), "fx/enhancer_lite/EnhancerLite.cmajorpatch");

    // The runtime manifest the build writes must be identical to the source
    // manifest apart from the established escaped-source flattening — the
    // product.json identity rewrite may never change shipped bytes.
    const sourceManifest = JSON.parse(await readFile(path.join(repoRoot, plugin.patch), "utf8"));
    const runtimeManifest = buildModule.createRuntimePatchManifest(sourceManifest, plugin);
    const { source: rewrittenSource, ...runtimeRest } = runtimeManifest;
    const { source: originalSource, ...sourceRest } = sourceManifest;

    assert.deepEqual(runtimeRest, sourceRest);
    assert.deepEqual(Object.keys(runtimeManifest), Object.keys(sourceManifest));
});

test("kit:new scaffolds a plugin discovery registers, and identity validation guards the result", async () => {
    const scaffoldModule = await loadScaffoldModule();
    const { buildModule } = await loadBuildModules();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-kit-new-"));
    const fxRoot = path.join(tempRoot, "fx");
    const testsRoot = path.join(tempRoot, "tests");

    try {
        // The loader symlink target must resolve inside the simulated repo.
        await mkdir(path.join(tempRoot, "kit/ui/effects"), { recursive: true });
        await writeFile(path.join(tempRoot, "kit/ui/effects/effect-view-loader.js"), "export default () => {};\n", "utf8");
        await mkdir(fxRoot, { recursive: true });

        const plan = scaffoldModule.scaffoldPlugin("demo_verb", { fxRoot, testsRoot });

        assert.equal(plan.alias, "demo-verb");
        assert.equal(plan.pluginCode, "CsDV");

        const plugin = buildModule.discoverEffectPlugins({ fxRoot })["demo-verb"];

        assert.equal(plugin.patch, "fx/demo_verb/DemoVerb.cmajorpatch");
        assert.equal(plugin.productName, "DemoVerb");
        assert.equal(plugin.cmakeTarget, "DemoVerb");
        assert.equal(plugin.devModule, "/fx/demo_verb/view/source.ts");
        assert.deepEqual(plugin.identity, {
            ID: "dev.cosimo.demo-verb",
            name: "Demo Verb",
            manufacturer: "Cosimo",
            version: "0.1.0",
            plugin: { pluginCode: "CsDV", manufacturerCode: "Cosi" },
        });

        // The view entry is the shared kit loader, linked like chorus/ott.
        assert.equal(
            await realpath(path.join(fxRoot, "demo_verb/view/index.js")),
            await realpath(path.join(tempRoot, "kit/ui/effects/effect-view-loader.js")),
        );

        // The starter test and view stub follow the kit conventions.
        const starterTest = await readFile(plan.starterTestPath, "utf8");
        const viewSource = await readFile(path.join(fxRoot, "demo_verb/view/source.ts"), "utf8");

        assert.equal(plan.starterTestPath, path.join(testsRoot, "test_demo_verb_state.mjs"));
        assert.match(starterTest, /effectPlugins\["demo-verb"\]/);
        assert.match(viewSource, /export default function createPatchView/);
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

        // Name hygiene: reserved and malformed names are refused up front.
        assert.throws(() => scaffoldModule.parsePluginName("all"), /reserved/);
        assert.throws(() => scaffoldModule.parsePluginName("Bad Name"), /Invalid plugin name/);
        assert.throws(() => scaffoldModule.parsePluginName("9lives"), /Invalid plugin name/);
        assert.throws(() => scaffoldModule.parsePluginName("x"), /too short/);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
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
    for (const pluginName of ["enhancer", "enhancer-lite", "enhancer-lite-shelves-audition"])
        assert.equal(buildModule.createJitInstallPlan(pluginName).jitInstallRuntime, true, pluginName);
});

test("the shelves audition target is discovered but stays out of the `all` build set", async () => {
    const { buildModule, prodModule } = await loadBuildModules();
    const allNames = buildModule.resolvePluginNames("all");

    assert.ok(buildModule.effectPluginTargetNames().includes("enhancer-lite-shelves-audition"));
    assert.equal(allNames.includes("enhancer-lite-shelves-audition"), false);
    assert.equal(prodModule.resolveProdPluginNames("all").includes("enhancer-lite-shelves-audition"), false);
    assert.ok(allNames.includes("enhancer-lite"));
    assert.ok(allNames.includes("enhancer"));
});

test("the enhancer target builds from the canonical T26 DSP source, not a copy", async () => {
    const { buildModule } = await loadBuildModules();
    const manifest = JSON.parse(
        await readFile(path.join(repoRoot, buildModule.effectPlugins.enhancer.patch), "utf8"),
    );

    assert.ok(manifest.source.includes("../../cmajor/Enhancer.cmajor"));
    await access(path.join(repoRoot, "cmajor", "Enhancer.cmajor"));
});

test("SeqFX canonical runtime reuse is opt-in and scoped to the aggregate handoff", async () => {
    const { buildModule } = await loadBuildModules();
    const environmentKey = buildModule.seqFxCanonicalRuntimePrebuiltEnvironmentKey;

    assert.equal(environmentKey, "SEQFX_CANONICAL_RUNTIME_PREBUILT");
    assert.equal(buildModule.shouldReuseSeqFxCanonicalRuntime("seqfx", {}), false);
    assert.equal(buildModule.shouldReuseSeqFxCanonicalRuntime("seqfx", {
        [environmentKey]: "true",
    }), false);
    assert.equal(buildModule.shouldReuseSeqFxCanonicalRuntime("seqfx", {
        [environmentKey]: "1",
    }), true);
    assert.equal(buildModule.shouldReuseSeqFxCanonicalRuntime("spectral", {
        [environmentKey]: "1",
    }), false);
    // A prod build strips view.devModule, so it may never trust a prebuilt
    // (unstripped) canonical runtime — it must rebuild.
    assert.equal(buildModule.shouldReuseSeqFxCanonicalRuntime("seqfx", {
        [environmentKey]: "1",
    }, { stripDevModule: true }), false);
    assert.equal(buildModule.shouldReuseSeqFxCanonicalRuntime("seqfx", {
        [environmentKey]: "1",
    }, { stripDevModule: false }), true);
});

test("SeqFX release runtime source-map suppression is opt-in and leaves local qualification maps enabled", async () => {
    const { buildModule } = await loadBuildModules();
    const environmentKey = buildModule.seqFxDistributableRuntimeEnvironmentKey;

    assert.equal(environmentKey, "SEQFX_DISTRIBUTABLE_RUNTIME");
    assert.equal(buildModule.shouldEmitEffectRuntimeSourceMaps("seqfx", {}), true);
    assert.equal(buildModule.shouldEmitEffectRuntimeSourceMaps("seqfx", {
        [environmentKey]: "true",
    }), true);
    assert.equal(buildModule.shouldEmitEffectRuntimeSourceMaps("seqfx", {
        [environmentKey]: "1",
    }), false);
    assert.equal(buildModule.shouldEmitEffectRuntimeSourceMaps("spectral", {
        [environmentKey]: "1",
    }), true);
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
        assert.match(staleRun.stderr, /Forbidden marker\(s\): cosimo-keyboard-probe-panel/);
        assert.equal(missingRun.status, 1);
        assert.equal(usageRun.status, 2);
        assert.match(usageRun.stderr, /Usage: node kit\/scripts\/check_choc_markers\.mjs/);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
});

test("the production configure explicitly disables microphone permission metadata when a target opts in", async () => {
    const { prodModule, buildModule } = await loadBuildModules();
    const cmajExecutable = prodModule.getPinnedCmajExecutablePath();
    const plugin = buildModule.effectPlugins.seqfx;

    assert.equal(plugin.disableMicrophonePermission, true);
    assert.equal(plugin.editorMaxWidth, 1120);
    assert.deepEqual(prodModule.createJuceGenerationConfigureArgs({
        cmajExecutable,
        cmakeBuildDirectory: "/tmp/seqfx-build",
        cmakeSourceDirectory: "/repo/kit/tools/effect_plugin_build",
        disableMicrophonePermission: true,
        juceOutputDirectory: "/repo/build/seqfx_juce",
        pluginTarget: "CosimoSeqFX",
        runtimePatchPath: "/repo/build/fx/seqfx_runtime/SeqFx.cmajorpatch",
        editorMaxWidth: plugin.editorMaxWidth,
    }), [
        "-S", "/repo/kit/tools/effect_plugin_build",
        "-B", "/tmp/seqfx-build",
        "-DCMAKE_BUILD_TYPE=Release",
        "-DCOSIMO_EFFECT_PATCH_PATH=/repo/build/fx/seqfx_runtime/SeqFx.cmajorpatch",
        "-DCOSIMO_EFFECT_OUTPUT_DIR=/repo/build/seqfx_juce",
        "-DCOSIMO_EFFECT_PLUGIN_TARGET=CosimoSeqFX",
        `-DCOSIMO_CMAJ_EXECUTABLE=${cmajExecutable}`,
        "-DCOSIMO_DISABLE_MICROPHONE_PERMISSION=ON",
        "-DCOSIMO_EFFECT_EDITOR_MAX_WIDTH=1120",
    ]);
    const wrapperCmake = await readFile(
        path.join(repoRoot, "kit", "tools", "effect_plugin_build", "CMakeLists.txt"),
        "utf8",
    );
    assert.match(wrapperCmake, /set\(COSIMO_CMAJ_EXECUTABLE "" CACHE FILEPATH/u);
    assert.match(wrapperCmake, /IS_ABSOLUTE "\$\{COSIMO_CMAJ_EXECUTABLE\}"/u);
    assert.match(wrapperCmake, /option\(COSIMO_DISABLE_MICROPHONE_PERMISSION/u);
    assert.match(wrapperCmake, /--juceMicrophonePermissionEnabled=false/u);
    assert.doesNotMatch(wrapperCmake, /SeqFxGeneratedPluginMetadata/u);
    assert.doesNotMatch(wrapperCmake, /cosimo_disable_generated_microphone_permission/u);
});

test("SeqFX editor width ceiling is product-scoped exact and fail-closed", async () => {
    const { buildModule, prodModule } = await loadBuildModules();
    const transform = path.join(
        repoRoot,
        "kit/tools/effect_plugin_build/apply_generated_editor_width_ceiling.cmake",
    );
    const extractor = path.join(
        repoRoot,
        "kit/tools/effect_plugin_build/read_generated_plugin_info_class.cmake",
    );
    const wrapper = await readFile(
        path.join(repoRoot, "kit/tools/effect_plugin_build/CosimoBoundedGeneratedPlugin.h"),
        "utf8",
    );
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-editor-width-"));
    const runTransform = (sourcePath) => spawnSync(
        "cmake",
        [
            `-DCOSIMO_GENERATED_PLUGIN_SOURCE=${sourcePath}`,
            "-DCOSIMO_GENERATED_PLUGIN_EDITOR_MAX_WIDTH=1120",
            "-P", transform,
        ],
        { cwd: repoRoot, encoding: "utf8" },
    );

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
        await writeFile(driftedSource, "using Plugin = cmaj::plugin::GeneratedPlugin<::SeqFx>;\n");

        const transformed = runTransform(generatedSource);
        const rejectedDrift = runTransform(driftedSource);
        assert.equal(transformed.status, 0, transformed.stderr);
        assert.match(await readFile(generatedSource, "utf8"), /#include "CosimoBoundedGeneratedPlugin\.h"/u);
        assert.match(await readFile(generatedSource, "utf8"), /using Plugin = cosimo::BoundedGeneratedPlugin<::SeqFx, 1120>;/u);
        assert.notEqual(rejectedDrift.status, 0);
        assert.match(rejectedDrift.stderr, /Expected exactly one Cmajor JUCE helper include.*found 0/su);

        const extracted = spawnSync(
            "cmake",
            [`-DCOSIMO_GENERATED_PLUGIN_SOURCE=${generatedSource}`, "-P", extractor],
            { cwd: repoRoot, encoding: "utf8" },
        );
        assert.equal(extracted.status, 0, extracted.stderr);
        assert.match(`${extracted.stdout}${extracted.stderr}`, /-- SeqFx/u);
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }

    assert.match(wrapper, /Base::createEditor\(\)/u);
    assert.match(wrapper, /setResizeLimits \(250, 160, maxEditorWidth, 32768\)/u);
    assert.doesNotMatch(wrapper, /struct Editor/u, "the product seam should not copy the Cmajor editor implementation");
    assert.equal(buildModule.effectPlugins.seqfx.editorMaxWidth, 1120);
    for (const [pluginName, plugin] of Object.entries(buildModule.effectPlugins)) {
        if (pluginName !== "seqfx")
            assert.equal("editorMaxWidth" in plugin, false, `${pluginName} should retain stock Cmajor editor limits`);
    }
    assert.throws(
        () => prodModule.createJuceGenerationConfigureArgs({
            cmajExecutable: prodModule.getPinnedCmajExecutablePath(),
            cmakeBuildDirectory: "/tmp/build",
            cmakeSourceDirectory: "/tmp/source",
            editorMaxWidth: 249,
            juceOutputDirectory: "/tmp/juce",
            pluginTarget: "CosimoSeqFX",
            runtimePatchPath: "/tmp/SeqFx.cmajorpatch",
        }),
        /editorMaxWidth must be an integer of at least 250/u,
    );
});

test("fx_prod_release_tool_overrides are absolute and PATH-independent", async () => {
    const { prodModule } = await loadBuildModules();
    const tools = prodModule.resolveProdBuildToolPaths({
        COSIMO_RELEASE_CMAKE: "/approved/cmake",
        COSIMO_RELEASE_NODE: "/approved/node",
    }, "darwin");

    assert.deepEqual(tools, {
        cmake: "/approved/cmake",
        codesign: "/usr/bin/codesign",
        node: "/approved/node",
    });
    assert.throws(
        () => prodModule.resolveProdBuildToolPaths({ COSIMO_RELEASE_CMAKE: "cmake" }, "darwin"),
        /COSIMO_RELEASE_CMAKE must be an absolute executable path/u,
    );
    assert.throws(
        () => prodModule.resolveProdBuildToolPaths({ COSIMO_RELEASE_NODE: "node" }, "darwin"),
        /COSIMO_RELEASE_NODE must be an absolute executable path/u,
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

test("effect production uses the repository-built pinned Cmajor generator without runtime tool lookup", async () => {
    const { prodModule } = await loadBuildModules();
    const expectedExecutable = path.join(
        repoRoot,
        "build",
        "cmajor_command",
        "bin",
        process.platform === "win32" ? "cmaj.exe" : "cmaj",
    );
    const generationProject = await readFile(
        path.join(repoRoot, "kit/tools/effect_plugin_build/CMakeLists.txt"),
        "utf8",
    );
    const commandProject = await readFile(
        path.join(repoRoot, "tools/cmajor_command_build/CMakeLists.txt"),
        "utf8",
    );

    assert.equal(prodModule.getPinnedCmajExecutablePath(), expectedExecutable);
    assert.deepEqual(
        prodModule.createJuceGenerationConfigureArgs({
            cmakeSourceDirectory: "/tmp/effect-source",
            cmakeBuildDirectory: "/tmp/effect-build",
            runtimePatchPath: "/tmp/effect.cmajorpatch",
            juceOutputDirectory: "/tmp/effect-juce",
            pluginTarget: "CosimoEnhancer",
            cmajExecutable: expectedExecutable,
        }),
        [
            "-S", "/tmp/effect-source",
            "-B", "/tmp/effect-build",
            "-DCMAKE_BUILD_TYPE=Release",
            "-DCOSIMO_EFFECT_PATCH_PATH=/tmp/effect.cmajorpatch",
            "-DCOSIMO_EFFECT_OUTPUT_DIR=/tmp/effect-juce",
            "-DCOSIMO_EFFECT_PLUGIN_TARGET=CosimoEnhancer",
            `-DCOSIMO_CMAJ_EXECUTABLE=${expectedExecutable}`,
        ],
    );
    assert.throws(
        () => prodModule.validatePinnedCmajExecutable("/tmp/stale-system-cmaj"),
        /must be the Cmajor command built from the pinned source/u,
    );
    assert.equal("replaceGeneratedPluginLatency" in prodModule, false);
    assert.doesNotMatch(generationProject, /find_program\s*\([^)]*cmaj/su);
    assert.match(generationProject, /COSIMO_CMAJ_EXECUTABLE/u);
    assert.match(commandProject, /cosimo_add_production_dependencies\(\)/u);
    assert.match(commandProject, /add_subdirectory\s*\(\s*"\$\{COSIMO_CMAJOR_SOURCE_DIR\}"/su);
    assert.match(commandProject, /set\(WARNINGS_AS_ERRORS ON CACHE BOOL/u);
    assert.doesNotMatch(commandProject, /WARNINGS_AS_ERRORS OFF/u);
    assert.deepEqual(
        prodModule.createProdBuildChildArgs("enhancer", { cmajExecutable: expectedExecutable }),
        [
            path.join(repoRoot, "kit/fx/prod-effect.mjs"),
            "build",
            "enhancer",
            `--prepared-cmaj-executable=${expectedExecutable}`,
        ],
    );
});

test("generated latency probe resolves the generator-authored factory type exactly once", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cosimo-generated-plugin-type-"));
    const extractor = path.join(
        repoRoot,
        "kit/tools/effect_plugin_build/read_generated_plugin_info_class.cmake",
    );
    const runExtractor = (sourcePath) => spawnSync(
        "cmake",
        [`-DCOSIMO_GENERATED_PLUGIN_SOURCE=${sourcePath}`, "-P", extractor],
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
        cmajExecutable: null,
    });
    assert.deepEqual(prodModule.parseArgs(["node", "prod-effect.mjs", "build", "seqfx", "--clean"]), {
        action: "build",
        pluginName: "seqfx",
        clean: true,
        dryRun: false,
        help: false,
        cmajExecutable: null,
    });
    assert.throws(
        () => prodModule.parseArgs(["node", "prod-effect.mjs", "install", "all", "--wat"]),
        /Unknown argument: --wat/,
    );
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
            COSIMO_PLUGIN_JOBS: "3",
            COSIMO_CMAKE_JOBS: "2",
        },
        8,
    ), {
        pluginJobs: 3,
        cmakeJobs: 2,
    });
    assert.deepEqual(prodModule.resolveProdBuildParallelism(
        3,
        {
            COSIMO_PLUGIN_JOBS: "99",
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
        () => prodModule.resolveProdBuildParallelism(3, { COSIMO_PLUGIN_JOBS: "0" }, 8),
        /COSIMO_PLUGIN_JOBS must be a positive integer/,
    );
    assert.throws(
        () => prodModule.resolveProdBuildParallelism(3, { COSIMO_CMAKE_JOBS: "1.5" }, 8),
        /COSIMO_CMAKE_JOBS must be a positive integer/,
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

test("fx_prod_prepare_preserves_cmake_build_tree_but_removes_stale_generated_files", async () => {
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
        await assert.rejects(readFile(path.join(juceOut, "CMakeLists.txt"), "utf8"), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(juceOut, "cmajor_plugin.cpp"), "utf8"), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(juceOut, "stale-dir", "old.cpp"), "utf8"), { code: "ENOENT" });
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
        await assert.rejects(readFile(path.join(juceOut, "cmajor_plugin.cpp"), "utf8"), { code: "ENOENT" });
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
