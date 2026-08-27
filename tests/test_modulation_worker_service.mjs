import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulationModulePromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");
const targetsModulePromise = loadUIModule(repoRoot, "ui/shared/modulation-targets.ts");
const serviceModulePromise = loadUIModule(repoRoot, "ui/worker/modulation-articulation-worker-service.ts");

const laneTails = [
    {
        count: "voiceRouteCount",
        cells: "voiceRouteCells",
        sources: "voiceRouteSources",
        targets: "voiceRouteTargets",
        polarities: "voiceRoutePolarities",
        amounts: "voiceRouteAmounts",
        expected: { count: 560, cellIndex: 559, sourceIndex: 9, targetIndex: 55, polarity: 0 },
    },
    {
        count: "macroVoiceRouteCount",
        cells: "macroVoiceRouteCells",
        sources: "macroVoiceRouteSources",
        targets: "macroVoiceRouteTargets",
        polarities: "macroVoiceRoutePolarities",
        amounts: "macroVoiceRouteAmounts",
        expected: { count: 224, cellIndex: 223, sourceIndex: 3, targetIndex: 55, polarity: 0 },
    },
    {
        count: "voiceRackRouteCount",
        cells: "voiceRackRouteCells",
        sources: "voiceRackRouteSources",
        targets: "voiceRackRouteTargets",
        polarities: "voiceRackRoutePolarities",
        amounts: "voiceRackRouteAmounts",
        reducers: "voiceRackRouteReducers",
        // Rack cell indices run at the bus width (static 39 + four pool
        // mirror sets = 195): final static voiceRack pair = 9*195 + 38.
        expected: { count: 390, cellIndex: 1793, sourceIndex: 9, targetIndex: 38, polarity: 0 },
    },
    {
        count: "macroRackRouteCount",
        cells: "macroRackRouteCells",
        sources: "macroRackRouteSources",
        targets: "macroRackRouteTargets",
        polarities: "macroRackRoutePolarities",
        amounts: "macroRackRouteAmounts",
        // Final static macroRack pair = 3*195 + 38.
        expected: { count: 156, cellIndex: 623, sourceIndex: 3, targetIndex: 38, polarity: 0 },
    },
];

class AcknowledgingModulationConnection {
    constructor(stateKey, serializedState) {
        this.stateKey = stateKey;
        this.serializedState = serializedState;
        this.endpointListeners = new Map();
        this.storedStateListeners = new Set();
        this.sentEvents = [];
        this.acknowledgements = [];
        this.protocolFailures = [];
        this.dspSessionId = 41;
        this.acceptedModulationSerial = 0;
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? [];
        listeners.push(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? [];
        this.endpointListeners.set(
            endpointID,
            listeners.filter((candidate) => candidate !== listener),
        );
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ [this.stateKey]: this.serializedState });
    }

    sendEventOrValue(endpointID, value, _rampFrames, timeoutMilliseconds) {
        this.sentEvents.push({ endpointID, value, timeoutMilliseconds });

        if (endpointID === "runtimeSyncRequest") {
            queueMicrotask(() => this.emitAcknowledgement(value));
            return;
        }

        const deliverySerial = Number(value?.deliverySerial);
        if (!Number.isSafeInteger(deliverySerial) || deliverySerial !== this.acceptedModulationSerial + 1) {
            this.protocolFailures.push({ endpointID, deliverySerial });
            return;
        }

        this.acceptedModulationSerial = deliverySerial;
        queueMicrotask(() => this.emitAcknowledgement(0));
    }

    emitEndpoint(endpointID, value) {
        for (const listener of this.endpointListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }

    emitAcknowledgement(syncSerial) {
        const acknowledgement = {
            dspSessionId: this.dspSessionId,
            acceptedModulationSerial: this.acceptedModulationSerial,
            acceptedArticulationSerial: 0,
            rejectedSerial: 0,
            rejectionReason: 0,
            syncSerial,
        };
        this.acknowledgements.push(acknowledgement);
        this.emitEndpoint("runtimeInstallAck", { event: { value: acknowledgement } });
    }
}

async function waitFor(predicate, description) {
    for (let attempt = 0; attempt < 256; attempt += 1) {
        if (predicate()) {
            return;
        }
        await new Promise((resolve) => setImmediate(resolve));
    }

    assert.fail(`Timed out waiting for ${description}`);
}

function readLaneTail(program, specification) {
    const count = program[specification.count];
    const prefixIndex = count - 1;
    const cellIndex = program[specification.cells][prefixIndex];

    return {
        count,
        cellIndex,
        sourceIndex: program[specification.sources][prefixIndex],
        targetIndex: program[specification.targets][prefixIndex],
        polarity: program[specification.polarities][prefixIndex],
        amount: program[specification.amounts][cellIndex],
        reducer: specification.reducers === undefined
            ? null
            : program[specification.reducers][prefixIndex],
    };
}

test("the modulation service publishes serialized all-1330 state through one correlated runtime frontier", async () => {
    const [modulation, targets, serviceModule] = await Promise.all([
        modulationModulePromise,
        targetsModulePromise,
        serviceModulePromise,
    ]);
    const state = modulation.createDefaultModulationState();
    state.routes = targets.MODULATION_SOURCE_IDENTITIES.flatMap((source) => (
        targets.MODULATION_TARGET_IDENTITIES.map((target) => ({
            id: `${source.id}->${target.kind}`,
            enabled: true,
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            polarity: "unipolar",
            targetKind: target.kind,
            amount: 0.25,
            reducer: "mean",
        }))
    ));
    const serializedState = modulation.serializeModulationState(state);
    const connection = new AcknowledgingModulationConnection(modulation.MODULATION_STATE_KEY, serializedState);
    const service = serviceModule.createModulationArticulationWorkerService(connection);

    service.start();
    connection.emitEndpoint("runtimeState", { dspSessionId: connection.dspSessionId });

    try {
        const installedProgram = () => connection.sentEvents.find(
            ({ endpointID }) => endpointID === "modulationProgram",
        );
        await waitFor(
            () => installedProgram() !== undefined
                && connection.acknowledgements.at(-1)?.acceptedModulationSerial
                    === installedProgram()?.value.deliverySerial,
            "the all-1330 modulation program acknowledgement",
        );

        const parsedState = modulation.parseModulationState(serializedState);
        assert.equal(parsedState._tag, "ok");
        assert.equal(parsedState.value.routes.length, 1330);
        assert.deepEqual(connection.protocolFailures, []);

        const programEvent = installedProgram();
        assert.notEqual(programEvent, undefined);
        assert.equal(programEvent.endpointID, "modulationProgram");
        assert.equal(programEvent.timeoutMilliseconds, 0);
        assert.equal(programEvent.value.dspSessionId, connection.dspSessionId);
        assert.ok(programEvent.value.deliverySerial > 0);

        assert.deepEqual(
            laneTails.map((specification) => readLaneTail(programEvent.value, specification)),
            laneTails.map(({ expected, reducers }) => ({
                ...expected,
                amount: 0.25,
                reducer: reducers === undefined ? null : 2,
            })),
        );

        const modulationAcknowledgement = connection.acknowledgements.find((acknowledgement) => (
            acknowledgement.acceptedModulationSerial === programEvent.value.deliverySerial
            && acknowledgement.syncSerial === 0
        ));
        assert.notEqual(modulationAcknowledgement, undefined);
        assert.equal(modulationAcknowledgement.dspSessionId, programEvent.value.dspSessionId);
        assert.equal(modulationAcknowledgement.rejectedSerial, 0);
    } finally {
        service.stop();
    }
});
