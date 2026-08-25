import * as patch from "./cmaj_Cosimo_Synth.js";
import { createPatchViewHolder } from "./cmaj_api/cmaj-patch-view.js";
import {
    installBrowserPatchStatePersistence,
    readBrowserPatchState,
} from "./browser-patch-state.mjs";
import { createBrowserBounceBankStore } from "./bounce/browser-bank-store.mjs";
import { BOUNCE_STATE_KEY } from "./bounce/document.mjs";
import { createBounceRuntimeRestorer } from "./bounce/runtime-restorer.mjs";

globalThis.__COSIMO_DESKTOP_RUNTIME_KIND__ = "standalone";
globalThis.__COSIMO_VIDEO_BOUNCE_MODULE_URL__ = new URL("./video-bounce/index.js", import.meta.url).href;

const searchParameters = new URLSearchParams(globalThis.location.search);
const isTestMode = searchParameters.has("test");
const hostOwnsRuntimeLanes = isTestMode && searchParameters.get("runtime-owner") === "host";

if (hostOwnsRuntimeLanes) {
    patch.manifest.worker = "patch_gui/wavetable-test-worker.js";
}

const elements = {
    error: document.getElementById("cosimo-error"),
    startAction: document.getElementById("cosimo-start-action"),
    startOverlay: document.getElementById("cosimo-start-overlay"),
    startStatus: document.getElementById("cosimo-start-status"),
    view: document.getElementById("cosimo-view"),
};

const state = {
    audioContext: null,
    audioRecoveryAttemptCount: 0,
    audioRecoveryCycleActive: false,
    audioRecoveryCycleCount: 0,
    audioRecoveryLastReason: null,
    audioRecoveryNeeded: false,
    audioRecoveryPromise: null,
    audioProbe: null,
    audioProbeBuffer: null,
    audioConnected: false,
    audioPeak: 0,
    audioPeakCurrent: 0,
    audioRms: 0,
    audioPollCount: 0,
    audioWorkletBlockCount: 0,
    audioWorkletQuantizedLoadSum: 0,
    audioWorkletQuantizedMaxLoad: 0,
    audioWorkletQuantizedOverBudgetBlocks: 0,
    audioWorkletDefiniteDeadlineMissBlocks: 0,
    audioWorkletClockSource: null,
    audioWorkletProcessMultiplier: 1,
    audioWorkletCallbackGapBlocks: 0,
    audioWorkletMaxCallbackGapLoad: 0,
    audioWorkletFrameDiscontinuityBlocks: 0,
    audioWorkletMarkedEventCount: 0,
    audioWorkletEventAdjacentBlockCount: 0,
    audioWorkletEventAdjacentGapLoadSum: 0,
    audioWorkletEventAdjacentLateBlocks: 0,
    audioWorkletEventAdjacentMaxGapLoad: 0,
    audioWorkletEventAdjacentCoalescedEvents: 0,
    audioWorkletPerfEpoch: 0,
    audioWorkletAcknowledgedPerfEpoch: 0,
    audioWorkletRenderQuantumFrames: null,
    audioWorkletSampleRateHz: null,
    bounceRestore: { status: "idle", digest: null, error: null },
    bounceRestorer: null,
    bounceRestorePromise: null,
    heldNotes: new Set(),
    silentHeldNotePollCount: 0,
    connection: null,
    error: null,
    latestEffectiveFilterState: null,
    latestEffectiveRackState: null,
    latestEffectiveWavetablePosition: null,
    latestRuntimeInstallAck: null,
    latestRuntimeState: null,
    latestRuntimeStates: [null, null, null],
    modulationRejectedRouteCount: 0,
    parameterValues: {},
    midiEndpointID: null,
    phase: "initialising",
    started: false,
    startedVoiceIndices: new Set(),
    voiceArticulationStarts: [],
    runtimeInstallQueue: Promise.resolve(),
    runtimeInstallOwnedLanes: new Set(),
    runtimeInstallAckRevision: 0,
    runtimeSyncSerial: 10_000,
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

function showBounceRestoreState(restoreState) {
    if (restoreState.status === "error" && restoreState.error) {
        elements.error.dataset.kind = "bounce-restore";
        elements.error.textContent = [
            "Bounced source unavailable — oscillator fallback is active.",
            restoreState.error.message,
        ].join("\n\n");
        elements.error.style.display = "block";
        return;
    }

    if (elements.error.dataset.kind === "bounce-restore") {
        delete elements.error.dataset.kind;
        elements.error.textContent = "";
        elements.error.style.display = "none";
    }

    if (restoreState.status === "loading") {
        elements.startStatus.textContent = "Restoring bounced source…";
    }
}

function endpointEvent(message) {
    return message?.event ?? message;
}

function waitForRuntimeInstallAck(predicate, timeoutMilliseconds = 5_000) {
    const deadline = performance.now() + timeoutMilliseconds;
    return new Promise((resolve, reject) => {
        const poll = () => {
            const acknowledgement = state.latestRuntimeInstallAck;
            if (acknowledgement && predicate(acknowledgement, state.runtimeInstallAckRevision)) {
                resolve(acknowledgement);
                return;
            }
            if (performance.now() >= deadline) {
                reject(new Error("Timed out waiting for a runtime install acknowledgement."));
                return;
            }
            setTimeout(poll, 1);
        };
        poll();
    });
}

async function requestRuntimeInstallFrontier(dspSessionId) {
    state.runtimeSyncSerial += 1;
    const syncSerial = state.runtimeSyncSerial;
    const revisionFloor = state.runtimeInstallAckRevision;
    state.connection.sendEventOrValue("runtimeSyncRequest", syncSerial);
    return waitForRuntimeInstallAck((candidate, revision) => (
        revision > revisionFloor
        && candidate.dspSessionId === dspSessionId
        && candidate.syncSerial === syncSerial
    ));
}

async function claimRuntimeInstallLane(laneKind, dspSessionId) {
    const ownershipKey = `${dspSessionId}:${laneKind}`;
    if (state.runtimeInstallOwnedLanes.has(ownershipKey)) {
        return state.latestRuntimeInstallAck;
    }
    const acknowledgement = await requestRuntimeInstallFrontier(dspSessionId);
    state.runtimeInstallOwnedLanes.add(ownershipKey);
    return acknowledgement;
}

async function sendAcknowledgedRuntimeEvent(laneKind, endpointID, value) {
    if (!hostOwnsRuntimeLanes || !state.connection) {
        throw new Error("Acknowledged runtime test events require exclusive host lane ownership.");
    }

    const runtimeStateEvent = endpointEvent(state.latestRuntimeState);
    const runtimeState = runtimeStateEvent?.value ?? runtimeStateEvent;
    const dspSessionId = Math.trunc(Number(runtimeState?.dspSessionId) || 0);
    const acknowledgement = await claimRuntimeInstallLane(laneKind, dspSessionId);

    const deliverySerial = laneKind === "articulation"
        ? Math.min(0, Math.trunc(Number(acknowledgement.acceptedArticulationSerial) || 0)) - 1
        : Math.max(0, Math.trunc(Number(acknowledgement.acceptedModulationSerial) || 0)) + 1;
    const revisionFloor = state.runtimeInstallAckRevision;
    state.connection.sendEventOrValue(endpointID, {
        ...value,
        dspSessionId,
        deliverySerial,
    });
    const terminal = await waitForRuntimeInstallAck((candidate, revision) => (
        revision > revisionFloor
        && candidate.dspSessionId === dspSessionId
        && (candidate.rejectedSerial === deliverySerial
            || (laneKind === "articulation"
                ? candidate.acceptedArticulationSerial <= deliverySerial
                : candidate.acceptedModulationSerial >= deliverySerial))
    ));

    return {
        accepted: terminal.rejectedSerial !== deliverySerial && (laneKind === "articulation"
            ? terminal.acceptedArticulationSerial <= deliverySerial
            : terminal.acceptedModulationSerial >= deliverySerial),
        acknowledgement: { ...terminal },
        deliverySerial,
        dspSessionId,
    };
}

function enqueueAcknowledgedRuntimeEvent(laneKind, endpointID, value) {
    const operation = state.runtimeInstallQueue.then(() => (
        sendAcknowledgedRuntimeEvent(laneKind, endpointID, value)
    ));
    state.runtimeInstallQueue = operation.catch(() => {});
    return operation;
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

function midiChannel(value) {
    return Math.max(0, Math.min(15, Math.trunc(Number(value) || 0)));
}

function heldNoteKey(channel, note) {
    return `${midiChannel(channel)}:${Math.max(0, Math.min(127, Math.trunc(Number(note) || 0)))}`;
}

function markAudioRunning() {
    if (state.audioContext?.state !== "running") {
        return false;
    }

    state.started = true;
    state.phase = "running";
    elements.startOverlay.style.display = "none";
    return true;
}

function usePlaybackAudioSession() {
    try {
        if (navigator.audioSession) {
            navigator.audioSession.type = "playback";
        }
    } catch {
        // Playback mode is an optional Safari hint. Web Audio must remain usable
        // when a browser exposes the API but rejects the requested session type.
    }
}

function currentAudioSessionState() {
    try {
        return navigator.audioSession?.state ?? null;
    } catch {
        return null;
    }
}

function markAudioRecoveryNeeded(reason) {
    if (!state.started || !state.audioConnected || !state.audioContext) {
        return;
    }

    state.audioRecoveryNeeded = true;
    state.audioRecoveryLastReason = reason;
}

function beginAudioRecovery(reason, {
    forceRestart = false,
    resumePromise = null,
} = {}) {
    if (state.audioRecoveryPromise) {
        return state.audioRecoveryPromise;
    }

    const audioContext = state.audioContext;
    if (!state.started || !state.audioConnected || !audioContext) {
        return Promise.resolve(false);
    }
    if (audioContext.state === "closed") {
        showError(new Error("Cosimo's browser audio context was closed and cannot be recovered."));
        return Promise.resolve(false);
    }

    usePlaybackAudioSession();
    state.audioRecoveryAttemptCount += 1;
    state.audioRecoveryLastReason = reason;
    const restartRunningContext = forceRestart && audioContext.state === "running";

    const recovery = (async () => {
        state.audioRecoveryCycleActive = true;
        if (restartRunningContext) {
            // Safari can return from an interruption reporting `running` while
            // its render clock and output remain stalled. A lifecycle-marked
            // return therefore needs a real stop/start edge, not a state check.
            state.audioRecoveryCycleCount += 1;
            await audioContext.suspend();
        }

        await (resumePromise ?? audioContext.resume());
        const recovered = markAudioRunning();
        state.audioRecoveryNeeded = !recovered;
        return recovered;
    })().catch((error) => {
        state.audioRecoveryNeeded = true;
        // Autoplay policy may require the next trusted gesture. Keep the live
        // instrument exposed so that gesture can both recover and play/edit;
        // only a permanently closed context is an unrecoverable host failure.
        if (audioContext.state === "closed") {
            showError(error);
        }
        return false;
    }).finally(() => {
        state.audioRecoveryCycleActive = false;
        if (state.audioRecoveryPromise === recovery) {
            state.audioRecoveryPromise = null;
        }
    });
    state.audioRecoveryPromise = recovery;
    return recovery;
}

function requestAutomaticAudioRecovery(reason) {
    const audioContext = state.audioContext;
    if (!state.started || !state.audioConnected || !audioContext) {
        return;
    }
    if (document.hidden || currentAudioSessionState() === "interrupted") {
        return;
    }
    if (!state.audioRecoveryNeeded && audioContext.state === "running") {
        return;
    }

    void beginAudioRecovery(reason, {
        forceRestart: state.audioRecoveryNeeded && audioContext.state === "running",
    });
}

function requestAudioResumeFromGesture() {
    const audioContext = state.audioContext;
    if (!state.audioConnected || !audioContext) {
        return;
    }
    if (!state.audioRecoveryNeeded && audioContext.state === "running") {
        return;
    }

    usePlaybackAudioSession();
    if (audioContext.state !== "running") {
        // Keep resume() inside the trusted event task. The keyboard/control's
        // own handler still receives this same event and is never replaced by
        // a separate recovery overlay tap.
        const resumePromise = audioContext.resume();
        void beginAudioRecovery("gesture", { resumePromise });
        return;
    }

    // A running-but-stalled context needs the same edge-triggered recovery as
    // an automatic page return. The action event continues while the held note
    // or control write waits for the render clock to restart.
    void audioContext.resume().catch(() => {});
    void beginAudioRecovery("gesture-running-context", { forceRestart: true });
}

function handleAudioContextStateChange() {
    if (!state.started || !state.audioConnected || state.audioRecoveryCycleActive) {
        return;
    }

    if (state.audioContext?.state !== "running") {
        markAudioRecoveryNeeded("audio-context-statechange");
    }
    requestAutomaticAudioRecovery("audio-context-statechange");
}

function handleAudioSessionStateChange() {
    if (currentAudioSessionState() === "interrupted") {
        markAudioRecoveryNeeded("audio-session-interrupted");
        return;
    }
    requestAutomaticAudioRecovery("audio-session-statechange");
}

function handlePageLeave(reason) {
    markAudioRecoveryNeeded(reason);
}

function handlePageReturn(reason) {
    requestAutomaticAudioRecovery(reason);
}

async function startAudio() {
    if (state.started && state.audioContext?.state === "running") {
        return;
    }

    if (!state.connection || !state.audioContext) {
        throw new Error("Cosimo's audio engine is not ready.");
    }

    elements.startOverlay.disabled = true;
    elements.startStatus.textContent = "Starting audio…";

    // A synth is intentional media playback. iOS's default ambient session is
    // muted by the hardware silent switch even while Web Audio is running.
    usePlaybackAudioSession();

    // Safari requires resume() to be requested synchronously inside the user's
    // activation. Do this before yielding to any graph-connection work.
    const resumePromise = state.audioContext.resume();

    if (!state.audioConnected) {
        await state.connection.connectDefaultAudioAndMIDI(state.audioContext);

        if (state.audioProbe) {
            state.connection.audioNode.disconnect();
            state.connection.audioNode.connect(state.audioProbe);
            state.audioProbe.connect(state.audioContext.destination);
        }

        state.audioConnected = true;
    }

    await resumePromise;

    if (state.bounceRestorer) {
        state.bounceRestorer.start();
        state.bounceRestorePromise ??= state.bounceRestorer.restore(
            readBrowserPatchState().sound.storedState[BOUNCE_STATE_KEY] ?? null,
        ).finally(() => {
            state.bounceRestorePromise = null;
        });
        await state.bounceRestorePromise;
    }

    if (!markAudioRunning()) {
        elements.startOverlay.style.display = "";
        elements.startOverlay.disabled = false;
        elements.startStatus.textContent = "Tap to resume audio";
    }
}

function getSnapshot() {
    updateAudioPeak();

    return {
        audioConnected: state.audioConnected,
        audioContextState: state.audioContext?.state ?? null,
        audioRecoveryAttemptCount: state.audioRecoveryAttemptCount,
        audioRecoveryCycleCount: state.audioRecoveryCycleCount,
        audioRecoveryLastReason: state.audioRecoveryLastReason,
        audioRecoveryNeeded: state.audioRecoveryNeeded,
        audioSessionState: currentAudioSessionState(),
        audioSessionType: navigator.audioSession?.type ?? null,
        audioBaseLatency: state.audioContext?.baseLatency ?? null,
        audioOutputLatency: state.audioContext?.outputLatency ?? null,
        audioPeak: state.audioPeak,
        audioPeakCurrent: state.audioPeakCurrent,
        audioRms: state.audioRms,
        audioPollCount: state.audioPollCount,
        audioWorkletQuantizedAverageLoad: state.audioWorkletBlockCount > 0
            ? state.audioWorkletQuantizedLoadSum / state.audioWorkletBlockCount
            : null,
        audioWorkletBlockCount: state.audioWorkletBlockCount,
        audioWorkletQuantizedMaxLoad: state.audioWorkletQuantizedMaxLoad,
        audioWorkletQuantizedOverBudgetBlocks: state.audioWorkletQuantizedOverBudgetBlocks,
        audioWorkletDefiniteDeadlineMissBlocks: state.audioWorkletDefiniteDeadlineMissBlocks,
        audioWorkletClockSource: state.audioWorkletClockSource,
        audioWorkletProcessMultiplier: state.audioWorkletProcessMultiplier,
        audioWorkletCallbackGapBlocks: state.audioWorkletCallbackGapBlocks,
        audioWorkletMaxCallbackGapLoad: state.audioWorkletMaxCallbackGapLoad,
        audioWorkletFrameDiscontinuityBlocks: state.audioWorkletFrameDiscontinuityBlocks,
        audioWorkletMarkedEventCount: state.audioWorkletMarkedEventCount,
        audioWorkletEventAdjacentBlockCount: state.audioWorkletEventAdjacentBlockCount,
        audioWorkletEventAdjacentAverageGapLoad: state.audioWorkletEventAdjacentBlockCount > 0
            ? state.audioWorkletEventAdjacentGapLoadSum / state.audioWorkletEventAdjacentBlockCount
            : 0,
        audioWorkletEventAdjacentLateBlocks: state.audioWorkletEventAdjacentLateBlocks,
        audioWorkletEventAdjacentLateRate: state.audioWorkletEventAdjacentBlockCount > 0
            ? state.audioWorkletEventAdjacentLateBlocks / state.audioWorkletEventAdjacentBlockCount
            : 0,
        audioWorkletEventAdjacentMaxGapLoad: state.audioWorkletEventAdjacentMaxGapLoad,
        audioWorkletEventAdjacentCoalescedEvents: state.audioWorkletEventAdjacentCoalescedEvents,
        audioWorkletPerfEpoch: state.audioWorkletPerfEpoch,
        audioWorkletAcknowledgedPerfEpoch: state.audioWorkletAcknowledgedPerfEpoch,
        audioWorkletRenderQuantumFrames: state.audioWorkletRenderQuantumFrames,
        audioWorkletSampleRateHz: state.audioWorkletSampleRateHz ?? state.audioContext?.sampleRate ?? null,
        bounceRestore: {
            ...state.bounceRestore,
            error: state.bounceRestore.error
                ? { code: state.bounceRestore.error.code, message: state.bounceRestore.error.message }
                : null,
        },
        error: state.error,
        hasActiveTable: state.latestRuntimeStates.every((runtimeState) => Boolean(runtimeState?.hasActive)),
        latestEffectiveFilterState: state.latestEffectiveFilterState,
        latestEffectiveRackState: state.latestEffectiveRackState,
        latestEffectiveWavetablePosition: state.latestEffectiveWavetablePosition,
        latestRuntimeInstallAck: state.latestRuntimeInstallAck
            ? { ...state.latestRuntimeInstallAck }
            : null,
        latestRuntimeState: state.latestRuntimeState,
        latestRuntimeStates: state.latestRuntimeStates.map((runtimeState) => (
            runtimeState ? { ...runtimeState } : null
        )),
        modulationRejectedRouteCount: state.modulationRejectedRouteCount,
        parameterValues: { ...state.parameterValues },
        phase: state.phase,
        persistedStateKeys: [
            ...Object.keys(readBrowserPatchState().sound.storedState),
            ...Object.keys(readBrowserPatchState().auxiliary),
        ].sort(),
        silentHeldNotePollCount: state.silentHeldNotePollCount,
        heldNoteCount: state.heldNotes.size,
        started: state.started,
        startedVoiceIndices: [...state.startedVoiceIndices].sort((left, right) => left - right),
        voiceArticulationStarts: state.voiceArticulationStarts.map((event) => ({ ...event })),
        usedJSHeapSize: performance.memory?.usedJSHeapSize ?? null,
    };
}

globalThis.__COSIMO_WEB_POC__ = {
    getSnapshot,
    noteOff(note = 60, channel = 0) {
        const nextChannel = midiChannel(channel);
        sendMIDI(0x80 | nextChannel, note, 0);
        state.heldNotes.delete(heldNoteKey(nextChannel, note));
    },
    noteOn(note = 60, velocity = 100, channel = 0) {
        const nextChannel = midiChannel(channel);
        sendMIDI(0x90 | nextChannel, note, velocity);
        state.heldNotes.add(heldNoteKey(nextChannel, note));
    },
    setMpeSlideForTest(value = 0, channel = 1) {
        if (!isTestMode) {
            throw new Error("MPE slide injection is only exposed in test mode.");
        }
        const nextChannel = midiChannel(channel);
        const controllerValue = Math.max(0, Math.min(127, Math.round(Number(value) * 127)));
        sendMIDI(0xb0 | nextChannel, 74, controllerValue);
    },
    setMpePressureForTest(value = 0, channel = 1) {
        if (!isTestMode) {
            throw new Error("MPE pressure injection is only exposed in test mode.");
        }
        const nextChannel = midiChannel(channel);
        const pressureValue = Math.max(0, Math.min(127, Math.round(Number(value) * 127)));
        sendMIDI(0xd0 | nextChannel, pressureValue);
    },
    runtimeInstallAckForTest() {
        if (!isTestMode) {
            throw new Error("Runtime acknowledgements are only exposed in test mode.");
        }
        return state.latestRuntimeInstallAck ? { ...state.latestRuntimeInstallAck } : null;
    },
    resetAudioMetrics() {
        state.audioWorkletPerfEpoch += 1;
        state.audioPeak = 0;
        state.audioPeakCurrent = 0;
        state.audioRms = 0;
        state.audioPollCount = 0;
        state.audioWorkletBlockCount = 0;
        state.audioWorkletQuantizedLoadSum = 0;
        state.audioWorkletQuantizedMaxLoad = 0;
        state.audioWorkletQuantizedOverBudgetBlocks = 0;
        state.audioWorkletDefiniteDeadlineMissBlocks = 0;
        state.audioWorkletClockSource = null;
        state.audioWorkletCallbackGapBlocks = 0;
        state.audioWorkletMaxCallbackGapLoad = 0;
        state.audioWorkletFrameDiscontinuityBlocks = 0;
        state.audioWorkletMarkedEventCount = 0;
        state.audioWorkletEventAdjacentBlockCount = 0;
        state.audioWorkletEventAdjacentGapLoadSum = 0;
        state.audioWorkletEventAdjacentLateBlocks = 0;
        state.audioWorkletEventAdjacentMaxGapLoad = 0;
        state.audioWorkletEventAdjacentCoalescedEvents = 0;
        state.silentHeldNotePollCount = 0;
        state.connection?.audioNode?.port?.postMessage({
            type: "patch",
            payload: { type: "cosimo-perf-reset", epoch: state.audioWorkletPerfEpoch },
        });
        return state.audioWorkletPerfEpoch;
    },
    sendEvent(endpointID, value) {
        if (!state.connection) throw new Error("Cosimo is not ready.");
        state.connection.sendEventOrValue(endpointID, value);
    },
    sendAcknowledgedRuntimeEvent(laneKind, endpointID, value) {
        return enqueueAcknowledgedRuntimeEvent(laneKind, endpointID, value);
    },
    sendPerfGapProbe() {
        if (!isTestMode || !state.connection?.audioNode?.port) {
            throw new Error("Performance gap probes are only available in test mode.");
        }
        state.connection.audioNode.port.postMessage({
            type: "patch",
            payload: { type: "cosimo-perf-gap-probe" },
        });
    },
    setPerfProcessMultiplier(multiplier) {
        if (!isTestMode || !state.connection?.audioNode?.port) {
            throw new Error("Performance load amplification is only available in test mode.");
        }
        state.connection.audioNode.port.postMessage({
            type: "patch",
            payload: { type: "cosimo-perf-process-multiplier", multiplier },
        });
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
    const audioContext = new AudioContext(isTestMode
        ? { latencyHint: "interactive", sampleRate: 48_000 }
        : undefined);

    if (audioContext.state === "running") {
        await audioContext.suspend();
    }

    const connection = await patch.createAudioWorkletNodePatchConnection(
        audioContext,
        "cosimo-web-audio-worklet",
    );
    const persistence = installBrowserPatchStatePersistence(connection, {
        // The engine stays on its safe oscillator default until the referenced
        // OPFS bank has been verified and committed after audio starts.
        deferParameterRestore: (endpointID, value, browserState) => (
            endpointID === "sourceMode"
            && value === 1
            && browserState.sound.storedState[BOUNCE_STATE_KEY] != null
        ),
    });
    const bounceRestorer = createBounceRuntimeRestorer({
        connection,
        store: createBrowserBounceBankStore(),
        sendRuntimeSourceMode: (value) => persistence.sendRuntimeEventOrValue("sourceMode", value, 0, 0),
    });
    connection.acceptCommittedBounceDocument = (value) => (
        bounceRestorer.acceptCommittedDocument(value)
    );
    bounceRestorer.subscribe((restoreState) => {
        state.bounceRestore = restoreState;
        showBounceRestoreState(restoreState);
    });
    state.bounceRestorer = bounceRestorer;
    const initialBounceValue = persistence.browserState.sound.storedState[BOUNCE_STATE_KEY] ?? null;
    if (initialBounceValue === null) {
        await bounceRestorer.restore(null);
    } else {
        state.bounceRestore = {
            status: "pending-audio-start",
            digest: null,
            error: null,
        };
    }

    state.audioContext = audioContext;
    state.connection = connection;
    state.midiEndpointID = findEndpointID(connection, "midi in");
    audioContext.addEventListener("statechange", handleAudioContextStateChange);

    if (isTestMode) {
        connection.audioNode.port.addEventListener("message", (event) => {
            if (event.data?.type === "cosimo-perf-reset-ack") {
                const epoch = Number(event.data.epoch) || 0;
                if (epoch === state.audioWorkletPerfEpoch) {
                    state.audioWorkletAcknowledgedPerfEpoch = epoch;
                    state.audioWorkletSampleRateHz = Number(event.data.sampleRateHz) || state.audioContext?.sampleRate || null;
                }
                return;
            }
            if (event.data?.type === "cosimo-perf-process-multiplier-ack") {
                state.audioWorkletProcessMultiplier = Number(event.data.multiplier) || 1;
                return;
            }
            if (event.data?.type !== "cosimo-perf") return;
            if ((Number(event.data.epoch) || 0) !== state.audioWorkletPerfEpoch) return;
            const blockCount = Number(event.data.blockCount) || 0;
            const averageLoad = Number(event.data.quantizedAverageLoad) || 0;
            state.audioWorkletBlockCount += blockCount;
            state.audioWorkletQuantizedLoadSum += averageLoad * blockCount;
            state.audioWorkletQuantizedMaxLoad = Math.max(
                state.audioWorkletQuantizedMaxLoad,
                Number(event.data.quantizedMaxLoad) || 0,
            );
            state.audioWorkletQuantizedOverBudgetBlocks += Number(event.data.quantizedOverBudgetBlocks) || 0;
            state.audioWorkletDefiniteDeadlineMissBlocks += Number(event.data.definiteDeadlineMissBlocks) || 0;
            state.audioWorkletClockSource = typeof event.data.clockSource === "string"
                ? event.data.clockSource
                : null;
            state.audioWorkletProcessMultiplier = Number(event.data.processMultiplier) || 1;
            state.audioWorkletCallbackGapBlocks += Number(event.data.callbackGapBlocks) || 0;
            state.audioWorkletMaxCallbackGapLoad = Math.max(
                state.audioWorkletMaxCallbackGapLoad,
                Number(event.data.maxCallbackGapLoad) || 0,
            );
            state.audioWorkletFrameDiscontinuityBlocks += Number(event.data.frameDiscontinuityBlocks) || 0;
            state.audioWorkletMarkedEventCount += Number(event.data.markedEventCount) || 0;
            state.audioWorkletEventAdjacentBlockCount += Number(event.data.eventAdjacentBlockCount) || 0;
            state.audioWorkletEventAdjacentGapLoadSum += Number(event.data.eventAdjacentGapLoadSum) || 0;
            state.audioWorkletEventAdjacentLateBlocks += Number(event.data.eventAdjacentLateBlocks) || 0;
            state.audioWorkletEventAdjacentMaxGapLoad = Math.max(
                state.audioWorkletEventAdjacentMaxGapLoad,
                Number(event.data.eventAdjacentMaxGapLoad) || 0,
            );
            state.audioWorkletEventAdjacentCoalescedEvents += Number(event.data.eventAdjacentCoalescedEvents) || 0;
            state.audioWorkletRenderQuantumFrames = Number(event.data.renderQuantumFrames) || null;
            state.audioWorkletSampleRateHz = Number(event.data.sampleRateHz) || state.audioContext?.sampleRate || null;
        });
        connection.audioNode.port.postMessage({
            type: "patch",
            payload: { type: "cosimo-perf-config", enabled: true, epoch: state.audioWorkletPerfEpoch },
        });

        connection.addEndpointListener("runtimeState", (message) => {
            state.latestRuntimeState = message;
            const event = endpointEvent(message);
            const runtimeState = event?.value ?? event;
            const oscillatorIndex = Math.trunc(Number(runtimeState?.oscillatorIndex));
            if (oscillatorIndex >= 0 && oscillatorIndex < state.latestRuntimeStates.length) {
                state.latestRuntimeStates[oscillatorIndex] = runtimeState;
            }
        });
        connection.addEndpointListener("runtimeInstallAck", (message) => {
            const event = endpointEvent(message);
            state.latestRuntimeInstallAck = event?.value ?? event;
            state.runtimeInstallAckRevision += 1;
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
        connection.addEndpointListener("voiceArticulationStart", (message) => {
            const monitor = endpointEvent(message);
            const voiceIndex = Number(monitor?.voiceIndex);
            if (Number.isInteger(voiceIndex) && voiceIndex >= 0) {
                state.startedVoiceIndices.add(voiceIndex);
                state.voiceArticulationStarts.push({
                    voiceIndex,
                    hasArticulation: Number(monitor?.hasArticulation) || 0,
                    selectorA: Number(monitor?.selectorA),
                    route1Amount: Number(monitor?.route1Amount) || 0,
                });
            }
        });
        connection.addEndpointListener("modulationRejectedRouteCount", (message) => {
            state.modulationRejectedRouteCount = Number(message?.value ?? message) || 0;
        });
        for (const endpoint of connection.inputEndpoints) {
            if (endpoint.purpose !== "parameter") continue;
            connection.addParameterListener(endpoint.endpointID, (message) => {
                state.parameterValues[endpoint.endpointID] = Number(message?.value ?? message);
            });
            connection.requestParameterValue(endpoint.endpointID);
        }

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

document.addEventListener("pointerdown", requestAudioResumeFromGesture, { capture: true, passive: true });
document.addEventListener("touchstart", requestAudioResumeFromGesture, { capture: true, passive: true });
document.addEventListener("visibilitychange", () => {
    if (document.hidden) handlePageLeave("visibility-hidden");
    else handlePageReturn("visibility-visible");
});
globalThis.addEventListener("blur", () => handlePageLeave("window-blur"));
globalThis.addEventListener("focus", () => handlePageReturn("window-focus"));
globalThis.addEventListener("pagehide", () => handlePageLeave("pagehide"));
globalThis.addEventListener("pageshow", () => handlePageReturn("pageshow"));
navigator.audioSession?.addEventListener?.("statechange", handleAudioSessionStateChange);

globalThis.addEventListener("error", (event) => {
    showError(event.error ?? event.message);
});

void initialise().catch(showError);
