import { atom, createStore } from "jotai/vanilla";
import { isBoundedStateJson, parseHistoryEntry } from "./plugin-state-protocol";
import type { PluginStateFields } from "./plugin-state-definition";
import type {
    PluginStateCommand, PluginStateResult, PluginStateScope, PluginStateSnapshot,
    PluginStateFieldSnapshot, PluginStateReceipt,
} from "./plugin-state-session";

/** Platform adapter input after envelope, snapshot, and domain-codec validation. */
export type PluginStateClientEvent<Fields extends PluginStateFields> =
    | { readonly kind: "attached"; readonly request: number; readonly scope: PluginStateScope; readonly client: number; readonly revision: number; readonly state: PluginStateSnapshot<Fields> }
    | { readonly kind: "update"; readonly scope: PluginStateScope; readonly revision: number; readonly state: PluginStateSnapshot<Fields>; readonly receipt?: PluginStateReceipt }
    | { readonly kind: "receipt"; readonly address: PluginStateReceipt["address"]; readonly result: PluginStateResult }
    | { readonly kind: "reset" | "owner-changed"; readonly scope: PluginStateScope }
    | { readonly kind: "closed"; readonly reason: string }
    | { readonly kind: "attach-failed"; readonly request: number; readonly reason: string };

/** Commands echo the assigned client incarnation as a stale-binding guard; native routing owns identity. */
export type PluginStateClientMessage =
    | { readonly kind: "attach"; readonly request: number }
    | { readonly kind: "command"; readonly scope: PluginStateScope; readonly client: number; readonly sequence: number; readonly command: PluginStateCommand };

/** The platform adapter owns parsing and routing; the client owns local drafts. */
export interface PluginStateClientChannel<Fields extends PluginStateFields> {
    subscribe(listener: (message: PluginStateClientEvent<Fields>) => void): () => void;
    send(message: PluginStateClientMessage): void;
}

/** A sent command without a reply has unknown acceptance after reset/closure. */
export type PluginStateClientResult = PluginStateResult
    | { readonly kind: "interrupted"; readonly reason: "reset" | "closed"; readonly acceptance: "unknown" };

/** A disconnected view never masquerades as a ready plugin with default values. */
export type PluginStateClientSnapshot<Fields extends PluginStateFields> =
    | { readonly kind: "connecting" }
    | { readonly kind: "ready"; readonly client: number; readonly state: PluginStateSnapshot<Fields>; readonly pendingFields: readonly string[] }
    | { readonly kind: "closed" }
    | { readonly kind: "failed"; readonly reason: string };

function sameScope(a: PluginStateScope | null, b: PluginStateScope): boolean {
    return a !== null && a.owner === b.owner && a.document === b.document;
}

/** Own one GUI connection, its reactive projection, and its pending edits. */
export function createPluginStateClient<const Fields extends PluginStateFields>(
    definition: Fields,
    ports: { readonly channel: PluginStateClientChannel<Fields>; readonly onDefect: (error: unknown) => void },
) {
    const store = createStore();
    const projection = atom<PluginStateClientSnapshot<Fields>>(Object.freeze({ kind: "connecting" }));
    // React observes this read-only atom with Jotai's own subscription machinery.
    // Only this module can write the private projection atom.
    const snapshotAtom = atom(get => get(projection));
    const getSnapshot = () => store.get(projection);
    let stopped = false;
    let attachRequest = 1;
    let expectedScope: PluginStateScope | undefined;
    let remove = () => {};
    let nextSequence = 0;
    let base: Extract<PluginStateClientSnapshot<Fields>, { readonly kind: "ready" }> | undefined;
    const drafts = new Map<number, { readonly key: string; readonly value: unknown }>();
    const tickets = new Map<number, { readonly finish: (result: PluginStateClientResult) => void; sent: boolean }>();
    const outgoing: Extract<PluginStateClientMessage, { readonly kind: "command" }>[] = [];
    let sending = false;
    const duringAttach = new Map<string, Extract<PluginStateClientEvent<Fields>, { readonly kind: "update" }>>();
    const scopeKey = (scope: PluginStateScope) => JSON.stringify([scope.owner, scope.document]);

    const retainValues = (incoming: PluginStateSnapshot<Fields>, previous?: PluginStateSnapshot<Fields>): PluginStateSnapshot<Fields> => {
        const fields: Record<string, PluginStateFieldSnapshot<unknown>> = {};
        for (const key of Object.keys(definition)) {
            const next = incoming.fields[key];
            const before = previous?.fields[key];
            const field = definition[key];
            if (!next || !field) continue;
            const value = "value" in next && before && "value" in before
                && (field.kind === "stored" ? field.codec.equals(before.value, next.value) : before.value === next.value)
                ? before.value : "value" in next ? next.value : undefined;
            fields[key] = Object.freeze("value" in next ? { ...next, value } : next);
        }
        // SAFETY: keys are the definition's keys; parsed adapter values retain
        // their field type and may only be replaced by an equal prior field value.
        return Object.freeze({ ...incoming, fields: Object.freeze(fields) }) as PluginStateSnapshot<Fields>;
    };
    const redraw = () => {
        if (!base) return;
        const fields: Record<string, PluginStateFieldSnapshot<unknown>> = { ...base.state.fields };
        const pendingFields = new Set<string>();
        for (const draft of drafts.values()) {
            const field = fields[draft.key];
            if (field && "value" in field) {
                fields[draft.key] = Object.freeze({ ...field, value: draft.value });
                pendingFields.add(draft.key);
            }
        }
        // SAFETY: drafts were parsed by their declared field codec before insertion.
        const state = Object.freeze({ ...base.state, fields: Object.freeze(fields) }) as PluginStateSnapshot<Fields>;
        store.set(projection, Object.freeze({ ...base, state, pendingFields: Object.freeze([...pendingFields]) }));
    };
    const settle = (receipt: PluginStateReceipt) => {
        if (!base || !sameScope(base.state.scope, receipt.address) || receipt.address.client !== base.client) return;
        const ticket = tickets.get(receipt.address.sequence);
        if (!ticket?.sent) return;
        const ownDraft = drafts.get(receipt.address.sequence);
        if (ownDraft) {
            for (const [sequence, draft] of drafts) {
                if (draft.key === ownDraft.key && sequence <= receipt.address.sequence) drafts.delete(sequence);
            }
        }
        tickets.delete(receipt.address.sequence);
        redraw();
        ticket.finish(receipt.result);
    };
    const interrupt = (reason: "reset" | "closed") => {
        const pending = [...tickets.values()];
        tickets.clear();
        drafts.clear();
        outgoing.length = 0;
        base = undefined;
        duringAttach.clear();
        for (const ticket of pending) ticket.finish(ticket.sent
            ? { kind: "interrupted", reason, acceptance: "unknown" }
            : { kind: "rejected", reason: reason === "reset" ? "stale-scope" : "service-closed" });
    };
    const close = (knownReceipt?: PluginStateReceipt) => {
        if (stopped) return;
        stopped = true;
        remove();
        if (knownReceipt) settle(knownReceipt);
        interrupt("closed");
        store.set(projection, Object.freeze({ kind: "closed" }));
    };
    const drain = () => {
        if (sending) return;
        sending = true;
        try {
            for (let message = outgoing.shift(); message; message = outgoing.shift()) {
                redraw();
                const ticket = tickets.get(message.sequence);
                if (stopped || !ticket || !base || !sameScope(base.state.scope, message.scope) || base.client !== message.client) continue;
                ticket.sent = true;
                ports.channel.send(message);
            }
        } catch (error) {
            ports.onDefect(error);
            close();
        } finally { sending = false; }
    };
    const receive = (message: PluginStateClientEvent<Fields>) => {
        if (stopped) return;
        const current = getSnapshot();
        if (message.kind === "attached") {
            if (current.kind !== "connecting" || message.request !== attachRequest
                || (expectedScope && !sameScope(expectedScope, message.scope))) return;
            expectedScope = message.scope;
            const pending = duringAttach.get(scopeKey(message.scope));
            const newest = pending && pending.revision > message.revision ? pending.state : message.state;
            duringAttach.clear();
            base = { kind: "ready", client: message.client, state: retainValues(newest), pendingFields: [] };
            redraw();
        } else if (message.kind === "update") {
            if (current.kind === "connecting") {
                if (expectedScope && !sameScope(expectedScope, message.scope)) return;
                const key = scopeKey(message.scope);
                const pending = duringAttach.get(key);
                if (!pending || message.revision > pending.revision) duringAttach.set(key, message);
            } else if (base && sameScope(base.state.scope, message.scope)) {
                if (message.revision > base.state.revision) {
                    base = { ...base, state: retainValues(message.state, base.state) };
                    redraw();
                }
                if (message.receipt) settle(message.receipt);
            }
        } else if (message.kind === "receipt") settle(message);
        else if (message.kind === "closed") close();
        else if (message.kind === "attach-failed") {
            if (message.request !== attachRequest || current.kind !== "connecting") return;
            duringAttach.clear();
            store.set(projection, Object.freeze({ kind: "failed", reason: message.reason }));
        } else {
            if (expectedScope && (message.kind === "reset"
                ? message.scope.owner !== expectedScope.owner || message.scope.document <= expectedScope.document
                : sameScope(expectedScope, message.scope))) return;
            expectedScope = message.scope;
            interrupt("reset");
            nextSequence = 0;
            attachRequest++;
            store.set(projection, Object.freeze({ kind: "connecting" }));
            ports.channel.send({ kind: "attach", request: attachRequest });
        }
    };
    const receiveSafely = (message: PluginStateClientEvent<Fields>) => {
        try { receive(message); }
        catch (error) {
            ports.onDefect(error);
            close(message.kind === "update" ? message.receipt : message.kind === "receipt" ? message : undefined);
        }
    };
    try {
        remove = ports.channel.subscribe(receiveSafely);
        if (stopped) remove();
        else ports.channel.send({ kind: "attach", request: attachRequest });
    } catch (error) {
        ports.onDefect(error);
        close();
    }
    return {
        reactivity: Object.freeze({ store, snapshot: snapshotAtom }),
        getSnapshot,
        subscribe(listener: (snapshot: PluginStateClientSnapshot<Fields>) => void): () => void {
            return store.sub(projection, () => {
                try { listener(getSnapshot()); } catch (error) { ports.onDefect(error); }
            });
        },
        dispatch(command: PluginStateCommand): Promise<PluginStateClientResult> {
            try {
                if (stopped) return Promise.resolve({ kind: "rejected", reason: "service-closed" });
                if (!base?.state.scope) return Promise.resolve({ kind: "rejected", reason: "not-ready" });
                const scope = base.state.scope;
                const client = base.client;
                let draft: { readonly key: string; readonly value: unknown } | undefined;
                let outbound = command;
                if ((command.kind === "undo" || command.kind === "redo") && command.expectedEntry !== undefined) {
                    const expectedEntry = parseHistoryEntry(command.expectedEntry);
                    if (!expectedEntry) return Promise.resolve({ kind: "rejected", reason: "invalid-command" });
                    outbound = { ...command, expectedEntry };
                }
                if (command.kind === "edit") {
                    const field = definition[command.key];
                    const current = base.state.fields[command.key];
                    if (!Object.hasOwn(definition, command.key) || !field) return Promise.resolve({ kind: "rejected", reason: "invalid-command" });
                    if (!current || current.readiness.kind !== "ready" || !("value" in current)) return Promise.resolve({ kind: "rejected", reason: "not-ready" });
                    const parsed = field.kind === "stored" ? field.codec.parse(command.value)
                        : typeof command.value === "number" && Number.isFinite(command.value)
                            ? { kind: "ok" as const, value: command.value } : { kind: "error" as const };
                    if (parsed.kind === "error") return Promise.resolve({ kind: "rejected", reason: "invalid-value" });
                    draft = { key: command.key, value: parsed.value };
                    outbound = { ...command, value: field.kind === "stored" ? field.codec.encode(parsed.value) : parsed.value };
                }
                if (!isBoundedStateJson({ kind: "command", scope, client, sequence: nextSequence + 1, command: outbound }))
                    return Promise.resolve({ kind: "rejected", reason: command.kind === "edit" ? "invalid-value" : "invalid-command" });
                const sequence = ++nextSequence;
                if (draft) drafts.set(sequence, draft);
                return new Promise(finish => {
                    tickets.set(sequence, { finish, sent: false });
                    outgoing.push({ kind: "command", scope, client, sequence, command: outbound });
                    drain();
                });
            } catch (error) {
                ports.onDefect(error);
                close();
                return Promise.resolve({ kind: "rejected", reason: "service-closed" });
            }
        },
        stop: () => close(),
    };
}
