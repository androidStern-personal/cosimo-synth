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

test("the production graph exposes only three Polish controls and ends rack to Polish to output", async () => {
    const source = await read("cmajor/WavetableSynth.cmajor");
    const publicControls = [
        "polishEnhancerAmount",
        "polishCompressionClipAmount",
        "polishOutputTrimDb",
    ];

    for (const endpointID of publicControls) {
        assert.match(source, new RegExp(`input value float32 ${endpointID} \\[\\[`));
        assert.match(source, new RegExp(`${endpointID} -> polish\\.`));
    }
    assert.match(source, /output event wt::PolishMeterFrame polishMeter;/);
    assert.match(source, /node polish = wt::PolishBus;/);
    assert.match(source, /rack\.out -> polish\.in;/);
    assert.match(source, /polish\.out -> audioOut;/);
    assert.match(source, /polish\.meterOut -> polishMeter;/);
    assert.match(source, /static_assert \(processor\.latency == wt::polishLatencyFrames/);
    assert.doesNotMatch(source, /RackOutputStage|outputStage/);

    const polishEndpointMentions = [...source.matchAll(/input value float32 (polish\w+)/g)]
        .map((match) => match[1]);
    assert.deepEqual(polishEndpointMentions, publicControls);
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

test("the retired memoryless RackOutputStage is absent from production", async () => {
    await assert.rejects(
        fs.stat(path.join(repoRoot, "cmajor/RackOutputStage.cmajor")),
        { code: "ENOENT" },
    );
    assert.doesNotMatch(await read("cmajor/EffectsRack.cmajor"), /RackOutputStage/);
});
