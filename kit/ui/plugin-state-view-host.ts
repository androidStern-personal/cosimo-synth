import type { PluginStateFields } from "./plugin-state-definition";
import type { createPluginStateClient } from "./plugin-state-client";

/** Internal connection capability: silent hosts compose the real owner and client. */
export const pluginStateViewHost = Symbol.for("builder-kit.plugin-state-view-host");

/** Framework host composition, deliberately absent from the public author entry. */
export interface PluginStateViewHost {
    [pluginStateViewHost](definition: PluginStateFields, onDefect: (error: unknown) => void): ReturnType<typeof createPluginStateClient<PluginStateFields>>;
}

/** Check the capability at the existing patch connection boundary. */
export function isPluginStateViewHost(connection: object): connection is PluginStateViewHost {
    return pluginStateViewHost in connection && typeof connection[pluginStateViewHost] === "function";
}
