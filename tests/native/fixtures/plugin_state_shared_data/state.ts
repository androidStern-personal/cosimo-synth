// PLUGIN CODE. The kit owns allocation and curve preparation; no product files are imported.
import { definePluginState, parameter, Mseg, nativeValue, Native } from "../../kit/index";

export default definePluginState({
    gain: parameter("gain"),
    shape: Mseg.state(),
    settings: nativeValue({
        codec: Native.record({ enabled: Native.boolean(), mode: Native.choice(["clean", "warm"]), amount: Native.number({ min: 0, max: 2 }) }),
        initial: { enabled: true, mode: "clean", amount: 1 },
    }),
}, { memoryBudgetBytes: 32768 });
