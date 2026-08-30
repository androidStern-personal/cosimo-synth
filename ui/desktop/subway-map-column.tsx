import {
    useCallback,
    useEffect,
    useRef,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { LANE_TYPE_TO_EFFECT_ID } from "../shared/lane-state";
import { encodeLaneDevicePath, type LaneDevicePathV2, type LaneStateV2 } from "../shared/lane-state-v2";
import {
    buildSubwayLayout,
    type SubwayCell,
    type SubwayGhostCell,
    type SubwayRow,
    type SubwayStationCell,
    type SubwayTint,
} from "../shared/lane-subway-layout";
import { getRackEffectDescriptor } from "../shared/rack-parameter-descriptors";
import type { EffectModuleId } from "../shared/target-descriptor";
import { clearUiTimeout, uiTimeout } from "../shared/ui-timers";
import {
    SUBWAY_CONNECTOR_VIEWBOX_HEIGHT,
    SUBWAY_CONNECTOR_VIEWBOX_WIDTH,
    SUBWAY_FORK_TRUNK_PATH,
    SUBWAY_LANE_GUTTER_PERCENT,
    SUBWAY_LANE_SPAN_PERCENT,
    SUBWAY_MERGE_TRUNK_PATH,
    subwayCompactLaneAllocation,
    subwayForkBranchPath,
    subwayForkBranchPathAt,
    subwayMergeBranchPath,
    subwayMergeBranchPathAt,
    subwayUsesCompactLaneAllocation,
    type SubwayCompactLaneAllocation,
} from "../shared/subway-connector-geometry";

/**
 * The subway-map rack column (M3/M4, locked direction: canvas "FX Rack
 * Subway Map"). The lane.v2 document renders THROUGH the layout model as a
 * line map — the whole topology always in view: trunk stations on the
 * infra-teal line, parallel groups forking at a dot junction with lettered
 * lanes, frequency splits at a diamond with band-tinted lanes and crossover
 * readouts, empty branches as dashed lanes opened by ghost add-stubs.
 *
 * Gestures per the accepted mocks: TAP selects a station (or a group's
 * fork), DRAGGING a station moves it anywhere on the graph — along its
 * lane, across branches and bands, back to the trunk — every station and
 * ghost is a drop target through its data-lane-path; LONG-PRESS (or
 * right-click) opens the station or group menu.
 *
 * DOM contract: a TRUNK station is a direct list child carrying the
 * rack-module data-roles (position selectors and the serial-doc tests keep
 * working untouched). A group renders as one .subway-group section whose
 * body rows hold per-lane CELLS; branch stations carry the same data-roles
 * on the cell.
 */

const STATION_SCROLL_THRESHOLD_PX = 5;
const STATION_REORDER_HOLD_MS = 180;
const STATION_REORDER_MOVE_PX = 3;
const STATION_MENU_MOVEMENT_TOLERANCE_PX = 8;
const STATION_LONG_PRESS_MS = 550;

export type SubwayReorderPresentation = {
    readonly deviceId: string;
    readonly phase: "dragging" | "settling";
    readonly overlayRoot: HTMLElement | ShadowRoot;
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
    readonly visualMode: "detail" | "compact" | "summary";
};

export type SubwayReorderLiftOrigin = {
    readonly clientX: number;
    readonly clientY: number;
};

export type SubwayReorderArmRequest = {
    readonly pointerId: number;
    readonly stationElement: HTMLElement;
    readonly preventDefault: () => void;
};

export type SubwayStationMenuRequest = {
    readonly deviceId: string;
    readonly clientX: number;
    readonly clientY: number;
};

export type SubwayGroupMenuRequest = {
    readonly groupId: string;
    readonly clientX: number;
    readonly clientY: number;
};

type SubwayMapColumnProps = {
    readonly laneState: LaneStateV2;
    /** Measured content width of the graph that owns both tracks and SVGs. */
    readonly graphWidth: number;
    readonly selectedDeviceId: string;
    readonly selectedGroupId: string | null;
    readonly reorderPresentation: SubwayReorderPresentation | null;
    readonly focusedBranchIndices: Readonly<Record<string, number>>;
    readonly accents: Readonly<Record<EffectModuleId, string>>;
    readonly onSelect: (deviceId: string) => void;
    readonly onSelectGroup: (groupId: string) => void;
    readonly onFocusBranch: (groupId: string, branchIndex: number) => void;
    readonly onOpenStationMenu: (request: SubwayStationMenuRequest) => void;
    readonly onOpenGroupMenu: (request: SubwayGroupMenuRequest) => void;
    readonly onToggleBypass: (deviceId: string) => void;
    /** Called once movement after the deliberate short hold lifts a station. */
    readonly onArmReorder: (
        deviceId: string,
        request: SubwayReorderArmRequest,
        liftOrigin: SubwayReorderLiftOrigin,
    ) => boolean;
    readonly onKeyboardMove: (deviceId: string, offset: -1 | 1) => void;
    /** A ghost add-stub was tapped: open the type picker for its path. */
    readonly onRequestAdd: (path: LaneDevicePathV2, clientX: number, clientY: number) => void;
};

type SubwayBranchContext = {
    readonly groupId: string;
    readonly branchIndex: number;
    readonly laneCount: number;
    readonly focused: boolean;
};

function requiredLaneCenter(laneCenters: ReadonlyArray<number>, laneIndex: number): number {
    const center = laneCenters[laneIndex];
    if (center === undefined) {
        throw new RangeError(`Missing compact subway lane center ${laneIndex}`);
    }
    return center;
}

type StationPointerOwner = {
    readonly pointerId: number;
    readonly captureElement: HTMLElement;
    readonly ownership: "element-capture" | "window-fallback";
};

type PressingPointerState = StationPointerOwner & {
    readonly _tag: "pressing";
    readonly startX: number;
    readonly startY: number;
    readonly lastX: number;
    readonly lastY: number;
    readonly reorderTimer: number | null;
    readonly menuTimer: number;
};

type ReorderReadyPointerState = StationPointerOwner & {
    readonly _tag: "reorder-ready";
    readonly startX: number;
    readonly startY: number;
    readonly lastX: number;
    readonly lastY: number;
    readonly readyX: number;
    readonly readyY: number;
    readonly menuTimer: number;
};

type ScrollingPointerState = StationPointerOwner & {
    readonly _tag: "scrolling";
    readonly lastX: number;
    readonly lastY: number;
};

type WonPointerState = StationPointerOwner & {
    readonly _tag: "menu-open";
};

type StationPointerState =
    | PressingPointerState
    | ReorderReadyPointerState
    | ScrollingPointerState
    | WonPointerState;

type StationGesturePointerInput = {
    readonly pointerId: number;
    readonly clientX: number;
    readonly clientY: number;
    preventDefault: () => void;
    stopPropagation: () => void;
};

function pointerDistance(fromX: number, fromY: number, toX: number, toY: number): number {
    return Math.hypot(toX - fromX, toY - fromY);
}

/** Scroll the first owning surface, then offer any unconsumed delta to its
    scrollable ancestors. This preserves the graph's real top/bottom boundary
    instead of letting a station drag become a reorder there. */
function scrollScrollableAncestors(start: HTMLElement, deltaY: number): void {
    let remaining = deltaY;
    let candidate = start.parentElement;
    while (candidate !== null && Math.abs(remaining) > 0.01) {
        const overflowY = candidate.ownerDocument.defaultView
            ?.getComputedStyle(candidate).overflowY ?? "visible";
        const scrollable = (overflowY === "auto" || overflowY === "scroll")
            && candidate.scrollHeight > candidate.clientHeight + 0.5;
        if (scrollable) {
            const before = candidate.scrollTop;
            const maximum = Math.max(0, candidate.scrollHeight - candidate.clientHeight);
            const after = Math.min(Math.max(before + remaining, 0), maximum);
            candidate.scrollTop = after;
            remaining -= after - before;
        }
        candidate = candidate.parentElement;
    }
}

/**
 * Tap / drag-arm / long-press disambiguation shared by stations and forks.
 * One primary pointer owns this state machine until release/cancellation.
 * Element capture is preferred; a stable window listener is the equivalent
 * owner when the platform rejects capture. The workspace takes over only
 * after the reorder winner has armed.
 */
function usePressableGestures({
    onTap,
    onLongPress,
    onDragArm = null,
    manualScroll = false,
}: {
    onTap: (event: ReactMouseEvent<HTMLElement>) => void;
    onLongPress: (clientX: number, clientY: number) => void;
    onDragArm?: ((
        request: SubwayReorderArmRequest,
        liftOrigin: SubwayReorderLiftOrigin,
    ) => boolean) | null;
    manualScroll?: boolean;
}) {
    const pointerStateRef = useRef<StationPointerState | null>(null);
    const ownershipCleanupRef = useRef<(() => void) | null>(null);
    const suppressClickRef = useRef(false);

    const clearPointerTimers = useCallback((pointerState: StationPointerState) => {
        if (pointerState._tag === "pressing") {
            if (pointerState.reorderTimer !== null) {
                clearUiTimeout(pointerState.reorderTimer);
            }
            clearUiTimeout(pointerState.menuTimer);
        } else if (pointerState._tag === "reorder-ready") {
            clearUiTimeout(pointerState.menuTimer);
        }
    }, []);

    const clearPointerState = useCallback(() => {
        const pointerState = pointerStateRef.current;
        pointerStateRef.current = null;
        if (pointerState !== null) {
            clearPointerTimers(pointerState);
        }
        const cleanup = ownershipCleanupRef.current;
        ownershipCleanupRef.current = null;
        cleanup?.();
    }, [clearPointerTimers]);

    const cancelPointerState = useCallback(() => {
        if (pointerStateRef.current === null) {
            return;
        }
        suppressClickRef.current = true;
        clearPointerState();
    }, [clearPointerState]);

    const applyScrollMove = useCallback((
        event: StationGesturePointerInput,
        captureElement: HTMLElement,
        deltaY: number,
    ) => {
        if (!manualScroll) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        scrollScrollableAncestors(captureElement, deltaY);
    }, [manualScroll]);

    const processPointerMove = useCallback((event: StationGesturePointerInput) => {
        const pointerState = pointerStateRef.current;
        if (pointerState === null || pointerState.pointerId !== event.pointerId) {
            return;
        }
        if (pointerState._tag === "pressing") {
            if (pointerDistance(
                pointerState.startX,
                pointerState.startY,
                event.clientX,
                event.clientY,
            ) < STATION_SCROLL_THRESHOLD_PX) {
                pointerStateRef.current = {
                    ...pointerState,
                    lastX: event.clientX,
                    lastY: event.clientY,
                };
                return;
            }
            clearPointerTimers(pointerState);
            suppressClickRef.current = true;
            pointerStateRef.current = {
                _tag: "scrolling",
                pointerId: pointerState.pointerId,
                captureElement: pointerState.captureElement,
                ownership: pointerState.ownership,
                lastX: event.clientX,
                lastY: event.clientY,
            };
            applyScrollMove(
                event,
                pointerState.captureElement,
                pointerState.startY - event.clientY,
            );
            return;
        }
        if (pointerState._tag === "reorder-ready") {
            if (pointerDistance(
                pointerState.readyX,
                pointerState.readyY,
                event.clientX,
                event.clientY,
            ) < STATION_REORDER_MOVE_PX) {
                pointerStateRef.current = {
                    ...pointerState,
                    lastX: event.clientX,
                    lastY: event.clientY,
                };
                return;
            }
            clearPointerTimers(pointerState);
            suppressClickRef.current = true;
            event.preventDefault();
            const armed = onDragArm?.({
                pointerId: event.pointerId,
                stationElement: pointerState.captureElement,
                preventDefault: () => event.preventDefault(),
            }, {
                clientX: pointerState.readyX,
                clientY: pointerState.readyY,
            }) ?? false;
            if (armed) {
                // The workspace has captured the pointer and is now the one
                // reorder owner. End the station phase without reviving it
                // after the capture-transfer lostpointercapture event.
                clearPointerState();
                return;
            }
            pointerStateRef.current = {
                _tag: "scrolling",
                pointerId: pointerState.pointerId,
                captureElement: pointerState.captureElement,
                ownership: pointerState.ownership,
                lastX: event.clientX,
                lastY: event.clientY,
            };
            applyScrollMove(
                event,
                pointerState.captureElement,
                pointerState.readyY - event.clientY,
            );
            return;
        }
        if (pointerState._tag === "scrolling") {
            const deltaY = pointerState.lastY - event.clientY;
            pointerStateRef.current = {
                ...pointerState,
                lastX: event.clientX,
                lastY: event.clientY,
            };
            applyScrollMove(event, pointerState.captureElement, deltaY);
        }
    }, [applyScrollMove, clearPointerState, clearPointerTimers, onDragArm]);

    const processPointerUp = useCallback((pointerId: number) => {
        if (pointerStateRef.current?.pointerId === pointerId) {
            clearPointerState();
        }
    }, [clearPointerState]);

    const processPointerCancel = useCallback((pointerId: number) => {
        if (pointerStateRef.current?.pointerId === pointerId) {
            cancelPointerState();
        }
    }, [cancelPointerState]);

    const installPointerOwnership = useCallback((
        captureElement: HTMLElement,
        ownership: StationPointerOwner["ownership"],
    ) => {
        const ownerDocument = captureElement.ownerDocument;
        const ownerWindow = ownerDocument.defaultView;
        if (ownerWindow === null) {
            cancelPointerState();
            return;
        }

        const handleWindowPointerMove = (event: PointerEvent) => {
            if (pointerStateRef.current?.ownership === "window-fallback") {
                processPointerMove(event);
            }
        };
        const handleWindowPointerUp = (event: PointerEvent) => {
            if (pointerStateRef.current?.ownership === "window-fallback") {
                processPointerUp(event.pointerId);
            }
        };
        const handleWindowPointerCancel = (event: PointerEvent) => {
            if (pointerStateRef.current?.ownership === "window-fallback") {
                processPointerCancel(event.pointerId);
            }
        };
        const handleTargetLostPointerCapture = (event: PointerEvent) => {
            const pointerState = pointerStateRef.current;
            if (pointerState?.ownership === "element-capture"
                    && pointerState.pointerId === event.pointerId) {
                cancelPointerState();
            }
        };
        const handleVisibilityChange = () => {
            if (ownerDocument.visibilityState !== "visible") {
                cancelPointerState();
            }
        };

        if (ownership === "window-fallback") {
            ownerWindow.addEventListener("pointermove", handleWindowPointerMove, true);
            ownerWindow.addEventListener("pointerup", handleWindowPointerUp, true);
            ownerWindow.addEventListener("pointercancel", handleWindowPointerCancel, true);
        } else {
            // Capture loss is owned at the actual target. React's delegated
            // root event is only a redundant guard: it may never receive the
            // native event in a host or shadow-root integration.
            captureElement.addEventListener(
                "lostpointercapture",
                handleTargetLostPointerCapture,
                true,
            );
        }
        ownerWindow.addEventListener("blur", cancelPointerState);
        ownerDocument.addEventListener("visibilitychange", handleVisibilityChange);
        ownershipCleanupRef.current = () => {
            if (ownership === "window-fallback") {
                ownerWindow.removeEventListener("pointermove", handleWindowPointerMove, true);
                ownerWindow.removeEventListener("pointerup", handleWindowPointerUp, true);
                ownerWindow.removeEventListener("pointercancel", handleWindowPointerCancel, true);
            } else {
                captureElement.removeEventListener(
                    "lostpointercapture",
                    handleTargetLostPointerCapture,
                    true,
                );
            }
            ownerWindow.removeEventListener("blur", cancelPointerState);
            ownerDocument.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [cancelPointerState, processPointerCancel, processPointerMove, processPointerUp]);

    useEffect(() => () => {
        suppressClickRef.current = true;
        clearPointerState();
    }, [clearPointerState]);

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!event.isPrimary || event.button !== 0 || pointerStateRef.current !== null) {
            return;
        }
        suppressClickRef.current = false;
        const { clientX, clientY, pointerId } = event;
        const captureElement = event.currentTarget;
        try {
            captureElement.setPointerCapture(pointerId);
        } catch {
            // hasPointerCapture below distinguishes implicit capture from a
            // platform that truly needs the stable window fallback.
        }
        let ownership: StationPointerOwner["ownership"] = "window-fallback";
        try {
            if (captureElement.hasPointerCapture(pointerId)) {
                ownership = "element-capture";
            }
        } catch {
            // Unsupported capture uses the window fallback.
        }
        const reorderTimer = onDragArm === null
            ? null
            : uiTimeout(() => {
                const current = pointerStateRef.current;
                if (current?._tag !== "pressing" || current.pointerId !== pointerId) {
                    return;
                }
                pointerStateRef.current = {
                    _tag: "reorder-ready",
                    pointerId,
                    captureElement: current.captureElement,
                    ownership: current.ownership,
                    startX: current.startX,
                    startY: current.startY,
                    lastX: current.lastX,
                    lastY: current.lastY,
                    readyX: current.lastX,
                    readyY: current.lastY,
                    menuTimer: current.menuTimer,
                };
            }, STATION_REORDER_HOLD_MS);
        const menuTimer = uiTimeout(() => {
            const current = pointerStateRef.current;
            if ((current?._tag !== "pressing" && current?._tag !== "reorder-ready")
                    || current.pointerId !== pointerId
                    || pointerDistance(
                        current.startX,
                        current.startY,
                        current.lastX,
                        current.lastY,
                    ) > STATION_MENU_MOVEMENT_TOLERANCE_PX) {
                return;
            }
            clearPointerTimers(current);
            pointerStateRef.current = {
                _tag: "menu-open",
                pointerId,
                captureElement: current.captureElement,
                ownership: current.ownership,
            };
            suppressClickRef.current = true;
            onLongPress(clientX, clientY);
        }, STATION_LONG_PRESS_MS);
        pointerStateRef.current = {
            _tag: "pressing",
            pointerId,
            captureElement,
            ownership,
            startX: clientX,
            startY: clientY,
            lastX: clientX,
            lastY: clientY,
            reorderTimer,
            menuTimer,
        };
        installPointerOwnership(captureElement, ownership);
    }, [clearPointerTimers, installPointerOwnership, onDragArm, onLongPress]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const pointerState = pointerStateRef.current;
        if (pointerState?.ownership === "element-capture") {
            processPointerMove(event);
        }
    }, [processPointerMove]);

    const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (pointerStateRef.current?.ownership === "element-capture") {
            processPointerUp(event.pointerId);
        }
    }, [processPointerUp]);

    const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (pointerStateRef.current?.ownership === "element-capture") {
            processPointerCancel(event.pointerId);
        }
    }, [processPointerCancel]);

    const handleLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const pointerState = pointerStateRef.current;
        if (pointerState?.ownership === "element-capture"
                && pointerState.pointerId === event.pointerId) {
            cancelPointerState();
        }
    }, [cancelPointerState]);

    const handleClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        onTap(event);
    }, [onTap]);

    const handleContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
        event.preventDefault();
        clearPointerState();
        suppressClickRef.current = true;
        onLongPress(event.clientX, event.clientY);
    }, [clearPointerState, onLongPress]);

    return {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        handleLostPointerCapture,
        handleClick,
        handleContextMenu,
    };
}

function StationIcon({ effectId, className }: {
    readonly effectId: EffectModuleId;
    readonly className: string;
}) {
    const effect = getRackEffectDescriptor(effectId);
    return (
        <span
            className={className}
            style={{ "--station-icon-url": `url("${effect.iconUrl}")` } as CSSProperties}
            aria-hidden="true"
        />
    );
}

function StationBody({ station, effectId, interactive = false }: {
    readonly station: SubwayStationCell;
    readonly effectId: EffectModuleId;
    readonly interactive?: boolean;
}) {
    return (
        <span className="subway-station-pill" aria-hidden="true">
            <span className="subway-station-detail">
                <span
                    className="subway-station-icon-well"
                    data-station-icon-target={interactive ? "true" : undefined}
                >
                    <StationIcon effectId={effectId} className="subway-station-icon subway-station-icon-detail" />
                </span>
                <span className="subway-station-label">{station.code} {station.instanceNumber}</span>
            </span>
            <span className="subway-station-compact" aria-hidden="true">
                <span
                    className="subway-station-compact-well"
                    data-station-icon-target={interactive ? "true" : undefined}
                >
                    <StationIcon effectId={effectId} className="subway-station-icon subway-station-icon-compact" />
                </span>
            </span>
            <span className="subway-station-summary" aria-hidden="true">
                <span
                    className="subway-station-summary-well"
                    data-station-icon-target={interactive ? "true" : undefined}
                >
                    <StationIcon effectId={effectId} className="subway-station-icon subway-station-icon-summary" />
                </span>
            </span>
        </span>
    );
}

function stationTapHitsVisibleIcon(event: ReactMouseEvent<HTMLElement>): boolean {
    if (event.target instanceof Element
            && event.target.closest('[data-station-icon-target="true"]') !== null) {
        return true;
    }
    // Some WebViews retarget clicks from aria-hidden station decoration to
    // the owning button. Use the rendered icon well as the product contract;
    // keyboard activation has detail 0 and remains a normal select/open action.
    if (event.detail === 0) {
        return false;
    }
    const { clientX, clientY } = event;
    return Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        '[data-station-icon-target="true"]',
    )).some((iconTarget) => {
        const rect = iconTarget.getBoundingClientRect();
        return rect.width > 0
            && rect.height > 0
            && clientX >= rect.left
            && clientX <= rect.right
            && clientY >= rect.top
            && clientY <= rect.bottom;
    });
}

function LiftedStation({
    station,
    effectId,
    accent,
    presentation,
}: {
    readonly station: SubwayStationCell;
    readonly effectId: EffectModuleId;
    readonly accent: string;
    readonly presentation: SubwayReorderPresentation;
}) {
    if (typeof document === "undefined") {
        return null;
    }
    return createPortal(
        <div
            className={`subway-reorder-lifted-pill is-${presentation.phase}`}
            data-role="rack-reorder-lifted-pill"
            data-device-id={station.deviceId}
            data-enabled={station.enabled ? "true" : "false"}
            data-presentation={presentation.visualMode}
            aria-hidden="true"
            style={{
                "--station-accent": accent,
                left: presentation.left,
                top: presentation.top,
                width: presentation.width,
                height: presentation.height,
            } as CSSProperties}
        >
            <StationBody station={station} effectId={effectId} />
        </div>,
        presentation.overlayRoot,
    );
}

function SubwayStation({
    station,
    position,
    asCell,
    accents,
    selectedDeviceId,
    reorderPresentation,
    onSelect,
    onOpenStationMenu,
    onToggleBypass,
    onArmReorder,
    onKeyboardMove,
    onFocusBranch,
    branchContext = null,
}: {
    readonly station: SubwayStationCell;
    readonly position: number;
    /** Trunk stations are list-child ROWS; branch stations are lane CELLS. */
    readonly asCell: boolean;
    readonly branchContext?: SubwayBranchContext | null;
} & Pick<SubwayMapColumnProps,
    "accents" | "selectedDeviceId" | "reorderPresentation"
    | "onSelect" | "onOpenStationMenu" | "onToggleBypass"
    | "onArmReorder" | "onKeyboardMove" | "onFocusBranch">) {
    const effectId = LANE_TYPE_TO_EFFECT_ID.get(station.deviceType);
    if (effectId === undefined) {
        throw new Error(`Unknown lane device type on the map: ${station.deviceType}`);
    }
    const effect = getRackEffectDescriptor(effectId);
    const label = station.instanceNumber > 1
        ? `${effect.label} ${station.instanceNumber}`
        : effect.label;
    const selected = selectedDeviceId === station.deviceId;
    const stationReorderPresentation = reorderPresentation?.deviceId === station.deviceId
        ? reorderPresentation
        : null;
    const reordering = stationReorderPresentation !== null;
    const gestures = usePressableGestures({
        onTap: (event) => {
            if (selected && stationTapHitsVisibleIcon(event)) {
                onToggleBypass(station.deviceId);
                return;
            }
            if (branchContext !== null) {
                onFocusBranch(branchContext.groupId, branchContext.branchIndex);
            }
            onSelect(station.deviceId);
        },
        onLongPress: (clientX, clientY) => onOpenStationMenu({ deviceId: station.deviceId, clientX, clientY }),
        onDragArm: (event, liftOrigin) => onArmReorder(station.deviceId, event, liftOrigin),
        manualScroll: true,
    });

    return (
        <div
            data-role={`rack-module-${effectId}`}
            data-rack-effect-id={effectId}
            data-rack-position={position}
            data-effect-id={effectId}
            data-device-id={station.deviceId}
            data-enabled={station.enabled ? "true" : "false"}
            data-drag-dwell={`rack-effect:${effectId}`}
            data-lane-path={encodeLaneDevicePath(station.path)}
            data-lane-tint={station.tint}
            data-branch-index={branchContext?.branchIndex}
            data-branch-lane-count={branchContext?.laneCount}
            data-focused-branch={branchContext === null ? undefined : branchContext.focused ? "true" : "false"}
            data-reorder-layout-key={`device:${station.deviceId}`}
            data-reorder-dragged={reordering ? "true" : undefined}
            className={`${asCell ? "subway-station-cell" : "subway-station-row"}${branchContext === null ? "" : branchContext.focused ? " is-focused-branch" : " is-context-branch"}${selected ? " is-selected" : ""}${station.enabled ? "" : " is-disabled"}${reordering ? " is-reordering" : ""}`}
            style={{ "--station-accent": accents[effectId] } as CSSProperties}
        >
            {stationReorderPresentation === null ? (
                <button
                    type="button"
                    data-role={`rack-station-${effectId}`}
                    aria-label={`${label}${station.enabled ? "" : " (bypassed)"}${selected ? ", selected" : ""}`}
                    className="subway-station"
                    onPointerDown={gestures.handlePointerDown}
                    onPointerMove={gestures.handlePointerMove}
                    onPointerUp={gestures.handlePointerUp}
                    onPointerCancel={gestures.handlePointerCancel}
                    onLostPointerCapture={gestures.handleLostPointerCapture}
                    onClick={gestures.handleClick}
                    onContextMenu={gestures.handleContextMenu}
                    onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                            event.preventDefault();
                            onKeyboardMove(station.deviceId, -1);
                        } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                            event.preventDefault();
                            onKeyboardMove(station.deviceId, 1);
                        }
                    }}
                >
                    <StationBody station={station} effectId={effectId} interactive />
                </button>
            ) : (
                <>
                    <span
                        className="subway-reorder-destination-ghost"
                        data-role="rack-reorder-ghost"
                        data-device-id={station.deviceId}
                        aria-hidden="true"
                    >
                        <StationBody station={station} effectId={effectId} />
                    </span>
                    <LiftedStation
                        station={station}
                        effectId={effectId}
                        accent={accents[effectId]}
                        presentation={stationReorderPresentation}
                    />
                </>
            )}
        </div>
    );
}

function SubwayGhost({
    cell,
    asCell,
    onRequestAdd,
    onFocusBranch,
    branchContext = null,
}: {
    readonly cell: SubwayGhostCell;
    /** Branch ghosts are lane CELLS; the trunk's trailing ghost is a ROW. */
    readonly asCell: boolean;
    readonly onRequestAdd: SubwayMapColumnProps["onRequestAdd"];
    readonly onFocusBranch: SubwayMapColumnProps["onFocusBranch"];
    readonly branchContext?: SubwayBranchContext | null;
}) {
    const requestAdd = (clientX: number, clientY: number) => {
        if (branchContext !== null) {
            onFocusBranch(branchContext.groupId, branchContext.branchIndex);
        }
        onRequestAdd(cell.path, clientX, clientY);
    };
    if (asCell) {
        return (
            <div
                className={`subway-ghost-cell${cell.dashed ? " is-dashed" : ""}${branchContext?.focused ? " is-focused-branch" : " is-context-branch"}`}
                data-lane-tint={cell.tint}
                data-branch-index={branchContext?.branchIndex}
                data-branch-lane-count={branchContext?.laneCount}
                data-focused-branch={branchContext?.focused ? "true" : "false"}
                data-reorder-layout-key={`path:${encodeLaneDevicePath(cell.path)}`}
            >
                <button
                    type="button"
                    data-role="rack-ghost-add"
                    data-insertion-anchor="path-tail"
                    aria-label="Add a device here"
                    className="subway-ghost-button"
                    data-lane-path={encodeLaneDevicePath(cell.path)}
                    onClick={(event) => requestAdd(event.clientX, event.clientY)}
                >
                    <span className="subway-ghost-pill" aria-hidden="true">+</span>
                    <span className="subway-ghost-summary" aria-hidden="true">+</span>
                </button>
            </div>
        );
    }
    return (
        <button
            type="button"
            data-role="rack-ghost-add"
            data-insertion-anchor="path-tail"
            aria-label="Add a device here"
            className="subway-ghost-row"
            data-lane-path={encodeLaneDevicePath(cell.path)}
            data-lane-tint={cell.tint}
            data-reorder-layout-key={`path:${encodeLaneDevicePath(cell.path)}`}
            onClick={(event) => requestAdd(event.clientX, event.clientY)}
        >
            <span className="subway-ghost-pill" aria-hidden="true">+</span>
        </button>
    );
}

function laneCells(
    cells: ReadonlyArray<SubwayCell>,
    groupId: string,
    focusedBranchIndex: number,
    positionOf: (cell: SubwayStationCell) => number,
    stationProps: Pick<SubwayMapColumnProps,
        "accents" | "selectedDeviceId" | "reorderPresentation"
        | "onSelect" | "onOpenStationMenu" | "onToggleBypass"
        | "onArmReorder" | "onKeyboardMove" | "onFocusBranch">,
    onRequestAdd: SubwayMapColumnProps["onRequestAdd"],
): ReactNode[] {
    return cells.map((cell, laneIndex) => {
        if (cell.kind === "station") {
            return (
                <SubwayStation
                    key={cell.deviceId}
                    station={cell}
                    position={positionOf(cell)}
                    asCell
                    branchContext={{
                        groupId,
                        branchIndex: laneIndex,
                        laneCount: cells.length,
                        focused: laneIndex === focusedBranchIndex,
                    }}
                    {...stationProps}
                />
            );
        }
        if (cell.kind === "ghost") {
            return (
                <SubwayGhost
                    key={`ghost-${laneIndex}`}
                    cell={cell}
                    asCell
                    branchContext={{
                        groupId,
                        branchIndex: laneIndex,
                        laneCount: cells.length,
                        focused: laneIndex === focusedBranchIndex,
                    }}
                    onRequestAdd={onRequestAdd}
                    onFocusBranch={stationProps.onFocusBranch}
                />
            );
        }
        return (
            <div
                key={`line-${laneIndex}`}
                className={`subway-line-cell${cell.dashed ? " is-dashed" : ""}${laneIndex === focusedBranchIndex ? " is-focused-branch" : " is-context-branch"}`}
                data-lane-tint={cell.tint}
                data-branch-index={laneIndex}
                data-branch-lane-count={cells.length}
                data-focused-branch={laneIndex === focusedBranchIndex ? "true" : "false"}
            />
        );
    });
}

export function SubwayMapColumn({
    laneState,
    graphWidth,
    selectedDeviceId,
    selectedGroupId,
    reorderPresentation,
    focusedBranchIndices,
    accents,
    onSelect,
    onSelectGroup,
    onFocusBranch,
    onOpenStationMenu,
    onOpenGroupMenu,
    onToggleBypass,
    onArmReorder,
    onKeyboardMove,
    onRequestAdd,
}: SubwayMapColumnProps) {
    const layout = buildSubwayLayout(laneState);

    // Chain-walk positions for the data-rack-position contract: stations
    // number consecutively in dispatch order whatever their lane.
    const stationPositions = new Map<string, number>();
    for (const row of layout.rows) {
        if (row.kind !== "stations") {
            continue;
        }
        for (const cell of row.cells) {
            if (cell.kind === "station") {
                stationPositions.set(cell.deviceId, stationPositions.size);
            }
        }
    }

    const stationProps = {
        accents,
        selectedDeviceId,
        reorderPresentation,
        onSelect,
        onOpenStationMenu,
        onToggleBypass,
        onArmReorder,
        onKeyboardMove,
        onFocusBranch,
    };
    const positionOf = (cell: SubwayStationCell) => stationPositions.get(cell.deviceId) ?? 0;

    // Rows render in order; a group's fork..merge rows nest inside ONE
    // section so bypass dimming and lane alignment stay coherent.
    const rendered: ReactNode[] = [];
    let trunkTail: ReactNode = null;
    let groupRows: ReactNode[] = [];
    let openGroup: {
        groupId: string;
        bypassed: boolean;
        laneCount: number;
        focusedBranchIndex: number;
        compactAllocation: SubwayCompactLaneAllocation | null;
    } | null = null;

    const flushGroup = () => {
        if (openGroup === null) {
            return;
        }
        rendered.push(
            <div
                key={openGroup.groupId}
                className={`subway-group${openGroup.bypassed ? " is-bypassed" : ""}${selectedGroupId === openGroup.groupId ? " is-selected" : ""}`}
                data-role={`rack-group-${openGroup.groupId}`}
                data-group-id={openGroup.groupId}
                data-lane-count={openGroup.laneCount}
                data-focused-branch-index={openGroup.focusedBranchIndex}
                data-compact-layout={openGroup.compactAllocation === null ? "false" : "true"}
                data-graph-width={graphWidth}
                style={{
                    "--subway-lane-count": openGroup.laneCount,
                    "--subway-lane-gutter": `${SUBWAY_LANE_GUTTER_PERCENT}%`,
                    "--subway-lane-span": `${SUBWAY_LANE_SPAN_PERCENT}%`,
                    "--subway-compact-lane-template": openGroup.compactAllocation?.gridTemplate,
                    "--subway-compact-badge-template": openGroup.laneCount === 4
                        ? "repeat(4, 25%)"
                        : openGroup.compactAllocation?.gridTemplate,
                } as CSSProperties}
            >
                {groupRows}
            </div>,
        );
        groupRows = [];
        openGroup = null;
    };

    for (const [rowIndex, row] of layout.rows.entries()) {
        if (row.kind === "terminus") {
            continue; // Variant C uses clean cut route ends, not terminal glyphs.
        }
        if (row.kind === "fork") {
            flushGroup();
            const requestedFocus = focusedBranchIndices[row.groupId] ?? 0;
            const focusedBranchIndex = Math.min(Math.max(requestedFocus, 0), row.lanes.length - 1);
            const compactAllocation = subwayUsesCompactLaneAllocation(graphWidth, row.lanes.length)
                ? subwayCompactLaneAllocation(row.lanes.length, focusedBranchIndex)
                : null;
            openGroup = {
                groupId: row.groupId,
                bypassed: row.bypassed,
                laneCount: row.lanes.length,
                focusedBranchIndex,
                compactAllocation,
            };
            groupRows.push(
                <SubwayFork
                    key={`fork-${row.groupId}`}
                    row={row}
                    focusedBranchIndex={focusedBranchIndex}
                    compactAllocation={compactAllocation}
                    onSelectGroup={onSelectGroup}
                    onFocusBranch={onFocusBranch}
                    onOpenGroupMenu={onOpenGroupMenu}
                />,
            );
            continue;
        }
        if (row.kind === "merge") {
            if (openGroup === null) {
                throw new Error("Subway merge row has no open group");
            }
            groupRows.push(
                <SubwayMerge
                    key={`merge-${rowIndex}`}
                    groupId={openGroup.groupId}
                    row={row}
                    focusedBranchIndex={openGroup.focusedBranchIndex}
                    compactAllocation={openGroup.compactAllocation}
                />,
            );
            flushGroup();
            continue;
        }
        // Station rows: trunk rows are single-cell list children; group body
        // rows hold per-lane cells.
        if (openGroup !== null) {
            groupRows.push(
                <div key={`body-${rowIndex}`} className="subway-lane-row">
                    {laneCells(
                        row.cells,
                        openGroup.groupId,
                        openGroup.focusedBranchIndex,
                        positionOf,
                        stationProps,
                        onRequestAdd,
                    )}
                </div>,
            );
            continue;
        }
        const cell = row.cells[0];
        if (cell !== undefined && cell.kind === "station") {
            rendered.push(
                <SubwayStation
                    key={cell.deviceId}
                    station={cell}
                    position={positionOf(cell)}
                    asCell={false}
                    {...stationProps}
                />,
            );
        }
        if (cell !== undefined && cell.kind === "ghost") {
            trunkTail = (
                <SubwayGhost
                    key={`trunk-ghost-${rowIndex}`}
                    cell={cell}
                    asCell={false}
                    onRequestAdd={onRequestAdd}
                    onFocusBranch={onFocusBranch}
                />
            );
        }
    }
    flushGroup();

    return (
        <>
            {rendered}
            <span
                className="subway-trunk-tail-fill"
                data-role="rack-trunk-tail-fill"
                data-reorder-layout-key="trunk:tail-fill"
                aria-hidden="true"
            />
            {trunkTail}
        </>
    );
}

function SubwayFork({
    row,
    focusedBranchIndex,
    compactAllocation,
    onSelectGroup,
    onFocusBranch,
    onOpenGroupMenu,
}: {
    readonly row: Extract<SubwayRow, { kind: "fork" }>;
    readonly focusedBranchIndex: number;
    readonly compactAllocation: SubwayCompactLaneAllocation | null;
    readonly onSelectGroup: (groupId: string) => void;
    readonly onFocusBranch: (groupId: string, branchIndex: number) => void;
    readonly onOpenGroupMenu: (request: SubwayGroupMenuRequest) => void;
}) {
    const gestures = usePressableGestures({
        onTap: () => onSelectGroup(row.groupId),
        onLongPress: (clientX, clientY) => onOpenGroupMenu({ groupId: row.groupId, clientX, clientY }),
    });
    const readout = row.crossovers === null
        ? "PAR"
        : row.crossovers.highHz === null
            ? formatCrossoverHz(row.crossovers.lowHz)
            : `${formatCrossoverHz(row.crossovers.lowHz)} · ${formatCrossoverHz(row.crossovers.highHz)}`;

    return (
        <div
            className="subway-fork"
            data-fork-kind={row.groupKind}
            data-reorder-layout-key={`group:${row.groupId}:fork`}
        >
            <SubwayForkConnections
                row={row}
                focusedBranchIndex={focusedBranchIndex}
                compactAllocation={compactAllocation}
            />
            <div className="subway-fork-lanes">
                {row.lanes.map((lane, branchIndex) => (
                    <button
                        type="button"
                        key={lane.label}
                        data-role={`rack-branch-focus-${row.groupId}-${branchIndex}`}
                        data-focus-group-id={row.groupId}
                        data-focus-branch-index={branchIndex}
                        aria-label={`Focus ${lane.label} branch`}
                        aria-pressed={branchIndex === focusedBranchIndex}
                        className={`subway-fork-lane${lane.empty ? " is-empty" : ""}${branchIndex === focusedBranchIndex ? " is-focused" : ""}`}
                        data-lane-tint={lane.tint}
                        onClick={() => onFocusBranch(row.groupId, branchIndex)}
                    >
                        <span>{lane.label}</span>
                    </button>
                ))}
            </div>
            <button
                type="button"
                className="subway-fork-readout"
                data-role={`rack-fork-${row.groupId}`}
                aria-label={`${row.groupKind === "split" ? "Frequency split" : "Parallel"} group${row.bypassed ? " (bypassed)" : ""}`}
                onPointerDown={gestures.handlePointerDown}
                onPointerMove={gestures.handlePointerMove}
                onPointerUp={gestures.handlePointerUp}
                onPointerCancel={gestures.handlePointerCancel}
                onLostPointerCapture={gestures.handleLostPointerCapture}
                onClick={gestures.handleClick}
                onContextMenu={gestures.handleContextMenu}
            >
                <span data-role={`rack-fork-readout-${row.groupId}`}>{readout}</span>
                <span className="subway-fork-glyph" aria-hidden="true">
                    <span className={row.groupKind === "split" ? "subway-glyph-diamond" : "subway-glyph-dot"} />
                </span>
            </button>
        </div>
    );
}

function SubwayForkConnections({ row, focusedBranchIndex, compactAllocation }: {
    readonly row: Extract<SubwayRow, { kind: "fork" }>;
    readonly focusedBranchIndex: number;
    readonly compactAllocation: SubwayCompactLaneAllocation | null;
}) {
    const laneCount = row.lanes.length;
    return (
        <svg
            className="subway-connector-svg subway-fork-connectors"
            data-role={`rack-fork-connections-${row.groupId}`}
            viewBox={`0 0 ${SUBWAY_CONNECTOR_VIEWBOX_WIDTH} ${SUBWAY_CONNECTOR_VIEWBOX_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <path className="subway-connector-trunk" data-connector-segment="trunk" d={SUBWAY_FORK_TRUNK_PATH} />
            {row.lanes.map((lane, laneIndex) => (
                <path
                    key={laneIndex}
                    className={`subway-connector-branch${lane.empty ? " is-dashed" : ""}${laneIndex === focusedBranchIndex ? " is-focused" : ""}`}
                    data-connector-segment="branch"
                    data-lane-index={laneIndex}
                    data-lane-tint={lane.tint}
                    pathLength={100}
                    d={compactAllocation === null
                        ? subwayForkBranchPath(laneIndex, laneCount)
                        : subwayForkBranchPathAt(requiredLaneCenter(compactAllocation.laneCenters, laneIndex))}
                />
            ))}
        </svg>
    );
}

function SubwayMerge({
    groupId,
    row,
    focusedBranchIndex,
    compactAllocation,
}: {
    readonly groupId: string;
    readonly row: Extract<SubwayRow, { kind: "merge" }>;
    readonly focusedBranchIndex: number;
    readonly compactAllocation: SubwayCompactLaneAllocation | null;
}) {
    const laneCount = row.lanes.length;
    return (
        <div
            className="subway-merge"
            data-reorder-layout-key={`group:${groupId}:merge`}
            aria-hidden="true"
        >
            <svg
                className="subway-connector-svg subway-merge-connectors"
                data-role={`rack-merge-connections-${groupId}`}
                viewBox={`0 0 ${SUBWAY_CONNECTOR_VIEWBOX_WIDTH} ${SUBWAY_CONNECTOR_VIEWBOX_HEIGHT}`}
                preserveAspectRatio="none"
            >
                {row.lanes.map((lane, laneIndex) => (
                    <path
                        key={laneIndex}
                        className={`subway-connector-branch${lane.dashed ? " is-dashed" : ""}${laneIndex === focusedBranchIndex ? " is-focused" : ""}`}
                        data-connector-segment="branch"
                        data-lane-index={laneIndex}
                        data-lane-tint={lane.tint}
                        pathLength={100}
                        d={compactAllocation === null
                            ? subwayMergeBranchPath(laneIndex, laneCount)
                            : subwayMergeBranchPathAt(requiredLaneCenter(compactAllocation.laneCenters, laneIndex))}
                    />
                ))}
                <path className="subway-connector-trunk" data-connector-segment="trunk" d={SUBWAY_MERGE_TRUNK_PATH} />
            </svg>
            {row.lanes.map((lane, laneIndex) => (
                <span
                    key={laneIndex}
                    className="subway-merge-lane"
                    data-lane-tint={lane.tint}
                />
            ))}
            <span className="subway-merge-dot" />
        </div>
    );
}

export function formatCrossoverHz(hz: number): string {
    return hz >= 1000
        ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k`
        : `${Math.round(hz)}`;
}
