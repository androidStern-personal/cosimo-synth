/**
 * The ONE segmented editor selector (ADR-024's A/B/C bar generalized) and its
 * fixed-bar/directional-panel transition. The Voice oscillator tabs and the
 * Mod page's SOURCE/MAPPINGS tabs are the same component with different
 * labels (T14: never a second tab dialect).
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
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from "react";

export const SEGMENTED_PANEL_SLIDE_MS = 170;

export type SegmentedEditorTab = {
    readonly id: string;
    readonly label: ReactNode;
    readonly ariaLabel: string;
    readonly dataRole: string;
    readonly dataDragDwell?: string;
    /** Extra state classes on the tab (e.g. the Voice bar's is-muted). */
    readonly stateClassName?: string;
    /** Rendered inside the tab after the label (e.g. the Solo chip). */
    readonly accessory?: ReactNode;
    /** Tapping the ALREADY-active tab (Voice: mute toggle). */
    readonly onActiveTap?: () => void;
};

export function SegmentedEditorTabs({
    tabs,
    activeId,
    ariaLabel,
    dataRole,
    onSelect,
}: {
    tabs: ReadonlyArray<SegmentedEditorTab>;
    activeId: string;
    ariaLabel: string;
    dataRole: string;
    onSelect: (id: string) => void;
}) {
    const activate = useCallback((tab: SegmentedEditorTab) => {
        if (tab.id === activeId) {
            tab.onActiveTap?.();
        } else {
            onSelect(tab.id);
        }
    }, [activeId, onSelect]);

    const handleKeyDown = useCallback((event: ReactKeyboardEvent, tab: SegmentedEditorTab) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate(tab);
            return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const ids = tabs.map((candidate) => candidate.id);
            const currentIndex = ids.indexOf(tab.id);
            const nextIndex = event.key === "ArrowLeft"
                ? (currentIndex + ids.length - 1) % ids.length
                : (currentIndex + 1) % ids.length;
            onSelect(ids[nextIndex]);
        }
    }, [activate, onSelect, tabs]);

    return (
        <nav
            role="tablist"
            aria-label={ariaLabel}
            data-role={dataRole}
            className="mobile-voice-tabs"
        >
            {tabs.map((tab) => {
                const isActive = tab.id === activeId;
                return (
                    <div
                        key={tab.id}
                        role="tab"
                        tabIndex={isActive ? 0 : -1}
                        aria-selected={isActive}
                        aria-label={tab.ariaLabel}
                        data-role={tab.dataRole}
                        data-drag-dwell={tab.dataDragDwell}
                        className={`mobile-voice-tab${isActive ? " is-active" : ""}${tab.stateClassName ?? ""}`}
                        onClick={() => activate(tab)}
                        onKeyDown={(event) => handleKeyDown(event, tab)}
                    >
                        <span>{tab.label}</span>
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

        const timer = window.setTimeout(() => {
            cleanupRef.current?.();
        }, SEGMENTED_PANEL_SLIDE_MS + 80);
        cleanupRef.current = () => {
            window.clearTimeout(timer);
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
