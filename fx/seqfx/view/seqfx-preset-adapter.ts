import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import type { EffectStoredStateAdapter } from "../../../ui/shared/effects/effect-preset-v2";
import {
    SEQFX_STATE_KEY,
    parseStrictSeqFxStateV3,
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
        schemaVersion: 3,
        getContract() {
            return {
                key: SEQFX_STATE_KEY,
                schemaVersion: 3,
                required: true,
            };
        },
        capture() {
            return serializeSeqFxState(bridge.getState());
        },
        normalizeForPreset(value: unknown) {
            return serializeSeqFxState(parseStrictSeqFxStateV3(value));
        },
        serializeForPreset(value: unknown) {
            return serializeSeqFxState(parseStrictSeqFxStateV3(value));
        },
        apply(value: unknown) {
            bridge.replaceStateFromPreset(parseStrictSeqFxStateV3(value));
        },
        subscribe(listener: () => void) {
            return bridge.subscribe(() => listener());
        },
    };
}
