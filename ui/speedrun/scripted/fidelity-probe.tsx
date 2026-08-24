import { renderStillOnWeb } from "@remotion/web-renderer";
import React, { useEffect, useState } from "react";
import { useDelayRender } from "remotion";

import { DesktopPatchView } from "../../desktop/DesktopPatchView";
import {
    createDefaultLaneState,
    LANE_STATE_KEY,
} from "../../shared/lane-state";
import {
    serializeLaneStateV2,
    upgradeLaneStateV1,
} from "../../shared/lane-state-v2";
import type { MockPatchConnection } from "../../shared/patch-connection-mock";
import { createDesktopResourceClient } from "../../shared/resource-client";
import {
    MODULATION_STATE_KEY,
    normalizeModulationState,
    serializeModulationState,
} from "../../shared/modulation";
import { WORKSPACE_SHELL_STORAGE_KEY } from "../../shared/workspace-shell";
import { settleCaptureSubtree } from "./capture-fidelity";
import { createCapturePianoKeyboardClass } from "./capture-piano-keyboard";
import "./scripted-styles.css";

export type FidelityScenario = "voice-hud" | "fx-filter" | "mod-route-ghost";

/** Both sides pause every animation at this same media time, so the compare
    sees identical animation state instead of two arbitrary in-flight frames. */
const FIDELITY_ANIMATION_TIME_MILLISECONDS = 400;

type ProbeInspection = {
    readonly scenario: FidelityScenario;
    readonly workspace: string | null;
    readonly keyboardNoteCount: number;
    readonly svgCount: number;
    readonly imageCount: number;
    readonly landmarks: Readonly<Record<string, {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
        readonly top: number;
        readonly right: number;
        readonly bottom: number;
        readonly left: number;
    }>>;
};

type FidelityProbeApi = {
    prepareLiveScenario(scenario: FidelityScenario): Promise<ProbeInspection>;
    renderStill(scenario: FidelityScenario): Promise<{
        readonly dataUrl: string;
        readonly bytes: number;
        readonly inspection: ProbeInspection;
    }>;
};

let latestCaptureInspection: ProbeInspection | null = null;

declare global {
    interface Window {
        __COSIMO_VIDEO_BOUNCE_FIDELITY__?: FidelityProbeApi;
    }
}

function shellStateForScenario(scenario: FidelityScenario) {
    const activeTab = scenario === "fx-filter" ? "fx" : scenario === "mod-route-ghost" ? "mod" : "voice";
    return JSON.stringify({
        version: 1,
        activeTab,
        details: { voice: null, fx: null, mod: null },
    });
}

function pointerEvent(
    type: "pointerdown" | "pointermove" | "pointerup",
    point: { readonly x: number; readonly y: number },
    buttons: number,
) {
    return new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 4401,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons,
        clientX: point.x,
        clientY: point.y,
    });
}

function center(element: Element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) };
}

function requiredElement(root: ParentNode, selector: string) {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) {
        throw new Error(`Fidelity scenario target is missing: ${selector}`);
    }
    return element;
}

function waitForFrames(count = 2) {
    return new Promise<void>((resolve) => {
        const advance = (remaining: number) => {
            if (remaining <= 0) {
                resolve();
                return;
            }
            requestAnimationFrame(() => advance(remaining - 1));
        };
        advance(count);
    });
}

async function selectWorkspace(root: ParentNode, workspace: "voice" | "fx" | "mod") {
    const tab = requiredElement(root, `[data-role="mobile-workspace-tab-${workspace}"]`);
    if (tab.getAttribute("aria-selected") !== "true") {
        tab.click();
        await waitForFrames(3);
    }
}

async function applyScenario(root: HTMLElement, scenario: FidelityScenario) {
    if (scenario === "voice-hud") {
        await selectWorkspace(root, "voice");
        const control = requiredElement(root, '[data-role="mobile-voice-cell-framePosition"]');
        const start = center(control);
        control.dispatchEvent(pointerEvent("pointerdown", start, 1));
        window.dispatchEvent(pointerEvent("pointermove", { x: start.x + 14, y: start.y }, 1));
        window.dispatchEvent(pointerEvent("pointermove", { x: start.x + 36, y: start.y }, 1));
        await waitForFrames(3);
        requiredElement(root, '[data-role="mobile-voice-hud"].is-visible');
        return;
    }

    if (scenario === "fx-filter") {
        await selectWorkspace(root, "fx");
        const filterStation = requiredElement(root, '[data-role="rack-station-filter"]');
        filterStation.click();
        await waitForFrames(4);
        requiredElement(root, '[data-role="filter-response-graph"]');
        return;
    }

    await selectWorkspace(root, "mod");
    const mappingsTab = requiredElement(root, '[data-role="mobile-mod-panel-tab-mappings"]');
    if (mappingsTab.getAttribute("aria-selected") !== "true") {
        mappingsTab.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
        await waitForFrames(2);
    }
    const source = requiredElement(root, '[data-role="mobile-global-mod-rail-selected"]');
    const start = center(source);
    source.dispatchEvent(pointerEvent("pointerdown", start, 1));
    source.dispatchEvent(pointerEvent("pointermove", { x: start.x - 24, y: start.y - 8 }, 1));
    await waitForFrames(4);
    requiredElement(root, '[data-role="mobile-global-mod-source-ghost"]');
}

function rectFor(root: ParentNode, selector: string) {
    const element = root.querySelector<Element>(selector);
    const rect = element?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0 ? rect.toJSON() : null;
}

function inspect(root: HTMLElement, scenario: FidelityScenario): ProbeInspection {
    const presetHost = root.querySelector<HTMLElement>('[data-role="synth-preset-bar-host"]');
    const presetTitle = presetHost?.querySelector<HTMLElement>('[data-el="preset-name"]')
        ?? presetHost?.firstElementChild?.shadowRoot?.querySelector<HTMLElement>('[data-el="preset-name"]')
        ?? null;
    const selectors = {
        keyboard: ".keyboard",
        rail: '[data-role="mobile-global-mod-rail"]',
        knob: '[data-role="parameter-knob-artwork"]',
        filter: scenario === "fx-filter"
            ? '[data-role="rack-editor-filter"] [data-role="filter-response-graph"]'
            : '[data-role="mobile-workspace-panel-voice"] [data-role="filter-response-graph"]',
        image: ".mobile-mod-source-art img",
        hud: '[data-role="mobile-voice-hud"]',
        ghost: '[data-role="mobile-global-mod-source-ghost"]',
    };
    return {
        scenario,
        workspace: root.querySelector('[data-role^="mobile-workspace-tab-"][aria-selected="true"]')?.getAttribute("data-role") ?? null,
        keyboardNoteCount: root.querySelectorAll(".keyboard .note").length
            || root.querySelector(".keyboard")?.shadowRoot?.querySelectorAll(".note").length
            || 0,
        svgCount: root.querySelectorAll("svg").length,
        imageCount: root.querySelectorAll("img").length,
        landmarks: Object.fromEntries([
            ...(presetTitle ? [["title", presetTitle.getBoundingClientRect().toJSON()] as const] : []),
            ...Object.entries(selectors).flatMap(([key, selector]) => {
            const rect = rectFor(root, selector);
            return rect ? [[key, rect]] : [];
            }),
        ]),
    };
}

/** The rail's source lights chase seeded values on a 45ms time constant and
    snap once settled (~340ms). Waiting past that means both trees freeze on
    the identical converged light state instead of two mid-chase frames. */
function settleModSourceLights() {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 450));
}

function seedTelemetry(patchConnection: MockPatchConnection) {
    patchConnection.setRuntimeState({ hasActive: true, activeTableIndex: 0, activeGeneration: 1 });
    patchConnection.emitEffectiveWavetablePosition(0.63);
    patchConnection.emitEffectiveWarpState({ amount: 0.42 });
    patchConnection.emitEffectiveUnisonState({ voices: 5, detune: 0.31, width: 0.82 });
    patchConnection.emitEffectiveFilterState({ mode: 1, cutoffHz: 2_600, q: 2.2 });
    patchConnection.emitEffectiveMsegState({ positions: [0.22, 0.57, 0.81] });
    patchConnection.emitEffectiveModSourceState({ values: [0.3, 0.7, 0.45, 0.2, 0.8, 0.1, 0.65, 0.4, 0.9] });
    patchConnection.emitFilterSpectrum({
        magnitudes: Array.from({ length: 96 }, (_, index) => -78 + (34 * Math.sin((index / 95) * Math.PI) ** 2)),
    });
}

function ProbeReady({
    patchConnection,
    scenario,
}: {
    readonly patchConnection: MockPatchConnection;
    readonly scenario: FidelityScenario;
}) {
    const { delayRender, continueRender, cancelRender } = useDelayRender();
    const [handle] = useState(() => delayRender(`M0 fidelity ${scenario}`));

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const root = document.querySelector<HTMLElement>(`[data-fidelity-capture="${scenario}"]`);
            if (!root) {
                throw new Error(`Fidelity capture root did not mount for ${scenario}.`);
            }
            seedTelemetry(patchConnection);
            await waitForFrames(3);
            await applyScenario(root, scenario);
            await settleModSourceLights();
            await settleCaptureSubtree(root, {
                animationTimeMilliseconds: FIDELITY_ANIMATION_TIME_MILLISECONDS,
            });
            latestCaptureInspection = inspect(root, scenario);
            if (!cancelled) {
                continueRender(handle);
            }
        })().catch((error) => {
            if (!cancelled) {
                cancelRender(error instanceof Error ? error : new Error(String(error)));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [cancelRender, continueRender, handle, patchConnection, scenario]);

    return (
        <div
            data-fidelity-capture={scenario}
            // The shipped capture class, so its rasterizer overrides (overlay
            // re-basing, forced content-visibility) are what this gate
            // validates. Its phone chrome is inline-neutralized because the
            // live reference has no bezel and the compare is edge to edge.
            className="speedrun-scripted-phone"
            style={{
                width: 393,
                height: 852,
                position: "relative",
                overflow: "hidden",
                background: "#02040b",
                border: 0,
                borderRadius: 0,
                boxShadow: "none",
                colorScheme: "dark",
            }}
        >
            <DesktopPatchView
                patchConnection={patchConnection}
                resourceClient={createDesktopResourceClient(patchConnection)}
                keyboardInputMode="standalone-preview"
            />
        </div>
    );
}

export async function configureFidelityKeyboard(
    patchConnection: MockPatchConnection,
    mode: "native" | "capture",
) {
    const keyboardModuleUrl = "/cmaj_api/cmaj-piano-keyboard.js";
    const keyboardModule = await import(/* @vite-ignore */ keyboardModuleUrl);
    const NativePianoKeyboard = keyboardModule.default as CustomElementConstructor;
    (patchConnection.utilities as { PianoKeyboard: CustomElementConstructor }).PianoKeyboard = mode === "capture"
        ? createCapturePianoKeyboardClass(NativePianoKeyboard)
        : NativePianoKeyboard;
    patchConnection.setStoredStateValue(
        LANE_STATE_KEY,
        serializeLaneStateV2(upgradeLaneStateV1(createDefaultLaneState())),
    );
    patchConnection.setStoredStateValue(
        MODULATION_STATE_KEY,
        serializeModulationState(normalizeModulationState({
            routes: [{
                id: "m0-fidelity-route",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "filterQ",
                amount: 0.35,
                reducer: "max",
            }],
        })),
    );
}

export function installFidelityProbe(
    patchConnection: MockPatchConnection,
    liveRoot: HTMLElement,
) {
    window.__COSIMO_VIDEO_BOUNCE_FIDELITY__ = {
        async prepareLiveScenario(scenario) {
            seedTelemetry(patchConnection);
            await applyScenario(liveRoot, scenario);
            await settleModSourceLights();
            // The live tree is the reference: settle fonts, images, and
            // animation time, but never apply capture-only SVG workarounds.
            await settleCaptureSubtree(liveRoot, {
                flattenShadowRoots: false,
                rasterizerWorkarounds: false,
                animationTimeMilliseconds: FIDELITY_ANIMATION_TIME_MILLISECONDS,
            });
            return inspect(liveRoot, scenario);
        },
        async renderStill(scenario) {
            latestCaptureInspection = null;
            sessionStorage.setItem(WORKSPACE_SHELL_STORAGE_KEY, shellStateForScenario(scenario));
            const Component = () => <ProbeReady patchConnection={patchConnection} scenario={scenario} />;
            const result = await renderStillOnWeb({
                composition: {
                    id: `cosimo-m0-fidelity-${scenario}`,
                    component: Component,
                    durationInFrames: 30,
                    fps: 30,
                    width: 393,
                    height: 852,
                },
                frame: 0,
                logLevel: "warn",
                delayRenderTimeoutInMilliseconds: 60_000,
            });
            const blob = await result.blob({ format: "png" });
            if (latestCaptureInspection === null) {
                throw new Error(`The ${scenario} capture completed without an inspection snapshot.`);
            }
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return {
                dataUrl: `data:image/png;base64,${btoa(binary)}`,
                bytes: blob.size,
                inspection: latestCaptureInspection,
            };
        },
    };
}
