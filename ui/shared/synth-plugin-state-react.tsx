import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
    createCmajorPluginStateClient,
    type CmajorStateConnection,
} from "../../kit/ui/plugin-state-cmajor";
import { PluginStateProvider, usePluginState } from "../../kit/ui/plugin-state-react";
import type { PluginStateEditResult } from "../../kit/index";
import type { PatchConnectionLike } from "./cmajor-react";
import type { PatchControlBinding } from "./patch-controls";
import { synthPluginState } from "./synth-plugin-state";
import {
    captureUserEditReporter,
    type UserEditReporter,
} from "./user-edit-bus";

type SynthStateClient = ReturnType<typeof createCmajorPluginStateClient<typeof synthPluginState>>;
type ViewConnection =
    | { readonly kind: "connected"; readonly patchConnection: PatchConnectionLike; readonly client: SynthStateClient }
    | { readonly kind: "failed"; readonly patchConnection: PatchConnectionLike };

function reportStateDefect(error: unknown) {
    console.error("Cosimo Voice state failed", error instanceof Error ? error.stack ?? error.message : String(error));
}

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
            onDefect: reportStateDefect,
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
    const value = parameter.state.kind === "ready" ? options.coerce(parameter.state.value) : options.initialValue;
    const initialValue = parameter.state.kind === "ready"
        ? options.coerce(parameter.state.metadata?.defaultValue ?? options.initialValue)
        : options.initialValue;
    const endpointID = synthPluginState[key].endpoint;
    const presentation = useRef({ isReady, coerce: options.coerce });
    presentation.current = { isReady, coerce: options.coerce };
    const reportingGesture = useRef<{ readonly reporter: UserEditReporter; started: boolean } | null>(null);
    const notifications = useRef<Promise<void> | null>(null);

    // Commands are already dispatched. Only their edit-bus notifications wait
    // here, preserving begin/edit/end order while the client owns ticket lifetime.
    const reportAfter = useCallback((
        command: Promise<PluginStateEditResult> | undefined,
        report: (result: PluginStateEditResult | undefined) => void,
    ) => {
        const settled = command?.catch(error => { reportStateDefect(error); return undefined; });
        notifications.current = (notifications.current ?? Promise.resolve())
            .then(() => settled)
            .then(report)
            .catch(reportStateDefect);
    }, []);

    const setValue = useCallback((nextValue: number) => {
        const current = presentation.current;
        if (!current.isReady) return;
        const coercedValue = current.coerce(nextValue);
        const reporter = captureUserEditReporter();
        reportAfter(parameter.setValue(coercedValue), result => {
            if (result?.kind !== "accepted") return;
            if (typeof result.changed !== "boolean") {
                reportStateDefect(new Error("An accepted Voice edit did not report whether its value changed."));
                return;
            }
            reporter.parameterEdit({ endpointID, changed: result.changed });
        });
    }, [endpointID, parameter.setValue, reportAfter]);

    const beginGesture = useCallback(() => {
        if (!presentation.current.isReady || reportingGesture.current) return;
        const gesture = { reporter: captureUserEditReporter(), started: false };
        reportingGesture.current = gesture;
        reportAfter(parameter.beginGesture(), result => {
            if (result?.kind !== "accepted") return;
            gesture.started = true;
            gesture.reporter.gestureStart();
        });
    }, [parameter.beginGesture, reportAfter]);

    const endGesture = useCallback(() => {
        const gesture = reportingGesture.current;
        if (!gesture) return;
        reportingGesture.current = null;
        reportAfter(parameter.endGesture(), () => {
            // A view closing or a native restore can interrupt the end receipt;
            // every reported start still closes its local audition group once.
            if (!gesture.started) return;
            gesture.started = false;
            gesture.reporter.gestureEnd();
        });
    }, [parameter.endGesture, reportAfter]);
    useEffect(() => endGesture, [endGesture]);

    const commitValue = useCallback((nextValue: number) => {
        beginGesture();
        setValue(nextValue);
        endGesture();
    }, [beginGesture, endGesture, setValue]);

    return useMemo(() => ({
        endpointID,
        value,
        initialValue,
        isReady,
        hostBaseline: isReady && firstHostValue.current?.key === key
            ? { _tag: "host-confirmed" as const, value: firstHostValue.current.value }
            : { _tag: "pending" as const },
        setValue,
        commitValue,
        beginGesture,
        endGesture,
    }), [beginGesture, commitValue, endGesture, endpointID, initialValue, isReady, key, setValue, value]);
}
