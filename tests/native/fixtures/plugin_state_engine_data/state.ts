import { definePluginState, preparedState, engineData, type PluginStateCodec } from "../../kit/index";

type Shape = { readonly base: number; readonly step: number };
const schema: PluginStateCodec<Shape> = {
    parse(value) {
        if (value === null || typeof value !== "object" || !("base" in value) || !("step" in value)
            || typeof value.base !== "number" || typeof value.step !== "number"
            || !Number.isInteger(value.base) || !Number.isInteger(value.step)
            || Math.abs(value.base) > 1_000_000 || Math.abs(value.step) > 1000)
            return { kind: "error", message: "Expected a bounded integral shape." };
        return { kind: "ok", value: Object.freeze({ base: value.base, step: value.step }) };
    },
    encode: value => ({ base: value.base, step: value.step }),
    equals: (left, right) => left.base === right.base && left.step === right.step,
};

// Author code supplies layout and editable state. The generated worker owns
// transfer; the compiled Cmajor fixture below owns storage and DSP reads.
export default definePluginState({ shape: preparedState({
    schema, initial: { base: 100, step: 1 },
    prepare: shape => Int32Array.from({ length: 257 }, (_, index) => shape.base + index * shape.step),
    engine: engineData({ wordCapacity: 257, chunkCapacity: 32,
        endpoints: { begin: "begin", chunk: "chunk", commit: "commit", query: "query", receipt: "receipt" },
    }),
}) });
