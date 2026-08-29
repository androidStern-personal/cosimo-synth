import type { EffectParameterValue } from "./effects/effect-state-contract";
import { OSCILLATOR_BINDING_CONTRACTS } from "./oscillator-binding";
import {
    SoundShareError,
    type SoundShareResult,
} from "./sound-share-envelope";

/** One shipped factory-table identity at its stable selector slot. */
export type ShippedWavetableTable = {
    readonly tableId: string;
};

/**
 * Prove that every oscillator selector resolves through the factory catalog
 * shipped by the current browser surface.
 *
 * ADR-021 makes the ordered catalog slot the durable host parameter identity;
 * the table id proves that the slot is occupied by a shipped table rather than
 * a custom or unavailable runtime resource.
 */
export function validateSoundShareWavetables(
    parameters: Readonly<Record<string, EffectParameterValue>>,
    shippedTables: ReadonlyArray<ShippedWavetableTable>,
): SoundShareResult<undefined> {
    if (shippedTables.length === 0) {
        return {
            ok: false,
            error: new SoundShareError(
                "UnavailableWavetable",
                "Wavetable availability is not ready. Wait for the factory library before sharing or loading a sound link.",
            ),
        };
    }

    for (const oscillator of OSCILLATOR_BINDING_CONTRACTS) {
        const selector = oscillator.controls.find((control) => control.controlID === "wavetableSelect");
        if (selector === undefined) {
            throw new Error(`Oscillator ${oscillator.id} has no wavetable selector in the binding contract.`);
        }

        const tableIndex = parameters[selector.endpointID];
        const table = typeof tableIndex === "number" && Number.isInteger(tableIndex) && tableIndex >= 0
            ? shippedTables[tableIndex]
            : undefined;
        if (table === undefined || typeof table.tableId !== "string" || table.tableId.length === 0) {
            return {
                ok: false,
                error: new SoundShareError(
                    "UnavailableWavetable",
                    `This sound uses an unavailable wavetable for Oscillator ${oscillator.id}. Only factory wavetables shipped in this browser can be shared by link.`,
                ),
            };
        }
    }

    return { ok: true, value: undefined };
}
