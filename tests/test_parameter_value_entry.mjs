import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const modulesPromise = Promise.all([
    loadUIModule(repoRoot, "ui/shared/parameter-value-entry.ts"),
    loadUIModule(repoRoot, "ui/shared/rack-parameter-descriptors.ts"),
]);

test("rack Cutoff treats 12khz and 12k as 12 kHz", async () => {
    const [entries, rackDescriptors] = await modulesPromise;
    const descriptor = rackDescriptors.getRackParameterDescriptor("globalFilterCutoff");
    assert.ok(descriptor);
    const spec = entries.parameterEntrySpecForRackParameter(descriptor, descriptor.initial);

    for (const text of ["12khz", "12k"]) {
        const result = entries.parseParameterEntry(spec, text);
        assert.equal(result._tag, "accepted");
        assert.equal(result.commit._tag, "value");
        assert.equal(result.commit.value, 12_000);
        assert.equal(result.echo.draft, "12000");
        assert.equal(result.echo.unit, "Hz");
    }
});

test("Cutoff percent is logarithmic, so 50% is approximately 632 Hz", async () => {
    const [entries, rackDescriptors] = await modulesPromise;
    const descriptor = rackDescriptors.getRackParameterDescriptor("globalFilterCutoff");
    assert.ok(descriptor);
    const spec = entries.parameterEntrySpecForRackParameter(descriptor, descriptor.initial);

    const result = entries.parseParameterEntry(spec, "50%");
    assert.equal(result._tag, "accepted");
    assert.equal(result.commit._tag, "value");
    assert.ok(Math.abs(result.commit.value - 632.4555) < 0.01);
});

test("Cutoff amount rejects semitones instead of ignoring the incompatible unit", async () => {
    const [entries] = await modulesPromise;
    const spec = entries.parameterEntrySpecForModulationAmount("filterCutoffOctaves", 1_000);

    const result = entries.parseParameterEntry(spec, "12 st");
    assert.equal(result._tag, "rejected");
    assert.match(result.message, /st/i);
    assert.match(result.message, /oct/i);
});

test("Cutoff amount percentage means signed depth, so +100% is +6 octaves", async () => {
    const [entries] = await modulesPromise;
    const spec = entries.parameterEntrySpecForModulationAmount("filterCutoffOctaves", 1_000);

    const positive = entries.parseParameterEntry(spec, "+100%");
    assert.equal(positive._tag, "accepted");
    assert.equal(positive.commit.value, 6);

    const negative = entries.parseParameterEntry(spec, "-50%");
    assert.equal(negative._tag, "accepted");
    assert.equal(negative.commit.value, -3);
});

test("signed Cutoff Hz amounts resolve relative to the current base and persist octaves", async () => {
    const [entries] = await modulesPromise;
    const spec = entries.parameterEntrySpecForModulationAmount("filterCutoffOctaves", 1_000);

    const up = entries.parseParameterEntry(spec, "+1000 Hz");
    assert.equal(up._tag, "accepted");
    assert.equal(up.commit.value, 1);

    const down = entries.parseParameterEntry(spec, "-500Hz");
    assert.equal(down._tag, "accepted");
    assert.equal(down.commit.value, -1);
});

test("envelope bare numbers use the displayed unit without the hidden 10 ms threshold", async () => {
    const [entries] = await modulesPromise;
    const millisecondSpec = entries.parameterEntrySpecForSeconds({
        minSeconds: 0.001,
        maxSeconds: 10,
        stepSeconds: 0.001,
        currentSeconds: 0.005,
    });
    const secondSpec = entries.parameterEntrySpecForSeconds({
        minSeconds: 0.001,
        maxSeconds: 10,
        stepSeconds: 0.001,
        currentSeconds: 1.5,
    });

    const fiveMilliseconds = entries.parseParameterEntry(millisecondSpec, "5");
    assert.equal(fiveMilliseconds._tag, "accepted");
    assert.equal(fiveMilliseconds.commit.value, 0.005);
    assert.equal(fiveMilliseconds.echo.unit, "ms");

    const fifteenMilliseconds = entries.parseParameterEntry(millisecondSpec, "15");
    assert.equal(fifteenMilliseconds._tag, "accepted");
    assert.equal(fifteenMilliseconds.commit.value, 0.015);

    const fiveSeconds = entries.parseParameterEntry(secondSpec, "5");
    assert.equal(fiveSeconds._tag, "accepted");
    assert.equal(fiveSeconds.commit.value, 5);
    assert.equal(fiveSeconds.echo.unit, "s");
});

test("millisecond-backed exact entry accepts seconds while preserving millisecond storage", async () => {
    const [entries] = await modulesPromise;
    const spec = entries.parameterEntrySpecForMilliseconds({
        minMilliseconds: 20,
        maxMilliseconds: 8_000,
        stepMilliseconds: 1,
        currentMilliseconds: 500,
    });

    const seconds = entries.parseParameterEntry(spec, "2 s");
    assert.equal(seconds._tag, "accepted");
    assert.equal(seconds.commit.value, 2_000);
    assert.equal(seconds.echo.display, "2000 ms");

    const milliseconds = entries.parseParameterEntry(spec, "750");
    assert.equal(milliseconds._tag, "accepted");
    assert.equal(milliseconds.commit.value, 750);
    assert.equal(milliseconds.echo.unit, "ms");
});

test("exact entry tolerates surrounding whitespace, unit spacing, and thousands commas", async () => {
    const [entries, rackDescriptors] = await modulesPromise;
    const descriptor = rackDescriptors.getRackParameterDescriptor("globalFilterCutoff");
    assert.ok(descriptor);
    const spec = entries.parameterEntrySpecForRackParameter(descriptor, descriptor.initial);

    const result = entries.parseParameterEntry(spec, "  12,000   Hz  ");
    assert.equal(result._tag, "accepted");
    assert.equal(result.commit.value, 12_000);
});

test("valid out-of-range input clamps and echoes the applied value", async () => {
    const [entries, rackDescriptors] = await modulesPromise;
    const descriptor = rackDescriptors.getRackParameterDescriptor("globalFilterCutoff");
    assert.ok(descriptor);
    const spec = entries.parameterEntrySpecForRackParameter(descriptor, descriptor.initial);

    const result = entries.parseParameterEntry(spec, "40 kHz");
    assert.equal(result._tag, "accepted");
    assert.equal(result.commit.value, 20_000);
    assert.equal(result.echo.draft, "20000");
    assert.equal(result.echo.display, "20.0 kHz");
});

test("Pan accepts unambiguous L and R suffixes", async () => {
    const [entries] = await modulesPromise;
    const spec = entries.parameterEntrySpecForMobileVoiceControl("pan");

    const left = entries.parseParameterEntry(spec, "40 L");
    assert.equal(left._tag, "accepted");
    assert.equal(left.commit.value, -0.4);

    const right = entries.parseParameterEntry(spec, "40r");
    assert.equal(right._tag, "accepted");
    assert.equal(right.commit.value, 0.4);

    const centerDisplay = entries.formatParameterEntry(spec, 0).display;
    const center = entries.parseParameterEntry(spec, centerDisplay);
    assert.equal(center._tag, "accepted");
    assert.equal(center.commit.value, 0);
});

test("Unison Voices garbage is rejected so NaN cannot become a commit", async () => {
    const [entries] = await modulesPromise;
    const spec = entries.parameterEntrySpecForMobileVoiceControl("unisonVoices");

    const garbage = entries.parseParameterEntry(spec, "many");
    assert.equal(garbage._tag, "rejected");

    const clamped = entries.parseParameterEntry(spec, "99 voices");
    assert.equal(clamped._tag, "accepted");
    assert.equal(clamped.commit.value, 8);
    assert.equal(clamped.echo.draft, "8");
});

test("Unison Detune base entry stays in cents while its stored value stays normalized", async () => {
    const [entries] = await modulesPromise;
    const spec = entries.parameterEntrySpecForMobileVoiceControl("unisonDetune");

    const result = entries.parseParameterEntry(spec, "25 ct");
    assert.equal(result._tag, "accepted");
    assert.equal(result.commit.value, 0.5);
    assert.deepEqual(entries.formatParameterEntry(spec, result.commit.value), {
        display: "25 ct",
        draft: "25",
        unit: "ct",
    });
});

test("normalized percentage controls round-trip through their displayed percent unit", async () => {
    const [entries] = await modulesPromise;
    const spec = entries.parameterEntrySpecForMobileVoiceControl("unisonBlend");

    const result = entries.parseParameterEntry(spec, "37.5%");
    assert.equal(result._tag, "accepted");
    assert.equal(result.commit.value, 0.375);
    assert.deepEqual(entries.formatParameterEntry(spec, result.commit.value), {
        display: "37.5%",
        draft: "37.5",
        unit: "%",
    });
});

test("scalar exact entry supports BPM and unitless step values without display artifacts", async () => {
    const [entries] = await modulesPromise;
    const bpmSpec = entries.parameterEntrySpecForScalar({ min: 20, max: 300, step: 0.1, unit: "BPM", digits: 1 });
    const stepSpec = entries.parameterEntrySpecForScalar({ min: 1, max: 32, step: 1, unit: "", digits: 0 });

    const bpm = entries.parseParameterEntry(bpmSpec, "134.5 bpm");
    assert.equal(bpm._tag, "accepted");
    assert.equal(bpm.commit.value, 134.5);
    assert.deepEqual(entries.formatParameterEntry(bpmSpec, 134.5), {
        display: "134.5 BPM",
        draft: "134.5",
        unit: "BPM",
    });

    const step = entries.parseParameterEntry(stepSpec, "17");
    assert.equal(step._tag, "accepted");
    assert.equal(step.commit.value, 17);
    assert.deepEqual(entries.formatParameterEntry(stepSpec, 17), {
        display: "17",
        draft: "17",
        unit: "",
    });
    const incompatibleStep = entries.parseParameterEntry(stepSpec, "17 bpm");
    assert.equal(incompatibleStep._tag, "rejected");
    assert.match(incompatibleStep.message, /unitless/i);
});

test("rack base families round-trip through descriptor-owned units", async () => {
    const [entries, rackDescriptors] = await modulesPromise;
    const cases = [
        ["distortionDriveDb", 12.5, "12.5 dB", "dB"],
        ["phaserPhase", -90, "-90 deg", "°"],
        ["chorusRingFrequencyHz", 440, "440 Hz", "Hz"],
        ["chorusMix", 0.375, "37.5%", "%"],
        ["ottMix", 37.5, "37.5 %", "%"],
    ];

    for (const [endpointID, expectedValue, input, expectedUnit] of cases) {
        const descriptor = rackDescriptors.getRackParameterDescriptor(endpointID);
        assert.ok(descriptor, endpointID);
        const spec = entries.parameterEntrySpecForRackParameter(descriptor, descriptor.initial);
        const result = entries.parseParameterEntry(spec, input);
        assert.equal(result._tag, "accepted", endpointID);
        assert.equal(result.commit.value, expectedValue, endpointID);
        assert.equal(result.echo.unit, expectedUnit, endpointID);

        const roundTrip = entries.parseParameterEntry(spec, result.echo.display);
        assert.equal(roundTrip._tag, "accepted", `${endpointID} display round-trip`);
        assert.equal(roundTrip.commit.value, expectedValue, `${endpointID} display round-trip`);
    }
});

test("rack Delay bare time follows its displayed ms unit and explicit seconds override it", async () => {
    const [entries, rackDescriptors] = await modulesPromise;
    const descriptor = rackDescriptors.getRackParameterDescriptor("delayTime");
    assert.ok(descriptor);
    const spec = entries.parameterEntrySpecForRackParameter(descriptor, 375);

    const bare = entries.parseParameterEntry(spec, "250");
    assert.equal(bare._tag, "accepted");
    assert.equal(bare.commit.value, 250);
    assert.equal(bare.commit.mode, "free");
    assert.equal(bare.echo.unit, "ms");

    const seconds = entries.parseParameterEntry(spec, "2 s");
    assert.equal(seconds._tag, "accepted");
    assert.equal(seconds.commit.value, 2_000);
    assert.equal(seconds.commit.mode, "free");
});

test("Free and Sync rack entry matches each descriptor's dotted and triplet division table", async () => {
    const [entries, rackDescriptors] = await modulesPromise;
    const delay = rackDescriptors.getRackParameterDescriptor("delayTime");
    const phaser = rackDescriptors.getRackParameterDescriptor("phaserRate");
    assert.ok(delay);
    assert.ok(phaser);

    const delayResult = entries.parseParameterEntry(
        entries.parameterEntrySpecForRackParameter(delay, 375),
        "1/8",
    );
    assert.equal(delayResult._tag, "accepted");
    assert.deepEqual(delayResult.commit, {
        _tag: "tempoDivision",
        mode: "sync",
        divisionValue: 8,
        divisionLabel: "1/8",
    });
    assert.deepEqual(delayResult.echo, { display: "1/8 Sync", draft: "1/8", unit: "Sync" });

    for (const division of ["1/4T", "1/2."]) {
        const result = entries.parseParameterEntry(
            entries.parameterEntrySpecForRackParameter(phaser, 0.3),
            division,
        );
        assert.equal(result._tag, "accepted", division);
        assert.equal(result.commit._tag, "tempoDivision", division);
        assert.equal(result.commit.divisionLabel, division, division);
    }

    const unsupported = entries.parseParameterEntry(
        entries.parameterEntrySpecForRackParameter(delay, 375),
        "4/1",
    );
    assert.equal(unsupported._tag, "rejected");
    assert.match(unsupported.message, /division/i);
});

test("modulation amount families use each target's canonical unit and depth percentage", async () => {
    const [entries] = await modulesPromise;
    const cases = [
        ["oscA.pitchSemitones", 0, "24 st", 24, "st"],
        ["oscA.pitchSemitones", 0, "+50%", 24, "st"],
        ["oscA.ampGainDb", 0, "-6 dB", -6, "dB"],
        ["filterQ", 0.707, "2 Q", 2, "Q"],
        ["mseg1Rate", 1, "250 ms", 0.25, "s"],
        ["oscA.unisonBlend", 0.75, "50%", 0.5, "%"],
        ["lane.chorus#1.chorusMix", 0.5, "25%", 0.25, "%"],
        ["lane.ott#1.ottMix", 50, "25%", 25, "%"],
    ];

    for (const [targetKind, baseValue, input, expectedValue, expectedUnit] of cases) {
        const spec = entries.parameterEntrySpecForModulationAmount(targetKind, baseValue);
        const result = entries.parseParameterEntry(spec, input);
        assert.equal(result._tag, "accepted", targetKind);
        assert.equal(result.commit.value, expectedValue, targetKind);
        assert.equal(result.echo.unit, expectedUnit, targetKind);
    }
});

test("logarithmic rack amounts accept signed physical movement relative to the base", async () => {
    const [entries] = await modulesPromise;
    const delaySpec = entries.parameterEntrySpecForModulationAmount("lane.delay#1.delayTime", 250);
    const delay = entries.parseParameterEntry(delaySpec, "+250 ms");
    assert.equal(delay._tag, "accepted");
    assert.equal(delay.commit.value, 1);

    const filterSpec = entries.parameterEntrySpecForModulationAmount("lane.delay#1.delayFilter", 1_000);
    const filter = entries.parseParameterEntry(filterSpec, "+1 kHz");
    assert.equal(filter._tag, "accepted");
    assert.equal(filter.commit.value, 1);
});
