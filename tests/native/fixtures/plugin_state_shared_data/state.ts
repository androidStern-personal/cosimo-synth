// PLUGIN CODE. The kit owns allocation and curve preparation; no product files are imported.
import { definePluginState, parameter, Mseg, nativeValue, Native, preparedState, sharedData, type PluginStateCodec } from "../../kit/index";

const fileCodec: PluginStateCodec<string> = {
    parse: value => typeof value === "string" ? { kind: "ok", value } : { kind: "error", message: "Expected a sample file." },
    encode: value => value,
    equals: (a, b) => a === b,
};

export default definePluginState({
    gain: parameter("gain"),
    shape: Mseg.state(),
    // Customer-defined data, loaded once per operation. The framework provides
    // file access, final writable storage, cancellation and atomic publication.
    loaded: preparedState({
        codec: fileCodec, initial: "ascending.json",
        engine: sharedData({ type: "float32" }),
        async prepare(file, { resources }) {
            const values: unknown = JSON.parse(await resources.readText(file));
            if (!Array.isArray(values) || !values.every(value => typeof value === "number" && Number.isFinite(value)))
                throw new Error("Invalid sample file");
            return { length: values.length, write(destination) { destination.set(values); } };
        },
    }),
    settings: nativeValue({
        codec: Native.record({ enabled: Native.boolean(), mode: Native.choice(["clean", "warm"]), amount: Native.number({ min: 0, max: 2 }) }),
        initial: { enabled: true, mode: "clean", amount: 1 },
    }),
}, { memoryBudgetBytes: 32768 });
