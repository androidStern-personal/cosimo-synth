import { useEffect, useState } from "react";
import { usePatchConnection } from "../cmajor-react";
import {
    acquireEffectPresetRuntimeBridge,
    releaseEffectPresetRuntimeBridge,
    type EffectPresetRuntimeBridge,
} from "./effect-preset-store";
import {
    createDefaultEffectPresetState,
    type EffectPresetState,
} from "./effect-preset-schema";

export function useEffectPresets() {
    const patchConnection = usePatchConnection();
    const [state, setState] = useState<EffectPresetState>(() => createDefaultEffectPresetState());
    const [bridge, setBridge] = useState<EffectPresetRuntimeBridge | null>(null);

    useEffect(() => {
        const nextBridge = acquireEffectPresetRuntimeBridge(patchConnection);
        setBridge(nextBridge);
        setState(nextBridge.getState());
        nextBridge.subscribe(setState);

        return () => {
            nextBridge.unsubscribe(setState);
            releaseEffectPresetRuntimeBridge(patchConnection);
            setBridge(null);
        };
    }, [patchConnection]);

    return {
        state,
        bridge,
    };
}
