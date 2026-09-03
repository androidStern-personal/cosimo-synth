import type { PatchConnectionLike, EffectStoredStateAdapter } from "../../../kit/index";
import {
    SEQFX_STATE_KEY,
    SEQFX_STATE_VERSION,
    parseSeqFxStoredState,
    serializeSeqFxState,
} from "./seqfx-state";
import type { SeqFxRuntimeBridge } from "./seqfx-runtime-bridge";

export function createSeqFxPresetStateAdapter({
    bridge,
    patchConnection: _patchConnection,
}: {
    bridge: SeqFxRuntimeBridge;
    patchConnection: PatchConnectionLike;
}): EffectStoredStateAdapter {
    return {
        key: SEQFX_STATE_KEY,
        schemaVersion: SEQFX_STATE_VERSION,
        getContract() {
            return {
                key: SEQFX_STATE_KEY,
                schemaVersion: SEQFX_STATE_VERSION,
                required: true,
            };
        },
        capture() {
            return serializeSeqFxState(bridge.getState());
        },
        normalizeForPreset(value: unknown) {
            return serializeSeqFxState(parseSeqFxStoredState(value).state);
        },
        serializeForPreset(value: unknown) {
            return serializeSeqFxState(parseSeqFxStoredState(value).state);
        },
        apply(value: unknown) {
            bridge.replaceStateFromPreset(value);
        },
        subscribe(listener: () => void) {
            return bridge.subscribe(() => listener());
        },
    };
}
