import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PluginStateClientResult } from "../../kit/ui/plugin-state-client";
import type { PluginStateHistoryEntry } from "../../kit/ui/plugin-state-session";
import type { createModulationStateClient } from "./modulation-client";

export type MsegStateOwner = {
    readonly client: Parameters<typeof createModulationStateClient>[0];
    readonly modulation: ReturnType<typeof createModulationStateClient>;
};
type Edit = () => void | Promise<PluginStateClientResult>;
type Gesture = {
    readonly owner: MsegStateOwner;
    readonly epoch: number;
    readonly ordinal: number;
    readonly selection: number;
    queued: Edit[];
    started: boolean;
    finishing: boolean;
    ended: boolean;
    start: Promise<void>;
    handle?: ReturnType<MsegStateOwner["modulation"]["startGesture"]>;
};
const absent = () => null;
const unsubscribe = () => () => {};

/** One editor checkpoint into the shared ledger, never a second shape history. */
export function useMsegEditorHistory(owner: MsegStateOwner | null, selection: number) {
    const snapshot = useSyncExternalStore(owner?.client.subscribe ?? unsubscribe, owner?.client.getSnapshot ?? absent, absent);
    const [checkpoint, setCheckpoint] = useState<{ entry: PluginStateHistoryEntry; selection: number }>();
    const entry = checkpoint?.entry;
    const epoch = useRef(0);
    const ordinal = useRef(0);
    const latestAccepted = useRef(0);
    const mounted = useRef(true);
    const active = useRef<Gesture | undefined>(undefined);
    const starting = useRef(Promise.resolve());
    const beginning = useRef<Gesture | undefined>(undefined);
    const remember = useCallback((group: Gesture, result: PluginStateClientResult | undefined) => {
        if (mounted.current && epoch.current === group.epoch && group.ordinal >= latestAccepted.current
            && result?.kind === "accepted" && result.historyEntry) {
            latestAccepted.current = group.ordinal;
            setCheckpoint({ entry: result.historyEntry, selection: group.selection });
        }
    }, []);
    const end = useCallback((group: Gesture, allowPending = false) => {
        if ((!group.started && !allowPending) || !group.handle || group.ended || !group.finishing) return;
        group.ended = true;
        // Queue the end immediately. A missing end receipt must not prevent the
        // next interaction or the shared owner's authenticated detach.
        void group.handle?.end().then(result => remember(group, result))
            .catch(error => console.error("MSEG gesture failed", error));
    }, [remember]);
    const finishGesture = useCallback((discardQueued = false) => {
        const group = active.current;
        const pending = beginning.current;
        if (discardQueued && pending && pending !== group) {
            pending.queued = [];
            pending.finishing = true;
            end(pending, true);
        }
        if (!group) return starting.current;
        active.current = undefined;
        if (discardQueued) group.queued = [];
        group.finishing = true;
        // Cancelled intents have nothing left to submit. The captured handle
        // can seal its accepted prefix even if the begin receipt never arrives.
        end(group, discardQueued);
        return group.start;
    }, [end]);
    const beginSession = useCallback(() => {
        void finishGesture(true);
        ++epoch.current;
        // Old continuations are epoch-guarded; a missing reply cannot hold the
        // new editor behind an already sealed interaction.
        starting.current = Promise.resolve();
        beginning.current = undefined;
        setCheckpoint(undefined);
    }, [finishGesture]);
    const scope = snapshot?.kind === "ready" ? snapshot.state.scope : undefined;
    useEffect(() => {
        mounted.current = true;
        beginSession();
        return () => { mounted.current = false; ++epoch.current; void finishGesture(true); };
    }, [owner, scope?.owner, scope?.document, beginSession, finishGesture]);
    const apply = useCallback((action: Edit) => {
        try { void Promise.resolve(action()).catch(error => console.error("MSEG edit failed", error)); }
        catch (error) { console.error("MSEG edit failed", error); }
    }, []);
    const edit = useCallback((action: Edit, grouped = false) => {
        if (!owner) return;
        let group = active.current;
        if (!group) {
            group = { owner, epoch: epoch.current, ordinal: ++ordinal.current, selection,
                queued: [], started: false, finishing: false, ended: false, start: Promise.resolve() };
            const created = group;
            active.current = created;
            created.start = starting.current.then(async () => {
                if (!mounted.current || created.epoch !== epoch.current) return;
                beginning.current = created;
                created.handle = created.owner.modulation.startGesture();
                const begun = await created.handle.ready;
                if (begun.kind !== "accepted") { created.queued = []; return; }
                created.started = true;
                if (mounted.current && created.epoch === epoch.current)
                    for (const queued of created.queued.splice(0)) apply(queued);
                else { created.queued = []; created.finishing = true; }
                end(created);
            }).catch(error => console.error("MSEG gesture failed", error)).finally(() => {
                if (beginning.current === created) beginning.current = undefined;
            });
            starting.current = created.start;
        }
        if (group.started) apply(action);
        else group.queued.push(action);
        if (!grouped) void finishGesture();
    }, [owner, selection, apply, end, finishGesture]);
    const history = snapshot?.kind === "ready" ? snapshot.state.history : undefined;
    const head = history?.undoEntry;
    const canUndo = entry !== undefined && checkpoint?.selection === selection && history?.canUndo === true && head !== undefined
        && head.id === entry.id && head.scope.owner === entry.scope.owner && head.scope.document === entry.scope.document;
    const undo = useCallback(() => {
        if (!owner || !entry) return;
        const session = epoch.current;
        const accepted = latestAccepted.current;
        void owner.client.dispatch({ kind: "undo", expectedEntry: entry }).then(result => {
            if (mounted.current && epoch.current === session && latestAccepted.current === accepted
                && result.kind === "accepted") setCheckpoint(undefined);
        }).catch(error => console.error("MSEG Undo failed", error));
    }, [owner, entry]);
    return { canUndo, edit, undo, beginSession, finishGesture };
}
