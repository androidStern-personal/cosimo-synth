/**
 * THE segmented selector, and its fixed-bar/directional-panel transition.
 * Voice A/B/C, the Mod page's SOURCE/MAPPINGS, the Voice/FX/Mod workspace
 * bar, the iOS oscillator bar and the articulation mode bar are all this
 * component with different labels (T14: never a second tab dialect).
 *
 * It renders the neutral `.cosimo-tabs` / `.cosimo-tab` classes from the
 * design system. It previously hardcoded `mobile-voice-tab*`, which is why
 * every other bar in the app was rewritten by hand instead of reusing it.
 *
 * Transition semantics (MOBILE_VOICE_FOCUSED_OSCILLATOR_SPEC "Tabs"):
 * the bar stays stationary; selecting a later tab slides the outgoing panel
 * left while the new one enters from the right, and the reverse for an
 * earlier tab. The slide is a short visual confirmation only — the incoming
 * panel is live and interactive from its first frame, and the outgoing
 * "panel" is a sanitized static snapshot (no live bindings, no duplicated
 * data-roles, inert). Programmatic selection changes (e.g. rail sync) swap
 * without animating. Reduced motion removes the translation entirely.
 */

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from "react";

import { clearUiTimeout, uiTimeout } from "./ui-timers";

/** Duration of the optional directional panel transition. */
export const SEGMENTED_PANEL_SLIDE_MS = 170;

/** Whether moving keyboard focus also selects the newly focused tab. */
export type SegmentedTabActivationMode = "automatic" | "manual";

/** One logical tab consumed by {@link SegmentedEditorTabs}. */
export type SegmentedEditorTab<TId extends string = string> = {
    readonly id: TId;
    readonly label: ReactNode;
    readonly ariaLabel: string;
    readonly dataRole: string;
    readonly dataDragDwell?: string;
    /** DOM id, so a panel may point at its tab with aria-labelledby.
        Deliberately NOT `id` — that field is the tab's LOGICAL identity,
        used for active matching and handed to onSelect. */
    readonly domId?: string;
    /** The panel this tab controls. */
    readonly ariaControls?: string;
    /** Extra state classes on the tab (e.g. the Voice bar's is-muted). */
    readonly stateClassName?: string;
    /** Rendered inside the tab after the label (e.g. the Solo chip). */
    readonly accessory?: ReactNode;
    /** Tapping the ALREADY-active tab (Voice: mute toggle). */
    readonly onActiveTap?: () => void;
};

type SegmentedEditorTabsProps<TId extends string> = {
    readonly tabs: ReadonlyArray<SegmentedEditorTab<TId>>;
    readonly activeId: TId;
    readonly ariaLabel: string;
    readonly dataRole: string;
    readonly onSelect: (id: TId) => void;
    /** "top" puts the hairline above a bar docked to the bottom of a panel. */
    readonly dock?: "top";
    /** Neutral ink instead of the section accent. */
    readonly neutral?: boolean;
    /** Compact segmented controls use the canonical 24 px module. */
    readonly size?: "regular" | "small";
    /** Manual mode follows ADR-026: arrows move focus; Enter/Space select. */
    readonly activationMode?: SegmentedTabActivationMode;
};

/**
 * Render the shared segmented tab primitive with roving keyboard focus.
 *
 * @template TId Stable logical identity shared by the active value and tabs.
 */
export function SegmentedEditorTabs<TId extends string>({
    tabs,
    activeId,
    ariaLabel,
    dataRole,
    onSelect,
    dock,
    neutral = false,
    size = "regular",
    activationMode = "automatic",
}: SegmentedEditorTabsProps<TId>) {
    const tabListRef = useRef<HTMLElement | null>(null);
    const tabRefs = useRef(new Map<TId, HTMLButtonElement>());
    const [focusId, setFocusId] = useState<TId>(activeId);
    const tabIdsKey = tabs.map((tab) => tab.id).join("\u001f");

    useEffect(() => {
        const tabList = tabListRef.current;
        const root = tabList?.getRootNode();
        const activeElement = root instanceof Document || root instanceof ShadowRoot
            ? root.activeElement
            : null;
        const focusIsInTabList = activeElement !== null && tabList?.contains(activeElement) === true;
        setFocusId((current) => (
            focusIsInTabList && tabs.some((tab) => tab.id === current) ? current : activeId
        ));
        // A fresh tab-array instance is normal; logical membership is the dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId, tabIdsKey]);

    const select = useCallback((tab: SegmentedEditorTab<TId>) => {
        if (tab.id !== activeId) {
            onSelect(tab.id);
        }
    }, [activeId, onSelect]);

    const activate = useCallback((tab: SegmentedEditorTab<TId>) => {
        if (tab.id === activeId) {
            tab.onActiveTap?.();
        } else {
            onSelect(tab.id);
        }
    }, [activeId, onSelect]);

    const focusTab = useCallback((tab: SegmentedEditorTab<TId>) => {
        setFocusId(tab.id);
        tabRefs.current.get(tab.id)?.focus();
    }, []);

    const handleKeyDown = useCallback((event: ReactKeyboardEvent, tab: SegmentedEditorTab<TId>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate(tab);
            return;
        }

        const currentIndex = tabs.findIndex((candidate) => candidate.id === tab.id);
        if (currentIndex < 0 || tabs.length === 0) {
            return;
        }

        let nextTab: SegmentedEditorTab<TId> | undefined;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            const nextIndex = event.key === "ArrowLeft"
                ? (currentIndex + tabs.length - 1) % tabs.length
                : (currentIndex + 1) % tabs.length;
            nextTab = tabs[nextIndex];
        } else if (event.key === "Home") {
            nextTab = tabs[0];
        } else if (event.key === "End") {
            nextTab = tabs[tabs.length - 1];
        }

        if (nextTab === undefined) {
            return;
        }

        event.preventDefault();
        focusTab(nextTab);
        if (activationMode === "automatic") {
            select(nextTab);
        }
    }, [activate, activationMode, focusTab, select, tabs]);

    return (
        <nav
            ref={tabListRef}
            role="tablist"
            aria-label={ariaLabel}
            data-role={dataRole}
            data-dock={dock}
            className={`cosimo-tabs${neutral ? " is-neutral" : ""}${size === "small" ? " is-small" : ""}`}
        >
            {tabs.map((tab) => {
                const isActive = tab.id === activeId;
                return (
                    <div key={tab.id} role="presentation" className="cosimo-tab-slot">
                        <button
                            ref={(element) => {
                                if (element === null) {
                                    tabRefs.current.delete(tab.id);
                                } else {
                                    tabRefs.current.set(tab.id, element);
                                }
                            }}
                            type="button"
                            role="tab"
                            tabIndex={tab.id === focusId ? 0 : -1}
                            aria-selected={isActive}
                            aria-label={tab.ariaLabel}
                            aria-controls={tab.ariaControls}
                            id={tab.domId}
                            data-role={tab.dataRole}
                            data-drag-dwell={tab.dataDragDwell}
                            className={`cosimo-tab${isActive ? " is-active" : ""}${tab.stateClassName ?? ""}`}
                            onFocus={() => setFocusId(tab.id)}
                            onClick={() => activate(tab)}
                            onKeyDown={(event) => handleKeyDown(event, tab)}
                        >
                            <span>{tab.label}</span>
                        </button>
                        {tab.accessory}
                    </div>
                );
            })}
        </nav>
    );
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hook half of the transition: call `beginTabTransition(nextId)` from the tab
 * bar's onSelect BEFORE updating selection state — it snapshots the live
 * panel DOM for the outgoing ghost while it still exists. Selection changes
 * that never pass through it (programmatic sync) simply do not animate.
 */
export function useDirectionalPanelTransition({
    order,
    activeId,
}: {
    order: ReadonlyArray<string>;
    activeId: string;
}) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const pendingRef = useRef<{ fromId: string; snapshot: HTMLElement } | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const orderRef = useRef(order);
    orderRef.current = order;
    // Callers pass a fresh array per render; the effect must not re-run (and
    // tear the ghost down) on unrelated renders.
    const orderKey = order.join("\u001f");

    const beginTabTransition = useCallback((nextId: string) => {
        const panel = panelRef.current;
        if (panel === null || nextId === activeId || prefersReducedMotion()) {
            return;
        }
        const snapshot = panel.cloneNode(true) as HTMLElement;
        // Canvas bitmaps do not clone — repaint each one into its twin so
        // the outgoing panel keeps its graphics for the slide.
        const liveCanvases = panel.querySelectorAll("canvas");
        snapshot.querySelectorAll("canvas").forEach((cloneCanvas, index) => {
            const liveCanvas = liveCanvases[index];
            if (liveCanvas === undefined || liveCanvas.width === 0 || liveCanvas.height === 0) {
                return;
            }
            cloneCanvas.getContext("2d")?.drawImage(liveCanvas, 0, 0);
        });
        // The ghost is scenery: no live roles, no focusables, no input.
        snapshot.querySelectorAll("[data-role]").forEach((node) => node.removeAttribute("data-role"));
        snapshot.setAttribute("aria-hidden", "true");
        snapshot.setAttribute("inert", "");
        snapshot.setAttribute("data-panel-ghost", "true");
        pendingRef.current = { fromId: activeId, snapshot };
    }, [activeId]);

    useEffect(() => {
        const pending = pendingRef.current;
        if (pending === null || pending.fromId === activeId) {
            // Unrelated re-renders must not consume a staged snapshot: the
            // selection commit can land a render later than the tap.
            return;
        }
        pendingRef.current = null;
        const viewport = viewportRef.current;
        const panel = panelRef.current;
        if (viewport === null || panel === null) {
            return;
        }
        cleanupRef.current?.();

        const forward = orderRef.current.indexOf(activeId) > orderRef.current.indexOf(pending.fromId);
        const ghost = pending.snapshot;
        ghost.style.position = "absolute";
        ghost.style.inset = "0";
        ghost.style.pointerEvents = "none";
        ghost.style.transition = `transform ${SEGMENTED_PANEL_SLIDE_MS}ms ease-out`;
        ghost.style.transform = "translateX(0)";
        viewport.appendChild(ghost);

        panel.style.transition = "none";
        panel.style.transform = `translateX(${forward ? "100%" : "-100%"})`;
        // Two frames: apply the start positions, then animate both to rest.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ghost.style.transform = `translateX(${forward ? "-100%" : "100%"})`;
                panel.style.transition = `transform ${SEGMENTED_PANEL_SLIDE_MS}ms ease-out`;
                panel.style.transform = "translateX(0)";
            });
        });

        const timer = uiTimeout(() => {
            cleanupRef.current?.();
        }, SEGMENTED_PANEL_SLIDE_MS + 80);
        cleanupRef.current = () => {
            clearUiTimeout(timer);
            ghost.remove();
            panel.style.transition = "";
            panel.style.transform = "";
            cleanupRef.current = null;
        };
        return () => cleanupRef.current?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId, orderKey]);

    return { viewportRef, panelRef, beginTabTransition };
}
