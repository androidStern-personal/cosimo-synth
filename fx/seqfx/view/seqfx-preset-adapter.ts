import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import type { EffectStoredStateAdapter } from "../../../ui/shared/effects/effect-preset-v2";
import {
    SEQFX_STATE_KEY,
    parseStrictSeqFxStateV5,
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
        schemaVersion: 5,
        getContract() {
            return {
                key: SEQFX_STATE_KEY,
                schemaVersion: 5,
                required: true,
            };
        },
        capture() {
            return serializeSeqFxState(bridge.getState());
        },
        normalizeForPreset(value: unknown) {
            return serializeSeqFxState(parseStrictSeqFxStateV5(value));
        },
        serializeForPreset(value: unknown) {
            return serializeSeqFxState(parseStrictSeqFxStateV5(value));
        },
        apply(value: unknown) {
            bridge.replaceStateFromPreset(parseStrictSeqFxStateV5(value));
        },
        subscribe(listener: () => void) {
            return bridge.subscribe(() => listener());
        },
    };
}
