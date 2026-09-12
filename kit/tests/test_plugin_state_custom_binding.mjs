import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const { definePluginState, parameter, storedValue, preparedState, eventValue } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { createCmajorPluginStateService } = await loadUIModule(root, "kit/ui/plugin-state-cmajor.ts");

const samplesCodec = {
    parse(input) {
        if (!Array.isArray(input) || input.length < 2 || !input.every(value => typeof value === "number" && Number.isFinite(value)))
            return { kind: "error", message: "Expected finite samples." };
        return { kind: "ok", value: Object.freeze([...input]) };
    },
    encode(value) { return [...value]; },
    equals(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); },
};

// This external raw transport only records JSON and supplies native replies.
// The production service owns hydration, targets, accepted state and history.
class RawConnection {
    sent = [];
    listeners = new Set();
    addEventListener(type, listener) { assert.equal(type, "kit_state"); this.listeners.add(listener); }
    removeEventListener(type, listener) { assert.equal(type, "kit_state"); this.listeners.delete(listener); }
    sendMessageToServer(message) {
        assert.equal(message.type, "kit_state");
        this.sent.push(structuredClone(message.message));
    }
    deliver(body) { for (const listener of [...this.listeners]) listener(structuredClone(body)); }
    messages(kind) { return this.sent.filter(body => body.kind === kind); }
}

const scope = { owner: "custom-binding-owner", document: 0 };
const nativeGain = { endpoint: "hostGain", value: 2.5, min: -12, max: 12, step: 0.5, defaultValue: 1 };

function publicationFor(connection, endpoint) {
    return connection.messages("publish").find(body => body.operations.some(operation => operation.endpoint === endpoint));
}

function replyPublished(connection, publication) {
    assert.ok(publication, "the native publication must exist before delivering its receipt");
    connection.deliver({ kind: "published", request: publication.request, scope: publication.scope, result: { kind: "observed" } });
}

test("custom binding receives hydrated inputs, submits synchronously, and reports only native sent evidence alongside eventValue", { timeout: 5000 }, async () => {
    const connection = new RawConnection();
    const defects = [], inputs = [], submissions = [], outcomes = [], work = [];
    let stopped = 0;
    const definition = definePluginState({
        gain: parameter("hostGain"),
        curve: preparedState({ initial: [0, 1], codec: samplesCodec, dependencies: ["gain"],
            prepare(value, context) { inputs.push({ value, parameters: context.parameters }); return value.map(sample => sample * context.parameters.gain); },
            engine: { eventEndpoints: ["curveEvent"], create() { return {
                async apply(samples, context) {
                    const count = connection.messages("publish").length;
                    const submission = context.send({ kind: "event", endpoint: "curveEvent", value: { samples: new Float32Array(samples) } });
                    submissions.push({ submission, countBefore: count, countAfter: connection.messages("publish").length });
                    if (submission.kind !== "submitted") return submission;
                    const completion = submission.completion.then(outcome => { outcomes.push(outcome); return outcome; });
                    work.push(completion); return completion;
                }, stop() { stopped++; },
            }; } },
        }),
        preview: storedValue({ initial: [0, 1], codec: samplesCodec,
            engine: eventValue("previewEvent", (value, context) => ({ samples: new Float32Array(value.map(sample => sample * context.parameters.gain)) }), { dependencies: ["gain"] }),
        }),
    });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    try {
        const starting = service.start();
        const open = connection.messages("open")[0];
        assert.ok(open, "actual service must open before native hydration");
        connection.deliver({ kind: "opened", request: open.request, scope, native: {
            parameters: [nativeGain], values: { curve: [0.2, 0.8], preview: [0.4, 0.6] },
        } });
        await starting;
        await setImmediate();
        assert.equal(inputs.length, 1, "custom binding must receive the actual hydrated bank rather than being ignored");
        assert.deepEqual(inputs[0], { value: [0.2, 0.8], parameters: { gain: 2.5 } });
        assert.deepEqual([...open.eventEndpoints].sort(), ["curveEvent", "previewEvent"]);
        assert.deepEqual(open.storedKeys, ["curve", "preview"]);
        assert.equal(submissions[0].submission.kind, "submitted");
        assert.equal(submissions[0].countAfter, submissions[0].countBefore + 1,
            "raw connection handoff must occur before publish returns submitted");
        const custom = publicationFor(connection, "curveEvent");
        const builtin = publicationFor(connection, "previewEvent");
        assert.deepEqual(custom.operations, [{ kind: "event", endpoint: "curveEvent", value: { samples: [0.5, 2] } }]);
        assert.deepEqual(builtin.operations, [{ kind: "event", endpoint: "previewEvent", value: { samples: [1, 1.5] } }]);
        assert.notEqual(custom.request, builtin.request, "custom and built-in publications share collision-free request correlation");
        assert.deepEqual(outcomes, [], "handing off a publication does not fabricate its native receipt");
        replyPublished(connection, builtin);
        await setImmediate();
        assert.deepEqual(connection.messages("update").at(-1).state.fields.preview.application,
            { kind: "sent", proof: "native-publication-processed" }, "the built-in receipt must actually be processed first");
        assert.deepEqual(outcomes, [], "another binding's receipt must not settle the custom publication");
        replyPublished(connection, custom);
        await Promise.all(work);
        await setImmediate();
        assert.deepEqual(outcomes, [{ kind: "sent", proof: "native-publication-processed" }]);
        const state = connection.messages("update").at(-1).state;
        assert.deepEqual(state.fields.curve.application, outcomes[0]);
        assert.deepEqual(state.fields.preview.application, outcomes[0]);
        assert.deepEqual(state.history, { canUndo: false, canRedo: false });
        assert.equal(connection.messages("publish").length, 2, "hydration adds no stored write or duplicate engine installation");
        assert.deepEqual(defects, []);
    } finally {
        await service.stop();
    }
    assert.equal(stopped, 1);
    assert.equal(connection.listeners.size, 0);
});

test("custom declarations are all validated before any factory is constructed or native channel opened", async t => {
    const invalid = [
        ["stored dependency", { dependencies: ["first"] }],
        ["unknown dependency", { dependencies: ["absent"] }],
        ["empty event name", { eventEndpoints: [""] }],
        ["non-string event name", { eventEndpoints: [23] }],
        ["non-array event names", { eventEndpoints: "curveEvent" }],
        ["empty host effect name", { hostEffects: [""] }],
        ["non-array dependencies", { dependencies: "gain" }],
        ["invalid factory", { create: null }],
        ["invalid replacement", { replacement: "sometimes" }],
    ];
    for (const [name, override] of invalid) await t.test(name, async () => {
        const connection = new RawConnection(), constructed = [], defects = [];
        const engine = { eventEndpoints: ["sharedEvent"], create() { constructed.push("created"); return { async apply() { return {kind:"unconfirmed"}; }, stop() {} }; } };
        const field = preparedState({initial:[0,1],codec:samplesCodec,prepare:value=>value,engine});
        // Malformed declarations model JavaScript consumers too; do not let an invalid later field open the first one.
        const definition = definePluginState({gain:parameter("hostGain"),first:field,curve:{...field,engine:{...field.engine,
            ...(override.dependencies === undefined ? {} : {dependencies:override.dependencies}), delivery:{...engine,...override}}}});
        const service = createCmajorPluginStateService(definition,connection,{onDefect:error=>defects.push(error)});
        const started = service.start().then(()=>({kind:"ready"}),error=>({kind:"failed",error}));
        try {
            assert.deepEqual(constructed, [], `${name}: validate every declaration before constructing a factory`);
            assert.deepEqual(connection.sent, [], `${name}: invalid configuration must not open or publish`);
            const result = await started; assert.equal(result.kind,"failed"); assert.ok(result.error instanceof Error);
            assert.equal(connection.listeners.size,0);
        } finally {await service.stop();await started;}
    });
});

async function openPublisher(currentScope = scope, hostEffects = []) {
    const connection = new RawConnection(), defects = [], replacements = [];
    let context;
    const definition = definePluginState({curve:preparedState({initial:[0,1],codec:samplesCodec,
        prepare(value, captured) { replacements.push({value,parameters:captured.parameters});return value; },
        engine:{eventEndpoints:["curveEvent"],hostEffects,create(document){context=document;return {async apply(){return {kind:"unconfirmed"};},stop(){}};}},
    })});
    const service = createCmajorPluginStateService(definition,connection,{onDefect:error=>defects.push(error)});
    const starting=service.start();
    connection.deliver({kind:"opened",request:connection.messages("open")[0].request,scope:currentScope,native:{parameters:[],values:{curve:[0.2,0.8]}}});
    await starting; await setImmediate();
    return {service,connection,get context(){return context;},defects,replacements};
}

test("rejected old-document and wrong-owner replacements cannot cancel a current custom publication", async t => {
    for (const invalidScope of [{ ...scope, document: 1 }, { owner: "different-owner", document: 3 }]) await t.test(JSON.stringify(invalidScope), async () => {
        const current = { ...scope, document: 2 };
        const fixture = await openPublisher(current);
        const { service, connection, context, defects } = fixture;
        try {
            const submission = context.send({ kind: "event", endpoint: "curveEvent", value: [0.2, 0.8] });
            assert.equal(submission.kind, "submitted");
            const publication = connection.messages("publish").at(-1);
            let outcome;
            const completion = submission.completion.then(value => { outcome = value; });
            connection.deliver({ kind: "replaced", scope: invalidScope, native: { parameters: [], values: { curve: [9, 9] } } });
            connection.deliver({ kind: "attached-client", request: 30, client: 7, scope: current });
            await setImmediate();
            const attached = connection.messages("snapshot").at(-1);
            assert.deepEqual(attached.scope, current, "actual service must retain the current document");
            assert.deepEqual(attached.state.fields.curve.value, [0.2, 0.8]);
            assert.equal(outcome, undefined, "rejected replacement cannot cancel an otherwise current publication");
            replyPublished(connection, publication);
            await completion;
            assert.deepEqual(outcome, { kind: "sent", proof: "native-publication-processed" });
            assert.equal(fixture.replacements.length, 1);
            assert.deepEqual(defects, []);
        } finally { await service.stop(); }
    });
});

test("custom class-instance lifecycle methods retain their receiver through hydration and stop", { timeout: 5000 }, async () => {
    const connection = new RawConnection();
    const defects = [];
    const received = [];
    class Port {
        stopped = 0;
        async apply(value) { received.push({ receiver: this, input: {value} }); return {kind:"unconfirmed"}; }
        async stop() { this.stopped++; }
    }
    const port = new Port();
    const service = createCmajorPluginStateService(definePluginState({ curve: preparedState({ initial: [0, 1], codec: samplesCodec,
        prepare:value=>value,engine:{eventEndpoints:["curveEvent"],create(){return port;}} }) }), connection, {onDefect:error=>defects.push(error)});
    try {
        const starting = service.start();
        const started = starting.then(() => "ready", error => error);
        connection.deliver({ kind: "opened", request: connection.messages("open")[0].request,
            scope, native: { parameters: [], values: { curve: [0.3, 0.7] } } });
        assert.equal(await started === "ready", true, "a class-instance port must hydrate successfully");
        await setImmediate();
        assert.equal(received.length, 1);
        assert.strictEqual(received[0].receiver, port);
        assert.deepEqual(received[0].input.value, [0.3, 0.7]);
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
    assert.equal(port.stopped, 1);
    assert.equal(connection.listeners.size, 0);
});

test("a factory that reports a synchronous defect before returning cannot reopen or leak its returned port", async () => {
    const connection = new RawConnection();
    const problem = new Error("custom construction encountered an unexpected defect");
    const defects = [];
    let stopped = 0;
    const service = createCmajorPluginStateService(definePluginState({curve:preparedState({initial:[0,1],codec:samplesCodec,prepare:value=>value,
        engine:{eventEndpoints:["curveEvent"],create(context){
            context.fail(problem);return {async apply(){return {kind:"unconfirmed"};},async stop(){stopped++;}};
        }},
    })}),connection,{onDefect:error=>defects.push(error)});
    const started = service.start().then(() => ({ kind: "ready" }), error => ({ kind: "failed", error }));
    const opened = connection.messages("open")[0];
    connection.deliver({kind:"opened",request:opened.request,scope,native:{parameters:[],values:{curve:[0.2,0.8]}}});
    try {
        const result = await started;
        assert.equal(result.kind, "failed");
        await service.stop();
        assert.equal(connection.messages("open").length,1,"document factory failure must not reopen the already requested owner");
        assert.equal(connection.messages("close").length,1);
        assert.equal(stopped, 1, "the port returned after closure still belongs to the failed construction");
        assert.equal(connection.listeners.size, 0);
        assert.deepEqual(defects, [problem]);
    } finally { await service.stop(); }
});

test("custom publication captures its scope before the caller reuses a mutable scope object", async () => {
    const callerScope = { ...scope };
    const { service, connection, context } = await openPublisher(callerScope);
    try {
        const submission = context.send({ kind: "event", endpoint: "curveEvent", value: [0.2, 0.8] });
        assert.equal(submission.kind, "submitted");
        const publication = connection.messages("publish").at(-1);
        assert.deepEqual(publication.scope, scope);
        let outcome;
        const completed = submission.completion.then(value => { outcome = value; });
        callerScope.document = 99;
        replyPublished(connection, publication);
        await setImmediate();
        assert.deepEqual(outcome, { kind: "sent", proof: "native-publication-processed" },
            "caller mutation must not change an already submitted request's correlation scope");
        await completed;
    } finally { await service.stop(); }
});

test("custom pending publications settle on accepted reset and stop while late receipts and old effects stay inert", async () => {
    const fixture = await openPublisher();
    const { service, connection, context, defects } = fixture;
    try {
        const old = context.send({ kind: "event", endpoint: "curveEvent", value: [0.2, 0.8] });
        assert.equal(old.kind, "submitted");
        const oldPublication = connection.messages("publish").at(-1);
        const current = { ...scope, document: 1 };
        connection.deliver({ kind: "replaced", scope: current, native: { parameters: [], values: { curve: [0.6, 0.4] } } });
        assert.deepEqual(await old.completion, { kind: "cancelled" });
        await setImmediate();
        assert.deepEqual(connection.messages("update").at(-1).scope, current);
        assert.deepEqual(fixture.replacements.at(-1).value, [0.6, 0.4]);
        const beforeStale = connection.sent.length;
        assert.deepEqual(context.send({ kind: "event", endpoint: "curveEvent", value: [9, 9] }), { kind: "cancelled" });
        assert.equal(connection.sent.length, beforeStale);
        const next = fixture.context.send({ kind: "event", endpoint: "curveEvent", value: [0.6, 0.4] });
        assert.equal(next.kind, "submitted");
        const nextPublication = connection.messages("publish").at(-1);
        let nextOutcome;
        const completed = next.completion.then(value => { nextOutcome = value; });
        replyPublished(connection, oldPublication);
        await setImmediate();
        assert.equal(nextOutcome, undefined, "old completion cannot settle the new document request");
        replyPublished(connection, nextPublication);
        await completed;
        assert.deepEqual(nextOutcome, { kind: "sent", proof: "native-publication-processed" });
        const pending = fixture.context.send({ kind: "event", endpoint: "curveEvent", value: [0.7, 0.3] });
        assert.equal(pending.kind, "submitted");
        const late = connection.messages("publish").at(-1);
        await service.stop();
        assert.deepEqual(await pending.completion, { kind: "cancelled" });
        const afterStop = connection.sent.length;
        assert.deepEqual(context.send({ kind: "event", endpoint: "curveEvent", value: [8, 8] }), { kind: "cancelled" });
        replyPublished(connection, late);
        await setImmediate();
        assert.equal(connection.sent.length, afterStop);
        assert.equal(connection.listeners.size, 0);
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
});

test("custom effects validate before sending and declared host receipts distinguish unsupported from sent", async () => {
    const { service, connection, context, defects } = await openPublisher(scope, ["hostControl"]);
    try {
        assert.deepEqual(connection.messages("open")[0].hostEffects, ["hostControl"]);
        const cyclic = {}; cyclic.self = cyclic;
        const invalid = [
            { kind: "event", endpoint: "undeclared", value: 1 },
            { kind: "event", endpoint: "curveEvent", value: { samples: [0, NaN] } },
            { kind: "event", endpoint: "curveEvent", value: cyclic },
            { kind: "event", endpoint: "curveEvent", value: undefined },
            { kind: "host-effect", name: "undeclared", value: 1 },
            { kind: "host-effect", name: "hostControl", value: { amount: Infinity } },
            { kind: "invented", name: "hostControl", value: 1 },
        ];
        const before = connection.sent.length;
        for (const effect of invalid) {
            let result;
            assert.doesNotThrow(() => { result = context.send(effect); });
            assert.equal(result.kind, "failed", `invalid ${effect.kind} must fail before handoff`);
            assert.equal(result.error.kind, "engine-rejected");
            assert.equal(connection.sent.length, before);
        }
        const unsupported = context.send({ kind: "host-effect", name: "hostControl", value: { selector: 3 } });
        assert.equal(unsupported.kind, "submitted");
        const first = connection.messages("publish").at(-1);
        assert.equal(first.request, connection.messages("open")[0].request + 1, "invalid effects allocate no publication request IDs");
        assert.deepEqual(first.operations, [{ kind: "host-effect", name: "hostControl", value: { selector: 3 } }]);
        connection.deliver({ kind: "published", request: first.request, scope, result: { kind: "failed", reason: "unsupported-host-effect" } });
        assert.deepEqual(await unsupported.completion, { kind: "failed", error: { kind: "resource", message: "unsupported-host-effect" } });
        assert.equal(connection.listeners.size, 1, "missing host capability must not close the accepted-state owner");
        assert.deepEqual(connection.messages("close"), []);
        const supported = context.send({ kind: "host-effect", name: "hostControl", value: { selector: 4 } });
        assert.equal(supported.kind, "submitted");
        const second = connection.messages("publish").at(-1);
        assert.equal(second.request, first.request + 1, "invalid effects allocate no publication request IDs");
        replyPublished(connection, second);
        assert.deepEqual(await supported.completion, { kind: "sent", proof: "native-publication-processed" });
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
});

test("native stale-scope or closed refusal cancels a custom request before its replacement notification arrives", async t => {
    for (const reason of ["stale-scope", "closed"]) await t.test(reason, async () => {
        const { service, connection, context, defects } = await openPublisher();
        try {
            const submission = context.send({ kind: "event", endpoint: "curveEvent", value: [0.2, 0.8] });
            assert.equal(submission.kind, "submitted");
            const publication = connection.messages("publish").at(-1);
            connection.deliver({ kind: "published", request: publication.request, scope, result: { kind: "failed", reason } });
            assert.deepEqual(await submission.completion, { kind: "cancelled" },
                "native already revoked this document; it is not an uncertain transport write to retry");
            connection.deliver({ kind: "attached-client", scope, client: 7, request: 40 });
            await setImmediate();
            assert.deepEqual(connection.messages("snapshot").at(-1).scope, scope,
                "the replacement notification has not yet reached the owner");
            assert.deepEqual(defects, []);
        } finally { await service.stop(); }
    });
});

test("a later factory throw rejects startup and awaits cleanup of the already constructed port", async () => {
    const connection = new RawConnection();
    const problem = new Error("later binding construction failed");
    const defects = [];
    let stopped = 0;
    let release;
    const cleanup = new Promise(resolve => { release = resolve; });
    const definition = definePluginState({
        curve:preparedState({initial:[0,1],codec:samplesCodec,prepare:value=>value,engine:{eventEndpoints:["sharedEvent"],create(){
            return {async apply(){return {kind:"unconfirmed"};},async stop(){stopped++;await cleanup;}};
        }}}),
        other:preparedState({initial:[0,1],codec:samplesCodec,prepare:value=>value,engine:{eventEndpoints:["sharedEvent"],create(){throw problem;}}}),
    });
    const service=createCmajorPluginStateService(definition,connection,{onDefect:error=>defects.push(error)});
    try {
        const starting=service.start().then(()=>undefined,error=>error);
        const open=connection.messages("open")[0];
        connection.deliver({kind:"opened",request:open.request,scope,native:{parameters:[],values:{curve:[0.2,0.8],other:[0.3,0.7]}}});
        assert.ok(await starting instanceof Error);
        assert.deepEqual(connection.messages("publish"),[],"a failed document construction must not publish an engine update");
        assert.equal(stopped, 1, "the returned first port must actually enter cleanup");
        let finished = false;
        const stopping = service.stop().then(() => { finished = true; });
        await setImmediate();
        assert.equal(finished, false, "stop must await the constructed port's asynchronous cleanup");
        release();
        await stopping;
        assert.equal(stopped, 1);
        assert.equal(connection.listeners.size, 0);
        assert.deepEqual(defects, [problem]);
    } finally { release(); await service.stop(); }
});

test("two custom bindings may share native endpoint declarations without losing independent publication receipts", async () => {
    const connection = new RawConnection();
    const contexts = new Map();
    const replacements = [];
    const defects = [];
    const definition = definePluginState(Object.fromEntries(["curve","other"].map(key=>[key,preparedState({
        initial:[0,1],codec:samplesCodec,prepare(value){replacements.push({key,input:{value}});return value;},
        engine:{eventEndpoints:["sharedEvent"],hostEffects:["sharedHost"],create(context){contexts.set(key,context);return {async apply(){return {kind:"unconfirmed"};},stop(){}};}},
    })])));
    const service=createCmajorPluginStateService(definition,connection,{onDefect:error=>defects.push(error)});
    try {
        const starting = service.start();
        const open = connection.messages("open")[0];
        assert.deepEqual(open.eventEndpoints, ["sharedEvent"]);
        assert.deepEqual(open.hostEffects, ["sharedHost"]);
        connection.deliver({ kind: "opened", request: open.request, scope, native: {
            parameters: [], values: { curve: [0.2, 0.8], other: [0.3, 0.7] },
        } });
        await starting;
        assert.deepEqual(replacements.map(item => [item.key, item.input.value]), [["curve", [0.2, 0.8]], ["other", [0.3, 0.7]]]);
        const left = contexts.get("curve").send({ kind: "event", endpoint: "sharedEvent", value: [0.2, 0.8] });
        const right = contexts.get("other").send({ kind: "event", endpoint: "sharedEvent", value: [0.3, 0.7] });
        assert.equal(left.kind, "submitted");
        assert.equal(right.kind, "submitted");
        const [first, second] = connection.messages("publish");
        assert.notEqual(first.request, second.request);
        let leftOutcome;
        const done = left.completion.then(value => { leftOutcome = value; });
        replyPublished(connection, second);
        assert.deepEqual(await right.completion, { kind: "sent", proof: "native-publication-processed" });
        assert.equal(leftOutcome, undefined);
        replyPublished(connection, first);
        await done;
        assert.deepEqual(leftOutcome, { kind: "sent", proof: "native-publication-processed" });
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
});

test("the built-in eventValue path retains its existing native-refusal outcome", async () => {
    const connection = new RawConnection();
    const defects = [];
    const definition = definePluginState({
        curve: storedValue({ initial: [0, 1], codec: samplesCodec, engine: eventValue("curveEvent", value => value) }),
    });
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    try {
        const starting = service.start();
        connection.deliver({ kind: "opened", request: connection.messages("open")[0].request,
            scope, native: { parameters: [], values: { curve: [0.2, 0.8] } } });
        await starting;
        await setImmediate();
        const publication = publicationFor(connection, "curveEvent");
        assert.ok(publication);
        connection.deliver({ kind: "published", request: publication.request, scope,
            result: { kind: "failed", reason: "stale-scope" } });
        await setImmediate();
        assert.deepEqual(connection.messages("update").at(-1).state.fields.curve.application,
            { kind: "failed", error: { kind: "transport", message: "stale-scope" } });
        assert.deepEqual(defects, []);
    } finally { await service.stop(); }
});
