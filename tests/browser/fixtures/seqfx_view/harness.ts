// Mounts the real SeqFX view on the kit's browser state owner, with a stand-in
// Cmajor host that records what the view asks of it. The pattern the DSP would
// receive is prepared by SeqFX's own state declaration whenever the saved patterns
// or the selected pattern change.
import { createBrowserPreviewState } from "../../../../kit/ui/preview/state";
import definition from "../../../../fx/seqfx/state";
import createPatchView from "../../../../fx/seqfx/view/source";

type Listener = (value: unknown) => void;
type Recorded = { endpointID: string; value: unknown };

const parameterRanges: Record<string, { min: number; max: number; step: number; defaultValue: number }> = {
    enabled: { min: 0, max: 1, step: 1, defaultValue: 1 },
    globalMix: { min: 0, max: 1, step: 0, defaultValue: 1 },
    patternSelect: { min: 0, max: 11, step: 1, defaultValue: 0 },
    clockMode: { min: 0, max: 2, step: 1, defaultValue: 0 },
    manualBpm: { min: 20, max: 300, step: 0, defaultValue: 120 },
    rate: { min: 0, max: 2, step: 1, defaultValue: 1 },
    swing: { min: 0, max: 0.45, step: 0, defaultValue: 0 },
    loopStart: { min: 0, max: 31, step: 1, defaultValue: 0 },
    loopLength: { min: 1, max: 32, step: 1, defaultValue: 32 },
};

export function mountSeqFxHarness(root: HTMLElement, savedState: Record<string, unknown> = {}) {
    const parameters: Record<string, number> = Object.fromEntries(
        Object.entries(parameterRanges).map(([endpoint, range]) => [endpoint, range.defaultValue]),
    );
    const storedState: Record<string, unknown> = { ...savedState };
    let events: Recorded[] = [];
    let gestureStarts: string[] = [];
    let gestureEnds: string[] = [];
    let storedStateWrites: { key: string; value: unknown }[] = [];
    const parameterListeners = new Map<string, Set<Listener>>();
    const endpointListeners = new Map<string, Set<Listener>>();
    const patternsField = definition.patterns;
    if (patternsField.engine?.kind !== "prepared") {
        throw new Error("SeqFX's patterns are expected to prepare a pattern upload.");
    }
    const preparePatternUpload = patternsField.engine.prepare;

    const notifyParameter = (endpointID: string, value: number) => {
        parameters[endpointID] = value;
        for (const listener of parameterListeners.get(endpointID) ?? []) listener(value);
    };

    /** The selected pattern as SeqFX's declaration prepares it for the DSP. */
    const recordPatternUpload = async () => {
        const parsed = patternsField.codec.parse(storedState["patterns"] ?? patternsField.codec.encode(createDefault()));
        if (parsed.kind !== "ok") return;
        const prepared = await preparePatternUpload(parsed.value, {
            resources: undefined as never,
            parameters: { selectedPattern: parameters["patternSelect"] ?? 0 },
            reason: "edit",
            signal: { aborted: false, onAbort: () => () => {} } as never,
        });
        if ("content" in prepared) events.push({ endpointID: "patternUpload", value: prepared.content });
    };
    const createDefault = () => {
        if (patternsField.initial.kind !== "ok") throw new Error("SeqFX's initial patterns are invalid.");
        return patternsField.initial.value;
    };

    const stateHost = createBrowserPreviewState({
        snapshot: () => ({
            values: { ...storedState },
            parameters: Object.entries(parameterRanges).map(([endpoint, range]) => ({ endpoint, value: parameters[endpoint] ?? range.defaultValue, ...range })),
        }),
        parameter(endpoint, value) {
            events.push({ endpointID: endpoint, value });
            notifyParameter(endpoint, value);
            if (endpoint === "patternSelect") void recordPatternUpload();
        },
        stored(key, value) {
            storedState[key] = value;
            storedStateWrites.push({ key, value });
            if (key === "patterns") void recordPatternUpload();
        },
        gesture(endpoint, kind) {
            (kind === "gesture-start" ? gestureStarts : gestureEnds).push(endpoint);
        },
    });

    const patchConnection = {
        ...stateHost.host,
        manifest: { ID: "dev.cosimo.seqfx", view: { width: 1120, height: 680 } },
        addParameterListener(endpointID: string, listener: Listener) {
            const listeners = parameterListeners.get(endpointID) ?? new Set<Listener>();
            listeners.add(listener);
            parameterListeners.set(endpointID, listeners);
        },
        removeParameterListener(endpointID: string, listener: Listener) { parameterListeners.get(endpointID)?.delete(listener); },
        requestParameterValue(endpointID: string) { notifyParameter(endpointID, parameters[endpointID] ?? 0); },
        sendEventOrValue(endpointID: string, value: unknown) { events.push({ endpointID, value }); },
        sendParameterGestureStart(endpointID: string) { gestureStarts.push(endpointID); },
        sendParameterGestureEnd(endpointID: string) { gestureEnds.push(endpointID); },
        addEndpointListener(endpointID: string, listener: Listener) {
            const listeners = endpointListeners.get(endpointID) ?? new Set<Listener>();
            listeners.add(listener);
            endpointListeners.set(endpointID, listeners);
        },
        removeEndpointListener(endpointID: string, listener: Listener) { endpointListeners.get(endpointID)?.delete(listener); },
        addStatusListener() {},
        removeStatusListener() {},
        requestStatusUpdate() {},
    };

    void recordPatternUpload();
    root.appendChild(createPatchView(patchConnection as unknown as Parameters<typeof createPatchView>[0]));

    return {
        getSnapshot: () => ({
            events: [...events],
            gestureStarts: [...gestureStarts],
            gestureEnds: [...gestureEnds],
            storedStateWrites: [...storedStateWrites],
            storedState: { ...storedState },
            parameters: { ...parameters },
        }),
        clearEvents() {
            events = [];
            gestureStarts = [];
            gestureEnds = [];
            storedStateWrites = [];
        },
        /** Host automation or another editor moving a parameter. */
        emitParameter(endpointID: string, value: number) {
            notifyParameter(endpointID, value);
            stateHost.observe(endpointID, value);
            if (endpointID === "patternSelect") void recordPatternUpload();
        },
        /** The host loading a project whose saved value for one key differs. */
        loadStoredValue(key: string, value: unknown) {
            storedState[key] = value;
            stateHost.replace(key);
            if (key === "patterns") void recordPatternUpload();
        },
        /** The DSP sending an output event, such as a `monitorOut` frame. */
        emitEndpoint(endpointID: string, value: unknown) {
            for (const listener of endpointListeners.get(endpointID) ?? []) listener(value);
        },
        emitMonitor(stepIndex: number) {
            for (const listener of endpointListeners.get("monitorOut") ?? []) {
                listener({
                    patternIndex: parameters["patternSelect"] ?? 0,
                    stepIndex,
                    transportRunning: true,
                    stepProgress: 0,
                    auxCyclePhase: [0, 0, 0, 0],
                    auxAmount: [0, 0, 0, 0],
                    auxDurationMs: [0, 0, 0, 0],
                });
            }
        },
    };
}
