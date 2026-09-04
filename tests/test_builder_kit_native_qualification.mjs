import test from "node:test";
import assert from "node:assert/strict";

import {
    compiledTraceEvents,
    normalizeMachOForComparison,
    parseArguments,
    redactText,
    toolchainWithPublishedPins,
} from "./tools/qualify_builder_kit_native.mjs";

const sourceSha = "a".repeat(40);

test("native qualification requires an exact source and non-secret destination config", () => {
    assert.deepEqual(parseArguments([
        "--source-sha", sourceSha,
        "--destination-config", "/tmp/destination.json",
        "--report", "/tmp/report.json",
    ]), {
        destinationConfig: "/tmp/destination.json",
        report: "/tmp/report.json",
        sourceSha,
    });

    assert.throws(() => parseArguments(["--destination-config", "/tmp/destination.json"]), /--source-sha/u);
    assert.throws(() => parseArguments(["--source-sha", sourceSha]), /--destination-config/u);
    assert.throws(() => parseArguments([
        "--source-sha", sourceSha,
        "--destination-config", "relative.json",
    ]), /absolute/u);
});

test("native qualification diagnostics redact capability URLs and raw credentials", () => {
    const capability = "fixture-private-capability";
    const feedUrl = `https://feed.example.invalid/${capability}`;
    const output = redactText(
        `clone ${feedUrl}/cmajor.git failed for ${capability}`,
        [feedUrl, capability],
    );

    assert.equal(output.includes(capability), false);
    assert.equal(output.includes(feedUrl), false);
    assert.equal(output, "clone [REDACTED]/cmajor.git failed for [REDACTED]");
});

test("published tool pins compose only when release artifacts and Cmajor source agree", () => {
    const candidate = {
        cmaj: { artifact: "tools/v0.1.2/cmaj.tar.gz", forkCommit: "b".repeat(40), sha256: "" },
        cmajPlugin: { artifact: "tools/v0.1.2/plugin.zip", sha256: "" },
    };
    const manifest = {
        version: "0.1.2",
        cmajor: { commit: "b".repeat(40) },
        tools: {
            cmaj: { artifact: candidate.cmaj.artifact, forkCommit: candidate.cmaj.forkCommit, sha256: "1".repeat(64) },
            cmajPlugin: { artifact: candidate.cmajPlugin.artifact, sha256: "2".repeat(64) },
        },
    };

    const composed = toolchainWithPublishedPins(candidate, manifest, "0.1.2", candidate.cmaj.forkCommit);
    assert.equal(composed.cmaj.sha256, "1".repeat(64));
    assert.equal(composed.cmajPlugin.sha256, "2".repeat(64));
    assert.equal(candidate.cmaj.sha256, "", "candidate source object stays unchanged");

    assert.throws(
        () => toolchainWithPublishedPins(candidate, { ...manifest, version: "0.1.1" }, "0.1.2", candidate.cmaj.forkCommit),
        /version/u,
    );
    assert.throws(
        () => toolchainWithPublishedPins(candidate, {
            ...manifest,
            tools: { ...manifest.tools, cmaj: { ...manifest.tools.cmaj, artifact: "tools/other/cmaj.tar.gz" } },
        }, "0.1.2", candidate.cmaj.forkCommit),
        /artifact/u,
    );
    assert.throws(
        () => toolchainWithPublishedPins({
            ...candidate,
            cmaj: { ...candidate.cmaj, sha256: "9".repeat(64) },
        }, manifest, "0.1.2", candidate.cmaj.forkCommit),
        /Candidate.*sha256/u,
    );
    assert.throws(
        () => toolchainWithPublishedPins({
            ...candidate,
            cmaj: { ...candidate.cmaj, sha256: "malformed-nonempty-pin" },
        }, manifest, "0.1.2", candidate.cmaj.forkCommit),
        /Candidate.*sha256/u,
    );
    assert.throws(
        () => toolchainWithPublishedPins(candidate, manifest, "0.1.2", "c".repeat(40)),
        /Exported Cmajor source pin/u,
    );
});

test("native trace summary distinguishes compilation and linking from configure and signing", () => {
    const events = compiledTraceEvents([
        "-- Configuring done",
        "[ 12%] Building CXX object plugin/CMakeFiles/shared.dir/cmajor_plugin.cpp.o",
        "[ 88%] Linking CXX shared module CosimoEnhancerLite.vst3/Contents/MacOS/CosimoEnhancerLite",
        "Built target CosimoEnhancerLite_VST3",
    ].join("\n"));

    assert.deepEqual(events, {
        compile: ["[ 12%] Building CXX object plugin/CMakeFiles/shared.dir/cmajor_plugin.cpp.o"],
        link: ["[ 88%] Linking CXX shared module CosimoEnhancerLite.vst3/Contents/MacOS/CosimoEnhancerLite"],
    });
    assert.deepEqual(compiledTraceEvents("-- Configuring done\nBuilt target CosimoEnhancerLite_VST3"), {
        compile: [],
        link: [],
    });
});

function syntheticMachO({ uuidByte, signatureByte, codeByte }) {
    const headerSize = 32;
    const uuidCommandSize = 24;
    const signatureCommandSize = 16;
    const signatureOffset = 96;
    const signatureSize = 16;
    const bytes = Buffer.alloc(signatureOffset + signatureSize, 0);
    bytes.writeUInt32LE(0xfeedfacf, 0);
    bytes.writeUInt32LE(2, 16);
    bytes.writeUInt32LE(uuidCommandSize + signatureCommandSize, 20);
    bytes.writeUInt32LE(0x1b, headerSize);
    bytes.writeUInt32LE(uuidCommandSize, headerSize + 4);
    bytes.fill(uuidByte, headerSize + 8, headerSize + uuidCommandSize);
    const signatureCommand = headerSize + uuidCommandSize;
    bytes.writeUInt32LE(0x1d, signatureCommand);
    bytes.writeUInt32LE(signatureCommandSize, signatureCommand + 4);
    bytes.writeUInt32LE(signatureOffset, signatureCommand + 8);
    bytes.writeUInt32LE(signatureSize, signatureCommand + 12);
    bytes[80] = codeByte;
    bytes.fill(signatureByte, signatureOffset, signatureOffset + signatureSize);
    return bytes;
}

test("clean-build comparison excludes only Mach-O UUID and code-signature payload bytes", () => {
    const first = normalizeMachOForComparison(syntheticMachO({ uuidByte: 1, signatureByte: 2, codeByte: 3 }));
    const second = normalizeMachOForComparison(syntheticMachO({ uuidByte: 4, signatureByte: 5, codeByte: 3 }));
    const changedCode = normalizeMachOForComparison(syntheticMachO({ uuidByte: 4, signatureByte: 5, codeByte: 9 }));

    assert.deepEqual(first.normalizedFields, ["LC_UUID", "LC_CODE_SIGNATURE payload"]);
    assert.deepEqual(first.bytes, second.bytes);
    assert.notDeepEqual(first.bytes, changedCode.bytes);
});
