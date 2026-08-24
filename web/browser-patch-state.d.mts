export type BrowserPatchState = {
    readonly format: "cosimo.browserPatchState";
    readonly version: 2;
    readonly sound: {
        readonly parameters: Readonly<Record<string, number>>;
        readonly storedState: Readonly<Record<string, unknown>>;
    };
    readonly auxiliary: Readonly<Record<string, unknown>>;
};

export function readBrowserPatchState(options?: {
    readonly storage?: Storage;
    readonly storageKey?: string;
}): BrowserPatchState;
