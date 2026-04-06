import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import cssText from "./styles.css?inline";

import {
    createDefaultCurveProfile,
    createDefaultCurveLabState,
    evaluateCurveProfile,
    formatCurveTargetOutput,
    getCurveFamilyDefinition,
    getCurveTargetDefinition,
    getCurveTargetSummary,
    invertCurveProfile,
    sampleCurveProfile,
    sanitizeCurveLabState,
    type CurveLabState,
    type CurveProfile,
} from "../shared/curve-lab";

const CURVE_LAB_SESSION_KEY = "cosimo.desktop.dev-curve-lab.v2";
const PREVIEW_SAMPLE_COUNT = 96;
const PREVIEW_SAMPLES = [0, 0.25, 0.5, 0.75, 1] as const;
const CURVE_LAB_NATIVE_STATE_EVENT = "cosimo-desktop-curve-lab-state";
const CURVE_LAB_POPUP_NAME = "cosimo-curve-lab";
const CURVE_LAB_POPUP_WIDTH = 440;
const CURVE_LAB_POPUP_HEIGHT = 860;
const DESKTOP_WINDOW_KIND_KEY = "__COSIMO_DESKTOP_WINDOW_KIND__";
const CURVE_LAB_WINDOW_KIND = "curve-lab";

type NativeCurveLabBridge = {
    openWindow: () => Promise<unknown>;
    closeWindow: () => Promise<unknown>;
    getState: () => Promise<string>;
    setState: (serializedState: string) => Promise<unknown>;
};

declare global {
    interface Window {
        __COSIMO_DESKTOP_WINDOW_KIND__?: string;
        cosimo_desktop_curve_lab_openWindow?: () => Promise<unknown>;
        cosimo_desktop_curve_lab_closeWindow?: () => Promise<unknown>;
        cosimo_desktop_curve_lab_getState?: () => Promise<string>;
        cosimo_desktop_curve_lab_setState?: (serializedState: string) => Promise<unknown>;
    }
}

function joinClasses(...classes: Array<string | null | undefined | false>) {
    return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function loadCurveLabState() {
    if (typeof window === "undefined") {
        return createDefaultCurveLabState();
    }

    try {
        const rawValue = window.sessionStorage.getItem(CURVE_LAB_SESSION_KEY);

        if (!rawValue) {
            return createDefaultCurveLabState();
        }

        return {
            ...sanitizeCurveLabState(JSON.parse(rawValue) as CurveLabState),
            isOpen: false,
        };
    } catch {
        return createDefaultCurveLabState();
    }
}

function persistCurveLabState(state: CurveLabState) {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.sessionStorage.setItem(CURVE_LAB_SESSION_KEY, JSON.stringify({
            ...sanitizeCurveLabState(state),
            isOpen: false,
        }));
    } catch {
        // Ignore storage failures in dev-only tooling.
    }
}

function serializeSharedCurveLabState(state: CurveLabState) {
    return JSON.stringify(sanitizeCurveLabState(state));
}

function parseSharedCurveLabState(rawValue: unknown) {
    if (typeof rawValue === "string") {
        const trimmedValue = rawValue.trim();

        if (!trimmedValue) {
            return null;
        }

        try {
            return sanitizeCurveLabState(JSON.parse(trimmedValue) as CurveLabState);
        } catch {
            return null;
        }
    }

    if (rawValue && typeof rawValue === "object") {
        return sanitizeCurveLabState(rawValue as CurveLabState);
    }

    return null;
}

function getNativeCurveLabBridge(globalObject: Window = window): NativeCurveLabBridge | null {
    if (
        typeof globalObject.cosimo_desktop_curve_lab_openWindow !== "function"
        || typeof globalObject.cosimo_desktop_curve_lab_closeWindow !== "function"
        || typeof globalObject.cosimo_desktop_curve_lab_getState !== "function"
        || typeof globalObject.cosimo_desktop_curve_lab_setState !== "function"
    ) {
        return null;
    }

    return {
        openWindow: globalObject.cosimo_desktop_curve_lab_openWindow.bind(globalObject),
        closeWindow: globalObject.cosimo_desktop_curve_lab_closeWindow.bind(globalObject),
        getState: globalObject.cosimo_desktop_curve_lab_getState.bind(globalObject),
        setState: globalObject.cosimo_desktop_curve_lab_setState.bind(globalObject),
    };
}

function isCurveLabStandaloneWindow(globalObject: Window = window) {
    return globalObject[DESKTOP_WINDOW_KIND_KEY] === CURVE_LAB_WINDOW_KIND;
}

function mergeSharedCurveLabState(previousState: CurveLabState, nextState: CurveLabState) {
    return {
        ...previousState,
        activeTargetId: nextState.activeTargetId,
        profiles: nextState.profiles,
        isOpen: nextState.isOpen,
    };
}

function buildCurveLabPopupFeatures() {
    const left = Math.max(
        0,
        Math.round(window.screenX + Math.max(0, window.outerWidth - CURVE_LAB_POPUP_WIDTH - 48)),
    );
    const top = Math.max(
        0,
        Math.round(window.screenY + 56),
    );

    return [
        "popup=yes",
        "resizable=yes",
        "scrollbars=yes",
        `width=${CURVE_LAB_POPUP_WIDTH}`,
        `height=${CURVE_LAB_POPUP_HEIGHT}`,
        `left=${left}`,
        `top=${top}`,
    ].join(",");
}

function ensureCurveLabPopupDocument(popupWindow: Window) {
    const document = popupWindow.document;
    document.title = "Cosimo Curve Lab";

    if (!document.getElementById("cosimo-curve-lab-styles")) {
        const style = document.createElement("style");
        style.id = "cosimo-curve-lab-styles";
        style.textContent = `${cssText.replaceAll(":host", "html, body, #cosimo-curve-lab-root")}

html, body, #cosimo-curve-lab-root {
    margin: 0;
    width: 100%;
    min-height: 100%;
    background: #050812;
}

body {
    overflow: auto;
}
`;
        document.head.appendChild(style);
    }

    let mountPoint = document.getElementById("cosimo-curve-lab-root");

    if (!mountPoint) {
        mountPoint = document.createElement("div");
        mountPoint.id = "cosimo-curve-lab-root";
        document.body.replaceChildren(mountPoint);
    }

    return mountPoint;
}

function CurvePreview({
    targetId,
    profile,
}: {
    targetId: string;
    profile: CurveProfile;
}) {
    const samples = useMemo(
        () => sampleCurveProfile(targetId, profile, PREVIEW_SAMPLE_COUNT),
        [profile, targetId],
    );
    const pathData = useMemo(() => (
        samples
            .map(({ normalizedInput, normalizedOutput }, index) => {
                const x = 20 + (normalizedInput * 220);
                const y = 172 - (normalizedOutput * 144);
                return `${index === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`;
            })
            .join(" ")
    ), [samples]);

    return (
        <div className="grid gap-3 rounded-[22px] border border-white/10 bg-black/42 p-4 shadow-[0_22px_40px_rgba(0,0,0,0.32)]">
            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.24em] text-slate-400/80">
                <span>Curve Preview</span>
                <span>{getCurveTargetDefinition(targetId).previewRangeLabel ?? "0% -> 100%"}</span>
            </div>

            <svg
                data-role="curve-lab-preview"
                viewBox="0 0 260 190"
                className="h-[190px] w-full overflow-visible rounded-[18px] bg-[linear-gradient(180deg,rgba(18,25,40,0.94),rgba(4,7,16,0.98))]"
                aria-label="Curve lab preview"
            >
                <defs>
                    <linearGradient id="curve-lab-preview-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(121,224,255,0.24)" />
                        <stop offset="100%" stopColor="rgba(121,224,255,0.02)" />
                    </linearGradient>
                </defs>
                <rect x="20" y="28" width="220" height="144" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
                <line x1="20" x2="240" y1="172" y2="28" stroke="rgba(255,255,255,0.10)" strokeDasharray="6 6" />
                {[0.25, 0.5, 0.75].map((sample) => {
                    const x = 20 + (sample * 220);
                    const y = 172 - (sample * 144);
                    return (
                        <g key={sample}>
                            <line x1={x} x2={x} y1="28" y2="172" stroke="rgba(255,255,255,0.06)" />
                            <line x1="20" x2="240" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
                        </g>
                    );
                })}
                <path d={`${pathData} L 240 172 L 20 172 Z`} fill="url(#curve-lab-preview-fill)" />
                <path d={pathData} fill="none" stroke="rgba(122,226,255,0.98)" strokeWidth="3" strokeLinecap="round" />
                <text x="20" y="16" fill="rgba(226,232,240,0.52)" fontSize="10">Top of drag</text>
                <text x="20" y="186" fill="rgba(226,232,240,0.52)" fontSize="10">Bottom of drag</text>
                <text x="214" y="16" fill="rgba(226,232,240,0.52)" fontSize="10">Response</text>
            </svg>

            <div className="grid grid-cols-5 gap-2">
                {PREVIEW_SAMPLES.map((sample) => {
                    const normalizedOutput = evaluateCurveProfile(targetId, profile, sample);
                    return (
                        <div
                            key={sample}
                            className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2"
                        >
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400/80">
                                {Math.round(sample * 100)}%
                            </div>
                            <div className="mt-1 font-mono text-[12px] tracking-[0.12em] text-cyan-100">
                                {formatCurveTargetOutput(targetId, normalizedOutput)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CurveCoefficientControl({
    coefficientKey,
    label,
    value,
    min,
    max,
    step,
    formatValue,
    onChange,
}: {
    coefficientKey: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    formatValue?: (value: number) => string;
    onChange: (nextValue: number) => void;
}) {
    const displayValue = formatValue?.(value) ?? value.toFixed(step < 1 ? 2 : 0);

    return (
        <label className="grid gap-2 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400/85">{label}</span>
                <span className="font-mono text-[12px] tracking-[0.12em] text-cyan-100">{displayValue}</span>
            </div>
            <input
                data-role={`curve-lab-coefficient-${coefficientKey}`}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                className="cosimo-range"
                onChange={(event) => onChange(clamp(Number(event.currentTarget.value), min, max))}
            />
        </label>
    );
}

function CurveLabPanel({
    state,
    onStateChange,
    onClose,
}: {
    state: CurveLabState;
    onStateChange: (updater: (previousState: CurveLabState) => CurveLabState) => void;
    onClose?: () => void;
}) {
    const activeTarget = getCurveTargetDefinition(state.activeTargetId);
    const profile = state.profiles[activeTarget.id];
    const { family } = getCurveTargetSummary(activeTarget.id, profile);

    const setProfile = (nextProfile: CurveProfile) => {
        onStateChange((previousState) => ({
            ...previousState,
            profiles: {
                ...previousState.profiles,
                [activeTarget.id]: nextProfile,
            },
        }));
    };

    return (
        <section
            data-role="curve-lab-panel"
            className="flex min-h-[calc(100dvh-2rem)] w-full flex-col gap-4 rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,13,24,0.98),rgba(3,5,12,0.98))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.56)] backdrop-blur-xl"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-amber-200/78">Curve Lab</div>
                    <h2 className="text-[20px] leading-none tracking-[-0.03em] text-slate-50">{activeTarget.label}</h2>
                    <p className="max-w-[34ch] text-[12px] leading-relaxed text-slate-300/72">
                        {activeTarget.description}
                    </p>
                </div>
                <button
                    type="button"
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-cyan-200/25 hover:text-cyan-100"
                    onClick={() => {
                        if (onClose) {
                            onClose();
                            return;
                        }

                        onStateChange((previousState) => ({ ...previousState, isOpen: false }));
                    }}
                >
                    Close
                </button>
            </div>

            <div className="grid gap-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400/80">Equation</div>
                <div className="grid grid-cols-2 gap-2">
                    {activeTarget.allowedFamilyIds.map((familyId) => {
                        const candidate = getCurveFamilyDefinition(familyId);
                        const isActive = profile.familyId === familyId;

                        return (
                            <button
                                key={familyId}
                                type="button"
                                data-role={`curve-lab-family-${familyId}`}
                                className={joinClasses(
                                    "grid gap-1 rounded-[18px] border px-3 py-3 text-left transition",
                                    isActive
                                        ? "border-cyan-200/28 bg-cyan-300/[0.08] text-cyan-100"
                                        : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/18",
                                )}
                                onClick={() => {
                                    setProfile({
                                        familyId: candidate.id,
                                        coefficients: Object.fromEntries(
                                            candidate.coefficients.map((coefficient) => [coefficient.key, coefficient.defaultValue]),
                                        ),
                                    });
                                }}
                            >
                                <span className="text-[11px] uppercase tracking-[0.18em]">{candidate.label}</span>
                                <span className="text-[11px] leading-relaxed text-slate-300/72">{candidate.description}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400/80">Equation Readout</div>
                <div className="mt-2 text-[13px] text-slate-100">{family.equation}</div>
            </div>

            <CurvePreview targetId={activeTarget.id} profile={profile} />

            {family.coefficients.length > 0 ? (
                <div className="grid gap-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400/80">Coefficients</div>
                    <div className="grid gap-3">
                        {family.coefficients.map((coefficient) => (
                            <CurveCoefficientControl
                                key={coefficient.key}
                                coefficientKey={coefficient.key}
                                label={coefficient.label}
                                value={profile.coefficients[coefficient.key] ?? coefficient.defaultValue}
                                min={coefficient.min}
                                max={coefficient.max}
                                step={coefficient.step}
                                formatValue={coefficient.formatValue}
                                onChange={(nextValue) => {
                                    setProfile({
                                        familyId: family.id,
                                        coefficients: {
                                            ...profile.coefficients,
                                            [coefficient.key]: nextValue,
                                        },
                                    });
                                }}
                            />
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="mt-auto flex items-center justify-between gap-3">
                <div className="text-[11px] leading-relaxed text-slate-400/74">
                    The preview uses the same curve that drives the filter handle drag and the resonance drag field.
                </div>
                <button
                    type="button"
                    data-role="curve-lab-reset"
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-cyan-200/25 hover:text-cyan-100"
                    onClick={() => {
                        onStateChange((previousState) => {
                            const nextState = createDefaultCurveLabState();
                            return {
                                ...previousState,
                                profiles: {
                                    ...previousState.profiles,
                                    [activeTarget.id]: nextState.profiles[activeTarget.id],
                                },
                            };
                        });
                    }}
                >
                    Reset
                </button>
            </div>
        </section>
    );
}

export function DesktopCurveLabStandaloneView() {
    const isDevMode = import.meta.env.DEV;
    const nativeBridge = useMemo(
        () => (
            isDevMode && typeof window !== "undefined"
                ? getNativeCurveLabBridge(window)
                : null
        ),
        [isDevMode],
    );
    const [state, setState] = useState<CurveLabState>(() => ({
        ...createDefaultCurveLabState(),
        isOpen: true,
    }));
    const lastNativeStateRef = useRef<string | null>(null);
    const [hasHydratedNativeState, setHasHydratedNativeState] = useState(false);

    useEffect(() => {
        if (!isDevMode || !nativeBridge) {
            return;
        }

        let cancelled = false;
        const handleStateEvent = (event: Event) => {
            const nextState = parseSharedCurveLabState((event as CustomEvent<unknown>).detail);

            if (!nextState) {
                return;
            }

            const serializedState = serializeSharedCurveLabState(nextState);

            if (serializedState === lastNativeStateRef.current) {
                return;
            }

            lastNativeStateRef.current = serializedState;
            setState((previousState) => mergeSharedCurveLabState(previousState, nextState));
        };

        void nativeBridge.getState().then((rawState) => {
            if (cancelled) {
                return;
            }

            const nextState = parseSharedCurveLabState(rawState);

            if (!nextState) {
                setHasHydratedNativeState(true);
                return;
            }

            lastNativeStateRef.current = serializeSharedCurveLabState(nextState);
            setHasHydratedNativeState(true);
            setState((previousState) => mergeSharedCurveLabState(previousState, nextState));
        });

        window.addEventListener(CURVE_LAB_NATIVE_STATE_EVENT, handleStateEvent as EventListener);
        return () => {
            cancelled = true;
            window.removeEventListener(CURVE_LAB_NATIVE_STATE_EVENT, handleStateEvent as EventListener);
        };
    }, [isDevMode, nativeBridge]);

    useEffect(() => {
        if (!isDevMode || !nativeBridge || !hasHydratedNativeState) {
            return;
        }

        const serializedState = serializeSharedCurveLabState(state);

        if (serializedState === lastNativeStateRef.current) {
            return;
        }

        lastNativeStateRef.current = serializedState;
        void nativeBridge.setState(serializedState);
    }, [hasHydratedNativeState, isDevMode, nativeBridge, state]);

    if (!isDevMode || !nativeBridge) {
        return (
            <div className="flex min-h-full items-center justify-center p-8 text-center text-[13px] text-slate-300/75">
                Curve Lab is only available in the desktop dev app.
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(120,112,255,0.10),transparent_38%),linear-gradient(180deg,rgba(5,8,18,1),rgba(2,3,10,1))] p-4 text-slate-100">
            <CurveLabPanel
                state={state}
                onStateChange={(updater) => {
                    setState((previousState) => sanitizeCurveLabState(updater(previousState)));
                }}
                onClose={() => {
                    void nativeBridge.closeWindow();
                }}
            />
        </div>
    );
}

export function useDesktopCurveLab() {
    const isDevMode = import.meta.env.DEV;
    const [state, setState] = useState<CurveLabState>(() => (
        isDevMode ? loadCurveLabState() : createDefaultCurveLabState()
    ));
    const nativeBridge = useMemo(
        () => (
            isDevMode && typeof window !== "undefined"
                ? getNativeCurveLabBridge(window)
                : null
        ),
        [isDevMode],
    );
    const usesNativeCurveLabWindow = nativeBridge !== null && !isCurveLabStandaloneWindow();
    const lastNativeStateRef = useRef<string | null>(null);
    const [hasHydratedNativeState, setHasHydratedNativeState] = useState(false);
    const popupWindowRef = useRef<Window | null>(null);
    const popupRootRef = useRef<Root | null>(null);

    useEffect(() => {
        if (!isDevMode || !usesNativeCurveLabWindow || !nativeBridge) {
            return;
        }

        let cancelled = false;
        const handleStateEvent = (event: Event) => {
            const nextState = parseSharedCurveLabState((event as CustomEvent<unknown>).detail);

            if (!nextState) {
                return;
            }

            const serializedState = serializeSharedCurveLabState(nextState);

            if (serializedState === lastNativeStateRef.current) {
                return;
            }

            lastNativeStateRef.current = serializedState;
            setState((previousState) => mergeSharedCurveLabState(previousState, nextState));
        };

        void nativeBridge.getState().then((rawState) => {
            if (cancelled) {
                return;
            }

            const nextState = parseSharedCurveLabState(rawState);

            if (!nextState) {
                setHasHydratedNativeState(true);
                return;
            }

            lastNativeStateRef.current = serializeSharedCurveLabState(nextState);
            setHasHydratedNativeState(true);
            setState((previousState) => mergeSharedCurveLabState(previousState, nextState));
        });

        window.addEventListener(CURVE_LAB_NATIVE_STATE_EVENT, handleStateEvent as EventListener);
        return () => {
            cancelled = true;
            window.removeEventListener(CURVE_LAB_NATIVE_STATE_EVENT, handleStateEvent as EventListener);
        };
    }, [isDevMode, nativeBridge, usesNativeCurveLabWindow]);

    useEffect(() => {
        if (!isDevMode || !usesNativeCurveLabWindow || !nativeBridge || !hasHydratedNativeState) {
            return;
        }

        const serializedState = serializeSharedCurveLabState(state);

        if (serializedState === lastNativeStateRef.current) {
            return;
        }

        lastNativeStateRef.current = serializedState;
        void nativeBridge.setState(serializedState);
    }, [hasHydratedNativeState, isDevMode, nativeBridge, state, usesNativeCurveLabWindow]);

    useEffect(() => {
        if (!isDevMode) {
            return;
        }

        persistCurveLabState(state);
    }, [isDevMode, state]);

    const updateState = (updater: (previousState: CurveLabState) => CurveLabState) => {
        setState((previousState) => sanitizeCurveLabState(updater(previousState)));
    };
    const isCurveLabActive = isDevMode && (isCurveLabStandaloneWindow() || state.isOpen);

    const closePopupWindow = useCallback(() => {
        popupRootRef.current?.unmount();
        popupRootRef.current = null;

        const popupWindow = popupWindowRef.current;
        popupWindowRef.current = null;

        if (popupWindow && !popupWindow.closed) {
            popupWindow.close();
        }
    }, []);

    const ensurePopupWindow = useCallback(() => {
        if (!isDevMode) {
            return null;
        }

        const existingWindow = popupWindowRef.current;

        if (existingWindow && !existingWindow.closed) {
            return existingWindow;
        }

        const popupWindow = window.open("", CURVE_LAB_POPUP_NAME, buildCurveLabPopupFeatures());

        if (!popupWindow) {
            return null;
        }

        popupWindowRef.current = popupWindow;
        const mountPoint = ensureCurveLabPopupDocument(popupWindow);
        popupRootRef.current?.unmount();
        popupRootRef.current = createRoot(mountPoint);
        return popupWindow;
    }, [isDevMode]);

    useEffect(() => {
        if (!isDevMode || usesNativeCurveLabWindow) {
            return;
        }

        if (!state.isOpen) {
            closePopupWindow();
            return;
        }

        const popupWindow = ensurePopupWindow();

        if (!popupWindow) {
            setState((previousState) => ({ ...previousState, isOpen: false }));
            return;
        }

        popupWindow.focus();
    }, [closePopupWindow, ensurePopupWindow, isDevMode, state.isOpen, usesNativeCurveLabWindow]);

    useEffect(() => {
        if (!isDevMode || usesNativeCurveLabWindow || !state.isOpen) {
            return;
        }

        const popupWindow = ensurePopupWindow();
        const popupRoot = popupRootRef.current;

        if (!popupWindow || !popupRoot) {
            return;
        }

        popupRoot.render(
            <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(120,112,255,0.10),transparent_38%),linear-gradient(180deg,rgba(5,8,18,1),rgba(2,3,10,1))] p-4 text-slate-100">
                <CurveLabPanel state={state} onStateChange={updateState} />
            </div>,
        );
    }, [ensurePopupWindow, isDevMode, state, usesNativeCurveLabWindow]);

    useEffect(() => {
        if (!isDevMode || usesNativeCurveLabWindow || !state.isOpen) {
            return;
        }

        const closeWatcher = window.setInterval(() => {
            const popupWindow = popupWindowRef.current;

            if (popupWindow && !popupWindow.closed) {
                return;
            }

            popupRootRef.current?.unmount();
            popupRootRef.current = null;
            popupWindowRef.current = null;
            setState((previousState) => (
                previousState.isOpen
                    ? { ...previousState, isOpen: false }
                    : previousState
            ));
        }, 200);

        return () => window.clearInterval(closeWatcher);
    }, [isDevMode, state.isOpen, usesNativeCurveLabWindow]);

    useEffect(() => () => {
        closePopupWindow();
    }, [closePopupWindow]);

    const getProfile = (targetId: string) => state.profiles[targetId] ?? createDefaultCurveProfile(targetId);
    const getActiveProfile = (targetId: string) => (
        isCurveLabActive
            ? getProfile(targetId)
            : createDefaultCurveProfile(targetId)
    );

    const evaluateTarget = (targetId: string, normalizedInput: number) => (
        evaluateCurveProfile(targetId, getActiveProfile(targetId), normalizedInput)
    );

    const invertTarget = (targetId: string, normalizedOutput: number) => (
        invertCurveProfile(targetId, getActiveProfile(targetId), normalizedOutput)
    );

    const launcher = !isDevMode
        ? null
        : (
            <div className="absolute bottom-4 right-4 z-40">
                <button
                    type="button"
                    data-role="curve-lab-toggle"
                    aria-label={usesNativeCurveLabWindow
                        ? "Open curve lab"
                        : (state.isOpen ? "Focus curve lab" : "Open curve lab")}
                    className="rounded-full border border-amber-200/18 bg-[linear-gradient(180deg,rgba(17,22,33,0.94),rgba(5,8,16,0.98))] px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-amber-100 shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition hover:border-amber-200/30"
                    onClick={() => {
                        if (usesNativeCurveLabWindow && nativeBridge) {
                            updateState((previousState) => ({ ...previousState, isOpen: true }));
                            void nativeBridge.openWindow();
                            return;
                        }

                        if (state.isOpen) {
                            popupWindowRef.current?.focus();
                            return;
                        }

                        updateState((previousState) => ({ ...previousState, isOpen: true }));
                    }}
                >
                    Curve Lab
                </button>
            </div>
        );

    return {
        isDevMode,
        panel: launcher,
        getProfile: getActiveProfile,
        evaluateTarget,
        invertTarget,
    };
}
