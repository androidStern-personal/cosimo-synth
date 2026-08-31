import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
    return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

test("both synth manifests compose the accepted Enhancer only through the fixed Polish section", async () => {
    const manifests = await Promise.all([
        read("WavetableSynth.cmajorpatch").then(JSON.parse),
        read("WavetableSynth.iOS.cmajorpatch").then(JSON.parse),
    ]);

    for (const manifest of manifests) {
        assert.ok(manifest.source.includes("cmajor/Enhancer.cmajor"));
        assert.ok(manifest.source.includes("cmajor/Polish.cmajor"));
        assert.equal(manifest.source.includes("cmajor/RackOutputStage.cmajor"), false);
        assert.ok(
            manifest.source.indexOf("cmajor/Enhancer.cmajor")
                < manifest.source.indexOf("cmajor/Polish.cmajor"),
        );
        assert.ok(
            manifest.source.indexOf("cmajor/Polish.cmajor")
                < manifest.source.indexOf("cmajor/WavetableSynth.cmajor"),
        );
    }
});

test("the production graph exposes the compact Polish controls and ends rack to Polish to output", async () => {
    const source = await read("cmajor/WavetableSynth.cmajor");
    const publicControls = [
        "polishEnhancerAmount",
        "polishCompressionClipAmount",
        "polishOutputTrimDb",
        "polishSafeBassAmount",
        "polishSafeBassBypass",
        "polishEnhancerBypass",
        "polishCompressionClipBypass",
        "polishOutputTrimBypass",
    ];

    for (const endpointID of publicControls) {
        assert.match(source, new RegExp(`input value float32 ${endpointID} \\[\\[`));
        assert.match(source, new RegExp(`${endpointID} -> polish\\.`));
    }
    assert.match(source, /output event \(wt::PolishMeterFrame, wt::EnhancerSpectrumFrame\) polishMeter;/);
    assert.match(source, /node polish = wt::PolishBus;/);
    assert.match(source, /rack\.out -> polish\.in;/);
    assert.match(source, /polish\.enhancerInputMonitor -> polishInputSpectrum\.in;/);
    assert.match(source, /polish\.out -> audioOut;/);
    assert.match(source, /polish\.meterOut -> polishMeter;/);
    assert.match(source, /static_assert \(processor\.latency == wt::polishLatencyFrames/);
    assert.doesNotMatch(source, /RackOutputStage|outputStage/);

    const polishEndpointMentions = [...source.matchAll(/input value float32 (polish\w+)/g)]
        .map((match) => match[1]);
    assert.deepEqual(polishEndpointMentions, publicControls);
});

test("Polish reuses the dormant Enhancer analyzer and multiplexes spectrum through its existing telemetry endpoint", async () => {
    const [source, analyzer, polishContract, polish, hostSnapshot, ...manifests] = await Promise.all([
        read("cmajor/WavetableSynth.cmajor"),
        read("cmajor/EnhancerLiteSpectrumAnalyzer.cmajor"),
        read("ui/shared/polish.ts"),
        read("cmajor/Polish.cmajor"),
        read("ios_auv3/expected_host_smoke.json").then(JSON.parse),
        read("WavetableSynth.cmajorpatch").then(JSON.parse),
        read("WavetableSynth.iOS.cmajorpatch").then(JSON.parse),
    ]);

    for (const manifest of manifests) {
        assert.ok(manifest.source.includes("cmajor/EnhancerLiteSpectrumAnalyzer.cmajor"));
    }
    assert.match(analyzer, /processor EnhancerSpectrumAnalyzer \(int32 initiallyEnabled\)/);
    assert.match(source, /output event \(wt::PolishMeterFrame, wt::EnhancerSpectrumFrame\) polishMeter;/);
    assert.match(source, /^\s*input event int32 polishAnalyzerEnabledIn;\s*$/m);
    assert.doesNotMatch(source, /input event int32 polishAnalyzerEnabledIn\s*\[\[/);
    assert.match(source, /node polishInputSpectrum = wt::EnhancerSpectrumAnalyzer \(0\);/);
    assert.match(source, /polishAnalyzerEnabledIn -> polishInputSpectrum\.enabledIn;/);
    assert.match(polish, /output stream float32<2> enhancerInputMonitor;/);
    assert.match(polish, /let enhancerInput = applySafeBass \(in\);/);
    assert.match(polish, /enhancerInputMonitor <- enhancerInput;/);
    assert.match(polish, /driveEnhancer \(enhancerInput\);/);
    assert.match(source, /rack\.out -> polish\.in;/);
    assert.match(source, /polish\.enhancerInputMonitor -> polishInputSpectrum\.in;/);
    assert.match(source, /polishInputSpectrum\.spectrum -> polishMeter;/);
    assert.match(polish, /float32 compressorGainReductionDb;/);
    assert.match(polish, /frame\.compressorGainReductionDb = compressorReductionDb;/);

    const publicPolishInputs = [...source.matchAll(/input value float32 (polish\w+)/g)]
        .map((match) => match[1]);
    assert.deepEqual(publicPolishInputs, [
        "polishEnhancerAmount",
        "polishCompressionClipAmount",
        "polishOutputTrimDb",
        "polishSafeBassAmount",
        "polishSafeBassBypass",
        "polishEnhancerBypass",
        "polishCompressionClipBypass",
        "polishOutputTrimBypass",
    ]);
    assert.match(polishContract, /POLISH_ANALYZER_ENABLED_ENDPOINT_ID = "polishAnalyzerEnabledIn"/);
    const publicParameterInventory = polishContract.match(
        /POLISH_PARAMETER_ENDPOINT_IDS = Object\.freeze\(\[([\s\S]*?)\] as const\)/,
    )?.[1];
    assert.ok(publicParameterInventory);
    assert.doesNotMatch(publicParameterInventory, /POLISH_ANALYZER_ENABLED_ENDPOINT_ID|polishAnalyzerEnabledIn/);
    assert.equal(
        hostSnapshot.parameters.some(({ identifier }) => identifier === "polishAnalyzerEnabledIn"),
        false,
        "the runtime-only analyzer lifecycle event must stay out of the frozen host inventory",
    );
});

test("native plugin seams forward the compiled graph latency to their hosts", async () => {
    const [iosHost, desktopHost] = await Promise.all([
        read("ios_auv3/Source/CosimoCmajorPlugin.h"),
        read("tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp"),
    ]);

    assert.match(iosHost, /patch->getFramesLatency\(\)/);
    assert.match(iosHost, /setLatencySamples \(newLatency\)/);
    assert.match(iosHost, /details\.latencyChanged = newLatency != getLatencySamples\(\)/);
    assert.match(desktopHost, /public cmaj::plugin::JUCEPluginBase</);
});

test("native host state stamps the current complete sound and rejects older chunks before mutation", async () => {
    const [iosHost, desktopHost] = await Promise.all([
        read("ios_auv3/Source/CosimoCmajorPlugin.h"),
        read("tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp"),
    ]);

    assert.match(desktopHost, /completeSoundVersionID \{ "completeSoundVersion" \}/);
    assert.match(desktopHost, /auto state = getUpdatedState\(\);/);
    assert.match(desktopHost, /state\.setProperty \(completeSoundVersionID, cosimo::complete_sound::version, nullptr\)/);
    assert.match(desktopHost, /if \(! isCurrentCompleteSoundState \(restoredState\)\)\s*return;/);
    assert.match(desktopHost, /readParametersFromState \(loadParams, newState\);/);
    assert.ok(
        desktopHost.indexOf("isCurrentCompleteSoundState (restoredState)")
            < desktopHost.indexOf("lastLoadedStateHash != stateHash"),
    );

    assert.match(iosHost, /completeSoundVersion \{ "completeSoundVersion" \}/);
    assert.match(iosHost, /state\.setProperty \(ids\.completeSoundVersion, cosimo::complete_sound::version, nullptr\)/);
    assert.match(iosHost, /for \(const auto& parameter : patch->getParameterList\(\)\)[\s\S]*?parameter->properties\.endpointID[\s\S]*?parameter->currentValue/);
    assert.match(iosHost, /if \(! isCurrentCompleteSoundState \(restoredState\)\)\s*return;/);
    assert.match(iosHost, /void setNewState \(const juce::ValueTree& newState\)[\s\S]*?if \(! isCurrentCompleteSoundState \(newState\)\)\s*return;/);
    assert.match(iosHost, /loadParams\.parameterValues\[endpointID\] = static_cast<float> \(\*valueProperty\);/);
    assert.ok(
        iosHost.indexOf("isCurrentCompleteSoundState (restoredState)")
            < iosHost.indexOf("lastLoadedStateHash != stateHash"),
    );
});

test("every non-host complete-sound transport hard-cuts to the Polish version", async () => {
    const [browserState, browserStateDeclaration, speedrun, envelope, shareLink, migrations] = await Promise.all([
        read("web/browser-patch-state.mjs"),
        read("web/browser-patch-state.d.mts"),
        read("ui/speedrun/patch-io.ts"),
        read("ui/shared/sound-share-envelope.ts"),
        read("ui/shared/sound-share-link.ts"),
        read("ui/shared/effects/synth-preset-migrations.ts"),
    ]);

    const runtimeVersion = browserState.match(/BROWSER_PATCH_STATE_VERSION = (\d+)/)?.[1];
    const declaredVersion = browserStateDeclaration.match(/readonly version: (\d+)/)?.[1];
    assert.equal(runtimeVersion, "5");
    assert.equal(declaredVersion, runtimeVersion);
    assert.match(speedrun, /BROWSER_PATCH_STATE_VERSION = 5/);
    assert.match(envelope, /SOUND_SHARE_ENVELOPE_VERSION = 2/);
    assert.match(shareLink, /SOUND_SHARE_FRAGMENT_VERSION = 2/);
    assert.match(migrations, /return \[\];/);
    assert.doesNotMatch(migrations, /fromHash|migrate:/);
});

test("the product UI exposes four compact Polish modules, independent bypasses, and an expansion handoff", async () => {
    const [workspace, subway, meter, modulationTargets] = await Promise.all([
        read("ui/desktop/effects-rack-workspace.tsx"),
        read("ui/desktop/subway-map-column.tsx"),
        read("ui/shared/effects/preset-bar.ts"),
        read("ui/shared/modulation-targets.ts"),
    ]);

    assert.match(workspace, /data-role="rack-polish-node"/);
    assert.match(workspace, /data-role="rack-graph-boundary"/);
    assert.match(workspace, /data-role="rack-fixed-footer"/);
    assert.match(workspace, /data-role="rack-lane-mix"/);
    assert.match(workspace, /data-role="rack-polish-boundary"/);
    assert.doesNotMatch(workspace, /tailPrefix/);
    assert.doesNotMatch(subway, /tailPrefix/);
    assert.match(subway, /rack-trunk-tail-fill[\s\S]*?\{trunkTail\}/);
    assert.ok(workspace.indexOf('data-role="rack-graph-boundary"')
        < workspace.indexOf('data-role="rack-fixed-footer"'));
    assert.ok(workspace.indexOf('data-role="rack-fixed-footer"')
        < workspace.indexOf('data-role="rack-lane-mix"'));
    assert.ok(workspace.indexOf('data-role="rack-lane-mix"')
        < workspace.indexOf('data-role="rack-polish-boundary"'));
    for (const [endpointID, symbol] of [
        ["polishEnhancerAmount", "POLISH_ENHANCER_AMOUNT_ENDPOINT_ID"],
        ["polishCompressionClipAmount", "POLISH_COMPRESSION_CLIP_AMOUNT_ENDPOINT_ID"],
        ["polishOutputTrimDb", "POLISH_OUTPUT_TRIM_DB_ENDPOINT_ID"],
        ["polishSafeBassAmount", "POLISH_SAFE_BASS_AMOUNT_ENDPOINT_ID"],
        ["polishSafeBassBypass", "POLISH_SAFE_BASS_BYPASS_ENDPOINT_ID"],
        ["polishEnhancerBypass", "POLISH_ENHANCER_BYPASS_ENDPOINT_ID"],
        ["polishCompressionClipBypass", "POLISH_COMPRESSION_CLIP_BYPASS_ENDPOINT_ID"],
        ["polishOutputTrimBypass", "POLISH_OUTPUT_TRIM_BYPASS_ENDPOINT_ID"],
    ]) {
        assert.match(workspace, new RegExp(symbol));
        assert.doesNotMatch(modulationTargets, new RegExp(endpointID));
    }
    assert.match(workspace, /data-role=\{`polish-module-/);
    assert.match(workspace, /surface === "compact" \? "polish-bypass"/);
    assert.match(workspace, /<PolishBypassControl[\s\S]*?surface="compact"/);
    assert.match(workspace, /data-role="polish-expand"/);
    assert.match(workspace, /polishEditorExpanded/);
    assert.match(workspace, /onPolishEditorExpandedChange/);
    const fixedNode = workspace.slice(
        workspace.indexOf('className={`rack-polish-node'),
        workspace.indexOf("</button>", workspace.indexOf('className={`rack-polish-node')),
    );
    assert.doesNotMatch(fixedNode, /draggable|onContextMenu|onPointerDown|bypass|power/i);

    assert.match(meter, /height: var\(--compact-shell-row, 40px\)/);
    assert.match(meter, /width: 92px/);
    assert.match(meter, /font-variant-numeric: tabular-nums/);
    assert.ok(meter.indexOf('data-el="shell-back"') < meter.indexOf('data-el="polish-meter"'));
    assert.ok(meter.indexOf('data-el="polish-meter"') < meter.indexOf('data-el="preset-name"'));
});

test("the factory inventory contains no old-format synth sound to retain", async () => {
    const descriptors = await read("ui/shared/effects/effect-preset-descriptors.ts");

    assert.doesNotMatch(descriptors, /cosimo-synth|wavetable-synth/);
    assert.match(descriptors, /EFFECT_FACTORY_PRESETS[\s\S]*?chorus:[\s\S]*?ott:/);
});

test("the retired memoryless RackOutputStage is absent from production", async () => {
    await assert.rejects(
        fs.stat(path.join(repoRoot, "cmajor/RackOutputStage.cmajor")),
        { code: "ENOENT" },
    );
    assert.doesNotMatch(await read("cmajor/EffectsRack.cmajor"), /RackOutputStage/);
});
