import { serializeArticulationsV4 } from "../../shared/articulation-image";
import type { EffectPresetV2 } from "../../shared/effects/effect-preset-v2";
import { LANE_STATE_KEY } from "../../shared/lane-state";
import { serializeLaneStateV2 } from "../../shared/lane-state-v2";
import { serializeModulationState } from "../../shared/modulation";
import { createSoundShareEnvelope } from "../../shared/sound-share-envelope";
import { createSoundShareURL, decodeSoundShareFragment } from "../../shared/sound-share-link";
import { readBrowserPatchState } from "../../../web/browser-patch-state.mjs";
import type { PatchDocument } from "../patch-io";
import type { SpeedrunStudioRuntime } from "./runtime";
import { SpeedrunStudioError, studioError } from "./errors";

export type StudioPatchSelection =
    | { readonly kind: "current" }
    | { readonly kind: "file"; readonly file: File }
    | { readonly kind: "share"; readonly value: string };

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
            "modulation.v6": serializeModulationState(document.modulation),
            "articulations.v4": serializeArticulationsV4(document.articulations),
            "bounce.v1": null,
        },
    };
}

export async function createStudioShareLink(
    document: PatchDocument,
    runtime: SpeedrunStudioRuntime,
) {
    try {
        const envelope = createSoundShareEnvelope({
            preset: presetForDocument(document, runtime),
            supplementalStoredState: {
                [LANE_STATE_KEY]: serializeLaneStateV2(document.lane),
            },
        });
        const baseURL = new URL(runtime.webRootURL);
        baseURL.search = "";
        baseURL.hash = "";
        const result = await createSoundShareURL(envelope, baseURL.href);
        if (!result.ok) throw result.error;
        return result.value;
    } catch (error) {
        if (error instanceof SpeedrunStudioError) throw error;
        throw studioError("intake", "ShareLinkFailed", error, "A share link could not be created for this sound.");
    }
}
