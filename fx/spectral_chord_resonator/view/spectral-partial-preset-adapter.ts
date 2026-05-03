import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import type { EffectStoredStateAdapter } from "../../../ui/shared/effects/effect-preset-v2";
import {
    SPECTRAL_PARTIAL_SCHEMA_VERSION,
    SPECTRAL_PARTIAL_STATE_KEY,
    parseStrictSpectralPartialStateV1,
    serializeSpectralPartialState,
} from "./spectral-partial-state";
import type { SpectralPartialShapeRuntimeBridge } from "./spectral-partial-runtime-bridge";

export function createSpectralPartialPresetStateAdapter({
    bridge,
    patchConnection: _patchConnection,
}: {
    bridge: SpectralPartialShapeRuntimeBridge;
    patchConnection: PatchConnectionLike;
}): EffectStoredStateAdapter {
    return {
        key: SPECTRAL_PARTIAL_STATE_KEY,
        schemaVersion: SPECTRAL_PARTIAL_SCHEMA_VERSION,
        getContract() {
            return {
                key: SPECTRAL_PARTIAL_STATE_KEY,
                schemaVersion: SPECTRAL_PARTIAL_SCHEMA_VERSION,
                required: true,
            };
        },
        capture() {
            return serializeSpectralPartialState(bridge.getState());
        },
        normalizeForPreset(value: unknown) {
            return serializeSpectralPartialState(parseStrictSpectralPartialStateV1(value));
        },
        serializeForPreset(value: unknown) {
            return serializeSpectralPartialState(parseStrictSpectralPartialStateV1(value));
        },
        apply(value: unknown) {
            bridge.replaceStateFromPreset(parseStrictSpectralPartialStateV1(value));
        },
        subscribe(listener: () => void) {
            return bridge.subscribe(() => listener());
        },
    };
}
