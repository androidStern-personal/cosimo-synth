import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { PolishFullScreenEditor } from "../../ui/desktop/polish-fullscreen-editor";
import { advanceEnhancerSpectrum } from "../../ui/shared/enhancer-spectrum";
import "../../ui/desktop/polish-fullscreen-editor.css";

type ModBarPlacement = "floating" | "parked";

function PolishFullScreenEditorTestHost({
    initialModBarPlacement,
}: {
    readonly initialModBarPlacement: ModBarPlacement;
}) {
    const [open, setOpen] = useState(false);
    const [modBarPlacement, setModBarPlacement] = useState(initialModBarPlacement);
    const [auditionCount, setAuditionCount] = useState(0);
    const [telemetryRevision, setTelemetryRevision] = useState(0);
    const spectrum = useMemo(() => {
        const magnitudes = new Array(2_048).fill(0);
        magnitudes[200] = 1;
        return advanceEnhancerSpectrum(
            { sampleRateHz: 4_096, magnitudes },
            null,
            0,
        );
    }, []);

    Object.assign(window, {
        __POLISH_FULLSCREEN_TEST__: {
            setModBarPlacement,
            auditionCount: () => auditionCount,
            rerenderWithTelemetry: () => setTelemetryRevision((revision) => revision + 1),
        },
    });

    return (
        <main>
            <button type="button" data-role="open-polish-editor" onClick={() => setOpen(true)}>
                Open Polish editor
            </button>
            <PolishFullScreenEditor
                open={open}
                onClose={() => setOpen(false)}
                values={{
                    safeBassAmount: 0.8,
                    enhancerAmount: 0.65,
                    compressionClipAmount: 0.72,
                    outputTrimDb: -1.5,
                }}
                controls={{
                    safeBass: (
                        <button type="button" data-role="approved-polish-control-safe-bass">
                            Safe Bass 80%
                        </button>
                    ),
                    enhancer: (
                        <button type="button" data-role="approved-polish-control-enhancer">
                            Enhance 65%
                        </button>
                    ),
                    comp: (
                        <button type="button" data-role="approved-polish-control-comp">
                            Comp 72%
                        </button>
                    ),
                    outputTrim: (
                        <button type="button" data-role="approved-polish-control-trim">
                            Trim -1.5 dB
                        </button>
                    ),
                }}
                moduleActivity={{
                    safeBass: true,
                    enhancer: true,
                    comp: false,
                    outputTrim: true,
                }}
                moduleActions={{
                    safeBass: (
                        <button type="button" data-role="approved-polish-action-safe-bass">
                            Bypass Safe Bass
                        </button>
                    ),
                    enhancer: (
                        <button type="button" data-role="approved-polish-action-enhancer">
                            Bypass Enhance
                        </button>
                    ),
                    comp: (
                        <button type="button" data-role="approved-polish-action-comp">
                            Enable Comp
                        </button>
                    ),
                    outputTrim: (
                        <button type="button" data-role="approved-polish-action-trim">
                            Bypass Trim
                        </button>
                    ),
                }}
                meter={{
                    peakDbfs: -1.2 - telemetryRevision * 0.01,
                    loudnessDbfs: -13.4,
                    compressorGainReductionDb: -3.6,
                }}
                spectrum={spectrum}
            />
            <div
                data-role="mobile-bottom-dock"
                data-mod-bar-placement={modBarPlacement}
                style={modBarPlacement === "parked"
                    ? {
                        position: "fixed",
                        zIndex: 60,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        height: 48,
                        background: "#15181a",
                    }
                    : {
                        position: "fixed",
                        zIndex: 60,
                        top: 150,
                        right: 0,
                        width: 48,
                        height: 190,
                        background: "#15181a",
                    }}
            >
                <div
                    data-role="mobile-global-mod-rail-portal"
                    style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
                >
                    <button
                        type="button"
                        data-role="test-mod-bar-audition"
                        style={{ width: "100%", minWidth: 44, minHeight: 44 }}
                        onClick={() => setAuditionCount((count) => count + 1)}
                    >
                        Mod
                    </button>
                </div>
            </div>
        </main>
    );
}

/** Mount the controlled T75 surface without supplying a compact Polish implementation. */
export function mountPolishFullScreenEditorTest(
    initialModBarPlacement: ModBarPlacement = "floating",
): void {
    const mount = document.querySelector("#mount");
    if (mount === null) {
        throw new Error("Polish editor test shell is missing #mount.");
    }

    createRoot(mount).render(
        <PolishFullScreenEditorTestHost initialModBarPlacement={initialModBarPlacement} />,
    );
}
