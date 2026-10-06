import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const laneDeviceTypes = [
    "globalFilter", "distortion", "ott", "chorus",
    "flanger", "phaser", "delay", "reverb",
];

/** The Enhancer plugin's sound settings: each field's DSP endpoint. */
async function loadEnhancerSettingEndpoints() {
    const { default: definition } = await loadUIModule(repoRoot, "fx/enhancer/state.ts");
    return Object.values(definition).filter((field) => field.kind === "parameter").map((field) => field.endpoint);
}

test("the Enhancer plugin declares one sound parameter per saved setting", async () => {
    const [{ default: definition }, pluginSource] = await Promise.all([
        loadUIModule(repoRoot, "fx/enhancer/state.ts"),
        fs.readFile(path.join(repoRoot, "fx/enhancer/EnhancerPlugin.cmajor"), "utf8"),
    ]);
    const pluginParameters = [...pluginSource.matchAll(/^\s*input value float32 (\w+) \[\[/gm)].map(([, endpointID]) => endpointID);
    const parameterFields = Object.entries(definition).filter(([, field]) => field.kind === "parameter");

    assert.deepEqual(
        parameterFields.map(([key, field]) => ({ key, endpoint: field.endpoint })),
        [
            "b1FreqHz", "b1Q", "b1Mode", "b1MidAmount", "b1SideAmount", "b1Curve",
            "b2FreqHz", "b2Q", "b2Mode", "b2MidAmount", "b2SideAmount", "b2Curve",
            "saturationMode", "deEmphasis",
        ].map((key) => ({ key, endpoint: `${key}In` })),
    );
    assert.deepEqual(parameterFields.map(([, field]) => field.endpoint), pluginParameters);
    assert.ok(parameterFields.every(([, field]) => field.preset === undefined), "every setting is part of a preset and a snapshot");
    assert.deepEqual(
        Object.keys(definition).filter((key) => definition[key].kind !== "parameter").sort(),
        ["activePreset", "activeSnapshot", "presetLibrary", "snapshotSlots"],
    );
});

test("the saved sound and routing settings cannot enter host automation, modulation, or Effects Lane catalogs", async () => {
    const [settingEndpoints, rack, modulation, lanes] = await Promise.all([
        loadEnhancerSettingEndpoints(),
        loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-targets.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-slot-params.ts"),
    ]);
    const endpointIDs = new Set(settingEndpoints);

    for (const descriptor of rack.allRackParameterDescriptors()) {
        assert.equal(endpointIDs.has(descriptor.endpointID), false);
    }
    for (const identity of modulation.MODULATION_TARGET_IDENTITIES) {
        assert.ok([...endpointIDs].every((endpointID) => !identity.kind.includes(endpointID)));
    }
    for (const deviceType of laneDeviceTypes) {
        for (const endpointID of lanes.laneDeviceParamEndpoints(deviceType)) {
            assert.equal(endpointIDs.has(endpointID), false);
        }
    }
    assert.equal(rack.RACK_EFFECT_DESCRIPTORS.some(({ id }) => id === "enhancer"), false);
});

test("the Enhancer DSP reaches the synth only inside the Polish bus", async () => {
    const [settingEndpoints, source, polish, desktopManifest, iosManifest, synth, rack] = await Promise.all([
        loadEnhancerSettingEndpoints(),
        fs.readFile(path.join(repoRoot, "cmajor/Enhancer.cmajor"), "utf8"),
        fs.readFile(path.join(repoRoot, "cmajor/Polish.cmajor"), "utf8"),
        fs.readFile(path.join(repoRoot, "WavetableSynth.cmajorpatch"), "utf8").then(JSON.parse),
        fs.readFile(path.join(repoRoot, "WavetableSynth.iOS.cmajorpatch"), "utf8").then(JSON.parse),
        fs.readFile(path.join(repoRoot, "cmajor/WavetableSynth.cmajor"), "utf8"),
        fs.readFile(path.join(repoRoot, "cmajor/EffectsRack.cmajor"), "utf8"),
    ]);

    assert.match(source, /let enhancerOversampleFactor = 4;/);
    assert.match(source, /let enhancerLatencySamples = 60;/);
    assert.match(source, /processor\.latency = 60;/);
    assert.match(source, /static_assert \(enhancerLatencySamples == 60/);
    assert.match(source, /struct EnhancerFirUpsampler4x[\s\S]*enhancerFirStage0Up/);
    assert.match(source, /struct EnhancerFirDownsampler4x[\s\S]*enhancerFirStage0Down/);
    assert.match(source, /struct EnhancerBandCore[\s\S]*bandFilters/);
    assert.match(source, /let oversampledSampleRate = processor\.frequency \* float64 \(enhancerOversampleFactor\)/);
    assert.match(source, /enhancerEffectiveBellQ \(b1Q, b1MidAmount\)/);
    assert.match(source, /enhancerEffectiveBellQ \(b1Q, b1SideAmount\)/);
    assert.match(source, /let enhancerSpectreMediumDrive = 6\.0f;/);
    assert.match(source, /let enhancerSpectreMediumOutput = 0\.5f;/);
    assert.match(source, /let enhancerSpectreMediumTubeBias = 0\.3125f;/);
    assert.match(source, /mediumWeight = smoothEnhancerControl/);
    assert.match(source, /shapedHighpasses\[0\]\.process \([\s\S]*band1StereoShaped[\s\S]*\) - band1StereoSelected \* deEmphasis/);
    assert.match(source, /shapedHighpasses\[1\]\.process \([\s\S]*band1MidSideShaped[\s\S]*\) - band1MidSideSelected \* deEmphasis/);
    assert.match(source, /shapedHighpasses\[2\]\.process \([\s\S]*band2StereoShaped[\s\S]*\) - band2StereoSelected \* deEmphasis/);
    assert.match(source, /shapedHighpasses\[3\]\.process \([\s\S]*band2MidSideShaped[\s\S]*\) - band2MidSideSelected \* deEmphasis/);
    assert.match(source, /out <- delayedDry \+ band1Contribution \+ band2Contribution;/);
    assert.doesNotMatch(source, /ResidueTrim/);
    assert.doesNotMatch(source, /RMS|envelope|correlation/i);

    const smoothingSection = source.slice(
        source.indexOf("void smoothControls()"),
        source.indexOf("void main()", source.indexOf("void smoothControls()")),
    );
    assert.equal([...smoothingSection.matchAll(/smoothEnhancerControl/g)].length, 14);

    for (const dspEndpointID of settingEndpoints) {
        const declaration = source.split("\n").find((line) => line.includes(` ${dspEndpointID} `));
        assert.ok(declaration, `missing DSP endpoint ${dspEndpointID}`);
        assert.match(declaration, /automatable: false/);
        assert.match(declaration, /rampFrames: 0/);
        assert.match(smoothingSection, new RegExp(`\\b${dspEndpointID}\\b`));
    }

    assert.equal(desktopManifest.source.includes("cmajor/Enhancer.cmajor"), true);
    assert.equal(iosManifest.source.includes("cmajor/Enhancer.cmajor"), true);
    assert.equal(desktopManifest.source.includes("cmajor/Polish.cmajor"), true);
    assert.equal(iosManifest.source.includes("cmajor/Polish.cmajor"), true);
    assert.match(polish, /node enhancer = EnhancerBus;/);
    assert.match(polish, /enhancer\.b1MidAmountIn <- 0\.70f \* enhancerAmount;/);
    assert.match(polish, /enhancer\.b2SideAmountIn <- 0\.70f \* enhancerAmount;/);
    assert.match(synth, /node polish = wt::PolishBus;/);
    assert.doesNotMatch(synth, /EnhancerBus/);
    assert.doesNotMatch(rack, /EnhancerBus/);
});
