import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
test("native articulation state handler changes real MIDI selection and rejects unrelated or malformed effects", async () => {
    const source = process.env.COSIMO_CMAJOR_SOURCE;
    assert.ok(source, "Set the qualified isolated Cmajor source explicitly");
    const build = path.join(root, "build/native_articulation_state_effect");
    await mkdir(build, { recursive: true });
    const input = path.join(build, "probe.cpp");
    const binary = path.join(build, "probe");
    await writeFile(input, String.raw`
#include "native/ArticulationStateEffect.h"
#include <iostream>
#include <stdexcept>
#include <vector>
using namespace cosimo::future_daw;
void require(bool condition, const char* message) { if (!condition) throw std::runtime_error(message); }
int main() {
    try {
        NoteMetaBridge midi;
        auto handle = createArticulationStateEffectHandler([&](ArticulationTriggerConfig config) { midi.setTriggerConfig(config); });
        const auto good = choc::value::Value(R"({"activeMode":"key","key":[-1,-1,5],"chain":[],"velocity":[]})");
        require(handle("cosimo.articulation-trigger-config", good), "named state effect was refused");
        const unsigned char key[] = {0x90, 2, 100};
        const unsigned char note[] = {0x90, 64, 90};
        std::vector<BridgeOutputEvent> output;
        midi.processMidiEvent(0, key, 3, output);
        require(output.empty(), "configured keyswitch was not swallowed");
        midi.processMidiEvent(16, note, 3, output);
        require(output.size() == 2 && output[0].kind == BridgeOutputKind::noteMeta
            && output[0].noteMeta.selectorA == 5 && output[0].sampleOffset == 16
            && output[1].kind == BridgeOutputKind::shortMidi && output[1].midi.bytes[1] == 64,
            "actual note metadata did not select the configured articulation");
        for (const auto& invalid : { choc::value::Value("{broken"), choc::value::Value("[]"), choc::value::Value(1) })
            require(!handle("cosimo.articulation-trigger-config", invalid), "malformed effect was accepted");
        require(!handle("another-effect", good), "handler consumed someone else's effect");
        output.clear();
        midi.processMidiEvent(32, note, 3, output);
        require(output.size() == 2 && output[0].noteMeta.selectorA == 5,
            "a refused effect replaced the existing native configuration");
        int identity = 0;
        auto broken = createArticulationStateEffectHandler([&](ArticulationTriggerConfig) { throw &identity; });
        bool retained = false;
        try { broken("cosimo.articulation-trigger-config", good); } catch (int* error) { retained = error == &identity; }
        require(retained, "unexpected native sink failure was hidden or reported as success");
        std::cout << "PASS: native effect selects actual MIDI articulation and preserves state on refusal\n";
    } catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
`);
    const compiled = spawnSync("/usr/bin/c++", ["-std=c++17", "-O1", "-I", root, "-I", path.join(source, "include/choc"), input, "-o", binary], { encoding: "utf8", timeout: 30000 });
    assert.equal(compiled.status, 0, compiled.error?.message ?? compiled.stderr);
    const run = spawnSync(binary, [], { encoding: "utf8", timeout: 5000 });
    assert.equal(run.status, 0, run.error?.message ?? run.stdout + run.stderr);
    assert.match(run.stdout, /^PASS: native effect/);
});
