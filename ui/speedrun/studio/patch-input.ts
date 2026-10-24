import { presetFileText } from "../../../kit/ui/presets";
import { ARTICULATIONS_V4_STATE_KEY, serializeArticulationsV4 } from "../../shared/articulation-image";
import { MODULATION_STATE_KEY, serializeModulationState } from "../../shared/modulation";
import { LANE_STATE_KEY } from "../../shared/lane-state";
import { serializeLaneStateV2 } from "../../shared/lane-state-v2";
import {
    SoundShareError,
    SYNTH_PLUGIN_ID,
    createSoundShareURL,
    decodeSoundShareFragment,
    type CreatedSoundShareURL,
    type SoundShareErrorTag,
} from "../../shared/sound-share-link";
import { validateSoundShareWavetables } from "../../shared/sound-share-wavetable";
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
        if (selection.kind === "current") {
            const currentSound = readBrowserPatchState();
            if (currentSound === null) throw new Error("No complete browser sound has been saved yet.");
            return currentSound;
        }
        if (selection.kind === "file") return JSON.parse(await selection.file.text()) as unknown;

        const raw = selection.value.trim();
        if (raw.length === 0) throw new Error("Paste a Cosimo share link first.");
        let fragment: string;
        if (raw.startsWith("#p=")) fragment = raw;
        else fragment = new URL(raw).hash;
        const decoded = await decodeSoundShareFragment(fragment);
        if (!decoded.ok) throw decoded.error;
        if (decoded.value === null) throw new Error("That URL does not contain a Cosimo sound fragment.");
        return JSON.parse(decoded.value) as unknown;
    } catch (error) {
        throw studioError("intake", "PatchSelectionFailed", error, "The selected patch could not be read.");
    }
}

/**
 * The preset file a sound link carries: the synth's saved form of this document.
 * Bounce owns the source mode, so a preset never carries it.
 */
export function createStudioSharePresetFile(document: PatchDocument): string {
    const parameters = Object.fromEntries(Object.entries(document.parameters).filter(([endpointID]) => endpointID !== "sourceMode"));
    return presetFileText(SYNTH_PLUGIN_ID, {
        name: document.label,
        values: {
            ...parameters,
            [MODULATION_STATE_KEY]: serializeModulationState(document.modulation),
            [ARTICULATIONS_V4_STATE_KEY]: JSON.stringify(serializeArticulationsV4(document.articulations)),
            [LANE_STATE_KEY]: serializeLaneStateV2(document.lane),
        },
    });
}

export async function createStudioShareLink(
    document: PatchDocument,
    runtime: SpeedrunStudioRuntime,
): Promise<StudioShareLinkAvailability> {
    try {
        const wavetableResult = validateSoundShareWavetables(document.parameters, runtime.catalog.tables);
        if (!wavetableResult.ok) {
            return {
                _tag: "unavailable",
                code: wavetableResult.error._tag,
                message: wavetableResult.error.message,
            };
        }
        const baseURL = new URL(runtime.webRootURL);
        baseURL.search = "";
        baseURL.hash = "";
        const result = await createSoundShareURL(createStudioSharePresetFile(document), baseURL.href);
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
