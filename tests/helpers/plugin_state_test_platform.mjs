/**
 * External browser host fixture. The injected production channel owns routing;
 * the production service owns values, versions, locks and history. This fixture
 * supplies only parameter storage and records physical publication requests.
 */
export function createPluginStateTestPlatform(PluginStateChannel, { parameters, holdOpen = false }) {
    const values = new Map(parameters.map(parameter => [parameter.endpoint, { ...parameter }]));
    const stored = new Map();
    const views = new Set();
    const publicationRecords = [];
    const effects = [];
    const observations = new Map();
    let scope;
    let releaseOpen = () => {};
    const openGate = holdOpen ? new Promise(resolve => { releaseOpen = resolve; }) : Promise.resolve();
    let channel;

    function connection() {
        const listeners = new Set();
        const received = [];
        const queued = [];
        let held = false;
        const port = {
            addEventListener(type, listener) { if (type === "kit_state") listeners.add(listener); },
            removeEventListener(type, listener) { if (type === "kit_state") listeners.delete(listener); },
            sendMessageToServer(envelope) {
                if (envelope.type !== "kit_state") throw new Error("Unexpected fixture envelope");
                if (port === worker && envelope.message.kind === "publish") publicationRecords.push(structuredClone(envelope.message));
                if (!channel.receive(port, envelope.message)) throw new Error("Production channel refused fixture message");
            },
            deliverMessageFromServer(envelope) {
                if (held) { queued.push(structuredClone(envelope)); return; }
                received.push(structuredClone(envelope.message));
                for (const listener of [...listeners]) listener(envelope.message);
            },
            messages: () => structuredClone(received),
            holdIncoming() { held = true; },
            releaseIncoming(reverse = false) {
                held = false;
                const envelopes = queued.splice(0);
                if (reverse) envelopes.reverse();
                for (const envelope of envelopes) port.deliverMessageFromServer(envelope);
            },
            queuedMessages: () => queued.length,
        };
        return port;
    }

    const worker = connection();
    channel = new PluginStateChannel(worker, async request => {
        if (request.kind === "open") {
            scope = request.scope;
            for (const endpoint of request.parameters) observations.set(endpoint, { intent: 0, origin: "external", observation: 0 });
            await openGate;
            return { parameters: request.parameters.map(endpoint => structuredClone(values.get(endpoint))) };
        }
        if (request.kind === "read") return { value: values.get(request.endpoint)?.value, ...observations.get(request.endpoint) };
        if (request.kind === "effect") {
            effects.push(structuredClone(request.operation));
            if (request.operation.kind === "parameter") {
                values.get(request.operation.endpoint).value = request.operation.value;
                const previous = observations.get(request.operation.endpoint);
                observations.set(request.operation.endpoint, { intent: request.operation.intent, origin: "owner", observation: previous.observation + 1 });
                channel.observeParameter(scope, request.operation.endpoint);
            }
            return {};
        }
        if (request.kind === "close") return {};
        throw new Error(`Unsupported native fixture request: ${request.kind}`);
    }, keys => Object.fromEntries(keys.filter(key => stored.has(key)).map(key => [key, stored.get(key)])),
    (key, value) => stored.set(key, value), () => views);

    return {
        worker,
        createView() { const view = connection(); views.add(view); return view; },
        removeView(view) { channel.removeClient(view); views.delete(view); },
        releaseOpen: () => releaseOpen(),
        publications: () => structuredClone(publicationRecords),
        effects: () => structuredClone(effects),
        parameter: endpoint => values.get(endpoint)?.value,
        automate(endpoint, value) {
            values.get(endpoint).value = value;
            const previous = observations.get(endpoint);
            observations.set(endpoint, { ...previous, origin: "external", observation: previous.observation + 1 });
            channel.observeParameter(scope, endpoint);
        },
        close() { channel.close(); },
    };
}
