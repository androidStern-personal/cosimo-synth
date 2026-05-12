import { useCallback, useEffect, useRef, useState } from "react";
import { HtmlInCanvas, type HtmlInCanvasOnPaintParams } from "remotion";

import { MockPatchConnection } from "../../shared/patch-connection-mock";
import type { ResourceClient } from "../../shared/resource-client";
import { createDesktopPatchView } from "../patch-view-entry";
import { DebugPanelOverlay } from "./debugPanelOverlay";
import { measureCosimoPanels, type CaptureLayoutPx } from "./measurePanels";
import { cropPanelCanvases, type PanelTextureSet } from "./panelTextures";

type Html2CanvasRenderer = (
    element: HTMLElement,
    options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

export const CINEMATIC3D_CAPTURE_WIDTH = 1280;
export const CINEMATIC3D_CAPTURE_HEIGHT = 1100;
const MIN_CAPTURE_STD = 1.5;
const MIN_FLAT_CAPTURE_UNIQUE_COLORS = 2;
const MIN_FLAT_CAPTURE_UNIQUE_COLOR_WINDOW = 4;
const MIN_FLAT_CAPTURE_LUMA_RANGE = 1;
const BLANK_SKIP_SAMPLE_SIZE = 64;
const FALLBACK_FACTORY_BANK_CATALOG_PATH = "assets/factory-bank-catalog.json";
const FALLBACK_WAVETABLE_FRAME_LENGTH = 2048;
const FALLBACK_FRAME_RATE = 44_100;
const FALLBACK_TABLE_PATH = "assets/factory/fallback.wav";
const CAPTURE_DEBUG_LOG = true;
const FALLBACK_CAPTURE_REFRESH_MS = 160;
const MAX_FALLBACK_CAPTURE_ATTEMPTS = 20;
const FALLBACK_SUPPORT_MESSAGE = "HTML-in-canvas unavailable; using static screenshot fallback.";

const FALLBACK_FACTORY_BANK_CATALOG = {
    tables: [
        {
            tableId: "fallback.wt",
            name: "Fallback",
            frameCount: 1,
            sourceWav: FALLBACK_TABLE_PATH,
        },
    ],
} as const;

const FALLBACK_TABLE_FRAME = Float32Array.from(
    { length: FALLBACK_WAVETABLE_FRAME_LENGTH },
    (_, index) => Math.sin((index / FALLBACK_WAVETABLE_FRAME_LENGTH) * Math.PI * 2),
);

function normalizeResourcePath(path: string) {
    return path.startsWith("/") ? path.slice(1) : path;
}

function toUrl(path: string) {
    return new URL(path.startsWith("/") ? path : `/${path}`, window.location.href);
}

async function readTextFromNetwork(path: string) {
    try {
        const response = await fetch(toUrl(path));
        if (!response.ok) {
            return null;
        }

        return response.text();
    } catch {
        return null;
    }
}

async function readBytesFromNetwork(path: string) {
    try {
        const response = await fetch(toUrl(path));
        if (!response.ok) {
            return null;
        }

        return new Uint8Array(await response.arrayBuffer());
    } catch {
        return null;
    }
}

function createCaptureResourceClient(): ResourceClient {
    const frameData = FALLBACK_TABLE_FRAME.slice();
    const fallbackCatalogText = JSON.stringify(FALLBACK_FACTORY_BANK_CATALOG);

    return {
        async readText(path: string) {
            const normalizedPath = normalizeResourcePath(path);

            if (normalizedPath === FALLBACK_FACTORY_BANK_CATALOG_PATH) {
                return fallbackCatalogText;
            }

            const networkText = await readTextFromNetwork(path);
            if (networkText !== null) {
                return networkText;
            }

            if (normalizedPath.endsWith(".json")) {
                return "{}";
            }

            return "";
        },

        async readJSON<T>(path: string) {
            const normalizedPath = normalizeResourcePath(path);

            if (normalizedPath === FALLBACK_FACTORY_BANK_CATALOG_PATH) {
                return FALLBACK_FACTORY_BANK_CATALOG as T;
            }

            return JSON.parse(await this.readText(path)) as T;
        },

        async readBytes(path: string) {
            return await readBytesFromNetwork(path) ?? new Uint8Array();
        },

        async readAudio(path: string) {
            const normalizedPath = normalizeResourcePath(path);

            if (normalizedPath === FALLBACK_TABLE_PATH) {
                return {
                    sampleRate: FALLBACK_FRAME_RATE,
                    samples: frameData,
                };
            }

            return {
                sampleRate: FALLBACK_FRAME_RATE,
                samples: frameData,
            };
        },

        getURL(path: string) {
            const normalizedPath = normalizeResourcePath(path);

            if (
                normalizedPath === FALLBACK_FACTORY_BANK_CATALOG_PATH
                || normalizedPath === FALLBACK_TABLE_PATH
            ) {
                return new URL(path.startsWith("/") ? path : `/${path}`, window.location.href);
            }

            return null;
        },
    };
}

async function loadHtml2CanvasRenderer(): Promise<Html2CanvasRenderer | null> {
    try {
        const module = await import("html2canvas");
        return module.default as Html2CanvasRenderer;
    } catch {
        return null;
    }
}

export type CosimoCaptureFrameState = {
    layout: CaptureLayoutPx | null;
    textures: PanelTextureSet | null;
    isFallback: boolean;
    supportMessage: string | null;
};

type CosimoCaptureFrameProps = {
    width?: number;
    height?: number;
    debug?: boolean;
    forceFallbackCapture?: boolean;
    captureOnce?: boolean;
    onUpdate: (state: CosimoCaptureFrameState) => void;
};

function createFallbackCanvas(width: number, height: number): HTMLCanvasElement {
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = Math.max(1, Math.round(width));
    fallbackCanvas.height = Math.max(1, Math.round(height));

    const context = fallbackCanvas.getContext("2d");
    if (!context) {
        throw new Error("Could not create fallback texture canvas.");
    }

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#121722");
    gradient.addColorStop(1, "#060a13");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#e6ecf8";
    context.textAlign = "center";
    context.font = "bold 22px Menlo, Monaco, monospace";
    context.fillText("Cosimo cinematic3d fallback texture", width / 2, height / 2 - 14);
    context.font = "14px Menlo, Monaco, monospace";
    context.fillText("HTML-in-canvas unavailable on this browser", width / 2, height / 2 + 18);
    return fallbackCanvas;
}

function buildCaptureState(
    captureRoot: HTMLElement,
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
): CosimoCaptureFrameState {
    const layout = measureCosimoPanels(captureRoot);
    const panelCanvases = cropPanelCanvases(sourceCanvas, layout);
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = Math.max(1, Math.round(sourceCanvas.width));
    fullCanvas.height = Math.max(1, Math.round(sourceCanvas.height));

    const copyContext = fullCanvas.getContext("2d");
    if (!copyContext) {
        throw new Error("Could not create capture copy canvas.");
    }

    copyContext.drawImage(
        sourceCanvas,
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height,
    );

    return {
        layout,
        textures: {
            fullCanvas,
            panelCanvases,
        },
        isFallback: false,
        supportMessage: null,
    };
}

type CanvasSignal = {
    mean: number;
    std: number;
    min: number;
    max: number;
    uniqueColors: number;
    sampledPixelCount: number;
    ignoredPixelCount: number;
};

function estimateCanvasSignal(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasSignal {
    const context = canvas.getContext("2d");
    if (!context) {
        return {
            mean: 0,
            std: 0,
            min: 0,
            max: 0,
            uniqueColors: 0,
            sampledPixelCount: 0,
            ignoredPixelCount: 0,
        };
    }

    const sampleWidth = Math.min(BLANK_SKIP_SAMPLE_SIZE, Math.max(1, Math.floor(canvas.width)));
    const sampleHeight = Math.min(BLANK_SKIP_SAMPLE_SIZE, Math.max(1, Math.floor(canvas.height)));

    try {
        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = sampleWidth;
        sampleCanvas.height = sampleHeight;

        const sampleContext = sampleCanvas.getContext("2d");
        if (!sampleContext) {
            return {
                mean: 0,
                std: 0,
                min: 0,
                max: 0,
                uniqueColors: 0,
                sampledPixelCount: 0,
                ignoredPixelCount: 0,
            };
        }

        sampleContext.drawImage(
            canvas,
            0,
            0,
            canvas.width,
            canvas.height,
            0,
            0,
            sampleWidth,
            sampleHeight,
        );

        const imageData = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight);
        const data = imageData.data;

        let total = 0;
        let totalSq = 0;
        let samples = 0;
        let ignored = 0;
        let minLuma = Number.POSITIVE_INFINITY;
        let maxLuma = Number.NEGATIVE_INFINITY;
        const colorBuckets = new Set<number>();

        for (let index = 0; index < data.length; index += 4) {
            const alpha = data[index + 3];
            if (alpha === 0) {
                ignored += 1;
                continue;
            }

            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const bucket = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);

            total += luminance;
            totalSq += luminance * luminance;
            samples += 1;
            minLuma = Math.min(minLuma, luminance);
            maxLuma = Math.max(maxLuma, luminance);
            colorBuckets.add(bucket);
        }

        if (samples === 0) {
            return {
                mean: 0,
                std: 0,
                min: 0,
                max: 0,
                uniqueColors: 0,
                sampledPixelCount: 0,
                ignoredPixelCount: ignored,
            };
        }

        const mean = total / samples;
        const variance = totalSq / samples - mean * mean;
        const std = Math.max(0, Math.sqrt(Math.max(0, variance)));

        return {
            mean,
            std,
            min: minLuma,
            max: maxLuma,
            uniqueColors: colorBuckets.size,
            sampledPixelCount: samples,
            ignoredPixelCount: ignored,
        };
    } catch {
        return {
            mean: 0,
            std: 0,
            min: 0,
            max: 0,
            uniqueColors: 0,
            sampledPixelCount: 0,
            ignoredPixelCount: 0,
        };
    }
}

function isLikelyStaleCapture(
    signal: CanvasSignal,
    previousSignal: CanvasSignal | null,
): boolean {
    const hasEnoughSignal = signal.sampledPixelCount > 0;
    if (!hasEnoughSignal) {
        return true;
    }

    const range = signal.max - signal.min;
    const isFlat = signal.std < MIN_CAPTURE_STD && range <= MIN_FLAT_CAPTURE_LUMA_RANGE;
    const isNearMonochrome = signal.uniqueColors <= MIN_FLAT_CAPTURE_UNIQUE_COLORS;

    if (isFlat || isNearMonochrome) {
        return true;
    }

    if (
        previousSignal
        && previousSignal.uniqueColors > MIN_FLAT_CAPTURE_UNIQUE_COLOR_WINDOW
        && signal.uniqueColors <= MIN_FLAT_CAPTURE_UNIQUE_COLOR_WINDOW
        && signal.std <= previousSignal.std
        && Math.abs(signal.mean - previousSignal.mean) > 20
    ) {
        return true;
    }

    return false;
}

export function CosimoCaptureFrame({
    width = CINEMATIC3D_CAPTURE_WIDTH,
    height = CINEMATIC3D_CAPTURE_HEIGHT,
    debug = false,
    forceFallbackCapture = false,
    captureOnce = false,
    onUpdate,
}: CosimoCaptureFrameProps) {
    const captureRootRef = useRef<HTMLDivElement>(null);
    const hostRef = useRef<HTMLDivElement>(null);
    const patchViewRef = useRef<HTMLElement | null>(null);
    const [captureState, setCaptureState] = useState<CosimoCaptureFrameState>({
        layout: null,
        textures: null,
        isFallback: false,
        supportMessage: null,
    });
    const [lastError, setLastError] = useState<string | null>(null);
    const hasStableCaptureRef = useRef(false);
    const paintSequenceRef = useRef(0);
    const lastUniformPaintRef = useRef(0);
    const lastAcceptedSignalRef = useRef<CanvasSignal | null>(null);
    const html2CanvasRendererRef = useRef<Promise<Html2CanvasRenderer | null> | null>(null);
    const fallbackCaptureInFlightRef = useRef(false);
    const fallbackCaptureAttemptsRef = useRef(0);
    const fallbackCaptureSucceededRef = useRef(false);

    const htmlInCanvasSupported = forceFallbackCapture ? false : HtmlInCanvas.isSupported();
    const fallbackMessage = htmlInCanvasSupported ? null : FALLBACK_SUPPORT_MESSAGE;

    const hasCapturedStableRef = useRef(false);

    const publishState = useCallback((nextState: CosimoCaptureFrameState) => {
        setCaptureState(nextState);
        onUpdate(nextState);
    }, [onUpdate]);

    const applyCaptureFitTransform = useCallback(() => {
        const host = hostRef.current;
        const patchView = patchViewRef.current;
        if (!host || !patchView) {
            return;
        }

        const contentWidth = patchView.scrollWidth;
        const contentHeight = patchView.scrollHeight;

        if (!Number.isFinite(contentWidth) || !Number.isFinite(contentHeight)) {
            return;
        }

        if (contentWidth <= 0 || contentHeight <= 0) {
            return;
        }

        const scaleX = width / contentWidth;
        const scaleY = height / contentHeight;
        const nextScale = Math.min(1, scaleX, scaleY);

        if (!Number.isFinite(nextScale) || nextScale <= 0) {
            return;
        }

        host.style.transformOrigin = "top left";
        host.style.transform = `scale(${nextScale})`;
        host.style.width = `${(100 / nextScale).toFixed(2)}%`;
        host.style.height = `${(100 / nextScale).toFixed(2)}%`;
        host.style.margin = "0";
        host.style.padding = "0";
    }, [height, width]);

    const applyPaint = useCallback(async ({
        canvas,
        element,
        elementImage,
    }: HtmlInCanvasOnPaintParams) => {
        if (captureOnce && hasCapturedStableRef.current) {
            return;
        }

        const root = captureRootRef.current;
        if (!root) {
            return;
        }

        const paintIndex = paintSequenceRef.current + 1;
        paintSequenceRef.current = paintIndex;

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to acquire canvas context for HtmlInCanvas paint.");
        }

        applyCaptureFitTransform();

        context.reset();
        const transform = context.drawElementImage(
            elementImage,
            0,
            0,
            width,
            height,
        );
        element.style.transform = transform.toString();

        const signal = estimateCanvasSignal(canvas);
        const isStaleCapture = isLikelyStaleCapture(signal, lastAcceptedSignalRef.current);

        if (CAPTURE_DEBUG_LOG && paintIndex <= 120) {
            // eslint-disable-next-line no-console
            console.log("capture-paint", paintIndex, {
                width: Math.round(canvas.width),
                height: Math.round(canvas.height),
                std: Number(signal.std.toFixed(6)),
                uniqueColors: signal.uniqueColors,
                sampleCount: signal.sampledPixelCount,
                lumaRange: Number((signal.max - signal.min).toFixed(3)),
                mean: Number(signal.mean.toFixed(6)),
                hasStable: hasStableCaptureRef.current,
            });
        }

        if (isStaleCapture) {
            // Ignore near-uniform captures that are usually transient blank renders.
            lastUniformPaintRef.current += 1;
            if (!hasStableCaptureRef.current) {
                return;
            }

            if (lastUniformPaintRef.current >= 12) {
                // Keep the last good capture and fail fast only after many consecutive blanks.
                setLastError("Consecutive blank capture frames detected; holding last stable texture.");
            }

            return;
        }

        lastUniformPaintRef.current = 0;
        lastAcceptedSignalRef.current = signal;

        try {
            const nextState = buildCaptureState(root, canvas);

            publishState({
                ...nextState,
                isFallback: false,
                supportMessage: null,
            });

            hasCapturedStableRef.current = true;

            hasStableCaptureRef.current = true;
            setLastError(null);
        } catch (error) {
            setLastError(error instanceof Error ? error.message : String(error));
        }
    }, [captureOnce, height, publishState, width]);

    const runFallbackCapture = useCallback(async () => {
        const root = captureRootRef.current;
        if (!root) {
            return;
        }

        if (fallbackCaptureInFlightRef.current || fallbackCaptureSucceededRef.current) {
            return;
        }

        if (fallbackCaptureAttemptsRef.current >= MAX_FALLBACK_CAPTURE_ATTEMPTS) {
            setLastError(
                `HTML-in-canvas fallback capture timed out after ${MAX_FALLBACK_CAPTURE_ATTEMPTS} attempts.`,
            );
            return;
        }

        fallbackCaptureAttemptsRef.current += 1;
        fallbackCaptureInFlightRef.current = true;

        if (!html2CanvasRendererRef.current) {
            html2CanvasRendererRef.current = loadHtml2CanvasRenderer();
        }

        let captureCanvas: HTMLCanvasElement;
        try {
            const renderer = await html2CanvasRendererRef.current;
            if (renderer) {
                captureCanvas = await renderer(root, {
                    backgroundColor: null,
                    useCORS: true,
                    logging: false,
                    scale: 1,
                    width,
                    height,
                    windowWidth: width,
                    windowHeight: height,
                    x: 0,
                    y: 0,
                    scrollX: 0,
                    scrollY: 0,
                    allowTaint: false,
                    foreignObjectRendering: false,
                });
            } else {
                captureCanvas = createFallbackCanvas(width, height);
            }
        } catch (error) {
            captureCanvas = createFallbackCanvas(width, height);
            setLastError(error instanceof Error ? error.message : String(error));
            if (!html2CanvasRendererRef.current) {
                html2CanvasRendererRef.current = Promise.resolve(null);
            }
            fallbackCaptureInFlightRef.current = false;
            return;
        }

        const signal = estimateCanvasSignal(captureCanvas);
        const isStaleCapture = isLikelyStaleCapture(signal, lastAcceptedSignalRef.current);

        if (captureOnce && isStaleCapture && !hasCapturedStableRef.current) {
            fallbackCaptureInFlightRef.current = false;
            return;
        }

        try {
            applyCaptureFitTransform();
            const nextState = buildCaptureState(root, captureCanvas);
            publishState({
            ...nextState,
                isFallback: true,
                supportMessage: fallbackMessage,
            });
            hasCapturedStableRef.current = true;
            hasStableCaptureRef.current = true;
            fallbackCaptureSucceededRef.current = true;
            setLastError(null);
        } catch (error) {
            setLastError(error instanceof Error ? error.message : String(error));
        } finally {
            fallbackCaptureInFlightRef.current = false;
        }
    }, [applyCaptureFitTransform, captureOnce, fallbackMessage, height, publishState, width]);

    useEffect(() => {
        let cancelled = false;
        let fallbackTimer: number | null = null;

        const mountSynth = async () => {
            if (!hostRef.current) {
                return;
            }

            try {
                const manifest = {};
                const patchConnection = new MockPatchConnection(manifest);
                const resourceClient = createCaptureResourceClient();
                const patchView = createDesktopPatchView(patchConnection, {
                    resourceClient,
                });
                patchView.dataset.cinematic3dCapture = "1";
                patchViewRef.current = patchView;
                hostRef.current.appendChild(patchView);

                requestAnimationFrame(() => {
                    applyCaptureFitTransform();
                });

                if (!htmlInCanvasSupported) {
                    if (fallbackTimer !== null) {
                        window.clearInterval(fallbackTimer);
                    }
                    void runFallbackCapture();
                    fallbackTimer = window.setInterval(() => {
                        if (!cancelled && (!captureOnce || !hasCapturedStableRef.current)) {
                            void runFallbackCapture();
                        }
                    }, FALLBACK_CAPTURE_REFRESH_MS);
                }
            } catch (error) {
                setLastError(error instanceof Error ? error.message : String(error));
            }
        };

        void mountSynth();

        const handleResize = () => {
            applyCaptureFitTransform();
            void runFallbackCapture();
        };

        window.addEventListener("resize", handleResize);

        return () => {
            cancelled = true;
            if (fallbackTimer !== null) {
                window.clearInterval(fallbackTimer);
            }
            window.removeEventListener("resize", handleResize);
            if (patchViewRef.current?.isConnected) {
                patchViewRef.current.remove();
            }
            if (hostRef.current) {
                hostRef.current.style.transform = "";
                hostRef.current.style.width = "100%";
                hostRef.current.style.height = "100%";
                hostRef.current.style.margin = "";
                hostRef.current.style.padding = "";
                hostRef.current.style.transformOrigin = "";
            }
            patchViewRef.current = null;
        };
    }, [applyCaptureFitTransform, runFallbackCapture, htmlInCanvasSupported]);

    const supportText = captureState.supportMessage;
    const debugLayout = debug ? captureState.layout : null;

    return (
        <div
            style={{
                position: "relative",
                width,
                height,
                pointerEvents: "none",
            }}
        >
            {htmlInCanvasSupported ? (
                <HtmlInCanvas
                    width={Math.max(1, Math.round(width))}
                    height={Math.max(1, Math.round(height))}
                    onPaint={applyPaint}
                >
                    <div
                        ref={captureRootRef}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width,
                            height,
                            opacity: 1,
                            overflow: "hidden",
                            pointerEvents: "none",
                            zIndex: -1,
                        }}
                    >
                        <div
                            ref={hostRef}
                            style={{
                                position: "relative",
                                width: "100%",
                                height: "100%",
                            }}
                        />
                    </div>
                </HtmlInCanvas>
            ) : (
                <div
                    ref={captureRootRef}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width,
                        height,
                        opacity: 1,
                        overflow: "hidden",
                        pointerEvents: "none",
                        zIndex: -1,
                    }}
                >
                    <div
                        ref={hostRef}
                        style={{
                            position: "relative",
                            width: "100%",
                            height: "100%",
                        }}
                    />
                </div>
            )}

            {debugLayout && <DebugPanelOverlay layout={debugLayout} />}

            {supportText ? (
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
                    {supportText}
                </div>
            ) : null}

            {lastError ? (
                <div
                    style={{
                        position: "absolute",
                        left: 12,
                        top: 12,
                        zIndex: 30,
                        maxWidth: "48ch",
                        padding: "8px 10px",
                        borderRadius: 6,
                        background: "rgba(52, 8, 9, 0.9)",
                        border: "1px solid rgba(255, 130, 130, 0.64)",
                        color: "#ffd7d7",
                        font: "12px/1.4 Menlo, Monaco, monospace",
                        pointerEvents: "none",
                    }}
                >
                    {lastError}
                </div>
            ) : null}
        </div>
    );
}
