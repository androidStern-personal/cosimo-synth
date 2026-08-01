import * as patch from "./cmaj_Cosimo_Synth.js";
import { createPatchViewHolder } from "./cmaj_api/cmaj-patch-view.js";

globalThis.__COSIMO_DESKTOP_RUNTIME_KIND__ = "standalone";

const BROWSER_PATCH_STATE_KEY = "cosimo.web.patch-state.v1";

const elements = {
    error: document.getElementById("cosimo-error"),
    startAction: document.getElementById("cosimo-start-action"),
    startOverlay: document.getElementById("cosimo-start-overlay"),
    startStatus: document.getElementById("cosimo-start-status"),
    view: document.getElementById("cosimo-view"),
};

const state = {
    audioContext: null,
    audioProbe: null,
    audioProbeBuffer: null,
    audioPeak: 0,
    audioPeakCurrent: 0,
    audioRms: 0,
    audioPollCount: 0,
    audioWorkletBlockCount: 0,
    audioWorkletLoadSum: 0,
    audioWorkletMaxLoad: 0,
    audioWorkletOverBudgetBlocks: 0,
    heldNotes: new Set(),
    silentHeldNotePollCount: 0,
    connection: null,
    error: null,
    latestEffectiveFilterState: null,
    latestEffectiveRackState: null,
    latestEffectiveWavetablePosition: null,
    latestRuntimeState: null,
    parameterValues: {},
    midiEndpointID: null,
    phase: "initialising",
    started: false,
};

function describeError(error) {
    if (error instanceof Error) {
        return error.stack || error.message;
    }

    return String(error);
}

function showError(error) {
    const message = describeError(error);
    state.error = message;
    state.phase = "error";
    elements.error.textContent = message;
    elements.error.style.display = "block";
    elements.startStatus.textContent = "Could not start Cosimo";
    elements.startOverlay.disabled = true;
}

function endpointEvent(message) {
    return message?.event ?? message;
}

function readBrowserPatchState() {
    try {
        const parsed = JSON.parse(localStorage.getItem(BROWSER_PATCH_STATE_KEY) ?? "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function installBrowserPatchStatePersistence(connection) {
    const browserState = readBrowserPatchState();
    const sendStoredStateValue = connection.sendStoredStateValue.bind(connection);
    for (const [key, value] of Object.entries(browserState)) {
        sendStoredStateValue(key, value);
    }
    connection.sendStoredStateValue = (key, value) => {
        if (value === undefined) delete browserState[key];
        else browserState[key] = value;
        localStorage.setItem(BROWSER_PATCH_STATE_KEY, JSON.stringify(browserState));
        sendStoredStateValue(key, value);
    };
}

function findEndpointID(connection, purpose) {
    return connection.inputEndpoints.find((endpoint) => endpoint.purpose === purpose)?.endpointID ?? null;
}

function updateAudioPeak() {
    if (!state.audioProbe || !state.audioProbeBuffer) {
        return;
    }

    state.audioProbe.getFloatTimeDomainData(state.audioProbeBuffer);

    let peak = 0;
    let sumSquares = 0;
    for (const sample of state.audioProbeBuffer) {
        peak = Math.max(peak, Math.abs(sample));
        sumSquares += sample * sample;
    }
    state.audioPeakCurrent = peak;
    state.audioPeak = Math.max(state.audioPeak, peak);
    state.audioRms = Math.sqrt(sumSquares / state.audioProbeBuffer.length);
    state.audioPollCount += 1;
    if (state.heldNotes.size > 0 && state.audioRms < 1e-5) {
        state.silentHeldNotePollCount += 1;
    }
}

function midiCode(status, note, velocity) {
    return ((status & 0xff) << 16) | ((note & 0x7f) << 8) | (velocity & 0x7f);
}

function sendMIDI(status, note, velocity) {
    if (!state.connection || !state.midiEndpointID) {
        throw new Error("Cosimo MIDI is not ready.");
    }

    state.connection.sendMIDIInputEvent(
        state.midiEndpointID,
        midiCode(status, note, velocity),
    );
}

async function startAudio() {
    if (state.started) {
        return;
    }

    if (!state.connection || !state.audioContext) {
        throw new Error("Cosimo's audio engine is not ready.");
    }

    elements.startOverlay.disabled = true;
    elements.startStatus.textContent = "Starting audio…";
    await state.connection.connectDefaultAudioAndMIDI(state.audioContext);

    if (state.audioProbe) {
        state.connection.audioNode.disconnect();
        state.connection.audioNode.connect(state.audioProbe);
        state.audioProbe.connect(state.audioContext.destination);
    }

    await state.audioContext.resume();
    state.started = true;
    state.phase = "running";
    elements.startOverlay.style.display = "none";
}

function getSnapshot() {
    updateAudioPeak();

    return {
        audioContextState: state.audioContext?.state ?? null,
        audioBaseLatency: state.audioContext?.baseLatency ?? null,
        audioOutputLatency: state.audioContext?.outputLatency ?? null,
        audioPeak: state.audioPeak,
        audioPeakCurrent: state.audioPeakCurrent,
        audioRms: state.audioRms,
        audioPollCount: state.audioPollCount,
        audioWorkletAverageLoad: state.audioWorkletBlockCount > 0
            ? state.audioWorkletLoadSum / state.audioWorkletBlockCount
            : null,
        audioWorkletBlockCount: state.audioWorkletBlockCount,
        audioWorkletMaxLoad: state.audioWorkletMaxLoad,
        audioWorkletOverBudgetBlocks: state.audioWorkletOverBudgetBlocks,
        error: state.error,
        hasActiveTable: Boolean(state.latestRuntimeState?.hasActive),
        latestEffectiveFilterState: state.latestEffectiveFilterState,
        latestEffectiveRackState: state.latestEffectiveRackState,
        latestEffectiveWavetablePosition: state.latestEffectiveWavetablePosition,
        latestRuntimeState: state.latestRuntimeState,
        parameterValues: { ...state.parameterValues },
        phase: state.phase,
        persistedStateKeys: Object.keys(readBrowserPatchState()).sort(),
        silentHeldNotePollCount: state.silentHeldNotePollCount,
        started: state.started,
        usedJSHeapSize: performance.memory?.usedJSHeapSize ?? null,
    };
}

globalThis.__COSIMO_WEB_POC__ = {
    getSnapshot,
    noteOff(note = 60) {
        sendMIDI(0x80, note, 0);
        state.heldNotes.delete(note);
    },
    noteOn(note = 60, velocity = 100) {
        sendMIDI(0x90, note, velocity);
        state.heldNotes.add(note);
    },
    resetAudioMetrics() {
        state.audioPeak = 0;
        state.audioPeakCurrent = 0;
        state.audioRms = 0;
        state.audioPollCount = 0;
        state.audioWorkletBlockCount = 0;
        state.audioWorkletLoadSum = 0;
        state.audioWorkletMaxLoad = 0;
        state.audioWorkletOverBudgetBlocks = 0;
        state.silentHeldNotePollCount = 0;
    },
    sendEvent(endpointID, value) {
        if (!state.connection) throw new Error("Cosimo is not ready.");
        state.connection.sendEventOrValue(endpointID, value);
    },
    setParameter(endpointID, value) {
        if (!state.connection) throw new Error("Cosimo is not ready.");
        state.connection.sendEventOrValue(endpointID, value);
    },
    start: startAudio,
    storedState() {
        if (!state.connection) return Promise.reject(new Error("Cosimo is not ready."));
        return new Promise((resolve) => state.connection.requestFullStoredState(resolve));
    },
};

async function initialise() {
    const audioContext = new AudioContext();

    if (audioContext.state === "running") {
        await audioContext.suspend();
    }

    const connection = await patch.createAudioWorkletNodePatchConnection(
        audioContext,
        "cosimo-web-audio-worklet",
    );
    installBrowserPatchStatePersistence(connection);

    state.audioContext = audioContext;
    state.connection = connection;
    state.midiEndpointID = findEndpointID(connection, "midi in");

    connection.audioNode.port.addEventListener("message", (event) => {
        if (event.data?.type !== "cosimo-perf") return;
        const blockCount = Number(event.data.blockCount) || 0;
        const averageLoad = Number(event.data.averageLoad) || 0;
        state.audioWorkletBlockCount += blockCount;
        state.audioWorkletLoadSum += averageLoad * blockCount;
        state.audioWorkletMaxLoad = Math.max(state.audioWorkletMaxLoad, Number(event.data.maxLoad) || 0);
        state.audioWorkletOverBudgetBlocks += Number(event.data.overBudgetBlocks) || 0;
    });

    connection.addEndpointListener("runtimeState", (message) => {
        state.latestRuntimeState = message;
    });
    connection.addEndpointListener("effectiveFilterState", (message) => {
        state.latestEffectiveFilterState = endpointEvent(message);
    });
    connection.addEndpointListener("effectiveRackState", (message) => {
        state.latestEffectiveRackState = endpointEvent(message);
    });
    connection.addEndpointListener("effectiveWavetablePosition", (message) => {
        state.latestEffectiveWavetablePosition = endpointEvent(message);
    });
    for (const endpoint of connection.inputEndpoints) {
        if (endpoint.purpose !== "parameter") continue;
        connection.addParameterListener(endpoint.endpointID, (message) => {
            state.parameterValues[endpoint.endpointID] = Number(message?.value ?? message);
        });
        connection.requestParameterValue(endpoint.endpointID);
    }

    if (new URLSearchParams(globalThis.location.search).has("test")) {
        state.audioProbe = audioContext.createAnalyser();
        state.audioProbe.fftSize = 2048;
        state.audioProbeBuffer = new Float32Array(state.audioProbe.fftSize);
    }

    const view = await createPatchViewHolder(connection);

    if (!view) {
        throw new Error("Cmajor did not create Cosimo's custom patch view.");
    }

    elements.view.replaceChildren(view);
    state.phase = "ready";
    elements.startStatus.textContent = "WebAssembly engine ready";
    elements.startOverlay.disabled = false;
}

elements.startOverlay.addEventListener("click", () => {
    void startAudio().catch(showError);
});

globalThis.addEventListener("error", (event) => {
    showError(event.error ?? event.message);
});

void initialise().catch(showError);
