import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    CosimoCaptureFrame,
    type CosimoCaptureFrameState,
    CINEMATIC3D_CAPTURE_HEIGHT,
    CINEMATIC3D_CAPTURE_WIDTH,
} from "./CosimoCaptureFrame";
import { CosimoRaisedPanelScene } from "./CosimoRaisedPanelScene";
import type { CaptureLayoutPx } from "./measurePanels";
import { cropPanelCanvases } from "./panelTextures";

const DEMO_FPS = 30;
const DEMO_TOTAL_FRAMES = 240;
const REMOTION_FALLBACK_MESSAGE = "Remotion render fallback in use: live capture disabled.";

function useDemoAnimationFrame(): number {
    const [frame, setFrame] = useState(0);
    const frameRef = useRef(0);

    useEffect(() => {
        let intervalId = 0;
        const frameDurationMs = 1000 / DEMO_FPS;
        let lastTimestamp = performance.now();

        intervalId = window.setInterval(() => {
            const now = performance.now();
            const elapsed = now - lastTimestamp;

            if (elapsed >= frameDurationMs) {
                frameRef.current = (frameRef.current + 1) % DEMO_TOTAL_FRAMES;
                setFrame(frameRef.current);
                lastTimestamp = now;
            }
        }, Math.max(1, Math.round(frameDurationMs / 2)));

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    return frame;
}

type CosimoCinematic3DCompositionInnerProps = {
    frameOverride?: number;
    forceFallbackCapture?: boolean;
    captureOnce?: boolean;
    suppressLiveCapture?: boolean;
};

function createFallbackLayout(): CaptureLayoutPx {
    return {
        width: CINEMATIC3D_CAPTURE_WIDTH,
        height: CINEMATIC3D_CAPTURE_HEIGHT,
        panels: [
            { id: "wavetable", x: 17, y: 38, width: 613, height: 331, borderRadiusPx: 14 },
            { id: "filter", x: 646, y: 38, width: 613, height: 331, borderRadiusPx: 14 },
            { id: "distortion", x: 17, y: 385, width: 613, height: 331, borderRadiusPx: 14 },
            { id: "effect", x: 646, y: 385, width: 613, height: 331, borderRadiusPx: 14 },
            { id: "envelope", x: 17, y: 732, width: 613, height: 331, borderRadiusPx: 14 },
            { id: "mod", x: 646, y: 732, width: 613, height: 331, borderRadiusPx: 14 },
        ],
    };
}

function createFallbackCaptureState(layout: CaptureLayoutPx): CosimoCaptureFrameState {
    const canvas = document.createElement("canvas");
    canvas.width = CINEMATIC3D_CAPTURE_WIDTH;
    canvas.height = CINEMATIC3D_CAPTURE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Could not create fallback texture canvas context.");
    }

    const gradient = context.createLinearGradient(0, 0, CINEMATIC3D_CAPTURE_WIDTH, CINEMATIC3D_CAPTURE_HEIGHT);
    gradient.addColorStop(0, "#111723");
    gradient.addColorStop(1, "#05090f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, CINEMATIC3D_CAPTURE_WIDTH, CINEMATIC3D_CAPTURE_HEIGHT);
    context.fillStyle = "#dce4f8";
    context.textAlign = "center";
    context.font = "bold 32px Menlo, Monaco, monospace";
    context.fillText(
        "Cosimo Cinematic 3D Fallback",
        CINEMATIC3D_CAPTURE_WIDTH / 2,
        CINEMATIC3D_CAPTURE_HEIGHT / 2 - 14,
    );
    context.font = "16px Menlo, Monaco, monospace";
    context.fillText(
        "Remotion render uses synthetic fallback panel textures",
        CINEMATIC3D_CAPTURE_WIDTH / 2,
        CINEMATIC3D_CAPTURE_HEIGHT / 2 + 18,
    );

    return {
        layout,
        textures: {
            fullCanvas: canvas,
            panelCanvases: cropPanelCanvases(canvas, layout),
        },
        isFallback: true,
        supportMessage: REMOTION_FALLBACK_MESSAGE,
    };
}

export function CosimoCinematic3DComposition({
    frameOverride,
    forceFallbackCapture = false,
    captureOnce = false,
    suppressLiveCapture = false,
}: CosimoCinematic3DCompositionInnerProps) {
    const fallbackLayout = useMemo(() => createFallbackLayout(), []);
    const fallbackCaptureState = useMemo(
        () => createFallbackCaptureState(fallbackLayout),
        [fallbackLayout],
    );

    const [captureState, setCaptureState] = useState<CosimoCaptureFrameState>(suppressLiveCapture
        ? fallbackCaptureState
        : {
            layout: null,
            textures: null,
            isFallback: false,
            supportMessage: null,
        });

    const frame = frameOverride ?? useDemoAnimationFrame();
    const loggedLayoutRef = useRef(false);

    const debug = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get("debug") === "1" || params.get("debug") === "true";
    }, []);
    const effectiveWidth = CINEMATIC3D_CAPTURE_WIDTH;
    const effectiveHeight = CINEMATIC3D_CAPTURE_HEIGHT;

    const handleCaptureUpdate = useCallback((nextState: CosimoCaptureFrameState) => {
        if (suppressLiveCapture) {
            return;
        }

        setCaptureState((previous) => {
            if (nextState.layout && !loggedLayoutRef.current) {
                console.table(nextState.layout.panels.map((panel) => ({
                    id: panel.id,
                    x: Math.round(panel.x),
                    y: Math.round(panel.y),
                    width: Math.round(panel.width),
                    height: Math.round(panel.height),
                })));
                loggedLayoutRef.current = true;
            }

            return nextState;
        });
    }, [suppressLiveCapture]);

    return (
        <div
            style={{
                position: "relative",
                width: CINEMATIC3D_CAPTURE_WIDTH,
                height: CINEMATIC3D_CAPTURE_HEIGHT,
                background: "#04070f",
                overflow: "hidden",
            }}
        >
            {suppressLiveCapture ? null : (
                <CosimoCaptureFrame
                    width={CINEMATIC3D_CAPTURE_WIDTH}
                    height={CINEMATIC3D_CAPTURE_HEIGHT}
                    onUpdate={handleCaptureUpdate}
                    debug={debug}
                    forceFallbackCapture={forceFallbackCapture}
                    captureOnce={captureOnce}
                />
            )}

            <div
                style={{
                    position: "absolute",
                    inset: 0,
                }}
            >
                <CosimoRaisedPanelScene
                    layout={captureState.layout}
                    textures={captureState.textures}
                    frame={frame}
                    compositionWidth={effectiveWidth}
                    compositionHeight={effectiveHeight}
                    showDebugOutlines={debug}
                    renderMode={suppressLiveCapture ? "remotion" : "standard"}
                />
            </div>

            {(captureState.supportMessage !== null || suppressLiveCapture) ? (
                <div
                    style={{
                        position: "absolute",
                        left: 12,
                        top: 12,
                        zIndex: 20,
                        padding: "8px 10px",
                        borderRadius: 6,
                        background: "rgba(5, 9, 16, 0.82)",
                        border: "1px solid rgba(90, 220, 255, 0.38)",
                        color: "#d7f3ff",
                        font: "12px/1.4 Menlo, Monaco, monospace",
                        pointerEvents: "none",
                    }}
                >
                    {captureState.supportMessage ?? "Remotion fallback mode"}
                </div>
            ) : null}
        </div>
    );
}
