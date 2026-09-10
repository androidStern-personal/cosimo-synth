import type { PluginStateDelivery, PluginStateDeliveryContext } from "./plugin-state-definition";

/** Deliver prepared samples to a Cmajor shared-data input. The manifest supplies
 * the input count and memory budget; the framework owns allocation and lifetime.
 * prepare must return a buffer it no longer mutates or reuses. This permits
 * bounded transfer without making another copy of the whole prepared value.
 */
export function sharedData({ input }: { readonly input: number }): PluginStateDelivery<Float32Array> {
    if (!Number.isSafeInteger(input) || input < 0 || input > 0x7fffffff) throw new Error("Invalid shared-data input.");
    return Object.freeze({
        eventEndpoints: Object.freeze([]),
        dataInputs: Object.freeze([input]),
        create: () => ({ apply: (samples: Float32Array, context: PluginStateDeliveryContext) => context.replaceData(input, samples), stop() {} }),
    });
}
