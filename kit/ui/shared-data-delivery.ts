import type { PluginStateDelivery, PluginStateDeliveryContext } from "./plugin-state-definition";
import type { PluginStatePrepareContext, PluginStatePreparationFailure } from "./plugin-state-definition";

export type SharedDataFormat = "float32" | "bytes";
export type SharedDataView<Format extends SharedDataFormat> = Format extends "float32" ? Float32Array : Uint8Array;

/** Length is elements for float32, bytes for bytes. No storage is allocated by a declaration. */
export interface SharedDataDefinition<Value, Format extends SharedDataFormat> {
    readonly kind: "shared-data";
    readonly type: Format;
    readonly length: number | ((value: Value, context: PluginStatePrepareContext) => number | PluginStatePreparationFailure | Promise<number | PluginStatePreparationFailure>);
}

/** Declare final writable storage for preparedState. The build assigns named
 * resources; the state definition supplies one explicit memory budget.
 * The input-only overload preserves compatibility with older complete-buffer
 * delivery implementations; new code should use a typed storage declaration.
 */
export function sharedData<Value, Format extends SharedDataFormat>(options: {
    readonly type: Format;
    readonly length: SharedDataDefinition<Value, Format>["length"];
}): SharedDataDefinition<Value, Format>;
export function sharedData(options: { readonly input: number }): PluginStateDelivery<Float32Array>;
export function sharedData<Value, Format extends SharedDataFormat>(options: {
    readonly type: Format; readonly length: SharedDataDefinition<Value, Format>["length"];
} | { readonly input: number }): SharedDataDefinition<Value, Format> | PluginStateDelivery<Float32Array> {
    if ("type" in options) {
        if ((options.type !== "float32" && options.type !== "bytes")
            || (typeof options.length !== "function" && (!Number.isSafeInteger(options.length) || options.length <= 0)))
            throw new Error("Shared data requires a numeric layout and positive length.");
        if (options.type === "bytes" && typeof options.length === "number" && options.length % 4 !== 0)
            throw new Error("Cmajor byte resources must occupy complete 32-bit words.");
        return Object.freeze({ kind: "shared-data", ...options });
    }
    const { input } = options;
    if (!Number.isSafeInteger(input) || input < 0 || input > 0x7fffffff) throw new Error("Invalid shared-data input.");
    return Object.freeze({
        eventEndpoints: Object.freeze([]),
        dataInputs: Object.freeze([input]),
        create: () => ({ apply: (samples: Float32Array, context: PluginStateDeliveryContext) => context.replaceData(input, samples), stop() {} }),
    });
}
