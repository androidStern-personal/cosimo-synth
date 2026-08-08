const generatedProcessBlock = `        process (inputs, outputs)
        {
            const input = inputs[0];
            const output = outputs[0];

            this.processImpl?.(input, output);
            this.consumeOutputEvents?.();

            return true;
        }`;

const generatedMessageSwitch = `                    switch (msg.type)
                    {
                        case "req_status":`;

const instrumentedMessageSwitch = `                    switch (msg.type)
                    {
                        case "cosimo-perf-config":
                            this.cosimoPerfEnabled = msg.enabled === true;
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

            this.processImpl?.(input, output);
            this.consumeOutputEvents?.();

            const finishedAt = globalThis.performance ? globalThis.performance.now() : Date.now();
            const elapsedMs = Math.max (0, finishedAt - startedAt);
            const blockFrames = output?.[0]?.length || 128;
            const budgetMs = (blockFrames / sampleRate) * 1000;
            this.cosimoPerfBlockCount = (this.cosimoPerfBlockCount || 0) + 1;
            this.cosimoPerfLoadSum = (this.cosimoPerfLoadSum || 0) + (elapsedMs / budgetMs);
            this.cosimoPerfMaxLoad = Math.max (this.cosimoPerfMaxLoad || 0, elapsedMs / budgetMs);
            this.cosimoPerfOverBudgetBlocks = (this.cosimoPerfOverBudgetBlocks || 0) + (elapsedMs > budgetMs ? 1 : 0);
            if (this.cosimoPerfBlockCount >= 256)
            {
                this.port.postMessage ({
                    type: "cosimo-perf",
                    averageLoad: this.cosimoPerfLoadSum / this.cosimoPerfBlockCount,
                    maxLoad: this.cosimoPerfMaxLoad,
                    overBudgetBlocks: this.cosimoPerfOverBudgetBlocks,
                    blockCount: this.cosimoPerfBlockCount,
                });
                this.cosimoPerfBlockCount = 0;
                this.cosimoPerfLoadSum = 0;
                this.cosimoPerfMaxLoad = 0;
                this.cosimoPerfOverBudgetBlocks = 0;
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
    if (!source.includes(generatedProcessBlock) || !source.includes(generatedMessageSwitch)) {
        throw new Error("Could not instrument the generated Cmajor AudioWorklet process block.");
    }

    return source
        .replace(generatedMessageSwitch, instrumentedMessageSwitch)
        .replace(generatedProcessBlock, instrumentedProcessBlock);
}
