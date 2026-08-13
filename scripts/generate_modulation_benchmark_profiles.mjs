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
        envelopeSlots: state.envelopeSlots.map((envelope) => ({
            ...envelope,
            attackSeconds: 0.001,
            decaySeconds: 0.001,
            sustain: 0,
            releaseSeconds: 0.001,
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
    if (voiceSources.length !== 9 || macroSources.length !== 4) {
        throw new Error("Neutral benchmark source groups no longer cover the production source catalog");
    }

    // MSEGs and envelopes are configured to exact zero. Velocity, pressure, and
    // slide are driven from the same MIDI byte. Macros are all set to the same value.
    // Each group therefore contributes exactly zero while every compiled instruction
    // still resolves its real production source, polarity, reducer, and destination.
    const voiceGroups = [
        { sources: [voiceSources[0], voiceSources[1]], weights: [1, -1] },
        { sources: [voiceSources[2], voiceSources[3]], weights: [1, -1] },
        { sources: [voiceSources[4], voiceSources[5]], weights: [1, -1] },
        { sources: [voiceSources[6], voiceSources[7], voiceSources[8]], weights: [1, 1, -2] },
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
            const routes = group.sources.map((source, sourceIndex) => ({
                id: `benchmark-${name}-${source.value}-${target.value}`,
                enabled: true,
                sourceKind: source.sourceKind,
                sourceSlot: source.sourceSlot,
                polarity,
                targetKind: target.value,
                amount: neutralAmountUnit * group.weights[sourceIndex],
                reducer,
                benchmarkPath: name,
                neutralGroup: `${name}:${targetIndex}:${groupIndex}`,
            }));
            allRoutes.push(...routes);
            return routes;
        }));
        groupsByPath.set(name, targetGroups);
    }

    if (allRoutes.length !== 624) {
        throw new Error(`Expected the complete 624-cell domain, received ${allRoutes.length}`);
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

function allVoiceGroupsForTargets(targetIndexes) {
    return targetIndexes.map((targetIndex) => ({ targetIndex, groupIndexes: [0, 1, 2, 3] }));
}

function buildProfileRoutes(groupsByPath) {
    const voiceHundred = flattenSelectedGroups(groupsByPath, "voice", [
        ...allVoiceGroupsForTargets(Array.from({ length: 8 }, (_, index) => index)),
        ...Array.from({ length: 4 }, (_, index) => ({
            targetIndex: index + 8,
            groupIndexes: [0, 1, 3],
        })),
    ]);

    const voiceRackHundredSelections = Array.from({ length: 36 }, (_, targetIndex) => ({
        targetIndex,
        groupIndexes: [targetIndex % 3],
    }));
    for (let targetIndex = 0; targetIndex < 11; targetIndex += 1) {
        voiceRackHundredSelections[targetIndex].groupIndexes.push((targetIndex + 1) % 3);
    }
    for (let targetIndex = 0; targetIndex < 2; targetIndex += 1) {
        voiceRackHundredSelections[targetIndex].groupIndexes.push(3);
    }
    const voiceRackHundred = flattenSelectedGroups(
        groupsByPath,
        "voiceRack",
        voiceRackHundredSelections,
    );

    const mixedVoice = flattenSelectedGroups(
        groupsByPath,
        "voice",
        Array.from({ length: 12 }, (_, targetIndex) => ({
            targetIndex,
            groupIndexes: targetIndex < 2 ? [targetIndex % 3, 3] : [targetIndex % 3],
        })),
    );
    const mixedMacroVoice = flattenSelectedGroups(
        groupsByPath,
        "macroVoice",
        Array.from({ length: 10 }, (_, targetIndex) => ({ targetIndex, groupIndexes: [0] })),
    );
    const mixedVoiceRack = flattenSelectedGroups(
        groupsByPath,
        "voiceRack",
        Array.from({ length: 12 }, (_, targetIndex) => ({
            targetIndex,
            groupIndexes: targetIndex < 2 ? [targetIndex % 3, 3] : [targetIndex % 3],
        })),
    );
    const mixedMacroRack = flattenSelectedGroups(
        groupsByPath,
        "macroRack",
        Array.from({ length: 10 }, (_, targetIndex) => ({ targetIndex, groupIndexes: [0] })),
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
        createProfile("stored-624-active-100", allRoutes.map((route) => ({
            ...route,
            enabled: mixedActiveIDs.has(route.id),
        }))),
        createProfile("active-624", allRoutes),
    ];
    const mixed = profiles.find((profile) => profile.name === "mixed-100");
    const stored = profiles.find((profile) => profile.name === "stored-624-active-100");
    if (mixed.executionFingerprint !== stored.executionFingerprint) {
        throw new Error("Disabled stored routes changed the compiled real-time execution program");
    }
    return profiles.map((profile, profileIndex) => ({ ...profile, profileIndex }));
}

export function buildModulationBenchmarkDocument() {
    return {
        format: "cosimo.modulation-benchmark-profiles",
        version: 1,
        generatedFrom: path.relative(repoRoot, scriptPath),
        sourceContract: {
            msegValue: 0,
            envelopeValue: 0,
            expressionMidiValue: 100,
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
