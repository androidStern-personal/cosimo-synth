import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  SHAPER_MAX_POINTS,
  effectiveShapePoints,
  evaluateBipolarTransfer,
  morphOwner,
} from "../fx/polish_lab/view/curve-model.js";
import {
    desiredGainReductionDbForLevel,
    effectiveCompressorSettings,
    evaluateCompressorTransfer,
} from "../fx/polish_lab/view/dynamics-model.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(repoRoot, "fx/polish_lab/PolishVoicingLab.cmajor");
const manifestPath = path.join(repoRoot, "fx/polish_lab/PolishVoicingLab.cmajorpatch");

function parseInitialValues(source) {
    const values = new Map();
    const endpointPattern = /^\s*input\s+value\s+(?:bool|float32)\s+([A-Za-z_][A-Za-z0-9_]*)\s+\[\[(.*?)\]\];/gm;
    let endpointMatch;

    while ((endpointMatch = endpointPattern.exec(source)) !== null) {
        const initMatch = endpointMatch[2].match(/\binit\s*:\s*([^,\]]+)/);
        if (!initMatch) continue;
        const rawValue = initMatch[1].trim();
        const value = rawValue === "true" ? true
            : rawValue === "false" ? false
                : Number(rawValue.replace(/f$/, ""));
        values.set(endpointMatch[1], value);
    }

    return values;
}

test("the design lab starts from a neutral two-sided curve", async () => {
    const source = await fs.readFile(sourcePath, "utf8");
    const initial = parseInitialValues(source);

    assert.equal(initial.get("thresholdDb"), 0);
    assert.equal(initial.get("ratio"), 4);
    assert.equal(initial.get("kneeDb"), 6);
    assert.equal(initial.get("attackMs"), 10);
    assert.equal(initial.get("releaseMs"), 120);
    assert.equal(initial.get("makeupDb"), 0);

    assert.equal(initial.get("curvePointCount"), 1);
    assert.equal(initial.get("curveP1X"), 1);
    assert.equal(initial.get("curveP1Y"), 1);
    assert.equal(initial.get("curveNPointCount"), 1);
    assert.equal(initial.get("curveN1X"), 1);
    assert.equal(initial.get("curveN1Y"), -1);
    assert.equal(initial.get("morph"), 0);
    assert.equal(initial.get("morphSide"), 1);
    assert.equal(initial.get("morphPoint"), 1);
    assert.equal(initial.get("morphTargetX"), 0.72);
    assert.equal(initial.get("morphTargetY"), 1.05);
});

test("the interactive graph models use only the visible compressor and bipolar waveshaper state", () => {
    assert.ok(Math.abs(desiredGainReductionDbForLevel(0, 0, 4, 6) - (-0.5625)) < 1e-12);
    assert.ok(Math.abs(evaluateCompressorTransfer(0, new Map()) - (-0.5625)) < 1e-12);
    assert.ok(Math.abs(evaluateCompressorTransfer(6, new Map()) - 1.5) < 1e-12);

    const unrelatedState = effectiveCompressorSettings(new Map([
        ["amount", 100],
        ["macroRatioTarget", 1000],
        ["macroMakeupDb", 12],
        ["ratio", 4],
        ["makeupDb", 2],
    ]));
    assert.deepEqual(unrelatedState, {
        thresholdDb: 0,
        ratio: 4,
        kneeDb: 6,
        makeupDb: 2,
    });
    assert.equal(evaluateBipolarTransfer(0.5), 0.5);
    assert.equal(evaluateBipolarTransfer(-0.5), -0.5);
    assert.equal(evaluateBipolarTransfer(1.25), 1);
    assert.equal(evaluateBipolarTransfer(-1.25), -1);
});

test("the waveshaper supports independent sides, arbitrary output, bends, and one linear point morph", () => {
    assert.equal(SHAPER_MAX_POINTS, 7);

    const values = {
        curvePointCount: 2,
        curveP1X: 0.5,
        curveP1Y: 0.6,
        curveP2X: 1.0,
        curveP2Y: 0.8,
        curveB1: 0,
        curveB2: 0.05,
        curveNPointCount: 1,
        curveN1X: 1,
        curveN1Y: -0.4,
        curveNB1: 0,
        morph: 0,
        morphSide: 1,
        morphPoint: 1,
        morphTargetX: 0.25,
        morphTargetY: 0.8,
    };

    assert.ok(Math.abs(evaluateBipolarTransfer(0.25, values) - 0.3) < 1e-12);
    assert.ok(Math.abs(evaluateBipolarTransfer(0.75, values) - 0.75) < 1e-12);
    assert.equal(evaluateBipolarTransfer(1.2, values), 0.8);
    assert.equal(evaluateBipolarTransfer(-0.5, values), -0.2);
    assert.equal(evaluateBipolarTransfer(-1.2, values), -0.4);

    const morphed = { ...values, morph: 50 };
    assert.deepEqual(effectiveShapePoints(morphed, "positive")[1], {
        side: "positive",
        index: 1,
        x: 0.375,
        y: 0.7,
        bend: 0,
    });
    assert.deepEqual(effectiveShapePoints(morphed, "negative"), effectiveShapePoints(values, "negative"));
    assert.deepEqual(morphOwner({ ...values, curvePointCount: 1, morphPoint: 7 }), {
        side: "positive",
        index: 1,
    });

    assert.equal(evaluateBipolarTransfer(1.2, { ...values, curveP2Y: -0.2 }), -0.2);

    const descending = {
        ...values,
        curveP1Y: 0.8,
        curveP2Y: 0.2,
        curveB2: 0.25,
    };
    assert.ok(
        Math.abs(evaluateBipolarTransfer(0.75, descending) - 0.75) < 1e-12,
        "positive bend is a +0.25 output-space midpoint offset on a descending segment",
    );
    assert.ok(
        Math.abs(evaluateBipolarTransfer(0.75, { ...descending, curveP2Y: 0.8 }) - 1.05) < 1e-12,
        "a flat segment remains bendable in output space",
    );
    const flatNegative = {
        ...values,
        curveNPointCount: 2,
        curveN1X: 0.4,
        curveN1Y: -0.2,
        curveN2X: 0.9,
        curveN2Y: -0.2,
        curveNB2: 0.2,
    };
    assert.ok(
        Math.abs(evaluateBipolarTransfer(-0.65, flatNegative)) < 1e-12,
        "the JS model matches the Cmajor flat negative-segment midpoint fixture",
    );

    const sanitized = effectiveShapePoints({
        ...values,
        curvePointCount: 7,
        curveP1X: 1.49,
        curveP2X: 0.2,
        curveP3X: 0.1,
        curveP4X: 0.1,
        curveP5X: 0.1,
        curveP6X: 0.1,
        curveP7X: 0.1,
    }, "positive");
    assert.equal(sanitized.length, 8);
    for (let index = 1; index < sanitized.length; index += 1) {
        assert.ok(sanitized[index].x > sanitized[index - 1].x);
    }
});

test("the plugin exposes only the requested design surface while remaining isolated and independently named", async () => {
    const source = await fs.readFile(sourcePath, "utf8");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const viewSource = await fs.readFile(path.join(repoRoot, "fx/polish_lab/view/source.js"), "utf8");
    const curveModelSource = await fs.readFile(path.join(repoRoot, "fx/polish_lab/view/curve-model.js"), "utf8");
    const helpSource = await fs.readFile(path.join(repoRoot, "fx/polish_lab/view/control-help.js"), "utf8");
    const initial = parseInitialValues(source);
    const requiredControls = [
        "thresholdDb", "ratio", "kneeDb", "attackMs", "releaseMs", "makeupDb",
        "morph", "morphSide", "morphPoint", "morphTargetX", "morphTargetY",
        "curvePointCount", "curveNPointCount",
        "curveP1X", "curveP1Y", "curveN1X", "curveN1Y",
        "curveP4X", "curveP4Y", "curveP5X", "curveP5Y",
        "curveP6X", "curveP6Y", "curveP7X", "curveP7Y",
        "curveB1", "curveB2", "curveB3", "curveB4", "curveB5", "curveB6", "curveB7",
        "curveN4X", "curveN4Y", "curveN5X", "curveN5Y",
        "curveN6X", "curveN6Y", "curveN7X", "curveN7Y",
        "curveNB1", "curveNB2", "curveNB3", "curveNB4", "curveNB5", "curveNB6", "curveNB7",
    ];

    for (const endpointID of requiredControls)
        assert.ok(initial.has(endpointID), `missing ${endpointID}`);

    assert.equal(initial.get("curvePointCount"), 1);
    assert.equal(initial.get("curveNPointCount"), 1);

    assert.equal(manifest.ID, "dev.cosimo.polish-voicing-lab");
    assert.equal(manifest.name, "Polish Voicing Lab");
    assert.match(source, /BipolarShapeCoreChannel \* polishlab::clipOversampleFactor/);
    assert.match(source, /clipOversampleFactor = 4/);
    assert.match(source, /output event polishlab::MeterFrame meterOut/);
    assert.match(source, /currentCompressorInputDb = polishlab::gainToDb \(linkedDetector\)/);
    assert.match(source, /currentClipInput = signal\[0\]/);
    assert.match(source, /currentClipOutput = rendered\[0\]/);
    assert.match(source, /frame\.compressorInputDb = meterCompressorInputDb/);
    assert.match(source, /frame\.compressorOutputDb = meterCompressorOutputDb/);
    assert.match(source, /frame\.clipInput = meterClipInput/);
    assert.match(source, /frame\.clipOutput = meterClipOutput/);
    assert.doesNotMatch(source, /ClipCoreChannel|tensionWarp|evaluatePositiveCurve|\bdriveDb\b/);
    assert.doesNotMatch(curveModelSource, /CURVE_DEFAULTS|sanitizeCurve|tensionWarp|evaluateCurve/);
    assert.match(viewSource, /COMPRESSOR_CONTROLS/);
    assert.match(viewSource, /data-morph-controls/);
    for (const removedEndpoint of [
        "amount", "macroCurve", "inputTrimDb", "outputTrimDb", "macroInputDriveDb",
        "macroMakeupDb", "macroRatioTarget", "lowCutMix", "lowCutHz", "lowCutSlope",
        "colorFrequencyHz", "colorGainDb", "colorQ", "detectorMode", "rmsWindowMs",
        "detectorHpHz", "stereoLink", "compMix", "clipDriveDb", "clipMix",
        "curveEditorEnabled", "curveAmountPoint", "curveAmountTargetX", "curveAmountTargetY",
    ]) {
        assert.doesNotMatch(source, new RegExp(`input value (?:bool|float32) ${removedEndpoint}\\b`));
    }
    assert.doesNotMatch(
        viewSource,
        /Macro Wiring|Tone|Decoded|Reference|Amount Curve|Input Range|Clip Mix|Knot|Tension/i,
    );

    for (const productSurface of [source, JSON.stringify(manifest), viewSource, helpSource]) {
        assert.doesNotMatch(productSurface, /Sausage|Fattener|Dada Life/i);
        assert.doesNotMatch(productSurface, /reference_labs\/polish_comp_clip/);
    }
});

test("the generic VST3 install path builds and associates the compiled self-contained lab runtime", async () => {
    const { createJitInstallPlan } = await import("../fx/build-effect.mjs");
    const installPlan = createJitInstallPlan("polish");
    const runtimeManifest = JSON.parse(await fs.readFile(
        path.join(repoRoot, installPlan.runtimePatch),
        "utf8",
    ));

    assert.equal(installPlan.patch, "fx/polish_lab/PolishVoicingLab.cmajorpatch");
    assert.equal(installPlan.jitInstallRuntime, true, "fx:jit:install must associate the built runtime, not the source patch");
    assert.equal(installPlan.runtimePatch, "build/fx/polish_lab_runtime/PolishVoicingLab.cmajorpatch");
    assert.equal(runtimeManifest.view.src, "view/index.js");
    await fs.access(path.join(repoRoot, path.dirname(installPlan.runtimePatch), "view/app.js"));
});
