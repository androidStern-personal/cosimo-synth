#!/usr/bin/env node
/**
 * `npm run kit:new -- <name>` — scaffold a new effect plugin under fx/<name>/.
 *
 * The scaffold writes a minimal working plugin (stereo gain example): the
 * patch manifest, its DSP source, the single `<PatchName>.plugin.json` config
 * (build settings plus the `product` identity object), a `view/index.js`
 * symlink to the shared kit loader, a `state.ts` declaration and editable `view/source.tsx` wired to the
 * createStatefulPatchView convention, and a starter node test under tests/. Discovery
 * is scan-driven, so no shared file is edited; the new plugin is a build
 * target immediately.
 *
 * Every identity value derives from the plugin name and the repository's
 * `product-owner.json` (manufacturer, manufacturerCode, bundleIdentifierPrefix,
 * optional pluginCodePrefix): display name, patch base name, alias, pluginCode,
 * and bundle identifier. Names, aliases, and derived identity are refused when
 * they collide with an existing plugin directory, registry alias, bundle
 * identifier, or 4-char pluginCode (`collectEffectIdentityClaims` covers
 * config-driven and manifest-only plugins alike).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    collectEffectIdentityClaims,
    derivePluginBaseName,
    derivePluginCode,
    derivePluginDisplayName,
    discoverEffectPlugins,
    ownerPluginCodePrefix,
    pluginConfigSuffix,
    productOwnerFileName,
    productOwnerPath,
    readProductOwner,
    supportedPluginSchemaVersion,
} from "../fx/build-effect.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const defaultFxRoot = path.join(repoRoot, "fx");
const defaultTestsRoot = path.join(repoRoot, "tests");
const kitLoaderSymlinkTarget = "../../../kit/ui/effects/effect-view-loader.js";
const starterVersion = "0.1.0";

export function usage() {
    return "Usage: npm run kit:new -- <name>\n\n"
        + "The name becomes the fx/ directory: lowercase letters and digits, with\n"
        + "`_` or `-` separating words (e.g. demo_verb).";
}

export function parsePluginName(rawName) {
    if (typeof rawName !== "string" || !/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/.test(rawName))
        throw new Error(`Invalid plugin name ${JSON.stringify(rawName ?? "")}.\n\n${usage()}`);

    const segments = rawName.split(/[_-]+/);

    if (segments.length === 1 && segments[0].length < 2)
        throw new Error(`Plugin name ${JSON.stringify(rawName)} is too short to derive a 4-char pluginCode.\n\n${usage()}`);

    const alias = segments.join("-");

    if (alias === "all")
        throw new Error('"all" is the reserved build-every-plugin CLI name; pick another plugin name.');

    const directoryName = segments.join("_");

    return {
        directoryName,
        alias,
        patchBaseName: derivePluginBaseName(directoryName),
        displayName: derivePluginDisplayName(directoryName),
    };
}

/** The identity the owner file and the plugin name determine together. */
export function deriveOwnedIdentity(names, owner) {
    const pluginCode = derivePluginCode(names.directoryName, ownerPluginCodePrefix(owner));

    if (pluginCode === null)
        throw new Error(`Plugin name ${JSON.stringify(names.directoryName)} is too short to derive a 4-char pluginCode.\n\n${usage()}`);

    return {
        pluginCode,
        bundleIdentifier: `${owner.bundleIdentifierPrefix}.${names.alias}`,
        manufacturer: owner.manufacturer,
        manufacturerCode: owner.manufacturerCode,
    };
}

/** Everything the scaffold would write, with every collision refusal up front. */
export function planPluginScaffold(rawName, { fxRoot = defaultFxRoot, testsRoot = defaultTestsRoot } = {}) {
    const names = parsePluginName(rawName);
    const root = path.dirname(fxRoot);
    const ownerFile = readProductOwner(root);

    if (ownerFile === null) {
        throw new Error(
            `Refusing to scaffold: ${productOwnerPath(root)} is missing. `
            + `kit:new derives the manufacturer, codes, and bundle identifier from ${productOwnerFileName}.`,
        );
    }

    const identity = deriveOwnedIdentity(names, ownerFile.owner);
    const pluginDirectory = path.join(fxRoot, names.directoryName);
    const starterTestPath = path.join(testsRoot, `test_${names.directoryName}_state.mjs`);

    if (fs.existsSync(pluginDirectory))
        throw new Error(`Refusing to scaffold: ${pluginDirectory} already exists.`);

    const plugins = discoverEffectPlugins({ fxRoot });

    if (plugins[names.alias])
        throw new Error(`Refusing to scaffold: alias "${names.alias}" is already claimed by ${plugins[names.alias].patch}.`);

    const claims = collectEffectIdentityClaims({ fxRoot });

    if (claims.pluginCodes.has(identity.pluginCode)) {
        throw new Error(
            `Refusing to scaffold: derived pluginCode "${identity.pluginCode}" is already claimed by `
            + `${claims.pluginCodes.get(identity.pluginCode)}. Pick a name with different initials.`,
        );
    }

    if (claims.bundleIdentifiers.has(identity.bundleIdentifier)) {
        throw new Error(
            `Refusing to scaffold: bundle identifier "${identity.bundleIdentifier}" is already claimed by `
            + `${claims.bundleIdentifiers.get(identity.bundleIdentifier)}.`,
        );
    }

    if (fs.existsSync(starterTestPath))
        throw new Error(`Refusing to scaffold: ${starterTestPath} already exists.`);

    return { ...names, ...identity, pluginDirectory, starterTestPath };
}

function createPatchManifest(plan) {
    return {
        CmajorVersion: 1,
        ID: plan.bundleIdentifier,
        version: starterVersion,
        name: plan.displayName,
        description: `${plan.displayName} starter effect (stereo gain). Replace with real DSP.`,
        category: "effect",
        manufacturer: plan.manufacturer,
        plugin: {
            pluginCode: plan.pluginCode,
            manufacturerCode: plan.manufacturerCode,
        },
        isInstrument: false,
        source: [`${plan.patchBaseName}.cmajor`],
        view: {
            src: "view/index.js",
            devModule: `/fx/${plan.directoryName}/view/source.tsx`,
            width: 520,
            height: 320,
            resizable: true,
        },
    };
}

function createPluginConfig(plan) {
    return {
        schemaVersion: supportedPluginSchemaVersion,
        alias: plan.alias,
        cmakeTarget: plan.patchBaseName,
        productName: plan.patchBaseName,
        product: {
            productName: plan.displayName,
            manufacturerName: plan.manufacturer,
            bundleIdentifier: plan.bundleIdentifier,
            pluginCode: plan.pluginCode,
            manufacturerCode: plan.manufacturerCode,
            version: starterVersion,
        },
        stateSource: `fx/${plan.directoryName}/state.ts`,
        runtimeOut: `build/fx/${plan.directoryName}_runtime`,
        juceOut: `build/${plan.directoryName}_juce`,
    };
}

function createDspSource(plan) {
    return `// ${plan.displayName} — scaffolded stereo gain example. Replace this processor
// with real DSP; the manifest and the ${plan.patchBaseName}${pluginConfigSuffix} config beside it
// stay the build contract.
processor ${plan.patchBaseName}  [[ main ]]
{
    input stream float32<2> audioIn [[ name: "Input" ]];
    output stream float32<2> audioOut [[ name: "Output" ]];

    input value float32 gainDb [[ name: "Gain", group: "Output", min: -24.0f, max: 24.0f, init: 0.0f, unit: "dB" ]];

    void main()
    {
        loop
        {
            audioOut <- audioIn * std::levels::dBtoGain (gainDb);
            advance();
        }
    }
}
`;
}

function createStateSource() {
    return `import { definePluginState, parameter } from "../../kit/index";

// The endpoint name matches the automatable gainDb input in the DSP.
export default definePluginState({ gain: parameter("gainDb") });
`;
}

function createViewSource(plan) {
    return `// Editable with \`npm run fx:dev\`; bundled by \`npm run fx:build -- ${plan.alias}\`.
import { createStatefulPatchView, usePluginState, usePluginHistory } from "../../../kit/index";
import type { EffectParameterContract } from "../../../kit/index";
import definition from "../state";

/** The silent preview's parameter metadata matches the DSP endpoint. */
export const browserPreviewParameters = [{
    endpointID: "gainDb", type: "number", min: -24, max: 24, defaultValue: 0,
}] satisfies EffectParameterContract[];

function View() {
    const gain = usePluginState(definition.gain);
    const history = usePluginHistory();
    if (gain.state.kind !== "ready") return <p role="status">{gain.state.kind}</p>;
    const value = gain.state.value;
    return <main>
        <h1>${plan.displayName}</h1>
        <label htmlFor="gain">Gain</label>
        <input id="gain" type="range" min={gain.state.metadata?.min ?? -24} max={gain.state.metadata?.max ?? 24} step="0.1"
            value={value}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); void gain.beginGesture(); }}
            onPointerUp={() => { void gain.endGesture(); }}
            onPointerCancel={() => { void gain.endGesture(); }}
            onChange={event => { void gain.setValue(Number(event.currentTarget.value)); }} />
        <output data-readout>{value >= 0 ? "+" : ""}{value.toFixed(1)} dB</output>
        <nav aria-label="Edit history">
            <button disabled={!history.canUndo} onClick={() => { void history.undo(); }}>Undo</button>
            <button disabled={!history.canRedo} onClick={() => { void history.redo(); }}>Redo</button>
        </nav>
        {gain.error && <p role="alert">{gain.error.message}</p>}
        {gain.retry && <button onClick={() => { void gain.retry?.(); }}>Retry</button>}
    </main>;
}

export default createStatefulPatchView({ definition, View, css: \`
    :host { color: #f4efe6; background: #17171d; font-family: monospace; }
    main { box-sizing: border-box; min-height: 320px; padding: 24px; }
    h1 { margin: 0 0 18px; font-size: 18px; text-transform: uppercase; }
    label, output { display: block; margin: 8px 0; }
    input { width: 100%; }
    nav { display: flex; gap: 8px; margin-top: 20px; }
\` });
`;
}

function createStarterTest(plan) {
    return `import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadDiscovery() {
    return import(pathToFileURL(path.join(repoRoot, "kit/fx/build-effect.mjs")));
}

test("${plan.directoryName} is discovered with its product identity", async () => {
    const { effectPlugins } = await loadDiscovery();
    const plugin = effectPlugins["${plan.alias}"];

    assert.ok(plugin, "discovery must include ${plan.alias}");
    assert.equal(plugin.patch, "fx/${plan.directoryName}/${plan.patchBaseName}.cmajorpatch");
    assert.equal(plugin.productName, "${plan.patchBaseName}");
    assert.deepEqual(plugin.identity, {
        ID: "${plan.bundleIdentifier}",
        name: "${plan.displayName}",
        manufacturer: ${JSON.stringify(plan.manufacturer)},
        version: "${starterVersion}",
        plugin: { pluginCode: "${plan.pluginCode}", manufacturerCode: "${plan.manufacturerCode}" },
    });
});

test("${plan.directoryName} keeps the kit view loader conventions", async () => {
    const manifest = JSON.parse(
        await fs.readFile(path.join(repoRoot, "fx/${plan.directoryName}/${plan.patchBaseName}.cmajorpatch"), "utf8"),
    );

    assert.equal(manifest.view.src, "view/index.js");
    assert.equal(manifest.view.devModule, "/fx/${plan.directoryName}/view/source.tsx");
    assert.equal(
        await fs.realpath(path.join(repoRoot, "fx/${plan.directoryName}/view/index.js")),
        await fs.realpath(path.join(repoRoot, "kit/ui/effects/effect-view-loader.js")),
    );

    for (const sourceFile of manifest.source)
        await fs.access(path.join(repoRoot, "fx/${plan.directoryName}", sourceFile));
});
`;
}

export function nextSteps(plan) {
    return [
        `Scaffolded fx/${plan.directoryName} (alias "${plan.alias}").`,
        "",
        "Gain edits and pointer drags use shared Undo/Redo; extend state.ts for new controls.",
        "Next steps:",
        `  npm run fx:dev                    # live UI: http://127.0.0.1:5175/fx/${plan.directoryName}/view/harness.html`,
        `  npm run fx:build -- ${plan.alias}    # self-contained runtime under build/fx/${plan.directoryName}_runtime`,
        `  node --test tests/test_${plan.directoryName}_state.mjs`,
        "",
        `Build settings and identity live in fx/${plan.directoryName}/${plan.patchBaseName}${pluginConfigSuffix}`,
        "(keep the patch manifest in agreement with its \"product\" object).",
    ].join("\n");
}

export function scaffoldPlugin(rawName, options = {}) {
    const plan = planPluginScaffold(rawName, options);
    const fxRoot = options.fxRoot ?? defaultFxRoot;
    const viewDirectory = path.join(plan.pluginDirectory, "view");
    const writeJson = (filePath, value) =>
        fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

    fs.mkdirSync(viewDirectory, { recursive: true });
    writeJson(path.join(plan.pluginDirectory, `${plan.patchBaseName}.cmajorpatch`), createPatchManifest(plan));
    writeJson(path.join(plan.pluginDirectory, `${plan.patchBaseName}${pluginConfigSuffix}`), createPluginConfig(plan));
    fs.writeFileSync(path.join(plan.pluginDirectory, `${plan.patchBaseName}.cmajor`), createDspSource(plan), "utf8");
    fs.writeFileSync(path.join(plan.pluginDirectory, "state.ts"), createStateSource(), "utf8");
    fs.writeFileSync(path.join(viewDirectory, "source.tsx"), createViewSource(plan), "utf8");
    fs.symlinkSync(kitLoaderSymlinkTarget, path.join(viewDirectory, "index.js"));
    fs.mkdirSync(path.dirname(plan.starterTestPath), { recursive: true });
    fs.writeFileSync(plan.starterTestPath, createStarterTest(plan), "utf8");

    // Post-condition: the scan-driven registry must pick the new plugin up
    // with the exact planned alias — anything else is a scaffold bug.
    const discovered = discoverEffectPlugins({ fxRoot })[plan.alias];

    if (discovered?.patch !== `fx/${plan.directoryName}/${plan.patchBaseName}.cmajorpatch`)
        throw new Error(`Scaffold self-check failed: discovery did not register "${plan.alias}".`);

    return plan;
}

async function main() {
    try {
        const [, , pluginName, extraArgument] = process.argv;

        if (!pluginName || extraArgument !== undefined)
            throw new Error(usage());

        const plan = scaffoldPlugin(pluginName);

        console.log(nextSteps(plan));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
