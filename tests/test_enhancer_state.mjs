import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const laneDeviceTypes = [
    "globalFilter", "distortion", "ott", "chorus",
    "flanger", "phaser", "delay", "reverb",
];

async function loadEnhancerState() {
    return loadUIModule(repoRoot, "ui/shared/enhancer-state.ts");
}

test("the Enhancer saves ten sound settings plus two independent band modes", async () => {
    const enhancer = await loadEnhancerState();
    const defaults = enhancer.createDefaultEnhancerState();

    assert.equal(enhancer.ENHANCER_STATE_FORMAT, "cosimo.enhancer");
    assert.equal(enhancer.ENHANCER_STATE_VERSION, 2);
    assert.deepEqual(enhancer.ENHANCER_CURVES, ["tube", "solid"]);
    assert.deepEqual(enhancer.ENHANCER_MODES, ["stereo", "mid-side"]);
    assert.equal(enhancer.ENHANCER_SETTING_DESCRIPTORS.length, 12);
    assert.deepEqual(
        enhancer.ENHANCER_SETTING_DESCRIPTORS.map(({ id }) => id),
        [
            "b1FreqHz", "b1Q", "b1Mode", "b1MidAmount", "b1SideAmount", "b1Curve",
            "b2FreqHz", "b2Q", "b2Mode", "b2MidAmount", "b2SideAmount", "b2Curve",
        ],
    );
    assert.deepEqual(
        enhancer.ENHANCER_SETTING_DESCRIPTORS
            .filter(({ kind }) => kind === "number")
            .map(({ id, dspEndpointID, min, max, initial, unit }) => (
                { id, dspEndpointID, min, max, initial, unit }
            )),
        [
            { id: "b1FreqHz", dspEndpointID: "b1FreqHzIn", min: 30, max: 16_000, initial: 130, unit: "Hz" },
            { id: "b1Q", dspEndpointID: "b1QIn", min: 0.3, max: 8, initial: 0.71, unit: "" },
            { id: "b1MidAmount", dspEndpointID: "b1MidAmountIn", min: 0, max: 1, initial: 0, unit: "" },
            { id: "b1SideAmount", dspEndpointID: "b1SideAmountIn", min: 0, max: 1, initial: 0, unit: "" },
            { id: "b2FreqHz", dspEndpointID: "b2FreqHzIn", min: 30, max: 16_000, initial: 9_000, unit: "Hz" },
            { id: "b2Q", dspEndpointID: "b2QIn", min: 0.3, max: 8, initial: 0.71, unit: "" },
            { id: "b2MidAmount", dspEndpointID: "b2MidAmountIn", min: 0, max: 1, initial: 0, unit: "" },
            { id: "b2SideAmount", dspEndpointID: "b2SideAmountIn", min: 0, max: 1, initial: 0, unit: "" },
        ],
    );
    assert.deepEqual(defaults, {
        format: "cosimo.enhancer",
        version: 2,
        b1FreqHz: 130,
        b1Q: 0.71,
        b1Mode: "stereo",
        b1MidAmount: 0,
        b1SideAmount: 0,
        b1Curve: "solid",
        b2FreqHz: 9000,
        b2Q: 0.71,
        b2Mode: "stereo",
        b2MidAmount: 0,
        b2SideAmount: 0,
        b2Curve: "tube",
    });
    assert.ok(enhancer.ENHANCER_SETTING_DESCRIPTORS.every(
        ({ exposure }) => exposure === "static-preset",
    ));
    for (const { id, initial } of enhancer.ENHANCER_SETTING_DESCRIPTORS) {
        assert.equal(defaults[id], initial);
    }

    assert.deepEqual(
        enhancer.parseEnhancerState(enhancer.serializeEnhancerState(defaults)),
        { _tag: "ok", value: defaults },
    );
    assert.equal(enhancer.serializeEnhancerState(defaults), JSON.stringify(defaults));

    const edited = {
        ...defaults,
        b1FreqHz: 47.5,
        b1Q: 8,
        b1Mode: "mid-side",
        b1MidAmount: 0.75,
        b1SideAmount: 0.25,
        b1Curve: "tube",
        b2FreqHz: 15_999.5,
        b2Q: 0.3,
        b2Mode: "stereo",
        b2MidAmount: 1,
        b2SideAmount: 0.5,
        b2Curve: "solid",
    };
    assert.deepEqual(enhancer.parseEnhancerState(edited), { _tag: "ok", value: edited });
    assert.deepEqual(enhancer.toEnhancerDspSettings(edited), {
        b1FreqHzIn: 47.5,
        b1QIn: 8,
        b1ModeIn: 1,
        b1MidAmountIn: 0.75,
        b1SideAmountIn: 0.25,
        b1CurveIn: 0,
        b2FreqHzIn: 15_999.5,
        b2QIn: 0.3,
        b2ModeIn: 0,
        b2MidAmountIn: 1,
        b2SideAmountIn: 0.5,
        b2CurveIn: 1,
    });
});

test("the unpublished always-M/S v1 document migrates without changing its sound", async () => {
    const enhancer = await loadEnhancerState();
    const legacy = {
        format: "cosimo.enhancer",
        version: 1,
        b1FreqHz: 310,
        b1Q: 1.2,
        b1MidAmount: 0.7,
        b1SideAmount: 0.2,
        b1Curve: "tube",
        b2FreqHz: 7500,
        b2Q: 0.8,
        b2MidAmount: 0.3,
        b2SideAmount: 0.9,
        b2Curve: "solid",
    };

    assert.deepEqual(enhancer.parseEnhancerState(legacy), {
        _tag: "ok",
        value: {
            ...legacy,
            version: 2,
            b1Mode: "mid-side",
            b2Mode: "mid-side",
        },
    });
});

test("malformed or partial Enhancer state is rejected at the persistence boundary", async () => {
    const enhancer = await loadEnhancerState();
    const defaults = enhancer.createDefaultEnhancerState();
    const invalidDocuments = [
        null,
        [],
        "not json",
        { ...defaults, format: "cosimo.polish" },
        { ...defaults, version: 3 },
        { ...defaults, b1FreqHz: 29.999 },
        { ...defaults, b2FreqHz: 16_001 },
        { ...defaults, b1Q: Number.NaN },
        { ...defaults, b2Q: Number.POSITIVE_INFINITY },
        { ...defaults, b1MidAmount: -0.001 },
        { ...defaults, b2SideAmount: 1.001 },
        { ...defaults, b1Mode: "left-right" },
        { ...defaults, b2Mode: 1 },
        { ...defaults, b1Curve: "tape" },
        { ...defaults, b2Curve: 1 },
        { ...defaults, extra: true },
        Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== "b2Curve")),
    ];

    for (const document of invalidDocuments) {
        assert.equal(
            enhancer.parseEnhancerState(document)._tag,
            "err",
            `unexpectedly accepted ${JSON.stringify(document)}`,
        );
    }
});

test("the saved sound and routing settings cannot enter host automation, modulation, or Effects Lane catalogs", async () => {
    const [enhancer, rack, modulation, lanes] = await Promise.all([
        loadEnhancerState(),
        loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation-targets.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-slot-params.ts"),
    ]);
    const endpointIDs = new Set(
        enhancer.ENHANCER_SETTING_DESCRIPTORS.map(({ dspEndpointID }) => dspEndpointID),
    );

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

test("the isolated DSP metadata and composition fence encode the T26 ownership boundary", async () => {
    const [enhancer, source, desktopManifest, iosManifest, synth, rack] = await Promise.all([
        loadEnhancerState(),
        fs.readFile(path.join(repoRoot, "cmajor/Enhancer.cmajor"), "utf8"),
        fs.readFile(path.join(repoRoot, "WavetableSynth.cmajorpatch"), "utf8").then(JSON.parse),
        fs.readFile(path.join(repoRoot, "WavetableSynth.iOS.cmajorpatch"), "utf8").then(JSON.parse),
        fs.readFile(path.join(repoRoot, "cmajor/WavetableSynth.cmajor"), "utf8"),
        fs.readFile(path.join(repoRoot, "cmajor/EffectsRack.cmajor"), "utf8"),
    ]);

    assert.match(source, /let enhancerOversampleFactor = 4;/);
    assert.match(source, /band1StereoCore = wt::EnhancerShaperCore \* enhancerOversampleFactor;/);
    assert.match(source, /band1MidSideCore = wt::EnhancerShaperCore \* enhancerOversampleFactor;/);
    assert.match(source, /band2StereoCore = wt::EnhancerShaperCore \* enhancerOversampleFactor;/);
    assert.match(source, /band2MidSideCore = wt::EnhancerShaperCore \* enhancerOversampleFactor;/);
    assert.match(source, /band1StereoCore\.out - band1StereoCore\.thru/);
    assert.match(source, /band1MidSideCore\.out - band1MidSideCore\.thru/);
    assert.match(source, /band2StereoCore\.out - band2StereoCore\.thru/);
    assert.match(source, /band2MidSideCore\.out - band2MidSideCore\.thru/);

    const smoothingSection = source.slice(
        source.indexOf("void smoothControls()"),
        source.indexOf("void updateBandCoefficients()"),
    );
    assert.equal([...smoothingSection.matchAll(/smoothEnhancerControl/g)].length, 12);

    for (const { dspEndpointID } of enhancer.ENHANCER_SETTING_DESCRIPTORS) {
        const declaration = source.split("\n").find((line) => line.includes(` ${dspEndpointID} `));
        assert.ok(declaration, `missing DSP endpoint ${dspEndpointID}`);
        assert.match(declaration, /automatable: false/);
        assert.match(declaration, /rampFrames: 0/);
        assert.match(smoothingSection, new RegExp(`\\b${dspEndpointID}\\b`));
    }

    assert.equal(desktopManifest.source.includes("cmajor/Enhancer.cmajor"), false);
    assert.equal(iosManifest.source.includes("cmajor/Enhancer.cmajor"), false);
    assert.doesNotMatch(synth, /EnhancerBus/);
    assert.doesNotMatch(rack, /EnhancerBus/);
});
