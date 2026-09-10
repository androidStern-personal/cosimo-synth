import type { createPluginStateClient, PluginStateClientResult } from "../../kit/ui/plugin-state-client";
import type { PluginStateStored } from "../../kit/ui/plugin-state-definition";
import { captureUserEditReporter } from "./user-edit-bus";
import {
    MODULATION_MSEG_SLOT_COUNT, MODULATION_STATE_KEY, clampModulationRouteAmount,
    normalizeRoute, normalizeRoutes, normalizeEnvelopeSlot, createDefaultRoute, createAvailableGeneratedRouteId, createDefaultModulationState,
    type ModulationState, type ModulationStateChangeKind, type GeneratedModulationRouteInput,
} from "./modulation";
import {
    addMsegPoint, deleteMsegPoint, moveMsegPoint, setMsegSegmentCurvePower,
    normalizeMsegShape, normalizeMsegPlayback, createDefaultMsegPlayback, MSEG_DEFAULT_DEPTH,
} from "./mseg";

type ModulationFields = { readonly "modulation.v6": PluginStateStored<ModulationState> };
type StateClient = Pick<ReturnType<typeof createPluginStateClient<ModulationFields>>, "getSnapshot" | "dispatch" | "subscribe">;

/** An accepted route insertion carries its captured identity; refused or interrupted work carries no identity claim. */
export type ModulationRouteEditResult = Exclude<PluginStateClientResult, { readonly kind: "accepted" }>
    | (Extract<PluginStateClientResult, { readonly kind: "accepted" }> & { readonly routeId: string });

/** A view projection of the shared modulation field; the injected client owns all editable data and history. */
export function createModulationStateClient(client: StateClient) {
    const selection = Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, () => 0 as 0 | 1);
    let nextGesture = 0;
    let gesture: number | undefined;
    let stopped = false;
    let stopping: Promise<PluginStateClientResult | undefined> | undefined;
    let submissionKind: ModulationStateChangeKind = "general";
    const listeners = new Set<(state: ModulationState | null, kind: ModulationStateChangeKind) => void>();
    const amountListeners = new Map<string, Set<(amount: number | null) => void>>();
    const field = () => {
        const snapshot = client.getSnapshot();
        return snapshot.kind === "ready" ? snapshot.state.fields[MODULATION_STATE_KEY] : undefined;
    };
    const getState = (): ModulationState | null => {
        const current = field();
        if (current && "value" in current) return current.value;
        // Preserve the existing cold-invalid display without inventing an
        // accepted value. Readiness and all edit eligibility still use the client.
        return current?.readiness.kind === "failed" && current.readiness.reason === "invalid-state"
            ? createDefaultModulationState() : null;
    };
    const isReady = () => !stopped && field()?.readiness.kind === "ready";
    const emit = (kind: ModulationStateChangeKind) => { for (const listener of listeners) listener(getState(), kind); };
    const getRouteAmount = (id: string): number | null => getState()?.routes.find(route => route.id === id)?.amount ?? null;
    const projection = () => {
        const state = getState();
        return {
            value: JSON.stringify(state),
            ready: isReady(),
        };
    };
    // Comparison keys and subscribed amounts are derived notification state.
    // Every read and edit above still obtains the bank from the shared client.
    let previousProjection = projection();
    const currentScope = () => {
        const snapshot = client.getSnapshot();
        return snapshot.kind === "ready" ? JSON.stringify(snapshot.state.scope) : null;
    };
    let observedScope = currentScope();
    const observedAmounts = new Map<string, number | null>();
    const removeClientListener = client.subscribe(() => {
        const scope = currentScope();
        if (scope !== observedScope) { gesture = undefined; observedScope = scope; }
        const next = projection();
        if (next.value === previousProjection.value && next.ready === previousProjection.ready) return;
        const kind = next.ready === previousProjection.ready ? submissionKind : "general";
        submissionKind = "general";
        previousProjection = next;
        emit(kind);
        for (const [id, subscribers] of amountListeners) {
            const amount = getRouteAmount(id);
            if (Object.is(observedAmounts.get(id), amount)) continue;
            observedAmounts.set(id, amount);
            for (const listener of subscribers) listener(amount);
        }
    });
    const unavailable = (): Promise<PluginStateClientResult> => Promise.resolve({ kind: "rejected", reason: "not-ready" });
    const slotIndex = (index: number) => Math.min(MODULATION_MSEG_SLOT_COUNT - 1, Math.max(0, Math.round(index)));
    const submitState = (value: unknown, kind: ModulationStateChangeKind): Promise<PluginStateClientResult> => {
        if (stopped) return unavailable();
        const previousKind = submissionKind;
        submissionKind = kind;
        try {
            const current = field();
            if (current?.readiness.kind === "failed" && current.readiness.reason === "invalid-state")
                return client.dispatch({ kind: "recover", key: MODULATION_STATE_KEY, value, expectedVersion: 0 });
            if (!isReady()) return unavailable();
            return client.dispatch({ kind: "edit", key: MODULATION_STATE_KEY, value, ...(gesture === undefined ? {} : { gesture }) });
        } finally { submissionKind = previousKind; }
    };
    const setState = (value: unknown) => submitState(value, "general");
    const replaceRoutes = (routes: unknown): Promise<PluginStateClientResult> => {
        const bank = getState();
        if (!bank || !isReady()) return unavailable();
        return setState({ ...bank, routes: normalizeRoutes(routes) });
    };
    const setRoute = (index: number, route: unknown): Promise<PluginStateClientResult> => {
        const bank = getState();
        if (!bank || !isReady() || !Number.isInteger(index) || !bank.routes[index]) return unavailable();
        const normalized = normalizeRoute(route, index);
        return replaceRoutes(bank.routes.map((current, currentIndex) => currentIndex === index ? normalized : current));
    };
    const addRoute = async (route: unknown): Promise<ModulationRouteEditResult> => {
        const bank = getState();
        if (!bank || !isReady()) return { kind: "rejected", reason: "not-ready" };
        const normalized = normalizeRoute(route, bank.routes.length);
        const result = await replaceRoutes([...bank.routes, normalized]);
        return result.kind === "accepted" ? { ...result, routeId: normalized.id } : result;
    };
    const addGeneratedRoute = (overrides: GeneratedModulationRouteInput): Promise<ModulationRouteEditResult> => {
        const bank = getState();
        if (!bank || !isReady()) return Promise.resolve({ kind: "rejected", reason: "not-ready" });
        return addRoute(createDefaultRoute({ ...overrides, id: createAvailableGeneratedRouteId(bank.routes) }));
    };
    const removeRoute = (index: number): Promise<PluginStateClientResult> => {
        const bank = getState();
        if (!bank || !isReady() || !Number.isInteger(index) || !bank.routes[index]) return unavailable();
        return replaceRoutes(bank.routes.filter((_route, currentIndex) => currentIndex !== index));
    };
    const setMsegSlotShape = (index: number, shapeIndex: number, shape: unknown): Promise<PluginStateClientResult> => {
        const bank = getState();
        if (!bank || !isReady() || !Number.isInteger(index) || index < 0 || index >= MODULATION_MSEG_SLOT_COUNT) return unavailable();
        const normalized = normalizeMsegShape(shape);
        const reporter = captureUserEditReporter();
        return setState({ ...bank, msegSlots: bank.msegSlots.map((slot, currentIndex) => currentIndex !== index ? slot
            : Math.round(Number(shapeIndex)) === 1 ? { ...slot, shapeB: normalized } : { ...slot, shapeA: normalized }) }).then(result => {
            if (result.kind === "accepted" && result.changed === true)
                reporter.parameterEdit({ endpointID: `msegShape.${index}.${shapeIndex}`, changed: true });
            return result;
        });
    };
    const setRouteAmountById = (id: string, value: number): Promise<PluginStateClientResult> => {
        const bank = getState();
        const route = bank?.routes.find(route => route.id === id);
        if (!bank || !route || !isReady()) return unavailable();
        const amount = clampModulationRouteAmount(route.targetKind, value);
        const reporter = captureUserEditReporter();
        return submitState({ ...bank, routes: bank.routes.map(current => current.id === id ? { ...current, amount } : current) }, "routeAmount").then(result => {
            if (result.kind === "accepted" && result.changed === true)
                reporter.parameterEdit({ endpointID: `modAmount.${id}`, changed: true });
            return result;
        });
    };
    const setRouteAmount = (index: number, value: number): Promise<PluginStateClientResult> => {
        const route = Number.isInteger(index) ? getState()?.routes[index] : undefined;
        return route ? setRouteAmountById(route.id, value) : unavailable();
    };
    const setEnvelope = (index: number, value: unknown): Promise<PluginStateClientResult> => {
        const bank = getState();
        if (!bank || !isReady() || !Number.isInteger(index) || !bank.envelopeSlots[index]) return unavailable();
        const envelope = normalizeEnvelopeSlot(value, index);
        return setState({ ...bank, envelopeSlots: bank.envelopeSlots.map((current, currentIndex) => currentIndex === index ? envelope : current) });
    };
    const setMsegSlotPlayback = (index: number, value: unknown): Promise<PluginStateClientResult> => {
        const bank = getState();
        if (!bank || !isReady() || !Number.isInteger(index) || index < 0 || index >= MODULATION_MSEG_SLOT_COUNT) return unavailable();
        const { rate: _parameterOwnedRate, ...playback } = normalizeMsegPlayback(value);
        return setState({ ...bank, msegSlots: bank.msegSlots.map((slot, currentIndex) => currentIndex === index ? { ...slot, playback } : slot) });
    };
    /** Await ready before editing; end is idempotent and can close only this interaction. */
    const startGesture = () => {
        if (!isReady() || gesture !== undefined) return {
            ready: !isReady() ? unavailable() : Promise.resolve<PluginStateClientResult>({ kind: "rejected", reason: "busy" }),
            end: (): Promise<PluginStateClientResult | undefined> => Promise.resolve(undefined),
        };
        const active = ++nextGesture;
        gesture = active;
        const ready = client.dispatch({ kind: "begin", key: MODULATION_STATE_KEY, gesture: active }).then(result => {
            if (result.kind !== "accepted" && gesture === active) gesture = undefined;
            return result;
        });
        let ended: Promise<PluginStateClientResult | undefined> | undefined;
        return { ready, end(): Promise<PluginStateClientResult | undefined> {
            if (!ended) {
                if (gesture !== active) ended = Promise.resolve(undefined);
                else {
                    gesture = undefined;
                    ended = client.dispatch({ kind: "end", key: MODULATION_STATE_KEY, gesture: active });
                }
            }
            return ended;
        } };
    };
    const beginGesture = (): Promise<PluginStateClientResult> => startGesture().ready;
    const endGesture = (): Promise<PluginStateClientResult | undefined> => {
        const active = gesture;
        gesture = undefined;
        return active === undefined ? Promise.resolve(undefined)
            : client.dispatch({ kind: "end", key: MODULATION_STATE_KEY, gesture: active });
    };
    const setMsegSlotEditShapeIndex = (index: number, shapeIndex: number): Promise<PluginStateClientResult | undefined> => {
        const normalizedIndex = slotIndex(index);
        const next = Math.round(Number(shapeIndex)) === 1 ? 1 : 0;
        if (stopped || selection[normalizedIndex] === next) return Promise.resolve(undefined);
        const ended = endGesture();
        selection[normalizedIndex] = next;
        emit("general");
        return ended;
    };
    const controllers = selection.map((_selected, index) => ({
        getState() {
            const bank = getState();
            if (!bank) return null;
            const slot = bank.msegSlots[index];
            if (!slot) return null;
            const editShapeIndex = selection[index] ?? 0;
            return { shape: editShapeIndex === 1 ? slot.shapeB : slot.shapeA,
                shapeA: slot.shapeA, shapeB: slot.shapeB, referenceShape: editShapeIndex === 1 ? slot.shapeA : slot.shapeB,
                editShapeIndex, playback: { ...slot.playback, rate: createDefaultMsegPlayback().rate }, depth: MSEG_DEFAULT_DEPTH };
        },
        setShape(shape: unknown) { return setMsegSlotShape(index, selection[index] ?? 0, shape); },
        setPlayback(playback: unknown) { return setMsegSlotPlayback(index, playback); },
        setEditShapeIndex(shapeIndex: number) { return setMsegSlotEditShapeIndex(index, shapeIndex); },
        addPoint(x: number, y: number) { const state = this.getState(); return state ? this.setShape(addMsegPoint(state.shape, x, y)) : unavailable(); },
        movePoint(pointIndex: number, x: number, y: number) { const state = this.getState(); return state ? this.setShape(moveMsegPoint(state.shape, pointIndex, x, y)) : unavailable(); },
        deletePoint(pointIndex: number) { const state = this.getState(); return state ? this.setShape(deleteMsegPoint(state.shape, pointIndex)) : unavailable(); },
        setSegmentCurvePower(segmentIndex: number, power: number) { const state = this.getState(); return state ? this.setShape(setMsegSegmentCurvePower(state.shape, segmentIndex, power)) : unavailable(); },
    }));
    return {
        getState, isReady, setState, setMsegSlotShape, setMsegSlotPlayback, beginGesture, endGesture, startGesture, getRouteAmount, setRouteAmountById,
        replaceRoutes, setRoute, addRoute, addGeneratedRoute, removeRoute, setRouteAmount, setEnvelope,
        subscribe(listener: (state: ModulationState | null, kind: ModulationStateChangeKind) => void) { listeners.add(listener); },
        unsubscribe(listener: (state: ModulationState | null, kind: ModulationStateChangeKind) => void) { listeners.delete(listener); },
        subscribeRouteAmount(id: string, listener: (amount: number | null) => void) {
            const subscribers = amountListeners.get(id) ?? new Set();
            subscribers.add(listener); amountListeners.set(id, subscribers);
            observedAmounts.set(id, getRouteAmount(id));
            return () => {
                subscribers.delete(listener);
                if (subscribers.size === 0) { amountListeners.delete(id); observedAmounts.delete(id); }
            };
        },
        getMsegSlotController(index: number) { return controllers[slotIndex(index)]; },
        getMsegSlotEditShapeIndex(index: number) { return selection[slotIndex(index)] ?? 0; },
        setMsegSlotEditShapeIndex,
        /** Seal this facade's gesture without stopping its shared client. */
        stop(): Promise<PluginStateClientResult | undefined> {
            if (!stopping) {
                stopping = endGesture(); stopped = true;
                removeClientListener(); listeners.clear(); amountListeners.clear(); observedAmounts.clear();
            }
            return stopping;
        },
    };
}
