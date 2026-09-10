import { useEffect, useRef, useState, type ReactNode } from "react";

import {
    createCmajorPluginStateClient,
    type CmajorStateConnection,
} from "../../kit/ui/plugin-state-cmajor";
import { PluginStateProvider, usePluginState } from "../../kit/ui/plugin-state-react";
import type { PatchConnectionLike } from "./cmajor-react";
import type { PatchControlBinding } from "./patch-controls";
import { synthPluginState } from "./synth-plugin-state";

type SynthStateClient = ReturnType<typeof createCmajorPluginStateClient<typeof synthPluginState>>;
type ViewConnection =
    | { readonly kind: "connected"; readonly patchConnection: PatchConnectionLike; readonly client: SynthStateClient }
    | { readonly kind: "failed"; readonly patchConnection: PatchConnectionLike };

function hasStateChannel(connection: PatchConnectionLike): connection is PatchConnectionLike & CmajorStateConnection {
    return "addEventListener" in connection && typeof connection.addEventListener === "function"
        && "removeEventListener" in connection && typeof connection.removeEventListener === "function"
        && "sendMessageToServer" in connection && typeof connection.sendMessageToServer === "function";
}

/** Keep one state client for the complete synth view, including closed popovers. */
export function SynthStateProvider({ patchConnection, children }: {
    readonly patchConnection: PatchConnectionLike;
    readonly children: ReactNode;
}) {
    const [viewConnection, setViewConnection] = useState<ViewConnection | null>(null);

    useEffect(() => {
        if (!hasStateChannel(patchConnection)) {
            setViewConnection({ kind: "failed", patchConnection });
            return;
        }
        const client = createCmajorPluginStateClient(synthPluginState, patchConnection, {
            onDefect: error => console.error("Cosimo Voice state failed", error),
        });
        setViewConnection({ kind: "connected", patchConnection, client });
        return () => client.stop();
    }, [patchConnection]);

    if (viewConnection?.patchConnection !== patchConnection) {
        return <div role="status">Connecting Voice controls…</div>;
    }
    if (viewConnection.kind === "failed") {
        return <div role="alert">Voice controls require the current plugin state runtime.</div>;
    }
    return <PluginStateProvider definition={synthPluginState} client={viewConnection.client}>
        {children}
    </PluginStateProvider>;
}

/** Translate the state hook to the synth's established control interface. */
export function useSynthPluginParameterBinding(key: keyof typeof synthPluginState, options: {
    readonly initialValue: number;
    readonly coerce: (rawValue: unknown) => number;
}): PatchControlBinding<number> {
    const parameter = usePluginState(synthPluginState[key]);
    const firstHostValue = useRef<{ readonly key: typeof key; readonly value: number } | null>(null);
    if (parameter.state.kind === "ready" && firstHostValue.current?.key !== key) {
        firstHostValue.current = { key, value: options.coerce(parameter.state.value) };
    }
    const isReady = parameter.state.kind === "ready";
    return {
        endpointID: synthPluginState[key].endpoint,
        value: parameter.state.kind === "ready" ? options.coerce(parameter.state.value) : options.initialValue,
        initialValue: parameter.state.kind === "ready"
            ? options.coerce(parameter.state.metadata?.defaultValue ?? options.initialValue)
            : options.initialValue,
        isReady,
        hostBaseline: isReady && firstHostValue.current?.key === key
            ? { _tag: "host-confirmed", value: firstHostValue.current.value }
            : { _tag: "pending" },
        setValue() {},
        commitValue() {},
        beginGesture() {},
        endGesture() {},
    };
}
