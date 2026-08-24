import { serializeArticulationsV4 } from "../../shared/articulation-image";
import { ARTICULATIONS_V4_STATE_KEY } from "../../shared/articulation-image";
import { MODULATION_STATE_KEY } from "../../shared/modulation";
import type { EffectPresetV2 } from "../../shared/effects/effect-preset-v2";
import { LANE_STATE_KEY } from "../../shared/lane-state";
import { serializeLaneStateV2 } from "../../shared/lane-state-v2";
import { serializeModulationState } from "../../shared/modulation";
import {
    SoundShareError,
    createSoundShareEnvelope,
    type SoundShareErrorTag,
} from "../../shared/sound-share-envelope";
import { createSoundShareURL, decodeSoundShareFragment } from "../../shared/sound-share-link";
import type { CreatedSoundShareURL } from "../../shared/sound-share-link";
import { readBrowserPatchState } from "../../../web/browser-patch-state.mjs";
import type { PatchDocument } from "../patch-io";
import type { SpeedrunStudioRuntime } from "./runtime";
import { studioError } from "./errors";

export type StudioPatchSelection =
    | { readonly kind: "current" }
    | { readonly kind: "file"; readonly file: File }
    | { readonly kind: "share"; readonly value: string };

export type StudioShareLinkAvailability =
    | { readonly _tag: "available"; readonly link: CreatedSoundShareURL }
    | {
        readonly _tag: "unavailable";
        readonly code: SoundShareErrorTag | "ShareLinkFailed";
        readonly message: string;
    };

export async function readStudioPatchSelection(selection: StudioPatchSelection): Promise<unknown> {
    try {
        if (selection.kind === "current") return readBrowserPatchState();
        if (selection.kind === "file") return JSON.parse(await selection.file.text()) as unknown;

        const raw = selection.value.trim();
        if (raw.length === 0) throw new Error("Paste a Cosimo share link first.");
        let fragment: string;
        if (raw.startsWith("#p=")) fragment = raw;
        else fragment = new URL(raw).hash;
        const decoded = await decodeSoundShareFragment(fragment);
        if (!decoded.ok) throw decoded.error;
        if (decoded.value === null) throw new Error("That URL does not contain a Cosimo sound fragment.");
        return decoded.value;
    } catch (error) {
        throw studioError("intake", "PatchSelectionFailed", error, "The selected patch could not be read.");
    }
}

function presetForDocument(document: PatchDocument, runtime: SpeedrunStudioRuntime): EffectPresetV2 {
    return {
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: runtime.intakeOptions.currentContract.effectID,
        presetID: "cosimo.speedrun.current",
        label: document.label,
        contract: runtime.intakeOptions.currentContract,
        parameters: { ...document.parameters },
        storedState: {
            [MODULATION_STATE_KEY]: serializeModulationState(document.modulation),
            [ARTICULATIONS_V4_STATE_KEY]: serializeArticulationsV4(document.articulations),
            "bounce.v1": null,
        },
    };
}

/** Build the exact M1 carrier used by the studio's adjacent share action. */
export function createStudioShareEnvelope(
    document: PatchDocument,
    runtime: SpeedrunStudioRuntime,
) {
    return createSoundShareEnvelope({
        preset: presetForDocument(document, runtime),
        supplementalStoredState: {
            [LANE_STATE_KEY]: serializeLaneStateV2(document.lane),
        },
    });
}

export async function createStudioShareLink(
    document: PatchDocument,
    runtime: SpeedrunStudioRuntime,
): Promise<StudioShareLinkAvailability> {
    try {
        const envelope = createStudioShareEnvelope(document, runtime);
        const baseURL = new URL(runtime.webRootURL);
        baseURL.search = "";
        baseURL.hash = "";
        const result = await createSoundShareURL(envelope, baseURL.href);
        if (!result.ok) {
            return {
                _tag: "unavailable",
                code: result.error._tag,
                message: result.error.message,
            };
        }
        return { _tag: "available", link: result.value };
    } catch (error) {
        return {
            _tag: "unavailable",
            code: error instanceof SoundShareError ? error._tag : "ShareLinkFailed",
            message: error instanceof Error && error.message.length > 0
                ? error.message
                : "A share link could not be created for this sound.",
        };
    }
}
