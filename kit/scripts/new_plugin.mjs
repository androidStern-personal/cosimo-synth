#!/usr/bin/env node
/**
 * `npm run kit:new -- <name>` — scaffold a new effect plugin under fx/<name>/.
 *
 * The scaffold writes a minimal working plugin (stereo gain example): the
 * patch manifest, its DSP source, the single `<PatchName>.plugin.json` config
 * (build settings plus the `product` identity object), a `view/index.js`
 * symlink to the shared kit loader, an editable `view/source.ts` wired to the
 * createPatchView convention, and a starter node test under tests/. Discovery
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
            devModule: `/fx/${plan.directoryName}/view/source.ts`,
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

function createViewSource(plan) {
    return `// ${plan.displayName} view. Served editable by \`npm run fx:dev\` (the manifest's
// view.devModule) and bundled to view/app.js by \`npm run fx:build -- ${plan.alias}\`;
// view/index.js stays the shared kit loader. Shared kit modules are imported
// from "../../../kit/index" (the supported public entry).
import type { EffectParameterContract } from "../../../kit/index";

type ParameterListener = ((value: number) => void) & { endpointID?: string };

type PatchConnection = {
    addParameterListener(endpointID: string, listener: ParameterListener): void;
    removeParameterListener(endpointID: string, listener: ParameterListener): void;
    requestParameterValue(endpointID: string): void;
    sendEventOrValue(endpointID: string, value: number, rampFrames?: number): void;
};

const GAIN_ENDPOINT = "gainDb";
const GAIN_MIN_DB = -24;
const GAIN_MAX_DB = 24;
const GAIN_INITIAL_DB = 0;

/** Silent browser preview uses the same gain definitions as this view. */
export const browserPreviewParameters = [{
    endpointID: GAIN_ENDPOINT,
    type: "number" as const,
    min: GAIN_MIN_DB,
    max: GAIN_MAX_DB,
    defaultValue: GAIN_INITIAL_DB,
}] satisfies EffectParameterContract[];

class ${plan.patchBaseName}View extends HTMLElement {
    private readonly gainListener: ParameterListener;
    private readonly slider: HTMLInputElement;
    private readonly readout: HTMLElement;

    constructor(private readonly patchConnection: PatchConnection) {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot!.innerHTML = this.getMarkup();
        this.slider = this.shadowRoot!.querySelector("input")!;
        this.readout = this.shadowRoot!.querySelector("[data-readout]")!;
        this.slider.addEventListener("input", () => {
            this.patchConnection.sendEventOrValue(GAIN_ENDPOINT, Number(this.slider.value));
        });
        this.gainListener = (value) => this.renderGain(value);
        this.gainListener.endpointID = GAIN_ENDPOINT;
    }

    connectedCallback() {
        this.patchConnection.addParameterListener(GAIN_ENDPOINT, this.gainListener);
        this.patchConnection.requestParameterValue(GAIN_ENDPOINT);
    }

    disconnectedCallback() {
        this.patchConnection.removeParameterListener(GAIN_ENDPOINT, this.gainListener);
    }

    private renderGain(value: number) {
        this.slider.value = String(value);
        this.readout.textContent = \`\${value >= 0 ? "+" : ""}\${value.toFixed(1)} dB\`;
    }

    private getMarkup(): string {
        return \`
            <style>
                :host {
                    display: block;
                    width: 520px;
                    min-height: 320px;
                    box-sizing: border-box;
                    padding: 24px;
                    color: #f4efe6;
                    background: linear-gradient(180deg, #17171d 0%, #0d0e13 100%);
                    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
                }
                h1 {
                    margin: 0 0 18px;
                    font-size: 18px;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }
                label {
                    display: block;
                    margin-bottom: 6px;
                    font-size: 11px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(244, 239, 230, 0.74);
                }
                input {
                    width: 100%;
                }
                [data-readout] {
                    margin-top: 8px;
                    font-size: 13px;
                }
            </style>
            <h1>${plan.displayName}</h1>
            <label for="gain">Gain</label>
            <input id="gain" type="range" min="\${GAIN_MIN_DB}" max="\${GAIN_MAX_DB}" step="0.1" value="\${GAIN_INITIAL_DB}" />
            <div data-readout>+0.0 dB</div>
        \`;
    }
}

export default function createPatchView(patchConnection: PatchConnection): HTMLElement {
    const elementName = "${plan.alias}-view";

    if (!window.customElements.get(elementName))
        window.customElements.define(elementName, ${plan.patchBaseName}View);

    return new ${plan.patchBaseName}View(patchConnection);
}
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
    assert.equal(manifest.view.devModule, "/fx/${plan.directoryName}/view/source.ts");
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
    fs.writeFileSync(path.join(viewDirectory, "source.ts"), createViewSource(plan), "utf8");
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
