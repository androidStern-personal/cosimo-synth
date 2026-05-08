import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("FutureDaw note-meta bridge decodes SysEx, preserves ordering, and applies keyswitches", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "cosimo-note-meta-bridge-"));
    const sourcePath = path.join(tempDir, "bridge_test.cpp");
    const binaryPath = path.join(tempDir, "bridge_test");

    writeFileSync(sourcePath, String.raw`
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

#include "native/FutureDawNoteMetaBridge.h"

using namespace cosimo::future_daw;

void expect(bool condition, const std::string& message)
{
    if (!condition)
    {
        std::cerr << message << "\n";
        std::exit(1);
    }
}

std::vector<std::uint8_t> bytesFor(const NoteMeta& meta)
{
    const auto encoded = encodeNoteMetaMessage(meta);
    return {encoded.begin(), encoded.end()};
}

void expectShort(const BridgeOutputEvent& event, int sample, std::uint8_t status, std::uint8_t note, std::uint8_t velocity)
{
    expect(event.kind == BridgeOutputKind::shortMidi, "expected short MIDI output");
    expect(event.sampleOffset == sample, "short MIDI sample offset mismatch");
    expect(event.midi.size == 3, "short MIDI size mismatch");
    expect(event.midi.bytes[0] == status, "short MIDI status mismatch");
    expect(event.midi.bytes[1] == note, "short MIDI note mismatch");
    expect(event.midi.bytes[2] == velocity, "short MIDI velocity mismatch");
}

void expectMeta(const BridgeOutputEvent& event, int sample, int channel, int note, int selectorA, int selectorB, int duration, int age)
{
    expect(event.kind == BridgeOutputKind::noteMeta, "expected note-meta output");
    expect(event.sampleOffset == sample, "note-meta sample offset mismatch");
    expect(event.noteMeta.channel == channel, "note-meta channel mismatch");
    expect(event.noteMeta.cmajorChannel() == channel - 1, "Cmajor channel conversion mismatch");
    expect(event.noteMeta.noteNumber == note, "note-meta note mismatch");
    expect(event.noteMeta.selectorA == selectorA, "note-meta selectorA mismatch");
    expect(event.noteMeta.selectorB == selectorB, "note-meta selectorB mismatch");
    expect(event.noteMeta.durationSamples == duration, "note-meta duration mismatch");
    expect(event.noteMeta.ageSamples == age, "note-meta age mismatch");
}

ArticulationTriggerConfig identityChainConfig()
{
    ArticulationTriggerConfig config;
    config.activeMode = ArticulationTriggerMode::chain;

    for (int selector = 0; selector < 128; ++selector)
        config.chainSelectorToRuntimeSlot[static_cast<std::size_t>(selector)] = selector;

    return config;
}

int main()
{
    const NoteMeta valid {2, 60, 50, 60, 44100, 11025};
    const auto encoded = bytesFor(valid);
    const auto decoded = decodeNoteMetaMessage(encoded.data(), encoded.size());
    expect(decoded.has_value(), "valid FutureDaw note-meta SysEx must decode");
    expect(decoded->channel == 2
        && decoded->noteNumber == 60
        && decoded->selectorA == 50
        && decoded->selectorB == 60
        && decoded->durationSamples == 44100
        && decoded->ageSamples == 11025,
        "decoded FutureDaw note-meta fields mismatch");

    expect(!decodeNoteMetaMessage(encoded.data(), encoded.size() - 1).has_value(),
           "truncated note-meta SysEx must be rejected");

    auto wrongVendor = encoded;
    wrongVendor[1] = 0x7c;
    expect(!decodeNoteMetaMessage(wrongVendor.data(), wrongVendor.size()).has_value(),
           "wrong-vendor SysEx must be rejected");

    auto malformedPayload = encoded;
    malformedPayload[5] = 0x80;
    expect(!decodeNoteMetaMessage(malformedPayload.data(), malformedPayload.size()).has_value(),
           "non-7-bit payload bytes must be rejected");

    auto invalidDuration = bytesFor(NoteMeta {2, 60, 50, 60, 0, 0});
    expect(!decodeNoteMetaMessage(invalidDuration.data(), invalidDuration.size()).has_value(),
           "zero-duration note-meta SysEx must be rejected");

    auto invalidAge = bytesFor(NoteMeta {2, 60, 50, 60, 1024, 1024});
    expect(!decodeNoteMetaMessage(invalidAge.data(), invalidAge.size()).has_value(),
           "age equal to duration must be rejected");

    NoteMetaBridge bridge(identityChainConfig());
    std::vector<BridgeOutputEvent> output;
    const std::array<std::uint8_t, 3> channel2NoteOn {0x91, 60, 100};
    bridge.processMidiEvent(64, encoded.data(), encoded.size(), output);
    bridge.processMidiEvent(64, channel2NoteOn.data(), channel2NoteOn.size(), output);
    expect(output.size() == 2, "matching SysEx + note-on must emit meta plus the original note-on");
    expectMeta(output[0], 64, 2, 60, 50, 60, 44100, 11025);
    expectShort(output[1], 64, 0x91, 60, 100);
    expect(output[0].sequence < output[1].sequence, "note-meta output must remain before its note-on");

    bridge.reset();
    output.clear();
    const std::array<std::uint8_t, 3> expression {0xb1, 74, 80};
    bridge.processMidiEvent(12, expression.data(), expression.size(), output);
    bridge.processMidiEvent(12, encoded.data(), encoded.size(), output);
    bridge.processMidiEvent(12, channel2NoteOn.data(), channel2NoteOn.size(), output);
    expect(output.size() == 3, "same-sample expression + SysEx + note-on must keep expression and note outputs");
    expectShort(output[0], 12, 0xb1, 74, 80);
    expectMeta(output[1], 12, 2, 60, 50, 60, 44100, 11025);
    expectShort(output[2], 12, 0x91, 60, 100);

    bridge.reset();
    output.clear();
    const auto metaA = bytesFor(NoteMeta {1, 61, 11, 0, 1000, 0});
    const auto metaB = bytesFor(NoteMeta {2, 62, 12, 0, 2000, 20});
    const std::array<std::uint8_t, 3> noteA {0x90, 61, 101};
    const std::array<std::uint8_t, 3> noteB {0x91, 62, 102};
    bridge.processMidiEvent(32, metaA.data(), metaA.size(), output);
    bridge.processMidiEvent(32, noteA.data(), noteA.size(), output);
    bridge.processMidiEvent(32, metaB.data(), metaB.size(), output);
    bridge.processMidiEvent(32, noteB.data(), noteB.size(), output);
    expect(output.size() == 4, "two same-sample SysEx/note pairs must both survive");
    expectMeta(output[0], 32, 1, 61, 11, 0, 1000, 0);
    expectShort(output[1], 32, 0x90, 61, 101);
    expectMeta(output[2], 32, 2, 62, 12, 0, 2000, 20);
    expectShort(output[3], 32, 0x91, 62, 102);

    bridge.reset();
    output.clear();
    const auto wrongNoteMeta = bytesFor(NoteMeta {2, 61, 50, 60, 44100, 11025});
    bridge.processMidiEvent(4, wrongNoteMeta.data(), wrongNoteMeta.size(), output);
    bridge.processMidiEvent(4, channel2NoteOn.data(), channel2NoteOn.size(), output);
    expect(output.size() == 1, "wrong-note SysEx must not attach to the following note");
    expectShort(output[0], 4, 0x91, 60, 100);

    bridge.reset();
    output.clear();
    bridge.processMidiEvent(4, encoded.data(), encoded.size(), output);
    bridge.processMidiEvent(5, channel2NoteOn.data(), channel2NoteOn.size(), output);
    expect(output.size() == 1, "SysEx must not attach to a later-sample note-on");
    expectShort(output[0], 5, 0x91, 60, 100);

    bridge.reset();
    output.clear();
    bridge.processMidiEvent(4, encoded.data(), encoded.size(), output);
    bridge.finishBlock();
    bridge.processMidiEvent(4, channel2NoteOn.data(), channel2NoteOn.size(), output);
    expect(output.size() == 1, "unmatched SysEx must be cleared at the block boundary");
    expectShort(output[0], 4, 0x91, 60, 100);

    ArticulationTriggerConfig keyConfig;
    keyConfig.activeMode = ArticulationTriggerMode::key;
    keyConfig.keyNoteToRuntimeSlot[2] = 22;
    NoteMetaBridge keyswitchBridge(keyConfig);
    output.clear();
    const std::array<std::uint8_t, 3> keyswitchOn {0x90, 2, 127};
    const std::array<std::uint8_t, 3> keyswitchOff {0x80, 2, 0};
    const std::array<std::uint8_t, 3> musicalNote {0x90, 64, 90};
    keyswitchBridge.processMidiEvent(0, keyswitchOn.data(), keyswitchOn.size(), output);
    keyswitchBridge.processMidiEvent(8, keyswitchOff.data(), keyswitchOff.size(), output);
    keyswitchBridge.processMidiEvent(16, musicalNote.data(), musicalNote.size(), output);
    expect(output.size() == 2, "keyswitch note-on/off must be swallowed and the musical note must be articulated");
    expectMeta(output[0], 16, 1, 64, 22, 0, 0, 0);
    expectShort(output[1], 16, 0x90, 64, 90);

    output.clear();
    const auto directOverride = bytesFor(NoteMeta {1, 65, 7, 3, 3000, 4});
    const std::array<std::uint8_t, 3> overrideNote {0x90, 65, 91};
    keyswitchBridge.processMidiEvent(24, directOverride.data(), directOverride.size(), output);
    keyswitchBridge.processMidiEvent(24, overrideNote.data(), overrideNote.size(), output);
    expect(output.size() == 2, "inactive Chain SysEx must be swallowed without overriding active Key mode");
    expectMeta(output[0], 24, 1, 65, 22, 0, 0, 0);
    expectShort(output[1], 24, 0x90, 65, 91);

    ArticulationTriggerConfig translatedChainConfig;
    translatedChainConfig.activeMode = ArticulationTriggerMode::chain;
    translatedChainConfig.chainSelectorToRuntimeSlot[50] = 9;
    NoteMetaBridge translatedChainBridge(translatedChainConfig);
    output.clear();
    translatedChainBridge.processMidiEvent(30, encoded.data(), encoded.size(), output);
    translatedChainBridge.processMidiEvent(30, channel2NoteOn.data(), channel2NoteOn.size(), output);
    expect(output.size() == 2, "active Chain mode must translate selectorA before sending note meta");
    expectMeta(output[0], 30, 2, 60, 9, 60, 44100, 11025);
    expectShort(output[1], 30, 0x91, 60, 100);

    translatedChainConfig.chainSelectorToRuntimeSlot[50] = selectorUnset;
    translatedChainBridge.setTriggerConfig(translatedChainConfig);
    output.clear();
    translatedChainBridge.processMidiEvent(31, encoded.data(), encoded.size(), output);
    translatedChainBridge.processMidiEvent(31, channel2NoteOn.data(), channel2NoteOn.size(), output);
    expect(output.size() == 1, "unmapped Chain selectorA must leave the note unarticulated");
    expectShort(output[0], 31, 0x91, 60, 100);

    ArticulationTriggerConfig velocityConfig;
    velocityConfig.activeMode = ArticulationTriggerMode::velocity;
    velocityConfig.velocityToRuntimeSlot[90] = 44;
    NoteMetaBridge velocityBridge(velocityConfig);
    output.clear();
    velocityBridge.processMidiEvent(40, musicalNote.data(), musicalNote.size(), output);
    expect(output.size() == 2, "active Vel mode must attach articulation from note-on velocity");
    expectMeta(output[0], 40, 1, 64, 44, 0, 0, 0);
    expectShort(output[1], 40, 0x90, 64, 90);

    return 0;
}
`, "utf8");

    execFileSync("c++", ["-std=c++17", "-I", repoRoot, sourcePath, "-o", binaryPath], {
        cwd: repoRoot,
        stdio: "pipe",
    });
    execFileSync(binaryPath, [], {
        cwd: repoRoot,
        stdio: "pipe",
    });

    assert.ok(true);
});
