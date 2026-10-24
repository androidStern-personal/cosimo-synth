import { definePluginState, parameter, nativeValue, Native } from "../../kit/index";
export default definePluginState({
    gain: parameter("gain"),
    workerLevel: nativeValue({ codec: Native.number({ min: 0, max: 2 }), initial: 1 }),
}, { memoryBudgetBytes: 1024 });
