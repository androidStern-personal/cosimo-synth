const generatedProcessBlock = `        process (inputs, outputs)
        {
            const input = inputs[0];
            const output = outputs[0];

            this.processImpl?.(input, output);
            this.consumeOutputEvents?.();

            return true;
        }`;

const generatedDataUriFactory = `async function serialiseWorkletProcessorFactoryToDataURI (CmajorClass, workletName, hostDescription)
{
    const serialisedInvocation = \`(\${registerWorkletProcessor.toString()}) ("\${workletName}", \${CmajorClass.toString()}, "\${hostDescription}");\`

    let reader = new FileReader();
    reader.readAsDataURL (new Blob ([serialisedInvocation], { type: "text/javascript" }));

    return await new Promise (res => { reader.onloadend = () => res (reader.result); });
}`;

const compatibleModuleUrlFactory = `async function serialiseWorkletProcessorFactoryToDataURI (CmajorClass, workletName, hostDescription)
{
    const serialisedInvocation = \`(\${registerWorkletProcessor.toString()}) ("\${workletName}", \${CmajorClass.toString()}, "\${hostDescription}");\`
    return URL.createObjectURL (new Blob ([serialisedInvocation], { type: "text/javascript" }));
}`;

const generatedAddModule = `        const dataURI = await serialiseWorkletProcessorFactoryToDataURI (CmajorClass, workletName, hostDescription);
        await audioContext.audioWorklet.addModule (dataURI);`;

const compatibleAddModule = `        const dataURI = await serialiseWorkletProcessorFactoryToDataURI (CmajorClass, workletName, hostDescription);
        try
        {
            await audioContext.audioWorklet.addModule (dataURI);
        }
        finally
        {
            URL.revokeObjectURL (dataURI);
        }`;

const generatedListenerRemoval = `                                const index = listeners.indexOf (msg?.replyType);`;
const correctedListenerRemoval = `                                const index = listeners.findIndex ((listener) => listener.replyType === msg?.replyType);`;

const generatedMessageSwitch = `                    switch (msg.type)
                    {
                        case "req_status":`;

const generatedInputEndpointUpdate = `                            if (inputEndpoint)
                            {
                                inputEndpoint.update (msg.value);`;

const instrumentedInputEndpointUpdate = `                            if (inputEndpoint)
                            {
                                if (this.cosimoPerfEnabled
                                    && (endpointID === "modulationProgram" || endpointID === "modulationAmount"))
                                {
                                    this.cosimoPerfPendingMarkedEventCount = (this.cosimoPerfPendingMarkedEventCount || 0) + 1;
                                }

                                inputEndpoint.update (msg.value);`;

const instrumentedMessageSwitch = `                    switch (msg.type)
                    {
                        case "cosimo-perf-config":
                            this.cosimoPerfEnabled = msg.enabled === true;
                            this.cosimoPerfEpoch = Number.isFinite (msg.epoch) ? msg.epoch : 0;
                            this.cosimoPerfProcessMultiplier = 1;
                            this.cosimoPerfPendingMarkedEventCount = 0;
                            this.cosimoPerfLastStartedAt = undefined;
                            this.cosimoPerfLastCurrentFrame = undefined;
                            break;

                        case "cosimo-perf-process-multiplier":
                            this.cosimoPerfProcessMultiplier = Math.max (1, Math.min (4, Math.trunc (Number (msg.multiplier) || 1)));
                            this.port.postMessage ({
                                type: "cosimo-perf-process-multiplier-ack",
                                multiplier: this.cosimoPerfProcessMultiplier,
                            });
                            break;

                        case "cosimo-perf-reset":
                            this.cosimoPerfEpoch = Number.isFinite (msg.epoch) ? msg.epoch : 0;
                            this.cosimoPerfBlockCount = 0;
                            this.cosimoPerfLoadSum = 0;
                            this.cosimoPerfMaxLoad = 0;
                            this.cosimoPerfOverBudgetBlocks = 0;
                            this.cosimoPerfDefiniteDeadlineMissBlocks = 0;
                            this.cosimoPerfCallbackGapBlocks = 0;
                            this.cosimoPerfMaxCallbackGapLoad = 0;
                            this.cosimoPerfFrameDiscontinuityBlocks = 0;
                            this.cosimoPerfMarkedEventCount = 0;
                            this.cosimoPerfEventAdjacentBlockCount = 0;
                            this.cosimoPerfEventAdjacentGapLoadSum = 0;
                            this.cosimoPerfEventAdjacentLateBlocks = 0;
                            this.cosimoPerfEventAdjacentMaxGapLoad = 0;
                            this.cosimoPerfEventAdjacentCoalescedEvents = 0;
                            this.cosimoPerfPendingMarkedEventCount = 0;
                            this.cosimoPerfLastStartedAt = undefined;
                            this.cosimoPerfLastCurrentFrame = undefined;
                            this.port.postMessage ({
                                type: "cosimo-perf-reset-ack",
                                epoch: this.cosimoPerfEpoch,
                                sampleRateHz: sampleRate,
                            });
                            break;

                        case "cosimo-perf-gap-probe":
                            if (this.cosimoPerfEnabled)
                                this.cosimoPerfPendingMarkedEventCount = (this.cosimoPerfPendingMarkedEventCount || 0) + 1;
                            break;

                        case "req_status":`;

const instrumentedProcessBlock = `        process (inputs, outputs)
        {
            const input = inputs[0];
            const output = outputs[0];

            if (! this.cosimoPerfEnabled)
            {
                this.processImpl?.(input, output);
                this.consumeOutputEvents?.();
                return true;
            }

            const startedAt = globalThis.performance ? globalThis.performance.now() : Date.now();

            const processMultiplier = Math.max (1, Math.trunc (this.cosimoPerfProcessMultiplier || 1));
            for (let processIndex = 0; processIndex < processMultiplier; ++processIndex)
            {
                this.processImpl?.(input, output);
                this.consumeOutputEvents?.();
            }

            const finishedAt = globalThis.performance ? globalThis.performance.now() : Date.now();
            const elapsedMs = Math.max (0, finishedAt - startedAt);
            const blockFrames = output?.[0]?.length || 128;
            const budgetMs = (blockFrames / sampleRate) * 1000;
            const definiteDeadlineMiss = globalThis.performance?.now
                ? elapsedMs > budgetMs
                : elapsedMs >= Math.ceil (budgetMs) + 1;
            const frameDiscontinuous = this.cosimoPerfLastCurrentFrame !== undefined
                && currentFrame !== this.cosimoPerfLastCurrentFrame + blockFrames;
            this.cosimoPerfLastCurrentFrame = currentFrame;
            const callbackGapLoad = this.cosimoPerfLastStartedAt === undefined
                ? 0
                : Math.max (0, startedAt - this.cosimoPerfLastStartedAt) / budgetMs;
            this.cosimoPerfLastStartedAt = startedAt;
            const markedEventCount = this.cosimoPerfPendingMarkedEventCount || 0;
            this.cosimoPerfPendingMarkedEventCount = 0;
            if (markedEventCount > 0)
            {
                this.cosimoPerfMarkedEventCount = (this.cosimoPerfMarkedEventCount || 0) + markedEventCount;
                this.cosimoPerfEventAdjacentBlockCount = (this.cosimoPerfEventAdjacentBlockCount || 0) + 1;
                this.cosimoPerfEventAdjacentGapLoadSum = (this.cosimoPerfEventAdjacentGapLoadSum || 0) + callbackGapLoad;
                this.cosimoPerfEventAdjacentLateBlocks = (this.cosimoPerfEventAdjacentLateBlocks || 0) + (callbackGapLoad > 1.5 ? 1 : 0);
                this.cosimoPerfEventAdjacentMaxGapLoad = Math.max (this.cosimoPerfEventAdjacentMaxGapLoad || 0, callbackGapLoad);
                this.cosimoPerfEventAdjacentCoalescedEvents = (this.cosimoPerfEventAdjacentCoalescedEvents || 0) + Math.max (0, markedEventCount - 1);
            }
            const load = elapsedMs / budgetMs;
            this.cosimoPerfBlockCount = (this.cosimoPerfBlockCount || 0) + 1;
            this.cosimoPerfLoadSum = (this.cosimoPerfLoadSum || 0) + load;
            this.cosimoPerfMaxLoad = Math.max (this.cosimoPerfMaxLoad || 0, load);
            this.cosimoPerfOverBudgetBlocks = (this.cosimoPerfOverBudgetBlocks || 0) + (elapsedMs > budgetMs ? 1 : 0);
            this.cosimoPerfDefiniteDeadlineMissBlocks = (this.cosimoPerfDefiniteDeadlineMissBlocks || 0) + (definiteDeadlineMiss ? 1 : 0);
            this.cosimoPerfCallbackGapBlocks = (this.cosimoPerfCallbackGapBlocks || 0) + (callbackGapLoad > 1.5 ? 1 : 0);
            this.cosimoPerfMaxCallbackGapLoad = Math.max (this.cosimoPerfMaxCallbackGapLoad || 0, callbackGapLoad);
            this.cosimoPerfFrameDiscontinuityBlocks = (this.cosimoPerfFrameDiscontinuityBlocks || 0) + (frameDiscontinuous ? 1 : 0);
            if (this.cosimoPerfBlockCount >= 256)
            {
                this.port.postMessage ({
                    type: "cosimo-perf",
                    epoch: this.cosimoPerfEpoch || 0,
                    sampleRateHz: sampleRate,
                    renderQuantumFrames: blockFrames,
                    quantizedAverageLoad: this.cosimoPerfLoadSum / this.cosimoPerfBlockCount,
                    quantizedMaxLoad: this.cosimoPerfMaxLoad,
                    quantizedOverBudgetBlocks: this.cosimoPerfOverBudgetBlocks,
                    definiteDeadlineMissBlocks: this.cosimoPerfDefiniteDeadlineMissBlocks,
                    clockSource: globalThis.performance?.now ? "performance.now" : "Date.now",
                    processMultiplier,
                    callbackGapBlocks: this.cosimoPerfCallbackGapBlocks,
                    maxCallbackGapLoad: this.cosimoPerfMaxCallbackGapLoad,
                    frameDiscontinuityBlocks: this.cosimoPerfFrameDiscontinuityBlocks,
                    markedEventCount: this.cosimoPerfMarkedEventCount,
                    eventAdjacentBlockCount: this.cosimoPerfEventAdjacentBlockCount,
                    eventAdjacentGapLoadSum: this.cosimoPerfEventAdjacentGapLoadSum,
                    eventAdjacentLateBlocks: this.cosimoPerfEventAdjacentLateBlocks,
                    eventAdjacentMaxGapLoad: this.cosimoPerfEventAdjacentMaxGapLoad,
                    eventAdjacentCoalescedEvents: this.cosimoPerfEventAdjacentCoalescedEvents,
                    blockCount: this.cosimoPerfBlockCount,
                });
                this.cosimoPerfBlockCount = 0;
                this.cosimoPerfLoadSum = 0;
                this.cosimoPerfMaxLoad = 0;
                this.cosimoPerfOverBudgetBlocks = 0;
                this.cosimoPerfDefiniteDeadlineMissBlocks = 0;
                this.cosimoPerfCallbackGapBlocks = 0;
                this.cosimoPerfMaxCallbackGapLoad = 0;
                this.cosimoPerfFrameDiscontinuityBlocks = 0;
                this.cosimoPerfMarkedEventCount = 0;
                this.cosimoPerfEventAdjacentBlockCount = 0;
                this.cosimoPerfEventAdjacentGapLoadSum = 0;
                this.cosimoPerfEventAdjacentLateBlocks = 0;
                this.cosimoPerfEventAdjacentMaxGapLoad = 0;
                this.cosimoPerfEventAdjacentCoalescedEvents = 0;
            }

            return true;
        }`;

/**
 * Adds Cosimo's lightweight performance counters to Cmajor's generated render block.
 *
 * @param {string} source Generated Cmajor AudioWorklet helper source.
 * @returns {string} Instrumented helper source.
 */
export function instrumentCosimoAudioWorkletSource(source) {
    if (!source.includes(generatedProcessBlock)
        || !source.includes(generatedMessageSwitch)
        || !source.includes(generatedInputEndpointUpdate)) {
        throw new Error("Could not instrument the generated Cmajor AudioWorklet process block.");
    }

    return source
        .replace(generatedMessageSwitch, instrumentedMessageSwitch)
        .replace(generatedInputEndpointUpdate, instrumentedInputEndpointUpdate)
        .replace(generatedProcessBlock, instrumentedProcessBlock);
}

/** Uses a same-origin blob module because WebKit rejects AudioWorklet data URLs. */
export function adaptCosimoAudioWorkletModuleLoading(source) {
    if (!source.includes(generatedDataUriFactory) || !source.includes(generatedAddModule)) {
        throw new Error("Could not adapt the generated Cmajor AudioWorklet module loader.");
    }

    return source
        .replace(generatedDataUriFactory, compatibleModuleUrlFactory)
        .replace(generatedAddModule, compatibleAddModule);
}

/** Corrects Cmajor 1.0.3066's object-versus-string endpoint-listener lookup. */
export function fixCosimoAudioWorkletListenerRemoval(source) {
    if (!source.includes(generatedListenerRemoval)) {
        throw new Error("Could not find the generated Cmajor endpoint-listener removal.");
    }

    return source.replace(generatedListenerRemoval, correctedListenerRemoval);
}

const generatedConsumeOutputEvents = `    function makeConsumeOutputEvents ({ wrapper, eventOutputs, dispatchOutputEvent })
    {
        const outputEventHandlers = eventOutputs.map (({ endpointID }) =>
        {
            const readCount = wrapper[\`getOutputEventCount_\${endpointID}\`]?.bind (wrapper);
            const reset = wrapper[\`resetOutputEventCount_\${endpointID}\`]?.bind (wrapper);
            const readEventAtIndex = wrapper[\`getOutputEvent_\${endpointID}\`]?.bind (wrapper);

            return () =>
            {
                const count = readCount();

                for (let i = 0; i < count; ++i)
                    dispatchOutputEvent (endpointID, readEventAtIndex (i));

                reset();
            };
        });

        return () => outputEventHandlers.forEach ((consume) => consume() );
    }`;

const pooledConsumeOutputEvents = `    function makeConsumeOutputEvents ({ wrapper, eventOutputs, dispatchOutputEvent, hasEndpointListeners, flushDispatchedEvents })
    {
        const outputEventHandlers = eventOutputs.map (({ endpointID }) =>
        {
            const readCount = wrapper[\`getOutputEventCount_\${endpointID}\`]?.bind (wrapper);
            const reset = wrapper[\`resetOutputEventCount_\${endpointID}\`]?.bind (wrapper);
            const readEventAtIndex = wrapper[\`getOutputEvent_\${endpointID}\`]?.bind (wrapper);

            return () =>
            {
                const count = readCount();

                if (count === 0)
                    return;

                // Unpacking an event allocates its whole JS payload on the
                // render thread, so only endpoints somebody listens to are
                // read; the rest reset in wasm memory for free.
                if (hasEndpointListeners (endpointID))
                    for (let i = 0; i < count; ++i)
                        dispatchOutputEvent (endpointID, readEventAtIndex (i));

                reset();
            };
        });

        return () =>
        {
            outputEventHandlers.forEach ((consume) => consume() );
            flushDispatchedEvents();
        };
    }`;

const generatedConsumeOutputEventsConstruction = `                this.consumeOutputEvents = makeConsumeOutputEvents ({
                    eventOutputs,
                    wrapper,
                    dispatchOutputEvent: (endpointID, event) =>
                    {
                        for (const { replyType } of outputEventListeners[endpointID] ?? [])
                        {
                            this.sendPatchMessage ({
                                type: replyType,
                                message: event.event, // N.B. chucking away frame and typeIndex info for now
                            });
                        }
                    },
                });`;

const pooledConsumeOutputEventsConstruction = `                // One coalesced port message per render block: dispatches
                // enqueue, and the flush posts a single batch envelope when a
                // block produced more than one message. A lone message keeps
                // the original wire shape.
                this.cosimoPendingEventMessages = [];

                this.consumeOutputEvents = makeConsumeOutputEvents ({
                    eventOutputs,
                    wrapper,
                    hasEndpointListeners: (endpointID) => (outputEventListeners[endpointID]?.length ?? 0) > 0,
                    dispatchOutputEvent: (endpointID, event) =>
                    {
                        for (const { replyType } of outputEventListeners[endpointID] ?? [])
                        {
                            this.cosimoPendingEventMessages.push ({
                                type: replyType,
                                message: event.event, // N.B. chucking away frame and typeIndex info for now
                            });
                        }
                    },
                    flushDispatchedEvents: () =>
                    {
                        const pending = this.cosimoPendingEventMessages;

                        if (pending.length === 0)
                            return;

                        if (pending.length === 1)
                            this.sendPatchMessage (pending[0]);
                        else
                            this.sendPatchMessage ({ type: "cosimo-event-batch", messages: pending });

                        this.cosimoPendingEventMessages = [];
                    },
                });`;

const generatedNodeMessageDelivery = `                const msg = e.data.payload;

                if (msg?.type === "status")
                    msg.message = { manifest: this.manifest, ...msg.message };

                this.deliverMessageFromServer (msg)`;

const unbatchingNodeMessageDelivery = `                const msg = e.data.payload;

                if (msg?.type === "cosimo-event-batch")
                {
                    for (const batched of msg.messages)
                        this.deliverMessageFromServer (batched);

                    return;
                }

                if (msg?.type === "status")
                    msg.message = { manifest: this.manifest, ...msg.message };

                this.deliverMessageFromServer (msg)`;

/**
 * Stops the render thread from generating garbage for nobody: output events
 * without a registered listener are dropped in wasm memory instead of being
 * unpacked into JS payloads, and the events one render block does deliver
 * share one port message (the "cosimo-event-batch" envelope, unwrapped on
 * the main thread) instead of one postMessage per event per listener.
 */
export function poolCosimoAudioWorkletEventDelivery(source) {
    if (!source.includes(generatedConsumeOutputEvents)
        || !source.includes(generatedConsumeOutputEventsConstruction)
        || !source.includes(generatedNodeMessageDelivery)) {
        throw new Error("Could not pool the generated Cmajor AudioWorklet event delivery.");
    }

    return source
        .replace(generatedConsumeOutputEvents, pooledConsumeOutputEvents)
        .replace(generatedConsumeOutputEventsConstruction, pooledConsumeOutputEventsConstruction)
        .replace(generatedNodeMessageDelivery, unbatchingNodeMessageDelivery);
}

const generatedProcessImplConstruction = `                const blockSize = 128;
                const prepareInputFrames = makeInputStreamEndpointHandler (wrapper);
                const processOutputFrames = makeOutputStreamEndpointHandler (wrapper);

                this.processImpl = (input, output) =>
                {
                    prepareInputFrames (input, blockSize);
                    wrapper.advance (blockSize);
                    processOutputFrames (output, blockSize);
                };`;

const schedulingProcessImplConstruction = `                const blockSize = 128;
                const prepareInputFrames = makeInputStreamEndpointHandler (wrapper);
                const processOutputFrames = makeOutputStreamEndpointHandler (wrapper);

                // Sample-accurate scheduled input events. The queue holds
                // {atFrame, endpointID, value, tag} sorted by atFrame in the
                // engine's own frame clock (cosimoBlockStartFrame counts
                // rendered frames since the worklet started). A block with
                // due events renders in segments split at each due frame, so
                // the event lands on its exact sample instead of the block
                // boundary. An empty queue takes the original single-advance
                // path, byte for byte.
                this.cosimoScheduledEvents = [];
                this.cosimoBlockStartFrame = 0;
                let segmentStaging = null;

                const ensureSegmentStaging = (output) =>
                {
                    if (segmentStaging === null || segmentStaging.length < output.length)
                        segmentStaging = Array.from ({ length: output.length }, () => new Float32Array (blockSize));

                    return segmentStaging;
                };

                this.processImpl = (input, output) =>
                {
                    const queue = this.cosimoScheduledEvents;
                    const blockStart = this.cosimoBlockStartFrame;
                    this.cosimoBlockStartFrame = blockStart + blockSize;

                    if (queue.length === 0 || queue[0].atFrame >= blockStart + blockSize)
                    {
                        prepareInputFrames (input, blockSize);
                        wrapper.advance (blockSize);
                        processOutputFrames (output, blockSize);
                        return;
                    }

                    prepareInputFrames (input, blockSize);

                    const staging = ensureSegmentStaging (output);
                    const applied = [];
                    let offset = 0;

                    while (offset < blockSize)
                    {
                        while (queue.length > 0 && queue[0].atFrame <= blockStart + offset)
                        {
                            const event = queue.shift();
                            wrapper[\`sendInputEvent_\${event.endpointID}\`]?.(event.value);
                            applied.push ({
                                endpointID: event.endpointID,
                                tag: event.tag,
                                value: event.value,
                                atFrame: event.atFrame,
                                appliedFrame: blockStart + offset,
                            });
                        }

                        const nextDue = queue.length > 0 ? queue[0].atFrame - blockStart : blockSize;
                        const segmentEnd = Math.min (blockSize, Math.max (offset + 1, nextDue));
                        const segmentFrames = segmentEnd - offset;

                        wrapper.advance (segmentFrames);
                        processOutputFrames (staging, segmentFrames);

                        for (let channel = 0; channel < output.length; ++channel)
                            for (let frame = 0; frame < segmentFrames; ++frame)
                                output[channel][offset + frame] = staging[channel][frame];

                        offset = segmentEnd;
                    }

                    this.port.postMessage ({
                        type: "cosimo-scheduled-applied",
                        currentFrame: this.cosimoBlockStartFrame,
                        events: applied,
                    });
                };`;

const generatedGestureCases = `                        case "send_gesture_start": break;`;

const schedulingGestureCases = `                        case "cosimo-schedule-events":
                        {
                            const incoming = Array.isArray (msg.events) ? msg.events : [];

                            for (const event of incoming)
                            {
                                if (! event || typeof event.endpointID !== "string")
                                    continue;

                                this.cosimoScheduledEvents.push ({
                                    atFrame: Number.isFinite (event.atFrame) ? event.atFrame : 0,
                                    endpointID: event.endpointID,
                                    value: event.value,
                                    tag: typeof event.tag === "string" ? event.tag : null,
                                });
                            }

                            // Stable by arrival within one frame: sort only
                            // compares atFrame, and Array.prototype.sort is
                            // stable, so same-frame events apply in the order
                            // they were scheduled.
                            this.cosimoScheduledEvents.sort ((left, right) => left.atFrame - right.atFrame);
                            this.port.postMessage ({
                                type: "cosimo-schedule-ack",
                                currentFrame: this.cosimoBlockStartFrame,
                                pendingCount: this.cosimoScheduledEvents.length,
                            });
                            break;
                        }

                        case "cosimo-cancel-scheduled-events":
                        {
                            const tag = typeof msg.tag === "string" ? msg.tag : null;
                            this.cosimoScheduledEvents = tag === null
                                ? []
                                : this.cosimoScheduledEvents.filter ((event) => event.tag !== tag);
                            break;
                        }

                        case "send_gesture_start": break;`;

const generatedSendMessageToServer = `    sendMessageToServer (msg)
    {
        this.audioNode.port.postMessage ({ type: "patch", payload: msg });
    }`;

const schedulingSendMessageToServer = `    sendMessageToServer (msg)
    {
        this.audioNode.port.postMessage ({ type: "patch", payload: msg });
    }

    /** Schedules input events at exact engine frames. Each entry is
     *  {atFrame, endpointID, value, tag?}; atFrame at or before the current
     *  frame means "next opportunity". The worklet acks with its current
     *  frame and reports each application ("cosimo-schedule-ack" /
     *  "cosimo-scheduled-applied" on the node's port). */
    cosimoScheduleEvents (events)
    {
        this.audioNode?.port.postMessage ({
            type: "patch",
            payload: { type: "cosimo-schedule-events", events },
        });
    }

    /** Cancels scheduled-but-unapplied events; a tag limits the cancel to
     *  entries scheduled with that tag, no tag clears everything. */
    cosimoCancelScheduledEvents (tag)
    {
        this.audioNode?.port.postMessage ({
            type: "patch",
            payload: { type: "cosimo-cancel-scheduled-events", tag },
        });
    }`;

/**
 * Gives the worklet a sample-accurate event scheduler: input events queued
 * with an absolute engine frame are applied by splitting the 128-frame
 * render at each due frame, so programmatic triggers (auto-preview strikes,
 * sequenced playback) land on exact samples instead of block boundaries and
 * become reproducible. An empty queue renders exactly as before.
 */
export function scheduleCosimoAudioWorkletEvents(source) {
    if (!source.includes(generatedProcessImplConstruction)
        || !source.includes(generatedGestureCases)
        || !source.includes(generatedSendMessageToServer)) {
        throw new Error("Could not add the Cmajor AudioWorklet event scheduler.");
    }

    return source
        .replace(generatedProcessImplConstruction, schedulingProcessImplConstruction)
        .replace(generatedGestureCases, schedulingGestureCases)
        .replace(generatedSendMessageToServer, schedulingSendMessageToServer);
}
