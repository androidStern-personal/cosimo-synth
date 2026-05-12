import { useCallback, useMemo, useRef, useState } from "react";
import { interpolate } from "remotion";
import { Canvas } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import {
    CanvasTexture,
    Color,
    DoubleSide,
    ExtrudeGeometry,
    NoToneMapping,
    type Renderer,
    WebGLRenderer,
    MeshBasicMaterial,
    MeshPhongMaterial,
    ShapeGeometry,
    type Texture,
} from "three";

import {
    WORLD_SCALE,
    getPanelDepth,
    makeRoundedRectShape,
    orderedCosimoPanelIds,
    panelRectToWorld,
} from "./panelGeometry";
import type { CaptureLayoutPx } from "./measurePanels";
import type { PanelTextureSet } from "./panelTextures";

const MAX_PANEL_DEPTH_FALLBACK = 0.35;
const PANEL_SIDE_DARK = "#111a2c";
const PANEL_SIDE_EMISSIVE = "#05090f";
const PANEL_SIDE_SPECULAR = "#2f3f5f";
const BASE_VIEW_PADDING = 0.2;
const WEBGL_TEST_CANVAS_SIZE = 32;
const WEBGL_CONTEXT_OPTIONS: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
};
const THREE_CANVAS_OPTIONS = {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance" as const,
};
type SceneRenderMode = "standard" | "remotion";

type PanelWorld = ReturnType<typeof panelRectToWorld>;

type PanelTextureMap = Map<string, CanvasTexture>;

type PanelMeshGroupProps = {
    panel: PanelWorld;
    depth: number;
    skinTexture: CanvasTexture | null;
    showWireframe: boolean;
};

type WebGLFallbackProps = {
    layout: CaptureLayoutPx | null;
    fullCanvas: HTMLCanvasElement | OffscreenCanvas | null;
    compositionWidth: number;
    compositionHeight: number;
    showDebugOutlines: boolean;
};

function convertPanelsToWorld(layout: CaptureLayoutPx): PanelWorld[] {
    return orderedCosimoPanelIds().flatMap((panelId) => {
        const match = layout.panels.find((candidate) => candidate.id === panelId);
        if (!match) {
            return [];
        }

        return [panelRectToWorld(match, layout.width, layout.height, WORLD_SCALE)];
    });
}

function supportsWebGL(): boolean {
    if (typeof document === "undefined") {
        return false;
    }

    const testCanvas = document.createElement("canvas");
    if (!testCanvas.getContext) {
        return false;
    }

    testCanvas.width = WEBGL_TEST_CANVAS_SIZE;
    testCanvas.height = WEBGL_TEST_CANVAS_SIZE;

    const context = testCanvas.getContext("webgl2", WEBGL_CONTEXT_OPTIONS)
        || testCanvas.getContext("webgl", WEBGL_CONTEXT_OPTIONS)
        || testCanvas.getContext("experimental-webgl", WEBGL_CONTEXT_OPTIONS);
    if (!context) {
        return false;
    }

    let renderer: Renderer | null = null;
    try {
        renderer = new WebGLRenderer({
            canvas: testCanvas,
            context,
            ...THREE_CANVAS_OPTIONS,
        });
        return Boolean(renderer.getContext());
    } catch {
        return false;
    } finally {
        renderer?.dispose();
    }
}

function captureFallbackToDataUrl(fullCanvas: HTMLCanvasElement | OffscreenCanvas | null): string | null {
    if (!fullCanvas) {
        return null;
    }

    if (fullCanvas instanceof HTMLCanvasElement) {
        try {
            return fullCanvas.toDataURL("image/png");
        } catch {
            return null;
        }
    }

    try {
        const fallbackCanvas = document.createElement("canvas");
        fallbackCanvas.width = fullCanvas.width;
        fallbackCanvas.height = fullCanvas.height;

        const fallbackContext = fallbackCanvas.getContext("2d");
        if (!fallbackContext) {
            return null;
        }

        fallbackContext.drawImage(
            fullCanvas as unknown as CanvasImageSource,
            0,
            0,
        );

        return fallbackCanvas.toDataURL("image/png");
    } catch {
        return null;
    }
}

function WebGLUnavailableFallback({
    layout,
    fullCanvas,
    compositionWidth,
    compositionHeight,
    showDebugOutlines,
}: WebGLFallbackProps) {
    const screenshotUrl = useMemo(() => captureFallbackToDataUrl(fullCanvas), [fullCanvas]);
    const scaleX = compositionWidth / (layout?.width || 1);
    const scaleY = compositionHeight / (layout?.height || 1);

    return (
        <div style={{ position: "relative", width: compositionWidth, height: compositionHeight }}>
            {screenshotUrl ? (
                <img
                    src={screenshotUrl}
                    alt="Cosimo live capture"
                    style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        objectFit: "fill",
                    }}
                />
            ) : null}

            {showDebugOutlines && layout ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                    }}
                >
                    {layout.panels.map((panel) => (
                        <div
                            key={panel.id}
                            style={{
                                position: "absolute",
                                left: panel.x * scaleX,
                                top: panel.y * scaleY,
                                width: panel.width * scaleX,
                                height: panel.height * scaleY,
                                border: "1px dashed rgba(110, 220, 255, 0.72)",
                                boxSizing: "border-box",
                            }}
                        />
                    ))}
                </div>
            ) : null}

            <div
                style={{
                    position: "absolute",
                    left: 12,
                    top: 12,
                    zIndex: 2,
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "rgba(66, 6, 11, 0.9)",
                    border: "1px solid rgba(255, 130, 130, 0.64)",
                    color: "#ffd7d7",
                    font: "12px/1.4 Menlo, Monaco, monospace",
                    pointerEvents: "none",
                }}
            >
                WebGL is unavailable in this browser. Showing flat capture fallback.
            </div>
        </div>
    );
}

function refreshTexture(texture: Texture | null) {
    if (!texture) {
        return;
    }

    texture.needsUpdate = true;
    texture.flipY = false;
}

function PanelMeshGroup({
    panel,
    depth,
    skinTexture,
    showWireframe,
}: PanelMeshGroupProps) {
    const shape = useMemo(
        () => makeRoundedRectShape(panel.width, panel.height, panel.radius),
        [panel.height, panel.radius, panel.width],
    );
    const bodyGeometry = useMemo(() => new ExtrudeGeometry(shape, {
        depth: 1,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelThickness: 0.06,
        bevelSize: 0.02,
        bevelOffset: 0,
    }), [shape]);
    const frontGeometry = useMemo(() => new ShapeGeometry(shape), [shape]);

    const bodyMaterial = useMemo(() => new MeshPhongMaterial({
        color: new Color(PANEL_SIDE_DARK),
        emissive: new Color(PANEL_SIDE_EMISSIVE),
        specular: new Color(PANEL_SIDE_SPECULAR),
        shininess: 24,
    }), []);

    const wireframeMaterial = useMemo(() => new MeshBasicMaterial({
        color: "#6ac5ff",
        wireframe: true,
    }), []);

    const skinMaterial = useMemo(() => {
        if (!skinTexture) {
            return new MeshBasicMaterial({
                color: "#050a15",
            });
        }

        refreshTexture(skinTexture);
        return new MeshBasicMaterial({
            map: skinTexture,
            transparent: true,
            side: DoubleSide,
            toneMapped: false,
            depthWrite: true,
        });
    }, [skinTexture]);

    return (
        <group position={[panel.x, panel.y, 0]}>
            <mesh geometry={bodyGeometry} material={showWireframe ? wireframeMaterial : bodyMaterial} scale={[1, 1, depth]} />
            <mesh geometry={frontGeometry} material={skinMaterial} position={[0, 0, depth + 0.002]} />
        </group>
    );
}

type CosimoRaisedPanelSceneProps = {
    layout: CaptureLayoutPx | null;
    textures: PanelTextureSet | null;
    frame: number;
    compositionWidth: number;
    compositionHeight: number;
    showDebugOutlines?: boolean;
    maxPanelDepth?: number;
    renderMode?: SceneRenderMode;
};

export function CosimoRaisedPanelScene({
    layout,
    textures,
    frame,
    compositionWidth,
    compositionHeight,
    showDebugOutlines = false,
    maxPanelDepth = MAX_PANEL_DEPTH_FALLBACK,
    renderMode = "standard",
}: CosimoRaisedPanelSceneProps) {
    const convertedPanels = useMemo(() => (layout ? convertPanelsToWorld(layout) : []), [layout]);
    const textureStateRef = useRef({
        fullCanvasTexture: null as CanvasTexture | null,
        panelTextures: null as PanelTextureMap | null,
        panelCanvasSources: new Map<string, HTMLCanvasElement>(),
    });

    const fullCanvasTexture = useMemo(() => {
        const state = textureStateRef.current;
        const sourceCanvas = textures?.fullCanvas;

        if (!sourceCanvas) {
            if (state.fullCanvasTexture) {
                state.fullCanvasTexture.dispose();
                state.fullCanvasTexture = null;
            }
            return null;
        }

        if (!state.fullCanvasTexture) {
            state.fullCanvasTexture = new CanvasTexture(sourceCanvas);
        } else {
            state.fullCanvasTexture.image = sourceCanvas;
        }

        const texture = state.fullCanvasTexture;
        texture.flipY = false;
        texture.needsUpdate = true;
        return texture;
    }, [textures?.fullCanvas]);

    const panelTextures: PanelTextureMap | null = useMemo(() => {
        const state = textureStateRef.current;
        const sourceTextures = textures?.panelCanvases;

        if (!sourceTextures) {
            if (state.panelTextures) {
                state.panelTextures.forEach((texture) => texture.dispose());
            }
            state.panelTextures = null;
            state.panelCanvasSources = new Map();
            return null;
        }

        if (!state.panelTextures) {
            state.panelTextures = new Map();
            state.panelCanvasSources = new Map();
        }

        for (const panelId of orderedCosimoPanelIds()) {
            const sourceCanvas = sourceTextures[panelId];
            if (!sourceCanvas) {
                continue;
            }

            const previousCanvas = state.panelCanvasSources.get(panelId);
            const existing = state.panelTextures.get(panelId);

            if (!existing || previousCanvas !== sourceCanvas) {
                if (existing) {
                    existing.dispose();
                }

                const nextTexture = new CanvasTexture(sourceCanvas);
                nextTexture.flipY = false;
                nextTexture.needsUpdate = true;
                state.panelTextures.set(panelId, nextTexture);
                state.panelCanvasSources.set(panelId, sourceCanvas);
            } else {
                existing.needsUpdate = true;
            }
        }

        return state.panelTextures;
    }, [textures?.panelCanvases]);

    const baseWidth = layout ? layout.width * WORLD_SCALE : 1;
    const baseHeight = layout ? layout.height * WORLD_SCALE : 1;
    const webGLAvailable = useMemo(supportsWebGL, []);

    if (!webGLAvailable) {
        return (
            <WebGLUnavailableFallback
                layout={layout}
                fullCanvas={textures?.fullCanvas ?? null}
                compositionWidth={compositionWidth}
                compositionHeight={compositionHeight}
                showDebugOutlines={showDebugOutlines}
            />
        );
    }

    const cameraX = interpolate(frame, [60, 120], [0, 0.15], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const cameraY = interpolate(frame, [60, 120], [0, -0.24], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const cameraZ = interpolate(frame, [60, 120], [1.7, 1.3], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    const cameraRight = baseWidth / 2 + BASE_VIEW_PADDING;
    const cameraTop = baseHeight / 2 + BASE_VIEW_PADDING;
    const cameraLeft = -cameraRight;
    const cameraBottom = -cameraTop;

    if (fullCanvasTexture) {
        refreshTexture(fullCanvasTexture);
    }

    for (const texture of panelTextures?.values() ?? []) {
        refreshTexture(texture);
    }

    const sceneChildren = (
        <>
            <color attach="background" args={["#02050a"]} />
            <ambientLight intensity={0.95} />
            <directionalLight intensity={0.85} position={[0, 1, 2]} />
            <mesh position={[0, 0, -0.001]}>
                <planeGeometry args={[baseWidth, baseHeight]} />
                {fullCanvasTexture ? (
                    <meshBasicMaterial
                        map={fullCanvasTexture}
                        toneMapped={false}
                    />
                ) : null}
            </mesh>

            {convertedPanels.map((panel, index) => {
                const depth = getPanelDepth(frame, index, maxPanelDepth);
                return (
                    <PanelMeshGroup
                        key={panel.id}
                        panel={panel}
                        depth={depth}
                        skinTexture={panelTextures?.get(panel.id) ?? null}
                        showWireframe={showDebugOutlines}
                    />
                );
            })}
        </>
    );

    const cameraSettings = {
        orthographic: true,
        left: cameraLeft,
        right: cameraRight,
        top: cameraTop,
        bottom: cameraBottom,
        zoom: 1.05,
        near: 0.01,
        far: 100,
    };

    if (renderMode === "remotion") {
        return (
            <ThreeCanvas
                width={compositionWidth}
                height={compositionHeight}
                orthographic
                camera={{
                    position: [cameraX, cameraY, cameraZ],
                    left: cameraLeft,
                    right: cameraRight,
                    top: cameraTop,
                    bottom: cameraBottom,
                    zoom: 1.05,
                    near: 0.01,
                    far: 100,
                }}
                dpr={1}
                gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
            >
                {sceneChildren}
            </ThreeCanvas>
        );
    }

    return (
        <Canvas
            orthographic
            camera={{
                position: [cameraX, cameraY, cameraZ],
                ...cameraSettings,
            }}
            gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        >
            {sceneChildren}
        </Canvas>
    );
}
