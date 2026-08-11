import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const programModulePromise = loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");
const modulationModulePromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");
const runtimeMirrorModulePromise = loadUIModule(repoRoot, "ui/shared/stored-state-runtime-mirror.ts");

const voiceSources = [
    ["mseg", 1],
    ["mseg", 2],
    ["mseg", 3],
    ["env", 1],
    ["env", 2],
    ["env", 3],
    ["velocity", null],
    ["pressure", null],
    ["slide", null],
];

const voiceTargets = [
    "wavetablePosition",
    "warpAmount",
    "filterCutoffOctaves",
    "filterQ",
    "pitchSemitones",
    "ampGainDb",
    "pan",
    "unisonDetune",
    "unisonBlend",
    "unisonWidth",
    "unisonWavetablePositionSpread",
    "unisonWarpSpread",
];

function modulationRoute(overrides = {}) {
    return {
        id: "wavetablePosition::mseg-1",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "wavetablePosition",
        amount: 0.25,
        reducer: "max",
        ...overrides,
    };
}

async function assertSingleStructuralReinstall(previousRoutes, nextRoutes) {
    const {
        buildModulationRuntimeProgramEvents,
        compileModulationRuntimeProgram,
        MODULATION_PROGRAM_ENDPOINT_ID,
    } = await programModulePromise;

    assert.deepEqual(buildModulationRuntimeProgramEvents(previousRoutes, nextRoutes), [{
        endpointID: MODULATION_PROGRAM_ENDPOINT_ID,
        value: compileModulationRuntimeProgram(nextRoutes),
    }]);
}

test("rack target catalog compilation rejects indices outside the DSP domain", async () => {
    const { compileRackModulationTargetCatalog } = await programModulePromise;

    for (const modulationTargetIndex of [-1, 36, 1.5]) {
        assert.throws(
            () => compileRackModulationTargetCatalog([{
                endpointID: "invalidRackTarget",
                modulationTargetIndex,
            }]),
            /Invalid rack modulation target index/,
        );
    }
});

test("rack target catalog compilation rejects duplicate DSP indices", async () => {
    const { compileRackModulationTargetCatalog } = await programModulePromise;

    assert.throws(
        () => compileRackModulationTargetCatalog([
            { endpointID: "firstRackTarget", modulationTargetIndex: 4 },
            { endpointID: "secondRackTarget", modulationTargetIndex: 4 },
        ]),
        /Duplicate rack modulation target index 4/,
    );
});

test("101 active voice mappings compile into 101 deterministic runtime cells", async () => {
    const { compileModulationRuntimeProgram } = await programModulePromise;
    const routes = [];

    for (const [sourceKind, sourceSlot] of voiceSources) {
        for (const targetKind of voiceTargets) {
            routes.push({
                id: `${targetKind}::${sourceKind}-${sourceSlot ?? "fixed"}`,
                enabled: true,
                sourceKind,
                sourceSlot,
                polarity: routes.length % 2 === 0 ? "unipolar" : "bipolar",
                targetKind,
                amount: (routes.length + 1) / 100,
                reducer: "max",
            });
        }
    }

    const program = compileModulationRuntimeProgram(routes.slice(0, 101));

    assert.equal(program.voiceRouteCount, 101);
    assert.equal(new Set(program.voiceRouteCells.slice(0, 101)).size, 101);
    assert.deepEqual(program.voiceRouteCells.slice(0, 4), [0, 1, 2, 3]);
    assert.equal(program.voiceRouteAmounts[100], 1.01);
});

test("all 624 legal mappings compile without truncation", async () => {
    const [{ compileModulationRuntimeProgram, MODULATION_MAPPING_CELL_COUNT }, modulation] = await Promise.all([
        programModulePromise,
        modulationModulePromise,
    ]);
    const macroSources = [["macro", 1], ["macro", 2], ["macro", 3], ["macro", 4]];
    const rackTargets = modulation.MODULATION_TARGET_OPTIONS
        .map((option) => option.value)
        .filter((targetKind) => targetKind.startsWith("rack."));
    const routes = [];

    for (const [sourceKind, sourceSlot] of [...voiceSources, ...macroSources]) {
        for (const targetKind of [...voiceTargets, ...rackTargets]) {
            routes.push({
                id: `${targetKind}::${sourceKind}-${sourceSlot ?? "fixed"}`,
                enabled: true,
                sourceKind,
                sourceSlot,
                polarity: "unipolar",
                targetKind,
                amount: 0.5,
                reducer: "mean",
            });
        }
    }

    const program = compileModulationRuntimeProgram(routes);

    assert.equal(routes.length, MODULATION_MAPPING_CELL_COUNT);
    assert.deepEqual(
        [program.voiceRouteCount, program.macroVoiceRouteCount, program.voiceRackRouteCount, program.macroRackRouteCount],
        [108, 48, 324, 144],
    );
});

test("disabled mappings cost no runtime instructions while enabled zero-depth mappings stay active", async () => {
    const { compileModulationRuntimeProgram } = await programModulePromise;
    const routes = voiceTargets.map((targetKind, index) => ({
        id: `${targetKind}::mseg-1`,
        enabled: index === 0,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind,
        amount: 0,
        reducer: "max",
    }));

    const program = compileModulationRuntimeProgram(routes);

    assert.equal(program.voiceRouteCount, 1);
    assert.equal(program.voiceRouteCells[0], 0);
    assert.equal(program.voiceRouteAmounts[0], 0);
});

test("disabled voice mappings retain their finite base amount in the deterministic articulation cell", async () => {
    const {
        compileModulationRuntimeProgram,
        getModulationArticulationCellIndex,
    } = await programModulePromise;
    const disabledRoute = modulationRoute({
        id: "filterQ::mseg-1",
        enabled: false,
        targetKind: "filterQ",
        amount: 0.625,
    });
    const cellIndex = getModulationArticulationCellIndex(disabledRoute);
    const program = compileModulationRuntimeProgram([disabledRoute]);

    assert.equal(cellIndex, 3);
    assert.equal(program.voiceRouteCount, 0, "disabled mappings must emit no active instruction");
    assert.equal(program.voiceRouteAmounts[cellIndex], 0.625);
    assert.equal(Number.isFinite(program.voiceRouteAmounts[cellIndex]), true);
});

test("the DSP hot path consumes published active prefixes instead of transport capacities", async () => {
    const source = await fs.readFile(path.join(repoRoot, "cmajor/FixedFrameOscillator.cmajor"), "utf8");
    const hotPathStart = source.indexOf("        void beginModulationFrame()");
    const hotPathEnd = source.indexOf("        void initialiseWarpDecimatorTaps()", hotPathStart);
    assert.ok(hotPathStart >= 0 && hotPathEnd > hotPathStart, "Expected the production modulation hot path.");
    const hotPath = source.slice(hotPathStart, hotPathEnd);

    assert.match(hotPath, /macroVoiceRouteSourceUsed\[sourceIndex\]/);
    assert.match(hotPath, /macroVoiceRouteScaleVectors\[sourceIndex\] \* macroSourceValues\[sourceIndex\]/);
    assert.match(hotPath, /voiceRouteSourceUsed\[sourceIndex\]/);
    assert.match(hotPath, /voiceRouteScaleVectors\[sourceIndex\] \* sourceValue/);
    assert.equal(
        hotPath.match(/int32 \(routeIndex\) >= voiceRouteCount/g)?.length,
        1,
        "The articulated voice loop must stop at the active prefix.",
    );
    assert.match(hotPath, /int32 \(routeIndex\) >= macroVoiceRouteCount/);
    assert.match(hotPath, /int32 \(routeIndex\) >= voiceRackRouteCount/);
    assert.match(hotPath, /macroRackRouteSourceUsed\[sourceIndex\]/);
    assert.match(hotPath, /macroRackRouteScaleVectors\[sourceIndex\] \* macroSourceValues\[sourceIndex\]/);
    assert.doesNotMatch(
        hotPath,
        /routeIndex < (?:modulationVoiceRouteCellCount|modulationMacroVoiceRouteCellCount|modulationVoiceRackRouteCellCount|modulationMacroRackRouteCellCount)/,
    );
});

test("only synth-voice destinations expose a per-note articulation cell", async () => {
    const { getModulationArticulationCellIndex } = await programModulePromise;
    const voiceRoute = {
        id: "voice-pan",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "pan",
        amount: 0.5,
        reducer: "max",
    };

    assert.equal(getModulationArticulationCellIndex(voiceRoute), 6);
    assert.equal(getModulationArticulationCellIndex({
        ...voiceRoute,
        id: "rack-reverb",
        targetKind: "rack.reverbDecay",
    }), null);
});

test("stored duplicate pairs reject the complete modulation document", async () => {
    const modulation = await modulationModulePromise;
    const first = modulation.createDefaultRoute({
        id: "first",
        targetKind: "pan",
        amount: -0.25,
    });
    const replacement = modulation.createDefaultRoute({
        id: "replacement",
        targetKind: "pan",
        amount: 0.75,
    });

    const parsed = modulation.parseModulationState(JSON.stringify({
        ...modulation.createDefaultModulationState(),
        routes: [first, replacement],
    }));

    assert.equal(parsed._tag, "err");
    assert.throws(
        () => modulation.deserializeModulationState(JSON.stringify({
            ...modulation.createDefaultModulationState(),
            routes: [first, replacement],
        })),
        /current modulation schema/,
    );
});

test("stored duplicate pairs are rejected even when one row is disabled", async () => {
    const modulation = await modulationModulePromise;
    const first = modulation.createDefaultRoute({
        id: "first",
        targetKind: "pan",
        amount: 0.75,
    });
    const second = modulation.createDefaultRoute({
        id: "second",
        targetKind: "pan",
        amount: 0.75,
    });
    const disabledReplacement = modulation.createDefaultRoute({
        id: "replacement",
        enabled: false,
        targetKind: "pan",
        amount: -0.5,
        polarity: "bipolar",
    });

    const parsed = modulation.parseModulationState(JSON.stringify({
        ...modulation.createDefaultModulationState(),
        routes: [first, second, disabledReplacement],
    }));

    assert.equal(parsed._tag, "err");
});

test("runtime compilation rejects duplicate cells instead of repairing them last-wins", async () => {
    const { compileModulationRuntimeProgram } = await programModulePromise;
    const modulation = await modulationModulePromise;
    const first = modulation.createDefaultRoute({
        id: "first",
        targetKind: "pan",
        amount: -0.25,
    });
    const duplicate = modulation.createDefaultRoute({
        id: "duplicate",
        targetKind: "pan",
        amount: 0.75,
    });

    assert.throws(
        () => compileModulationRuntimeProgram([first, duplicate]),
        /Duplicate modulation route cell/,
    );
});

test("stored mappings with an unknown target reject the complete document", async () => {
    const modulation = await modulationModulePromise;
    const genuine = modulation.createDefaultRoute({
        id: "genuine-wavetable",
        targetKind: "wavetablePosition",
        amount: 0.25,
    });
    const serialized = JSON.stringify({
        ...modulation.createDefaultModulationState(),
        routes: [
            genuine,
            { ...genuine, id: "unknown-target", targetKind: "futureTarget", amount: 0.75 },
        ],
    });

    assert.equal(modulation.parseModulationState(serialized)._tag, "err");
    assert.throws(() => modulation.deserializeModulationState(serialized));
});

test("stored mappings with an unknown source reject the complete document", async () => {
    const modulation = await modulationModulePromise;
    const genuine = modulation.createDefaultRoute({
        id: "genuine-pan",
        targetKind: "pan",
        amount: -0.25,
    });
    const serialized = JSON.stringify({
        ...modulation.createDefaultModulationState(),
        routes: [
            genuine,
            { ...genuine, id: "unknown-source", sourceKind: "futureSource", amount: 0.75 },
        ],
    });

    assert.equal(modulation.parseModulationState(serialized)._tag, "err");
    assert.throws(() => modulation.deserializeModulationState(serialized));
});

test("stored ID collisions reject the complete document", async () => {
    const modulation = await modulationModulePromise;
    const first = modulation.createDefaultRoute({ id: "collision", targetKind: "pan" });
    const second = modulation.createDefaultRoute({ id: "collision", targetKind: "warpAmount" });

    const serialized = JSON.stringify({
        ...modulation.createDefaultModulationState(),
        routes: [first, second],
    });

    assert.equal(modulation.parseModulationState(serialized)._tag, "err");
    assert.throws(() => modulation.deserializeModulationState(serialized));
});

test("strict parsing exposes stored ID collisions as a typed rejection", async () => {
    const modulation = await modulationModulePromise;
    const serialized = JSON.stringify({
        ...modulation.createDefaultModulationState(),
        routes: [
            modulation.createDefaultRoute({ id: "collision", targetKind: "pan" }),
            modulation.createDefaultRoute({ id: "collision", targetKind: "warpAmount" }),
        ],
    });

    const parsed = modulation.parseModulationState(serialized);

    assert.equal(parsed._tag, "err");
    assert.equal(parsed.error.name, "ModulationStateParseError");
});

test("generic Add chooses an unused source-target pair", async () => {
    const modulation = await modulationModulePromise;
    const routes = [
        modulation.createDefaultRoute({ id: "wavetable", targetKind: "wavetablePosition" }),
        modulation.createDefaultRoute({ id: "warp", targetKind: "warpAmount" }),
    ];

    const next = modulation.createFirstAvailableModulationRoute(routes);

    assert.equal(next?.sourceKind, "mseg");
    assert.equal(next?.sourceSlot, 1);
    assert.equal(next?.targetKind, "filterCutoffOctaves");
});

test("explicit Add rejects a route ID collision without changing state", async () => {
    const modulation = await modulationModulePromise;
    const storedWrites = [];
    const bridge = new modulation.ModulationRuntimeBridge({
        sendStoredStateValue(key, value) {
            storedWrites.push({ key, value });
        },
    });
    const existingRoute = bridge.getState().routes[0];

    const added = bridge.addRoute(modulation.createDefaultRoute({
        id: existingRoute.id,
        targetKind: "pan",
    }));

    const routes = bridge.getState().routes;
    assert.equal(added, null);
    assert.equal(routes.length, 2);
    assert.equal(storedWrites.length, 0);
});

test("changing an enabled mapping through zero emits one amount update without rebuilding topology", async () => {
    const { buildModulationRuntimeProgramEvents, MODULATION_AMOUNT_ENDPOINT_ID } = await programModulePromise;
    const route = {
        id: "wavetablePosition::mseg-1",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "wavetablePosition",
        amount: -0.25,
        reducer: "max",
    };

    const events = buildModulationRuntimeProgramEvents([route], [{ ...route, amount: 0 }]);

    assert.deepEqual(events, [{
        endpointID: MODULATION_AMOUNT_ENDPOINT_ID,
        value: { pathKind: 1, cellIndex: 0, amount: 0 },
    }]);
});

test("zero-depth rack mappings stay stored but leave the active runtime program", async () => {
    const {
        buildModulationRuntimeProgramEvents,
        compileModulationRuntimeProgram,
        MODULATION_PROGRAM_ENDPOINT_ID,
    } = await programModulePromise;
    const rackRoute = modulationRoute({
        id: "rack.reverbDecay::mseg-1",
        targetKind: "rack.reverbDecay",
        amount: 0.5,
    });
    const zeroRoute = { ...rackRoute, amount: 0 };

    assert.equal(compileModulationRuntimeProgram([zeroRoute]).voiceRackRouteCount, 0);
    assert.deepEqual(buildModulationRuntimeProgramEvents([rackRoute], [zeroRoute]), [{
        endpointID: MODULATION_PROGRAM_ENDPOINT_ID,
        value: compileModulationRuntimeProgram([zeroRoute]),
    }]);
    assert.deepEqual(buildModulationRuntimeProgramEvents([zeroRoute], [rackRoute]), [{
        endpointID: MODULATION_PROGRAM_ENDPOINT_ID,
        value: compileModulationRuntimeProgram([rackRoute]),
    }]);
});

test("enabling a mapping emits one atomic structural reinstall", async () => {
    const route = modulationRoute();
    await assertSingleStructuralReinstall([{ ...route, enabled: false }], [route]);
});

test("disabling a mapping emits one atomic structural reinstall", async () => {
    const route = modulationRoute();
    await assertSingleStructuralReinstall([route], [{ ...route, enabled: false }]);
});

test("adding a mapping emits one atomic structural reinstall", async () => {
    const firstRoute = modulationRoute();
    const addedRoute = modulationRoute({
        id: "pan::mseg-1",
        targetKind: "pan",
    });
    await assertSingleStructuralReinstall([firstRoute], [firstRoute, addedRoute]);
});

test("removing a mapping emits one atomic structural reinstall", async () => {
    const retainedRoute = modulationRoute();
    const removedRoute = modulationRoute({
        id: "pan::mseg-1",
        targetKind: "pan",
    });
    await assertSingleStructuralReinstall([retainedRoute, removedRoute], [retainedRoute]);
});

test("changing mapping polarity emits one atomic structural reinstall", async () => {
    const route = modulationRoute();
    await assertSingleStructuralReinstall([route], [{ ...route, polarity: "bipolar" }]);
});

test("reordering unchanged topology emits only changed deterministic-cell amounts", async () => {
    const {
        buildModulationRuntimeProgramEvents,
        MODULATION_AMOUNT_ENDPOINT_ID,
    } = await programModulePromise;
    const wavetableRoute = {
        id: "wavetablePosition::mseg-1",
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "wavetablePosition",
        amount: 0.25,
        reducer: "max",
    };
    const panRoute = {
        ...wavetableRoute,
        id: "pan::mseg-1",
        targetKind: "pan",
        amount: -0.25,
    };

    const events = buildModulationRuntimeProgramEvents(
        [wavetableRoute, panRoute],
        [{ ...panRoute, amount: -0.5 }, { ...wavetableRoute, amount: 0.5 }],
    );

    assert.deepEqual(events, [
        { endpointID: MODULATION_AMOUNT_ENDPOINT_ID, value: { pathKind: 1, cellIndex: 0, amount: 0.5 } },
        { endpointID: MODULATION_AMOUNT_ENDPOINT_ID, value: { pathKind: 1, cellIndex: 6, amount: -0.5 } },
    ]);
});

test("initial modulation restore uploads sources once and installs one atomic route program", async () => {
    const [programModule, modulation] = await Promise.all([programModulePromise, modulationModulePromise]);
    const events = modulation.buildModulationRuntimeEvents(modulation.createDefaultModulationState());
    const endpointCount = (endpointID) => events.filter((event) => event.endpointID === endpointID).length;

    assert.equal(endpointCount(modulation.MODULATION_MSEG_BUFFER_ENDPOINT_ID), 6);
    assert.equal(endpointCount(modulation.MODULATION_MSEG_PLAYBACK_ENDPOINT_ID), 3);
    assert.equal(endpointCount(modulation.MODULATION_ENV_ENDPOINT_ID), 3);
    assert.equal(endpointCount(programModule.MODULATION_PROGRAM_ENDPOINT_ID), 1);
    assert.equal(events.length, 13);
});

test("the runtime mirror gives a compiler the last successfully applied snapshot", async () => {
    const { createStoredStateRuntimeMirror } = await runtimeMirrorModulePromise;
    const listeners = new Set();
    const events = [];
    const connection = {
        addStoredStateValueListener(listener) {
            listeners.add(listener);
        },
        requestFullStoredState(callback) {
            callback({ "counter.v1": 1 });
        },
        sendEventOrValue(endpointID, value) {
            events.push({ endpointID, value });
        },
    };
    const mirror = createStoredStateRuntimeMirror(connection, {
        stateKey: "counter.v1",
        deserializeStoredState: Number,
        buildRuntimeEvents: ({ state }, previous) => [{
            endpointID: "counterDelta",
            value: previous === null ? state : state - previous.state,
        }],
    });

    mirror.start();
    for (const listener of listeners) listener({ key: "counter.v1", value: 4 });

    assert.deepEqual(events, [
        { endpointID: "counterDelta", value: 1 },
        { endpointID: "counterDelta", value: 3 },
    ]);
});
