import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";

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

const STATION_DRAG_THRESHOLD_PX = 7;
const STATION_LONG_PRESS_MS = 550;
const PHONE_GRAPH_QUERY = "(max-width: 639px)";

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
    readonly selectedDeviceId: string;
    readonly selectedGroupId: string | null;
    readonly reorderingDeviceId: string | null;
    readonly focusedBranchIndices: Readonly<Record<string, number>>;
    readonly accents: Readonly<Record<EffectModuleId, string>>;
    readonly onSelect: (deviceId: string) => void;
    readonly onSelectGroup: (groupId: string) => void;
    readonly onFocusBranch: (groupId: string, branchIndex: number) => void;
    readonly onOpenStationMenu: (request: SubwayStationMenuRequest) => void;
    readonly onOpenGroupMenu: (request: SubwayGroupMenuRequest) => void;
    /** Called once a station drag crosses the reorder threshold. */
    readonly onArmReorder: (deviceId: string, event: ReactPointerEvent<HTMLElement>) => void;
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

function usePhoneGraphLayout(): boolean {
    const [phoneLayout, setPhoneLayout] = useState(() => window.matchMedia(PHONE_GRAPH_QUERY).matches);
    useEffect(() => {
        const query = window.matchMedia(PHONE_GRAPH_QUERY);
        const update = () => setPhoneLayout(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    return phoneLayout;
}

function requiredLaneCenter(laneCenters: ReadonlyArray<number>, laneIndex: number): number {
    const center = laneCenters[laneIndex];
    if (center === undefined) {
        throw new RangeError(`Missing compact subway lane center ${laneIndex}`);
    }
    return center;
}

type StationPointerState = {
    pointerId: number;
    startX: number;
    startY: number;
    longPressTimer: number;
};

/**
 * Tap / drag-arm / long-press disambiguation shared by stations and forks.
 * The pointer is captured at pointerdown (mouse has no implicit capture),
 * so the threshold-crossing move always reaches this element; the workspace
 * steals the capture when a reorder arms.
 */
function usePressableGestures({
    onTap,
    onLongPress,
    onDragArm = null,
}: {
    onTap: () => void;
    onLongPress: (clientX: number, clientY: number) => void;
    onDragArm?: ((event: ReactPointerEvent<HTMLElement>) => void) | null;
}) {
    const pointerStateRef = useRef<StationPointerState | null>(null);
    const suppressClickRef = useRef(false);

    const clearPointerState = useCallback(() => {
        const pointerState = pointerStateRef.current;
        if (pointerState !== null) {
            clearUiTimeout(pointerState.longPressTimer);
            pointerStateRef.current = null;
        }
    }, []);

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        clearPointerState();
        suppressClickRef.current = false;
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Without capture the fast paths still work: the threshold move
            // just has to land on the element itself.
        }
        const { clientX, clientY, pointerId } = event;
        pointerStateRef.current = {
            pointerId,
            startX: clientX,
            startY: clientY,
            longPressTimer: uiTimeout(() => {
                if (pointerStateRef.current?.pointerId === pointerId) {
                    clearPointerState();
                    suppressClickRef.current = true;
                    onLongPress(clientX, clientY);
                }
            }, STATION_LONG_PRESS_MS),
        };
    }, [clearPointerState, onLongPress]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const pointerState = pointerStateRef.current;
        if (pointerState === null || pointerState.pointerId !== event.pointerId || onDragArm === null) {
            return;
        }
        const distance = Math.hypot(
            event.clientX - pointerState.startX,
            event.clientY - pointerState.startY,
        );
        if (distance < STATION_DRAG_THRESHOLD_PX) {
            return;
        }
        clearPointerState();
        suppressClickRef.current = true;
        onDragArm(event);
    }, [clearPointerState, onDragArm]);

    const handlePointerEnd = useCallback(() => {
        clearPointerState();
    }, [clearPointerState]);

    const handleClick = useCallback(() => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        onTap();
    }, [onTap]);

    const handleContextMenu = useCallback((event: { preventDefault: () => void; clientX: number; clientY: number }) => {
        event.preventDefault();
        suppressClickRef.current = true;
        onLongPress(event.clientX, event.clientY);
    }, [onLongPress]);

    return { handlePointerDown, handlePointerMove, handlePointerEnd, handleClick, handleContextMenu };
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

function StationBody({ station, effectId }: {
    readonly station: SubwayStationCell;
    readonly effectId: EffectModuleId;
}) {
    return (
        <span className="subway-station-pill" aria-hidden="true">
            <span className="subway-station-detail">
                <span className="subway-station-icon-well">
                    <StationIcon effectId={effectId} className="subway-station-icon subway-station-icon-detail" />
                </span>
                <span className="subway-station-label">{station.code} {station.instanceNumber}</span>
            </span>
            <span className="subway-station-compact" aria-hidden="true">
                <span className="subway-station-compact-well">
                    <StationIcon effectId={effectId} className="subway-station-icon subway-station-icon-compact" />
                </span>
            </span>
        </span>
    );
}

function StationSummary({ effectId }: { readonly effectId: EffectModuleId }) {
    return (
        <span className="subway-station-summary" aria-hidden="true">
            <span className="subway-station-summary-well">
                <StationIcon effectId={effectId} className="subway-station-icon subway-station-icon-summary" />
            </span>
        </span>
    );
}

function SubwayStation({
    station,
    position,
    asCell,
    accents,
    selectedDeviceId,
    reorderingDeviceId,
    onSelect,
    onOpenStationMenu,
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
    "accents" | "selectedDeviceId" | "reorderingDeviceId"
    | "onSelect" | "onOpenStationMenu" | "onArmReorder" | "onKeyboardMove" | "onFocusBranch">) {
    const effectId = LANE_TYPE_TO_EFFECT_ID.get(station.deviceType);
    if (effectId === undefined) {
        throw new Error(`Unknown lane device type on the map: ${station.deviceType}`);
    }
    const effect = getRackEffectDescriptor(effectId);
    const label = station.instanceNumber > 1
        ? `${effect.label} ${station.instanceNumber}`
        : effect.label;
    const selected = selectedDeviceId === station.deviceId;
    const reordering = reorderingDeviceId === station.deviceId;
    const gestures = usePressableGestures({
        onTap: () => {
            if (branchContext !== null) {
                onFocusBranch(branchContext.groupId, branchContext.branchIndex);
            }
            onSelect(station.deviceId);
        },
        onLongPress: (clientX, clientY) => onOpenStationMenu({ deviceId: station.deviceId, clientX, clientY }),
        onDragArm: (event) => onArmReorder(station.deviceId, event),
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
            className={`${asCell ? "subway-station-cell" : "subway-station-row"}${branchContext === null ? "" : branchContext.focused ? " is-focused-branch" : " is-context-branch"}${selected ? " is-selected" : ""}${station.enabled ? "" : " is-disabled"}${reordering ? " is-reordering" : ""}`}
            style={{ "--station-accent": accents[effectId] } as CSSProperties}
        >
            <button
                type="button"
                data-role={`rack-station-${effectId}`}
                aria-label={`${label}${station.enabled ? "" : " (bypassed)"}${selected ? ", selected" : ""}`}
                className="subway-station"
                onPointerDown={gestures.handlePointerDown}
                onPointerMove={gestures.handlePointerMove}
                onPointerUp={gestures.handlePointerEnd}
                onPointerCancel={gestures.handlePointerEnd}
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
                <StationBody station={station} effectId={effectId} />
            </button>
            {branchContext === null ? null : <StationSummary effectId={effectId} />}
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
                </button>
                <span className="subway-ghost-summary" aria-hidden="true">+</span>
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
        "accents" | "selectedDeviceId" | "reorderingDeviceId"
        | "onSelect" | "onOpenStationMenu" | "onArmReorder" | "onKeyboardMove" | "onFocusBranch">,
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
    selectedDeviceId,
    selectedGroupId,
    reorderingDeviceId,
    focusedBranchIndices,
    accents,
    onSelect,
    onSelectGroup,
    onFocusBranch,
    onOpenStationMenu,
    onOpenGroupMenu,
    onArmReorder,
    onKeyboardMove,
    onRequestAdd,
}: SubwayMapColumnProps) {
    const layout = buildSubwayLayout(laneState);
    const phoneGraphLayout = usePhoneGraphLayout();

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
        reorderingDeviceId,
        onSelect,
        onOpenStationMenu,
        onArmReorder,
        onKeyboardMove,
        onFocusBranch,
    };
    const positionOf = (cell: SubwayStationCell) => stationPositions.get(cell.deviceId) ?? 0;

    // Rows render in order; a group's fork..merge rows nest inside ONE
    // section so bypass dimming and lane alignment stay coherent.
    const rendered: ReactNode[] = [];
    let groupRows: ReactNode[] = [];
    let openGroup: {
        groupId: string;
        bypassed: boolean;
        laneCount: number;
        focusedBranchIndex: number;
    } | null = null;

    const flushGroup = () => {
        if (openGroup === null) {
            return;
        }
        const compactAllocation = subwayCompactLaneAllocation(
            openGroup.laneCount,
            openGroup.focusedBranchIndex,
        );
        rendered.push(
            <div
                key={openGroup.groupId}
                className={`subway-group${openGroup.bypassed ? " is-bypassed" : ""}${selectedGroupId === openGroup.groupId ? " is-selected" : ""}`}
                data-role={`rack-group-${openGroup.groupId}`}
                data-group-id={openGroup.groupId}
                data-lane-count={openGroup.laneCount}
                data-focused-branch-index={openGroup.focusedBranchIndex}
                style={{
                    "--subway-lane-count": openGroup.laneCount,
                    "--subway-lane-gutter": `${SUBWAY_LANE_GUTTER_PERCENT}%`,
                    "--subway-lane-span": `${SUBWAY_LANE_SPAN_PERCENT}%`,
                    "--subway-compact-lane-template": compactAllocation.gridTemplate,
                    "--subway-compact-badge-template": openGroup.laneCount === 4
                        ? "repeat(4, 25%)"
                        : compactAllocation.gridTemplate,
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
            openGroup = {
                groupId: row.groupId,
                bypassed: row.bypassed,
                laneCount: row.lanes.length,
                focusedBranchIndex,
            };
            groupRows.push(
                <SubwayFork
                    key={`fork-${row.groupId}`}
                    row={row}
                    focusedBranchIndex={focusedBranchIndex}
                    phoneGraphLayout={phoneGraphLayout}
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
                    phoneGraphLayout={phoneGraphLayout}
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
            rendered.push(
                <SubwayGhost
                    key={`trunk-ghost-${rowIndex}`}
                    cell={cell}
                    asCell={false}
                    onRequestAdd={onRequestAdd}
                    onFocusBranch={onFocusBranch}
                />,
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
                aria-hidden="true"
            />
        </>
    );
}

function SubwayFork({
    row,
    focusedBranchIndex,
    phoneGraphLayout,
    onSelectGroup,
    onFocusBranch,
    onOpenGroupMenu,
}: {
    readonly row: Extract<SubwayRow, { kind: "fork" }>;
    readonly focusedBranchIndex: number;
    readonly phoneGraphLayout: boolean;
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
        <div className="subway-fork" data-fork-kind={row.groupKind}>
            <SubwayForkConnections
                row={row}
                focusedBranchIndex={focusedBranchIndex}
                phoneGraphLayout={phoneGraphLayout}
            />
            <span className="subway-fork-glyph" aria-hidden="true" />
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
                onPointerUp={gestures.handlePointerEnd}
                onPointerCancel={gestures.handlePointerEnd}
                onClick={gestures.handleClick}
                onContextMenu={gestures.handleContextMenu}
            >
                <span className={row.groupKind === "split" ? "subway-glyph-diamond" : "subway-glyph-dot"} aria-hidden="true" />
                <span data-role={`rack-fork-readout-${row.groupId}`}>{readout}</span>
            </button>
        </div>
    );
}

function SubwayForkConnections({ row, focusedBranchIndex, phoneGraphLayout }: {
    readonly row: Extract<SubwayRow, { kind: "fork" }>;
    readonly focusedBranchIndex: number;
    readonly phoneGraphLayout: boolean;
}) {
    const laneCount = row.lanes.length;
    const compactAllocation = phoneGraphLayout
        ? subwayCompactLaneAllocation(laneCount, focusedBranchIndex)
        : null;
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
    phoneGraphLayout,
}: {
    readonly groupId: string;
    readonly row: Extract<SubwayRow, { kind: "merge" }>;
    readonly focusedBranchIndex: number;
    readonly phoneGraphLayout: boolean;
}) {
    const laneCount = row.lanes.length;
    const compactAllocation = phoneGraphLayout
        ? subwayCompactLaneAllocation(laneCount, focusedBranchIndex)
        : null;
    return (
        <div className="subway-merge" aria-hidden="true">
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
