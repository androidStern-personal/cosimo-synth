#!/usr/bin/env node

import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
    MODULATION_SOURCE_OPTIONS,
    MODULATION_TARGET_OPTIONS,
    createDefaultModulationState,
    isRackModulationTarget,
    parseModulationState,
    serializeModulationState,
} from "../patch_gui/modulation.js";
import { compileModulationRuntimeProgram } from "../patch_gui/modulation-runtime-program.js";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const neutralAmountUnit = 1 / 64;
const expressionMidiValue = 100;
const ampEnvelopeSustain = 1;
const ampEnvelopeRouteValue = 1;

function runtimeVoiceRouteContribution(sourceValue, amount, polarity) {
    const source = Math.fround(Math.max(0, Math.min(1, sourceValue)));
    const amount32 = Math.fround(amount);
    const scale = polarity === "bipolar" ? Math.fround(amount32 * 2) : amount32;
    const bias = polarity === "bipolar" ? Math.fround(-amount32) : 0;
    return Math.fround(Math.fround(scale * source) + bias);
}

function runtimePolarityValue(sourceValue, polarity) {
    const source = Math.fround(Math.max(0, Math.min(1, sourceValue)));
    return polarity === "bipolar"
        ? Math.fround(Math.fround(source * 2) - 1)
        : source;
}

function runtimeRackReducedSource(sourceValue, polarity) {
    const source = Math.fround(Math.max(0, Math.min(1, sourceValue)));
    if (polarity !== "bipolar") return source;

    let sourceSum = Math.fround(0);
    for (let voiceIndex = 0; voiceIndex < 16; voiceIndex += 1) {
        sourceSum = Math.fround(sourceSum + source);
    }
    const mean = Math.fround(sourceSum * Math.fround(1 / 16));
    return runtimePolarityValue(mean, polarity);
}

function runtimeRackRouteContribution(sourceValue, amount, polarity) {
    const reducedSource = runtimeRackReducedSource(sourceValue, polarity);
    const gatedSource = Math.fround(reducedSource * Math.fround(1));
    return Math.fround(gatedSource * Math.fround(amount));
}

function exactOpposingFloat32Amount(
    sourceValue,
    referenceContribution,
    polarity,
    routeContribution,
) {
    const unitContribution = routeContribution(sourceValue, Math.fround(1), polarity);
    const candidate = Math.fround(-referenceContribution / unitContribution);
    if (!(candidate > 0) || !Number.isFinite(candidate)) {
        throw new Error(`Cannot calibrate ${polarity} neutral benchmark amount`);
    }
    const candidateContribution = routeContribution(sourceValue, candidate, polarity);
    if (Math.fround(referenceContribution + candidateContribution) !== 0) {
        throw new Error(`No exact float32 ${polarity} Amp Envelope compensation amount was found`);
    }
    return candidate;
}

function readOutputPath(argv) {
    const outputIndex = argv.indexOf("--output");
    if (outputIndex < 0 || typeof argv[outputIndex + 1] !== "string") {
        throw new Error("Usage: generate_modulation_benchmark_profiles.mjs --output <path>");
    }
    return path.resolve(argv[outputIndex + 1]);
}

function zeroMsegShape(shape) {
    return {
        ...shape,
        points: shape.points.map((point) => ({ ...point, y: 0 })),
    };
}

function createNeutralState(routes) {
    const state = createDefaultModulationState();
    return {
        ...state,
        msegSlots: state.msegSlots.map((slot) => ({
            ...slot,
            shapeA: zeroMsegShape(slot.shapeA),
            shapeB: zeroMsegShape(slot.shapeB),
        })),
        routes,
    };
}

function stripBenchmarkMetadata(route) {
    const {
        benchmarkPath: _benchmarkPath,
        neutralGroup: _neutralGroup,
        ...persistedRoute
    } = route;
    return persistedRoute;
}

function runtimeExecutionFingerprint(program) {
    const lane = (prefix, count, { reducer = false } = {}) => Array.from(
        { length: count },
        (_, index) => {
            const cell = program[`${prefix}Cells`][index];
            return [
                cell,
                program[`${prefix}Sources`][index],
                program[`${prefix}Targets`][index],
                program[`${prefix}Polarities`][index],
                ...(reducer ? [program[`${prefix}Reducers`][index]] : []),
                program[`${prefix}Amounts`][cell],
            ];
        },
    );
    const executionProgram = {
        voice: lane("voiceRoute", program.voiceRouteCount),
        macroVoice: lane("macroVoiceRoute", program.macroVoiceRouteCount),
        voiceRack: lane("voiceRackRoute", program.voiceRackRouteCount, { reducer: true }),
        macroRack: lane("macroRackRoute", program.macroRackRouteCount),
    };
    return createHash("sha256").update(JSON.stringify(executionProgram)).digest("hex");
}

function buildNeutralRouteGroups() {
    const voiceSources = MODULATION_SOURCE_OPTIONS.filter((source) => source.sourceKind !== "macro");
    const macroSources = MODULATION_SOURCE_OPTIONS.filter((source) => source.sourceKind === "macro");
    const voiceTargets = MODULATION_TARGET_OPTIONS.filter((target) => !isRackModulationTarget(target.value));
    const rackTargets = MODULATION_TARGET_OPTIONS.filter((target) => isRackModulationTarget(target.value));
    if (voiceSources.length !== 10 || macroSources.length !== 4) {
        throw new Error("Neutral benchmark source groups no longer cover the production source catalog");
    }

    // MSEGs and ordinary envelopes are exact zero. The production route path
    // clamps the legacy full-sustain Amp Envelope source to exactly 1, while
    // MIDI 100 velocity remains a float32 fraction. Calibrate their amounts
    // through the same direct-voice and reduced-rack float32 operations as
    // Cmajor instead of deriving them in JS double. Pressure and slide receive
    // the same expression byte, and macros share one value.
    const expressionValue = Math.fround(expressionMidiValue / 127);
    const ampEnvelopeValue = Math.fround(ampEnvelopeRouteValue);
    const velocityAmount = Math.fround(-neutralAmountUnit);
    const buildAmpVelocityAmounts = (routeContribution) => Object.fromEntries(
        ["unipolar", "bipolar"].map((polarity) => {
            const velocityContribution = routeContribution(expressionValue, velocityAmount, polarity);
            return [polarity, [
                exactOpposingFloat32Amount(
                    ampEnvelopeValue,
                    velocityContribution,
                    polarity,
                    routeContribution,
                ),
                velocityAmount,
            ]];
        }),
    );
    const ampVelocityAmounts = {
        voice: buildAmpVelocityAmounts(runtimeVoiceRouteContribution),
        voiceRack: buildAmpVelocityAmounts(runtimeRackRouteContribution),
    };
    const voiceGroups = [
        { sources: [voiceSources[0], voiceSources[1]], weights: [1, -1] },
        { sources: [voiceSources[2], voiceSources[3]], weights: [1, -1] },
        { sources: [voiceSources[4], voiceSources[5]], weights: [1, -1] },
        {
            sources: [voiceSources[6], voiceSources[7]],
            amountsForPathAndPolarity: ampVelocityAmounts,
        },
        { sources: [voiceSources[8], voiceSources[9]], weights: [1, -1] },
    ];
    const macroGroups = [
        { sources: [macroSources[0], macroSources[1]], weights: [1, -1] },
        { sources: [macroSources[2], macroSources[3]], weights: [1, -1] },
    ];
    const pathSpecs = [
        { name: "voice", sources: voiceGroups, targets: voiceTargets },
        { name: "macroVoice", sources: macroGroups, targets: voiceTargets },
        { name: "voiceRack", sources: voiceGroups, targets: rackTargets },
        { name: "macroRack", sources: macroGroups, targets: rackTargets },
    ];
    const groupsByPath = new Map();
    const allRoutes = [];

    for (const { name, sources: sourceGroups, targets } of pathSpecs) {
        const targetGroups = targets.map((target, targetIndex) => sourceGroups.map((group, groupIndex) => {
            const polarity = targetIndex % 2 === 0 ? "unipolar" : "bipolar";
            const reducer = targetIndex % 2 === 0 ? "max" : "mean";
            const amounts = group.amountsForPathAndPolarity?.[name]?.[polarity]
                ?? group.amountsForPolarity?.[polarity]
                ?? group.amounts;
            const weights = group.weightsForPolarity?.[polarity] ?? group.weights;
            const routes = group.sources.map((source, sourceIndex) => ({
                id: `benchmark-${name}-${source.value}-${target.value}`,
                enabled: true,
                sourceKind: source.sourceKind,
                sourceSlot: source.sourceSlot,
                polarity,
                targetKind: target.value,
                amount: amounts?.[sourceIndex]
                    ?? Math.fround(neutralAmountUnit * weights[sourceIndex]),
                reducer,
                benchmarkPath: name,
                neutralGroup: `${name}:${targetIndex}:${groupIndex}`,
            }));
            allRoutes.push(...routes);
            return routes;
        }));
        groupsByPath.set(name, targetGroups);
    }

    if (allRoutes.length !== 1372) {
        throw new Error(`Expected the complete 1372-cell domain, received ${allRoutes.length}`);
    }
    return { allRoutes, groupsByPath };
}

function flattenSelectedGroups(groupsByPath, pathName, selections) {
    const targetGroups = groupsByPath.get(pathName);
    if (!targetGroups) throw new Error(`Unknown benchmark path ${pathName}`);
    return selections.flatMap(({ targetIndex, groupIndexes }) => (
        groupIndexes.flatMap((groupIndex) => targetGroups[targetIndex][groupIndex])
    ));
}

function buildProfileRoutes(groupsByPath) {
    const fiveVoiceGroups = [0, 1, 2, 3, 4];
    const voiceHundred = flattenSelectedGroups(
        groupsByPath,
        "voice",
        Array.from({ length: 10 }, (_, targetIndex) => ({ targetIndex, groupIndexes: fiveVoiceGroups })),
    );

    // Retain the shipping profile's all-destination coverage while rotating
    // through all five Amp-inclusive source pairs. One pair per 36 targets is
    // 72 routes; a second pair on the first 14 targets makes exactly 100.
    const voiceRackHundred = flattenSelectedGroups(
        groupsByPath,
        "voiceRack",
        Array.from({ length: 36 }, (_, targetIndex) => ({
            targetIndex,
            groupIndexes: targetIndex < 14
                ? [targetIndex % fiveVoiceGroups.length, (targetIndex + 1) % fiveVoiceGroups.length]
                : [targetIndex % fiveVoiceGroups.length],
        })),
    );

    const mixedVoice = flattenSelectedGroups(
        groupsByPath,
        "voice",
        Array.from({ length: 3 }, (_, targetIndex) => ({ targetIndex, groupIndexes: fiveVoiceGroups })),
    );
    const mixedMacroVoice = flattenSelectedGroups(
        groupsByPath,
        "macroVoice",
        Array.from({ length: 5 }, (_, targetIndex) => ({ targetIndex, groupIndexes: [0, 1] })),
    );
    const mixedVoiceRack = flattenSelectedGroups(
        groupsByPath,
        "voiceRack",
        Array.from({ length: 3 }, (_, targetIndex) => ({ targetIndex, groupIndexes: fiveVoiceGroups })),
    );
    const mixedMacroRack = flattenSelectedGroups(
        groupsByPath,
        "macroRack",
        Array.from({ length: 5 }, (_, targetIndex) => ({ targetIndex, groupIndexes: [0, 1] })),
    );
    const mixedHundred = [
        ...mixedVoice,
        ...mixedMacroVoice,
        ...mixedVoiceRack,
        ...mixedMacroRack,
    ];

    for (const [name, routes, expected] of [
        ["voice-100", voiceHundred, 100],
        ["voice-rack-100", voiceRackHundred, 100],
        ["mixed-100", mixedHundred, 100],
    ]) {
        if (routes.length !== expected) {
            throw new Error(`${name} selected ${routes.length} routes, expected ${expected}`);
        }
    }

    return { voiceHundred, voiceRackHundred, mixedHundred };
}

function createProfile(name, routes) {
    const state = createNeutralState(routes.map(stripBenchmarkMetadata));
    const stateJSON = serializeModulationState(state);
    const parsed = parseModulationState(stateJSON);
    if (parsed._tag !== "ok") {
        throw new Error(`Profile ${name} did not satisfy the strict current modulation schema`);
    }

    const program = compileModulationRuntimeProgram(parsed.value.routes);
    const executionFingerprint = runtimeExecutionFingerprint(program);
    const compiledRouteCount = program.voiceRouteCount
        + program.macroVoiceRouteCount
        + program.voiceRackRouteCount
        + program.macroRackRouteCount;
    const activeRouteCount = parsed.value.routes.filter((route) => route.enabled && route.amount !== 0).length;
    if (compiledRouteCount !== activeRouteCount) {
        throw new Error(`Profile ${name} compiled ${compiledRouteCount} of ${activeRouteCount} active routes`);
    }

    return {
        name,
        storedRouteCount: parsed.value.routes.length,
        activeRouteCount,
        compiledRouteCount,
        compiledCounts: {
            voice: program.voiceRouteCount,
            macroVoice: program.macroVoiceRouteCount,
            voiceRack: program.voiceRackRouteCount,
            macroRack: program.macroRackRouteCount,
        },
        executionFingerprint,
        execution: { status: "available" },
        stateJSON,
    };
}

export function buildModulationBenchmarkProfiles() {
    const { allRoutes, groupsByPath } = buildNeutralRouteGroups();
    const { voiceHundred, voiceRackHundred, mixedHundred } = buildProfileRoutes(groupsByPath);
    const mixedActiveIDs = new Set(mixedHundred.map((route) => route.id));
    const profiles = [
        createProfile("empty", []),
        createProfile("voice-100", voiceHundred),
        createProfile("voice-rack-100", voiceRackHundred),
        createProfile("mixed-100", mixedHundred),
        createProfile("combined-200", [...voiceHundred, ...voiceRackHundred]),
        createProfile("stored-1372-active-100", allRoutes.map((route) => ({
            ...route,
            enabled: mixedActiveIDs.has(route.id),
        }))),
        createProfile("active-1372", allRoutes),
    ];
    const mixed = profiles.find((profile) => profile.name === "mixed-100");
    const stored = profiles.find((profile) => profile.name === "stored-1372-active-100");
    if (mixed.executionFingerprint !== stored.executionFingerprint) {
        throw new Error("Disabled stored routes changed the compiled real-time execution program");
    }
    return profiles.map((profile, profileIndex) => ({ ...profile, profileIndex }));
}

export function buildModulationBenchmarkDocument() {
    return {
        format: "cosimo.modulation-benchmark-profiles",
        version: 3,
        generatedFrom: path.relative(repoRoot, scriptPath),
        sourceContract: {
            msegValue: 0,
            envelopeValue: 0,
            ampEnvelopeSustain,
            ampEnvelopeRouteValue,
            expressionMidiValue,
            macroValue: 0.75,
        },
        profiles: buildModulationBenchmarkProfiles(),
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    const outputPath = readOutputPath(process.argv.slice(2));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(buildModulationBenchmarkDocument(), null, 2)}\n`);
}
