import { startStaticRepoServer } from "./desktop_harness_browser.mjs";

export async function startIOSHarnessServer() {
    return startStaticRepoServer();
}

export function createIOSHarnessInitScript(baseUrl) {
    return ({ rootUrl }) => {
        const originalFetch = globalThis.fetch.bind(globalThis);
        const fetchedUrls = [];
        const resourceReads = [];
        const sentMessages = [];
        const gestureStarts = [];
        const gestureEnds = [];
        const hapticEvents = [];
        const endpointMessages = [];
        const storedState = new Map();
        const endpointReplyTypes = new Map();
        const failingResources = new Map();
        const parameterValues = new Map([
            ["wavetablePosition", 0.28],
            ["wavetableSelect", 0],
            ["playMode", 0],
            ["glideTime", 0.15],
            ["pan", 0],
            ["distortionDriveDb", 12],
            ["distortionKnee", 0.35],
            ["distortionWet", 0],
            ["distortionWetHPHz", 40],
            ["distortionWetLPHz", 18000],
        ]);
        let readyNotificationCount = 0;
        let bundledFallbackRequestCount = 0;

        let runtimeState = {
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
        let cachedManifest = null;

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
            endpointMessages.push({ endpointID, value });
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

        const emitStoredStateValue = (key) => {
            deliverMessage("state_key_value", {
                key,
                value: storedState.get(key),
            });
        };

        const status = {
            manifest: null,
            details: {
                inputs: [
                    { endpointID: "midiIn", purpose: "event" },
                    {
                        endpointID: "wavetablePosition",
                        purpose: "parameter",
                        annotation: { name: "Wavetable Position", min: 0, max: 1, init: 0 },
                    },
                    {
                        endpointID: "wavetableSelect",
                        purpose: "parameter",
                        annotation: { name: "Wavetable Select", min: 0, max: 255, init: 0 },
                    },
                    {
                        endpointID: "playMode",
                        purpose: "parameter",
                        annotation: { name: "Voice Mode", min: 0, max: 2, init: 0 },
                    },
                    {
                        endpointID: "glideTime",
                        purpose: "parameter",
                        annotation: { name: "Glide Time", min: 0, max: 2, init: 0 },
                    },
                    {
                        endpointID: "pan",
                        purpose: "parameter",
                        annotation: { name: "Pan", min: -1, max: 1, init: 0 },
                    },
                    {
                        endpointID: "distortionDriveDb",
                        purpose: "parameter",
                        annotation: { name: "Distortion Drive", min: 0, max: 36, init: 12 },
                    },
                    {
                        endpointID: "distortionKnee",
                        purpose: "parameter",
                        annotation: { name: "Distortion Knee", min: 0, max: 1, init: 0.35 },
                    },
                    {
                        endpointID: "distortionWet",
                        purpose: "parameter",
                        annotation: { name: "Distortion Mix", min: 0, max: 1, init: 0 },
                    },
                    {
                        endpointID: "distortionWetHPHz",
                        purpose: "parameter",
                        annotation: { name: "Distortion Wet HP", min: 20, max: 4000, init: 40 },
                    },
                    {
                        endpointID: "distortionWetLPHz",
                        purpose: "parameter",
                        annotation: { name: "Distortion Wet LP", min: 20, max: 20000, init: 18000 },
                    },
                ],
            },
        };

        const ensureManifest = async () => {
            if (cachedManifest) {
                return cachedManifest;
            }

            const response = await originalFetch(new URL("/WavetableSynth.iOS.cmajorpatch", rootUrl));
            if (!response.ok) {
                throw new Error(`Could not load iPhone patch manifest: ${response.status}`);
            }

            cachedManifest = await response.json();
            status.manifest = cachedManifest;
            return cachedManifest;
        };

        globalThis.fetch = async (input, init) => {
            const url = input instanceof Request
                ? input.url
                : input instanceof URL
                    ? input.toString()
                    : String(input);
            fetchedUrls.push(url);

            try {
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
            } catch {
                // Ignore parse failures and fall through to the real fetch.
            }

            return originalFetch(input, init);
        };

        globalThis.cmaj_getPatchBootConfig = async () => {
            const manifest = await ensureManifest();
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

        globalThis.cmaj_sendMessageToServer = async (message) => {
            const type = message?.type ?? "";

            switch (type) {
            case "req_status":
                await ensureManifest();
                queueMicrotask(() => deliverMessage("status", status));
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

            case "send_gesture_start":
                gestureStarts.push(message.id);
                return;

            case "send_gesture_end":
                gestureEnds.push(message.id);
                return;

            case "req_full_state":
                queueMicrotask(() => deliverMessage(message.replyType, Object.fromEntries(storedState.entries())));
                return;

            case "req_state_value":
                queueMicrotask(() => emitStoredStateValue(message.key));
                return;

            case "send_state_value":
                storedState.set(message.key, message.value);
                queueMicrotask(() => emitStoredStateValue(message.key));
                return;

            case "send_value": {
                const endpointID = message.id;
                const value = message.value;
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

                if (
                    endpointID === "wavetablePosition"
                    || endpointID === "wavetableSelect"
                    || endpointID === "playMode"
                    || endpointID === "glideTime"
                ) {
                    parameterValues.set(endpointID, value);
                    queueMicrotask(() => emitParameterValue(endpointID, value));
                }

                if (endpointID === "wavetablePosition") {
                    queueMicrotask(() => emitEndpoint("effectiveWavetablePosition", {
                        voiceGeneration: 1,
                        position: value,
                    }));
                    return;
                }

                if (endpointID === "wavetableSelect") {
                    const tableIndex = Math.max(0, Math.trunc(Number(value) || 0));
                    const nextGeneration = Math.max(
                        runtimeState.activeGeneration,
                        runtimeState.loadingGeneration,
                        runtimeState.failedGeneration,
                        0,
                    ) + 1;
                    runtimeState = {
                        ...runtimeState,
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
                return;
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
                    const valueCount = command === "S" || command === "s" ? 4 : 4;
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
                    parameterValues: Object.fromEntries(parameterValues.entries()),
                    runtimeState: { ...runtimeState },
                    resourceReads: resourceReads.map((entry) => ({ ...entry })),
                    fetchedUrls: [...fetchedUrls],
                    gestureStarts: [...gestureStarts],
                    gestureEnds: [...gestureEnds],
                    hapticEvents: [...hapticEvents],
                    endpointMessages: endpointMessages.map(({ endpointID, value }) => ({ endpointID, value })),
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
                const keyboardHost = shadowRoot?.querySelector(".keyboard-host");
                const keyboard = shadowRoot?.querySelector(".keyboard");
                const noteHolder = keyboard?.shadowRoot?.querySelector(".note-holder") ?? null;
                const retryButton = shadowRoot?.querySelector(".table-retry-button");
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
                    hasStage: Boolean(shadowRoot?.querySelector(".wavetable-stage")),
                    hasKeyboard: Boolean(keyboard),
                    hasMsegLauncher: Boolean(shadowRoot?.querySelector(".mseg-launcher")),
                    displayStatus: shadowRoot?.querySelector("[data-role='display-status']")?.textContent?.trim() ?? null,
                    bankReadout: shadowRoot?.querySelector(".bank-readout")?.textContent?.trim() ?? null,
                    octaveReadout: shadowRoot?.querySelector("[data-role='octave-readout']")?.textContent?.trim() ?? null,
                    playModeValue: shadowRoot?.querySelector(".play-mode-select")?.value ?? null,
                    glideValue: shadowRoot?.querySelector(".glide-time-slider")?.value ?? null,
                    glideReadout: shadowRoot?.querySelector("[data-role='glide-time-readout']")?.textContent?.trim() ?? null,
                    keyboardRootNote: keyboard?.getAttribute("root-note") ?? null,
                    keyboardNoteCount: keyboard?.getAttribute("note-count") ?? null,
                    keyboardAttachedEndpoint: keyboardCallback?.midiInputEndpointID ?? null,
                    retryHidden: retryButton?.hidden ?? null,
                    retryDisabled: retryButton instanceof HTMLButtonElement ? retryButton.disabled : null,
                    modalOpen: modalLayer?.dataset.open ?? null,
                    mainViewDisplay: mainView ? getComputedStyle(mainView).display : null,
                    mainViewVisibility: mainView ? getComputedStyle(mainView).visibility : null,
                    footerVisible: isRenderedElementVisible(footer),
                    shellPaddingTop: shellStyle?.paddingTop ?? null,
                    shellPaddingRight: shellStyle?.paddingRight ?? null,
                    shellPaddingBottom: shellStyle?.paddingBottom ?? null,
                    shellPaddingLeft: shellStyle?.paddingLeft ?? null,
                    msegDepthValue: shadowRoot?.querySelector(".mseg-depth-slider")?.value ?? null,
                    msegDepthReadout: shadowRoot?.querySelector("[data-role='mseg-depth-readout']")?.textContent?.trim() ?? null,
                    distortionDriveReadout: shadowRoot?.querySelector("[data-role='distortion-drive-readout']")?.textContent?.trim() ?? null,
                    distortionMixReadout: shadowRoot?.querySelector("[data-role='distortion-mix-readout']")?.textContent?.trim() ?? null,
                    distortionGraphState: readDistortionDebug(),
                    previewShellRect: rectToObject(previewShell),
                    modalSurfaceRect: rectToObject(modalSurface),
                    previewCurvePoints: readRenderedCurvePoints(previewCurve),
                    modalCurvePoints: readRenderedCurvePoints(modalCurve),
                    modalPointCenters: readRenderedCircleCenters(modalSurface),
                    shellRect,
                    mainViewRect,
                    footerRect,
                    keyboardRect,
                    keyboardHostRect: rectToObject(keyboardHost),
                    noteHolderRect,
                    footerBottomGap: shellRect && footerRect ? shellRect.bottom - footerRect.bottom : null,
                    mainToFooterGap: mainViewRect && footerRect ? footerRect.top - mainViewRect.bottom : null,
                };
            },
            clearDebugLog() {
                sentMessages.length = 0;
                resourceReads.length = 0;
                fetchedUrls.length = 0;
                gestureStarts.length = 0;
                gestureEnds.length = 0;
                hapticEvents.length = 0;
                endpointMessages.length = 0;
            },
            setRuntimeState(nextState) {
                runtimeState = {
                    ...runtimeState,
                    ...nextState,
                };
                emitEndpoint("runtimeState", runtimeState);
            },
            setParameterValue(endpointID, value, emitEndpointDirectly = false) {
                parameterValues.set(endpointID, value);
                emitParameterValue(endpointID, value);

                if (emitEndpointDirectly) {
                    emitEndpoint(endpointID, value);
                }
            },
            emitDistortionScope(nextState) {
                emitEndpoint("distortionScope", nextState);
            },
            emitDistortionHistory(nextState) {
                emitEndpoint("distortionHistory", nextState);
            },
            setStoredStateValue(key, value) {
                storedState.set(key, value);
                emitStoredStateValue(key);
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

export async function openIOSHarnessPage(browser, baseUrl, { viewportSize = null } = {}) {
    const context = await browser.newContext({
        viewport: viewportSize ?? { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
    });
    const page = await context.newPage();

    await page.addInitScript(createIOSHarnessInitScript(baseUrl), { rootUrl: baseUrl });
    await page.goto(new URL("patch_gui/index.ios.html", baseUrl).toString(), {
        waitUntil: "load",
    });

    return page;
}

export async function closeIOSHarnessPage(page) {
    await page.context().close();
}

export async function waitForIOSHarnessReady(page) {
    await page.waitForFunction(() => Boolean(window.__COSIMO_IOS_HARNESS__));
    await page.waitForFunction(() => Boolean(document.querySelector("cosimo-synth-view")));
    await page.waitForTimeout(250);
}

export async function getIOSHarnessSnapshot(page) {
    return page.evaluate(() => window.__COSIMO_IOS_HARNESS__.getSnapshot());
}

export async function getIOSHarnessRenderedState(page) {
    return page.evaluate(() => window.__COSIMO_IOS_HARNESS__.getRenderedState());
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

export async function setIOSHarnessParameterValue(page, endpointID, value, emitEndpoint = false) {
    await page.evaluate(({ nextEndpointID, nextValue, shouldEmitEndpoint }) => {
        window.__COSIMO_IOS_HARNESS__.setParameterValue(nextEndpointID, nextValue, shouldEmitEndpoint);
    }, {
        nextEndpointID: endpointID,
        nextValue: value,
        shouldEmitEndpoint: emitEndpoint,
    });
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
