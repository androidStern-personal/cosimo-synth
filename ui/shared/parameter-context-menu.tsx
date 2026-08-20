/**
 * The ADR-017 long-press parameter menu, shared by every parameter host
 * (FX rack knobs, Voice cells and knobs, the quick-sheet strip): exact
 * editing, base reset, route bypass, polarity, voice-source reducer,
 * one-route removal, and confirmed removal of every route to the target.
 * Exact editing never creates a missing route; base reset never removes
 * existing routes.
 *
 * The presentation (classes and data-roles) is the shipped rack menu's —
 * one look everywhere; hosts differ only in how they resolve the pressed
 * control to a spec, a binding, and a route.
 */

import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";

import { PARAMETER_GESTURE_LONG_PRESS_MS } from "./parameter-gesture";

import {
    MODULATION_SOURCE_OPTIONS,
    isVoiceModulationSource,
    type ModulationRoute,
} from "./modulation";
import {
    formatParameterEntry,
    parseParameterEntry,
    type ParameterEntryCommit,
    type ParameterEntrySpec,
} from "./parameter-value-entry";

export const PARAMETER_MENU_ITEMS = [
    { action: "edit-values", label: "Edit values…" },
    { action: "reset-base", label: "Reset base to default" },
    { action: "toggle-route", label: "Bypass route" },
    { action: "polarity", label: "Polarity: Unipolar" },
    { action: "reducer", label: "Voice reducer: Maximum" },
    { action: "remove-route", label: "Remove selected-source route" },
    { action: "remove-all-target-routes", label: "Remove all routes to target…" },
] as const;

export type ParameterMenuAction = typeof PARAMETER_MENU_ITEMS[number]["action"];

/** What a long-press host reports upward: the full editing context for the
    pressed control, so the shell's one menu machinery never re-derives host
    internals. Route actions stay shell-owned (armed source + routes). */
export type ParameterMenuRequest = {
    readonly controlKey: string;
    readonly label: string;
    readonly targetKind: string | null;
    readonly baseSpec: ParameterEntrySpec;
    readonly baseValue: number;
    /** null → the control has no canonical default; the reset item hides. */
    readonly defaultValue: number | null;
    readonly commitBase: (value: number) => void;
    /** When the host knows the exact route (e.g. a matrix row), it pins it
        here; otherwise the shell resolves by targetKind + armed source. */
    readonly routeIndex?: number;
    readonly clientX: number;
    readonly clientY: number;
};

/**
 * The shell's one menu opener, provided at the app root so EVERY control —
 * knobs, readout cells, number fields, rails — can self-serve the ADR-017
 * long-press menu without per-host prop threading (the threading is how
 * surfaces silently missed the menu). null = no shell menu exists in this
 * tree (labs/harnesses), and hosts render without the affordance.
 */
export const ParameterMenuContext = createContext<((request: ParameterMenuRequest) => void) | null>(null);

export function useParameterMenu() {
    return useContext(ParameterMenuContext);
}

const LONG_PRESS_SLOP_PX = 8;

/**
 * Pointer-prop pack for controls that own their pointer interaction (number
 * fields, rails): a stationary press opens the shell menu; movement past
 * slop or release cancels. Returns {} when no shell menu exists or the host
 * has nothing to offer, so spreading is always safe.
 */
export function useLongPressParameterMenu(
    buildRequest: (() => Omit<ParameterMenuRequest, "clientX" | "clientY">) | null,
) {
    const openMenu = useParameterMenu();
    const pressRef = useRef<{ pointerId: number; startX: number; startY: number; timer: number } | null>(null);

    const clearPress = useCallback(() => {
        if (pressRef.current !== null) {
            window.clearTimeout(pressRef.current.timer);
            pressRef.current = null;
        }
    }, []);

    const onPointerDown = useCallback((event: ReactPointerEvent<Element>) => {
        if (openMenu === null || buildRequest === null) {
            return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        clearPress();
        const { pointerId, clientX, clientY } = event;
        pressRef.current = {
            pointerId,
            startX: clientX,
            startY: clientY,
            timer: window.setTimeout(() => {
                pressRef.current = null;
                openMenu({ ...buildRequest(), clientX, clientY });
            }, PARAMETER_GESTURE_LONG_PRESS_MS),
        };
    }, [buildRequest, clearPress, openMenu]);

    const onPointerMove = useCallback((event: ReactPointerEvent<Element>) => {
        const press = pressRef.current;
        if (press === null || event.pointerId !== press.pointerId) {
            return;
        }
        if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > LONG_PRESS_SLOP_PX) {
            clearPress();
        }
    }, [clearPress]);

    return openMenu === null || buildRequest === null
        ? {}
        : {
            onPointerDown,
            onPointerMove,
            onPointerUp: clearPress,
            onPointerCancel: clearPress,
        };
}

export type ParameterMenuPosition = {
    readonly clientX: number;
    readonly clientY: number;
};

function routeSourceLabel(route: Pick<ModulationRoute, "sourceKind" | "sourceSlot">) {
    return MODULATION_SOURCE_OPTIONS.find((source) => (
        source.sourceKind === route.sourceKind && source.sourceSlot === route.sourceSlot
    ))?.label ?? "Selected source";
}

export function ParameterContextMenu({
    position,
    controlId,
    route,
    targetRouteCount,
    canResetBase = true,
    onClose,
    onSelectAction,
}: {
    position: ParameterMenuPosition;
    /** Stable identity of the pressed control, exposed for tests. */
    controlId: string;
    route: ModulationRoute | null;
    targetRouteCount: number;
    /** Hidden for controls with no canonical default (document-owned cells). */
    canResetBase?: boolean;
    onClose: () => void;
    onSelectAction: (action: ParameterMenuAction) => void;
}) {
    const style = {
        "--rack-menu-x": `${position.clientX}px`,
        "--rack-menu-y": `${position.clientY}px`,
    } as CSSProperties;

    return (
        <div
            className="rack-parameter-menu-layer"
            data-role="rack-parameter-menu-layer"
            onPointerDown={onClose}
        >
            <div
                role="menu"
                aria-label="Parameter actions"
                data-role="rack-parameter-menu"
                data-endpoint-id={controlId}
                className="rack-parameter-menu"
                style={style}
                onPointerDown={(event) => event.stopPropagation()}
            >
                {PARAMETER_MENU_ITEMS
                    .filter((item) => {
                        if (item.action === "reset-base") {
                            return canResetBase;
                        }
                        if (item.action === "remove-all-target-routes") {
                            return targetRouteCount > 0;
                        }
                        if (item.action === "reducer") {
                            return route !== null && isVoiceModulationSource(route.sourceKind);
                        }
                        if (["toggle-route", "polarity", "remove-route"].includes(item.action)) {
                            return route !== null;
                        }
                        return true;
                    })
                    .map((item) => {
                        const label = item.action === "toggle-route"
                            ? (route?.enabled === false ? "Enable route" : "Bypass route")
                            : item.action === "polarity"
                                ? `Polarity: ${route?.polarity === "bipolar" ? "Bipolar" : "Unipolar"}`
                                : item.action === "reducer"
                                    ? `Voice reducer: ${route?.reducer === "mean" ? "Mean" : "Maximum"}`
                                    : item.action === "remove-route" && route !== null
                                        ? `Remove ${routeSourceLabel(route)} route`
                                    : item.label;
                        const needsRoute = ["toggle-route", "polarity", "reducer", "remove-route"].includes(item.action);
                        return (
                            <button
                                key={item.action}
                                type="button"
                                role="menuitem"
                                data-role="rack-parameter-menu-item"
                                data-action={item.action}
                                disabled={needsRoute && route === null}
                                onClick={() => onSelectAction(item.action)}
                            >
                                {label}
                            </button>
                        );
                    })}
            </div>
        </div>
    );
}

export function ParameterValueSheet({
    kicker = "EXACT VALUE",
    heading,
    label,
    baseSpec,
    baseValue,
    defaultValue,
    route,
    amountSpec,
    sourceLabel,
    onApply,
    onClose,
}: {
    kicker?: string;
    /** e.g. "Reverb · Size" or "Voice · Cutoff". */
    heading: string;
    /** The parameter's short label, used in the dialog's aria-label. */
    label: string;
    baseSpec: ParameterEntrySpec;
    baseValue: number;
    /** The canonical default the Default button restores (never touches
        routes); null hides the button for controls with no default. */
    defaultValue: number | null;
    route: ModulationRoute | null;
    /** null when the target kind has no amount entry (base-only controls). */
    amountSpec: ParameterEntrySpec | null;
    /** The armed source's label, or null when no source is armed. */
    sourceLabel: string | null;
    onApply: (baseCommit: ParameterEntryCommit, modulationAmount: number | null) => void;
    onClose: () => void;
}) {
    const [baseDraft, setBaseDraft] = useState(() => formatParameterEntry(baseSpec, baseValue).draft);
    const [amountDraft, setAmountDraft] = useState(() => (
        route && amountSpec ? formatParameterEntry(amountSpec, route.amount).draft : ""
    ));
    const [error, setError] = useState("");

    const apply = useCallback(() => {
        const baseResult = parseParameterEntry(baseSpec, baseDraft);
        if (route !== null && amountSpec === null) {
            throw new Error(`Route target "${route.targetKind}" has no amount entry spec.`);
        }
        const amountResult = route === null || amountSpec === null
            ? null
            : parseParameterEntry(amountSpec, amountDraft);
        if (baseResult._tag === "rejected") {
            setError(baseResult.message);
            return;
        }
        if (amountResult?._tag === "rejected") {
            setError(amountResult.message);
            return;
        }
        const modulationAmount = amountResult === null
            ? null
            : amountResult.commit._tag === "value"
                ? amountResult.commit.value
                : null;
        if (amountResult !== null && modulationAmount === null) {
            throw new Error("A modulation amount cannot commit a tempo division.");
        }
        setBaseDraft(baseResult.echo.draft);
        if (amountResult !== null) {
            setAmountDraft(amountResult.echo.draft);
        }
        setError("");
        onApply(baseResult.commit, modulationAmount);
    }, [amountDraft, amountSpec, baseDraft, baseSpec, onApply, route]);

    return (
        <div className="rack-value-sheet-layer" onPointerDown={onClose}>
            <section
                role="dialog"
                aria-modal="true"
                aria-label={`Edit ${label} values`}
                data-role="rack-parameter-value-sheet"
                className="rack-value-sheet"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <header>
                    <span>{kicker}</span>
                    <strong>{heading}</strong>
                </header>
                <label>
                    <span>Base</span>
                    <span className="rack-value-sheet-input">
                        <input
                            data-role="rack-base-value-input"
                            inputMode="decimal"
                            value={baseDraft}
                            onChange={(event) => setBaseDraft(event.currentTarget.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") apply();
                                if (event.key === "Escape") onClose();
                            }}
                            autoFocus
                        />
                        <em>{formatParameterEntry(baseSpec, baseValue).unit}</em>
                    </span>
                </label>
                <label>
                    <span>{sourceLabel === null ? "No armed source" : `${sourceLabel} amount`}</span>
                    <span className="rack-value-sheet-input">
                        <input
                            data-role="rack-modulation-value-input"
                            inputMode="decimal"
                            value={amountDraft}
                            disabled={route === null}
                            onChange={(event) => setAmountDraft(event.currentTarget.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") apply();
                                if (event.key === "Escape") onClose();
                            }}
                        />
                        <em>{amountSpec === null ? "" : formatParameterEntry(amountSpec, route?.amount ?? 0).unit}</em>
                    </span>
                </label>
                {route === null ? <p data-role="rack-value-sheet-no-route">{sourceLabel === null ? "Arm a source to edit its route." : "No selected source route."}</p> : null}
                {error ? <p className="rack-value-sheet-error" role="alert">{error}</p> : null}
                <footer>
                    {defaultValue === null ? <span /> : (
                        <button type="button" data-role="rack-value-sheet-default" onClick={() => {
                            setBaseDraft(formatParameterEntry(baseSpec, defaultValue).draft);
                            setError("");
                        }}>Default</button>
                    )}
                    <span />
                    <button type="button" data-role="rack-value-sheet-cancel" onClick={onClose}>Cancel</button>
                    <button type="button" data-role="rack-value-sheet-apply" onClick={apply}>Apply</button>
                </footer>
            </section>
        </div>
    );
}

export function RemoveTargetRoutesConfirmation({
    targetLabel,
    routeCount,
    onCancel,
    onConfirm,
}: {
    targetLabel: string;
    routeCount: number;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="rack-value-sheet-layer" onPointerDown={onCancel}>
            <section
                role="alertdialog"
                aria-modal="true"
                aria-label="Remove all modulation routes to parameter"
                data-role="rack-remove-target-routes-confirmation"
                className="rack-remove-routes-confirmation"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <span>REMOVE ROUTES</span>
                <strong>Remove all {routeCount} {routeCount === 1 ? "route" : "routes"} to {targetLabel}?</strong>
                <p>Other parameters and the base value will not change.</p>
                <footer>
                    <button type="button" onClick={onCancel}>Cancel</button>
                    <button type="button" data-role="rack-remove-target-routes-confirm" onClick={onConfirm}>Remove</button>
                </footer>
            </section>
        </div>
    );
}
