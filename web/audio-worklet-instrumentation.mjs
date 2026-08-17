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
