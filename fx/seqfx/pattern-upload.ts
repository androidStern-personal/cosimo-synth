import type { PluginStateDelivery } from "../../kit/ui/plugin-state-definition";
import type { SeqPatternContent } from "./view/seqfx-state";

/** What preparation hands the delivery: the selected pattern's steps, and whether they replace the sound outright. */
export type SeqFxPatternUpload = {
    readonly content: SeqPatternContent;
    /** A loaded project or a recalled preset or snapshot. The DSP then clears captured audio, such as a held stutter buffer. */
    readonly replacesSound: boolean;
};

// The DSP ignores an ordinary upload older than one it has accepted for that pattern,
// so revisions keep rising for as long as this plugin instance runs, across every project it loads.
let revision = 0;

/** Sends the selected pattern to the DSP's `patternUpload` event. */
export const patternUploadDelivery: PluginStateDelivery<SeqFxPatternUpload> = {
    eventEndpoints: ["patternUpload"],
    create() {
        return {
            async apply(upload, context) {
                revision += 1;
                const submitted = context.send({
                    kind: "event",
                    endpoint: "patternUpload",
                    value: { ...upload.content, revision, authoritative: upload.replacesSound },
                });
                return submitted.kind === "submitted" ? await submitted.completion : submitted;
            },
            stop() {},
        };
    },
};
