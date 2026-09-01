import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadEnhancerLiteState() {
    return loadUIModule(repoRoot, "fx/enhancer_lite/view/enhancer-lite-state.ts");
}

test("Enhancer Lite saves exactly one band's static Stereo/M/S sound controls", async () => {
    const enhancer = await loadEnhancerLiteState();
    const defaults = enhancer.createDefaultEnhancerLiteState();

    assert.equal(enhancer.ENHANCER_LITE_STATE_FORMAT, "cosimo.enhancer-lite");
    assert.equal(enhancer.ENHANCER_LITE_STATE_VERSION, 2);
    assert.deepEqual(
        enhancer.ENHANCER_LITE_SETTING_DESCRIPTORS.map(({ id }) => id),
        ["freqHz", "q", "mode", "midAmount", "sideAmount", "curve", "saturationMode", "shape"],
    );
    assert.ok(enhancer.ENHANCER_LITE_SETTING_DESCRIPTORS.every(
        ({ exposure }) => exposure === "static-preset",
    ));
    assert.deepEqual(defaults, {
        format: "cosimo.enhancer-lite",
        version: 2,
        freqHz: 130,
        q: 0.71,
        mode: "stereo",
        midAmount: 0,
        sideAmount: 0,
        curve: "solid",
        saturationMode: "subtle",
        shape: "bell",
    });
    assert.equal(Object.hasOwn(defaults, "deEmphasis"), false);
    assert.deepEqual(
        enhancer.parseEnhancerLiteState(enhancer.serializeEnhancerLiteState(defaults)),
        { _tag: "ok", value: defaults },
    );

    const edited = {
        ...defaults,
        freqHz: 15_200,
        q: 7.5,
        mode: "mid-side",
        midAmount: 0.64,
        sideAmount: 0.37,
        curve: "tube",
        saturationMode: "medium",
        shape: "high",
    };
    assert.deepEqual(enhancer.parseEnhancerLiteState(edited), { _tag: "ok", value: edited });
    assert.deepEqual(enhancer.toEnhancerLiteDspSettings(edited), {
        freqHzIn: 15_200,
        qIn: 7.5,
        modeIn: 1,
        midAmountIn: 0.64,
        sideAmountIn: 0.37,
        curveIn: 0,
        saturationModeIn: 1,
        shapeIn: 2,
    });

    const legacyV1 = Object.fromEntries(
        Object.entries({ ...defaults, version: 1 }).filter(([key]) => key !== "shape"),
    );
    assert.deepEqual(enhancer.parseEnhancerLiteState(legacyV1), {
        _tag: "ok",
        value: defaults,
    });
});

test("Enhancer Lite rejects partial, extra, non-finite, and out-of-range state", async () => {
    const enhancer = await loadEnhancerLiteState();
    const defaults = enhancer.createDefaultEnhancerLiteState();
    const invalidDocuments = [
        null,
        [],
        "not json",
        { ...defaults, format: "cosimo.enhancer" },
        { ...defaults, version: 3 },
        { ...defaults, freqHz: 19.9 },
        { ...defaults, q: 10.1 },
        { ...defaults, midAmount: Number.NaN },
        { ...defaults, sideAmount: 1.1 },
        { ...defaults, mode: "linked" },
        { ...defaults, curve: "tape" },
        { ...defaults, saturationMode: "hard" },
        { ...defaults, shape: "notch" },
        { ...defaults, deEmphasis: 0 },
        Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== "q")),
    ];

    for (const document of invalidDocuments) {
        assert.equal(
            enhancer.parseEnhancerLiteState(document)._tag,
            "err",
            `unexpectedly accepted ${JSON.stringify(document)}`,
        );
    }
});

test("Enhancer Lite factory presets store exactly the eight saved sound controls", async () => {
    const enhancer = await loadEnhancerLiteState();
    const { ENHANCER_LITE_FACTORY_PRESETS } = await loadUIModule(
        repoRoot,
        "fx/enhancer_lite/view/factory-presets.js",
    );
    const presets = ENHANCER_LITE_FACTORY_PRESETS["enhancer-lite"];
    const addressableEndpointIDs = enhancer.ENHANCER_LITE_SETTING_DESCRIPTORS
        .map(({ dspEndpointID }) => dspEndpointID)
        .sort();

    assert.deepEqual(Object.keys(ENHANCER_LITE_FACTORY_PRESETS), ["enhancer-lite"]);
    assert.ok(presets.length >= 3 && presets.length <= 4, `${presets.length} factory presets`);
    assert.equal(new Set(presets.map(({ label }) => label)).size, presets.length);
    assert.equal(new Set(presets.map(({ presetID }) => presetID)).size, presets.length);

    for (const preset of presets) {
        assert.equal(preset.effectID, "enhancer-lite");
        assert.match(preset.presetID, /^enhancer-lite\.[a-z0-9-]+$/);
        assert.deepEqual(Object.keys(preset.values).sort(), addressableEndpointIDs);
        assert.equal(Object.hasOwn(preset.values, "analyzerEnabledIn"), false);

        // Every preset is a valid saved Lite state and round-trips through the
        // same endpoint projection the host-state document uses.
        const parsed = enhancer.parseEnhancerLiteState({
            ...enhancer.createDefaultEnhancerLiteState(),
            freqHz: preset.values.freqHzIn,
            q: preset.values.qIn,
            mode: preset.values.modeIn === 1 ? "mid-side" : "stereo",
            midAmount: preset.values.midAmountIn,
            sideAmount: preset.values.sideAmountIn,
            curve: preset.values.curveIn === 1 ? "solid" : "tube",
            saturationMode: preset.values.saturationModeIn === 1 ? "medium" : "subtle",
            shape: ["low", "bell", "high"][preset.values.shapeIn],
        });
        assert.equal(parsed._tag, "ok", `${preset.presetID}: ${parsed.message}`);
        assert.deepEqual(enhancer.toEnhancerLiteDspSettings(parsed.value), preset.values);
    }
});

test("the isolated Lite DSP keeps the accepted laws while removing de-emphasis", async () => {
    const source = await fs.readFile(
        path.join(repoRoot, "fx/enhancer_lite/EnhancerLite.cmajor"),
        "utf8",
    );
    const graph = await fs.readFile(
        path.join(repoRoot, "fx/enhancer_lite/EnhancerLitePlugin.cmajor"),
        "utf8",
    );
    const analyzer = await fs.readFile(
        path.join(repoRoot, "cmajor/EnhancerLiteSpectrumAnalyzer.cmajor"),
        "utf8",
    );
    // Synth non-coupling checks only run in the monorepo; an exported Builder
    // Kit ships no synth sources.
    const synthManifestPath = path.join(repoRoot, "WavetableSynth.cmajorpatch");
    const inMonorepo = existsSync(synthManifestPath);
    const desktopManifest = inMonorepo
        ? JSON.parse(await fs.readFile(synthManifestPath, "utf8"))
        : { source: [] };
    const synth = inMonorepo
        ? await fs.readFile(path.join(repoRoot, "cmajor/WavetableSynth.cmajor"), "utf8")
        : "";
    const rack = inMonorepo
        ? await fs.readFile(path.join(repoRoot, "cmajor/EffectsRack.cmajor"), "utf8")
        : "";

    assert.match(source, /let enhancerLiteOversampleFactor = 4;/);
    assert.match(source, /struct EnhancerLiteIirUpsampler4x/);
    assert.match(source, /struct EnhancerLiteIirDownsampler4x/);
    assert.match(source, /enhancerLiteFastTanh/);
    assert.match(source, /x \* \(27\.0f \+ x2\) \/ \(27\.0f \+ 9\.0f \* x2\)/);
    assert.match(source, /enhancerLiteEffectiveBellQ \(q, midAmount\)/);
    assert.match(source, /enhancerLiteEffectiveBellQ \(q, sideAmount\)/);
    assert.match(source, /simper::Mode::lowShelf/);
    assert.match(source, /simper::Mode::highShelf/);
    assert.match(source, /let enhancerLiteShapeDefault = enhancerLiteShapeBell;/);
    assert.match(source, /let enhancerLiteMediumDrive = 6\.0f;/);
    assert.match(source, /let enhancerLiteMediumTubeBias = 0\.3125f;/);
    assert.match(source, /combinedFrames\.at \(oversampleFrame\) = oversampledDry/);
    assert.match(source, /out <- outputDownsampler\.process/);
    assert.doesNotMatch(source, /deEmphasis/i);
    assert.doesNotMatch(source, /std::intrinsics::tanh/);
    assert.doesNotMatch(source, /EnhancerFir/);
    assert.doesNotMatch(source, /selectedDownsampler|unprocessed/i);
    assert.doesNotMatch(graph, /deEmphasis/i);
    assert.match(graph, /input event int32 analyzerEnabledIn \[\[ name: "Analyzer Enable", hidden: true \]\];/);
    assert.match(graph, /output event wt::EnhancerSpectrumFrame inputSpectrum/);
    assert.match(graph, /output event wt::EnhancerSpectrumFrame outputSpectrum/);
    assert.match(graph, /node inputAnalyzer = wt::EnhancerSpectrumAnalyzer \(0\);/);
    assert.match(graph, /node outputAnalyzer = wt::EnhancerSpectrumAnalyzer \(0\);/);
    assert.match(analyzer, /processor EnhancerSpectrumAnalyzer \(int32 initiallyEnabled\)/);
    assert.match(analyzer, /let stereoPower = 0\.5f/);
    assert.doesNotMatch(analyzer, /StereoToMonoAverage/);

    const smoothingSection = source.slice(
        source.indexOf("void smoothControls()"),
        source.indexOf("void main()", source.indexOf("void smoothControls()")),
    );
    assert.equal([...smoothingSection.matchAll(/smoothEnhancerLiteControl/g)].length, 10);
    for (const endpointID of [
        "freqHzIn", "qIn", "modeIn", "midAmountIn", "sideAmountIn", "curveIn", "saturationModeIn", "shapeIn",
    ]) {
        const declaration = graph.split("\n").find((line) => line.includes(` ${endpointID} `));
        assert.ok(declaration, `missing ${endpointID}`);
        assert.match(declaration, /automatable: false/);
        assert.match(declaration, /rampFrames: 0/);
        assert.match(smoothingSection, new RegExp(`\\b${endpointID}\\b`));
    }

    assert.equal(desktopManifest.source.includes("cmajor/EnhancerLite.cmajor"), false);
    assert.equal(desktopManifest.source.includes("fx/enhancer_lite/EnhancerLite.cmajor"), false);
    assert.doesNotMatch(synth, /EnhancerLiteBus/);
    assert.doesNotMatch(rack, /EnhancerLiteBus/);
});
