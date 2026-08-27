#!/usr/bin/env node
import { execFileSync } from "node:child_process";


const baseRef = process.argv[2];
if (!baseRef) {
    throw new Error("Usage: node scripts/check_t59_index_scope.mjs <base-ref>");
}

const protectedIndexSources = [
    "cmajor/FixedFrameOscillator.cmajor",
    "ui/shared/mobile-voice-editor.tsx",
    "ui/shared/mobile-voice-parameter-manifest.ts",
    "ui/shared/parameter-gesture.ts",
    "ui/shared/rolling-axis-classifier.ts",
    "ui/shared/synth-components.tsx",
    "ui/shared/synth-hooks.ts",
    "ui/shared/wavetable-display.ts",
    "ui/shared/wavetable-graph-axis-projection.ts",
    "ui/shared/wavetable-mip.ts",
];

function diffFor(paths) {
    return execFileSync(
        "git",
        ["diff", "--unified=0", baseRef, "--", ...paths],
        { encoding: "utf8" },
    );
}

const protectedDiff = diffFor(protectedIndexSources);
if (protectedDiff !== "") {
    throw new Error(`T59 changed protected Index-control or interpolation source:\n${protectedDiff}`);
}

const synthDiff = diffFor(["cmajor/WavetableSynth.cmajor"]);
const changedSynthLines = synthDiff
    .split("\n")
    .filter((line) => /^[+-]/u.test(line) && !/^(?:---|\+\+\+)/u.test(line));
const allowedSynthLine = (line) => (
    /std::intrinsics::clamp \(tableSelectIn, 0\.0f, (?:237|238)\.0f\) \+ 0\.5f/u.test(line)
    || /input value float32 osc[ABC]WavetableSelect \[\[/u.test(line)
);
const unexpectedSynthLines = changedSynthLines.filter((line) => !allowedSynthLine(line));

if (unexpectedSynthLines.length > 0) {
    throw new Error(
        `T59 changed WavetableSynth outside table-selection range/default declarations:\n${unexpectedSynthLines.join("\n")}`,
    );
}

console.log(`T59 Index scope is clean against ${baseRef}.`);
