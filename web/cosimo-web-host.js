import * as patch from "./cmaj_Cosimo_Synth.js";
import { createPatchViewHolder } from "./cmaj_api/cmaj-patch-view.js";

globalThis.__COSIMO_DESKTOP_RUNTIME_KIND__ = "standalone";

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
    connection: null,
    error: null,
    latestEffectiveFilterState: null,
    latestEffectiveWavetablePosition: null,
    latestRuntimeState: null,
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

function findEndpointID(connection, purpose) {
    return connection.inputEndpoints.find((endpoint) => endpoint.purpose === purpose)?.endpointID ?? null;
}

function updateAudioPeak() {
    if (!state.audioProbe || !state.audioProbeBuffer) {
        return;
    }

    state.audioProbe.getFloatTimeDomainData(state.audioProbeBuffer);

    for (const sample of state.audioProbeBuffer) {
        state.audioPeak = Math.max(state.audioPeak, Math.abs(sample));
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
        audioPeak: state.audioPeak,
        error: state.error,
        hasActiveTable: Boolean(state.latestRuntimeState?.hasActive),
        latestEffectiveFilterState: state.latestEffectiveFilterState,
        latestEffectiveWavetablePosition: state.latestEffectiveWavetablePosition,
        latestRuntimeState: state.latestRuntimeState,
        phase: state.phase,
        started: state.started,
    };
}

globalThis.__COSIMO_WEB_POC__ = {
    getSnapshot,
    noteOff(note = 60) {
        sendMIDI(0x80, note, 0);
    },
    noteOn(note = 60, velocity = 100) {
        sendMIDI(0x90, note, velocity);
    },
    start: startAudio,
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

    state.audioContext = audioContext;
    state.connection = connection;
    state.midiEndpointID = findEndpointID(connection, "midi in");

    connection.addEndpointListener("runtimeState", (message) => {
        state.latestRuntimeState = message;
    });
    connection.addEndpointListener("effectiveFilterState", (message) => {
        state.latestEffectiveFilterState = endpointEvent(message);
    });
    connection.addEndpointListener("effectiveWavetablePosition", (message) => {
        state.latestEffectiveWavetablePosition = endpointEvent(message);
    });

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
