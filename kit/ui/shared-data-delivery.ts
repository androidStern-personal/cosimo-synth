export type SharedDataFormat = "float32" | "bytes";
export type SharedDataView<Format extends SharedDataFormat> = Format extends "float32" ? Float32Array : Uint8Array;

/** Length counts float32 elements or bytes. Omit it when preparation supplies a plan. */
export interface SharedDataDefinition<Format extends SharedDataFormat, Length extends number | undefined = number | undefined> {
    readonly kind: "shared-data";
    readonly type: Format;
    readonly length: Length;
}

/** Declare final writable storage. No allocation is made until preparation succeeds. */
export function sharedData<Format extends SharedDataFormat>(options: { readonly type: Format; readonly length: number }): SharedDataDefinition<Format, number>;
export function sharedData<Format extends SharedDataFormat>(options: { readonly type: Format }): SharedDataDefinition<Format, undefined>;
export function sharedData<Format extends SharedDataFormat>(options: { readonly type: Format; readonly length?: number }): SharedDataDefinition<Format> {
    if ((options.type !== "float32" && options.type !== "bytes")
        || (options.length !== undefined && (!Number.isSafeInteger(options.length) || options.length <= 0)))
        throw new Error("Shared data requires a numeric layout and positive length.");
    if (options.type === "bytes" && options.length !== undefined && options.length % 4 !== 0)
        throw new Error("Cmajor byte resources must occupy complete 32-bit words.");
    return Object.freeze({ kind: "shared-data", type: options.type, length: options.length });
}
