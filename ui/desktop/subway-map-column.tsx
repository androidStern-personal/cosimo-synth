import {
    useCallback,
    useMemo,
    useRef,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";

import { EFFECT_ID_TO_LANE_TYPE, type LaneState } from "../shared/lane-state";
import { upgradeLaneStateV1 } from "../shared/lane-state-v2";
import {
    buildSubwayLayout,
    type SubwayStationCell,
} from "../shared/lane-subway-layout";
import type { LaneDeviceType } from "../shared/lane-modulation-targets";
import { getRackEffectDescriptor } from "../shared/rack-parameter-descriptors";
import type { EffectModuleId } from "../shared/target-descriptor";

/**
 * The subway-map rack column (M3, locked direction: canvas "FX Rack Subway
 * Map"). The rack list becomes a line map — the whole topology always in
 * view, devices shrunk to STATION PILLS on an infra-teal line. The v1
 * document is serial, so today's map is a single line of stations; the fork
 * and merge rows of the layout model render when the add/remove UX (M4) can
 * actually create groups.
 *
 * Gestures, per the accepted mocks: TAP selects the station (opens its
 * editor), DRAGGING a station along the line reorders it (the same physics
 * as the old row reorder — the workspace's preview machinery is reused
 * verbatim through data-rack-effect-id), and LONG-PRESS (or right-click)
 * opens the station menu carrying what the old row offered: bypass and
 * exact value. The per-row quick slider is gone by design — quick edits
 * live in the editor, one tap away.
 *
 * Each station ROW keeps a >=44px hit area; the pill is the visual inside
 * it. Rows are the list's direct children, so position-based selectors and
 * the reorder preview keep their contract with the old column.
 */

const STATION_DRAG_THRESHOLD_PX = 7;
const STATION_LONG_PRESS_MS = 550;

const LANE_TYPE_TO_EFFECT_ID: ReadonlyMap<LaneDeviceType, EffectModuleId> = new Map(
    (Object.entries(EFFECT_ID_TO_LANE_TYPE) as Array<[EffectModuleId, LaneDeviceType]>)
        .map(([effectId, deviceType]) => [deviceType, effectId]),
);

export type SubwayStationMenuRequest = {
    readonly effectId: EffectModuleId;
    readonly clientX: number;
    readonly clientY: number;
};

type SubwayMapColumnProps = {
    readonly laneState: LaneState;
    readonly previewOrder: ReadonlyArray<EffectModuleId>;
    readonly selectedEffectId: EffectModuleId;
    readonly reorderingEffectId: EffectModuleId | null;
    readonly accents: Readonly<Record<EffectModuleId, string>>;
    readonly onSelect: (effectId: EffectModuleId) => void;
    readonly onOpenStationMenu: (request: SubwayStationMenuRequest) => void;
    /** Called once a station drag crosses the reorder threshold. */
    readonly onArmReorder: (effectId: EffectModuleId, event: ReactPointerEvent<HTMLElement>) => void;
    readonly onKeyboardMove: (effectId: EffectModuleId, offset: -1 | 1) => void;
};

type StationPointerState = {
    pointerId: number;
    effectId: EffectModuleId;
    startX: number;
    startY: number;
    longPressTimer: number;
};

function SubwayStation({
    station,
    effectId,
    position,
    accent,
    selected,
    reordering,
    onSelect,
    onOpenStationMenu,
    onArmReorder,
    onKeyboardMove,
}: {
    readonly station: SubwayStationCell;
    readonly effectId: EffectModuleId;
    readonly position: number;
    readonly accent: string;
    readonly selected: boolean;
    readonly reordering: boolean;
    readonly onSelect: (effectId: EffectModuleId) => void;
    readonly onOpenStationMenu: (request: SubwayStationMenuRequest) => void;
    readonly onArmReorder: (effectId: EffectModuleId, event: ReactPointerEvent<HTMLElement>) => void;
    readonly onKeyboardMove: (effectId: EffectModuleId, offset: -1 | 1) => void;
}) {
    const effect = getRackEffectDescriptor(effectId);
    const pointerStateRef = useRef<StationPointerState | null>(null);
    // A drag or an opened menu consumes the gesture: the trailing click that
    // browsers still deliver must not change the selection underneath it.
    const suppressClickRef = useRef(false);

    const clearPointerState = useCallback(() => {
        const pointerState = pointerStateRef.current;
        if (pointerState !== null) {
            window.clearTimeout(pointerState.longPressTimer);
            pointerStateRef.current = null;
        }
    }, []);

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        clearPointerState();
        suppressClickRef.current = false;
        // Hold the pointer so the move that crosses the lift threshold always
        // reaches this station, wherever the cursor has strayed by then
        // (touch captures implicitly; mouse does not). The workspace's
        // reorder machinery steals the capture at arm time.
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // Without capture the fast paths still work: the threshold move
            // just has to land on the station itself.
        }
        const { clientX, clientY, pointerId } = event;
        pointerStateRef.current = {
            pointerId,
            effectId,
            startX: clientX,
            startY: clientY,
            longPressTimer: window.setTimeout(() => {
                if (pointerStateRef.current?.pointerId === pointerId) {
                    clearPointerState();
                    suppressClickRef.current = true;
                    onOpenStationMenu({ effectId, clientX, clientY });
                }
            }, STATION_LONG_PRESS_MS),
        };
    }, [clearPointerState, effectId, onOpenStationMenu]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
        const pointerState = pointerStateRef.current;
        if (pointerState === null || pointerState.pointerId !== event.pointerId) {
            return;
        }
        const distance = Math.hypot(
            event.clientX - pointerState.startX,
            event.clientY - pointerState.startY,
        );
        if (distance < STATION_DRAG_THRESHOLD_PX) {
            return;
        }
        // The station lifts onto the line: the workspace's reorder machinery
        // takes the pointer from here (list-level capture, live preview).
        clearPointerState();
        suppressClickRef.current = true;
        onArmReorder(effectId, event);
    }, [clearPointerState, effectId, onArmReorder]);

    const handlePointerEnd = useCallback(() => {
        clearPointerState();
    }, [clearPointerState]);

    const handleClick = useCallback(() => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        onSelect(effectId);
    }, [effectId, onSelect]);

    const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            onKeyboardMove(effectId, -1);
        } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            onKeyboardMove(effectId, 1);
        }
    }, [effectId, onKeyboardMove]);

    return (
        <div
            data-role={`rack-module-${effectId}`}
            data-rack-effect-id={effectId}
            data-rack-position={position}
            data-effect-id={effectId}
            data-enabled={station.enabled ? "true" : "false"}
            data-drag-dwell={`rack-effect:${effectId}`}
            className={`subway-station-row${selected ? " is-selected" : ""}${station.enabled ? "" : " is-disabled"}${reordering ? " is-reordering" : ""}`}
            style={{ "--station-accent": accent } as CSSProperties}
        >
            <button
                type="button"
                data-role={`rack-station-${effectId}`}
                aria-label={`${effect.label}${station.enabled ? "" : " (bypassed)"}${selected ? ", selected" : ""}`}
                className="subway-station"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                // NO pointerleave cancellation: a captured pointer still
                // fires boundary events as it crosses the pill's edge, and
                // the very move that should arm the reorder would cancel the
                // gesture first.
                onClick={handleClick}
                onContextMenu={(event) => {
                    event.preventDefault();
                    suppressClickRef.current = true;
                    onOpenStationMenu({ effectId, clientX: event.clientX, clientY: event.clientY });
                }}
                onKeyDown={handleKeyDown}
            >
                <span className="subway-station-pill" aria-hidden="true">
                    <span className="subway-station-code">{station.code}</span>
                    <span className="subway-station-number">{station.instanceNumber}</span>
                </span>
            </button>
        </div>
    );
}

export function SubwayMapColumn({
    laneState,
    previewOrder,
    selectedEffectId,
    reorderingEffectId,
    accents,
    onSelect,
    onOpenStationMenu,
    onArmReorder,
    onKeyboardMove,
}: SubwayMapColumnProps) {
    // The document is projected through the SAME pipeline the tree will use:
    // v1 upgrades to the lane.v2 form and the layout model scripts the map.
    // The preview order rides the projection so a live drag reorders the
    // stations exactly as it reordered the rows.
    const stations = useMemo(() => {
        const layout = buildSubwayLayout(upgradeLaneStateV1({ ...laneState, order: previewOrder }));
        return layout.rows.flatMap((row) => (
            row.kind === "stations"
                ? row.cells.filter((cell): cell is SubwayStationCell => cell.kind === "station")
                : []
        ));
    }, [laneState, previewOrder]);

    return (
        <>
            {stations.map((station, position) => {
                const effectId = LANE_TYPE_TO_EFFECT_ID.get(station.deviceType);
                if (effectId === undefined) {
                    throw new Error(`Unknown lane device type on the map: ${station.deviceType}`);
                }
                return (
                    <SubwayStation
                        key={station.deviceId}
                        station={station}
                        effectId={effectId}
                        position={position}
                        accent={accents[effectId]}
                        selected={selectedEffectId === effectId}
                        reordering={reorderingEffectId === effectId}
                        onSelect={onSelect}
                        onOpenStationMenu={onOpenStationMenu}
                        onArmReorder={onArmReorder}
                        onKeyboardMove={onKeyboardMove}
                    />
                );
            })}
        </>
    );
}
