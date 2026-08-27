import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { decodedSettings, mappingBySuffix } from "../reference_labs/polish_comp_clip/lib/fixture-settings.mjs";
import {
  CURVE_DEFAULTS,
  evaluateCurve,
  evaluateClipperTransfer,
  sanitizeCurve,
} from "../fx/polish_lab/view/curve-model.js";
import {
    desiredGainReductionDbForLevel,
    effectiveCompressorSettings,
    evaluateCompressorTransfer,
} from "../fx/polish_lab/view/dynamics-model.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(repoRoot, "fx/polish_lab/PolishVoicingLab.cmajor");
const manifestPath = path.join(repoRoot, "fx/polish_lab/PolishVoicingLab.cmajorpatch");
const transferFixturePath = path.join(repoRoot, "reference_labs/polish_comp_clip/fixtures/transfer-samples.json");

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

function assertFloat32Default(actual, expected, label) {
    assert.equal(Math.fround(actual), Math.fround(expected), label);
}

test("the plugin reset state maps every reproducible decoded comp, clip, trim, and macro value", async () => {
    const source = await fs.readFile(sourcePath, "utf8");
    const initial = parseInitialValues(source);
    const facts = decodedSettings.decodedPresetFacts;
    const derived = decodedSettings.cosimoDerivedValues;

    assertFloat32Default(initial.get("inputTrimDb"), derived.inputToolGainDb, "input trim");
    assertFloat32Default(initial.get("outputTrimDb"), derived.outputToolGainDb, "output trim");
    assertFloat32Default(initial.get("thresholdDb"), facts.compressor.HIGH_THRESHOLD.value, "threshold");
    assertFloat32Default(initial.get("ratio"), derived.compressorRatioFromStoredSlope, "ratio conversion");
    assertFloat32Default(initial.get("kneeDb"), facts.compressor.HIGH_KNEE.value, "knee");
    assertFloat32Default(initial.get("attackMs"), derived.compressorAttackSeconds * 1000, "attack");
    assertFloat32Default(initial.get("releaseMs"), derived.compressorReleaseSeconds * 1000, "release");
    assertFloat32Default(initial.get("makeupDb"), facts.compressor.OUTPUT_GAIN.value, "makeup");
    assertFloat32Default(initial.get("clipDriveDb"), facts.curve.drive.value, "clip drive");

    assertFloat32Default(initial.get("macroInputDriveDb"), mappingBySuffix("/AMPLITUDE").mappedAmount.value, "macro input mapping");
    assertFloat32Default(initial.get("macroMakeupDb"), mappingBySuffix("/OUTPUT_GAIN").mappedAmount.value, "macro makeup mapping");
    assert.equal(mappingBySuffix("/HIGH_RATIO").mappedAmount.value, -0.025200000000000014);
    assertFloat32Default(initial.get("macroRatioTarget"), 1000, "documented limiting approximation");

    const expectedCurve = facts.curve.points.slice(1).flatMap(point => [
        point.input.value,
        point.output.value,
        point.tension.value,
    ]);
    const pluginCurve = [
        initial.get("curveP1X"), initial.get("curveP1Y"), initial.get("curveP1T"),
        initial.get("curveP2X"), initial.get("curveP2Y"), initial.get("curveP2T"),
        initial.get("curveP3X"), initial.get("curveP3Y"), initial.get("curveP3T"),
    ];
    pluginCurve.forEach((value, index) => assertFloat32Default(value, expectedCurve[index], `curve field ${index}`));

    assert.equal(initial.get("amount"), 0);
    assert.equal(initial.get("lowCutMix"), 0);
    assert.equal(initial.get("colorGainDb"), 0);
    assert.equal(initial.get("detectorMode"), 0);
    assert.equal(initial.get("stereoLink"), 100);
    assert.equal(initial.get("compMix"), 100);
    assert.equal(initial.get("clipMix"), 100);
});

test("the live curve preview stays pinned to exact decoded points and sampled transfer fixtures", async () => {
    const facts = decodedSettings.decodedPresetFacts;
    assert.deepEqual(CURVE_DEFAULTS, {
        curveP1X: facts.curve.points[1].input.value,
        curveP1Y: facts.curve.points[1].output.value,
        curveP1T: facts.curve.points[1].tension.value,
        curveP2X: facts.curve.points[2].input.value,
        curveP2Y: facts.curve.points[2].output.value,
        curveP2T: facts.curve.points[2].tension.value,
        curveP3X: facts.curve.points[3].input.value,
        curveP3Y: facts.curve.points[3].output.value,
        curveP3T: facts.curve.points[3].tension.value,
    });

    const fixture = JSON.parse(await fs.readFile(transferFixturePath, "utf8"));
    for (const sample of fixture.samples)
        assert.equal(evaluateCurve(sample.input), sample.output, `transfer sample ${sample.input}`);

    const sanitized = sanitizeCurve({
        curveP1X: 1.4,
        curveP2X: 0.2,
        curveP3X: 0.1,
        curveP1Y: 1.3,
        curveP2Y: 0.2,
        curveP3Y: 0.1,
    });
    assert.ok(sanitized[0].x < sanitized[1].x && sanitized[1].x < sanitized[2].x && sanitized[2].x < sanitized[3].x);
    assert.ok(sanitized[0].y <= sanitized[1].y && sanitized[1].y <= sanitized[2].y && sanitized[2].y <= sanitized[3].y);
});

test("the interactive graphs sample the same compressor and driven clipper math as the DSP", () => {
    assert.ok(Math.abs(desiredGainReductionDbForLevel(0, 0, 4, 6) - (-0.5625)) < 1e-12);
    assert.ok(Math.abs(evaluateCompressorTransfer(0, new Map()) - (-0.04)) < 1e-12);
    assert.ok(Math.abs(evaluateCompressorTransfer(6, new Map()) - 0.48560000065174336) < 1e-12);

    const fullAmount = effectiveCompressorSettings(new Map([["amount", 100]]));
    assert.deepEqual(fullAmount, {
        macro: 1,
        thresholdDb: 0,
        ratio: 1000,
        kneeDb: 0,
        makeupDb: 4.08,
        mix: 1,
    });

    assert.ok(Math.abs(evaluateClipperTransfer(0.5) - 0.43030531109079617) < 1e-12);
    assert.equal(evaluateClipperTransfer(0.5, { clipDriveDb: 6, clipMix: 50 }), 0.75);
    assert.equal(evaluateClipperTransfer(-0.5, { clipDriveDb: 6, clipMix: 50 }), -0.75);
});

test("the plugin exposes the complete requested design surface while remaining isolated and independently named", async () => {
    const source = await fs.readFile(sourcePath, "utf8");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const viewSource = await fs.readFile(path.join(repoRoot, "fx/polish_lab/view/source.js"), "utf8");
    const helpSource = await fs.readFile(path.join(repoRoot, "fx/polish_lab/view/control-help.js"), "utf8");
    const initial = parseInitialValues(source);
    const requiredControls = [
        "amount", "macroCurve", "inputTrimDb", "outputTrimDb",
        "macroInputDriveDb", "macroMakeupDb", "macroRatioTarget",
        "lowCutMix", "lowCutHz", "lowCutSlope", "colorFrequencyHz", "colorGainDb", "colorQ",
        "thresholdDb", "ratio", "kneeDb", "attackMs", "releaseMs", "makeupDb",
        "detectorMode", "rmsWindowMs", "detectorHpHz", "stereoLink", "compMix",
        "clipDriveDb", "clipMix",
        "curveP1X", "curveP1Y", "curveP1T",
        "curveP2X", "curveP2Y", "curveP2T",
        "curveP3X", "curveP3Y", "curveP3T",
    ];

    for (const endpointID of requiredControls)
        assert.ok(initial.has(endpointID), `missing ${endpointID}`);

    assert.equal(manifest.ID, "dev.cosimo.polish-voicing-lab");
    assert.equal(manifest.name, "Polish Voicing Lab");
    assert.match(source, /ClipCoreChannel \* polishlab::clipOversampleFactor/);
    assert.match(source, /clipOversampleFactor = 4/);
    assert.match(source, /output event polishlab::MeterFrame meterOut/);
    assert.match(source, /currentCompressorInputDb = polishlab::gainToDb \(linkedDetector\)/);
    assert.match(source, /currentClipInput = signal\[0\]/);
    assert.match(source, /currentClipOutput = rendered\[0\]/);
    assert.match(source, /frame\.compressorInputDb = meterCompressorInputDb/);
    assert.match(source, /frame\.compressorOutputDb = meterCompressorOutputDb/);
    assert.match(source, /frame\.clipInput = meterClipInput/);
    assert.match(source, /frame\.clipOutput = meterClipOutput/);
    assert.match(viewSource, /RMS delta/);
    assert.match(viewSource, /Restore decoded start/);

    for (const productSurface of [source, JSON.stringify(manifest), viewSource, helpSource]) {
        assert.doesNotMatch(productSurface, /Sausage|Fattener|Dada Life/i);
        assert.doesNotMatch(productSurface, /reference_labs\/polish_comp_clip/);
    }
});

test("the generic VST3 install path builds and associates the compiled self-contained lab runtime", async () => {
    const buildSource = await fs.readFile(path.join(repoRoot, "fx/build-effect.mjs"), "utf8");
    const installer = await fs.readFile(path.join(repoRoot, "scripts/install_fx_cmajplugin.sh"), "utf8");
    const runtimeManifest = JSON.parse(await fs.readFile(
        path.join(repoRoot, "build/fx/polish_lab_runtime/PolishVoicingLab.cmajorpatch"),
        "utf8",
    ));

    assert.match(buildSource, /polish:\s*\{/);
    assert.match(installer, /polish\)\s*\n\s*patch_rel="fx\/polish_lab\/PolishVoicingLab\.cmajorpatch"/);
    assert.match(installer, /build\/fx\/polish_lab_runtime\/PolishVoicingLab\.cmajorpatch/);
    assert.equal(runtimeManifest.view.src, "view/index.js");
    await fs.access(path.join(repoRoot, "build/fx/polish_lab_runtime/view/app.js"));
});
