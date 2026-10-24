import {
    startDesktopHarnessServer,
    startStaticRepoServer,
} from "./desktop_harness_browser.mjs";
import { createSynthParameterFixture, synthParameterEndpoints } from "./synth_parameter_fixture.mjs";

export async function startIOSHarnessServer() {
    return startStaticRepoServer({ bundleTypeScript: true });
}

export async function startIOSSourceHarnessServer() {
    return startDesktopHarnessServer();
}

/**
 * Every parameter the synth's state definition opens, with ranges and defaults
 * read from the DSP source. The loaded wavetable position, table, and Glide
 * differ from their authored defaults so edits and resets have something to change.
 */
function iosFixtureHostParameters() {
    const { readParameter } = createSynthParameterFixture({
        oscAWavetablePosition: 0.28,
        oscAWavetableSelect: 0,
        glideTime: 0.15,
    });
    return synthParameterEndpoints.map(readParameter);
}

/**
 * The native side of the iPhone app as the bundled page sees it: the
 * `cmaj_*` bridge functions, Cmajor's state channel for the synth's
 * parameters and saved values, and the runtime endpoints the view listens to.
 */
function createIOSHarnessInitScript() {
    return ({ rootUrl, hostParameters, deferredParameterReads = [] }) => {
        const originalFetch = globalThis.fetch.bind(globalThis);
        const fetchedUrls = [];
        const resourceReads = [];
        const sentMessages = [];
        const storedStateWrites = [];
        const gestureStarts = [];
        const gestureEnds = [];
        const hapticEvents = [];
        const storedState = new Map();
        const endpointReplyTypes = new Map();
        const failingResources = new Map();
        const parameterValues = new Map(hostParameters.map(({ endpoint, value }) => [endpoint, value]));
        const parameterMetadata = new Map(hostParameters.map(({ endpoint, min, max, step, defaultValue }) => (
            [endpoint, { min, max, step, defaultValue }])));
        const deferredReads = new Set(deferredParameterReads);
        const pendingStateReads = new Map();
        let stateHost;
        let stateHostLoading;
        let readyNotificationCount = 0;
        let bundledFallbackRequestCount = 0;

        let runtimeState = {
            oscillatorIndex: 0,
            desiredTableIndex: 0,
            desiredIntentSerial: 1,
            serviceState: 2,
            hasActive: true,
            activeTableIndex: 0,
            activeGeneration: 1,
            hasLoading: false,
            loadingTableIndex: 0,
            loadingGeneration: 0,
            hasFailure: false,
            failedTableIndex: 0,
            failedGeneration: 0,
            failureScope: 0,
            failurePhase: 0,
            failureReasonCode: 0,
        };

        const normalisePath = (requestedPath) => {
            const pathText = typeof requestedPath === "string" ? requestedPath : String(requestedPath ?? "");
            return pathText.startsWith("/") ? pathText.slice(1) : pathText;
        };

        const addReplyType = (endpointID, replyType) => {
            const replyTypes = endpointReplyTypes.get(endpointID) ?? new Set();
            replyTypes.add(replyType);
            endpointReplyTypes.set(endpointID, replyTypes);
        };

        const removeReplyType = (endpointID, replyType) => {
            const replyTypes = endpointReplyTypes.get(endpointID);
            if (!replyTypes) {
                return;
            }

            replyTypes.delete(replyType);
            if (replyTypes.size === 0) {
                endpointReplyTypes.delete(endpointID);
            }
        };

        const deliverMessage = (type, message) => {
            globalThis.cmaj_deliverMessageFromServer?.({ type, message });
        };

        const emitEndpoint = (endpointID, value) => {
            for (const replyType of endpointReplyTypes.get(endpointID) ?? []) {
                deliverMessage(replyType, value);
            }
        };

        const emitParameterValue = (endpointID, value = parameterValues.get(endpointID) ?? 0) => {
            deliverMessage("param_value", {
                endpointID,
                value,
            });
        };

        const writeStoredValue = (key, value) => {
            storedState.set(key, value);
            storedStateWrites.push({ key, value });
        };

        globalThis.fetch = async (input, init) => {
            const url = input instanceof Request
                ? input.url
                : input instanceof URL
                    ? input.toString()
                    : String(input);
            fetchedUrls.push(url);

            const resolvedURL = new URL(url, rootUrl);
            if (resolvedURL.origin === new URL(rootUrl).origin) {
                const resourcePath = normalisePath(resolvedURL.pathname);
                if (failingResources.has(resourcePath)) {
                    return new Response(`Missing test resource ${resourcePath}`, {
                        status: failingResources.get(resourcePath),
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8",
                        },
                    });
                }
            }

            return originalFetch(input, init);
        };

        globalThis.cmaj_getPatchBootConfig = async () => {
            const response = await originalFetch(new URL("/WavetableSynth.iOS.cmajorpatch", rootUrl));
            if (!response.ok) {
                throw new Error(`Could not load iPhone patch manifest: ${response.status}`);
            }
            const manifest = await response.json();
            const boot = {
                manifest,
                preferredView: manifest.view,
                devServerURL: "",
                bundlePageURL: new URL("patch_gui/index.ios.html", rootUrl).toString(),
                bundleResourceBaseURL: rootUrl,
            };

            globalThis.__COSIMO_PATCH_BOOT = boot;
            return boot;
        };

        globalThis.cmaj_notifyHostPageReady = () => {
            readyNotificationCount += 1;
        };
        globalThis.cmaj_requestBundledFallback = () => {
            bundledFallbackRequestCount += 1;
        };
        globalThis.cmaj_triggerHaptic = async (style = "light") => {
            hapticEvents.push(String(style || "light"));
        };

        globalThis._internalReadResource = async (requestedPath) => {
            const resourcePath = normalisePath(requestedPath);
            resourceReads.push({ kind: "text", path: resourcePath });

            if (failingResources.has(resourcePath)) {
                throw new Error(`Could not read bridged resource ${resourcePath}: ${failingResources.get(resourcePath)}`);
            }

            const response = await originalFetch(new URL(resourcePath, rootUrl));

            if (!response.ok) {
                throw new Error(`Could not read bridged resource ${resourcePath}: ${response.status}`);
            }

            return response.text();
        };

        globalThis._internalReadResourceAsAudioData = async (requestedPath) => {
            const resourcePath = normalisePath(requestedPath);
            resourceReads.push({ kind: "audio-bridge", path: resourcePath });
            throw new Error(`Unexpected bridged audio request for ${resourcePath}`);
        };

        // A deferred endpoint holds every native read of it until the test
        // releases it, so the state stays open-pending as on a slow host.
        const waitForRelease = (endpoint, signal) => new Promise((resolve, reject) => {
            const waiting = pendingStateReads.get(endpoint) ?? new Set();
            const finish = () => { waiting.delete(finish); signal.removeEventListener("abort", abort); resolve(); };
            const abort = () => { waiting.delete(finish); reject(new Error("Native fixture read stopped")); };
            if (signal.aborted) { abort(); return; }
            waiting.add(finish);
            pendingStateReads.set(endpoint, waiting);
            signal.addEventListener("abort", abort, { once: true });
        });

        const getStateHost = () => stateHostLoading ??= (async () => {
            const { createMockPluginStateHost } = await import(new URL("ui/shared/mock-plugin-state-host.ts", rootUrl).href);
            stateHost = createMockPluginStateHost({
                readParameter: async (endpoint, signal) => {
                    const metadata = parameterMetadata.get(endpoint);
                    if (!metadata) throw new Error(`Missing native fixture metadata for ${endpoint}`);
                    if (deferredReads.has(endpoint)) await waitForRelease(endpoint, signal);
                    return { endpoint, value: parameterValues.get(endpoint), ...metadata };
                },
                writeParameter: (endpoint, value) => { void globalThis.cmaj_sendMessageToServer({ type: "send_value", id: endpoint, value }); },
                storedValues: { read: key => storedState.get(key), write: writeStoredValue },
                beginGesture: endpoint => gestureStarts.push(endpoint),
                endGesture: endpoint => gestureEnds.push(endpoint),
                onDefect: error => { throw error; },
            });
            stateHost.addEventListener("kit_state", body => deliverMessage("kit_state", body));
            window.addEventListener("pagehide", () => { void stateHost.stop(); }, { once: true });
            return stateHost;
        })();

        globalThis.cmaj_sendMessageToServer = async (message) => {
            const type = message?.type ?? "";

            switch (type) {
            case "kit_state":
                (await getStateHost()).sendMessageToServer(message);
                return;

            case "add_endpoint_listener":
                addReplyType(message.endpoint, message.replyType);
                return;

            case "remove_endpoint_listener":
                removeReplyType(message.endpoint, message.replyType);
                return;

            case "req_param_value":
                queueMicrotask(() => emitParameterValue(message.id));
                return;

            case "send_value": {
                const endpointID = message.id;
                const value = message.value;
                const oscillatorPositionMatch = /^osc([ABC])WavetablePosition$/.exec(endpointID);
                const oscillatorSelectMatch = /^osc([ABC])WavetableSelect$/.exec(endpointID);
                sentMessages.push({ endpointID, value });

                if (endpointID === "runtimeSyncRequest") {
                    queueMicrotask(() => emitEndpoint("runtimeState", runtimeState));
                    return;
                }

                if (endpointID === "retryDesiredTableRequest") {
                    const retryGeneration = Math.max(
                        runtimeState.activeGeneration,
                        runtimeState.loadingGeneration,
                        runtimeState.failedGeneration,
                        0,
                    ) + 1;
                    runtimeState = {
                        ...runtimeState,
                        hasFailure: false,
                        hasLoading: true,
                        loadingTableIndex: runtimeState.desiredTableIndex,
                        loadingGeneration: retryGeneration,
                    };
                    queueMicrotask(() => emitEndpoint("runtimeState", runtimeState));
                    return;
                }

                if (parameterValues.has(endpointID)) {
                    parameterValues.set(endpointID, value);
                    queueMicrotask(() => emitParameterValue(endpointID, value));
                    stateHost?.observeParameter(endpointID);
                }

                if (oscillatorPositionMatch) {
                    queueMicrotask(() => emitEndpoint("effectiveWavetablePosition", {
                        voiceGeneration: 1,
                        position: value,
                    }));
                    return;
                }

                if (oscillatorSelectMatch) {
                    const oscillatorIndex = "ABC".indexOf(oscillatorSelectMatch[1]);
                    const tableIndex = Math.max(0, Math.trunc(Number(value) || 0));
                    const nextGeneration = Math.max(
                        runtimeState.activeGeneration,
                        runtimeState.loadingGeneration,
                        runtimeState.failedGeneration,
                        0,
                    ) + 1;
                    runtimeState = {
                        ...runtimeState,
                        oscillatorIndex,
                        desiredTableIndex: tableIndex,
                        desiredIntentSerial: runtimeState.desiredIntentSerial + 1,
                        hasLoading: true,
                        loadingTableIndex: tableIndex,
                        loadingGeneration: nextGeneration,
                        hasFailure: false,
                        failedTableIndex: 0,
                        failedGeneration: 0,
                        failureScope: 0,
                        failurePhase: 0,
                        failureReasonCode: 0,
                    };
                    queueMicrotask(() => emitEndpoint("runtimeState", runtimeState));
                }

                return;
            }

            default:
                throw new Error(`The iPhone fixture host does not handle ${type} messages.`);
            }
        };

        const rectToObject = (element) => {
            if (!element) {
                return null;
            }

            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            };
        };

        const readMsegPreviewOverlay = (rootElement) => {
            const svg = rootElement?.querySelector('[data-role="mseg-preview-surface"]');

            if (!(svg instanceof SVGSVGElement)) {
                return null;
            }

            const playhead = svg.querySelector('[data-role="mseg-preview-playhead"]');
            const progressClip = svg.querySelector('[data-role="mseg-preview-progress-clip"]');
            const [, , width, height] = (svg.getAttribute("viewBox") ?? "0 0 0 0")
                .split(/\s+/)
                .map((value) => Number(value) || 0);

            return {
                width,
                height,
                playhead: playhead instanceof SVGLineElement
                    ? {
                        x1: Number(playhead.getAttribute("x1")) || 0,
                        y1: Number(playhead.getAttribute("y1")) || 0,
                        x2: Number(playhead.getAttribute("x2")) || 0,
                        y2: Number(playhead.getAttribute("y2")) || 0,
                    }
                    : null,
                progressClip: progressClip instanceof SVGRectElement
                    ? {
                        x: Number(progressClip.getAttribute("x")) || 0,
                        y: Number(progressClip.getAttribute("y")) || 0,
                        width: Number(progressClip.getAttribute("width")) || 0,
                        height: Number(progressClip.getAttribute("height")) || 0,
                    }
                    : null,
            };
        };

        const readPathEndpoints = (pathData) => {
            const tokens = String(pathData).match(/[AaCcHhLlMmQqSsTtVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
            const endpoints = [];
            let tokenIndex = 0;
            let command = null;
            let currentX = 0;
            let currentY = 0;
            let startX = 0;
            let startY = 0;

            const readNumber = () => {
                if (tokenIndex >= tokens.length) {
                    return null;
                }
                const value = Number(tokens[tokenIndex]);
                if (!Number.isFinite(value)) {
                    return null;
                }
                tokenIndex += 1;
                return value;
            };

            while (tokenIndex < tokens.length) {
                const token = tokens[tokenIndex];
                if (/^[AaCcHhLlMmQqSsTtVvZz]$/.test(token)) {
                    command = token;
                    tokenIndex += 1;
                } else if (!command) {
                    break;
                }

                switch (command) {
                case "M":
                case "m": {
                    const isRelative = command === "m";
                    let pairIndex = 0;
                    while (tokenIndex < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[tokenIndex])) {
                        const x = readNumber();
                        const y = readNumber();
                        if (!Number.isFinite(x) || !Number.isFinite(y)) {
                            break;
                        }
                        currentX = isRelative ? currentX + x : x;
                        currentY = isRelative ? currentY + y : y;
                        if (pairIndex === 0) {
                            startX = currentX;
                            startY = currentY;
                        }
                        endpoints.push({ x: currentX, y: currentY });
                        pairIndex += 1;
                    }
                    command = isRelative ? "l" : "L";
                    break;
                }
                case "L":
                case "l": {
                    const isRelative = command === "l";
                    while (tokenIndex < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[tokenIndex])) {
                        const x = readNumber();
                        const y = readNumber();
                        if (!Number.isFinite(x) || !Number.isFinite(y)) {
                            break;
                        }
                        currentX = isRelative ? currentX + x : x;
                        currentY = isRelative ? currentY + y : y;
                        endpoints.push({ x: currentX, y: currentY });
                    }
                    break;
                }
                case "H":
                case "h": {
                    const isRelative = command === "h";
                    while (tokenIndex < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[tokenIndex])) {
                        const x = readNumber();
                        if (!Number.isFinite(x)) {
                            break;
                        }
                        currentX = isRelative ? currentX + x : x;
                        endpoints.push({ x: currentX, y: currentY });
                    }
                    break;
                }
                case "V":
                case "v": {
                    const isRelative = command === "v";
                    while (tokenIndex < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[tokenIndex])) {
                        const y = readNumber();
                        if (!Number.isFinite(y)) {
                            break;
                        }
                        currentY = isRelative ? currentY + y : y;
                        endpoints.push({ x: currentX, y: currentY });
                    }
                    break;
                }
                case "C":
                case "c": {
                    const isRelative = command === "c";
                    while (tokenIndex < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[tokenIndex])) {
                        const values = Array.from({ length: 6 }, () => readNumber());
                        if (values.some((value) => !Number.isFinite(value))) {
                            break;
                        }
                        currentX = isRelative ? currentX + values[4] : values[4];
                        currentY = isRelative ? currentY + values[5] : values[5];
                        endpoints.push({ x: currentX, y: currentY });
                    }
                    break;
                }
                case "S":
                case "s":
                case "Q":
                case "q": {
                    const isRelative = command === "s" || command === "q";
                    const valueCount = 4;
                    while (tokenIndex < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[tokenIndex])) {
                        const values = Array.from({ length: valueCount }, () => readNumber());
                        if (values.some((value) => !Number.isFinite(value))) {
                            break;
                        }
                        currentX = isRelative ? currentX + values[valueCount - 2] : values[valueCount - 2];
                        currentY = isRelative ? currentY + values[valueCount - 1] : values[valueCount - 1];
                        endpoints.push({ x: currentX, y: currentY });
                    }
                    break;
                }
                case "T":
                case "t": {
                    const isRelative = command === "t";
                    while (tokenIndex < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[tokenIndex])) {
                        const x = readNumber();
                        const y = readNumber();
                        if (!Number.isFinite(x) || !Number.isFinite(y)) {
                            break;
                        }
                        currentX = isRelative ? currentX + x : x;
                        currentY = isRelative ? currentY + y : y;
                        endpoints.push({ x: currentX, y: currentY });
                    }
                    break;
                }
                case "A":
                case "a": {
                    const isRelative = command === "a";
                    while (tokenIndex < tokens.length && !/^[AaCcHhLlMmQqSsTtVvZz]$/.test(tokens[tokenIndex])) {
                        const values = Array.from({ length: 7 }, () => readNumber());
                        if (values.some((value) => !Number.isFinite(value))) {
                            break;
                        }
                        currentX = isRelative ? currentX + values[5] : values[5];
                        currentY = isRelative ? currentY + values[6] : values[6];
                        endpoints.push({ x: currentX, y: currentY });
                    }
                    break;
                }
                case "Z":
                case "z":
                    currentX = startX;
                    currentY = startY;
                    endpoints.push({ x: currentX, y: currentY });
                    command = null;
                    break;
                default:
                    tokenIndex += 1;
                    break;
                }
            }

            return endpoints;
        };

        const readRenderedCurvePoints = (pathElement, maxPoints = 24) => {
            if (!(pathElement instanceof SVGPathElement)) {
                return [];
            }

            const svgRoot = pathElement.ownerSVGElement;
            if (!(svgRoot instanceof SVGSVGElement)) {
                return [];
            }

            const rawVertices = readPathEndpoints(pathElement.getAttribute("d") ?? "");

            if (rawVertices.length === 0) {
                return [];
            }

            const vertices = [];
            const sampleCount = Math.min(maxPoints, rawVertices.length);

            for (let index = 0; index < sampleCount; index += 1) {
                const rawIndex = sampleCount === 1
                    ? 0
                    : Math.round(((rawVertices.length - 1) * index) / (sampleCount - 1));
                vertices.push(rawVertices[rawIndex]);
            }

            if (vertices.length === 0) {
                return [];
            }

            const markers = [];

            try {
                for (const point of vertices) {
                    const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    marker.setAttribute("cx", String(point.x));
                    marker.setAttribute("cy", String(point.y));
                    marker.setAttribute("r", "1");
                    marker.setAttribute("fill", "transparent");
                    marker.style.opacity = "0";
                    marker.style.pointerEvents = "none";
                    svgRoot.append(marker);
                    markers.push(marker);
                }

                return markers.map((marker) => {
                    const rect = marker.getBoundingClientRect();
                    return {
                        x: rect.left + (rect.width / 2),
                        y: rect.top + (rect.height / 2),
                    };
                });
            } finally {
                for (const marker of markers) {
                    marker.remove();
                }
            }
        };

        const readRenderedCircleCenters = (rootElement) => {
            if (!(rootElement instanceof SVGElement)) {
                return [];
            }

            return Array.from(rootElement.querySelectorAll("circle"))
                .map((circle) => ({
                    cx: circle.getBoundingClientRect().left + (circle.getBoundingClientRect().width / 2),
                    cy: circle.getBoundingClientRect().top + (circle.getBoundingClientRect().height / 2),
                }));
        };

        const isRenderedElementVisible = (element) => {
            if (!(element instanceof Element)) {
                return false;
            }

            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
                !("hidden" in element) || !element.hidden
            ) && style.display !== "none"
                && style.visibility !== "hidden"
                && style.opacity !== "0"
                && rect.width > 0
                && rect.height > 0;
        };

        const getShadowRoot = () => document.querySelector("cosimo-synth-view")?.shadowRoot ?? null;

        globalThis.__COSIMO_IOS_HARNESS__ = {
            getSnapshot() {
                return {
                    sentMessages: sentMessages.map(({ endpointID, value }) => ({ endpointID, value })),
                    storedStateWrites: storedStateWrites.map(({ key, value }) => ({ key, value })),
                    parameterValues: Object.fromEntries(parameterValues.entries()),
                    runtimeState: { ...runtimeState },
                    resourceReads: resourceReads.map((entry) => ({ ...entry })),
                    fetchedUrls: [...fetchedUrls],
                    gestureStarts: [...gestureStarts],
                    gestureEnds: [...gestureEnds],
                    hapticEvents: [...hapticEvents],
                    storedState: Object.fromEntries(storedState.entries()),
                    hostPage: globalThis.__cosimoInspectHostPage?.() ?? null,
                    readyNotificationCount,
                    bundledFallbackRequestCount,
                };
            },
            getRenderedState() {
                const shadowRoot = getShadowRoot();
                const hostPage = globalThis.__cosimoInspectHostPage?.() ?? null;
                const shell = shadowRoot?.querySelector(".ios-shell");
                const mainView = shadowRoot?.querySelector(".ios-main-view");
                const footer = shadowRoot?.querySelector(".keyboard-footer");
                const keyboard = shadowRoot?.querySelector(".keyboard");
                const noteHolder = keyboard?.shadowRoot?.querySelector(".note-holder") ?? null;
                const retryButton = shadowRoot?.querySelector('[data-role="mobile-voice-retry-load"]');
                const modalLayer = shadowRoot?.querySelector("[data-role='mseg-modal-layer']");
                const shellStyle = shell ? getComputedStyle(shell) : null;
                const shellRect = rectToObject(shell);
                const mainViewRect = rectToObject(mainView);
                const footerRect = rectToObject(footer);
                const keyboardRect = rectToObject(keyboard);
                const noteHolderRect = rectToObject(noteHolder);
                const keyboardCallback = keyboard?.callbacks instanceof Map
                    ? keyboard.callbacks.values().next().value ?? null
                    : null;
                const previewShell = shadowRoot?.querySelector(".mseg-preview-shell");
                const previewCurve = shadowRoot?.querySelector(".mseg-preview-shell .cosimo-curve-line");
                const modalCurve = shadowRoot?.querySelector("[data-role='mseg-modal-viewport'] .cosimo-curve-line");
                const modalSurface = shadowRoot?.querySelector("[data-role='mseg-modal-viewport']");
                const distortionDebug = shadowRoot?.querySelector("[data-role='distortion-graph-debug']")?.textContent ?? null;
                const readDistortionDebug = () => {
                    if (!distortionDebug) {
                        return null;
                    }

                    try {
                        return JSON.parse(distortionDebug);
                    } catch {
                        return null;
                    }
                };

                return {
                    errorText: document.body.querySelector("pre")?.textContent ?? null,
                    currentURL: window.location.href,
                    viewportMeta: document.querySelector("meta[name='viewport']")?.getAttribute("content") ?? null,
                    containerExists: Boolean(document.getElementById("cmaj-view-container")),
                    hostPageBootSource: hostPage?.bootSource ?? null,
                    hostPageViewActive: hostPage?.viewActive ?? null,
                    hasStage: Boolean(shadowRoot?.querySelector('[data-role="mobile-voice-graph"]')),
                    hasKeyboard: Boolean(keyboard),
                    hasMsegLauncher: Boolean(shadowRoot?.querySelector(".mseg-launcher")),
                    displayStatus: shadowRoot?.querySelector("[data-role='ios-voice-status']")?.textContent?.trim()
                        ?? shadowRoot?.querySelector("[data-role='mobile-voice-table-name']")?.textContent?.trim()
                        ?? null,
                    octaveReadout: shadowRoot?.querySelector("[data-role='octave-readout']")?.textContent?.trim() ?? null,
                    playModeValue: shadowRoot?.querySelector(".play-mode-select")?.value ?? null,
                    glideValue: shadowRoot?.querySelector(".glide-time-slider")?.value ?? null,
                    glideReadout: shadowRoot?.querySelector("[data-role='glide-time-readout']")?.textContent?.trim() ?? null,
                    globalTuneValue: shadowRoot?.querySelector("[data-role='ios-global-tune-knob']")?.getAttribute("aria-valuenow") ?? null,
                    globalTuneReadout: shadowRoot?.querySelector("[data-role='ios-global-tune-knob']")?.getAttribute("aria-valuetext") ?? null,
                    keyboardRootNote: keyboard?.getAttribute("root-note") ?? null,
                    keyboardNoteCount: keyboard?.getAttribute("note-count") ?? null,
                    keyboardAttachedEndpoint: keyboardCallback?.midiInputEndpointID ?? null,
                    retryHidden: retryButton === null || retryButton === undefined,
                    retryDisabled: retryButton instanceof HTMLButtonElement ? retryButton.disabled : false,
                    modalOpen: modalLayer?.dataset.open ?? null,
                    mainViewDisplay: mainView ? getComputedStyle(mainView).display : null,
                    mainViewVisibility: mainView ? getComputedStyle(mainView).visibility : null,
                    footerVisible: isRenderedElementVisible(footer),
                    shellPaddingTop: shellStyle?.paddingTop ?? null,
                    shellPaddingRight: shellStyle?.paddingRight ?? null,
                    shellPaddingBottom: shellStyle?.paddingBottom ?? null,
                    shellPaddingLeft: shellStyle?.paddingLeft ?? null,
                    distortionDriveReadout: shadowRoot?.querySelector("[data-role='distortion-drive-readout']")?.textContent?.trim() ?? null,
                    distortionMixReadout: shadowRoot?.querySelector("[data-role='distortion-mix-readout']")?.textContent?.trim() ?? null,
                    distortionGraphState: readDistortionDebug(),
                    previewShellRect: rectToObject(previewShell),
                    modalSurfaceRect: rectToObject(modalSurface),
                    previewCurvePoints: readRenderedCurvePoints(previewCurve),
                    previewPlayheadState: readMsegPreviewOverlay(shadowRoot),
                    modalCurvePoints: readRenderedCurvePoints(modalCurve),
                    modalPointCenters: readRenderedCircleCenters(modalSurface),
                    shellRect,
                    mainViewRect,
                    footerRect,
                    keyboardRect,
                    noteHolderRect,
                    footerBottomGap: shellRect && footerRect ? shellRect.bottom - footerRect.bottom : null,
                    mainToFooterGap: mainViewRect && footerRect ? footerRect.top - mainViewRect.bottom : null,
                };
            },
            clearDebugLog() {
                sentMessages.length = 0;
                storedStateWrites.length = 0;
                resourceReads.length = 0;
                fetchedUrls.length = 0;
                gestureStarts.length = 0;
                gestureEnds.length = 0;
                hapticEvents.length = 0;
            },
            setRuntimeState(nextState) {
                runtimeState = {
                    ...runtimeState,
                    ...nextState,
                };
                emitEndpoint("runtimeState", runtimeState);
            },
            /** The host changes a parameter on its own, as automation or a DAW control would. */
            setParameterValue(endpointID, value) {
                if (!parameterValues.has(endpointID)) throw new Error(`Unknown fixture parameter ${endpointID}`);
                parameterValues.set(endpointID, value);
                emitParameterValue(endpointID, value);
                stateHost?.observeParameter(endpointID);
            },
            releaseParameterRead(endpointID) {
                deferredReads.delete(endpointID);
                for (const finish of pendingStateReads.get(endpointID) ?? []) finish();
                pendingStateReads.delete(endpointID);
            },
            emitDistortionScope(nextState) {
                emitEndpoint("distortionScope", nextState);
            },
            emitDistortionHistory(nextState) {
                emitEndpoint("distortionHistory", nextState);
            },
            emitEffectiveMsegState(nextState) {
                emitEndpoint("effectiveMsegState", nextState);
            },
            /** The host restores one saved value, as a DAW does when it reloads a project. */
            setStoredStateValue(key, value) {
                if (!stateHost?.replaceStoredValue(key, () => storedState.set(key, value))) {
                    throw new Error(`The synth state does not own the saved value ${key}.`);
                }
            },
            setFailingResource(path, status = 404) {
                failingResources.set(normalisePath(path), Math.max(400, Math.trunc(Number(status) || 404)));
            },
            clearFailingResources() {
                failingResources.clear();
            },
        };
    };
}

export async function openIOSHarnessPage(browser, baseUrl, {
    viewportSize = null,
    deferredParameterReads = [],
} = {}) {
    const context = await browser.newContext({
        viewport: viewportSize ?? { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        // Same policy as the desktop harness: decorative motion (the
        // panel slide) is off by default so mid-animation transforms never
        // trip Playwright's actionability auto-scroll. A test that asserts
        // motion must opt out via page.emulateMedia({ reducedMotion:
        // "no-preference" }).
        reducedMotion: "reduce",
    });
    const page = await context.newPage();

    await page.addInitScript(createIOSHarnessInitScript(), {
        rootUrl: baseUrl,
        hostParameters: iosFixtureHostParameters(),
        deferredParameterReads,
    });
    await page.goto(new URL("patch_gui/index.ios.html", baseUrl).toString(), {
        waitUntil: "load",
    });

    return page;
}

export async function openIOSSourceHarnessPage(browser, baseUrl, {
    viewportSize = { width: 390, height: 844 },
    storedState = {},
} = {}) {
    const context = await browser.newContext({
        viewport: viewportSize,
        hasTouch: true,
        isMobile: true,
        reducedMotion: "reduce",
    });
    try {
        const page = await context.newPage();

        await page.goto(new URL("tests/helpers/module_test_shell.html", baseUrl).toString(), {
            waitUntil: "load",
        });
        await page.evaluate(async (initialStoredState) => {
            const mountPoint = document.getElementById("mount");
            if (!(mountPoint instanceof HTMLElement)) {
                throw new Error("Source-composed iPhone mount point is missing.");
            }

            document.documentElement.style.width = "100%";
            document.documentElement.style.height = "100%";
            document.body.style.width = "100%";
            document.body.style.height = "100%";
            mountPoint.style.width = "100%";
            mountPoint.style.height = "100%";
            mountPoint.style.padding = "0";

            const [{ MockPatchConnection }, { createIOSPatchView }] = await Promise.all([
                import("/ui/shared/patch-connection-mock.ts"),
                import("/ui/ios/patch-view-entry.tsx"),
            ]);
            const manifestResponse = await fetch("/WavetableSynth.iOS.cmajorpatch");
            if (!manifestResponse.ok) {
                throw new Error(`Could not load source-composed iPhone manifest: ${manifestResponse.status}`);
            }
            const patchConnection = new MockPatchConnection(await manifestResponse.json());
            // Cmajor's PianoKeyboard exposes its shadow root as `root`; the iPhone keyboard binds touches there.
            Object.defineProperty(patchConnection.utilities.PianoKeyboard.prototype, "root", {
                configurable: true,
                get() {
                    return this.shadowRoot;
                },
            });
            for (const [key, value] of Object.entries(initialStoredState)) {
                patchConnection.setStoredStateValue(key, value);
            }
            globalThis.__COSIMO_IOS_SOURCE_HARNESS__ = {
                getSnapshot: () => patchConnection.getDebugSnapshot(),
            };
            mountPoint.replaceChildren(createIOSPatchView(patchConnection));
        }, storedState);

        return page;
    } catch (cause) {
        await context.close().catch(() => {});
        throw cause;
    }
}

export async function closeIOSHarnessPage(page) {
    await page.context().close();
}

/**
 * Waits until the view is mounted and its Voice controls report the expected
 * host state: "ready" once the synth state has opened, "loading" while a
 * deferred parameter read holds it. Throws the host page's error instead.
 */
export async function waitForIOSHarnessReady(page, { controls = "ready" } = {}) {
    const outcome = await page.waitForFunction((expectedState) => {
        const errorText = document.getElementById("cmaj-error-text")?.textContent;
        if (errorText) return { errorText };
        const hostState = document.querySelector("cosimo-synth-view")?.shadowRoot
            ?.querySelector(".play-mode-select")?.getAttribute("data-host-state");
        return hostState === expectedState ? { errorText: null } : false;
    }, controls);
    const { errorText } = await outcome.jsonValue();
    if (errorText) throw new Error(`The iPhone host page failed: ${errorText}`);
}

export async function waitForIOSSourceHarnessReady(page) {
    try {
        await page.waitForFunction(() => Boolean(
            document.querySelector("cosimo-synth-view")?.shadowRoot
                ?.querySelector(".mseg-preview-button"),
        ), undefined, { timeout: 5_000 });
    } catch (cause) {
        const rendered = await page.evaluate(() => {
            const view = document.querySelector("cosimo-synth-view");
            return {
                bodyText: document.body.textContent?.trim() ?? "",
                hasView: view !== null,
                errorText: view?.shadowRoot?.querySelector("pre")?.textContent?.trim() ?? "",
                shadowElementNames: Array.from(view?.shadowRoot?.querySelectorAll("*") ?? [])
                    .slice(-12)
                    .map((element) => element.tagName),
            };
        });
        throw new Error(`Source-composed iPhone did not render: ${JSON.stringify(rendered)}`, { cause });
    }
}

export async function getIOSHarnessSnapshot(page) {
    return page.evaluate(() => window.__COSIMO_IOS_HARNESS__.getSnapshot());
}

export async function getIOSHarnessRenderedState(page) {
    return page.evaluate(() => window.__COSIMO_IOS_HARNESS__.getRenderedState());
}

export async function getIOSSourceHarnessSnapshot(page) {
    return page.evaluate(() => window.__COSIMO_IOS_SOURCE_HARNESS__.getSnapshot());
}

export async function clearIOSHarnessDebugLog(page) {
    await page.evaluate(() => {
        window.__COSIMO_IOS_HARNESS__.clearDebugLog();
    });
}

export async function setIOSHarnessRuntimeState(page, nextState) {
    await page.evaluate((state) => {
        window.__COSIMO_IOS_HARNESS__.setRuntimeState(state);
    }, nextState);
}

export async function setIOSHarnessParameterValue(page, endpointID, value) {
    await page.evaluate(({ nextEndpointID, nextValue }) => {
        window.__COSIMO_IOS_HARNESS__.setParameterValue(nextEndpointID, nextValue);
    }, {
        nextEndpointID: endpointID,
        nextValue: value,
    });
}

export async function releaseIOSHarnessParameterRead(page, endpointID) {
    await page.evaluate((nextEndpointID) => {
        window.__COSIMO_IOS_HARNESS__.releaseParameterRead(nextEndpointID);
    }, endpointID);
}

export async function emitIOSHarnessDistortionScope(page, nextState) {
    await page.evaluate((state) => {
        window.__COSIMO_IOS_HARNESS__.emitDistortionScope(state);
    }, nextState);
}

export async function emitIOSHarnessDistortionHistory(page, nextState) {
    await page.evaluate((state) => {
        window.__COSIMO_IOS_HARNESS__.emitDistortionHistory(state);
    }, nextState);
}

export async function emitIOSHarnessEffectiveMsegState(page, nextState) {
    await page.evaluate((state) => {
        window.__COSIMO_IOS_HARNESS__.emitEffectiveMsegState(state);
    }, nextState);
}

export async function setIOSStoredStateValue(page, key, value) {
    await page.evaluate(({ nextKey, nextValue }) => {
        window.__COSIMO_IOS_HARNESS__.setStoredStateValue(nextKey, nextValue);
    }, {
        nextKey: key,
        nextValue: value,
    });
}

export async function setIOSHarnessFailingResource(page, resourcePath, status = 404) {
    await page.evaluate(({ nextResourcePath, nextStatus }) => {
        window.__COSIMO_IOS_HARNESS__.setFailingResource(nextResourcePath, nextStatus);
    }, {
        nextResourcePath: resourcePath,
        nextStatus: status,
    });
}

export async function clearIOSHarnessFailingResources(page) {
    await page.evaluate(() => {
        window.__COSIMO_IOS_HARNESS__.clearFailingResources();
    });
}
