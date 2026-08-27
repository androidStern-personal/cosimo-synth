/**
 * T17 wall clock on this machine (same 169-case name set):
 * Before: 1,660.944 s / 27m 40.944s (build/t17-baseline-suite.log).
 * After: 433.675 s, 434.457 s, and 441.839 s across three green four-shard runs;
 * median 434.457 s / 7m 14.457s (3.82x faster, 73.8% less wall clock).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
    normalizeArticulationEditorState,
    normalizeArticulationSnapshot,
    ARTICULATIONS_V4_STATE_KEY,
    parseArticulationsV4,
    deserializeMsegShape,
    renderMsegShape,
    MODULATION_SOURCE_OPTIONS,
    MODULATION_STATE_KEY,
    MODULATION_TARGET_OPTIONS,
    createDefaultModulationState,
    deserializeModulationState,
    normalizeModulationState,
    getModulationArticulationCellIndex,
    getModulationRuntimeCell,
    clearHarnessDebugLog,
    getHarnessRenderedState,
    getHarnessSnapshot,
    getKeyboardDebug,
    setHarnessRuntimeState,
    startStaticRepoServer,
    startDesktopHarnessServer,
    waitForHarnessReady,
    TEST_SAMPLES_PER_FRAME,
    MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
    EFFECT_PRESETS_V2_STATE_KEY,
    SYNTH_PRESET_EFFECT_ID,
    ARTICULATION_STATE_KEY,
    RETIRED_SYNTH_LOCAL_DIRTY_STATE_KEY,
    expectedMsegPreviewProgressClipWidth,
    buildShortMidi,
    readStoredModulationState,
    readStoredArticulationEditorState,
    editorBankToStoredArticulations,
    readEffectPresetState,
    containsRetiredSynthPresetBaselineKey,
    readStoredMsegShape,
    readStoredMsegPlayback,
    readStoredRouteAmount,
    routeSummary,
    routeSummaries,
    ensureFirstModulationRoute,
    RUNTIME_PATH_FIELDS,
    RUNTIME_PATH_KINDS,
    latestRuntimeProgram,
    readRuntimeProgramRoute,
    hasRuntimeAmount,
    compactRuntimeMessages,
    buildDistortionScopeFixture,
    buildDistortionHistoryFixture,
    dispatchInputValueChange,
    selectRackEffect,
    expandGlobalModRail,
    collapseGlobalModRail,
    touchPointForModSourcePreviewTarget,
    editRackParameterValue,
    dispatchRackKnobPointerEvents,
    clickFilterGraphAt,
    dragFilterHandleBy,
    dragEnvelopeHandleBy,
    dragLocatorBy,
    choosePrototypeSelectOption,
    waitForHarnessSnapshot,
    waitForPageValue,
    waitForReactFrames,
    readVisibleHarnessParameterEndpointIDs,
    clickPresetBarAction,
    saveSynthPresetAs,
    waitForPresetBarDirtyState,
    dragArticulationCardToLane,
    previewArticulationCardDragOver,
    readDesktopRangeSegments,
    readDesktopRangeViewport,
    openHarnessPage,
    showVoiceControls,
    openBuiltDesktopBundlePage,
    openDesktopEntryPageWithInjectedResourceClient,
    assertLatestMsegBufferMatchesStoredShape,
    beginRackReorderWithoutPointerCapture,
    endRackReorderWithoutPointerCapture,
    rectsIntersect,
    rectContains,
    readGlobalModRailGeometry,
} from "./helpers/desktop_patch_view_browser_suite.mjs";

test("desktop harness renders the real React patch view and requests runtime sync on boot", async () => {
    const page = await openHarnessPage();

    try {
        assert.equal(await page.title(), "Cosimo Desktop UI Harness");
        assert.equal(await page.locator("cosimo-desktop-react-view").count(), 1);
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        await page.waitForSelector("text=Ready");

        const snapshot = await getHarnessSnapshot(page);
        const runtimeSyncMessages = snapshot.sentMessages.filter(
            ({ endpointID }) => endpointID === "runtimeSyncRequest",
        );

        assert.equal(
            runtimeSyncMessages.some(({ value }) => value === 1),
            true,
            "The UI must request its initial runtime presentation state.",
        );
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegPlayback"), true);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"), true);
    } finally {
        await page.close();
    }
});

test("design-system typography preserves utility intent and active knob labels remain readable", async () => {
    const page = await openHarnessPage();

    try {
        const surface = page.locator(".cosimo-surface").first();
        await surface.evaluate((element) => {
            const probe = document.createElement("span");
            probe.dataset.role = "design-system-mono-utility-probe";
            probe.className = "font-mono text-xs text-cyan-200/80";
            probe.textContent = "Utility probe";
            element.appendChild(probe);
        });

        const utilityStyle = await page.locator('[data-role="design-system-mono-utility-probe"]').evaluate((element) => {
            const style = getComputedStyle(element);
            return {
                fontSize: style.fontSize,
                textTransform: style.textTransform,
            };
        });
        assert.deepEqual(utilityStyle, {
            fontSize: "12px",
            textTransform: "none",
        });

        const activeLabel = page.locator('.rack-parameter-knob:not(:disabled) .rack-knob-label').first();
        await activeLabel.waitFor();
        const labelContrast = await activeLabel.evaluate((element) => {
            const style = getComputedStyle(element);
            const channels = style.color.match(/[\d.]+/g)?.map(Number) ?? [];
            const raised = style.getPropertyValue("--cosimo-raised-rgb").trim().split(/\s+/).map(Number);
            if (channels.length < 3 || raised.length !== 3) {
                return 0;
            }
            const alpha = channels[3] ?? 1;
            const composited = channels.slice(0, 3).map((channel, index) => (
                (channel * alpha) + (raised[index] * (1 - alpha))
            ));
            const luminance = (rgb) => {
                const linear = rgb.map((channel) => {
                    const normalized = channel / 255;
                    return normalized <= 0.04045
                        ? normalized / 12.92
                        : ((normalized + 0.055) / 1.055) ** 2.4;
                });
                return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
            };
            const foreground = luminance(composited);
            const background = luminance(raised);
            return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
        assert.ok(labelContrast >= 4.5, `Expected active knob-label contrast >= 4.5, got ${labelContrast}`);
        assert.deepEqual(page.__cosimoDiagnostics, []);
    } finally {
        await page.close();
    }
});

test("Global Tune stays continuous, brackets edits for host undo, and accepts host-restored values", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const knob = page.locator('[data-role="global-tune-knob"]');
        await knob.waitFor({ state: "visible" });
        assert.equal(await knob.getAttribute("aria-valuemin"), "-24");
        assert.equal(await knob.getAttribute("aria-valuemax"), "24");
        assert.equal(await knob.getAttribute("aria-valuetext"), "0 st 00 ct");
        assert.equal(await knob.getAttribute("data-detented"), "false");

        await clearHarnessDebugLog(page);
        await knob.press("ArrowRight");
        let snapshot = await waitForHarnessSnapshot(
            page,
            "continuous Global Tune host gesture",
            (nextSnapshot) => nextSnapshot.gestureStarts.includes("globalTune")
                && nextSnapshot.gestureEnds.includes("globalTune")
                && Math.abs(Number(nextSnapshot.parameterValues.globalTune)) > 0.01,
        );
        assert.deepEqual(snapshot.gestureStarts, ["globalTune"]);
        assert.deepEqual(snapshot.gestureEnds, ["globalTune"]);
        assert.notEqual(Number.isInteger(Number(snapshot.parameterValues.globalTune)), true);
        assert.match(await knob.getAttribute("aria-valuetext"), /^[+-]?\d+ st \d{2} ct$/);

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("globalTune", -3.45);
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="global-tune-knob"]')?.getAttribute("aria-valuenow") === "-3.45"
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.parameterValues.globalTune, -3.45);
        assert.equal(await knob.getAttribute("aria-valuetext"), "-3 st 45 ct");
    } finally {
        await page.close();
    }
});

test("desktop Vite harness installs React Grab and registers the official MCP plugin in dev mode", async () => {
    const page = await openHarnessPage();

    try {
        const reactGrabState = await page.evaluate(() => {
            const api = window.__REACT_GRAB__;

            if (!api || typeof api !== "object") {
                return null;
            }

            return {
                hasRegisterPlugin: typeof api.registerPlugin === "function",
                hasGetPlugins: typeof api.getPlugins === "function",
                plugins: typeof api.getPlugins === "function" ? api.getPlugins() : null,
            };
        });

        assert.equal(reactGrabState?.hasRegisterPlugin, true);
        assert.equal(reactGrabState?.hasGetPlugins, true);
        assert.equal(Array.isArray(reactGrabState?.plugins), true);
        assert.equal(reactGrabState.plugins.includes("mcp"), true);
    } finally {
        await page.close();
    }
});

test("built desktop bundle renders the stage without duplicating worker-owned runtime installation", async () => {
    const page = await openBuiltDesktopBundlePage();

    try {
        await page.waitForSelector("cosimo-desktop-react-view");
        await page.waitForSelector("text=Ready");
        assert.equal(
            await page.evaluate(() => Boolean(document.querySelector("cosimo-desktop-react-view")?.shadowRoot)),
            true,
        );
        assert.equal(
            await page.evaluate(() => "__REACT_GRAB__" in window),
            false,
        );
        assert.equal(await page.locator('[data-role="curve-lab-toggle"]').count(), 0);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        assert.equal(await page.locator("#mount > pre").count(), 0);

        const builtBundleSnapshot = await page.evaluate(() => window.__COSIMO_BUILT_DESKTOP_DEBUG__.getSnapshot());
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "runtimeSyncRequest"),
            true,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegBuffer"),
            false,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationMsegPlayback"),
            false,
        );
        assert.equal(
            builtBundleSnapshot.sentMessages.some(({ endpointID }) => endpointID === "modulationProgram"),
            false,
        );
        assert.deepEqual(builtBundleSnapshot.keyboardDebug?.attachCalls ?? [], [{ endpointID: "midiIn" }]);
    } finally {
        await page.close();
    }
});

test("built desktop bundle active Voice tab re-tap scrolls its shadow-root panel to the top", async () => {
    const page = await openBuiltDesktopBundlePage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return root?.querySelector('[data-role="mobile-workspace-panel-voice"]') instanceof HTMLElement
                && root.querySelector('[data-role="mobile-workspace-tab-voice"]') instanceof HTMLButtonElement;
        });

        const initialScrollTop = await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const panel = root?.querySelector('[data-role="mobile-workspace-panel-voice"]');

            if (!(panel instanceof HTMLElement)) {
                throw new Error("Expected the built Voice workspace panel inside the shadow root.");
            }

            const spacer = document.createElement("div");
            spacer.style.height = `${panel.clientHeight + 320}px`;
            panel.append(spacer);
            panel.scrollTop = panel.scrollHeight;
            return panel.scrollTop;
        });
        assert.ok(initialScrollTop > 0, "The built Voice panel must accept a nonzero pre-tap scroll position.");

        await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const tab = root?.querySelector('[data-role="mobile-workspace-tab-voice"]');

            if (!(tab instanceof HTMLButtonElement)) {
                throw new Error("Expected the built active Voice workspace tab inside the shadow root.");
            }

            tab.click();
        });

        const reachedTop = await page.waitForFunction(() => {
            const panel = document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="mobile-workspace-panel-voice"]');
            return panel instanceof HTMLElement && panel.scrollTop === 0;
        }, null, { timeout: 3_000 }).then(() => true, () => false);
        const finalScrollTop = await page.evaluate(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="mobile-workspace-panel-voice"]')?.scrollTop ?? -1
        ));
        assert.equal(
            reachedTop,
            true,
            `The built active Voice tab must scroll its shadow-root panel to the top; scrollTop stayed at ${finalScrollTop}.`,
        );
    } finally {
        await page.close();
    }
});

test("built desktop bundle renders visible distortion dual-ring knobs inside the shadow DOM", async () => {
    const page = await openBuiltDesktopBundlePage();

    try {
        await page.waitForSelector("cosimo-desktop-react-view");
        await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const selectDrive = host?.shadowRoot?.querySelector('[data-role="rack-station-drive"]');

            if (!(selectDrive instanceof HTMLButtonElement)) {
                throw new Error("Expected the Distortion rack selector in the built bundle.");
            }

            selectDrive.click();
        });
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot?.querySelector('[data-role="rack-editor-drive"]')
            instanceof HTMLElement
        ));

        const knobState = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const root = host?.shadowRoot;

            if (!root) {
                return null;
            }

            return [
                ["distortion-drive-field", "distortion-drive-handle"],
                ["distortion-knee-field", "distortion-knee-handle"],
                ["distortion-mix-field", "distortion-mix-handle"],
            ].map(([controlRole, handleRole]) => {
                const control = root.querySelector(`[data-role="${controlRole}"]`);
                const art = control?.querySelector(".rack-knob-art");
                const handle = control?.querySelector(`[data-role="${handleRole}"]`);
                const defaultMarker = control?.querySelector(".rack-knob-default-marker");

                if (!(control instanceof HTMLButtonElement)
                    || !(art instanceof SVGSVGElement)
                    || !(handle instanceof SVGCircleElement)
                    || !(defaultMarker instanceof SVGCircleElement)) {
                    return { controlRole, exists: false };
                }

                const artRect = art.getBoundingClientRect();
                const handleStyle = getComputedStyle(handle);

                return {
                    controlRole,
                    exists: true,
                    artWidth: artRect.width,
                    artHeight: artRect.height,
                    defaultMarkerFill: getComputedStyle(defaultMarker).fill,
                    handleFill: handleStyle.fill,
                    handleStroke: handleStyle.stroke,
                    opacity: handleStyle.opacity,
                    visibility: handleStyle.visibility,
                };
            });
        });

        assert.notEqual(knobState, null);

        for (const knob of knobState) {
            assert.equal(knob.exists, true, `${knob.controlRole} should render a complete dual-ring knob`);
            assert.equal(knob.artWidth >= 40, true, `${knob.controlRole} should have visible knob art: ${JSON.stringify(knob)}`);
            assert.equal(knob.artHeight >= 40, true, `${knob.controlRole} should have visible knob art: ${JSON.stringify(knob)}`);
            assert.notEqual(knob.handleFill, "none", `${knob.controlRole} should render a live value indicator`);
            assert.notEqual(knob.handleStroke, "none", `${knob.controlRole} should render a live indicator edge`);
            assert.notEqual(knob.defaultMarkerFill, "none", `${knob.controlRole} should render its fixed default marker`);
            assert.equal(knob.opacity, "1", `${knob.controlRole} should not be transparent`);
            assert.equal(knob.visibility, "visible", `${knob.controlRole} should not be hidden`);
        }
    } finally {
        await page.close();
    }
});

test("desktop dev curve lab retunes the real filter resonance drag curve", async () => {
    const page = await openHarnessPage();

    try {
        const curveLabToggle = page.locator('[data-role="curve-lab-toggle"]');
        assert.equal(await curveLabToggle.count(), 1);

        const popupPromise = page.waitForEvent("popup");
        await curveLabToggle.click();
        const curveLabPage = await popupPromise;
        await curveLabPage.waitForLoadState("domcontentloaded");
        await curveLabPage.waitForSelector('[data-role="curve-lab-panel"]');

        const linearFamilyButton = curveLabPage.locator('[data-role="curve-lab-family-linear"]');
        await linearFamilyButton.click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve?.familyId === "linear"
        ));

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("filterQ", 0.1, true);
        });
        await page.waitForFunction(() => (
            Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterQ) - 0.1) <= 0.001
        ));

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 0, -72);
        let snapshot = await waitForHarnessSnapshot(
            page,
            "linear filter resonance drag result",
            (nextSnapshot) => Number(nextSnapshot.parameterValues.filterQ) > 0.3,
        );
        const linearDraggedQ = Number(snapshot.parameterValues.filterQ);

        const balancedPowerFamilyButton = curveLabPage.locator('[data-role="curve-lab-family-balanced-power"]');
        await balancedPowerFamilyButton.click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve?.familyId === "balanced-power"
        ));

        const powerCoefficient = curveLabPage.locator('[data-role="curve-lab-coefficient-power"]');
        await dispatchInputValueChange(powerCoefficient, 3.8);
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "balanced-power"
                && Math.abs(Number(curve?.coefficients?.power) - 3.8) <= 0.001;
        });

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("filterQ", 0.1, true);
        });
        await page.waitForFunction(() => (
            Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterQ) - 0.1) <= 0.001
        ));

        await clearHarnessDebugLog(page);
        await dragFilterHandleBy(page, 0, -72);
        snapshot = await waitForHarnessSnapshot(
            page,
            "balanced power filter resonance drag result",
            (nextSnapshot) => Number(nextSnapshot.parameterValues.filterQ) > 0.12,
        );
        const curvedDraggedQ = Number(snapshot.parameterValues.filterQ);

        assert.ok(
            curvedDraggedQ < linearDraggedQ,
            `Expected the balanced power curve to move resonance less near the floor. Linear=${linearDraggedQ}, curved=${curvedDraggedQ}`,
        );

        const popupClose = new Promise((resolve) => curveLabPage.once("close", resolve));
        await curveLabPage.getByRole("button", { name: "Close", exact: true }).click();
        await popupClose;
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 11.1) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.84) <= 0.001;
        });
    } finally {
        await page.close();
    }
});

test("desktop filter resonance drag defaults to the locked sigmoid curve", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 11.1) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.84) <= 0.001;
        });

        const renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.resonanceCurve.familyId, "sigmoid");
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 11.1) <= 0.001, true);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.center - 0.84) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("desktop dev curve lab uses the native desktop bridge when it is available", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.addInitScript(() => {
                window.__COSIMO_NATIVE_CURVE_LAB_TEST__ = {
                    openCalls: 0,
                    closeCalls: 0,
                    stateJSON: "",
                };

                window.cosimo_desktop_curve_lab_openWindow = async () => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.openCalls += 1;
                };

                window.cosimo_desktop_curve_lab_closeWindow = async () => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.closeCalls += 1;
                };

                window.cosimo_desktop_curve_lab_getState = async () => window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON;

                window.cosimo_desktop_curve_lab_setState = async (nextState) => {
                    window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = String(nextState);
                };
            });
        },
    });

    try {
        await page.waitForFunction(() => (
            typeof window.__COSIMO_NATIVE_CURVE_LAB_TEST__?.stateJSON === "string"
            && window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON.length > 0
        ));

        await page.evaluate(() => {
            const nextState = JSON.parse(window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON);
            nextState.isOpen = false;
            nextState.profiles["filter-resonance-handle"] = {
                familyId: "sigmoid",
                coefficients: {
                    slope: 9.2,
                    center: 0.31,
                },
            };
            window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = JSON.stringify(nextState);
            window.dispatchEvent(new CustomEvent("cosimo-desktop-curve-lab-state", { detail: nextState }));
        });

        await page.waitForTimeout(50);
        let renderedState = await getHarnessRenderedState(page);
        assert.equal(renderedState.filterGraphState.resonanceCurve.familyId, "sigmoid");
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 11.1) <= 0.001, true);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.center - 0.84) <= 0.001, true);

        const curveLabToggle = page.locator('[data-role="curve-lab-toggle"]');
        await curveLabToggle.click();
        assert.equal(await page.evaluate(() => window.__COSIMO_NATIVE_CURVE_LAB_TEST__.openCalls), 1);

        await page.evaluate(() => {
            const nextState = JSON.parse(window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON);
            nextState.isOpen = true;
            nextState.profiles["filter-resonance-handle"] = {
                familyId: "sigmoid",
                coefficients: {
                    slope: 9.2,
                    center: 0.31,
                },
            };
            window.__COSIMO_NATIVE_CURVE_LAB_TEST__.stateJSON = JSON.stringify(nextState);
            window.dispatchEvent(new CustomEvent("cosimo-desktop-curve-lab-state", { detail: nextState }));
        });

        await page.waitForFunction(() => {
            const curve = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().filterGraphState?.resonanceCurve;
            return curve?.familyId === "sigmoid"
                && Math.abs(Number(curve?.coefficients?.slope) - 9.2) <= 0.001
                && Math.abs(Number(curve?.coefficients?.center) - 0.31) <= 0.001;
        });

        renderedState = await getHarnessRenderedState(page);
        assert.equal(Math.abs(renderedState.filterGraphState.resonanceCurve.coefficients.slope - 9.2) <= 0.001, true);
    } finally {
        await page.close();
    }
});

test("desktop patch view scrolls vertically when the window is shorter than the full layout", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 1280, height: 720 });
        },
    });

    try {
        await page.waitForSelector("text=Filter");
        const initialMetrics = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const scrollRegion = viewRoot?.querySelector('[data-role="desktop-scroll-region"]');

            if (!(scrollRegion instanceof HTMLElement)) {
                throw new Error("Desktop scroll region is missing.");
            }

            return {
                clientHeight: scrollRegion.clientHeight,
                scrollHeight: scrollRegion.scrollHeight,
                scrollTop: scrollRegion.scrollTop,
            };
        });

        assert.ok(
            initialMetrics.scrollHeight > initialMetrics.clientHeight,
            `Expected the desktop patch view to overflow vertically. Got ${JSON.stringify(initialMetrics)}`,
        );

        const scrolledMetrics = await page.evaluate(async () => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const viewRoot = host?.shadowRoot ?? host;
            const scrollRegion = viewRoot?.querySelector('[data-role="desktop-scroll-region"]');

            if (!(scrollRegion instanceof HTMLElement)) {
                throw new Error("Desktop scroll region is missing.");
            }

            scrollRegion.scrollTop = scrollRegion.scrollHeight;
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));

            return {
                scrollTop: scrollRegion.scrollTop,
                clientHeight: scrollRegion.clientHeight,
                scrollHeight: scrollRegion.scrollHeight,
            };
        });

        assert.ok(
            scrolledMetrics.scrollTop > 0,
            `Expected the desktop patch view to accept vertical scrolling. Got ${JSON.stringify(scrolledMetrics)}`,
        );
    } finally {
        await page.close();
    }
});

test("desktop voice visuals stack full-width above the compact panel grid", async () => {
    const viewportCases = [
        { label: "narrow desktop", width: 775, height: 700 },
        { label: "standalone desktop", width: 976, height: 768 },
    ];

    for (const viewportCase of viewportCases) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize({ width: viewportCase.width, height: viewportCase.height });
            },
        });

        try {
            await page.waitForSelector("text=Ready");
            await selectRackEffect(page, "drive");

            const metrics = await page.evaluate(() => {
            const host = document.querySelector("cosimo-desktop-react-view");
            const root = host?.shadowRoot ?? document;
            const rectOf = (selector) => {
                const element = root.querySelector(selector);

                if (!(element instanceof Element)) {
                    throw new Error(`Missing element: ${selector}`);
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return {
                    x: rect.x,
                    y: rect.y,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                    borderRadius: style.borderRadius,
                    padding: style.padding,
                };
            };

            const gridCardSelectors = [
                '[data-role="wavetable-card"]',
                '[data-role="filter-card"]',
                '[data-role="mseg-card"]',
                '[data-role="mod-matrix-card"]',
            ];
            const cards = gridCardSelectors.map((selector) => {
                const element = root.querySelector(selector);

                if (!(element instanceof Element)) {
                    throw new Error(`Missing grid card: ${selector}`);
                }

                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);

                return {
                    role: element.getAttribute("data-role") ?? selector,
                    width: rect.width,
                    height: rect.height,
                    borderRadius: style.borderRadius,
                    hasSharedShell: element.getAttribute("data-layout-card") === "desktop-grid-card",
                };
            });

            return {
                cards,
                wavetable: rectOf(".cosimo-stage"),
                wavetableCanvas: rectOf(".cosimo-stage canvas"),
                wavetableTopControls: rectOf('[data-role="wavetable-stage-top-controls"]'),
                wavetableBottomControls: rectOf('[data-role="wavetable-stage-bottom-controls"]'),
                wavetableSelectChip: rectOf('[data-role="wavetable-select-chip"]'),
                wavetableFrameChip: rectOf('[data-role="wavetable-frame-chip"]'),
                warpControlCluster: rectOf('[data-role="warp-control-cluster"]'),
                warpModeControl: rectOf('[data-role="warp-mode-control"]'),
                wavetablePanField: rectOf('[data-role="wavetable-pan-field"]'),
                filterModeChip: rectOf('[data-role="filter-mode-chip"]'),
                filterAnalyzerChip: rectOf('[data-role="filter-analyzer-chip"]'),
                filterCutoffField: rectOf('[data-role="filter-cutoff-field"]'),
                filterResonanceField: rectOf('[data-role="filter-resonance-field"]'),
                distortionModeButton: rectOf('[data-role="distortion-mode-option-1"]'),
                filter: rectOf('[data-role="filter-card"]'),
                filterGraph: rectOf('[data-role="filter-response-graph"]'),
            };
            });

            assert.equal(metrics.cards.length, 4, `Expected the four compact desktop panels to be measured by name at ${viewportCase.label}.`);
            assert.deepEqual(
                metrics.cards.map((card) => card.hasSharedShell),
                Array.from({ length: metrics.cards.length }, () => true),
                `Expected the six main desktop panels to opt into the shared grid-card shell at ${viewportCase.label}.`,
            );
            assert.deepEqual(
                metrics.cards.map((card) => card.borderRadius),
                Array.from({ length: metrics.cards.length }, () => "14px"),
                `desktop grid panels should share the same compact shell radius instead of per-panel hero shells at ${viewportCase.label}`,
            );

            assert.equal(
                Math.abs(metrics.filter.width - metrics.wavetable.width) <= 1,
                true,
                `Expected the filter to match the full-width wavetable shell at ${viewportCase.label}: ${JSON.stringify({ filter: metrics.filter, wavetable: metrics.wavetable })}`,
            );
            assert.equal(
                Math.abs(metrics.filter.x - metrics.wavetable.x) <= 1,
                true,
                `Expected the filter to align beneath the wavetable at ${viewportCase.label}: ${JSON.stringify({ filter: metrics.filter, wavetable: metrics.wavetable })}`,
            );
            assert.equal(
                metrics.filter.y >= metrics.wavetable.bottom + 12,
                true,
                `Expected the filter to occupy its own row beneath the wavetable at ${viewportCase.label}: ${JSON.stringify({ filter: metrics.filter, wavetable: metrics.wavetable })}`,
            );
            assert.equal(
                metrics.wavetable.height >= 230,
                true,
                `Expected enough wavetable height to keep the graphic visible at ${viewportCase.label}: ${JSON.stringify(metrics.wavetable)}`,
            );

            const compactGridCards = metrics.cards.slice(2);
            const compactReferenceCard = compactGridCards[0];

            assert.equal(
                metrics.wavetable.width >= compactReferenceCard.width * 1.9,
                true,
                `Expected voice visualizations to span both compact-card columns at ${viewportCase.label}: ${JSON.stringify({ wavetable: metrics.wavetable, compactReferenceCard })}`,
            );

            for (const card of compactGridCards) {
                assert.equal(
                    Math.abs(card.width - compactReferenceCard.width) <= 1,
                    true,
                    `Expected ${card.role || "grid card"} width to match the compact grid at ${viewportCase.label}: ${JSON.stringify({ card, compactReferenceCard })}`,
                );
                assert.equal(
                    Math.abs(card.height - compactReferenceCard.height) <= 1,
                    true,
                    `Expected ${card.role || "grid card"} height to match the compact grid at ${viewportCase.label}: ${JSON.stringify({ card, compactReferenceCard })}`,
                );
            }

            assert.equal(
                metrics.wavetableTopControls.height <= 36,
                true,
                `Wavetable top controls should use compact card spacing, not the old stage band at ${viewportCase.label}: ${JSON.stringify(metrics.wavetableTopControls)}`,
            );
            assert.equal(
                metrics.wavetableBottomControls.height <= 34,
                true,
                `Wavetable bottom controls should use compact card spacing, not the old stage band at ${viewportCase.label}: ${JSON.stringify(metrics.wavetableBottomControls)}`,
            );
            for (const compactControl of [
                metrics.wavetableSelectChip,
                metrics.wavetableFrameChip,
                metrics.warpModeControl,
                metrics.filterModeChip,
                metrics.filterAnalyzerChip,
            ]) {
                assert.equal(
                    compactControl.height <= metrics.distortionModeButton.height + 6,
                    true,
                    `Expected top-row chip/control height to stay close to the compact distortion mode button at ${viewportCase.label}: ${JSON.stringify({ compactControl, distortionModeButton: metrics.distortionModeButton })}`,
                );
            }
            for (const compactField of [
                metrics.wavetablePanField,
                metrics.filterCutoffField,
                metrics.filterResonanceField,
            ]) {
                assert.equal(
                    compactField.height <= metrics.distortionModeButton.height + 8,
                    true,
                    `Expected top-row number fields to use compact overlay sizing at ${viewportCase.label}: ${JSON.stringify({ compactField, distortionModeButton: metrics.distortionModeButton })}`,
                );
            }
            assert.equal(
                metrics.warpControlCluster.height <= metrics.distortionModeButton.height + 8,
                true,
                `Expected the warp cluster to use compact overlay sizing at ${viewportCase.label}: ${JSON.stringify({ warpControlCluster: metrics.warpControlCluster, distortionModeButton: metrics.distortionModeButton })}`,
            );
            assert.equal(metrics.wavetableCanvas.width / metrics.wavetable.width >= 0.98, true);
            assert.equal(metrics.wavetableCanvas.height / metrics.wavetable.height >= 0.98, true);
            assert.equal(metrics.filterGraph.width / metrics.filter.width >= 0.94, true);
            assert.equal(metrics.filterGraph.height / metrics.filter.height >= 0.9, true);
        } finally {
            await page.close();
        }
    }
});

test("T54 keeps the wavetable corner controls on symmetric insets at phone, plugin, and desktop sizes", async () => {
    const readCornerGeometry = async (page, containerSelector, roles) => (
        await page.locator(containerSelector).evaluate((container, requestedRoles) => {
            const serialize = (element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                };
            };
            const controls = Object.fromEntries(Object.entries(requestedRoles).map(([corner, role]) => {
                const element = container.querySelector(`[data-role="${role}"]`);
                if (!(element instanceof Element)) {
                    throw new Error(`Missing wavetable control: ${role}`);
                }
                return [corner, serialize(element)];
            }));
            return { container: serialize(container), ...controls };
        }, roles)
    );
    const assertSymmetricPair = (container, leftControl, rightControl, label) => {
        const leftInset = leftControl.left - container.left;
        const rightInset = container.right - rightControl.right;
        assert.equal(
            Math.abs(leftInset - rightInset) <= 0.5,
            true,
            `${label} must mirror its left/right insets: ${JSON.stringify({ leftInset, rightInset, container, leftControl, rightControl })}`,
        );
        assert.equal(rectContains(container, leftControl), true, `${label} left control must stay inside its wavetable container.`);
        assert.equal(rectContains(container, rightControl), true, `${label} right control must stay inside its wavetable container.`);
        assert.equal(rectsIntersect(leftControl, rightControl), false, `${label} controls must not overlap.`);
    };

    for (const viewport of [
        { label: "narrow phone with right rail", width: 320, height: 568, railEdge: null },
        { label: "phone with right rail", width: 393, height: 852, railEdge: null },
        { label: "phone with left rail", width: 393, height: 852, railEdge: "left" },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: async (nextPage) => {
                await nextPage.setViewportSize(viewport);
                await nextPage.addInitScript(({ railEdge }) => {
                    if (railEdge === null) {
                        localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
                        return;
                    }
                    localStorage.setItem(
                        "cosimo.mobile-global-mod-rail.position.v1",
                        JSON.stringify({ version: 2, edge: railEdge, normalizedY: 0.42 }),
                    );
                }, { railEdge: viewport.railEdge });
            },
        });
        try {
            const geometry = await readCornerGeometry(page, '[data-role="mobile-voice-graph"]', {
                topLeft: "mobile-voice-wavetable-overlay",
                topRight: "mobile-voice-warp-mode",
                bottomLeft: "mobile-voice-chip-unisonVoices",
                bottomRight: "mobile-voice-chip-semitone",
            });

            assertSymmetricPair(
                geometry.container,
                geometry.topLeft,
                geometry.topRight,
                `${viewport.label} top wavetable controls`,
            );
            assertSymmetricPair(
                geometry.container,
                geometry.bottomLeft,
                geometry.bottomRight,
                `${viewport.label} bottom wavetable controls`,
            );
        } finally {
            await page.close();
        }
    }

    const compiledPhonePage = await openBuiltDesktopBundlePage({
        beforeGoto: async (page) => {
            await page.setViewportSize({ width: 393, height: 852 });
            await page.addInitScript(() => {
                localStorage.removeItem("cosimo.mobile-global-mod-rail.position.v1");
            });
        },
    });
    try {
        const geometry = await readCornerGeometry(compiledPhonePage, '[data-role="mobile-voice-graph"]', {
            topLeft: "mobile-voice-wavetable-overlay",
            topRight: "mobile-voice-warp-mode",
            bottomLeft: "mobile-voice-chip-unisonVoices",
            bottomRight: "mobile-voice-chip-semitone",
        });
        assertSymmetricPair(geometry.container, geometry.topLeft, geometry.topRight, "compiled phone top wavetable controls");
        assertSymmetricPair(geometry.container, geometry.bottomLeft, geometry.bottomRight, "compiled phone bottom wavetable controls");
    } finally {
        await compiledPhonePage.close();
    }

    for (const viewport of [
        { label: "plugin", width: 1120, height: 680 },
        { label: "desktop", width: 1440, height: 900 },
    ]) {
        const page = await openHarnessPage({
            beforeGoto: (nextPage) => nextPage.setViewportSize(viewport),
        });
        try {
            const geometry = await readCornerGeometry(page, '[data-role="wavetable-card"]', {
                topLeft: "wavetable-select-chip",
                topRight: "wavetable-frame-chip",
                bottomLeft: "warp-control-cluster",
                bottomRight: "wavetable-pan-field",
            });

            assertSymmetricPair(
                geometry.container,
                geometry.topLeft,
                geometry.topRight,
                `${viewport.label} top wavetable controls`,
            );
            assertSymmetricPair(
                geometry.container,
                geometry.bottomLeft,
                geometry.bottomRight,
                `${viewport.label} bottom wavetable controls`,
            );
        } finally {
            await page.close();
        }
    }
});

test("built desktop bundle ships the compact effect header and no Create Mapping row", async () => {
    const page = await openBuiltDesktopBundlePage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="mobile-workspace-tab-fx"]') instanceof HTMLButtonElement
        ));
        await page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const fxTab = root?.querySelector('[data-role="mobile-workspace-tab-fx"]');
            const distortion = root?.querySelector('[data-role="rack-station-drive"]');
            if (!(fxTab instanceof HTMLButtonElement) || !(distortion instanceof HTMLButtonElement)) {
                throw new Error("Expected the compiled FX tab and Distortion station.");
            }
            fxTab.click();
            distortion.click();
        });
        await page.waitForFunction(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="rack-editor-drive"]') instanceof HTMLElement
        ));
        await page.evaluate(() => document.fonts.ready);

        const readHeader = () => page.evaluate(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            const header = root?.querySelector('[data-role="rack-editor-drive"] .rack-editor-header');
            const heading = header?.querySelector(".rack-editor-heading");
            const name = heading?.querySelector(".rack-editor-name");
            if (!(header instanceof HTMLElement)
                || !(heading instanceof HTMLElement)
                || !(name instanceof HTMLElement)) {
                return null;
            }
            return {
                text: heading.innerText.trim(),
                childTags: Array.from(heading.children).map((child) => child.tagName),
                height: header.getBoundingClientRect().height,
                nameFits: name.scrollWidth <= name.clientWidth + 1
                    && name.scrollHeight <= name.clientHeight + 1,
                nameSize: {
                    scrollWidth: name.scrollWidth,
                    clientWidth: name.clientWidth,
                    scrollHeight: name.scrollHeight,
                    clientHeight: name.clientHeight,
                },
            };
        });
        const activeHeader = await readHeader();
        assert.deepEqual(activeHeader?.childTags, ["STRONG"]);
        assert.equal(activeHeader?.text, "Distortion");
        assert.equal((activeHeader?.height ?? Infinity) <= 50, true);
        assert.equal(
            activeHeader?.nameFits,
            true,
            `Compiled Distortion name is clipped: ${JSON.stringify(activeHeader?.nameSize)}.`,
        );

        const enabledBefore = await page.evaluate(() => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="rack-editor-drive"]')?.getAttribute("data-effect-enabled")
        ));
        await page.evaluate(() => {
            const power = document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="rack-editor-power"]');
            if (!(power instanceof HTMLButtonElement)) {
                throw new Error("Expected the compiled effect power control.");
            }
            power.click();
        });
        await page.waitForFunction((previous) => (
            document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector('[data-role="rack-editor-drive"]')?.getAttribute("data-effect-enabled") !== previous
        ), enabledBefore);
        const toggledHeader = await readHeader();
        assert.deepEqual(toggledHeader?.childTags, ["STRONG"]);
        assert.equal(toggledHeader?.text, "Distortion");

        await expandGlobalModRail(page);
        await page.locator('[data-role="rack-mod-source-mseg-1"]').click();
        assert.equal(
            await page.evaluate(() => document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelectorAll('[data-role="rack-create-mapping"], [data-role="rack-unmapped-pair"]').length),
            0,
        );
    } finally {
        await page.close();
    }
});

test("desktop custom-element wrapper honors an explicitly injected resource client", async () => {
    const page = await openDesktopEntryPageWithInjectedResourceClient();

    try {
        await page.waitForSelector("text=Ready");
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
        assert.equal(await page.locator("text=Explicit Client Table").count() > 0, true);

        const snapshot = await page.evaluate(() => window.__COSIMO_EXPLICIT_RESOURCE_CLIENT_DEBUG__.getSnapshot());
        assert.equal(
            snapshot.resourceReads.some(({ method, path }) =>
                method === "readJSON" && path === "assets/factory-bank-catalog.json"),
            true,
        );
        assert.equal(
            snapshot.resourceReads.some(({ method, path }) =>
                method === "readAudio" && path === "assets/factory_sources/explicit-client.wav"),
            true,
        );
        assert.equal(
            snapshot.resourceReads.every(({ method, path }) =>
                (method === "readJSON" && path === "assets/factory-bank-catalog.json") ||
                (method === "readAudio" && path === "assets/factory_sources/explicit-client.wav")),
            true,
        );
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "runtimeSyncRequest"),
            true,
        );
    } finally {
        await page.close();
    }
});

test("desktop page only shows Retry Load for failures on the current desired wavetable", async () => {
    const page = await openHarnessPage();

    try {
        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 4,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 0,
            failedGeneration: 4,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });

        await page.waitForSelector("text=Wavetable load timed out.");
        assert.equal(await page.getByRole("button", { name: "Retry Load" }).count(), 0);
    } finally {
        await page.close();
    }
});

test("desktop harness surfaces catalog load failures instead of going blank", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.route("**/assets/factory-bank-catalog.json", async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: "text/plain",
                    body: "catalog failure",
                });
            });
        },
    });

    try {
        await page.waitForSelector("text=Could not load the factory bank.");
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
    } finally {
        await page.close();
    }
});

test("desktop harness surfaces frame load failures instead of blanking the stage", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.route("**/assets/factory_sources/**", async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: "text/plain",
                    body: "frame failure",
                });
            });
        },
    });

    try {
        await page.waitForSelector("text=Could not render the current wavetable.");
        assert.equal((await getHarnessRenderedState(page)).errorText, null);
        assert.equal(await page.locator(".cosimo-stage canvas").count(), 1);
    } finally {
        await page.close();
    }
});

test("wavetable picker prewarms the current and adjacent tables without selecting a new table", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        await clearHarnessDebugLog(page);
        await page.locator('label:has(select[aria-label="Select wavetable"])').hover();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmRequest").length >= 2;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmRequest"),
            [
                { endpointID: "wavetablePrewarmRequest", value: 0 },
                { endpointID: "wavetablePrewarmRequest", value: 1 },
            ],
        );
        assert.deepEqual(
            snapshot.endpointMessages.filter(({ endpointID }) => endpointID === "wavetablePrewarmNotification"),
            [
                { endpointID: "wavetablePrewarmNotification", value: 0 },
                { endpointID: "wavetablePrewarmNotification", value: 1 },
            ],
        );
        assert.equal(Number(snapshot.parameterValues.oscAWavetableSelect), 0);
        assert.deepEqual(snapshot.gestureStarts.filter((value) => value === "oscAWavetableSelect"), []);
    } finally {
        await page.close();
    }
});

test("callback-only wavetable, MSEG, and envelope controls share truthful host readiness", async () => {
    const deferredEndpoints = [
        "oscAWavetableSelect",
        "mseg1Morph",
        "mseg1Rate",
        "env1Attack",
    ];
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 1440, height: 980 });
            await nextPage.addInitScript((endpointIDs) => {
                const initial = window.__COSIMO_DESKTOP_HARNESS_INITIAL__ ?? {};
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    ...initial,
                    deferredParameterResponses: endpointIDs,
                };
            }, deferredEndpoints);
        },
    });

    try {
        const wavetableSelect = page.locator('select[aria-label="Select wavetable"]');
        const morphSlider = page.locator('[data-role="mseg-morph-slider"]:visible').first();
        const rateInput = page.locator('input[aria-label="MSEG rate"]:visible');

        await wavetableSelect.waitFor();
        await morphSlider.waitFor();
        await rateInput.waitFor();
        for (const control of [wavetableSelect, morphSlider, rateInput]) {
            assert.equal(await control.isDisabled(), true);
            assert.equal(await control.getAttribute("data-host-state"), "loading");
        }

        await page.getByRole("button", { name: "Select envelope 1" }).click();
        const attackInput = page.locator('input[aria-label="Envelope attack value"]:visible');
        const attackHandle = page.locator('[data-role="adsr-attack-handle-hit-target"]:visible');
        await attackInput.waitFor();
        assert.equal(await attackInput.isDisabled(), true);
        assert.equal(await attackInput.getAttribute("data-host-state"), "loading");
        assert.equal(await attackHandle.getAttribute("aria-disabled"), "true");

        await clearHarnessDebugLog(page);
        await page.evaluate(() => {
            const changeValue = (element, value) => {
                if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) {
                    throw new Error("Expected a callback-only input or select.");
                }
                const prototype = element instanceof HTMLSelectElement
                    ? HTMLSelectElement.prototype
                    : HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
                setter?.call(element, String(value));
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
            };
            changeValue(document.querySelector('select[aria-label="Select wavetable"]'), 1);
            changeValue(document.querySelector('input[aria-label="MSEG rate"]'), 1.25);
            changeValue(document.querySelector('input[aria-label="Envelope attack value"]'), 0.5);
            const morph = document.querySelector('[data-role="mseg-morph-slider"]');
            morph?.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true,
                pointerId: 412,
                pointerType: "mouse",
                button: 0,
                buttons: 1,
                clientX: 100,
            }));
        });
        const blockedSnapshot = await getHarnessSnapshot(page);
        assert.equal(
            blockedSnapshot.sentMessages.some(({ endpointID }) => deferredEndpoints.includes(endpointID)),
            false,
            "forced events cannot make a pending callback-only control write to the host",
        );

        await page.evaluate((endpointIDs) => {
            endpointIDs.forEach((endpointID) => {
                window.__COSIMO_DESKTOP_HARNESS__.releaseParameterResponse(endpointID);
            });
        }, deferredEndpoints);
        await page.waitForFunction(() => (
            document.querySelector('select[aria-label="Select wavetable"]')?.hasAttribute("disabled") === false
                && document.querySelector('input[aria-label="Envelope attack value"]')?.hasAttribute("disabled") === false
        ));

        await wavetableSelect.selectOption("1");
        await waitForHarnessSnapshot(
            page,
            "wavetable callback re-enabled",
            (snapshot) => Number(snapshot.parameterValues.oscAWavetableSelect) === 1,
        );
        await page.getByRole("button", { name: "Select MSEG 1" }).click();
        await morphSlider.waitFor();
        assert.equal(await morphSlider.isDisabled(), false);
        assert.equal(await rateInput.isDisabled(), false);
        const morphBox = await morphSlider.boundingBox();
        assert.ok(morphBox);
        await page.mouse.click(
            morphBox.x + (morphBox.width * 0.75),
            morphBox.y + (morphBox.height * 0.5),
        );
        await waitForHarnessSnapshot(
            page,
            "MSEG morph callback re-enabled",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Morph) - 0.75) < 0.02,
        );
        await rateInput.click();
        await rateInput.fill("1.250");
        await rateInput.press("Enter");
        await waitForHarnessSnapshot(
            page,
            "MSEG rate callback re-enabled",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.mseg1Rate) - 1.25) < 0.0001,
        );

        await page.getByRole("button", { name: "Select envelope 1" }).click();
        assert.equal(await attackInput.isDisabled(), false);
        assert.equal(await attackHandle.getAttribute("aria-disabled"), "false");
        await dragEnvelopeHandleBy(page, "adsr-attack-handle-hit-target", 80, 0);
        const envelopeSnapshot = await waitForHarnessSnapshot(
            page,
            "envelope callback re-enabled",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.env1Attack) - 0.01) > 0.0001,
        );
        const changedAttackSeconds = Number(envelopeSnapshot.parameterValues.env1Attack);

        await waitForHarnessSnapshot(
            page,
            "callback-only controls write after their first authoritative values",
            (snapshot) => (
                Number(snapshot.parameterValues.oscAWavetableSelect) === 1
                && Math.abs(Number(snapshot.parameterValues.mseg1Morph) - 0.75) < 0.02
                && Math.abs(Number(snapshot.parameterValues.mseg1Rate) - 1.25) < 0.0001
                && Math.abs(Number(snapshot.parameterValues.env1Attack) - changedAttackSeconds) < 0.0001
            ),
        );
    } finally {
        await page.close();
    }
});

test("compact mobile wavetable picker stays disabled until its host value arrives", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                const initial = window.__COSIMO_DESKTOP_HARNESS_INITIAL__ ?? {};
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    ...initial,
                    deferredParameterResponses: ["oscAWavetableSelect"],
                };
            });
        },
    });

    try {
        const select = page.locator('.mobile-voice-table-select[aria-label="Select wavetable"]');
        await select.waitFor();
        assert.equal(await select.isDisabled(), true);
        assert.equal(await select.getAttribute("data-host-state"), "loading");
        await clearHarnessDebugLog(page);
        await select.evaluate((element) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
            setter?.call(element, "1");
            element.dispatchEvent(new Event("change", { bubbles: true }));
        });
        assert.equal(
            (await getHarnessSnapshot(page)).sentMessages.some(({ endpointID }) => endpointID === "oscAWavetableSelect"),
            false,
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.releaseParameterResponse("oscAWavetableSelect");
        });
        await page.waitForFunction(() => (
            document.querySelector('.mobile-voice-table-select[aria-label="Select wavetable"]')?.hasAttribute("disabled") === false
        ));
        await select.selectOption("1");
        await waitForHarnessSnapshot(
            page,
            "compact mobile wavetable selection after readiness",
            (snapshot) => Number(snapshot.parameterValues.oscAWavetableSelect) === 1,
        );
    } finally {
        await page.close();
    }
});

test("selected oscillator table and pan controls write only that oscillator", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        await page.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await clearHarnessDebugLog(page);

        await page.locator('select[aria-label="Select wavetable"]').selectOption("1");
        const panInput = page.locator('input[aria-label="Pan"]');
        await panInput.press("Enter");
        await panInput.fill("25");
        await panInput.press("Enter");

        await page.waitForFunction(() => {
            const messages = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().sentMessages;
            return messages.some(({ endpointID, value }) => (
                endpointID === "oscBWavetableSelect" && Number(value) === 1
            )) && messages.some(({ endpointID, value }) => (
                endpointID === "oscBPan" && Math.abs(Number(value) - 0.25) < 0.0001
            ));
        });

        const selectedWrites = (await getHarnessSnapshot(page)).sentMessages.filter(({ endpointID }) => (
            endpointID === "oscBWavetableSelect" || endpointID === "oscBPan"
        ));
        assert.deepEqual(selectedWrites, [
            { endpointID: "oscBWavetableSelect", value: 1 },
            { endpointID: "oscBPan", value: 0.25 },
        ]);
        assert.equal((await getHarnessSnapshot(page)).sentMessages.some(({ endpointID }) => (
            endpointID === "wavetableSelect"
            || endpointID === "pan"
            || endpointID === "oscAWavetableSelect"
            || endpointID === "oscAPan"
            || endpointID === "oscCWavetableSelect"
            || endpointID === "oscCPan"
        )), false);
    } finally {
        await page.close();
    }
});

test("selected oscillator tuning level enable and solo controls write only that oscillator", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        await page.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await clearHarnessDebugLog(page);

        for (const [label, keys] of [
            ["Oscillator octave", ["ArrowUp"]],
            ["Oscillator semitone", ["ArrowDown", "ArrowDown", "ArrowDown"]],
            ["Oscillator fine tune", ["ArrowUp"]],
            ["Oscillator level", ["End"]],
        ]) {
            const knob = page.getByRole("slider", { name: label });
            for (const key of keys) {
                await knob.press(key);
            }
        }
        await page.getByRole("button", { name: "Mute selected oscillator" }).click();
        await page.getByRole("button", { name: "Solo selected oscillator" }).click();

        await page.waitForFunction(() => {
            const values = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues;
            return Number(values.oscBOctave) === 1
                && Number(values.oscBSemitone) === -3
                && Math.abs(Number(values.oscBFineCents) - 0.1) < 0.0001
                && Number(values.oscBVolumeDb) === 6
                && Number(values.oscBMute) === 0
                && Number(values.oscBSolo) === 1;
        });

        const oscillatorWrites = (await getHarnessSnapshot(page)).sentMessages.filter(({ endpointID }) => (
            /^osc[ABC](Octave|Semitone|FineCents|VolumeDb|Mute|Solo)$/.test(endpointID)
        ));
        assert.deepEqual(oscillatorWrites, [
            { endpointID: "oscBOctave", value: 1 },
            { endpointID: "oscBSemitone", value: -1 },
            { endpointID: "oscBSemitone", value: -2 },
            { endpointID: "oscBSemitone", value: -3 },
            { endpointID: "oscBFineCents", value: 0.1 },
            { endpointID: "oscBVolumeDb", value: 6 },
            { endpointID: "oscBMute", value: 0 },
            { endpointID: "oscBSolo", value: 1 },
        ]);
    } finally {
        await page.close();
    }
});

test("mobile oscillator readout cells own touch and detent discrete values with haptics", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                // Dock the Mod rail at its top anchor so the floating overlay
                // does not cover the Voice toolbar this test drives.
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(() => {
                window.__oscillatorHaptics = [];
                window.cmaj_triggerHaptic = (style = "light") => window.__oscillatorHaptics.push(style);
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    const dragCellByTouch = async (locator, deltaX) => {
        const box = await locator.boundingBox();
        assert.ok(box);
        const start = {
            x: box.x + (box.width / 2),
            y: box.y + (box.height / 2),
        };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 4; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((deltaX * step) / 4),
                    y: start.y,
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };

    try {
        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        await page.waitForSelector(
            '[data-role="mobile-voice-editor"][data-selected-oscillator-id="B"]',
        );

        assert.equal(
            await page.locator('[data-role="mobile-voice-cell-volumeDb"]').getAttribute("data-modulation-target-kind"),
            "oscB.ampGainDb",
        );

        await page.locator('[data-role="mobile-voice-page-next"]').click();
        await page.waitForSelector('[data-role="mobile-voice-page"][data-page-name="Tune"]');

        // One MOD destination, one presenting cell: Semi alone carries the
        // pitch drop target; Oct and Fine are base-only readouts.
        const targetsByRole = new Map([
            ["mobile-voice-cell-octave", null],
            ["mobile-voice-cell-semitone", "oscB.pitchSemitones"],
            ["mobile-voice-cell-fineCents", null],
        ]);
        for (const [role, targetKind] of targetsByRole) {
            const cell = page.locator(`[data-role="${role}"]`);
            assert.equal(await cell.getAttribute("role"), "slider");
            assert.equal(await cell.evaluate((element) => getComputedStyle(element).touchAction), "none");
            assert.equal(await cell.getAttribute("data-modulation-target-kind"), targetKind);
        }

        const voicePanel = page.locator('[data-role="mobile-workspace-panel-voice"]');
        const octaveCell = page.locator('[data-role="mobile-voice-cell-octave"]');
        await octaveCell.scrollIntoViewIfNeeded();
        await clearHarnessDebugLog(page);
        const scrollBefore = await voicePanel.evaluate((element) => element.scrollTop);
        await dragCellByTouch(octaveCell, 120);

        const detentedSnapshot = await waitForHarnessSnapshot(
            page,
            "touch-detented oscillator octave",
            (snapshot) => Number(snapshot.parameterValues.oscBOctave) >= 1,
        );
        const octaveValue = Number(detentedSnapshot.parameterValues.oscBOctave);
        assert.equal(Number.isInteger(octaveValue), true);
        assert.equal(octaveValue >= 1 && octaveValue <= 4, true);
        assert.equal(await voicePanel.evaluate((element) => element.scrollTop), scrollBefore);
        const detentHaptics = await page.evaluate(() => window.__oscillatorHaptics);
        assert.equal(detentHaptics.length >= 1, true);
        assert.equal(detentHaptics.every((style) => style === "light"), true);

        const fineCell = page.locator('[data-role="mobile-voice-cell-fineCents"]');
        const hapticCountBeforeContinuousDrag = detentHaptics.length;
        await dragCellByTouch(fineCell, 17);
        const continuousSnapshot = await waitForHarnessSnapshot(
            page,
            "continuous oscillator fine tune",
            (snapshot) => Number(snapshot.parameterValues.oscBFineCents) > 1,
        );
        assert.equal(Number(continuousSnapshot.parameterValues.oscBFineCents) > 1, true);
        assert.equal(
            (await page.evaluate(() => window.__oscillatorHaptics)).length,
            hapticCountBeforeContinuousDrag,
        );
        assert.equal(await voicePanel.evaluate((element) => element.scrollTop), scrollBefore);

        const siblingWrites = continuousSnapshot.sentMessages.filter(({ endpointID }) => (
            /^osc[AC](Octave|Semitone|FineCents|VolumeDb)$/.test(endpointID)
        ));
        assert.deepEqual(siblingWrites, []);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("compact Voice splits its height 50/50 between the wavetable editor and the filter card", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
        },
    });

    try {
        // T04 decision: the articulation/controls pane leaves compact mobile
        // entirely; the freed height goes to the two remaining cards.
        assert.equal(await page.locator('[data-role="keyboard-controls"]').count(), 0);

        const measureRows = async () => {
            const editor = await page
                .locator('[data-role="mobile-workspace-panel-voice"] [data-role="desktop-oscillator-connection-boundary"]')
                .boundingBox();
            const filter = await page.locator('[data-role="filter-card"]').boundingBox();
            assert.ok(editor, "the wavetable editor row must render");
            assert.ok(filter, "the filter card must render");
            return { editor, filter };
        };

        const tall = await measureRows();
        assert.ok(tall.editor.height > 200, `wavetable row too short at 852: ${tall.editor.height}`);
        assert.ok(
            Math.abs(tall.editor.height - tall.filter.height) <= 2,
            `not an even split at 852: editor ${tall.editor.height}, filter ${tall.filter.height}`,
        );
        // The editor fills its row: the filter card starts one grid gap below.
        const tallGap = tall.filter.y - (tall.editor.y + tall.editor.height);
        assert.ok(tallGap >= 0 && tallGap <= 12, `dead space between the rows at 852: ${tallGap}`);

        await page.setViewportSize({ width: 393, height: 700 });
        await waitForReactFrames(page, 3);
        const short = await measureRows();
        assert.ok(
            short.editor.height < tall.editor.height,
            `the split must track the viewport: ${short.editor.height} vs ${tall.editor.height}`,
        );
        assert.ok(
            Math.abs(short.editor.height - short.filter.height) <= 2,
            `not an even split at 700: editor ${short.editor.height}, filter ${short.filter.height}`,
        );
    } finally {
        await page.close();
    }
});

test("the compact filter knob row exposes Cut/Res/Mix as modulation destinations and Off greys everything but the mode chip", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        // The synth boots with the filter Off, so the greyed state is the
        // boot state: destinations advertised, interaction blocked.
        const card = page.locator('[data-role="filter-card"]');
        assert.equal(await card.getAttribute("data-filter-off"), "true");

        const kinds = await page
            .locator('[data-role="voice-filter-knob-row"] .mobile-filter-knob-cell')
            .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("data-modulation-target-kind")));
        assert.deepEqual(kinds, ["filterCutoffOctaves", "filterQ", "filterMix"]);

        const mixCell = page.locator('.mobile-filter-knob-cell[data-modulation-target-kind="filterMix"]');
        assert.equal(await mixCell.evaluate((element) => getComputedStyle(element).pointerEvents), "none");

        // The mode chip stays live while Off greys the rest of the card.
        await page.locator('[data-role="filter-mode-chip"]').click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="filter-card"]')?.getAttribute("data-filter-off") === "false"
        ));
        assert.equal(await mixCell.evaluate((element) => getComputedStyle(element).pointerEvents), "auto");

        // The shared control contract: a horizontal drag on the Mix knob
        // edits its base value (leftward lowers it).
        await clearHarnessDebugLog(page);
        const knob = page.locator('[data-role="voice-filter-knob-filterMix"]');
        const box = await knob.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 4; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x - ((60 * step) / 4),
                    y: start.y,
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "filter mix knob drag",
            (candidate) => Number(candidate.parameterValues.filterMix) < 0.95,
        );
        const mixValue = Number(snapshot.parameterValues.filterMix);
        assert.ok(mixValue >= 0 && mixValue < 0.95, `dragging left must lower Mix: ${mixValue}`);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("the Res knob sweeps uniformly: equal drag travel covers equal fractions of its range", async () => {
    // Product decision (2026-08-19): the GRAPH handle keeps the curve-lab
    // sigmoid, but the knob is an ordinary knob — equal finger travel moves
    // the dial by equal fractions of its full range. For the log-scaled Q
    // dial that means equal travel produces equal Q RATIOS.
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
        },
    });

    try {
        await page.locator('[data-role="filter-mode-chip"]').click();
        const knob = page.locator('[data-role="voice-filter-knob-filterQ"]');
        await knob.waitFor();
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("filterQ", 0.2, true);
        });
        await page.waitForFunction(() => (
            Math.abs(Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.filterQ) - 0.2) <= 0.001
        ));

        const dragRight = async (pixels) => {
            const box = await knob.boundingBox();
            assert.ok(box);
            const from = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
            await page.mouse.move(from.x, from.y);
            await page.mouse.down();
            // The 5px throwaway move eats the classifier's consumed
            // activation sample so the measured travel is exact.
            await page.mouse.move(from.x + 5, from.y);
            await page.mouse.move(from.x + 5 + pixels, from.y, { steps: 6 });
            await page.mouse.up();
            await page.waitForTimeout(120);
            return Number((await getHarnessSnapshot(page)).parameterValues.filterQ);
        };

        const first = await dragRight(44);
        const second = await dragRight(44);
        const third = await dragRight(44);

        // Three identical 20%-of-range drags: successive Q ratios must match.
        const ratioA = first / 0.2;
        const ratioB = second / first;
        const ratioC = third / second;
        assert.ok(ratioA > 1.5, `each step must audibly move the dial: ${ratioA}`);
        assert.ok(
            Math.abs(ratioB - ratioA) / ratioA <= 0.08 && Math.abs(ratioC - ratioB) / ratioB <= 0.08,
            `equal travel must sweep equal fractions of the dial: ${ratioA}, ${ratioB}, ${ratioC}`,
        );
    } finally {
        await page.close();
    }
});

test("Res knob modulation drags walk the dial with no downward cliff and no dead over-travel", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "res-walk",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterQ",
            amount: 0,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });

    const dragVertically = async (pixels) => {
        const knob = page.locator('[data-role="voice-filter-knob-filterQ"]');
        const box = await knob.boundingBox();
        assert.ok(box);
        const from = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x, from.y - Math.sign(pixels) * 5);
        await page.mouse.move(from.x, from.y - pixels, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(150);
        return readStoredRouteAmount(await getHarnessSnapshot(page), 1, "filterQ");
    };
    const resetAmount = async () => {
        await page.evaluate(() => {
            const raw = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"];
            const parsed = JSON.parse(raw);
            parsed.routes[0].amount = 0;
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(parsed));
        });
        await page.waitForFunction(() => {
            const raw = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().storedState["modulation.v6"];
            return JSON.parse(raw).routes[0].amount === 0;
        });
    };

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded resonance route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        await page.locator('[data-role="filter-mode-chip"]').click();

        // Base Q 0.707 sits 3% above the floor. Under the old linear-amount
        // mapping, 40px down banked -4.4 of amount: the floor in 5px, dead
        // travel after. Walking the dial, 40px covers 40/220 of the knob's
        // range and the modulated value stays well above the floor.
        const shortDown = await dragVertically(-40);
        assert.ok(shortDown < -0.05, `downward travel must modulate: ${shortDown}`);
        assert.ok(shortDown > -0.55, `40px must NOT reach the floor: ${shortDown}`);

        // Full downward travel stops at the audible floor: no dead amount
        // banked beyond it, so the next upward pixel responds immediately.
        await resetAmount();
        const longDown = await dragVertically(-200);
        assert.ok(longDown <= -0.55 && longDown >= -0.65, `full travel pins at the floor, not past it: ${longDown}`);

        // Upward stays alive over the same dial fractions.
        await resetAmount();
        const shortUp = await dragVertically(40);
        assert.ok(shortUp > 0.1, `upward travel must modulate: ${shortUp}`);
    } finally {
        await page.close();
    }
});

test("a knob modulation drag presents its canonical amount live, not at release", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "live-cutoff",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterCutoffOctaves",
            amount: 0,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
            await nextPage.addInitScript(() => {
                // Frame sampler: the deferred route document only flushes
                // after a 50ms write-idle, so any live readout observed WHILE
                // the pointer is still moving must come from the canonical
                // amount path, never the document.
                window.__hudSamples = [];
                window.__lastMoveAt = 0;
                window.addEventListener("pointermove", () => {
                    window.__lastMoveAt = performance.now();
                }, true);
                const sample = () => {
                    const sourceLine = document.querySelector('[data-role="mobile-voice-hud"] .mobile-voice-hud-source');
                    const modFill = document.querySelector('[data-role="voice-filter-knob-filterCutoff"] .rack-knob-mod-fill');
                    window.__hudSamples.push({
                        text: sourceLine?.textContent ?? "",
                        fillVisible: (modFill?.getAttribute("d") ?? "") !== "",
                        whileMoving: performance.now() - window.__lastMoveAt < 40,
                    });
                    window.requestAnimationFrame(sample);
                };
                window.requestAnimationFrame(sample);
            });
        },
    });

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded zero-amount cutoff route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        await page.locator('[data-role="filter-mode-chip"]').click();
        const knob = page.locator('[data-role="voice-filter-knob-filterCutoff"]');
        await knob.waitFor();
        const box = await knob.boundingBox();
        assert.ok(box);
        const from = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };

        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x, from.y - 110, { steps: 30 });
        await page.mouse.up();

        const liveSamples = await page.evaluate(() => window.__hudSamples.filter((candidate) => (
            candidate.whileMoving
            && candidate.fillVisible
            && /MSEG 1/.test(candidate.text)
            && /oct/i.test(candidate.text)
            && !/\+0\.0/.test(candidate.text)
        )).length);
        assert.ok(
            liveSamples >= 1,
            "The HUD and mod ring must present the canonical amount during movement, not after the drag settles.",
        );
    } finally {
        await page.close();
    }
});

test("the armed source's filter mappings draw the travel overlay and its end handle edits both amounts", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "travel-cutoff",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterCutoffOctaves",
            amount: 2,
            reducer: "max",
        }, {
            id: "travel-q",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterQ",
            amount: 5,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded filter travel routes",
            (candidate) => readStoredModulationState(candidate).routes.length === 2,
        );

        // The filter boots Off, which hides the overlay with the rest of the card.
        const overlay = page.locator('[data-role="filter-travel-overlay"]');
        assert.equal(await overlay.count(), 0);

        await page.locator('[data-role="filter-mode-chip"]').click();
        await overlay.waitFor();

        // SeqFX treatment: both extreme response curves, the shaded swept
        // region, and the travel arrow. Unipolar travel starts at the base
        // handle, so no separate start handle renders.
        assert.equal(await page.locator('[data-role="filter-travel-start-curve"]').count(), 1);
        assert.equal(await page.locator('[data-role="filter-travel-end-curve"]').count(), 1);
        assert.notEqual(await page.locator('[data-role="filter-travel-shade"]').getAttribute("d"), "");
        assert.equal(await page.locator('[data-role="filter-travel-hit-target-start"]').count(), 0);
        // A routed unipolar axis puts translation on the center grip.
        assert.equal(await page.locator('[data-role="filter-travel-hit-target-center"]').count(), 1);

        // Unipolar +2 octaves from the 1 kHz base: the end sits at 4 kHz.
        const endHandle = page.locator('[data-role="filter-travel-hit-target-end"]');
        assert.equal(Number(await endHandle.getAttribute("aria-valuenow")), 4000);

        // One diagonal end-handle drag edits BOTH route amounts through the
        // same transfers the base handle uses.
        const box = await endHandle.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x - 60, start.y + 40, { steps: 8 });
        await page.mouse.up();

        const dragged = await waitForHarnessSnapshot(
            page,
            "travel end-handle diagonal drag",
            (candidate) => {
                const cutoffAmount = readStoredRouteAmount(candidate, 1, "filterCutoffOctaves");
                const qAmount = readStoredRouteAmount(candidate, 1, "filterQ");
                // Seeds were +2 oct / +5 Q: any drop below proves the write.
                return cutoffAmount > -6 && cutoffAmount < 1.9
                    && qAmount > -19 && qAmount < 4.5;
            },
        );
        const draggedCutoff = readStoredRouteAmount(dragged, 1, "filterCutoffOctaves");
        const draggedQ = readStoredRouteAmount(dragged, 1, "filterQ");
        assert.ok(draggedCutoff > -6 && draggedCutoff < 1.9, `cutoff amount follows: ${draggedCutoff}`);
        assert.ok(draggedQ > -19 && draggedQ < 4.5, `q amount follows: ${draggedQ}`);
    } finally {
        await page.close();
    }
});

test("a travel axis without its own mapping stays pinned at base and never fabricates a route", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "travel-cutoff-only",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterCutoffOctaves",
            amount: 2,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded cutoff-only travel route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        await page.locator('[data-role="filter-mode-chip"]').click();
        const endHandle = page.locator('[data-role="filter-travel-hit-target-end"]');
        await endHandle.waitFor();

        // The end handle sits at base resonance: the Q axis has no mapping.
        const handleY = await page.locator('[data-role="filter-travel-handle-end"]').evaluate((element) => (
            Number(element.getAttribute("cy"))
        ));
        const baseY = await page.locator('[data-role="filter-response-handle"]').evaluate((element) => (
            Number(element.getAttribute("cy"))
        ));
        assert.ok(Math.abs(handleY - baseY) <= 1, `end handle must sit at base Q: ${handleY} vs ${baseY}`);

        // A straight vertical drag writes nothing: the Q axis is inert and
        // must not fabricate a filterQ mapping.
        const box = await endHandle.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x, start.y - 50, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(250);

        const snapshot = await getHarnessSnapshot(page);
        assert.equal(
            readStoredModulationState(snapshot).routes.some((route) => route.targetKind === "filterQ"),
            false,
            "An inert travel axis must never fabricate a mapping.",
        );
    } finally {
        await page.close();
    }
});

test("bipolar filter travel drags endpoints independently and base follows the midpoint", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "travel-bipolar-cutoff",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "filterCutoffOctaves",
            amount: 1.5,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded bipolar travel route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        await page.locator('[data-role="filter-mode-chip"]').click();

        // Bipolar travel renders its own start handle mirrored below base.
        const startHandle = page.locator('[data-role="filter-travel-hit-target-start"]');
        await startHandle.waitFor();
        const startHz = Number(await startHandle.getAttribute("aria-valuenow"));
        const endHz = Number(await page.locator('[data-role="filter-travel-hit-target-end"]').getAttribute("aria-valuenow"));
        assert.ok(Math.abs(startHz - (1000 / (2 ** 1.5))) <= 3, `start mirrors base: ${startHz}`);
        assert.ok(Math.abs(endHz - (1000 * (2 ** 1.5))) <= 6, `end mirrors base: ${endHz}`);

        // Independent endpoints: dragging the START leftward leaves the END
        // planted, so base moves to the new (geometric) midpoint and the
        // amount widens to the new half-span.
        const box = await startHandle.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x - 40, start.y, { steps: 6 });
        await page.mouse.up();

        const dragged = await waitForHarnessSnapshot(
            page,
            "independent start-handle drag",
            (candidate) => (
                readStoredRouteAmount(candidate, 1, "filterCutoffOctaves") > 1.55
                && Number(candidate.parameterValues.filterCutoff) < 995
            ),
        );
        assert.ok(readStoredRouteAmount(dragged, 1, "filterCutoffOctaves") > 1.55, "the half-span widens");
        assert.ok(Number(dragged.parameterValues.filterCutoff) < 995, "base follows the new midpoint");
        const endHzAfter = Number(await page.locator('[data-role="filter-travel-hit-target-end"]').getAttribute("aria-valuenow"));
        assert.ok(Math.abs(endHzAfter - endHz) <= endHz * 0.03, `the end endpoint stays planted: ${endHzAfter} vs ${endHz}`);
    } finally {
        await page.close();
    }
});

test("unipolar travel: the center grip translates while the base handle pins the end", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "travel-grips",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterCutoffOctaves",
            amount: 2,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });

    const dragBy = async (locator, deltaX) => {
        const box = await locator.boundingBox();
        assert.ok(box);
        const from = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + deltaX, from.y, { steps: 6 });
        await page.mouse.up();
    };

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded unipolar travel route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        await page.locator('[data-role="filter-mode-chip"]').click();

        // Translation lives on the center grip: base moves, the amount stays.
        const centerGrip = page.locator('[data-role="filter-travel-hit-target-center"]');
        await centerGrip.waitFor();
        await dragBy(centerGrip, 40);
        const translated = await waitForHarnessSnapshot(
            page,
            "center-grip translation",
            (candidate) => Number(candidate.parameterValues.filterCutoff) > 1050,
        );
        const translatedAmount = readStoredRouteAmount(translated, 1, "filterCutoffOctaves");
        assert.ok(Math.abs(translatedAmount - 2) <= 0.02, `translation keeps the amount: ${translatedAmount}`);

        // The base handle IS the unipolar start: dragging it pins the end,
        // so base moves and the amount compensates.
        const endHzBefore = Number(await page.locator('[data-role="filter-travel-hit-target-end"]').getAttribute("aria-valuenow"));
        const baseBefore = Number(translated.parameterValues.filterCutoff);
        await dragBy(page.locator('[data-role="filter-response-handle-hit-target"]'), 30);
        const pinned = await waitForHarnessSnapshot(
            page,
            "base-as-start drag",
            (candidate) => (
                Number(candidate.parameterValues.filterCutoff) > baseBefore * 1.05
                && readStoredRouteAmount(candidate, 1, "filterCutoffOctaves") < 1.95
            ),
        );
        const endHzAfter = Number(await page.locator('[data-role="filter-travel-hit-target-end"]').getAttribute("aria-valuenow"));
        assert.ok(
            Math.abs(endHzAfter - endHzBefore) <= endHzBefore * 0.03,
            `the end must stay planted while base moves: ${endHzAfter} vs ${endHzBefore}`,
        );
        assert.ok(readStoredRouteAmount(pinned, 1, "filterCutoffOctaves") < 1.95, "the amount compensates");
    } finally {
        await page.close();
    }
});

test("center-grip translation moves both endpoints by the same pixels on the nonlinear Q surface", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "rigid-cutoff",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterCutoffOctaves",
            amount: 1.5,
            reducer: "max",
        }, {
            id: "rigid-q",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "filterQ",
            amount: 12,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded two-axis travel",
            (candidate) => readStoredModulationState(candidate).routes.length === 2,
        );
        await page.locator('[data-role="filter-mode-chip"]').click();
        const centerGrip = page.locator('[data-role="filter-travel-hit-target-center"]');
        await centerGrip.waitFor();

        // The end sits deep in the compressed high-Q display region while
        // base sits mid-range: the exact configuration that used to make a
        // parameter-space translation move one handle far more than the other.
        const readHandleYs = () => page.evaluate(() => ({
            base: Number(document.querySelector('[data-role="filter-response-handle"]')?.getAttribute("cy")),
            end: Number(document.querySelector('[data-role="filter-travel-handle-end"]')?.getAttribute("cy")),
        }));
        const before = await readHandleYs();

        const box = await centerGrip.boundingBox();
        assert.ok(box);
        const from = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x, from.y + 30, { steps: 6 });
        await page.mouse.up();

        await page.waitForFunction((baseYBefore) => {
            const baseY = Number(document.querySelector('[data-role="filter-response-handle"]')?.getAttribute("cy"));
            return Math.abs(baseY - baseYBefore) > 20;
        }, before.base);
        const after = await readHandleYs();
        const baseDelta = after.base - before.base;
        const endDelta = after.end - before.end;
        assert.ok(Math.abs(baseDelta - 30) <= 4, `base rides the finger: ${baseDelta}`);
        assert.ok(Math.abs(endDelta - 30) <= 4, `the far endpoint rides the SAME pixels: ${endDelta}`);
    } finally {
        await page.close();
    }
});

test("one drop on the filter graph maps the source to both filter destinations at zero", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
        },
    });

    try {
        await page.locator('[data-role="filter-mode-chip"]').click();
        await expandGlobalModRail(page);
        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        const stage = page.locator('[data-role="filter-graph-drop-surface"]');
        const sourceBox = await source.boundingBox();
        const stageBox = await stage.boundingBox();
        assert.ok(sourceBox && stageBox);

        await page.mouse.move(sourceBox.x + (sourceBox.width / 2), sourceBox.y + (sourceBox.height / 2));
        await page.mouse.down();
        await page.mouse.move(stageBox.x + (stageBox.width * 0.35), stageBox.y + (stageBox.height * 0.6), { steps: 8 });
        assert.equal((await stage.getAttribute("class")).includes("is-mod-hover"), true);
        await page.mouse.up();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "graph drop creates the filter pair",
            (candidate) => {
                const routes = readStoredModulationState(candidate).routes;
                return routes.some((route) => (
                    route.sourceKind === "mseg" && route.sourceSlot === 1 && route.targetKind === "filterCutoffOctaves"
                )) && routes.some((route) => (
                    route.sourceKind === "mseg" && route.sourceSlot === 1 && route.targetKind === "filterQ"
                ));
            },
        );
        const routes = readStoredModulationState(snapshot).routes;
        assert.equal(routes.length, 2, "one drop creates exactly the pair");
        assert.equal(routes.every((route) => route.amount === 0), true, "new mappings start at exactly 0%");

        // Zero travel presents as the dotted parked tab, not a stacked handle.
        const endHandle = page.locator('[data-role="filter-travel-handle-end"]');
        await endHandle.waitFor();
        assert.equal(await endHandle.getAttribute("data-parked"), "true");
    } finally {
        await page.close();
    }
});

test("articulation capture and recall edit only the selected oscillator", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        await page.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await page.waitForSelector('[data-role="oscillator-mute"][aria-pressed="true"]');
        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        const baseline = await waitForHarnessSnapshot(
            page,
            "baseline B articulation",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 1,
        );
        const baselineBank = JSON.parse(String(baseline.storedState[ARTICULATION_STATE_KEY]));
        assert.equal(
            Object.hasOwn(baselineBank.slots[0].overrides, "oscB.mute"),
            false,
            "untouched B mute must inherit the patch base's canonical disabled value",
        );

        for (const [label, keys] of [
            ["Oscillator octave", ["ArrowUp"]],
            ["Oscillator semitone", ["ArrowDown", "ArrowDown", "ArrowDown"]],
            ["Oscillator fine tune", ["ArrowUp"]],
            ["Oscillator level", ["End"]],
        ]) {
            const knob = page.getByRole("slider", { name: label });
            for (const key of keys) {
                await knob.press(key);
            }
        }
        await page.getByRole("button", { name: "Mute selected oscillator" }).click();
        await waitForHarnessSnapshot(
            page,
            "B oscillator enabled before articulation capture",
            (snapshot) => Number(snapshot.parameterValues.oscBMute) === 0,
        );
        await page.getByRole("button", { name: "Solo selected oscillator" }).click();
        await waitForHarnessSnapshot(
            page,
            "B oscillator soloed before articulation capture",
            (snapshot) => Number(snapshot.parameterValues.oscBSolo) === 1,
        );
        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();

        const captured = await waitForHarnessSnapshot(
            page,
            "B articulation overrides",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 2,
        );
        const storedBank = JSON.parse(String(captured.storedState[ARTICULATION_STATE_KEY]));
        const overrides = storedBank.slots[1].overrides;
        assert.deepEqual({
            octave: overrides["oscB.octave"],
            semitone: overrides["oscB.semitone"],
            fineCents: overrides["oscB.fineCents"],
            volumeDb: overrides["oscB.volumeDb"],
            mute: overrides["oscB.mute"],
            solo: overrides["oscB.solo"],
        }, {
            octave: 1,
            semitone: -3,
            fineCents: 0.1,
            volumeDb: 6,
            mute: 0,
            solo: 1,
        });
        assert.equal(Object.keys(overrides).some((key) => key.startsWith("oscA.")), false);
        assert.equal(Object.keys(overrides).some((key) => key.startsWith("oscC.")), false);

        await clearHarnessDebugLog(page);
        await page.locator('[data-role="articulation-card"]').first().click();
        await page.locator('[data-role="articulation-card"]').nth(1).click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().sentMessages.some(({ endpointID, value }) => (
                endpointID === "oscBVolumeDb" && Number(value) === 6
            ))
        ));
        const oscillatorWrites = (await getHarnessSnapshot(page)).sentMessages.filter(({ endpointID }) => (
            /^osc[ABC]/.test(endpointID)
        ));
        assert.equal(oscillatorWrites.length > 0, true);
        assert.equal(oscillatorWrites.every(({ endpointID }) => endpointID.startsWith("oscB")), true);
        assert.equal(
            oscillatorWrites.some(({ endpointID, value }) => endpointID === "oscBMute" && Number(value) === 0),
            true,
            "recalling the enabled articulation must still restore B's inherited unmuted state",
        );
    } finally {
        await page.close();
    }
});

test("cross-oscillator articulation bases stay authoritative through delayed host responses", async () => {
    const page = await openHarnessPage();

    try {
        await page.getByRole("tab", { name: "Oscillator B" }).click();
        await page.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await page.waitForSelector('[data-role="oscillator-mute"][aria-pressed="true"]');
        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        const firstCapture = await waitForHarnessSnapshot(
            page,
            "first articulation captured from B",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 1,
        );
        const firstBank = JSON.parse(String(firstCapture.storedState[ARTICULATION_STATE_KEY]));
        assert.equal(
            Object.hasOwn(firstBank.slots[0].overrides, "oscB.mute"),
            false,
            "untouched B must inherit its canonical muted base",
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscCVolumeDb", -9);
        });
        await page.getByRole("tab", { name: "Oscillator C" }).click();
        await page.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="C"]',
        );
        await page.waitForSelector('[data-role="oscillator-mute"][aria-pressed="true"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="oscillator-level"]')?.getAttribute("aria-valuenow") === "-9"
        ));
        assert.equal(
            Number((await getHarnessSnapshot(page)).parameterValues.oscCMute),
            1,
            "previously unvisited C must present its canonical muted patch value before editing",
        );

        await page.getByRole("button", { name: "Mute selected oscillator" }).click();
        await waitForHarnessSnapshot(
            page,
            "C oscillator enabled before its first articulation capture",
            (snapshot) => Number(snapshot.parameterValues.oscCMute) === 0,
        );
        await page.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        const secondCapture = await waitForHarnessSnapshot(
            page,
            "second articulation captured from newly visited C",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 2,
        );
        const secondBank = JSON.parse(String(secondCapture.storedState[ARTICULATION_STATE_KEY]));
        assert.equal(
            secondBank.slots[1].overrides["oscC.mute"],
            0,
            "enabling newly visited C must remain an explicit-zero override over its muted base",
        );
        assert.equal(
            Object.hasOwn(secondBank.slots[1].overrides, "oscC.volumeDb"),
            false,
            "C's settled live level must be frozen as its base rather than inherited from B's stale binding",
        );
        assert.equal(
            Object.keys(secondBank.slots[1].overrides).some((key) => key.startsWith("oscB.")),
            false,
        );

        await page.locator('[data-role="articulation-card"]').first().click();
        await page.waitForSelector('[data-role="oscillator-mute"][aria-pressed="true"]');
        await clearHarnessDebugLog(page);
        await page.locator('[data-role="articulation-card"]').nth(1).click();
        await page.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().sentMessages.some(({ endpointID, value }) => (
                endpointID === "oscCMute" && Number(value) === 0
            ))
        ));
        assert.equal(
            (await getHarnessSnapshot(page)).sentMessages.some(({ endpointID, value }) => (
                endpointID === "oscCMute" && Number(value) === 0
            )),
            true,
            "recalling C's explicit-zero articulation must enable C",
        );
    } finally {
        await page.close();
    }

    const delayedMutePage = await openHarnessPage();

    try {
        await delayedMutePage.getByRole("tab", { name: "Oscillator B" }).click();
        await delayedMutePage.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await delayedMutePage.waitForSelector('[data-role="oscillator-mute"][aria-pressed="true"]');
        await delayedMutePage.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        await waitForHarnessSnapshot(
            delayedMutePage,
            "first articulation captured from B before delayed C mute response",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 1,
        );
        await delayedMutePage.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.deferParameterResponse("oscCMute");
        });
        await delayedMutePage.getByRole("tab", { name: "Oscillator C" }).click();
        await delayedMutePage.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="C"]',
        );
        const muteButton = delayedMutePage.getByRole("button", { name: "Mute selected oscillator" });
        await delayedMutePage.waitForSelector('[data-role="oscillator-mute"][data-host-state="loading"]:disabled');
        assert.equal(
            Number((await getHarnessSnapshot(delayedMutePage)).parameterValues.oscCMute),
            1,
            "the canonical muted host state remains untouched while its first reply is pending",
        );
        await clearHarnessDebugLog(delayedMutePage);
        await muteButton.evaluate((button) => button.click());
        let pendingSnapshot = await getHarnessSnapshot(delayedMutePage);
        assert.equal(Number(pendingSnapshot.parameterValues.oscCMute), 1);
        assert.equal(
            pendingSnapshot.sentMessages.some(({ endpointID }) => endpointID === "oscCMute"),
            false,
            "a forced pre-baseline click cannot reach the host",
        );

        const captureButton = delayedMutePage.getByRole("button", {
            name: "Capture current parameters as a new articulation",
        });
        const articulationSurface = delayedMutePage.locator('[data-role="articulation-control-surface"]');
        assert.equal(await articulationSurface.getAttribute("data-base-state"), "loading");
        assert.equal(await articulationSurface.getAttribute("aria-busy"), "true");
        assert.equal(
            await delayedMutePage.locator('[data-role="articulation-card"]').first().getAttribute("aria-disabled"),
            "true",
        );
        const auditionButton = delayedMutePage.locator('[data-role="articulation-card-play"]').first();
        assert.equal(await auditionButton.isDisabled(), true, "audition must not play the wrong current sound while recall is unavailable");
        await auditionButton.dispatchEvent("pointerdown", {
            pointerId: 311,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
        });
        const blockedAuditionSnapshot = await getHarnessSnapshot(delayedMutePage);
        assert.equal(blockedAuditionSnapshot.midiInputEvents.length, 0);
        assert.equal(
            blockedAuditionSnapshot.sentMessages.some(({ endpointID }) => /^osc[ABC]/.test(endpointID)),
            false,
            "a forced pending audition cannot recall any articulation parameters",
        );
        assert.equal(
            await captureButton.isDisabled(),
            true,
            "capture must stay unavailable until C's pre-edit mute baseline is host-confirmed",
        );
        assert.equal(await delayedMutePage.locator('[data-role="articulation-update"]').isDisabled(), true);
        assert.equal(await delayedMutePage.locator('[data-role="articulation-revert"]').isDisabled(), true);
        await delayedMutePage.locator('[data-role="articulation-card"]').first().click({ button: "right", force: true });
        const cardMenu = delayedMutePage.locator('[data-role="articulation-card-menu"]');
        await cardMenu.waitFor();
        assert.equal(await cardMenu.locator('[data-action="rename"]').isDisabled(), false);
        for (const action of ["duplicate", "replace", "delete"]) {
            const item = cardMenu.locator(`[data-action="${action}"]`);
            assert.equal(await item.isDisabled(), true, `${action} must be visibly disabled while the base loads`);
            assert.equal(await item.getAttribute("data-disabled-reason"), "base-loading");
        }
        await delayedMutePage.keyboard.press("Escape");
        await delayedMutePage.getByRole("button", { name: "Expand articulation editor" }).click();
        const rangeSegment = delayedMutePage.locator('[data-role="articulation-range-segment"]').first();
        assert.equal(
            await rangeSegment.getAttribute("aria-disabled"),
            null,
            "the movable/resizable range segment itself remains available while sound recall loads",
        );
        await rangeSegment.click({ button: "right", force: true });
        const rangeMenu = delayedMutePage.locator('[data-role="articulation-range-menu"]');
        await rangeMenu.waitFor();
        const duplicateAfter = rangeMenu.locator('[data-action="duplicate-after"]');
        assert.equal(await duplicateAfter.isDisabled(), true);
        assert.equal(await duplicateAfter.getAttribute("data-disabled-reason"), "base-loading");
        for (const action of ["replace", "insert-after", "delete"]) {
            assert.equal(
                await rangeMenu.locator(`[data-action="${action}"]`).isDisabled(),
                false,
                `${action} remains available because it only edits trigger ranges`,
            );
        }
        await delayedMutePage.keyboard.press("Escape");
        await captureButton.evaluate((button) => button.click());
        assert.equal(
            JSON.parse(String((await getHarnessSnapshot(delayedMutePage)).storedState[ARTICULATION_STATE_KEY])).slots.length,
            1,
            "a forced click cannot persist a lossy slot while the base is unknown",
        );

        await delayedMutePage.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.releaseParameterResponse("oscCMute");
        });
        await delayedMutePage.waitForFunction(() => (
            document.querySelector('[data-role="articulation-capture"]')?.hasAttribute("disabled") === false
                && document.querySelector('[data-role="oscillator-mute"]')?.hasAttribute("disabled") === false
                && document.querySelector('[data-role="oscillator-mute"]')?.getAttribute("aria-pressed") === "true"
        ));
        assert.equal(await articulationSurface.getAttribute("data-base-state"), "ready");
        assert.equal(await auditionButton.isDisabled(), false);
        await auditionButton.dispatchEvent("pointerdown", {
            pointerId: 312,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
        });
        await delayedMutePage.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 1
        ));
        await auditionButton.dispatchEvent("pointerup", {
            pointerId: 312,
            pointerType: "mouse",
            button: 0,
            buttons: 0,
        });
        await delayedMutePage.waitForFunction(() => (
            window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().midiInputEvents.length === 2
        ));
        await rangeSegment.click({ button: "right" });
        await rangeMenu.waitFor();
        assert.equal(await rangeMenu.locator('[data-action="duplicate-after"]').isDisabled(), false);
        await delayedMutePage.keyboard.press("Escape");
        await muteButton.click();
        await waitForHarnessSnapshot(
            delayedMutePage,
            "C mute edit after its first authoritative response",
            (snapshot) => Number(snapshot.parameterValues.oscCMute) === 0,
        );
        await captureButton.click();
        const captured = await waitForHarnessSnapshot(
            delayedMutePage,
            "C explicit-zero articulation after delayed mute baseline",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 2,
        );
        const bank = JSON.parse(String(captured.storedState[ARTICULATION_STATE_KEY]));
        assert.equal(bank.slots[1].overrides["oscC.mute"], 0);
    } finally {
        await delayedMutePage.close();
    }

    const delayedAllPage = await openHarnessPage();
    const oscillatorCEndpoints = [
        "oscCWavetablePosition",
        "oscCPan",
        "oscCOctave",
        "oscCSemitone",
        "oscCFineCents",
        "oscCVolumeDb",
        "oscCMute",
        "oscCSolo",
        "oscCWarpMode",
        "oscCWarpAmount",
        "oscCUnisonVoices",
        "oscCUnisonDetune",
        "oscCUnisonBlend",
        "oscCUnisonWidth",
        "oscCPhase",
        "oscCPhaseRandom",
        "oscCRetrigger",
        "oscCUnisonDetuneMode",
        "oscCUnisonStackMode",
        "oscCUnisonPositionSpread",
        "oscCUnisonWarpSpread",
    ];

    try {
        await delayedAllPage.getByRole("tab", { name: "Oscillator B" }).click();
        await delayedAllPage.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="B"]',
        );
        await delayedAllPage.getByRole("button", { name: "Capture current parameters as a new articulation" }).click();
        await waitForHarnessSnapshot(
            delayedAllPage,
            "first articulation captured before C has been visited",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 1,
        );

        await delayedAllPage.evaluate((endpointIDs) => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscCVolumeDb", -9);
            endpointIDs.forEach((endpointID) => {
                window.__COSIMO_DESKTOP_HARNESS__.deferParameterResponse(endpointID);
            });
        }, oscillatorCEndpoints);
        await delayedAllPage.getByRole("tab", { name: "Oscillator C" }).click();
        await delayedAllPage.waitForSelector(
            '[data-role="desktop-oscillator-presentation"][data-selected-oscillator-id="C"]',
        );
        assert.equal(
            await delayedAllPage.locator('[data-role="oscillator-level"]').getAttribute("aria-valuenow"),
            "0",
            "the screen remains stale while C's authoritative values are unavailable",
        );
        const levelControl = delayedAllPage.getByRole("slider", { name: "Oscillator level" });
        const muteButton = delayedAllPage.getByRole("button", { name: "Mute selected oscillator" });
        assert.equal(await levelControl.isDisabled(), true);
        assert.equal(await levelControl.getAttribute("data-host-state"), "loading");
        assert.equal(await muteButton.isDisabled(), true);
        await clearHarnessDebugLog(delayedAllPage);
        await levelControl.evaluate((control) => control.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
        await muteButton.evaluate((button) => button.click());
        const blockedWriteSnapshot = await getHarnessSnapshot(delayedAllPage);
        assert.equal(Number(blockedWriteSnapshot.parameterValues.oscCMute), 1);
        assert.equal(Number(blockedWriteSnapshot.parameterValues.oscCVolumeDb), -9);
        assert.equal(
            blockedWriteSnapshot.sentMessages.some(({ endpointID }) => endpointID.startsWith("oscC")),
            false,
            "no C edit may reach the host before all corresponding first values arrive",
        );
        const captureButton = delayedAllPage.getByRole("button", {
            name: "Capture current parameters as a new articulation",
        });
        assert.equal(await captureButton.isDisabled(), true);
        await captureButton.evaluate((button) => button.click());
        assert.equal(
            JSON.parse(String((await getHarnessSnapshot(delayedAllPage)).storedState[ARTICULATION_STATE_KEY])).slots.length,
            1,
            "a stale screen snapshot cannot become a new articulation base",
        );

        await delayedAllPage.evaluate((endpointIDs) => {
            endpointIDs.forEach((endpointID) => {
                window.__COSIMO_DESKTOP_HARNESS__.releaseParameterResponse(endpointID);
            });
        }, oscillatorCEndpoints);
        await delayedAllPage.waitForFunction(() => (
            document.querySelector('[data-role="articulation-capture"]')?.hasAttribute("disabled") === false
                && document.querySelector('[data-role="oscillator-level"]')?.getAttribute("aria-valuenow") === "-9"
                && document.querySelector('[data-role="oscillator-mute"]')?.hasAttribute("disabled") === false
                && document.querySelector('[data-role="oscillator-mute"]')?.getAttribute("aria-pressed") === "true"
        ));

        await muteButton.click();
        await waitForHarnessSnapshot(
            delayedAllPage,
            "C mute edit after every authoritative baseline arrives",
            (snapshot) => Number(snapshot.parameterValues.oscCMute) === 0,
        );
        await captureButton.click();
        const captured = await waitForHarnessSnapshot(
            delayedAllPage,
            "C articulation after its complete authoritative base arrives",
            (snapshot) => JSON.parse(String(snapshot.storedState[ARTICULATION_STATE_KEY])).slots.length === 2,
        );
        const bank = JSON.parse(String(captured.storedState[ARTICULATION_STATE_KEY]));
        assert.equal(bank.slots[1].overrides["oscC.mute"], 0);
        assert.equal(
            Object.hasOwn(bank.slots[1].overrides, "oscC.volumeDb"),
            false,
            "the confirmed -9 dB host value is the base, not stale 0 dB presentation",
        );

        await delayedAllPage.locator('[data-role="articulation-card"]').first().click();
        await delayedAllPage.waitForSelector('[data-role="oscillator-mute"][aria-pressed="true"]');
        await delayedAllPage.locator('[data-role="articulation-card"]').nth(1).click();
        await delayedAllPage.waitForSelector('[data-role="oscillator-mute"][aria-pressed="false"]');
        assert.equal(
            await delayedAllPage.locator('[data-role="oscillator-level"]').getAttribute("aria-valuenow"),
            "-9",
        );
    } finally {
        await delayedAllPage.close();
    }
});

test("global modulation-source drag maps the selected oscillator level control", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        await page.waitForSelector(
            '[data-role="mobile-voice-editor"][data-selected-oscillator-id="B"]',
        );
        await expandGlobalModRail(page);

        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="mobile-voice-cell-volumeDb"]');
        await target.scrollIntoViewIfNeeded();
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);

        const start = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const targetCenter = {
            x: targetBox.x + (targetBox.width / 2),
            y: targetBox.y + (targetBox.height / 2),
        };
        const end = touchPointForModSourcePreviewTarget(start, targetCenter, 393);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((end.x - start.x) * progress),
                    y: start.y + ((end.y - start.y) * progress),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        const settledTargetBox = await target.boundingBox();
        assert.ok(settledTargetBox);
        const settledEnd = touchPointForModSourcePreviewTarget(start, {
            x: settledTargetBox.x + (settledTargetBox.width / 2),
            y: settledTargetBox.y + (settledTargetBox.height / 2),
        }, 393);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...settledEnd, radiusX: 5, radiusY: 5, force: 1 }],
        });
        assert.equal(await target.getAttribute("data-modulation-target-kind"), "oscB.ampGainDb");
        await page.waitForFunction(() => (
            document
                .querySelector('[data-role="mobile-voice-cell-volumeDb"]')
                ?.classList.contains("is-mod-hover") === true
        ));
        const dragDiagnostic = await page.evaluate(() => {
            const targetElement = document.querySelector('[data-role="mobile-voice-cell-volumeDb"]');
            const ghost = document.querySelector('[data-role="mobile-global-mod-source-ghost"]');
            const readRect = (element) => {
                const bounds = element?.getBoundingClientRect();
                return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null;
            };
            return {
                target: readRect(targetElement),
                ghost: readRect(ghost),
                hovered: Array.from(document.querySelectorAll(".is-mod-hover")).map((element) => ({
                    role: element.getAttribute("data-role"),
                    targetKind: element.getAttribute("data-modulation-target-kind"),
                    rect: readRect(element),
                })),
            };
        });
        assert.equal(
            (await target.getAttribute("class")).includes("is-mod-hover"),
            true,
            `Expected oscillator level hover. ${JSON.stringify(dragDiagnostic)}`,
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        const snapshot = await waitForHarnessSnapshot(
            page,
            "selected oscillator modulation route",
            (candidate) => readStoredModulationState(candidate).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "oscB.ampGainDb"
            )),
        );
        const routes = readStoredModulationState(snapshot).routes;
        assert.equal(routes.some((route) => (
            route.sourceKind === "env"
            && route.sourceSlot === 1
            && route.targetKind === "oscB.ampGainDb"
        )), true);
    } finally {
        await page.close();
    }
});

test("first mobile Mod Bar drop appears in the matrix after restoring routes", async () => {
    const restoredState = normalizeModulationState({
        routes: [{
            id: "mod-route-auto-1",
            enabled: true,
            sourceKind: "env",
            sourceSlot: 3,
            polarity: "unipolar",
            targetKind: "filterQ",
            amount: 0.25,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 695 });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: restoredState });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await waitForHarnessSnapshot(
            page,
            "restored modulation route before first drop",
            (snapshot) => readStoredModulationState(snapshot).routes.length === 1,
        );
        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        await page.waitForFunction(() => {
            const count = document.querySelector('[data-role="mod-mappings-count"]')?.textContent?.trim();
            const rows = Array.from(document.querySelectorAll('[data-role="mod-mappings-row"]'));
            return count === "1" && rows.some((row) => row.textContent?.includes("ENV 3"));
        });
        await page.locator('[data-role="mobile-workspace-tab-voice"]').click();
        const railGrip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
        await railGrip.waitFor();
        if (await railGrip.getAttribute("aria-expanded") !== "true") {
            await railGrip.click({ position: { x: 28, y: 12 } });
        }
        await page.waitForFunction(() => {
            const rail = document.querySelector('[data-role="mobile-global-mod-rail"]');
            const drawer = rail?.querySelector('[data-role="mobile-global-mod-rail-drawer"]');
            if (!(drawer instanceof HTMLElement) || rail?.getAttribute("data-expanded") !== "true") {
                return false;
            }
            const style = getComputedStyle(drawer);
            return drawer.getAttribute("aria-hidden") === "false"
                && !drawer.inert
                && style.opacity === "1"
                && style.visibility === "visible"
                && drawer.getAnimations().every((animation) => animation.playState === "finished");
        });

        const source = page.locator('[data-role="rack-mod-source-mseg-1"]');
        const target = page.locator('[data-role="mobile-voice-chip-semitone"]');
        await target.scrollIntoViewIfNeeded();
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const start = {
            x: sourceBox.x + (sourceBox.width / 2),
            y: sourceBox.y + (sourceBox.height / 2),
        };
        const targetCenter = {
            x: targetBox.x + (targetBox.width / 2),
            y: targetBox.y + (targetBox.height / 2),
        };
        const end = touchPointForModSourcePreviewTarget(start, targetCenter, 393, 695);

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        let thumb = start;
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            thumb = {
                x: start.x + ((end.x - start.x) * progress),
                y: start.y + ((end.y - start.y) * progress),
            };
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ ...thumb, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        // The amplified preview can land a few pixels off a compact corner
        // chip, and Chromium's touch resampler predicts one extra step past
        // a fast final move. Approach the chip closed-loop with small spaced
        // steps and verify capture before releasing, like a real thumb.
        const previewGain = Math.min(Math.max(393 / 168, 2.1), 2.5);
        let chipCaptured = false;
        for (let iteration = 0; iteration < 12 && !chipCaptured; iteration += 1) {
            const approach = await page.evaluate(() => {
                const ghost = document.querySelector('[data-role="mobile-global-mod-source-ghost"]');
                const bounds = ghost?.getBoundingClientRect();
                return {
                    ghost: bounds ? { x: bounds.x + (bounds.width / 2), y: bounds.y + (bounds.height / 2) } : null,
                    hovered: document.querySelector(".is-mod-hover")?.getAttribute("data-role") ?? null,
                };
            });
            assert.ok(approach.ghost, "The source drag must keep its preview ghost alive.");
            const error = {
                x: targetCenter.x - approach.ghost.x,
                y: targetCenter.y - approach.ghost.y,
            };
            if (Math.hypot(error.x, error.y) <= 3 && approach.hovered === "mobile-voice-chip-semitone") {
                chipCaptured = true;
                break;
            }
            const stepScale = Math.min(
                1,
                8 / Math.max(1, Math.hypot(error.x / previewGain, error.y / previewGain)),
            );
            thumb = {
                x: thumb.x + ((error.x / previewGain) * stepScale),
                y: thumb.y + ((error.y / previewGain) * stepScale),
            };
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ ...thumb, radiusX: 5, radiusY: 5, force: 1 }],
            });
            await page.waitForTimeout(30);
        }
        assert.equal(chipCaptured, true, "The preview must settle captured on the Semitone chip.");
        assert.equal(await target.getAttribute("data-modulation-target-kind"), "oscA.pitchSemitones");
        assert.equal((await target.getAttribute("class")).includes("is-mod-hover"), true);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForHarnessSnapshot(
            page,
            "first dropped oscillator modulation route",
            (snapshot) => readStoredModulationState(snapshot).routes.some((route) => (
                route.sourceKind === "mseg"
                && route.sourceSlot === 1
                && route.targetKind === "oscA.pitchSemitones"
            )),
        );
        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        await page.waitForFunction(() => {
            const count = document.querySelector('[data-role="mod-mappings-count"]')?.textContent?.trim();
            const rows = Array.from(document.querySelectorAll('[data-role="mod-mappings-row"]'));
            return count === "2" && rows.some((row) => row.textContent?.includes("MSEG 1"));
        });
        assert.equal(readStoredModulationState(await getHarnessSnapshot(page)).routes.length, 2);
    } finally {
        await cdp.detach().catch(() => {});
        await page.close();
    }
});

test("MSEG morph is a real modulation drop target", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await expandGlobalModRail(page);
        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('[data-role="mseg-morph-slider"]').first();
        await target.scrollIntoViewIfNeeded();
        assert.equal(await target.getAttribute("data-modulation-target-kind"), "mseg1Morph");

        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
        const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
        const end = touchPointForModSourcePreviewTarget(start, targetCenter, 393);

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((end.x - start.x) * progress),
                    y: start.y + ((end.y - start.y) * progress),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        assert.equal((await target.getAttribute("class")).includes("is-mod-hover"), true);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "MSEG morph modulation route",
            (candidate) => readStoredModulationState(candidate).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "mseg1Morph"
            )),
        );
        assert.equal(readStoredModulationState(snapshot).routes.some((route) => (
            route.sourceKind === "env"
            && route.sourceSlot === 1
            && route.targetKind === "mseg1Morph"
        )), true);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("every continuous MSEG and envelope control exposes its exact modulation target", async () => {
    const page = await openHarnessPage();

    try {
        for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
            await page.getByRole("button", { name: `Select MSEG ${slotIndex + 1}` }).click();
            assert.equal(
                await page.locator('[role="slider"][aria-label="MSEG morph"]:visible').getAttribute("data-modulation-target-kind"),
                `mseg${slotIndex + 1}Morph`,
            );
            assert.equal(
                await page.locator('input[aria-label="MSEG rate"]:visible').getAttribute("data-modulation-target-kind"),
                `mseg${slotIndex + 1}Rate`,
            );
        }

        const envelopeFields = [
            ["Envelope attack value", "Attack"],
            ["Envelope decay value", "Decay"],
            ["Envelope sustain value", "Sustain"],
            ["Envelope release value", "Release"],
        ];
        for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
            await page.getByRole("button", { name: `Select envelope ${slotIndex + 1}` }).click();
            for (const [ariaLabel, suffix] of envelopeFields) {
                assert.equal(
                    await page.locator(`input[aria-label="${ariaLabel}"]:visible`).getAttribute("data-modulation-target-kind"),
                    `env${slotIndex + 1}${suffix}`,
                );
            }
        }
    } finally {
        await page.close();
    }
});

test("envelope decay accepts a real touch modulation drop", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await expandGlobalModRail(page);
        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        await page.locator('[data-role="mobile-mod-source-type"]').selectOption("envelope");
        await page.locator('[data-role="mobile-mod-source-number"]').selectOption("2");
        const source = page.locator('[data-role="rack-mod-source-env-1"]');
        const target = page.locator('input[aria-label="Envelope decay value"]:visible');
        await target.scrollIntoViewIfNeeded();
        assert.equal(await target.getAttribute("data-modulation-target-kind"), "env2Decay");

        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        assert.ok(sourceBox && targetBox);
        const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
        const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
        const end = touchPointForModSourcePreviewTarget(start, targetCenter, 393);

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 8; step += 1) {
            const progress = step / 8;
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: start.x + ((end.x - start.x) * progress),
                    y: start.y + ((end.y - start.y) * progress),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
        }
        // The preview's path-dependent amplification can land a few px shy
        // of a SMALL target (this input is 20px tall): close the residual by
        // chasing the preview error with bounded finger nudges — exactly a
        // human's micro-correction.
        let finger = { ...end };
        for (let attempt = 0; attempt < 10; attempt += 1) {
            if ((await target.getAttribute("class")).includes("is-mod-hover")) {
                break;
            }
            const ghostPosition = await page.evaluate(() => {
                const ghost = document.querySelector('[data-role="mobile-global-mod-source-ghost"]');
                return ghost ? { x: parseFloat(ghost.style.left), y: parseFloat(ghost.style.top) } : null;
            });
            assert.ok(ghostPosition, "The drag preview must stay alive while correcting.");
            finger = {
                x: finger.x + ((targetCenter.x - ghostPosition.x) * 0.4),
                y: finger.y + ((targetCenter.y - ghostPosition.y) * 0.4),
            };
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ ...finger, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        assert.equal((await target.getAttribute("class")).includes("is-mod-hover"), true);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "envelope decay modulation route",
            (candidate) => readStoredModulationState(candidate).routes.some((route) => (
                route.sourceKind === "env"
                && route.sourceSlot === 1
                && route.targetKind === "env2Decay"
            )),
        );
        assert.equal(readStoredModulationState(snapshot).routes.some((route) => (
            route.sourceKind === "env"
            && route.sourceSlot === 1
            && route.targetKind === "env2Decay"
        )), true);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("voice controls expose the selected oscillator and shared filter modulation targets", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                // Dock the Mod rail at its top anchor so the floating overlay
                // does not cover the Voice toolbar this test drives.
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
        },
    });
    const targetKindFor = (role) => page.locator(`[data-role="${role}"]`).evaluate((element) => (
        element.closest("[data-modulation-target-kind]")?.getAttribute("data-modulation-target-kind") ?? null
    ));
    const showPage = async (pageName) => {
        for (let step = 0; step < 5; step += 1) {
            const current = await page.locator('[data-role="mobile-voice-page"]').getAttribute("data-page-name");
            if (current === pageName) {
                return;
            }
            await page.locator('[data-role="mobile-voice-page-next"]').click();
        }
        throw new Error(`Could not reach toolbar page ${pageName}`);
    };

    try {
        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        await page.waitForSelector(
            '[data-role="mobile-voice-editor"][data-selected-oscillator-id="B"]',
        );

        assert.equal(await targetKindFor("mobile-voice-graph"), "oscB.wavetablePosition");
        assert.equal(await targetKindFor("mobile-voice-chip-semitone"), "oscB.pitchSemitones");
        assert.equal(await targetKindFor("mobile-voice-cell-framePosition"), "oscB.wavetablePosition");
        assert.equal(await targetKindFor("mobile-voice-cell-warpAmount"), "oscB.warpAmount");
        assert.equal(await targetKindFor("mobile-voice-cell-volumeDb"), "oscB.ampGainDb");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonDetune"), "oscB.unisonDetune");

        await showPage("Tune");
        assert.equal(await targetKindFor("mobile-voice-cell-pan"), "oscB.pan");

        await showPage("Unison");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonBlend"), "oscB.unisonBlend");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonWidth"), "oscB.unisonWidth");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonWavetablePositionSpread"), "oscB.unisonWavetablePositionSpread");
        assert.equal(await targetKindFor("mobile-voice-cell-unisonWarpSpread"), "oscB.unisonWarpSpread");

        // T05: the compact filter card presents its destinations on the
        // attached Cut/Res/Mix knob row instead of the desktop fields.
        assert.equal(await targetKindFor("voice-filter-knob-filterCutoff"), "filterCutoffOctaves");
        assert.equal(await targetKindFor("voice-filter-knob-filterQ"), "filterQ");
        assert.equal(await targetKindFor("voice-filter-knob-filterMix"), "filterMix");

        await page.locator('[data-role="mobile-voice-tab-c"]').click();
        await page.waitForSelector(
            '[data-role="mobile-voice-editor"][data-selected-oscillator-id="C"]',
        );
        assert.equal(await targetKindFor("mobile-voice-graph"), "oscC.wavetablePosition");
        assert.equal(await targetKindFor("mobile-voice-cell-volumeDb"), "oscC.ampGainDb");
        assert.equal(await targetKindFor("mobile-voice-chip-semitone"), "oscC.pitchSemitones");
    } finally {
        await page.close();
    }
});

test("wavetable selection commits the desired table and retry uses the runtime retry event", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        const audibleTableName = (await getHarnessRenderedState(page)).stageLabel;
        const desiredTableName = (await page.locator('select[aria-label="Select wavetable"] option').nth(1).textContent())?.trim();

        assert.ok(audibleTableName);
        assert.ok(desiredTableName);

        await clearHarnessDebugLog(page);
        await page.click('select[aria-label="Select wavetable"]');
        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await page.selectOption('select[aria-label="Select wavetable"]', "1");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAWavetableSelect) === 1 &&
                snapshot.runtimeState.desiredTableIndex === 1 &&
                snapshot.runtimeState.activeTableIndex === 0 &&
                snapshot.runtimeState.hasLoading === true &&
                snapshot.runtimeState.loadingTableIndex === 1;
        });
        await page.waitForSelector(`text=Loading ${desiredTableName}…`);

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetableSelect"), true);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetableSelect"), true);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetablePosition"), false);
        assert.equal(snapshot.runtimeState.activeTableIndex, 0);
        assert.equal(snapshot.runtimeState.desiredTableIndex, 1);
        assert.equal(snapshot.runtimeState.hasLoading, true);
        assert.equal(snapshot.runtimeState.loadingTableIndex, 1);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscAWavetableSelect" && Number(value) === 1),
            true,
        );
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 1,
            failedGeneration: 2,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });

        await page.waitForSelector("text=Wavetable load timed out.");
        await page.waitForSelector('button:has-text("Retry Load")');
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Retry Load")');

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.some(({ endpointID }) => endpointID === "retryDesiredTableRequest")
                && snapshot.runtimeState.hasLoading === true
                && snapshot.runtimeState.loadingTableIndex === 1
                && snapshot.runtimeState.hasFailure === false;
        });
        await page.waitForSelector(`text=Loading ${desiredTableName}…`);
        await page.waitForSelector('button:has-text("Retry Load")', { state: "detached" });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "retryDesiredTableRequest"),
            [{ endpointID: "retryDesiredTableRequest", value: 0 }],
        );
        assert.equal(snapshot.runtimeState.hasLoading, true);
        assert.equal(snapshot.runtimeState.loadingTableIndex, 1);
        assert.equal(snapshot.runtimeState.hasFailure, false);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);
        assert.equal((await getHarnessRenderedState(page)).stageLabel, audibleTableName);
    } finally {
        await page.close();
    }
});

test("runtime loading state keeps the audible table visible while naming the desired table as pending", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });

        const audibleTableName = (await getHarnessRenderedState(page)).stageLabel;
        const desiredTableName = (await page.locator('select[aria-label="Select wavetable"] option').nth(1).textContent())?.trim();

        assert.ok(audibleTableName);
        assert.ok(desiredTableName);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 1,
            desiredIntentSerial: 3,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 9,
            hasLoading: true,
            loadingTableIndex: 1,
            loadingGeneration: 10,
            hasFailure: false,
        });

        await page.waitForSelector(`text=Loading ${desiredTableName}…`);
        await page.waitForFunction((expectedTableName) => {
            return window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().stageLabel === expectedTableName;
        }, audibleTableName);
    } finally {
        await page.close();
    }
});

test("mobile wavetable selection names the pending table and the harness activates it", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const select = page.locator('select[aria-label="Select wavetable"]');
        const desiredOption = select.locator("option").nth(1);
        await desiredOption.waitFor({ state: "attached" });
        const desiredTableName = (await desiredOption.textContent())?.trim();
        assert.ok(desiredTableName);

        await select.selectOption("1");
        await page.waitForFunction((expected) => (
            document.querySelector('[data-role="mobile-voice-table-name"]')?.textContent?.trim()
                === `Loading ${expected}…`
        ), desiredTableName, { timeout: 3_000 });
        assert.equal(
            await page.locator('header:has-text("Cosimo Synth")').count(),
            0,
            "Compact mode must not rely on the desktop status header.",
        );

        await page.waitForFunction(() => {
            const { runtimeState } = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return runtimeState.activeTableIndex === 1 && runtimeState.hasLoading === false;
        });
        await page.waitForFunction((expected) => (
            document.querySelector('[data-role="mobile-voice-table-name"]')?.textContent?.trim() === expected
        ), desiredTableName);
        assert.equal(await select.inputValue(), "1");
    } finally {
        await page.close();
    }
});

test("stage drag preserves the gesture contract and ignores tiny drags", async () => {
    const page = await openHarnessPage();

    try {
        const stage = page.locator(".cosimo-stage");
        const box = await stage.boundingBox();
        assert.ok(box);

        const startX = box.x + (box.width * 0.5);
        const startY = box.y + (box.height * 0.5);

        await clearHarnessDebugLog(page);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY - 1);
        await page.mouse.up();

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.filter((value) => value === "oscAWavetablePosition").length, 1);
        assert.equal(snapshot.gestureEnds.filter((value) => value === "oscAWavetablePosition").length, 1);
        assert.equal(snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY - 48, { steps: 6 });
        await page.mouse.up();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition");
        });

        snapshot = await getHarnessSnapshot(page);
        const positionMessages = snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWavetablePosition");

        assert.equal(snapshot.gestureStarts.filter((value) => value === "oscAWavetablePosition").length, 1);
        assert.equal(snapshot.gestureEnds.filter((value) => value === "oscAWavetablePosition").length, 1);
        assert.equal(positionMessages.length > 0, true);

        const lastPosition = Number(positionMessages.at(-1)?.value);
        const expectedPosition = Math.min(1, Math.max(0, 0.28 + (48 / box.height)));
        assert.ok(Math.abs(lastPosition - expectedPosition) <= 0.03);

        await setHarnessRuntimeState(page, {
            desiredTableIndex: 0,
            desiredIntentSerial: 4,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 11,
            hasLoading: false,
            hasFailure: true,
            failedTableIndex: 0,
            failedGeneration: 11,
            failureScope: 1,
            failurePhase: 3,
            failureReasonCode: 2,
        });
        await page.waitForSelector('button:has-text("Retry Load")');
        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Retry Load")');

        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);

        await clearHarnessDebugLog(page);
        await showVoiceControls(page);
        await page.click('[aria-label="Glide"]');
        snapshot = await getHarnessSnapshot(page);
        assert.equal(snapshot.gestureStarts.includes("oscAWavetablePosition"), false);
        assert.equal(snapshot.gestureEnds.includes("oscAWavetablePosition"), false);
    } finally {
        await page.close();
    }
});

test("wavetable select claims left and right arrows on the real desktop page", async () => {
    const page = await openHarnessPage();

    try {
        await page.locator('select[aria-label="Select wavetable"] option').nth(1).waitFor({ state: "attached" });
        await page.locator('select[aria-label="Select wavetable"]').evaluate((element) => {
            element.addEventListener("keydown", (event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                }
            }, true);
        });

        await clearHarnessDebugLog(page);
        await page.focus('select[aria-label="Select wavetable"]');
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAWavetableSelect) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWavetableSelect"),
            [{ endpointID: "oscAWavetableSelect", value: 1 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.keyboard.press("ArrowLeft");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAWavetableSelect) === 0;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWavetableSelect"),
            [{ endpointID: "oscAWavetableSelect", value: 0 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);
    } finally {
        await page.close();
    }
});

test("keyboard routing lets focused controls claim arrows and still routes note keys to the keyboard", async () => {
    const page = await openHarnessPage();

    try {
        const initialKeyboardDebug = await getKeyboardDebug(page);
        assert.ok(initialKeyboardDebug);
        assert.deepEqual(initialKeyboardDebug.attachCalls, [{ endpointID: "midiIn" }]);
        await showVoiceControls(page);

        await clearHarnessDebugLog(page);
        await page.focus('button:has-text("Poly")');
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 1 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.focus('[aria-label="Glide"]');
        await page.waitForFunction(() => {
            const keyboardDebug = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardDebug;
            return Number(keyboardDebug?.allNotesOffCount ?? 0) === 1;
        });
        await page.keyboard.press("ArrowRight");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.151) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.151 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        let keyboardDebug = await getKeyboardDebug(page);
        assert.ok(keyboardDebug);
        assert.equal(keyboardDebug.allNotesOffCount, 1);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        await clearHarnessDebugLog(page);
        await page.focus('[aria-label="Glide"]');
        await page.keyboard.press("ArrowLeft");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.15) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.15 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);

        await clearHarnessDebugLog(page);
        await page.locator('[aria-label="Glide"]').blur();
        await page.keyboard.down("a");
        await page.keyboard.up("a");

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.midiInputEvents.length === 2;
        });

        keyboardDebug = await getKeyboardDebug(page);
        assert.deepEqual(keyboardDebug.handledKeys, []);

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.midiInputEvents,
            [
                { endpointID: "midiIn", value: buildShortMidi(0x90, 36, 100) },
                { endpointID: "midiIn", value: buildShortMidi(0x80, 36) },
            ],
        );
    } finally {
        await page.close();
    }
});

test("glide widget commits direct edits and blocks note routing while text entry is active", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const glideInput = page.locator('[aria-label="Glide"]');
        await glideInput.waitFor();

        await clearHarnessDebugLog(page);
        await glideInput.focus();
        assert.equal(
            (await glideInput.locator("xpath=ancestor::label[1]//*[@data-role='parameter-entry-unit']").textContent()).trim(),
            "ms",
        );
        await page.waitForFunction(() => {
            const keyboardDebug = window.__COSIMO_DESKTOP_HARNESS__.getRenderedState().keyboardDebug;
            return Number(keyboardDebug?.allNotesOffCount ?? 0) === 1;
        });

        await clearHarnessDebugLog(page);
        await page.keyboard.down("a");
        await page.keyboard.up("a");
        await dispatchInputValueChange(glideInput, 500);
        await glideInput.blur();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.glideTime) - 0.5) <= 1e-9;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "glideTime"),
            [{ endpointID: "glideTime", value: 0.5 }],
        );
        assert.deepEqual(snapshot.midiInputEvents, []);
    } finally {
        await page.close();
    }
});

test("voice mode buttons commit the exact discrete playMode values", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        await clearHarnessDebugLog(page);

        await page.click('button:has-text("Mono")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 1;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 1 }],
        );
        assert.equal(await page.locator('button:has-text("Mono")').getAttribute("aria-pressed"), "true");

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Legato")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 2;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 2 }],
        );
        assert.equal(await page.locator('button:has-text("Legato")').getAttribute("aria-pressed"), "true");

        await clearHarnessDebugLog(page);
        await page.click('button:has-text("Poly")');
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.playMode) === 0;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "playMode"),
            [{ endpointID: "playMode", value: 0 }],
        );
        assert.equal(await page.locator('button:has-text("Poly")').getAttribute("aria-pressed"), "true");
    } finally {
        await page.close();
    }
});

test("unison controls commit parameters and redraw the voice distribution", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        await page.locator('[data-role="unison-control-surface"]').waitFor();
        assert.equal(await page.locator('[data-role="unison-visualization"] circle').count(), 1);

        await clearHarnessDebugLog(page);
        await page.locator('[data-role="unison-voices-up"]').click();
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAUnisonVoices) === 2;
        });

        let snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAUnisonVoices"),
            [{ endpointID: "oscAUnisonVoices", value: 2 }],
        );

        await clearHarnessDebugLog(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        await detuneInput.dblclick();
        await detuneInput.fill("25");
        await detuneInput.press("Enter");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.oscAUnisonDetune) - 0.5) < 0.0001;
        });

        await page.locator('[data-role="unison-detune-mode-control"]').click();
        await page.locator('[data-role="unison-stack-mode-control"]').click();
        await page.locator('[data-role="unison-phase-mode-control"]').click();
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAUnisonDetuneMode) === 1
                && Number(snapshot.parameterValues.oscAUnisonStackMode) === 1
                && Number(snapshot.parameterValues.oscARetrigger) === 1;
        });

        snapshot = await getHarnessSnapshot(page);
        const unisonEndpointIDs = new Set([
            "oscAUnisonDetune",
            "oscAUnisonDetuneMode",
            "oscAUnisonStackMode",
            "oscARetrigger",
        ]);
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => unisonEndpointIDs.has(endpointID))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [
                { endpointID: "oscAUnisonDetune", value: 0.5 },
                { endpointID: "oscAUnisonDetuneMode", value: 1 },
                { endpointID: "oscAUnisonStackMode", value: 1 },
                { endpointID: "oscARetrigger", value: 1 },
            ],
        );

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.patchConnection.emitEffectiveUnisonState({
                voices: 5,
                detune: 0.4,
                blend: 0.75,
                width: 1,
                detuneMode: 1,
                stackMode: 2,
                wavetablePositionSpread: 0.5,
                warpSpread: 0.25,
            });
        });
        await page.waitForFunction(() => document.querySelectorAll('[data-role="unison-visualization"] circle').length === 5);
    } finally {
        await page.close();
    }
});

test("voice exact entry shows units, accepts logarithmic Cutoff percent, and rejects garbage voices", async () => {
    const page = await openHarnessPage();

    try {
        const cutoffInput = page.locator('[data-role="filter-cutoff-field"] input');
        await cutoffInput.dblclick();
        assert.equal(
            (await page.locator('[data-role="filter-cutoff-field"] [data-role="parameter-entry-unit"]').textContent()).trim(),
            "Hz",
        );
        await cutoffInput.fill("50%");
        await cutoffInput.press("Enter");
        await waitForHarnessSnapshot(
            page,
            "logarithmic Cutoff percent exact entry",
            (snapshot) => Math.abs(Number(snapshot.parameterValues.filterCutoff) - 632.4555) < 0.02,
        );

        await showVoiceControls(page);
        const voicesInput = page.locator('[data-role="unison-voices-control"] input');
        const initialVoices = Number((await getHarnessSnapshot(page)).parameterValues.oscAUnisonVoices);
        await voicesInput.dblclick();
        assert.equal(
            (await page.locator('[data-role="unison-voices-control"] [data-role="parameter-entry-unit"]').textContent()).trim(),
            "x",
        );
        await voicesInput.fill("many");
        await voicesInput.press("Enter");
        assert.equal(await voicesInput.isEditable(), true, "a rejected exact value keeps the field editable");
        assert.match(
            await page.locator('[data-role="unison-voices-control"] [data-role="parameter-entry-error"]').textContent(),
            /number.*voices/i,
        );
        assert.equal(Number((await getHarnessSnapshot(page)).parameterValues.oscAUnisonVoices), initialVoices);
    } finally {
        await page.close();
    }
});

test("precision value entry commits the newest text when Enter follows in the same event turn", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        await detuneInput.dblclick();
        await clearHarnessDebugLog(page);
        await detuneInput.evaluate((element) => {
            if (!(element instanceof HTMLInputElement)) {
                throw new Error("Expected the unison detune input.");
            }
            const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            if (!setNativeValue) {
                throw new Error("Expected the native input value setter.");
            }
            setNativeValue.call(element, "25");
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        });

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.oscAUnisonDetune) - 0.5) < 0.0001;
        });
    } finally {
        await page.close();
    }
});

test("precision value entry keeps the focused draft when a host echo arrives", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        await detuneInput.dblclick();
        await detuneInput.fill("25");
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAUnisonDetune", 0.8, true);
        });
        await page.waitForTimeout(50);

        assert.equal(await detuneInput.inputValue(), "25");
        await clearHarnessDebugLog(page);
        await detuneInput.press("Enter");
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.oscAUnisonDetune) - 0.5) < 0.0001;
        });
    } finally {
        await page.close();
    }
});

test("desktop unison drag presents within 50 ms while committing the matching runtime value", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 1280, height: 720 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await page.locator('[data-role="keyboard-control-mode-voice"]').click();
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        await detuneInput.waitFor({ state: "visible" });
        const bounds = await detuneInput.boundingBox();
        assert.ok(bounds);
        await page.evaluate(() => {
            window.__COSIMO_UNISON_LATENCY__ = { armed: null, results: [] };
            const patchConnection = window.__COSIMO_DESKTOP_HARNESS__.patchConnection;
            const sendEventOrValue = patchConnection.sendEventOrValue.bind(patchConnection);
            patchConnection.sendEventOrValue = (endpointID, value) => {
                const state = window.__COSIMO_UNISON_LATENCY__;
                if (endpointID === "oscAUnisonDetune" && state?.armed?.handlerStartedAt) {
                    state.armed.runtimeSentAt ??= performance.now();
                }
                return sendEventOrValue(endpointID, value);
            };
            const targetInput = document.querySelector('[data-role="unison-detune-control"] input');
            const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
            if (!(targetInput instanceof HTMLInputElement) || !nativeValue?.get || !nativeValue.set) {
                throw new Error("Expected an instrumentable unison detune input.");
            }
            Object.defineProperty(targetInput, "value", {
                configurable: true,
                get() {
                    return nativeValue.get.call(this);
                },
                set(nextValue) {
                    nativeValue.set.call(this, nextValue);
                    const state = window.__COSIMO_UNISON_LATENCY__;
                    const armed = state?.armed;
                    if (!armed?.handlerStartedAt || armed.presented || String(nextValue) === armed.initialValue) {
                        return;
                    }
                    armed.presented = true;
                    state.results.push({
                        nativeQueueMs: armed.nativeQueueMs,
                        handlerToCommitMs: performance.now() - armed.handlerStartedAt,
                        handlerToRuntimeMs: armed.runtimeSentAt - armed.handlerStartedAt,
                        totalMs: armed.nativeQueueMs + performance.now() - armed.handlerStartedAt,
                        initialValue: armed.initialValue,
                        presentedValue: String(nextValue),
                    });
                },
            });
            document.addEventListener("pointermove", (event) => {
                const state = window.__COSIMO_UNISON_LATENCY__;
                const input = event.composedPath().find((candidate) => (
                    candidate instanceof HTMLInputElement
                    && candidate.closest('[data-role="unison-detune-control"]')
                ));
                if (!state?.armed || state.armed.handled || !(input instanceof HTMLInputElement)) {
                    return;
                }

                state.armed.handled = true;
                const armed = state.armed;
                const handlerStartedAt = performance.now();
                armed.handlerStartedAt = handlerStartedAt;
                armed.nativeQueueMs = handlerStartedAt - event.timeStamp;
            }, { capture: true, passive: true });
        });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
        await detuneInput.evaluate((input) => {
            window.__COSIMO_UNISON_LATENCY__.armed = {
                initialValue: input.value,
                handled: false,
            };
        });

        const startX = bounds.x + (bounds.width / 2);
        const endX = startX + Math.min(24, bounds.width * 0.25);
        const y = bounds.y + (bounds.height / 2);
        await detuneInput.dispatchEvent("pointerdown", {
            pointerId: 71,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: startX,
            clientY: y,
        });
        await detuneInput.dispatchEvent("pointermove", {
            pointerId: 71,
            pointerType: "mouse",
            button: 0,
            buttons: 1,
            clientX: endX,
            clientY: y,
        });
        await detuneInput.dispatchEvent("pointerup", {
            pointerId: 71,
            pointerType: "mouse",
            button: 0,
            buttons: 0,
            clientX: endX,
            clientY: y,
        });
        await page.waitForFunction(() => window.__COSIMO_UNISON_LATENCY__?.results?.length === 1, null, { timeout: 10_000 });

        const result = await page.evaluate(() => window.__COSIMO_UNISON_LATENCY__.results[0]);
        const snapshot = await getHarnessSnapshot(page);
        const sentUnisonMessages = snapshot.sentMessages.filter(
            ({ endpointID }) => endpointID === "oscAUnisonDetune",
        );
        assert.notEqual(result.presentedValue, result.initialValue);
        assert.ok(sentUnisonMessages.length > 0, "The presented drag must also reach the runtime boundary.");
        assert.equal(
            Number(snapshot.parameterValues.oscAUnisonDetune),
            Number(sentUnisonMessages.at(-1).value),
            "The runtime value must match the last value sent by the drag.",
        );
        assert.ok(
            result.nativeQueueMs + result.handlerToRuntimeMs < 50,
            `Expected unison runtime send <50ms, got ${JSON.stringify(result)}`,
        );
        assert.ok(result.totalMs < 50, `Expected unison value presentation <50ms, got ${JSON.stringify(result)}`);
        await page.waitForTimeout(100);
        assert.equal(
            await detuneInput.inputValue(),
            result.presentedValue,
            "The optimistic value must not snap back while the deferred runtime echo settles.",
        );
        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.setParameterValue("oscAUnisonDetune", 0.8, true);
        });
        await page.waitForFunction(() => (
            document.querySelector('[data-role="unison-detune-control"] input')?.value === "40 ct"
        ));
        assert.equal(await detuneInput.inputValue(), "40 ct", "An authoritative host echo must replace the drag value.");
    } finally {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
        await cdp.detach().catch(() => {});
        await page.close();
    }
});

test("precision fields end their host gesture when mouse movement reports no pressed button", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        const box = await detuneInput.boundingBox();
        assert.ok(box);
        const startX = box.x + (box.width / 2);
        const startY = box.y + (box.height / 2);
        await clearHarnessDebugLog(page);
        await detuneInput.evaluate((element, point) => {
            if (!(element instanceof HTMLInputElement)) {
                throw new Error("Expected the unison detune input.");
            }
            element.setPointerCapture = () => undefined;
            element.hasPointerCapture = () => false;
            element.releasePointerCapture = () => undefined;
            element.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true,
                pointerId: 47,
                pointerType: "mouse",
                button: 0,
                buttons: 1,
                clientX: point.startX,
                clientY: point.startY,
            }));
            element.dispatchEvent(new PointerEvent("pointermove", {
                bubbles: true,
                pointerId: 47,
                pointerType: "mouse",
                button: 0,
                buttons: 0,
                clientX: point.startX + 20,
                clientY: point.startY,
            }));
        }, {
            startX,
            startY,
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.gestureStarts, ["oscAUnisonDetune"]);
        assert.deepEqual(snapshot.gestureEnds, ["oscAUnisonDetune"]);
    } finally {
        await page.close();
    }
});

test("precision fields keep tracking touch when pointer capture is unavailable", async () => {
    const page = await openHarnessPage();

    try {
        await showVoiceControls(page);
        const detuneInput = page.locator('[data-role="unison-detune-control"] input');
        const box = await detuneInput.boundingBox();
        assert.ok(box);
        await detuneInput.evaluate((element) => {
            element.setPointerCapture = () => {
                throw new DOMException("Pointer capture is unavailable.", "NotFoundError");
            };
        });
        await clearHarnessDebugLog(page);
        const pointerId = 48;
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
        const moved = { x: start.x + 40, y: start.y };
        await detuneInput.dispatchEvent("pointerdown", {
            pointerId,
            pointerType: "touch",
            button: 0,
            buttons: 1,
            clientX: start.x,
            clientY: start.y,
        });
        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointermove", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });

        let snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free precision touch move",
            (nextSnapshot) => nextSnapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAUnisonDetune"),
        );
        assert.deepEqual(snapshot.gestureStarts, ["oscAUnisonDetune"]);
        assert.deepEqual(snapshot.gestureEnds, []);

        await page.evaluate(({ pointerId, moved }) => {
            window.dispatchEvent(new PointerEvent("pointerup", {
                pointerId,
                pointerType: "touch",
                button: 0,
                buttons: 0,
                clientX: moved.x,
                clientY: moved.y,
                bubbles: true,
            }));
        }, { pointerId, moved });
        snapshot = await waitForHarnessSnapshot(
            page,
            "capture-free precision touch release",
            (nextSnapshot) => nextSnapshot.gestureEnds.includes("oscAUnisonDetune"),
        );
        assert.deepEqual(snapshot.gestureEnds, ["oscAUnisonDetune"]);
    } finally {
        await page.close();
    }
});

test("warp controls commit mode and amount, and the matrix can route MSEG 1 into warp amount", async () => {
    const page = await openHarnessPage();

    try {
        await ensureFirstModulationRoute(page);
        assert.equal(await page.locator('select[aria-label="Warp mode"]').count(), 0);
        assert.equal(await page.getByText("Phase Warp", { exact: true }).count(), 0);

        await clearHarnessDebugLog(page);
        const warpModeChip = page.locator('button[aria-label^="Cycle warp mode"]').first();
        let currentMode = await page.evaluate(() => Number(window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.oscAWarpMode));

        for (let guard = 0; guard < 8 && currentMode !== 3; guard += 1) {
            await warpModeChip.click();
            currentMode = await waitForPageValue(
                page,
                "warp mode cycling to asym",
                () => window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().parameterValues.oscAWarpMode,
                (value) => Number(value) !== Number(currentMode),
            );
        }

        assert.equal(currentMode, 3);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscAWarpMode" && Number(value) === 3),
            true,
        );

        await clearHarnessDebugLog(page);
        await warpModeChip.click();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Number(snapshot.parameterValues.oscAWarpMode) === 4;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID, value }) => endpointID === "oscAWarpMode" && Number(value) === 4),
            true,
        );

        await clearHarnessDebugLog(page);
        const warpAmountInput = page.locator('input[aria-label="Warp amount"]');
        await warpAmountInput.dblclick();
        assert.equal(
            (await page.locator('[data-role="warp-amount-field"] [data-role="parameter-entry-unit"]').textContent()).trim(),
            "%",
        );
        await warpAmountInput.press(`${process.platform === "darwin" ? "Meta" : "Control"}+A`);
        await warpAmountInput.type("72");
        await warpAmountInput.blur();

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return Math.abs(Number(snapshot.parameterValues.oscAWarpAmount) - 0.72) <= 1e-9;
        });

        snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWarpAmount"),
            [{ endpointID: "oscAWarpAmount", value: 0.72 }],
        );

        assert.equal(await page.locator('[aria-label="Route 1 slot"]').count(), 0);
        await choosePrototypeSelectOption(page, "Route 1 target", "A WARP");
        await waitForHarnessSnapshot(
            page,
            "Route 1 target selection",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.targetKind === "oscA.warpAmount",
        );
        await page.getByRole("button", { name: "Route 1 polarity" }).click();
        await waitForHarnessSnapshot(
            page,
            "Route 1 bipolar selection",
            (nextSnapshot) => readStoredModulationState(nextSnapshot).routes[0]?.polarity === "bipolar",
        );
        const routeAmount = page.locator('[aria-label="Route 1 amount"]');
        await routeAmount.focus();
        await routeAmount.press("Home");

        snapshot = await waitForHarnessSnapshot(
            page,
            "Route 1 targeting warp amount",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                return route?.targetKind === "oscA.warpAmount"
                    && route?.polarity === "bipolar"
                    && Number(route.amount) === -1;
            },
        );

        const finalRoute = readStoredModulationState(snapshot).routes[0];
        assert.deepEqual(routeSummary(finalRoute), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "oscA.warpAmount",
            amount: finalRoute.amount,
        });
        assert.deepEqual(readRuntimeProgramRoute(snapshot, finalRoute), {
            path: "voice",
            cellIndex: 1,
            sourceIndex: 0,
            targetIndex: 1,
            polarityKind: 1,
        });
        assert.equal(hasRuntimeAmount(snapshot, finalRoute, finalRoute.amount), true);
        const amountReadout = page.locator('[data-role="route-row-1"] >> text=/±100%/');
        await amountReadout.waitFor({ state: "visible" });
        assert.equal((await amountReadout.count()) >= 1, true);
    } finally {
        await page.close();
    }
});

test("articulation recall applies sparse v4 overrides without replacing routing", async () => {
    const page = await openHarnessPage();
    const routeId = "oscA.warpAmount::mseg-1";

    try {
        await page.waitForFunction(() => {
            const addButton = document.querySelector('button[aria-label="Capture current parameters as a new articulation"]');
            return addButton instanceof HTMLButtonElement && !addButton.disabled;
        });

        await page.evaluate(({ fallbackModulationState, nextRouteId }) => {
            const harness = window.__COSIMO_DESKTOP_HARNESS__;
            harness.setParameterValue("oscAWavetablePosition", 0.12);
            harness.setParameterValue("oscAPan", 0.41);
            harness.setParameterValue("oscAWarpMode", 4);
            harness.setParameterValue("oscAWarpAmount", 0.08);
            harness.setParameterValue("filterCutoff", 8200);

            const rawModulationState = harness.getSnapshot().storedState["modulation.v6"];
            const modulationState = rawModulationState
                ? JSON.parse(String(rawModulationState))
                : fallbackModulationState;
            modulationState.routes = [{
                id: nextRouteId,
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "oscA.warpAmount",
                amount: 0.03,
                reducer: "max",
            }];
            harness.setStoredStateValue("modulation.v6", JSON.stringify(modulationState));
        }, {
            fallbackModulationState: createDefaultModulationState(),
            nextRouteId: routeId,
        });
        await waitForHarnessSnapshot(
            page,
            "canonical modulation route before articulation recall",
            (snapshot) => readStoredModulationState(snapshot).routes[0]?.id === routeId,
        );

        const bank = {
            format: "cosimo.articulations",
            version: 4,
            selectedSlotId: null,
            activeTriggerMode: "chain",
            slots: [{
                id: "articulation-0",
                runtimeSlot: 0,
                name: "Bow Forte",
                color: "#d2a128",
                key: 0,
                velRange: { min: 1, max: 1 },
                chainRange: { min: 0, max: 0 },
                overrides: {
                    "oscA.framePosition": 0.66,
                    "oscA.pan": -0.18,
                    "oscA.warpMode": 3,
                    "oscA.warpAmount": 0.61,
                    filterCutoffHz: 2475,
                },
                routeAmounts: { [routeId]: 0.42 },
            }],
        };
        await page.evaluate(({ stateKey, nextBank }) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue(stateKey, JSON.stringify(nextBank));
        }, {
            stateKey: ARTICULATION_STATE_KEY,
            nextBank: bank,
        });
        await page.locator('[data-role="articulation-card"][data-runtime-slot="0"]').waitFor();

        await clearHarnessDebugLog(page);
        await page.locator('[data-role="articulation-card"][data-runtime-slot="0"]').click();

        const snapshot = await waitForHarnessSnapshot(
            page,
            "sparse articulation recall",
            (nextSnapshot) => {
                const route = readStoredModulationState(nextSnapshot).routes[0];
                const storedBank = readStoredArticulationEditorState(nextSnapshot);
                return storedBank.selectedSlotId === "articulation-0"
                    && Math.abs(Number(nextSnapshot.parameterValues.oscAWavetablePosition) - 0.66) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.oscAPan) - -0.18) <= 1e-9
                    && Number(nextSnapshot.parameterValues.oscAWarpMode) === 3
                    && Math.abs(Number(nextSnapshot.parameterValues.oscAWarpAmount) - 0.61) <= 1e-9
                    && Math.abs(Number(nextSnapshot.parameterValues.filterCutoff) - 2475) <= 1e-9
                    && route?.id === routeId
                    && route?.sourceKind === "mseg"
                    && route?.sourceSlot === 1
                    && route?.targetKind === "oscA.warpAmount"
                    && Math.abs(Number(route?.amount) - 0.42) <= 1e-9;
            },
        );

        assert.deepEqual(routeSummary(readStoredModulationState(snapshot).routes[0]), {
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "bipolar",
            targetKind: "oscA.warpAmount",
            amount: 0.42,
        });
        assert.deepEqual(
            snapshot.sentMessages
                .filter(({ endpointID }) => ["oscAWavetablePosition", "oscAPan", "oscAWarpMode", "oscAWarpAmount", "filterCutoff"].includes(endpointID))
                .map(({ endpointID, value }) => ({ endpointID, value })),
            [
                { endpointID: "oscAWavetablePosition", value: 0.66 },
                { endpointID: "oscAPan", value: -0.18 },
                { endpointID: "oscAWarpMode", value: 3 },
                { endpointID: "oscAWarpAmount", value: 0.61 },
                { endpointID: "filterCutoff", value: 2475 },
            ],
        );
    } finally {
        await page.close();
    }
});

test("desktop custom-element wrapper detaches the keyboard when the host element is removed", async () => {
    const page = await openHarnessPage();

    try {
        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.keyboardAttachCalls?.length === 1;
        });

        await page.evaluate(() => {
            document.querySelector("cosimo-desktop-react-view")?.remove();
        });

        await page.waitForFunction(() => {
            const snapshot = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot();
            return snapshot.keyboardDetachCount === 1;
        });

        const snapshot = await getHarnessSnapshot(page);
        assert.deepEqual(snapshot.keyboardAttachCalls, [{ endpointID: "midiIn" }]);
        assert.equal(snapshot.keyboardDetachCount, 1);
    } finally {
        await page.close();
    }
});

test("shared tabs preserve manual workspace focus and automatic oscillator selection", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const workspaceTabs = page.locator('[data-role="mobile-workspace-tabs"] [role="tab"]');
        const voiceTab = workspaceTabs.nth(0);
        const fxTab = workspaceTabs.nth(1);
        const modTab = workspaceTabs.nth(2);

        await voiceTab.focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await fxTab.evaluate((element) => element.getRootNode().activeElement === element), true);
        assert.deepEqual(await workspaceTabs.evaluateAll((tabs) => (
            tabs.map((tab) => ({
                selected: tab.getAttribute("aria-selected"),
                tabIndex: tab.getAttribute("tabindex"),
            }))
        )), [
            { selected: "true", tabIndex: "-1" },
            { selected: "false", tabIndex: "0" },
            { selected: "false", tabIndex: "-1" },
        ]);

        await page.keyboard.press("End");
        assert.equal(await modTab.evaluate((element) => element.getRootNode().activeElement === element), true);
        assert.equal(await voiceTab.getAttribute("aria-selected"), "true");
        await page.keyboard.press("Home");
        assert.equal(await voiceTab.evaluate((element) => element.getRootNode().activeElement === element), true);
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Space");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-workspace-tab-fx"]')?.getAttribute("aria-selected") === "true"
        ));
        assert.equal(await fxTab.evaluate((element) => element.getRootNode().activeElement === element), true);

        await voiceTab.click();
        const oscillatorA = page.locator('[data-role="mobile-voice-tab-a"]');
        const oscillatorB = page.locator('[data-role="mobile-voice-tab-b"]');
        await oscillatorA.focus();
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-tab-b"]')?.getAttribute("aria-selected") === "true"
        ));
        assert.equal(await oscillatorB.evaluate((element) => element.getRootNode().activeElement === element), true);
        assert.equal(await oscillatorB.evaluate((element) => element.tagName), "BUTTON");
        assert.equal(await oscillatorB.locator("button").count(), 0, "The Solo control must be a sibling, not nested in the tab button.");
        assert.deepEqual(page.__cosimoDiagnostics, []);
    } finally {
        await page.close();
    }
});

test("one surface-level theme override reaches shared Voice, FX, Mod, and shell recipes", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.locator(".cosimo-surface").first().evaluate((element) => {
            element.style.setProperty("--cosimo-type-caption", "9px");
            element.style.setProperty("--cosimo-type-label", "11px");
            element.style.setProperty("--cosimo-module", "42px");
            element.style.setProperty("--cosimo-panel-bg", "rgb(12 34 56)");
            element.style.setProperty("--cosimo-radius-sm", "6px");
        });

        const workspaceTabs = page.locator('[data-role="mobile-workspace-tabs"]');
        const voicePanel = page.locator('[data-role="mobile-workspace-panel-voice"]');
        const voiceLabel = voicePanel.locator(".cosimo-label").first();
        const voiceReadout = voicePanel.locator(".cosimo-readout").first();
        await voiceLabel.waitFor();
        assert.deepEqual(await workspaceTabs.evaluate((element) => {
            const style = getComputedStyle(element);
            return { height: style.height };
        }), { height: "42px" });
        assert.equal(await voicePanel.evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(12, 34, 56)");
        assert.equal(await voiceLabel.evaluate((element) => getComputedStyle(element).fontSize), "9px");
        assert.equal(await voiceReadout.evaluate((element) => getComputedStyle(element).fontSize), "11px");
        assert.equal(
            await page.locator('[data-role="mobile-voice-solo-a"]').evaluate((element) => getComputedStyle(element).borderRadius),
            "6px",
        );

        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        const fxLabel = page.locator('[data-role="mobile-workspace-panel-fx"] .rack-knob-label').first();
        await fxLabel.waitFor();
        assert.equal(await fxLabel.evaluate((element) => getComputedStyle(element).fontSize), "11px");

        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        const modTabs = page.locator('[data-role="mobile-mod-panel-tabs"]');
        await modTabs.waitFor();
        assert.equal(await modTabs.evaluate((element) => getComputedStyle(element).height), "42px");
    } finally {
        await page.close();
    }
});

test("mobile workspace shows one tab-selected panel while all three stay mounted", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        const panels = page.locator('[data-role="mobile-workspace-panels"]');
        assert.equal(await panels.count(), 1);

        const tabList = page.locator('[data-role="mobile-workspace-tabs"]');
        assert.equal(await tabList.getAttribute("role"), "tablist");
        const sectionButtons = tabList.locator('[role="tab"]');
        assert.deepEqual(await sectionButtons.allTextContents(), ["VOICE", "FX", "MOD"]);
        assert.deepEqual(await sectionButtons.evaluateAll((buttons) => (
            buttons.map((button) => button.getAttribute("aria-selected"))
        )), ["true", "false", "false"]);
        assert.equal(await panels.locator('[data-role="mobile-workspace-panel-voice"]').count(), 1);
        // Hidden workspaces stay mounted but inert and invisible to AT.
        assert.deepEqual(await panels.locator(".mobile-workspace-panel").evaluateAll((els) => (
            els.map((el) => `${el.hasAttribute("hidden")}:${el.inert}`)
        )), ["false:false", "true:true", "true:true"]);
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return counts.filterSpectrum === 1
                && (counts.distortionHistory ?? 0) === 0
                && (counts.distortionScope ?? 0) === 0
                && counts.effectiveMsegState === 1;
        });

        await tabList.locator('[data-role="mobile-workspace-tab-fx"]').click();
        assert.deepEqual(await sectionButtons.evaluateAll((buttons) => (
            buttons.map((button) => button.getAttribute("aria-selected"))
        )), ["false", "true", "false"]);
        assert.equal(await panels.locator('[data-role="mobile-workspace-panel-fx"] [data-role="effects-rack-card"]').count(), 1);
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return (counts.filterSpectrum ?? 0) === 0
                && counts.distortionHistory === 1
                && counts.distortionScope === 1
                && counts.effectiveMsegState === 1;
        });

        await page.locator('[data-role="rack-station-filter"]').click();
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return counts.filterSpectrum === 1
                && (counts.distortionHistory ?? 0) === 0
                && (counts.distortionScope ?? 0) === 0;
        });
        await page.locator('[data-role="rack-station-chorus"]').click();
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return (counts.filterSpectrum ?? 0) === 0
                && (counts.distortionHistory ?? 0) === 0
                && (counts.distortionScope ?? 0) === 0;
        });

        await tabList.locator('[data-role="mobile-workspace-tab-mod"]').click();
        assert.deepEqual(await sectionButtons.evaluateAll((buttons) => (
            buttons.map((button) => button.getAttribute("aria-selected"))
        )), ["false", "false", "true"]);
        assert.equal(await panels.locator('[data-role="mobile-workspace-panel-mod"] [data-role="mobile-mod-workspace-pager"]').count(), 1);
        await page.waitForFunction(() => {
            const counts = window.__COSIMO_DESKTOP_HARNESS__.getSnapshot().endpointListenerCounts;
            return (counts.filterSpectrum ?? 0) === 0
                && (counts.distortionHistory ?? 0) === 0
                && (counts.distortionScope ?? 0) === 0
                && counts.effectiveMsegState === 1;
        });

        await page.evaluate(() => {
            window.__COSIMO_DESKTOP_HARNESS__.emitEffectiveMsegState({
                voiceGeneration: 12,
                hasActive: 1,
                positions: [0.72, 0.4, 0.2],
            });
        });
        // T14: the compact graph is the editable surface; its playhead line
        // carries the live progress the old preview clip showed.
        await page.waitForFunction(() => {
            const playhead = document.querySelector('[data-role="mod-source-mseg-playhead"]');
            return playhead !== null && Math.abs(Number(playhead.getAttribute("data-progress")) - 0.72) < 0.05;
        });
        await tabList.locator('[data-role="mobile-workspace-tab-voice"]').click();
        await tabList.locator('[data-role="mobile-workspace-tab-mod"]').click();
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));
        assert.ok(
            await page.evaluate(() => (
                document.querySelector('[data-role="mod-source-mseg-playhead"]') !== null
            )),
            "The globally visible MSEG activity monitor must survive tab navigation.",
        );
    } finally {
        await page.close();
    }
});

test("re-tapping each active mobile workspace tab scrolls its real panel to the top", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        for (const tab of ["voice", "fx", "mod"]) {
            const tabButton = page.locator(`[data-role="mobile-workspace-tab-${tab}"]`);
            if (await tabButton.getAttribute("aria-selected") !== "true") {
                await tabButton.click();
            }
            await page.waitForFunction((tabId) => (
                document.querySelector(`[data-role="mobile-workspace-tab-${tabId}"]`)
                    ?.getAttribute("aria-selected") === "true"
            ), tab);

            const panel = page.locator(`[data-role="mobile-workspace-panel-${tab}"]`);
            const initialScrollTop = await panel.evaluate((element) => {
                const spacer = document.createElement("div");
                spacer.style.height = `${element.clientHeight + 320}px`;
                element.append(spacer);
                element.scrollTop = element.scrollHeight;
                return element.scrollTop;
            });
            assert.ok(initialScrollTop > 0, `The ${tab} panel must accept a nonzero pre-tap scroll position.`);

            await tabButton.click();
            await page.waitForFunction((tabId) => (
                document.querySelector(`[data-role="mobile-workspace-panel-${tabId}"]`)?.scrollTop === 0
            ), tab);
        }
    } finally {
        await page.close();
    }
});

test("an active mobile workspace tab returns from detail before a second tap scrolls to the top", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const modTab = page.locator('[data-role="mobile-workspace-tab-mod"]');
        await modTab.click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-workspace-tab-mod"]')?.getAttribute("aria-selected") === "true"
        ));

        const modPanel = page.locator('[data-role="mobile-workspace-panel-mod"]');
        const mainScrollTop = await modPanel.evaluate((element) => {
            const spacer = document.createElement("div");
            spacer.style.height = `${element.clientHeight + 320}px`;
            element.append(spacer);
            element.scrollTop = element.scrollHeight;
            return element.scrollTop;
        });
        assert.ok(mainScrollTop > 0, "The Mod main panel must accept a nonzero pre-detail scroll position.");

        const railGrip = page.locator('[data-role="mobile-global-mod-rail-grip"]');
        if (await railGrip.getAttribute("aria-expanded") !== "true") {
            await railGrip.click({ position: { x: 28, y: 12 } });
        }
        await page.locator('[data-role="mobile-global-mod-rail"][data-expanded="true"]').waitFor();
        const selectedSource = page.locator('[data-role="rack-mod-source-mseg-1"]');
        await selectedSource.click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="rack-mod-source-mseg-1"]')?.getAttribute("aria-pressed") === "true"
        ));
        await selectedSource.click();
        await page.waitForFunction(() => {
            const presetBar = document.querySelector("cosimo-preset-bar");
            const backButton = presetBar?.shadowRoot?.querySelector('[data-el="shell-back"]');
            return backButton instanceof HTMLButtonElement && !backButton.disabled;
        });
        const detailScrollTop = await modPanel.evaluate((element) => element.scrollTop);
        assert.ok(detailScrollTop > 0, "Opening the Mod detail must preserve a nonzero panel position.");

        await modTab.click();
        await page.waitForFunction(() => {
            const presetBar = document.querySelector("cosimo-preset-bar");
            const backButton = presetBar?.shadowRoot?.querySelector('[data-el="shell-back"]');
            return backButton instanceof HTMLButtonElement && backButton.disabled;
        });
        assert.equal(
            await modPanel.evaluate((element) => element.scrollTop),
            detailScrollTop,
            "The first active-tab tap must return to the main screen without resetting its scroll position.",
        );

        await modTab.click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-workspace-panel-mod"]')?.scrollTop === 0
        ));
    } finally {
        await page.close();
    }
});

test("mobile workspace switching restores Voice scroll until an active-tab re-tap resets it", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        const voicePanel = page.locator('[data-role="mobile-workspace-panel-voice"]');
        const voiceScrollTop = await voicePanel.evaluate((element) => {
            const spacer = document.createElement("div");
            spacer.style.height = `${element.clientHeight + 320}px`;
            element.append(spacer);
            element.scrollTop = element.scrollHeight;
            return element.scrollTop;
        });
        assert.ok(voiceScrollTop > 0, "The Voice panel must accept a nonzero position before switching tabs.");

        await page.locator('[data-role="mobile-workspace-tab-fx"]').click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-workspace-tab-fx"]')?.getAttribute("aria-selected") === "true"
        ));
        await page.locator('[data-role="mobile-workspace-tab-voice"]').click();
        await page.waitForFunction((storedTop) => (
            document.querySelector('[data-role="mobile-workspace-panel-voice"]')?.scrollTop === storedTop
        ), voiceScrollTop);
        assert.equal(await voicePanel.evaluate((element) => element.scrollTop), voiceScrollTop);

        await page.locator('[data-role="mobile-workspace-tab-voice"]').click();
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-workspace-panel-voice"]')?.scrollTop === 0
        ));
    } finally {
        await page.close();
    }
});

test("mobile Voice stacks the full-width focused oscillator editor and filter row above a short unlabeled keyboard", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        await page.waitForSelector('[data-role="mobile-workspace-panel-voice"]');
        const renderedState = await getHarnessRenderedState(page);
        const layout = await page.evaluate(() => {
            const wavetable = document.querySelector('[data-role="mobile-voice-editor"]');
            const filter = document.querySelector('[data-role="filter-card"]');
            const keyboard = document.querySelector('[data-role="sticky-keyboard"] > section');
            const railLabel = document.querySelector('[data-role="sticky-keyboard"] .synth-control-rail > span');
            const railReadout = document.querySelector('[data-role="sticky-keyboard"] .synth-control-rail > div');

            if (!(wavetable instanceof HTMLElement)
                || !(filter instanceof HTMLElement)
                || !(keyboard instanceof HTMLElement)
                || !(railLabel instanceof HTMLElement)
                || !(railReadout instanceof HTMLElement)) {
                return null;
            }

            const wavetableRect = wavetable.getBoundingClientRect();
            const filterRect = filter.getBoundingClientRect();
            const keyboardRect = keyboard.getBoundingClientRect();

            return {
                stackedRows: filterRect.top >= wavetableRect.bottom + 8,
                alignedLeft: Math.abs(wavetableRect.left - filterRect.left) <= 1,
                wavetableWidth: wavetableRect.width,
                filterWidth: filterRect.width,
                keyboardHeight: keyboardRect.height,
                railLabelDisplay: getComputedStyle(railLabel).display,
                railReadoutDisplay: getComputedStyle(railReadout).display,
            };
        });

        assert.equal(renderedState.keyboardNoteCount, "18");
        assert.ok(layout);
        assert.equal(layout.stackedRows, true);
        assert.equal(layout.alignedLeft, true);
        assert.equal(Math.abs(layout.wavetableWidth - layout.filterWidth) <= 1, true);
        assert.equal(layout.wavetableWidth > 280 && layout.filterWidth > 280, true);
        assert.equal(layout.keyboardHeight <= 84, true);
        assert.equal(layout.railLabelDisplay, "none");
        assert.equal(layout.railReadoutDisplay, "none");
    } finally {
        await page.close();
    }
});

test("mobile workspace keeps the synth preset bar visible and contained at 320px", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 667 }),
    });

    try {
        const host = page.locator('[data-role="synth-preset-bar-host"]');
        await host.waitFor();
        const layout = await host.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const panels = document.querySelector('[data-role="mobile-workspace-panels"]');
            const presetBar = element.querySelector("cosimo-preset-bar")?.shadowRoot?.querySelector(".preset-bar");
            const presetName = element.querySelector("cosimo-preset-bar")?.shadowRoot?.querySelector('[data-el="preset-name"]');
            return {
                display: getComputedStyle(element).display,
                left: bounds.left,
                right: bounds.right,
                height: bounds.height,
                panelsTop: panels instanceof HTMLElement ? panels.getBoundingClientRect().top : null,
                presetBarHeight: presetBar instanceof HTMLElement ? presetBar.getBoundingClientRect().height : null,
                presetName: presetName?.textContent?.trim() ?? null,
            };
        });

        assert.notEqual(layout.display, "none");
        assert.equal(layout.left >= 0 && layout.right <= 320, true);
        assert.equal(layout.height, 40);
        // The compact synth composition uses the shared 40px shell-row token,
        // retiring the legacy 38px preset-bar literal (ADR-026).
        assert.equal(layout.presetBarHeight, 40);
        assert.equal(layout.panelsTop >= layout.height, true);
        // T03D: the unnamed working sound is the INIT identity.
        assert.equal(layout.presetName, "INIT");
    } finally {
        await page.close();
    }
});

test("fresh and Init desktop state show only oscillator A enabled at 0 dB", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        await page.waitForSelector('[data-role="mobile-voice-editor"][data-selected-oscillator-id="A"]');
        let snapshot = await waitForHarnessSnapshot(
            page,
            "fresh oscillator defaults",
            (candidate) => Number(candidate.parameterValues.oscAVolumeDb) === 0
                && Number(candidate.parameterValues.oscBVolumeDb) === 0
                && Number(candidate.parameterValues.oscCVolumeDb) === 0
                && Number(candidate.parameterValues.oscAMute) === 0
                && Number(candidate.parameterValues.oscBMute) === 1
                && Number(candidate.parameterValues.oscCMute) === 1,
        );
        assert.deepEqual(
            Object.fromEntries([
                "oscAVolumeDb", "oscBVolumeDb", "oscCVolumeDb",
                "oscAMute", "oscBMute", "oscCMute",
            ].map((endpointID) => [endpointID, snapshot.parameterValues[endpointID]])),
            {
                oscAVolumeDb: 0,
                oscBVolumeDb: 0,
                oscCVolumeDb: 0,
                oscAMute: 0,
                oscBMute: 1,
                oscCMute: 1,
            },
        );
        assert.equal(
            (await page.locator('[data-role="mobile-voice-tab-a"]').getAttribute("class")).includes("is-muted"),
            false,
        );
        for (const oscillatorID of ["b", "c"]) {
            assert.equal(
                (await page.locator(`[data-role="mobile-voice-tab-${oscillatorID}"]`).getAttribute("class")).includes("is-muted"),
                true,
            );
        }
        assert.equal(
            await page.locator('[data-role="mobile-voice-cell-volumeDb"]').getAttribute("aria-valuenow"),
            "0",
        );
        await clearHarnessDebugLog(page);

        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        await page.waitForSelector('[data-role="mobile-voice-editor"][data-selected-oscillator-id="B"]');
        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscBMute"),
            false,
            "Selecting an inactive tab must not toggle Mute.",
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-cell-volumeDb"]').getAttribute("aria-valuenow"),
            "0",
            "A disabled sibling retains the normal 0 dB level it will use when enabled.",
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-graph"]').evaluate((element) => getComputedStyle(element).opacity),
            "0.38",
            "The selected disabled oscillator must look disabled while remaining editable.",
        );

        await page.locator('[data-role="mobile-voice-tab-b"]').click();
        snapshot = await waitForHarnessSnapshot(
            page,
            "active-tab enable toggle",
            (candidate) => Number(candidate.parameterValues.oscBMute) === 0,
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-editor"]').getAttribute("data-selected-oscillator-id"),
            "B",
            "Enabling must not change the selection.",
        );
        assert.equal(
            (await page.locator('[data-role="mobile-voice-tab-b"]').getAttribute("class")).includes("is-muted"),
            false,
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-toolbar"]').isVisible(),
            true,
            "An enabled oscillator remains editable.",
        );
        assert.deepEqual(
            snapshot.sentMessages.filter(({ endpointID }) => (
                /^osc[ABC](Octave|Semitone|FineCents|VolumeDb|WavetablePosition|WarpAmount)$/.test(endpointID)
            )),
            [],
            "Tab actions write only the selected oscillator's Mute endpoint.",
        );

        await clickPresetBarAction(page, "init");
        await page.evaluate(() => {
            const discard = document
                .querySelector("cosimo-preset-bar")
                ?.shadowRoot
                ?.querySelector('[data-action="sound-replacement-discard"]');
            if (!(discard instanceof HTMLButtonElement)) {
                throw new Error("Discard and Init action is missing.");
            }
            discard.click();
        });
        snapshot = await waitForHarnessSnapshot(
            page,
            "Init oscillator defaults",
            (candidate) => Number(candidate.parameterValues.oscAVolumeDb) === 0
                && Number(candidate.parameterValues.oscBVolumeDb) === 0
                && Number(candidate.parameterValues.oscCVolumeDb) === 0
                && Number(candidate.parameterValues.oscAMute) === 0
                && Number(candidate.parameterValues.oscBMute) === 1
                && Number(candidate.parameterValues.oscCMute) === 1,
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-editor"]').getAttribute("data-selected-oscillator-id"),
            "B",
            "Init must not replace session-local oscillator selection.",
        );
        assert.equal(
            (await page.locator('[data-role="mobile-voice-tab-b"]').getAttribute("class")).includes("is-muted"),
            true,
        );
        assert.equal(
            await page.locator('[data-role="mobile-voice-cell-volumeDb"]').getAttribute("aria-valuenow"),
            "0",
        );
        for (const [endpointID, expectedValue] of Object.entries({
            oscAVolumeDb: 0,
            oscBVolumeDb: 0,
            oscCVolumeDb: 0,
            oscAMute: 0,
            oscBMute: 1,
            oscCMute: 1,
        })) {
            const latestWrite = [...snapshot.sentMessages]
                .reverse()
                .find((message) => message.endpointID === endpointID);
            assert.equal(Number(latestWrite?.value), expectedValue, `${endpointID} Init write`);
        }
    } finally {
        await page.close();
    }
});

test("mobile voice graph drag steers warp and index one axis at a time with a transient readout", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        const graph = page.locator('[data-role="mobile-voice-graph"]');
        await graph.waitFor({ state: "visible" });
        const box = await graph.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width * 0.5), y: box.y + (box.height * 0.62) };

        await clearHarnessDebugLog(page);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 4; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x + (step * 12), y: start.y, radiusX: 5, radiusY: 5, force: 1 }],
            });
        }

        await waitForHarnessSnapshot(
            page,
            "graph horizontal segment edits warp",
            (candidate) => candidate.sentMessages.some(({ endpointID }) => endpointID === "oscAWarpAmount"),
        );
        const readoutClass = await page
            .locator('[data-role="mobile-voice-graph-readout"]')
            .getAttribute("class");
        assert.equal(readoutClass.includes("is-hidden"), false, "The top-left overlay becomes the live readout.");
        const idleClass = await page
            .locator('[data-role="mobile-voice-wavetable-idle"]')
            .getAttribute("class");
        assert.equal(idleClass.includes("is-hidden"), true);

        let snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition"),
            false,
            "A horizontal-dominant segment must not edit Index.",
        );

        // Deliberate turn: pause past the direction window, then move up.
        await page.waitForTimeout(60);
        const turnX = start.x + 48;
        for (let step = 1; step <= 4; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: turnX, y: start.y - (step * 14), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await waitForHarnessSnapshot(
            page,
            "graph vertical segment edits index after the in-gesture switch",
            (candidate) => candidate.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition"),
        );

        const warpWritesBeforeEnd = (await getHarnessSnapshot(page)).sentMessages
            .filter(({ endpointID }) => endpointID === "oscAWarpAmount").length;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-wavetable-idle"]')?.getAttribute("class")?.includes("is-hidden") === false
        ));
        snapshot = await getHarnessSnapshot(page);
        assert.equal(
            snapshot.sentMessages.filter(({ endpointID }) => endpointID === "oscAWarpAmount").length,
            warpWritesBeforeEnd,
            "After the switch, vertical movement edits only Index.",
        );
        assert.equal(
            snapshot.gestureStarts.filter((value) => value === "oscAWarpAmount").length,
            snapshot.gestureEnds.filter((value) => value === "oscAWarpAmount").length,
            "Every warp host gesture closes exactly once.",
        );
        assert.equal(
            snapshot.gestureStarts.filter((value) => value === "oscAWavetablePosition").length,
            snapshot.gestureEnds.filter((value) => value === "oscAWavetablePosition").length,
            "Every index host gesture closes exactly once.",
        );
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("mobile voice vertical readout drag edits only the selected existing route amount under a fixed HUD", async () => {
    const seededState = normalizeModulationState({
        routes: [{
            id: "mod-route-voice-idx",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.wavetablePosition",
            amount: 0.2,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded voice route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        const cell = page.locator('[data-role="mobile-voice-cell-framePosition"]');
        await cell.waitFor({ state: "visible" });
        const box = await cell.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };

        await clearHarnessDebugLog(page);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 5; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x, y: start.y - (step * 12), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }

        const hud = page.locator('[data-role="mobile-voice-hud"]');
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.classList.contains("is-visible") === true
        ));
        assert.equal(await hud.getAttribute("data-hud-axis"), "modulation");
        const hudBox = await hud.boundingBox();
        assert.ok(hudBox);
        const hudCenterX = hudBox.x + (hudBox.width / 2);
        assert.ok(Math.abs(hudCenterX - (393 / 2)) <= 2, "The HUD pins to the top center.");
        assert.ok(hudBox.y <= 40, "The HUD sits inside the top safe area, not near the finger.");

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: start.x, y: start.y - 80, radiusX: 5, radiusY: 5, force: 1 }],
        });
        const hudBoxDuring = await hud.boundingBox();
        assert.ok(hudBoxDuring);
        assert.ok(Math.abs(hudBoxDuring.x - hudBox.x) <= 1 && Math.abs(hudBoxDuring.y - hudBox.y) <= 1,
            "The HUD never repositions during the drag.");

        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "vertical drag advanced the selected route amount",
            (candidate) => {
                const routes = readStoredModulationState(candidate).routes;
                return routes.length === 1 && Number(routes[0].amount) > 0.25;
            },
        );
        const routes = readStoredModulationState(snapshot).routes;
        assert.equal(routes.length, 1, "A vertical drag never creates or removes a route.");
        assert.equal(routes[0].targetKind, "oscA.wavetablePosition");
        assert.equal(
            snapshot.sentMessages.some(({ endpointID }) => endpointID === "oscAWavetablePosition"),
            false,
            "A vertical drag must not edit the base value.",
        );
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("mobile voice editor stays edge-to-edge without horizontal overflow from 320 to 430", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 320, height: 700 }),
    });

    try {
        for (const width of [320, 375, 390, 430]) {
            await page.setViewportSize({ width, height: 760 });
            await page.waitForSelector('[data-role="mobile-voice-editor"]');
            const overflow = await page.evaluate(() => {
                const scroller = document.scrollingElement;
                return {
                    pageOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
                    editorWidth: document.querySelector('[data-role="mobile-voice-editor"]')?.getBoundingClientRect().width ?? 0,
                };
            });
            assert.equal(overflow.pageOverflow <= 0, true, `No horizontal page scroll at ${width}px.`);
            assert.ok(overflow.editorWidth > 0);
        }
    } finally {
        await page.close();
    }
});

test("the Voice page fits without scrolling, owned drags stay scroll-free, and neutral swipes scroll an overflowing panel", async () => {
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 700 });
            await nextPage.addInitScript(() => {
                // Dock the Mod rail at its top anchor so the floating overlay
                // does not cover the Voice toolbar this test drives.
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    const swipeUp = async (x, y) => {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 6; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x, y: y - (step * 20), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const panelScrollTop = () => page.evaluate(() => (
        document.querySelector('[data-role="mobile-workspace-panel-voice"]')?.scrollTop ?? -1
    ));

    try {
        await page.waitForSelector('[data-role="mobile-voice-editor"]');
        // T05: the Voice page is an instrument surface that splits its real
        // height 50/50 — it must fit its panel with nothing left to scroll.
        const voiceOverflow = await page.evaluate(() => {
            const panel = document.querySelector('[data-role="mobile-workspace-panel-voice"]');
            return panel ? panel.scrollHeight - panel.clientHeight : -1;
        });
        assert.ok(voiceOverflow >= 0 && voiceOverflow <= 1, `The Voice page must fit its panel: overflow ${voiceOverflow}`);

        // T14: the redesigned Mod page fits its panel — the matrix can no
        // longer sit invisibly below a tall graph (no blind scrolling).
        await page.setViewportSize({ width: 393, height: 600 });
        await page.locator('[data-role="mobile-workspace-tab-mod"]').click();
        await page.waitForSelector('[data-role="mobile-mod-source-selector"]');
        const modOverflow = await page.evaluate(() => {
            const panel = document.querySelector('[data-role="mobile-workspace-panel-mod"]');
            return panel ? panel.scrollHeight - panel.clientHeight : 0;
        });
        assert.ok(modOverflow <= 40, `The redesigned Mod page must fit its panel at 600: ${modOverflow}`);

        // Neutral swipes still scroll a surface that genuinely overflows:
        // the MAPPINGS list with a real route population.
        const swipeSeededState = normalizeModulationState({
            routes: MODULATION_TARGET_OPTIONS.slice(0, 24).map((option, index) => ({
                id: `swipe-seed-${index}`,
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: (index % 3) + 1,
                polarity: "bipolar",
                targetKind: option.value,
                amount: 0.2,
                reducer: "max",
            })),
        });
        await page.evaluate((state) => {
            window.__COSIMO_DESKTOP_HARNESS__.setStoredStateValue("modulation.v6", JSON.stringify(state));
        }, swipeSeededState);
        await page.click('[data-role="mobile-mod-panel-tab-mappings"]');
        await page.waitForSelector('[data-role="mod-mappings-row"]');
        const firstRowIdentity = await page.locator('[data-role="mod-mappings-row"] .mod-mappings-row-identity').first().boundingBox();
        assert.ok(firstRowIdentity);
        await swipeUp(firstRowIdentity.x + (firstRowIdentity.width * 0.5), firstRowIdentity.y + (firstRowIdentity.height * 0.5));
        await page.waitForFunction(() => (
            (document.querySelector('[data-role="mod-mappings-list"]')?.scrollTop ?? 0) > 20
        ), null, { timeout: 3_000 });

        // Back on Voice: an owned readout drag edits its parameter and never
        // becomes panel scroll.
        await page.setViewportSize({ width: 393, height: 700 });
        await page.locator('[data-role="mobile-workspace-tab-voice"]').click();
        await page.waitForSelector('[data-role="mobile-voice-cell-framePosition"]');
        const cell = await page.locator('[data-role="mobile-voice-cell-framePosition"]').boundingBox();
        assert.ok(cell);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: cell.x + (cell.width / 2), y: cell.y + (cell.height / 2), radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 6; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{
                    x: cell.x + (cell.width / 2),
                    y: cell.y + (cell.height / 2) - (step * 20),
                    radiusX: 5,
                    radiusY: 5,
                    force: 1,
                }],
            });
            assert.equal(await panelScrollTop(), 0, "An owned readout drag must never become page scroll.");
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(650);
        assert.equal(await panelScrollTop(), 0, "No deferred scroll may follow an owned drag.");
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("mobile voice level modulation reaches the +6 dB rail from any base value", async () => {
    // Live repro: with the amp amount range copied from the parameter range
    // (-48..+6), an upward MOD drag could never lift the high limit past
    // base + 6 dB. The amount is an additive dB offset spanning +/-54.
    const seededState = normalizeModulationState({
        routes: [{
            id: "mod-route-amp-reach",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.ampGainDb",
            amount: 0,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded amp route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        const cell = page.locator('[data-role="mobile-voice-cell-volumeDb"]');
        await cell.waitFor({ state: "visible" });
        const box = await cell.boundingBox();
        assert.ok(box);
        const start = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 5; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x, y: start.y - (step * 30), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.getAttribute("data-hud-axis") === "modulation"
        ));
        const highText = await page.locator('[data-role="mobile-voice-hud-high"]').textContent();
        assert.match(
            (highText ?? "").trim(),
            /^\+?6(\.0)?\s?dB$/,
            `a large upward amount must pin the high limit to the +6 dB parameter rail, got "${highText}"`,
        );
        const sourceText = await page.locator(".mobile-voice-hud-source").textContent();
        assert.ok(
            (sourceText ?? "").includes("dB") && !(sourceText ?? "").includes("%"),
            `amp amounts read in dB, never as a percentage, got "${sourceText}"`,
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

        const snapshot = await waitForHarnessSnapshot(
            page,
            "amp amount escaped the old +6 offset cap",
            (candidate) => Number(readStoredModulationState(candidate).routes[0]?.amount ?? 0) > 6,
        );
        const amount = Number(readStoredModulationState(snapshot).routes[0].amount);
        assert.ok(amount > 6 && amount <= 54, `stored offset must exceed +6 dB within +/-54, got ${amount}`);
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("mobile voice pitch modulation is presented by the Semi cell alone and Oct/Fine stay base-only", async () => {
    // Live repro: mapping MSEG 1 -> semitones lit Oct, Semi, AND Fine on the
    // Tune page. The engine has one pitch destination; Semi alone presents it.
    const seededState = normalizeModulationState({
        routes: [{
            id: "mod-route-pitch-single",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.pitchSemitones",
            amount: 3,
            reducer: "max",
        }],
    });
    const page = await openHarnessPage({
        beforeGoto: async (nextPage) => {
            await nextPage.setViewportSize({ width: 393, height: 852 });
            await nextPage.addInitScript(() => {
                // Dock the Mod rail at its top anchor so the floating overlay
                // does not cover the Voice toolbar this test drives.
                localStorage.setItem(
                    "cosimo.mobile-global-mod-rail.position.v1",
                    JSON.stringify({ version: 2, edge: "right", normalizedY: 0 }),
                );
            });
            await nextPage.addInitScript(({ stateKey, state }) => {
                window.__COSIMO_DESKTOP_HARNESS_INITIAL__ = {
                    storedState: { [stateKey]: JSON.stringify(state) },
                };
            }, { stateKey: MODULATION_STATE_KEY, state: seededState });
        },
    });
    const cdp = await page.context().newCDPSession(page);

    try {
        await waitForHarnessSnapshot(
            page,
            "seeded pitch route",
            (candidate) => readStoredModulationState(candidate).routes.length === 1,
        );
        await page.locator('[data-role="mobile-voice-page-next"]').click();
        await page.waitForSelector('[data-role="mobile-voice-page"][data-page-name="Tune"]');

        const railState = (controlID) => page
            .locator(`[data-role="mobile-voice-cell-${controlID}"] .mobile-voice-rail`)
            .getAttribute("data-rail-state");
        assert.equal(await railState("semitone"), "mapped", "Semi presents the pitch route");
        assert.equal(await railState("octave"), "not-modulatable", "Oct never presents pitch modulation");
        assert.equal(await railState("fineCents"), "not-modulatable", "Fine never presents pitch modulation");

        const targetKindOf = (controlID) => page
            .locator(`[data-role="mobile-voice-cell-${controlID}"]`)
            .getAttribute("data-modulation-target-kind");
        assert.equal(await targetKindOf("semitone"), "oscA.pitchSemitones");
        assert.equal(await targetKindOf("octave"), null, "Oct is not a pitch drop target");
        assert.equal(await targetKindOf("fineCents"), null, "Fine is not a pitch drop target");

        await page.locator('[data-role="mobile-voice-chip-route-dot-semitone"]').waitFor({ state: "visible" });

        const octBox = await page.locator('[data-role="mobile-voice-cell-octave"]').boundingBox();
        assert.ok(octBox);
        const start = { x: octBox.x + (octBox.width / 2), y: octBox.y + (octBox.height / 2) };
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...start, radiusX: 5, radiusY: 5, force: 1 }],
        });
        for (let step = 1; step <= 5; step += 1) {
            await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x: start.x, y: start.y - (step * 14), radiusX: 5, radiusY: 5, force: 1 }],
            });
        }
        await page.waitForFunction(() => (
            document.querySelector('[data-role="mobile-voice-hud"]')?.classList.contains("is-visible") === true
        ));
        assert.equal(
            await page.locator('[data-role="mobile-voice-hud"]').getAttribute("data-hud-axis"),
            "base",
            "a vertical drag on Oct stays in the base presentation",
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(150);

        const routes = readStoredModulationState(await getHarnessSnapshot(page)).routes;
        assert.equal(routes.length, 1);
        assert.equal(Number(routes[0].amount), 3, "an Oct drag never edits the pitch route amount");
    } finally {
        await cdp.detach();
        await page.close();
    }
});

test("short compact Voice never clips the readout strip: the graph yields, the rail stays visible", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 375, height: 667 }),
    });

    try {
        const editor = page.locator('[data-role="mobile-voice-editor"]');
        await editor.waitFor();
        const clipping = await editor.evaluate((element) => {
            const editorRect = element.getBoundingClientRect();
            const toolbar = element.querySelector(".mobile-voice-toolbar");
            const rail = element.querySelector(".mobile-voice-rail");
            if (!(toolbar instanceof HTMLElement) || !(rail instanceof HTMLElement)) {
                throw new Error("The readout strip and its rail must render.");
            }
            return {
                overflow: element.scrollHeight - element.clientHeight,
                toolbarClipped: toolbar.getBoundingClientRect().bottom - editorRect.bottom,
                railClipped: rail.getBoundingClientRect().bottom - editorRect.bottom,
            };
        });
        assert.ok(
            clipping.overflow <= 0,
            `The editor's content must fit its half row; it overflows by ${clipping.overflow}px.`,
        );
        assert.ok(
            clipping.toolbarClipped <= 0.5,
            `The readout strip must sit fully inside the editor; its bottom hangs ${clipping.toolbarClipped}px past the clip edge.`,
        );
        assert.ok(
            clipping.railClipped <= 0.5,
            `The base tick / mod-range rail must stay visible; it hangs ${clipping.railClipped}px past the clip edge.`,
        );

        // The strip itself keeps its full height — the GRAPH is what gave.
        const strip = await editor.evaluate((element) => {
            const toolbar = element.querySelector(".mobile-voice-toolbar");
            const graph = element.querySelector('[data-role="mobile-voice-graph"]');
            return {
                toolbarHeight: toolbar.getBoundingClientRect().height,
                graphHeight: graph.getBoundingClientRect().height,
            };
        });
        assert.ok(Math.abs(strip.toolbarHeight - 40) <= 0.5, `the strip keeps its 40px: ${strip.toolbarHeight}`);
        assert.ok(strip.graphHeight < 180, `the graph must shrink below its old floor here: ${strip.graphHeight}`);
    } finally {
        await page.close();
    }
});

test("ADR-024 tabs: selecting an oscillator slides the panel directionally and stays instantly interactive", async () => {
    const page = await openHarnessPage({
        beforeGoto: (nextPage) => nextPage.setViewportSize({ width: 393, height: 852 }),
    });

    try {
        // This test ASSERTS the slide; the harness default is reduced-motion.
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.locator('[data-role="mobile-voice-tab-b"]').waitFor();


        // A -> B: the outgoing ghost slides LEFT, the live panel enters from
        // the right and is interactive from its first frame.
        await page.click('[data-role="mobile-voice-tab-b"]');
        const ghost = page.locator("[data-panel-ghost]");
        await ghost.waitFor({ state: "visible", timeout: 2000 });
        const ghostShift = await ghost.evaluate((element) => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                resolve(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
            }));
        }));
        assert.equal(ghostShift < 0, true, `A->B must slide the outgoing panel left, got ${ghostShift}px.`);
        assert.equal(
            await page.locator('[data-role="mobile-voice-editor"]').getAttribute("data-selected-oscillator-id"),
            "B",
            "The selection binds immediately — the slide never postpones it.",
        );
        // The ghost carries no live roles (sanitized) and leaves promptly.
        assert.equal(await ghost.locator("[data-role]").count(), 0);
        await ghost.waitFor({ state: "detached", timeout: 2000 });

        // B -> A slides the other way.
        await page.click('[data-role="mobile-voice-tab-a"]');
        const secondShift = await page.locator("[data-panel-ghost]").evaluate(
            (element) => new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    resolve(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
                }));
            }),
        );
        assert.equal(secondShift > 0, true, `B->A must slide the outgoing panel right, got ${secondShift}px.`);
    } finally {
        await page.close();
    }
});
