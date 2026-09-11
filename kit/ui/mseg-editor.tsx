import { addMsegPoint, deleteMsegPoint, deriveMsegSegmentCurvePower, findMsegPointHitIndex, findMsegSegmentHitIndex, moveMsegPoint, msegEditorCoordinatesToPoint, resolveMsegSurfaceOrientation, setMsegSegmentCurvePower, type MsegShape } from "./mseg";
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { MSEG_POINT_RADIUS_PX, MSEG_SELECTED_POINT_RADIUS_PX, createMsegTimeAxisTicks, pointToMsegEditorCoordinates, type MsegPoint, type MsegSurfaceOrientation, type MsegTimeAxisScale } from "./mseg";
import { buildMsegSurfacePaths, buildMsegSegmentPath } from "./mseg-editor-geometry";

/** Class hooks let an application retain its visual language without changing geometry. */
export type MsegEditorClasses = Partial<Record<"grid" | "fill" | "curve" | "highlight" | "pointSelected" | "pointHighlighted" | "pointMuted" | "point" | "timeAxis" | "timeTick" | "timeLabel", string>>;
/** Geometry-only surface for applications that already own gestures and history. */
export type MsegEditorSurfaceProps = {
  surfaceRef: RefObject<SVGSVGElement | null>;
  points: MsegPoint[];
  width: number;
  height: number;
  selectedPointIndex: number;
  hoveredSegmentIndex?: number;
  activeSegmentIndex?: number;
  orientation?: MsegSurfaceOrientation;
  timeAxisScale?: MsegTimeAxisScale;
  onPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  className?: string;
  style?: CSSProperties;
  dataRole?: string;
  curveIdentity?: string;
  attributes?: Readonly<Record<`data-${string}`, string>>;
  classes?: MsegEditorClasses;
  underlay?: ReactNode;
  overlay?: ReactNode;
};
/** Draw one editable curve. Other curves and product-specific controls are composition slots. */
export function MsegEditorSurface({
  surfaceRef,
  points,
  width,
  height,
  selectedPointIndex,
  hoveredSegmentIndex = -1,
  activeSegmentIndex = -1,
  orientation = "horizontal",
  timeAxisScale,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onPointerUp,
  className,
  style,
  dataRole,
  curveIdentity,
  attributes,
  classes = {},
  underlay,
  overlay
}: MsegEditorSurfaceProps) {
  const emphasized = activeSegmentIndex >= 0 ? activeSegmentIndex : hoveredSegmentIndex;
  const {
    curvePath,
    fillPath,
    metrics
  } = buildMsegSurfacePaths(points, width, height, {
    orientation
  });
  const highlight = emphasized >= 0 ? buildMsegSegmentPath(points, emphasized, width, height, {
    orientation
  }) : "";
  const ticks = timeAxisScale === undefined ? [] : createMsegTimeAxisTicks(timeAxisScale);
  return <svg ref={surfaceRef} data-role={dataRole} data-time-axis={orientation} {...attributes} className={className} style={{
    width: "100%",
    height: "100%",
    touchAction: "none",
    overflow: "hidden",
    borderRadius: 20,
    background: "rgba(255,255,255,.03)",
    ...style
  }} viewBox={`0 0 ${width} ${height}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onLostPointerCapture={onPointerUp}>
        <g>{[.25, .5, .75].map(step => <line key={`editable-h-${step}`} className={classes.grid} stroke="rgba(255,255,255,.1)" x1={metrics.plotLeft} y1={metrics.plotTop + metrics.plotHeight * (1 - step)} x2={metrics.plotRight} y2={metrics.plotTop + metrics.plotHeight * (1 - step)} />)}{[.25, .5, .75].map(step => <line key={`editable-v-${step}`} className={classes.grid} stroke="rgba(255,255,255,.1)" x1={metrics.plotLeft + metrics.plotWidth * step} y1={metrics.plotTop} x2={metrics.plotLeft + metrics.plotWidth * step} y2={metrics.plotBottom} />)}</g>
        {underlay}
        <path data-role="mseg-base-fill" data-shape-identity={curveIdentity} className={classes.fill} fill={classes.fill ? undefined : "currentColor"} fillOpacity={classes.fill ? undefined : .12} d={fillPath} />
        <path data-role="mseg-base-curve" data-shape-identity={curveIdentity} className={classes.curve} fill="none" stroke="currentColor" strokeWidth={2} d={curvePath} />
        {overlay}
        {highlight ? <path data-role="mseg-highlight-segment" data-segment-index={String(emphasized)} className={classes.highlight} fill="none" stroke="currentColor" strokeWidth={3} d={highlight} /> : null}
        <g data-role="mseg-edit-points" data-shape-identity={curveIdentity}>{points.map((point, index) => {
        const coordinates = pointToMsegEditorCoordinates(point, width, height, {
          orientation
        });
        const state = emphasized >= 0 ? index === emphasized || index === emphasized + 1 ? "highlighted" : "muted" : index === selectedPointIndex ? "selected" : "default";
        const pointClass = state === "selected" ? classes.pointSelected : state === "highlighted" ? classes.pointHighlighted : state === "muted" ? classes.pointMuted : classes.point;
        return <circle key={`point-${index}-${point.x}-${point.y}`} data-role="mseg-point" data-point-index={String(index)} data-point-state={state} cx={coordinates.x} cy={coordinates.y} r={state === "selected" ? MSEG_SELECTED_POINT_RADIUS_PX : MSEG_POINT_RADIUS_PX} className={pointClass} fill={pointClass ? undefined : "currentColor"} stroke={pointClass ? undefined : "currentColor"} vectorEffect="non-scaling-stroke" />;
      })}</g>
        {ticks.length ? <g data-role="mseg-time-axis" data-time-unit={timeAxisScale?.kind} className={classes.timeAxis} aria-hidden="true">{ticks.map(tick => {
        const vertical = orientation === "vertical",
          x = vertical ? metrics.plotLeft : metrics.plotLeft + metrics.plotWidth * tick.fraction,
          y = vertical ? metrics.plotTop + metrics.plotHeight * tick.fraction : metrics.plotBottom;
        return <g key={`mseg-time-${tick.fraction}`}><line data-role="mseg-time-tick" data-axis-fraction={String(tick.fraction)} className={classes.timeTick} stroke="currentColor" x1={x} y1={y} x2={vertical ? x + 6 : x} y2={vertical ? y : y - 6} /><text data-role="mseg-time-label" data-axis-fraction={String(tick.fraction)} className={classes.timeLabel} fill="currentColor" fontSize={11} x={vertical ? x + 9 : x} y={vertical ? y : y - 9} textAnchor={vertical ? "start" : "middle"} dominantBaseline={vertical ? "middle" : undefined}>{tick.label}</text></g>;
      })}</g> : null}
    </svg>;
}

/** One curve editor; persistence, undo grouping, and surrounding controls belong to its owner. */
export type MsegEditorProps = {
  value: MsegShape;
  onChange: (value: MsegShape) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (cancelled: boolean) => void;
  timeAxisScale?: MsegTimeAxisScale;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
};
/** Point/segment gestures use the same hit testing and editing math as the DSP curve preparation. */
export function MsegEditor({
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
  timeAxisScale,
  className,
  style,
  ariaLabel = "MSEG curve"
}: MsegEditorProps) {
  const surfaceRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({
    width: 1,
    height: 1
  });
  const [orientation, setOrientation] = useState<MsegSurfaceOrientation>("horizontal");
  const [selected, setSelected] = useState(0),
    [hovered, setHovered] = useState(-1),
    [activeSegment, setActiveSegment] = useState(-1);
  const current = useRef(value);
  current.current = value;
  const callbacks = useRef({
    onChange,
    onGestureEnd
  });
  callbacks.current = {
    onChange,
    onGestureEnd
  };
  const drag = useRef<{
    pointerId: number;
    kind: "point" | "segment";
    index: number;
    startX: number;
    startY: number;
    moved: boolean;
    original: MsegShape;
  } | null>(null);
  const finish = (cancelled = false, pointerId?: number) => {
    const active = drag.current;
    if (!active || pointerId !== undefined && active.pointerId !== pointerId) return;
    drag.current = null;
    setActiveSegment(-1);
    if (cancelled) {
      current.current = active.original;
      callbacks.current.onChange(active.original);
    }
    callbacks.current.onGestureEnd?.(cancelled);
    if (surfaceRef.current?.hasPointerCapture(active.pointerId)) surfaceRef.current.releasePointerCapture(active.pointerId);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const resize = () => {
      const bounds = surface.getBoundingClientRect();
      const next = {
        width: Math.max(1, bounds.width),
        height: Math.max(1, bounds.height)
      };
      setSize(next);
      setOrientation(previous => resolveMsegSurfaceOrientation(next.width, next.height, previous));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    const cancel = () => finishRef.current(true);
    window.addEventListener("blur", cancel);
    return () => {
      observer.disconnect();
      window.removeEventListener("blur", cancel);
      finishRef.current(true);
    };
  }, []);
  const publish = (shape: MsegShape) => {
    current.current = shape;
    onChange(shape);
  };
  const location = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect(),
      x = event.clientX - bounds.left,
      y = event.clientY - bounds.top;
    const options = {
      orientation
    };
    const point = findMsegPointHitIndex(current.current, x, y, bounds.width, bounds.height, undefined, options);
    return {
      point,
      segment: point >= 0 ? -1 : findMsegSegmentHitIndex(current.current, x, y, bounds.width, bounds.height, undefined, options),
      position: msegEditorCoordinatesToPoint(x, y, bounds.width, bounds.height, options)
    };
  };
  return <div className={className} style={{
    height: 180,
    color: "#67e8f9",
    ...style
  }} role="group" aria-label={ariaLabel}>
        <MsegEditorSurface surfaceRef={surfaceRef} points={value.points} width={size.width} height={size.height} selectedPointIndex={selected} hoveredSegmentIndex={hovered} activeSegmentIndex={activeSegment} orientation={orientation} timeAxisScale={timeAxisScale} dataRole="mseg-editor" onPointerDown={event => {
      if (event.button !== 0 || drag.current) return;
      const hit = location(event);
      onGestureStart?.();
      if (hit.point < 0 && hit.segment < 0) {
        const next = addMsegPoint(current.current, hit.position.x, hit.position.y);
        publish(next);
        setSelected(next.points.findIndex(p => p.x === hit.position.x && p.y === hit.position.y));
        onGestureEnd?.(false);
        event.preventDefault();
        return;
      }
      drag.current = {
        pointerId: event.pointerId,
        kind: hit.point >= 0 ? "point" : "segment",
        index: hit.point >= 0 ? hit.point : hit.segment,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        original: current.current
      };
      if (hit.point >= 0) setSelected(hit.point);else setActiveSegment(hit.segment);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }} onPointerMove={event => {
      const hit = location(event),
        active = drag.current;
      if (!active || active.pointerId !== event.pointerId) {
        setHovered(hit.segment);
        return;
      }
      if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 3) active.moved = true;
      if (active.kind === "point") publish(moveMsegPoint(current.current, active.index, hit.position.x, hit.position.y));else publish(setMsegSegmentCurvePower(current.current, active.index, deriveMsegSegmentCurvePower(current.current, active.index, hit.position.x, hit.position.y)));
      event.preventDefault();
    }} onPointerLeave={() => {
      if (!drag.current) setHovered(-1);
    }} onPointerUp={event => {
      const active = drag.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const cancelled = event.type !== "pointerup";
      if (!cancelled && active.kind === "point" && !active.moved && active.index > 0 && active.index < current.current.points.length - 1) {
        publish(deleteMsegPoint(current.current, active.index));
        setSelected(Math.max(0, active.index - 1));
      }
      finish(cancelled, event.pointerId);
    }} />
    </div>;
}
