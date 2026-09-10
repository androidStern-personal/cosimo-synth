export const messages = [];
export const legacy = { parameters: [], stored: [], full: [] };
export let stopped = 0;
let stopBarrier;
export let finishStop;
export let finishStart;
export function holdStop()
{
    stopBarrier = new Promise (resolve => { finishStop = resolve; });
}

export default async function start (connection)
{
    let opened, latePublication;
    connection.addParameterListener ("gain", value => legacy.parameters.push (value));
    connection.addStoredStateValueListener (body => legacy.stored.push (body));
    const receive = body =>
    {
        messages.push (structuredClone (body));
        if (body.kind === "opened")
            opened = body;
        if (body.kind === "replaced")
        {
            opened = body;
            if (latePublication)
            {
                connection.sendMessageToServer ({ type: "kit_state", message: latePublication });
                latePublication = undefined;
            }
        }
        if (body.kind === "command" && body.command.kind === "probe-legacy")
        {
            connection.requestStoredStateValue ("curve");
            connection.requestFullStoredState (state => legacy.full.push (state));
            return;
        }
        if (body.kind === "command" && body.command.kind === "probe-close")
        {
            connection.sendMessageToServer ({ type: "kit_state", message: { kind: "close", reason: "service-closed" } });
            connection.sendMessageToServer ({ type: "kit_state", message: {
                kind: "publish", request: 81, scope: { owner: body.address.owner, document: body.address.document },
                operations: [{ kind: "event", endpoint: "curveBuffer", value: 20 }]
            }});
            connection.sendMessageToServer ({ type: "kit_state", message: {
                kind: "open", request: 82, parameters: ["gain"], storedKeys: ["curve"], eventEndpoints: ["curveBuffer"]
            }});
            return;
        }
        if (body.kind === "command" && body.command.kind === "probe-update")
        {
            connection.sendMessageToServer ({ type: "kit_state", message: {
                kind: "update", scope: { owner: body.address.owner, document: body.address.document },
                revision: body.command.revision, state: body.command.state
            }});
            return;
        }
        if (body.kind === "command" && body.command.kind === "probe-late-after-replace")
        {
            latePublication = { kind: "publish", request: body.command.request,
                scope: { owner: body.address.owner, document: body.address.document }, operations: body.command.operations };
            return;
        }
        if (body.kind === "command" && body.command.kind === "probe-publish")
        {
            const operations = structuredClone (body.command.operations);
            if (body.command.nativeNonFinite)
                operations[0].value.points[0] = NaN;
            connection.sendMessageToServer ({ type: "kit_state", message: {
                kind: "publish", request: body.command.request,
                scope: { owner: body.address.owner, document: body.address.document }, operations
            }});
        }
        else if (body.kind === "command")
            connection.sendMessageToServer ({ type: "kit_state", message: {
                kind: "receipt", address: body.address, result: { kind: "rejected", reason: "busy" }
            }});
        if (body.kind === "attached-client")
            connection.sendMessageToServer ({ type: "kit_state", message: {
                kind: "snapshot", scope: body.scope, to: body.client, attachRequest: body.request, revision: 0,
                state: { gain: opened.native.parameters[0].value, curve: opened.native.values.curve }
            }});
    };
    connection.addEventListener ("kit_state", receive);
    connection.sendMessageToServer ({ type: "kit_state", message: {
        kind: "open", request: 1, parameters: ["gain"], storedKeys: ["curve"], eventEndpoints: ["curveBuffer"]
    }});
    if (new URL (location.href).searchParams.has ("holdWorkerStart"))
        await new Promise (resolve => { finishStart = resolve; });
    return { async stop()
    {
        ++stopped;
        await stopBarrier;
        connection.removeEventListener ("kit_state", receive);
        if (stopBarrier)
            throw new Error ("probe stop failed");
    }};
}
