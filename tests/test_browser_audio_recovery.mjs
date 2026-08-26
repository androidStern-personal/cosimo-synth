import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium, devices, webkit } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repoRoot, "build", "web");
const requestedBrowserEngine = process.argv.find((argument) => (
    argument === "chromium" || argument === "webkit"
)) ?? process.env.COSIMO_WEB_BROWSER;
const browserEngines = requestedBrowserEngine
    ? [requestedBrowserEngine]
    : ["chromium", "webkit"];
const headless = !process.argv.includes("--headed");
const chromiumExecutablePath = process.argv
    .find((argument) => argument.startsWith("--chromium-executable="))
    ?.slice("--chromium-executable=".length)
    ?? process.env.COSIMO_CHROMIUM_EXECUTABLE_PATH;
const browsers = new Map();
const webOrigin = "http://localhost";

function contentType(filePath) {
    const extension = path.extname(filePath);
    if (extension === ".html") return "text/html; charset=utf-8";
    if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
    if (extension === ".json") return "application/json; charset=utf-8";
    if (extension === ".svg") return "image/svg+xml";
    if (extension === ".ttf") return "font/ttf";
    if (extension === ".wav") return "audio/wav";
    return "application/octet-stream";
}

async function serveGeneratedWeb(route) {
    try {
        const requestUrl = new URL(route.request().url());
        const relativePath = decodeURIComponent(
            requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1),
        );
        const filePath = path.resolve(webRoot, relativePath);
        if (path.relative(webRoot, filePath).startsWith("..")) {
            await route.fulfill({ status: 403, body: "Forbidden" });
            return;
        }
        await route.fulfill({
            body: await fs.readFile(filePath),
            contentType: contentType(filePath),
            headers: { "cache-control": "no-store" },
        });
    } catch (error) {
        const notFound = error && typeof error === "object" && error.code === "ENOENT";
        await route.fulfill({
            status: notFound ? 404 : 500,
            body: notFound ? "Not found" : String(error),
        });
    }
}

async function installLifecycleProbe(page) {
    await page.addInitScript(() => {
        let audioContext = null;
        let reportedState = null;
        let hidden = false;
        let sessionState = "active";
        let resumePolicy = "allow";
        let trustedGesture = false;
        let gestureResumeCount = 0;
        let resumeCallCount = 0;
        let suspendCallCount = 0;
        let workletConnectCount = 0;
        let workletDisconnectCount = 0;
        let workletNodeCount = 0;
        const workletNodes = new WeakSet();

        const audioSession = new EventTarget();
        Object.defineProperties(audioSession, {
            state: { get: () => sessionState },
            type: {
                get() { return this._type ?? "ambient"; },
                set(value) { this._type = String(value); },
            },
        });
        Object.defineProperty(navigator, "audioSession", {
            configurable: true,
            value: audioSession,
        });
        Object.defineProperties(document, {
            hidden: { configurable: true, get: () => hidden },
            visibilityState: {
                configurable: true,
                get: () => hidden ? "hidden" : "visible",
            },
        });

        const nativeState = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, "state")?.get;
        const nativeResume = AudioContext.prototype.resume;
        const nativeSuspend = AudioContext.prototype.suspend;
        if (!nativeState) throw new Error("BaseAudioContext.state is unavailable.");

        const NativeAudioWorkletNode = globalThis.AudioWorkletNode;
        globalThis.AudioWorkletNode = new Proxy(NativeAudioWorkletNode, {
            construct(target, argumentsList, newTarget) {
                audioContext ??= argumentsList[0];
                if (!Object.hasOwn(audioContext, "state")) {
                    Object.defineProperty(audioContext, "state", {
                        configurable: true,
                        get: () => reportedState ?? Reflect.apply(nativeState, audioContext, []),
                    });
                }
                const node = Reflect.construct(target, argumentsList, newTarget);
                workletNodes.add(node);
                workletNodeCount += 1;
                return node;
            },
        });

        AudioContext.prototype.suspend = function suspend() {
            if (this === audioContext) suspendCallCount += 1;
            return Reflect.apply(nativeSuspend, this, []);
        };
        AudioContext.prototype.resume = function resume() {
            if (this !== audioContext) return Reflect.apply(nativeResume, this, []);
            resumeCallCount += 1;
            if (!trustedGesture && resumePolicy === "reject") {
                return Promise.reject(new DOMException("A gesture is required.", "NotAllowedError"));
            }
            if (trustedGesture) gestureResumeCount += 1;
            return Reflect.apply(nativeResume, this, []);
        };

        const nativeConnect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function connect(...argumentsList) {
            if (workletNodes.has(this)) workletConnectCount += 1;
            return Reflect.apply(nativeConnect, this, argumentsList);
        };
        const nativeDisconnect = AudioNode.prototype.disconnect;
        AudioNode.prototype.disconnect = function disconnect(...argumentsList) {
            if (workletNodes.has(this)) workletDisconnectCount += 1;
            return Reflect.apply(nativeDisconnect, this, argumentsList);
        };

        const markTrustedGesture = (event) => {
            if (!event.isTrusted) return;
            if (event.type === "pointerdown" && event.pointerType !== "mouse") return;
            if (event.type === "pointerup" && event.pointerType === "mouse") return;
            trustedGesture = true;
            setTimeout(() => { trustedGesture = false; }, 0);
        };
        document.addEventListener("pointerdown", markTrustedGesture, { capture: true });
        document.addEventListener("pointerup", markTrustedGesture, { capture: true });

        const nativeContextState = () => audioContext
            ? Reflect.apply(nativeState, audioContext, [])
            : null;
        const waitForNativeState = async (expected) => {
            for (let poll = 0; poll < 100; poll += 1) {
                if (nativeContextState() === expected) return;
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            throw new Error(`AudioContext did not become ${expected}.`);
        };
        const snapshot = () => ({
            audioContextCurrentTime: audioContext?.currentTime ?? null,
            audioContextState: audioContext?.state ?? null,
            gestureResumeCount,
            nativeAudioContextState: nativeContextState(),
            resumeCallCount,
            sessionState,
            suspendCallCount,
            workletConnectCount,
            workletDisconnectCount,
            workletNodeCount,
        });
        const dispatchLeave = (signal) => {
            if (signal === "blur") globalThis.dispatchEvent(new Event("blur"));
            if (signal === "pagehide") {
                globalThis.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
            }
            if (signal === "visibility") {
                hidden = true;
                document.dispatchEvent(new Event("visibilitychange"));
            }
            if (signal === "audio-session") {
                sessionState = "interrupted";
                audioSession.dispatchEvent(new Event("statechange"));
            }
        };
        const dispatchReturn = (signal) => {
            if (signal === "focus") globalThis.dispatchEvent(new Event("focus"));
            if (signal === "pageshow") {
                globalThis.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
            }
            if (signal === "visibility") {
                hidden = false;
                document.dispatchEvent(new Event("visibilitychange"));
            }
            if (signal === "audio-session") {
                sessionState = "active";
                audioSession.dispatchEvent(new Event("statechange"));
            }
        };

        globalThis.__COSIMO_T45_LIFECYCLE_PROBE__ = {
            clearReportedState() { reportedState = null; },
            async leave(signal) {
                if (signal === "audio-context") {
                    reportedState = null;
                    await Reflect.apply(nativeSuspend, audioContext, []);
                    return snapshot();
                }
                dispatchLeave(signal);
                await Reflect.apply(nativeSuspend, audioContext, []);
                await waitForNativeState("suspended");
                reportedState = "running";
                return snapshot();
            },
            async leaveCombined() {
                dispatchLeave("blur");
                dispatchLeave("pagehide");
                dispatchLeave("visibility");
                dispatchLeave("audio-session");
                await Reflect.apply(nativeSuspend, audioContext, []);
                await waitForNativeState("suspended");
                reportedState = "running";
                return snapshot();
            },
            returnCombined() {
                sessionState = "active";
                audioSession.dispatchEvent(new Event("statechange"));
                hidden = false;
                document.dispatchEvent(new Event("visibilitychange"));
                globalThis.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
                globalThis.dispatchEvent(new Event("focus"));
            },
            returnWith(signal) { dispatchReturn(signal); },
            setSessionState(state) {
                sessionState = state;
                audioSession.dispatchEvent(new Event("statechange"));
            },
            setResumePolicy(policy) { resumePolicy = policy; },
            snapshot,
        };
    });
}

function observeFailures(page) {
    const failures = [];
    page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => failures.push(`page: ${error.stack ?? error.message}`));
    page.on("requestfailed", (request) => failures.push(`request: ${request.url()}`));
    return () => assert.deepEqual(failures, []);
}

async function openStartedPage(browserEngine) {
    const context = await browsers.get(browserEngine).newContext({ ...devices["iPhone 13"] });
    await context.route(`${webOrigin}/**`, serveGeneratedWeb);
    const page = await context.newPage();
    const assertNoFailures = observeFailures(page);
    await installLifecycleProbe(page);
    await page.goto(`${webOrigin}/?test=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.__COSIMO_WEB_POC__?.getSnapshot().phase === "ready", null, {
        timeout: 30_000,
    });
    await page.locator("#cosimo-start-overlay").click();
    await page.waitForFunction(() => {
        const host = globalThis.__COSIMO_WEB_POC__?.getSnapshot();
        return host?.phase === "running" && host.hasActiveTable && host.audioWorkletBlockCount >= 256;
    }, null, { timeout: 30_000 });
    await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.setParameter("macro1", 0.731));
    await page.waitForFunction(() => {
        const hostValue = globalThis.__COSIMO_WEB_POC__.getSnapshot().parameterValues.macro1;
        const persistedValue = JSON.parse(
            localStorage.getItem("cosimo.web.patch-state.v2") ?? "{}",
        )?.sound?.parameters?.macro1;
        return Math.abs(Number(hostValue) - 0.731) < 0.000001
            && Math.abs(Number(persistedValue) - 0.731) < 0.000001;
    });
    await page.evaluate(() => {
        const keyboard = document.querySelector("cosimo-desktop-react-view")?.shadowRoot
            ?.querySelector("cosimo-react-desktop-keyboard");
        if (!keyboard) throw new Error("The production keyboard is unavailable.");
        let noteDownCount = 0;
        let noteUpCount = 0;
        const soundingNotes = new Set();
        keyboard.addEventListener("note-down", (event) => {
            noteDownCount += 1;
            soundingNotes.add(Number(event.detail.note));
        });
        keyboard.addEventListener("note-up", (event) => {
            noteUpCount += 1;
            soundingNotes.delete(Number(event.detail.note));
        });
        globalThis.__COSIMO_T45_KEYBOARD_PROBE__ = {
            snapshot: () => ({
                currentKeyboardNoteCount: keyboard.currentKeyboardNotes?.size ?? null,
                currentTouchCount: keyboard.currentTouches?.size ?? null,
                noteDownCount,
                noteUpCount,
                soundingNotes: [...soundingNotes].sort((left, right) => left - right),
            }),
        };
    });
    await assertAudible(page, "pre-interruption baseline");
    await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.resetAudioMetrics());
    return { assertNoFailures, context, page };
}

async function captureIdentity(page) {
    return page.evaluate(async () => {
        const host = globalThis.__COSIMO_WEB_POC__.getSnapshot();
        return {
            audioRecoveryAttemptCount: host.audioRecoveryAttemptCount,
            audioRecoveryPhase: host.audioRecoveryPhase,
            audioSessionType: host.audioSessionType,
            heldNoteCount: host.heldNoteCount,
            keyboard: globalThis.__COSIMO_T45_KEYBOARD_PROBE__.snapshot(),
            lifecycle: globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.snapshot(),
            parameterSentinel: host.parameterValues.macro1,
            persistedPatchState: localStorage.getItem("cosimo.web.patch-state.v2"),
            runtimeSessionIds: host.latestRuntimeStates
                .map((runtimeState) => runtimeState?.dspSessionId ?? null),
            storedState: JSON.stringify(await globalThis.__COSIMO_WEB_POC__.storedState()),
        };
    });
}

async function assertIdentityPreserved(page, baseline, label) {
    const current = await captureIdentity(page);
    assert.equal(current.audioRecoveryPhase, "active", label);
    assert.equal(current.audioSessionType, "playback", label);
    assert.equal(current.heldNoteCount, 0, label);
    assert.equal(current.keyboard.currentKeyboardNoteCount, 0, label);
    assert.equal(current.keyboard.currentTouchCount, 0, label);
    assert.deepEqual(current.keyboard.soundingNotes, [], label);
    assert.equal(current.lifecycle.workletNodeCount, 1, label);
    assert.equal(current.lifecycle.workletNodeCount, baseline.lifecycle.workletNodeCount, label);
    assert.equal(current.lifecycle.workletConnectCount, baseline.lifecycle.workletConnectCount, label);
    assert.equal(current.lifecycle.workletDisconnectCount, baseline.lifecycle.workletDisconnectCount, label);
    assert.deepEqual(current.runtimeSessionIds, baseline.runtimeSessionIds, label);
    assert.equal(baseline.parameterSentinel, 0.731, label);
    assert.equal(current.parameterSentinel, baseline.parameterSentinel, label);
    assert.equal(current.persistedPatchState, baseline.persistedPatchState, label);
    assert.equal(current.storedState, baseline.storedState, label);
}

async function noteBounds(page) {
    const result = await page.evaluate(() => {
        const view = document.querySelector("cosimo-desktop-react-view");
        const root = view?.shadowRoot;
        const keyboard = root?.querySelector("cosimo-react-desktop-keyboard");
        const note = keyboard
            ?.shadowRoot?.querySelector("#note48");
        const rectangle = note?.getBoundingClientRect();
        return {
            bounds: rectangle ? {
                height: rectangle.height,
                width: rectangle.width,
                x: rectangle.x,
                y: rectangle.y,
            } : null,
            hasKeyboard: Boolean(keyboard),
            hasKeyboardRoot: Boolean(keyboard?.shadowRoot),
            hasView: Boolean(view),
            hasViewRoot: Boolean(root),
            keyboardHtml: keyboard?.shadowRoot?.innerHTML.slice(0, 500) ?? null,
        };
    });
    assert.ok(result.bounds, `Expected the production middle-C key: ${JSON.stringify(result)}`);
    return result.bounds;
}

async function pressMiddleC(page) {
    const bounds = await noteBounds(page);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.8);
    await page.mouse.down();
    await page.waitForFunction(() => {
        const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
        return root?.querySelector("cosimo-react-desktop-keyboard")
            ?.shadowRoot?.querySelector("#note48")?.classList.contains("active") === true;
    });
}

async function waitForMiddleCRelease(page) {
    await page.waitForFunction(() => {
        const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
        return root?.querySelector("cosimo-react-desktop-keyboard")
            ?.shadowRoot?.querySelector("#note48")?.classList.contains("active") === false;
    });
}

async function waitForRecovery(page) {
    await page.waitForFunction(() => {
        const host = globalThis.__COSIMO_WEB_POC__.getSnapshot();
        const lifecycle = globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.snapshot();
        return host.audioRecoveryPhase === "active"
            && lifecycle.nativeAudioContextState === "running"
            && host.audioWorkletBlockCount >= 256;
    }, null, { timeout: 5_000 });
    await page.evaluate(() => globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.clearReportedState());
}

async function waitForAudioSilence(page, label) {
    try {
        await page.waitForFunction(() => {
            const host = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            const silent = host.heldNoteCount === 0
                && host.audioPeakCurrent <= 0.00001
                && host.audioRms <= 0.00001;
            globalThis.__COSIMO_T45_SILENT_POLLS__ = silent
                ? (globalThis.__COSIMO_T45_SILENT_POLLS__ ?? 0) + 1
                : 0;
            return globalThis.__COSIMO_T45_SILENT_POLLS__ >= 8;
        }, null, { timeout: 10_000 });
    } catch (error) {
        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        throw new Error(`${label} did not drain to silence: ${JSON.stringify(snapshot)}`, { cause: error });
    } finally {
        await page.evaluate(() => delete globalThis.__COSIMO_T45_SILENT_POLLS__);
    }
}

async function assertAudible(page, label) {
    await page.evaluate(() => {
        const host = globalThis.__COSIMO_WEB_POC__;
        host.resetAudioMetrics();
        host.noteOn(48, 100);
    });
    try {
        await page.waitForFunction(() => {
            const host = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            return host.audioWorkletBlockCount >= 256 && host.audioPeak > 0.00001;
        }, null, { timeout: 5_000 });
    } catch (error) {
        const snapshot = await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.getSnapshot());
        throw new Error(`${label}: ${JSON.stringify(snapshot)}`, { cause: error });
    } finally {
        await page.evaluate(() => globalThis.__COSIMO_WEB_POC__.noteOff(48));
    }
    await waitForAudioSilence(page, label);
}

async function returnWithGestureRequired(page) {
    await page.evaluate(async () => {
        const probe = globalThis.__COSIMO_T45_LIFECYCLE_PROBE__;
        probe.setResumePolicy("reject");
        await probe.leave("pagehide");
        probe.returnWith("pageshow");
    });
    await page.waitForFunction(() => (
        globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRecoveryPhase === "blocked"
    ));
}

before(async () => {
    const [sourceHost, builtHost, sourceLifecycle, builtLifecycle, trackedDesktopApp, builtDesktopApp] = await Promise.all([
        fs.readFile(path.join(repoRoot, "web", "cosimo-web-host.js"), "utf8"),
        fs.readFile(path.join(webRoot, "cosimo-web-host.js"), "utf8"),
        fs.readFile(path.join(repoRoot, "web", "browser-audio-lifecycle.mjs"), "utf8"),
        fs.readFile(path.join(webRoot, "browser-audio-lifecycle.mjs"), "utf8"),
        fs.readFile(path.join(repoRoot, "patch_gui", "desktop", "app.js"), "utf8"),
        fs.readFile(path.join(webRoot, "patch_gui", "desktop", "app.js"), "utf8"),
    ]);
    assert.equal(builtHost, sourceHost, "Build the current web host before running browser recovery proof.");
    assert.equal(builtLifecycle, sourceLifecycle, "Build the current lifecycle module before browser proof.");
    assert.equal(builtDesktopApp, trackedDesktopApp, "Copy the current production desktop bundle before browser proof.");
    assert.match(builtDesktopApp, /cosimo-browser-audio-leave/, "The generated UI must include held-input release.");
    assert.match(builtDesktopApp, /cosimo-browser-audio-return/, "The generated UI must restore auto-preview after recovery.");
    for (const browserEngine of browserEngines) {
        const launchedBrowser = browserEngine === "webkit"
            ? await webkit.launch({ headless })
            : await chromium.launch({
                headless,
                ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
            });
        browsers.set(browserEngine, launchedBrowser);
    }
});

after(async () => {
    await Promise.all(Array.from(browsers.values(), (launchedBrowser) => launchedBrowser.close()));
});

for (const browserEngine of browserEngines) {
test(`[${browserEngine}] each lifecycle signal releases input and recovers the existing audio graph`, async () => {
    const harness = await openStartedPage(browserEngine);
    const baseline = await captureIdentity(harness.page);
    const scenarios = [
        ["blur", "focus"],
        ["visibility", "visibility"],
        ["pagehide", "pageshow"],
        ["audio-session", "audio-session"],
        ["audio-context", null],
    ];

    try {
        for (const [leaveSignal, returnSignal] of scenarios) {
            const label = `${leaveSignal}/${returnSignal ?? "statechange"}`;
            await pressMiddleC(harness.page);
            const interrupted = await harness.page.evaluate((signal) => (
                globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.leave(signal)
            ), leaveSignal);
            await waitForMiddleCRelease(harness.page);
            await harness.page.mouse.up();

            if (returnSignal) {
                assert.equal(interrupted.audioContextState, "running", label);
                assert.equal(interrupted.nativeAudioContextState, "suspended", label);
                if (leaveSignal === "audio-session") {
                    assert.equal(interrupted.sessionState, "interrupted", label);
                }
                if (leaveSignal === "blur") {
                    const beforeInactive = await harness.page.evaluate(() => ({
                        attempts: globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRecoveryAttemptCount,
                    }));
                    await harness.page.evaluate(() => {
                        globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.setSessionState("inactive");
                    });
                    const afterInactive = await harness.page.evaluate(() => ({
                        attempts: globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRecoveryAttemptCount,
                        phase: globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRecoveryPhase,
                        lifecycle: globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.snapshot(),
                    }));
                    assert.equal(afterInactive.phase, "away", label);
                    assert.equal(afterInactive.attempts, beforeInactive.attempts, label);
                    assert.equal(afterInactive.lifecycle.nativeAudioContextState, "suspended", label);
                }
                await harness.page.evaluate(() => globalThis.__COSIMO_WEB_POC__.resetAudioMetrics());
                await harness.page.evaluate(({ signal, reactivateSession }) => {
                    const probe = globalThis.__COSIMO_T45_LIFECYCLE_PROBE__;
                    probe.returnWith(signal);
                    if (reactivateSession) probe.setSessionState("active");
                }, { signal: returnSignal, reactivateSession: leaveSignal === "blur" });
            }
            await waitForRecovery(harness.page);
            await assertAudible(harness.page, label);
            const recoveredLifecycle = await harness.page.evaluate(() => (
                globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.snapshot()
            ));
            assert.ok(recoveredLifecycle.audioContextCurrentTime > interrupted.audioContextCurrentTime, label);
            assert.equal(recoveredLifecycle.sessionState, "active", label);
            await assertIdentityPreserved(harness.page, baseline, label);
        }

        const awayPage = await harness.context.newPage();
        try {
            await awayPage.setContent("<title>Away</title><main>Away</main>");
            for (let cycle = 1; cycle <= 3; cycle += 1) {
                await awayPage.bringToFront();
                const interrupted = await harness.page.evaluate(() => (
                    globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.leaveCombined()
                ));
                assert.equal(interrupted.sessionState, "interrupted", `top-level cycle ${cycle}`);
                await harness.page.waitForTimeout(250);
                await harness.page.bringToFront();
                await harness.page.evaluate(() => (
                    globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.returnCombined()
                ));
                await waitForRecovery(harness.page);
                await assertAudible(harness.page, `top-level cycle ${cycle}`);
                const recoveredLifecycle = await harness.page.evaluate(() => (
                    globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.snapshot()
                ));
                assert.ok(
                    recoveredLifecycle.audioContextCurrentTime > interrupted.audioContextCurrentTime,
                    `top-level cycle ${cycle}`,
                );
                assert.equal(recoveredLifecycle.sessionState, "active", `top-level cycle ${cycle}`);
                await assertIdentityPreserved(harness.page, baseline, `top-level cycle ${cycle}`);
            }
        } finally {
            await awayPage.close();
        }
        harness.assertNoFailures();
    } finally {
        await harness.context.close();
    }
});

test(`[${browserEngine}] a trusted control touch retries audio without swallowing the control`, async () => {
    const harness = await openStartedPage(browserEngine);
    const baseline = await captureIdentity(harness.page);

    try {
        await returnWithGestureRequired(harness.page);

        const fxTab = harness.page.locator('[data-role="mobile-workspace-tab-fx"]');
        const bounds = await fxTab.boundingBox();
        assert.ok(bounds, "Expected the FX control.");
        await harness.page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await harness.page.waitForFunction(() => {
            const root = document.querySelector("cosimo-desktop-react-view")?.shadowRoot;
            return globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRecoveryPhase === "active"
                && root?.querySelector('[data-role="mobile-workspace-tab-fx"]')
                    ?.getAttribute("aria-selected") === "true"
                && document.getElementById("cosimo-audio-recovery-notice")?.hidden === false;
        }, null, { timeout: 5_000 });

        await assertAudible(harness.page, "control gesture recovery");
        await assertIdentityPreserved(harness.page, baseline, "control gesture recovery");

        const recovery = await harness.page.evaluate(() => ({
            host: globalThis.__COSIMO_WEB_POC__.getSnapshot(),
            lifecycle: globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.snapshot(),
        }));
        assert.equal(recovery.host.audioRecoveryAttemptCount - baseline.audioRecoveryAttemptCount, 3);
        assert.equal(recovery.lifecycle.gestureResumeCount - baseline.lifecycle.gestureResumeCount, 1);
        assert.equal(recovery.lifecycle.resumeCallCount - baseline.lifecycle.resumeCallCount, 3);
        assert.equal(recovery.lifecycle.suspendCallCount - baseline.lifecycle.suspendCallCount, 3);
        harness.assertNoFailures();
    } finally {
        await harness.context.close();
    }
});

test(`[${browserEngine}] a mouse note retries audio and releases normally`, async () => {
    const harness = await openStartedPage(browserEngine);
    const baseline = await captureIdentity(harness.page);

    try {
        await returnWithGestureRequired(harness.page);

        await pressMiddleC(harness.page);
        await harness.page.waitForFunction(() => {
            const host = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            const notice = document.getElementById("cosimo-audio-recovery-notice");
            return host.audioRecoveryPhase === "active"
                && notice?.hidden === false;
        }, null, { timeout: 5_000 });
        await harness.page.mouse.up();
        await waitForMiddleCRelease(harness.page);
        await harness.page.waitForFunction((previousNoteUpCount) => (
            globalThis.__COSIMO_T45_KEYBOARD_PROBE__.snapshot().noteUpCount
                === previousNoteUpCount + 1
        ), baseline.keyboard.noteUpCount);
        await assertIdentityPreserved(harness.page, baseline, "mouse note recovery");

        const recovery = await harness.page.evaluate(() => ({
            host: globalThis.__COSIMO_WEB_POC__.getSnapshot(),
            keyboard: globalThis.__COSIMO_T45_KEYBOARD_PROBE__.snapshot(),
            lifecycle: globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.snapshot(),
        }));
        assert.equal(recovery.keyboard.noteDownCount - baseline.keyboard.noteDownCount, 1);
        assert.equal(recovery.keyboard.noteUpCount - baseline.keyboard.noteUpCount, 1);
        assert.equal(recovery.host.audioRecoveryAttemptCount - baseline.audioRecoveryAttemptCount, 2);
        assert.equal(recovery.lifecycle.gestureResumeCount - baseline.lifecycle.gestureResumeCount, 1);
        assert.equal(recovery.lifecycle.resumeCallCount - baseline.lifecycle.resumeCallCount, 2);
        assert.equal(recovery.lifecycle.suspendCallCount - baseline.lifecycle.suspendCallCount, 2);

        await harness.page.evaluate(() => globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.leave("audio-context"));
        await harness.page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRecoveryPhase === "blocked"
            && document.getElementById("cosimo-audio-recovery-notice")?.hidden === true
        ));
        harness.assertNoFailures();
    } finally {
        await harness.page.mouse.up().catch(() => {});
        await harness.context.close();
    }
});

test(`[${browserEngine}] a recovery note asks the player to play again`, async () => {
    const harness = await openStartedPage(browserEngine);
    const baseline = await captureIdentity(harness.page);

    try {
        await returnWithGestureRequired(harness.page);

        const bounds = await noteBounds(harness.page);
        await harness.page.evaluate(() => {
            const keyboardRoot = document.querySelector("cosimo-desktop-react-view")?.shadowRoot
                ?.querySelector("cosimo-react-desktop-keyboard")?.shadowRoot;
            if (!keyboardRoot) throw new Error("The production keyboard is unavailable.");
            keyboardRoot.addEventListener("touchend", () => {
                globalThis.__COSIMO_T45_RELEASE_AT_TOUCH_END__ =
                    globalThis.__COSIMO_T45_KEYBOARD_PROBE__.snapshot();
            }, { once: true });
        });
        await harness.page.touchscreen.tap(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height * 0.8,
        );
        await harness.page.waitForFunction(() => (
            globalThis.__COSIMO_T45_RELEASE_AT_TOUCH_END__ !== undefined
        ));
        const releaseAtTouchEnd = await harness.page.evaluate(() => (
            globalThis.__COSIMO_T45_RELEASE_AT_TOUCH_END__
        ));
        assert.equal(releaseAtTouchEnd.noteDownCount, baseline.keyboard.noteDownCount + 1);
        assert.equal(releaseAtTouchEnd.noteUpCount, baseline.keyboard.noteUpCount + 1);
        assert.equal(releaseAtTouchEnd.currentKeyboardNoteCount, 0);
        assert.equal(releaseAtTouchEnd.currentTouchCount, 0);
        assert.deepEqual(releaseAtTouchEnd.soundingNotes, []);

        await harness.page.waitForFunction(() => {
            const host = globalThis.__COSIMO_WEB_POC__.getSnapshot();
            const notice = document.getElementById("cosimo-audio-recovery-notice");
            return host.audioRecoveryPhase === "active"
                && notice?.hidden === false
                && notice.textContent?.trim() === "Audio restarted — play again";
        }, null, { timeout: 5_000 });
        await waitForMiddleCRelease(harness.page);
        await assertIdentityPreserved(harness.page, baseline, "recovery note");

        const recovery = await harness.page.evaluate(() => ({
            host: globalThis.__COSIMO_WEB_POC__.getSnapshot(),
            keyboard: globalThis.__COSIMO_T45_KEYBOARD_PROBE__.snapshot(),
            lifecycle: globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.snapshot(),
        }));
        assert.equal(recovery.keyboard.noteDownCount - baseline.keyboard.noteDownCount, 1);
        assert.equal(recovery.keyboard.noteUpCount - baseline.keyboard.noteUpCount, 1);
        assert.equal(recovery.host.audioRecoveryAttemptCount - baseline.audioRecoveryAttemptCount, 3);
        assert.equal(recovery.lifecycle.gestureResumeCount - baseline.lifecycle.gestureResumeCount, 1);
        assert.equal(recovery.lifecycle.resumeCallCount - baseline.lifecycle.resumeCallCount, 3);
        assert.equal(recovery.lifecycle.suspendCallCount - baseline.lifecycle.suspendCallCount, 3);

        await harness.page.touchscreen.tap(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height * 0.8,
        );
        await harness.page.waitForFunction((previousCounts) => {
            const keyboard = globalThis.__COSIMO_T45_KEYBOARD_PROBE__.snapshot();
            return keyboard.noteDownCount === previousCounts.noteDownCount + 2
                && keyboard.noteUpCount === previousCounts.noteUpCount + 2
                && document.getElementById("cosimo-audio-recovery-notice")?.hidden === true;
        }, {
            noteDownCount: baseline.keyboard.noteDownCount,
            noteUpCount: baseline.keyboard.noteUpCount,
        }, { timeout: 5_000 });
        assert.equal(await harness.page.locator("#cosimo-audio-recovery-notice").isHidden(), true);
        await waitForMiddleCRelease(harness.page);
        await assertIdentityPreserved(harness.page, baseline, "second touchscreen note");
        harness.assertNoFailures();
    } finally {
        await harness.context.close();
    }
});

if (browserEngine === "chromium") {
test("[chromium] lifting the recovery touch does not dismiss the play-again notice", async () => {
    const harness = await openStartedPage("chromium");
    const baseline = await captureIdentity(harness.page);
    const cdp = await harness.context.newCDPSession(harness.page);

    try {
        await returnWithGestureRequired(harness.page);
        await harness.page.evaluate(() => {
            globalThis.__COSIMO_T45_LIFECYCLE_PROBE__.setResumePolicy("allow");
        });
        const bounds = await noteBounds(harness.page);
        const point = {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height * 0.8,
        };

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...point, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await harness.page.waitForFunction(() => (
            globalThis.__COSIMO_WEB_POC__.getSnapshot().audioRecoveryPhase === "active"
            && document.getElementById("cosimo-audio-recovery-notice")?.hidden === false
        ));
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForMiddleCRelease(harness.page);
        assert.equal(await harness.page.locator("#cosimo-audio-recovery-notice").isVisible(), true);

        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ ...point, radiusX: 5, radiusY: 5, force: 1 }],
        });
        await harness.page.waitForFunction(() => (
            document.getElementById("cosimo-audio-recovery-notice")?.hidden === true
        ));
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitForMiddleCRelease(harness.page);
        await assertIdentityPreserved(harness.page, baseline, "touch notice dismissal");
        harness.assertNoFailures();
    } finally {
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
        }).catch(() => {});
        await cdp.detach().catch(() => {});
        await harness.context.close();
    }
});
}

}
