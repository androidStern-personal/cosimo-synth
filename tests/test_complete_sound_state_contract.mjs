import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function t78EffectOutputTrimEndpointIDs(contractSource) {
    return [...contractSource.matchAll(/"(lane[A-Za-z]+[1-5]OutputTrimDb)"/g)]
        .map((match) => match[1]);
}

function vst3ParamID(endpointID) {
    let hash = 0;

    for (const codePoint of endpointID)
        hash = (Math.imul(hash, 31) + codePoint.codePointAt(0)) >>> 0;

    return hash & 0x7fffffff;
}

function auv3ParameterAddress(endpointID) {
    let hash = 0n;

    for (const codePoint of endpointID)
        hash = BigInt.asUintN(64, (hash * 101n) + BigInt(codePoint.codePointAt(0)));

    return hash;
}

function snapshotParameters(snapshotSource) {
    return [...snapshotSource.matchAll(
        /\{\s*"address":\s*(\d+),\s*"identifier":\s*"([^"]+)",\s*"displayName":\s*"([^"]+)"\s*\}/g,
    )].map((match) => ({
        address: BigInt(match[1]),
        identifier: match[2],
        displayName: match[3],
    }));
}

function effectOutputTrimDeclarations(source) {
    return new Map([...source.matchAll(
        /input value float32 (lane[A-Za-z]+[1-5]OutputTrimDb) \[\[ name: "([^"]+)", min: (-?[\d.]+)f, max: (-?[\d.]+)f, init: (-?[\d.]+)f, unit: "([^"]+)", rampFrames: (\d+) \]\];/g,
    )].map((match) => [match[1], {
        title: match[2],
        minimum: Number(match[3]),
        maximum: Number(match[4]),
        defaultValue: Number(match[5]),
        unit: match[6],
        rampFrames: Number(match[7]),
    }]));
}

function effectOutputTrimTitle(endpointID) {
    const match = endpointID.match(
        /^lane(GlobalFilter|Distortion|Ott|Chorus|Flanger|Phaser|Delay|Reverb)([1-5])OutputTrimDb$/,
    );
    assert.ok(match, `unrecognised T78 endpoint ${endpointID}`);
    const familyTitles = {
        GlobalFilter: "Global Filter",
        Distortion: "Distortion",
        Ott: "OTT",
        Chorus: "Chorus",
        Flanger: "Flanger",
        Phaser: "Phaser",
        Delay: "Delay",
        Reverb: "Reverb",
    };
    return `${familyTitles[match[1]]} ${match[2]} Output Trim`;
}

test("the shared native complete-sound contract is T78 and requires all 40 trims", async (context) => {
    const [contractSource, trim] = await Promise.all([
        fs.readFile(path.join(repoRoot, "native/CompleteSoundState.h"), "utf8"),
        loadUIModule(repoRoot, "ui/shared/effect-output-trim.ts"),
    ]);
    const nativeEndpointIDs = t78EffectOutputTrimEndpointIDs(contractSource);
    assert.deepEqual(nativeEndpointIDs, trim.allEffectOutputTrimHostEndpointIDs(),
        "native complete-sound intake must require the exact UI/host trim bank");

    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cosimo-t78-state-"));
    context.after(async () => fs.rm(temporaryDirectory, { recursive: true, force: true }));
    const binaryPath = path.join(temporaryDirectory, "complete-sound-state-contract");

    execFileSync("c++", [
        "-std=c++17",
        "-I", repoRoot,
        path.join(repoRoot, "tests/native/CompleteSoundStateContract.cpp"),
        "-o", binaryPath,
    ], { stdio: "pipe" });
    execFileSync(binaryPath, [], { stdio: "pipe" });
});

test("the desktop VST3 qualification probe freezes all T78 automation identities", async () => {
    const [contractSource, rackSource, probeSource, cmakeSource] = await Promise.all([
        fs.readFile(path.join(repoRoot, "native/CompleteSoundState.h"), "utf8"),
        fs.readFile(path.join(repoRoot, "cmajor/EffectsRack.cmajor"), "utf8"),
        fs.readFile(path.join(repoRoot, "tools/desktop_native/Source/T78VST3AutomationProbe.cpp"), "utf8"),
        fs.readFile(path.join(repoRoot, "tools/desktop_native/CMakeLists.txt"), "utf8"),
    ]);
    const endpointIDs = t78EffectOutputTrimEndpointIDs(contractSource);
    const declarations = effectOutputTrimDeclarations(rackSource);
    const paramIDs = endpointIDs.map(vst3ParamID);

    assert.equal(endpointIDs.length, 40);
    assert.equal(new Set(endpointIDs).size, 40);
    assert.equal(new Set(paramIDs).size, 40, "the canonical endpoints must not collide as VST3 ParamIDs");
    assert.deepEqual([...declarations.keys()], endpointIDs);
    for (const endpointID of endpointIDs) {
        assert.deepEqual(declarations.get(endpointID), {
            title: effectOutputTrimTitle(endpointID),
            minimum: -100,
            maximum: 35,
            defaultValue: 0,
            unit: "dB",
            rampFrames: 64,
        });
    }

    assert.match(probeSource, /native\/CompleteSoundState\.h/);
    assert.match(probeSource, /t78EffectOutputTrimParameterIDs/);
    assert.match(probeSource, /juce::VST3PluginFormat/);
    assert.match(probeSource, /findAllTypesForFile/);
    assert.match(probeSource, /createInstanceFromDescription/);
    assert.match(probeSource, /stableVST3ParamID/);
    assert.match(probeSource, /31u \* hash/);
    assert.match(probeSource, /0x7fffffffu/);
    assert.match(probeSource, /getHostedParameter/);
    assert.match(probeSource, /getParameterID/);
    assert.match(probeSource, /getName/);
    assert.match(probeSource, /getLabel/);
    assert.match(probeSource, /getDefaultValue/);
    assert.match(probeSource, /getText \(0\.0f/);
    assert.match(probeSource, /getText \(1\.0f/);
    assert.match(probeSource, /getNumSteps/);
    assert.match(probeSource, /isDiscrete/);
    assert.match(probeSource, /isAutomatable/);
    assert.match(probeSource, /beginChangeGesture \(\)/);
    assert.match(probeSource, /setValueNotifyingHost \(automationValue\)/);
    assert.match(probeSource, /endChangeGesture \(\)/);
    assert.match(probeSource, /getValue \(\) - automationValue/);
    assert.match(cmakeSource, /add_executable\(cosimo_t78_vst3_automation_probe EXCLUDE_FROM_ALL/);
    assert.match(cmakeSource, /JUCE_PLUGINHOST_VST3=1/);
});

test("the out-of-process AUv3 smoke freezes and writes every T78 trim identity", async () => {
    const [contractSource, rackSource, snapshotSource, harnessSource, harnessHeader,
        controllerSource, runnerSource] = await Promise.all([
        fs.readFile(path.join(repoRoot, "native/CompleteSoundState.h"), "utf8"),
        fs.readFile(path.join(repoRoot, "cmajor/EffectsRack.cmajor"), "utf8"),
        fs.readFile(path.join(repoRoot, "ios_auv3/expected_host_smoke.json"), "utf8"),
        fs.readFile(path.join(repoRoot, "ios_auv3/Source/CosimoAUv3HostHarness.mm"), "utf8"),
        fs.readFile(path.join(repoRoot, "ios_auv3/Source/CosimoAUv3HostHarness.h"), "utf8"),
        fs.readFile(path.join(repoRoot, "ios_auv3/Source/CosimoHostViewController.mm"), "utf8"),
        fs.readFile(path.join(repoRoot, "scripts/run_ios_auv3_host_smoke.py"), "utf8"),
    ]);
    const endpointIDs = t78EffectOutputTrimEndpointIDs(contractSource);
    const declarations = effectOutputTrimDeclarations(rackSource);
    const expectedParameters = endpointIDs.map((identifier) => ({
        address: auv3ParameterAddress(identifier),
        identifier,
        displayName: declarations.get(identifier).title,
    }));
    const fullSnapshotSource = snapshotSource.slice(
        snapshotSource.indexOf('"parameters"'),
        snapshotSource.indexOf('"t78EffectOutputTrimParameters"'),
    );
    const t78SnapshotSource = snapshotSource.slice(
        snapshotSource.indexOf('"t78EffectOutputTrimParameters"'),
        snapshotSource.indexOf('"savedStateKeys"'),
    );
    const fullSnapshot = snapshotParameters(fullSnapshotSource);

    assert.equal(fullSnapshot.length, 65);
    assert.deepEqual(fullSnapshot.slice(-40), expectedParameters);
    assert.deepEqual(snapshotParameters(t78SnapshotSource), expectedParameters);
    assert.equal(new Set(expectedParameters.map(({ address }) => address.toString())).size, 40);
    assert.equal(new Set(expectedParameters.map(({ displayName }) => displayName)).size, 40);
    assert.match(harnessSource, /native\/CompleteSoundState\.h/);
    assert.match(harnessSource, /t78EffectOutputTrimParameterIDs/);
    assert.match(harnessHeader, /qualifyT78EffectOutputTrimParametersWithCompletion/);
    assert.match(harnessSource, /qualifyT78EffectOutputTrimParametersWithCompletion/);
    assert.match(harnessSource, /setParameterWithIdentifier:identifier/);
    assert.match(harnessSource, /matchedParameter\.minValue != 0\.0f/);
    assert.match(harnessSource, /matchedParameter\.maxValue != 1\.0f/);
    assert.match(harnessSource, /kAudioUnitParameterFlag_IsReadable/);
    assert.match(harnessSource, /kAudioUnitParameterFlag_IsWritable/);
    assert.match(harnessSource, /kAudioUnitParameterFlag_CanRamp/);
    assert.match(harnessSource, /kAudioUnitParameterFlag_NonRealTime/);
    assert.match(harnessSource, /stringFromValue:&minimumValue/);
    assert.match(harnessSource, /stringFromValue:&defaultValue/);
    assert.match(harnessSource, /stringFromValue:&maximumValue/);
    assert.match(controllerSource, /qualifyT78EffectOutputTrimParametersWithCompletion/);
    assert.match(controllerSource, /effectOutputTrimParameterSet/);
    assert.match(runnerSource, /effectOutputTrimParameterSet/);
});

test("desktop and iOS reject incomplete native chunks before any restore mutation", async () => {
    const [desktop, ios] = await Promise.all([
        fs.readFile(path.join(repoRoot, "tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp"), "utf8"),
        fs.readFile(path.join(repoRoot, "ios_auv3/Source/CosimoCmajorPlugin.h"), "utf8"),
    ]);

    for (const source of [desktop, ios]) {
        assert.match(source, /native\/CompleteSoundState\.h/);
        assert.match(source, /cosimo::complete_sound::version/);
        assert.match(source, /isCurrentT78CompleteSoundState/);
        assert.match(source, /version == nullptr \|\| \(! version->isInt\(\) && ! version->isInt64\(\)\)/);
    }

    assert.ok(
        desktop.indexOf("isCurrentCompleteSoundState (restoredState)")
            < desktop.indexOf("lastLoadedStateHash != stateHash"),
    );
    assert.ok(
        desktop.indexOf("isCurrentCompleteSoundState (restoredState)")
            < desktop.indexOf("setFixedStateSynchronously (restoredState)"),
    );
    assert.ok(
        ios.indexOf("isCurrentCompleteSoundState (restoredState)")
            < ios.indexOf("lastLoadedStateHash != stateHash"),
    );
    const iosRestore = ios.slice(ios.indexOf("void setNewState (const juce::ValueTree& newState)"));
    assert.ok(iosRestore.indexOf("isCurrentCompleteSoundState (newState)")
        < iosRestore.indexOf("readParametersFromState (loadParams, newState)"));
    assert.ok(iosRestore.indexOf("isCurrentCompleteSoundState (newState)")
        < iosRestore.indexOf("patch->setStoredStateValue"));
});
