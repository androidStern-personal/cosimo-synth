import type { EngineTarget } from "./plugin-state-engine";
import type { PluginStateClientEvent } from "./plugin-state-client";
import type { PluginStateFields, PluginStateJson } from "./plugin-state-definition";
import type {
    PluginStateAddress, PluginStateCommand, PluginStateNativeSnapshot,
    PluginStateScope, PluginStateSnapshot, PluginStatePersistence, PluginStateFieldSnapshot, PluginStateResult, PluginStateReceipt, PluginStateApplication, PluginStateHistoryEntry,
} from "./plugin-state-session";

/** A parsed channel body or an expected protocol validation failure. */
export type ProtocolResult<Value> = { readonly kind: "ok"; readonly value: Value }
    | { readonly kind: "invalid"; readonly message: string };

/** Native bodies currently consumed by the patch owner. Field values remain codec inputs. */
export type ServiceMessage =
    | { readonly kind: "closed"; readonly reason: string }
    | { readonly kind: "open-failed"; readonly request: number; readonly reason: string }
    | { readonly kind: "opened"; readonly request: number; readonly scope: PluginStateScope; readonly native: PluginStateNativeSnapshot }
    | { readonly kind: "replaced"; readonly scope: PluginStateScope; readonly native: PluginStateNativeSnapshot; readonly changedStoredKey?: string }
    | { readonly kind: "parameter"; readonly scope: PluginStateScope; readonly endpoint: string; readonly value: number }
    | { readonly kind: "attached-client"; readonly request: number; readonly scope: PluginStateScope; readonly client: number }
    | { readonly kind: "detach"; readonly scope: PluginStateScope; readonly client: number; readonly routedThrough: number }
    | { readonly kind: "command"; readonly address: PluginStateAddress; readonly command: PluginStateCommand }
    | { readonly kind: "invalid-command"; readonly address: PluginStateAddress }
    | { readonly kind: "published"; readonly request: number; readonly scope: PluginStateScope;
        readonly result: { readonly kind: "observed" } | { readonly kind: "failed"; readonly reason: string } };

/** Restrict object input to JSON records, excluding arrays and executable prototypes. */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function stringBytes(value: string, limit = Infinity): number {
    let size = 0;
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code < 0x80) size++;
        else if (code < 0x800) size += 2;
        else if (code >= 0xd800 && code <= 0xdbff) {
            const following = value.charCodeAt(++index);
            if (!(following >= 0xdc00 && following <= 0xdfff)) return Infinity;
            size += 4;
        } else if (code >= 0xdc00 && code <= 0xdfff) return Infinity;
        else size += 3;
        if (size > limit) return Infinity;
    }
    return size;
}

function jsonBudget() {
    let remaining = 16 * 1024 * 1024;
    return {
        node(depth: number): boolean {
            if (depth > 64 || remaining < 32) return false;
            remaining -= 32;
            return true;
        },
        text(value: string): boolean { remaining -= stringBytes(value, remaining); return remaining >= 0; },
        elements(length: number): boolean { return length <= Math.floor(remaining / 32); },
    };
}

/** Match the native channel's conservative UTF-8, node-count and recursion budget. */
export function isBoundedStateJson(value: unknown): value is PluginStateJson {
    const budget = jsonBudget();
    const visit = (input: unknown, depth: number): boolean => {
        if (!budget.node(depth)) return false;
        if (input === null || typeof input === "boolean") return true;
        if (typeof input === "number") return Number.isFinite(input);
        if (typeof input === "string") return budget.text(input);
        if (Array.isArray(input)) {
            if (!budget.elements(input.length)) return false;
            for (const item of input) if (!visit(item, depth + 1)) return false;
            return true;
        }
        if (!isRecord(input)) return false;
        for (const key in input) {
            if (Object.hasOwn(input, key) && (!budget.text(key) || !visit(input[key], depth + 1))) return false;
        }
        return true;
    };
    return visit(value, 0);
}

function counter(value: unknown, positive = true): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= (positive ? 1 : 0);
}

function name(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && stringBytes(value) <= 256;
}

function scope(input: unknown): PluginStateScope | undefined {
    return isRecord(input) && name(input.owner) && counter(input.document, false)
        ? Object.freeze({ owner: input.owner, document: input.document }) : undefined;
}

/** Validate an opaque history reference without assuming it belongs to the current document. */
export function parseHistoryEntry(input: unknown): PluginStateHistoryEntry | undefined {
    if (!isRecord(input) || !counter(input.id)) return undefined;
    const parsedScope = scope(input.scope);
    return parsedScope ? Object.freeze({ scope: parsedScope, id: input.id }) : undefined;
}

function address(input: unknown): PluginStateAddress | undefined {
    const parsedScope = scope(input);
    return parsedScope && isRecord(input) && counter(input.client) && counter(input.sequence)
        ? Object.freeze({ ...parsedScope, client: input.client, sequence: input.sequence }) : undefined;
}

function nativeSnapshot(input: unknown): PluginStateNativeSnapshot | undefined {
    if (!isRecord(input) || !Array.isArray(input.parameters) || !isRecord(input.values)) return undefined;
    const parameters = [];
    for (const item of input.parameters) {
        if (!isRecord(item)) return undefined;
        const { endpoint, value, min, max, step, defaultValue } = item;
        if (!name(endpoint) || typeof value !== "number" || typeof min !== "number" || typeof max !== "number"
            || typeof step !== "number" || typeof defaultValue !== "number") return undefined;
        parameters.push(Object.freeze({ endpoint, value, min, max, step, defaultValue }));
    }
    return { parameters: Object.freeze(parameters), values: input.values };
}

function command(input: unknown): PluginStateCommand | undefined {
    if (!isRecord(input)) return undefined;
    if (input.kind === "undo" || input.kind === "redo") {
        const expectedEntry = parseHistoryEntry(input.expectedEntry);
        if (input.expectedEntry !== undefined && !expectedEntry) return undefined;
        return { kind: input.kind, ...(expectedEntry ? { expectedEntry } : {}) };
    }
    if (!name(input.key)) return undefined;
    if (input.kind === "recover") {
        return Object.hasOwn(input, "value") && input.expectedVersion === 0 && !Object.hasOwn(input, "gesture")
            ? { kind: "recover", key: input.key, value: input.value, expectedVersion: 0 } : undefined;
    }
    if (input.kind === "begin" || input.kind === "end") {
        if (!counter(input.gesture) || (input.label !== undefined && typeof input.label !== "string")) return undefined;
        return input.kind === "end" ? { kind: "end", key: input.key, gesture: input.gesture }
            : { kind: "begin", key: input.key, gesture: input.gesture, ...(input.label !== undefined ? { label: input.label } : {}) };
    }
    if (input.kind !== "edit" || !Object.hasOwn(input, "value")) return undefined;
    if (input.expectedVersion !== undefined && !counter(input.expectedVersion, false)) return undefined;
    if (input.gesture !== undefined && !counter(input.gesture)) return undefined;
    return { kind: "edit", key: input.key, value: input.value,
        ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
        ...(input.gesture !== undefined ? { gesture: input.gesture } : {}),
    };
}

/** Parse one raw native body without granting privileges from caller-supplied role fields. */
export function parseServiceMessage(input: unknown): ProtocolResult<ServiceMessage> {
    if (!isBoundedStateJson(input) || !isRecord(input)) return { kind: "invalid", message: "Invalid state-channel body." };
    if (input.kind === "open-failed" && counter(input.request) && name(input.reason)) {
        return { kind: "ok", value: { kind: "open-failed", request: input.request, reason: input.reason } };
    }
    if (input.kind === "closed" && name(input.reason)) return { kind: "ok", value: { kind: "closed", reason: input.reason } };
    const parsedScope = scope(input.scope);
    if (input.kind === "opened" && parsedScope && counter(input.request)) {
        const native = nativeSnapshot(input.native);
        if (native) return { kind: "ok", value: { kind: "opened", request: input.request, scope: parsedScope, native } };
    }
    if (input.kind === "replaced" && parsedScope) {
        const native = nativeSnapshot(input.native);
        if (native && (input.changedStoredKey === undefined || name(input.changedStoredKey)))
            return { kind: "ok", value: { kind: "replaced", scope: parsedScope, native,
                ...(input.changedStoredKey === undefined ? {} : { changedStoredKey: input.changedStoredKey }),
            } };
    }
    if (input.kind === "parameter" && parsedScope && name(input.endpoint) && typeof input.value === "number")
        return { kind: "ok", value: { kind: "parameter", scope: parsedScope, endpoint: input.endpoint, value: input.value } };
    if (input.kind === "detach" && parsedScope && counter(input.client) && counter(input.routedThrough, false)) {
        return { kind: "ok", value: { kind: "detach", scope: parsedScope, client: input.client, routedThrough: input.routedThrough } };
    }
    if (input.kind === "attached-client" && parsedScope && counter(input.request) && counter(input.client)) {
        return { kind: "ok", value: { kind: "attached-client", scope: parsedScope, request: input.request, client: input.client } };
    }
    if (input.kind === "command") {
        const parsedAddress = address(input.address);
        if (parsedAddress) {
            const parsedCommand = command(input.command);
            return { kind: "ok", value: parsedCommand ? { kind: "command", address: parsedAddress, command: parsedCommand }
                : { kind: "invalid-command", address: parsedAddress } };
        }
    }
    if (input.kind === "published" && parsedScope && counter(input.request) && isRecord(input.result)) {
        if (input.result.kind === "observed") return { kind: "ok", value: { kind: "published", scope: parsedScope, request: input.request, result: { kind: "observed" } } };
        if (input.result.kind === "failed" && name(input.result.reason)) return { kind: "ok", value: {
            kind: "published", scope: parsedScope, request: input.request, result: { kind: "failed", reason: input.result.reason },
        } };
    }
    return { kind: "invalid", message: "Unrecognized or malformed state-channel message." };
}

/** Serialize accepted values with their own codecs; snapshots never send runtime objects as raw JSON. */
export function encodeStateSnapshot<Fields extends PluginStateFields>(definition: Fields, snapshot: PluginStateSnapshot<Fields>): unknown {
    const fields = Object.fromEntries(Object.entries(definition).map(([key, definitionField]) => {
        const field = snapshot.fields[key];
        if (!field || !("value" in field)) return [key, field];
        return [key, { ...field, value: definitionField.kind === "stored" ? definitionField.codec.encode(field.value) : field.value }];
    }));
    return { ...snapshot, fields };
}

function persistence(input: unknown): PluginStatePersistence | undefined {
    if (!isRecord(input)) return undefined;
    if (input.kind === "host-managed" || input.kind === "not-written" || input.kind === "pending" || input.kind === "observed-in-native-state")
        return { kind: input.kind };
    if (input.kind === "failed" && typeof input.reason === "string") return { kind: "failed", reason: input.reason };
    return undefined;
}

function application(input: unknown): PluginStateApplication | undefined {
    if (!isRecord(input)) return undefined;
    if (input.kind === "unconfirmed" || input.kind === "pending" || input.kind === "waiting-for-inputs" || input.kind === "preparing")
        return Object.freeze({ kind: input.kind });
    if (input.kind === "sent" && (input.proof === "connection-call-returned" || input.proof === "native-publication-processed"))
        return Object.freeze({ kind: "sent", proof: input.proof });
    if (input.kind === "acknowledged" && name(input.engineSession) && name(input.operation))
        return Object.freeze({ kind: "acknowledged", engineSession: input.engineSession, operation: input.operation });
    if (input.kind === "failed" && isRecord(input.error) && typeof input.error.message === "string") {
        const kind = input.error.kind;
        if (kind === "resource" || kind === "transport" || kind === "engine-rejected" || kind === "defect")
            return Object.freeze({ kind: "failed", error: Object.freeze({ kind, message: input.error.message }) });
    }
    return undefined;
}

function engineTarget(input: unknown): EngineTarget | undefined {
    if (!isRecord(input) || !name(input.key) || !counter(input.generation, false)) return undefined;
    const parsedScope = scope(input.scope);
    return parsedScope ? Object.freeze({ scope: parsedScope, key: input.key, generation: input.generation }) : undefined;
}

function fieldSnapshot(definition: PluginStateFields[string], input: unknown): PluginStateFieldSnapshot<unknown> | undefined {
    if (!isRecord(input) || !isRecord(input.readiness)) return undefined;
    const parsedApplication = application(input.application);
    const target = engineTarget(input.target);
    if ((input.application !== undefined && !parsedApplication) || (input.target !== undefined && !target)) return undefined;
    const common = { ...(parsedApplication ? { application: parsedApplication } : {}), ...(target ? { target } : {}) };
    if (input.readiness.kind === "pending" && !Object.hasOwn(input, "value"))
        return Object.freeze({ readiness: Object.freeze({ kind: "pending" }), ...common });
    if (input.readiness.kind === "failed" && !Object.hasOwn(input, "value")) {
        const reason = input.readiness.reason;
        if (input.version !== undefined && !counter(input.version, false)) return undefined;
        if (reason === "missing-parameter" || reason === "invalid-state" || reason === "service-closed")
            return Object.freeze({ readiness: Object.freeze({ kind: "failed", reason }), ...common,
                ...(input.version === undefined ? {} : { version: input.version }),
            });
        return undefined;
    }
    const failure = input.readiness.kind === "failed" && (input.readiness.reason === "service-closed"
        || (input.readiness.reason === "invalid-state" && definition.kind === "stored" && input.version === 0))
        ? input.readiness.reason : undefined;
    if (input.readiness.kind !== "ready" && !failure) return undefined;
    if (!Object.hasOwn(input, "value") || !counter(input.version, false)) return undefined;
    const parsed = definition.kind === "stored" ? definition.codec.parse(input.value)
        : typeof input.value === "number" ? { kind: "ok" as const, value: input.value } : { kind: "error" as const };
    const evidence = persistence(input.persistence);
    if (parsed.kind !== "ok" || !evidence) return undefined;
    let metadata;
    if (input.metadata !== undefined) {
        if (!isRecord(input.metadata)) return undefined;
        const { min, max, step, defaultValue } = input.metadata;
        if (typeof min !== "number" || typeof max !== "number" || typeof step !== "number" || typeof defaultValue !== "number") return undefined;
        metadata = Object.freeze({ min, max, step, defaultValue });
    }
    let gesture;
    if (input.gesture !== undefined) {
        if (!isRecord(input.gesture) || !counter(input.gesture.client) || !counter(input.gesture.gesture)) return undefined;
        gesture = Object.freeze({ client: input.gesture.client, gesture: input.gesture.gesture });
    }
    return Object.freeze({ readiness: failure ? Object.freeze({ kind: "failed", reason: failure })
        : Object.freeze({ kind: "ready" }), value: parsed.value, version: input.version,
        persistence: Object.freeze(evidence), ...(metadata ? { metadata } : {}), ...(gesture ? { gesture } : {}), ...common });
}

function stateSnapshot<Fields extends PluginStateFields>(definition: Fields, input: unknown): PluginStateSnapshot<Fields> | undefined {
    if (!isRecord(input) || !counter(input.revision, false) || !isRecord(input.fields) || !isRecord(input.history)
        || typeof input.history.canUndo !== "boolean" || typeof input.history.canRedo !== "boolean") return undefined;
    const parsedScope = scope(input.scope);
    if (!parsedScope) return undefined;
    const undoEntry = parseHistoryEntry(input.history.undoEntry);
    const redoEntry = parseHistoryEntry(input.history.redoEntry);
    if ((input.history.undoEntry !== undefined && !undoEntry) || (input.history.redoEntry !== undefined && !redoEntry)) return undefined;
    for (const entry of [undoEntry, redoEntry]) {
        if (entry && (entry.scope.owner !== parsedScope.owner || entry.scope.document !== parsedScope.document)) return undefined;
    }
    const fields: Record<string, PluginStateFieldSnapshot<unknown>> = Object.create(null);
    for (const [key, declaration] of Object.entries(definition)) {
        if (!Object.hasOwn(input.fields, key)) return undefined;
        const parsed = fieldSnapshot(declaration, input.fields[key]);
        if (!parsed || (parsed.target && (parsed.target.key !== key || parsed.target.scope.owner !== parsedScope.owner
            || parsed.target.scope.document !== parsedScope.document))) return undefined;
        fields[key] = parsed;
    }
    // SAFETY: every declared key was parsed with that declaration's codec. This
    // correlates the generic mapped keys; no unvalidated wire object is cast.
    return Object.freeze({ scope: parsedScope, revision: input.revision, fields: Object.freeze(fields),
        history: Object.freeze({ canUndo: input.history.canUndo, canRedo: input.history.canRedo,
            ...(undoEntry ? { undoEntry } : {}), ...(redoEntry ? { redoEntry } : {}),
        }),
    }) as PluginStateSnapshot<Fields>;
}

function result(input: unknown): PluginStateResult | undefined {
    if (!isRecord(input)) return undefined;
    const historyEntry = parseHistoryEntry(input.historyEntry);
    if (input.historyEntry !== undefined && !historyEntry) return undefined;
    if (input.kind === "accepted" && counter(input.revision, false) && (input.version === undefined || counter(input.version, false))
        && (input.changed === undefined || typeof input.changed === "boolean"))
        return { kind: "accepted", revision: input.revision, ...(input.version !== undefined ? { version: input.version } : {}),
            ...(input.changed !== undefined ? { changed: input.changed } : {}),
            ...(historyEntry ? { historyEntry } : {}),
        };
    if (input.kind !== "rejected") return undefined;
    const reason = input.reason;
    if (reason === "closed" || reason === "closed-client") return { kind: "rejected", reason: "service-closed" };
    if (reason === "not-ready" || reason === "invalid-command" || reason === "invalid-value" || reason === "stale-version"
        || reason === "stale-history" || reason === "stale-scope" || reason === "busy" || reason === "service-closed" || reason === "sequence") return { kind: "rejected", reason };
    return undefined;
}

function receipt(input: unknown): PluginStateReceipt | undefined {
    if (!isRecord(input)) return undefined;
    const parsedAddress = address(input.address);
    const parsedResult = result(input.result);
    if (parsedAddress && parsedResult?.kind === "accepted" && parsedResult.historyEntry
        && (parsedResult.historyEntry.scope.owner !== parsedAddress.owner || parsedResult.historyEntry.scope.document !== parsedAddress.document)) return undefined;
    return parsedAddress && parsedResult ? { address: parsedAddress, result: parsedResult } : undefined;
}

/** Parse a GUI body and hydrate every declared field through its domain codec. */
export function parseClientMessage<Fields extends PluginStateFields>(definition: Fields, input: unknown): ProtocolResult<PluginStateClientEvent<Fields>> {
    if (!isBoundedStateJson(input) || !isRecord(input)) return { kind: "invalid", message: "Invalid GUI state-channel body." };
    if (input.kind === "closed" && name(input.reason)) return { kind: "ok", value: { kind: "closed", reason: input.reason } };
    if (input.kind === "attach-failed" && counter(input.request) && name(input.reason))
        return { kind: "ok", value: { kind: "attach-failed", request: input.request, reason: input.reason } };
    const parsedScope = scope(input.scope);
    if ((input.kind === "reset" || input.kind === "owner-changed") && parsedScope)
        return { kind: "ok", value: { kind: input.kind, scope: parsedScope } };
    if (input.kind === "receipt") {
        const parsed = receipt(input);
        if (parsed) return { kind: "ok", value: { kind: "receipt", ...parsed } };
    }
    if ((input.kind === "attached" || input.kind === "update") && parsedScope && counter(input.revision, false)) {
        const state = stateSnapshot(definition, input.state);
        if (state && state.revision === input.revision && state.scope?.owner === parsedScope.owner && state.scope.document === parsedScope.document) {
            if (input.kind === "attached" && counter(input.request) && counter(input.client))
                return { kind: "ok", value: { kind: "attached", request: input.request, client: input.client, scope: parsedScope, revision: input.revision, state } };
            if (input.kind === "update") {
                const parsedReceipt = input.receipt === undefined ? undefined : receipt(input.receipt);
                if (input.receipt === undefined || parsedReceipt) return { kind: "ok", value: {
                    kind: "update", scope: parsedScope, revision: input.revision, state, ...(parsedReceipt ? { receipt: parsedReceipt } : {}),
                } };
            }
        }
    }
    return { kind: "invalid", message: "Unrecognized or malformed GUI state-channel message." };
}

/** Recover an independently valid addressed receipt even when its accompanying snapshot failed validation. */
export function parseClientReceipt(input: unknown): PluginStateReceipt | undefined {
    if (!isRecord(input)) return undefined;
    const candidate = input.kind === "update" ? input.receipt : input.kind === "receipt" ? input : undefined;
    return isBoundedStateJson(candidate) ? receipt(candidate) : undefined;
}

/** Convert ordinary prepared payloads and numeric typed samples without expanding beyond the native budget. */
export function encodeEventPayload(input: unknown): ProtocolResult<PluginStateJson> {
    const budget = jsonBudget();
    const ancestors = new Set<object>();
    const convert = (value: unknown, depth: number): PluginStateJson | undefined => {
        if (!budget.node(depth)) return undefined;
        if (value === null || typeof value === "boolean") return value;
        if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
        if (typeof value === "string") return budget.text(value) ? value : undefined;
        if (typeof value !== "object" || ancestors.has(value)) return undefined;
        ancestors.add(value);
        try {
            if (Array.isArray(value) || value instanceof Float32Array || value instanceof Float64Array || value instanceof Int8Array || value instanceof Int16Array
                || value instanceof Int32Array || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Uint16Array || value instanceof Uint32Array) {
                // Each element costs at least one native node. Refuse a large
                // typed array before allocating its expanded JavaScript copy.
                if (!budget.elements(value.length)) return undefined;
                const result: PluginStateJson[] = [];
                for (const item of value) {
                    const parsed = convert(item, depth + 1);
                    if (parsed === undefined) return undefined;
                    result.push(parsed);
                }
                return result;
            }
            if (!isRecord(value)) return undefined;
            const result: Record<string, PluginStateJson> = Object.create(null);
            for (const key in value) {
                if (!Object.hasOwn(value, key)) continue;
                if (!budget.text(key)) return undefined;
                const parsed = convert(value[key], depth + 1);
                if (parsed === undefined) return undefined;
                result[key] = parsed;
            }
            return result;
        } finally { ancestors.delete(value); }
    };
    const value = convert(input, 0);
    return value !== undefined ? { kind: "ok", value }
        : { kind: "invalid", message: "Prepared event payload does not satisfy the native JSON contract." };
}
