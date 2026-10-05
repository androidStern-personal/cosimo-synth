import { COMPRESSOR_DEFAULTS, evaluateCompressorTransfer } from "./dynamics-model";
import {
  SHAPER_MAX_POINTS,
  clamp,
  effectiveShapePoints,
  evaluateBowedOutput,
  evaluateBipolarTransfer,
  finiteOr,
  morphOwner,
  rawShapePoint,
  shapePointCount,
  shapePointEndpointIDs,
  type CurveLabValues,
  type ShapePoint,
  type ShapeSide,
} from "./curve-model";

/**
 * How the graphs read and change the plugin's sound. A drag opens one gesture
 * and moves parameters inside it, so it is one Undo entry; a button or typed
 * value is one edit.
 */
export interface CurveLabSound {
  /** The current parameter values. */
  values(): CurveLabValues;
  /** Change several parameters together as one Undo entry. */
  edit(changes: { readonly [endpointID: string]: number }): void;
  beginGesture(endpointIDs: readonly string[]): void;
  /** Move one parameter inside the open gesture. */
  set(endpointID: string, value: number): void;
  endGesture(): void;
}

/** A frame from the DSP's meterOut endpoint. */
export interface MeterFrame {
  readonly compressorInputDb?: number;
  readonly compressorOutputDb?: number;
  readonly gainReductionDb?: number;
  readonly clipInput?: number;
  readonly clipOutput?: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** A graph's value range and where its plot sits in SVG coordinates. */
interface Axis {
  readonly minimum: number;
  readonly maximum: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const COMPRESSOR_AXIS: Axis = Object.freeze({
  minimum: -48,
  maximum: 12,
  left: 54,
  right: 746,
  top: 18,
  bottom: 262,
});

const SHAPER_AXIS: Axis = Object.freeze({
  minimum: -1.5,
  maximum: 1.5,
  left: 44,
  right: 756,
  top: 18,
  bottom: 402,
});

function mapX(value: number, axis: Axis): number {
  return axis.left + ((value - axis.minimum) / (axis.maximum - axis.minimum)) * (axis.right - axis.left);
}

function mapY(value: number, axis: Axis): number {
  return axis.bottom - ((value - axis.minimum) / (axis.maximum - axis.minimum)) * (axis.bottom - axis.top);
}

function sampledPath({ minimum, maximum, samples, evaluate, axis }: {
  readonly minimum: number;
  readonly maximum: number;
  readonly samples: number;
  readonly evaluate: (input: number) => number;
  readonly axis: Axis;
}): string {
  const commands: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const input = minimum + ((maximum - minimum) * index) / samples;
    const output = clamp(evaluate(input), axis.minimum, axis.maximum);
    commands.push(
      (index === 0 ? "M" : "L")
        + mapX(input, axis).toFixed(2)
        + ","
        + mapY(output, axis).toFixed(2),
    );
  }
  return commands.join(" ");
}

/** The graph value under a pointer position. */
function graphValueAt(svg: SVGSVGElement, axis: Axis, clientX: number, clientY: number): GraphValue {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const screen = svg.getScreenCTM();
  const local = screen ? point.matrixTransform(screen.inverse()) : point;
  const span = axis.maximum - axis.minimum;
  return {
    input: axis.minimum + ((local.x - axis.left) / (axis.right - axis.left)) * span,
    output: axis.minimum + ((axis.bottom - local.y) / (axis.bottom - axis.top)) * span,
  };
}

function createSvgElement<Name extends keyof SVGElementTagNameMap>(name: Name, attributes: { readonly [name: string]: string | number } = {}): SVGElementTagNameMap[Name] {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, String(value));
  return element;
}

function sideLabel(side: ShapeSide): string {
  return side === "negative" ? "Negative" : "Positive";
}

/** The selected point, segment, or Morph B handle; the inspector edits its exact numbers. */
interface Selection {
  readonly kind: "point" | "segment" | "morph";
  readonly side: ShapeSide;
  index: number;
}

interface GestureBase {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly handle: SVGGraphicsElement;
  changed: boolean;
}

/** A compressor handle drag: one parameter, relative to where the pointer started. */
interface CompressorGesture extends GestureBase {
  readonly kind: "compressor";
  readonly control: CompressorHandle;
  readonly endpointID: string;
  readonly startPointer: GraphValue;
  readonly startValue: number;
  readonly startOutput: number;
}

/** A point or Morph handle drag: input and output together. */
interface PointGesture extends GestureBase {
  readonly kind: "point";
  readonly side: ShapeSide;
  readonly endpointIDs: { readonly x: string; readonly y: string };
  readonly startPointer: GraphValue;
  readonly startX: number;
  readonly startY: number;
  readonly minimumX: number;
  readonly maximumX: number;
}

/** A segment drag: its bend. */
interface BendGesture extends GestureBase {
  readonly kind: "bend";
  readonly side: ShapeSide;
  readonly endpointID: string;
  readonly startPointer: GraphValue;
  readonly startValue: number;
}

/** A visible waveshaper point: its effective position and, for the Morph owner, its raw A handle position. */
interface GraphPoint extends ShapePoint {
  readonly input: number;
  readonly handleInput: number;
  readonly handleOutput: number;
}

interface GraphSegment {
  readonly side: ShapeSide;
  readonly index: number;
  readonly path: string;
}

interface ShapeGeometry {
  readonly points: readonly GraphPoint[];
  readonly segments: readonly GraphSegment[];
}

const COMPRESSOR_HANDLE_ENDPOINTS = Object.freeze({
  threshold: "thresholdDb",
  ratio: "ratio",
  knee: "kneeDb",
  makeup: "makeupDb",
} as const);

function compressorHandleOf(handle: SVGGraphicsElement): CompressorHandle {
  const name = handle.dataset.graphHandle;
  return name === "threshold" || name === "knee" || name === "makeup" ? name : "ratio";
}

function handleSide(handle: SVGGraphicsElement): ShapeSide {
  return handle.dataset.shapeSide === "negative" ? "negative" : "positive";
}

function closestHandle(event: Event, selector: string): SVGGraphicsElement | null {
  return event.target instanceof Element ? event.target.closest<SVGGraphicsElement>(selector) : null;
}

type Gesture = CompressorGesture | PointGesture | BendGesture;
type CompressorHandle = "threshold" | "ratio" | "knee" | "makeup";
interface GraphValue { readonly input: number; readonly output: number }

function required<Found extends Element>(root: ParentNode, selector: string): Found {
  const element = root.querySelector<Found>(selector);
  if (!element) throw new Error(`The Curve Lab surface is missing ${selector}.`);
  return element;
}

/**
 * Drives the compressor and waveshaper graphs inside `root`: draws them from
 * the sound's values and turns handle drags, point buttons and typed values
 * into edits.
 */
export function createPolishGraphStudio({ root, sound }: { readonly root: HTMLElement; readonly sound: CurveLabSound }) {
  const values = () => sound.values();
  const compressorCurve = required<SVGPathElement>(root, "[data-compressor-curve]");
  const compressorSvg = required<SVGSVGElement>(root, '[data-transfer-graph="compressor"]');
  const compressorSummary = required<HTMLElement>(root, "[data-compressor-summary]");
  const compressorOperatingPoint = required<SVGCircleElement>(root, "[data-compressor-operating-point]");
  const kneeConnector = required<SVGPathElement>(root, "[data-knee-connector]");
  const compressorReadout = required<SVGGElement>(root, "[data-compressor-readout]");
  const compressorReadoutText = required<SVGTextElement>(root, "[data-compressor-readout-text]");
  const gainReductionTrace = required<SVGPathElement>(root, "[data-gain-reduction-trace]");
  const shaperSvg = required<SVGSVGElement>(root, '[data-transfer-graph="shaper"]');
  const shaperCurve = required<SVGPathElement>(root, "[data-shaper-curve]");
  const shaperSegments = required<SVGGElement>(root, "[data-shape-segments]");
  const shaperPoints = required<SVGGElement>(root, "[data-shape-points]");
  const morphVisuals = required<SVGGElement>(root, "[data-morph-visuals]");
  const shaperOperatingPoint = required<SVGCircleElement>(root, "[data-shaper-operating-point]");
  const shaperReadout = required<SVGGElement>(root, "[data-shaper-readout]");
  const shaperReadoutText = required<SVGTextElement>(root, "[data-shaper-readout-text]");
  const selectionLabel = required<HTMLElement>(root, "[data-shape-selection]");
  const morphOwnerLabel = required<HTMLElement>(root, "[data-morph-owner]");
  const addPointButton = required<HTMLButtonElement>(root, "[data-shape-add]");
  const deletePointButton = required<HTMLButtonElement>(root, "[data-shape-delete]");
  const assignMorphButton = required<HTMLButtonElement>(root, "[data-morph-assign]");
  const inspectorLabel = required<HTMLElement>(root, "[data-shape-inspector-label]");
  const exactFields = {
    input: required<HTMLInputElement>(root, '[data-shape-exact-field="input"]'),
    output: required<HTMLInputElement>(root, '[data-shape-exact-field="output"]'),
    bend: required<HTMLInputElement>(root, '[data-shape-exact-field="bend"]'),
  };
  const exactFieldWraps = {
    input: required<HTMLElement>(root, '[data-shape-exact-wrap="input"]'),
    output: required<HTMLElement>(root, '[data-shape-exact-wrap="output"]'),
    bend: required<HTMLElement>(root, '[data-shape-exact-wrap="bend"]'),
  };
  const reductionHistory: number[] = [];
  let selection: Selection = { kind: "point", side: "positive", index: 1 };
  let activeGesture: Gesture | undefined;

  function renderCompressor() {
    compressorCurve.setAttribute("d", sampledPath({
      minimum: COMPRESSOR_AXIS.minimum,
      maximum: COMPRESSOR_AXIS.maximum,
      samples: 240,
      evaluate: input => evaluateCompressorTransfer(input, values()),
      axis: COMPRESSOR_AXIS,
    }));

    const threshold = finiteOr(values().thresholdDb, COMPRESSOR_DEFAULTS.thresholdDb);
    const ratio = finiteOr(values().ratio, COMPRESSOR_DEFAULTS.ratio);
    const knee = finiteOr(values().kneeDb, COMPRESSOR_DEFAULTS.kneeDb);
    const makeup = finiteOr(values().makeupDb, COMPRESSOR_DEFAULTS.makeupDb);
    compressorSummary.textContent = threshold.toFixed(1)
      + " dB · "
      + ratio.toFixed(2)
      + ":1 · "
      + knee.toFixed(1)
      + " dB knee";

    const kneeInput = clamp(threshold + knee * 0.5, COMPRESSOR_AXIS.minimum, COMPRESSOR_AXIS.maximum);
    const kneeCurveY = mapY(evaluateCompressorTransfer(kneeInput, values()), COMPRESSOR_AXIS);
    const kneeHandleY = clamp(kneeCurveY - 32, COMPRESSOR_AXIS.top, COMPRESSOR_AXIS.bottom);
    const handles = {
      threshold: [
        threshold,
        mapY(evaluateCompressorTransfer(threshold, values()), COMPRESSOR_AXIS),
      ],
      ratio: [
        COMPRESSOR_AXIS.maximum,
        mapY(evaluateCompressorTransfer(COMPRESSOR_AXIS.maximum, values()), COMPRESSOR_AXIS),
      ],
      knee: [
        kneeInput,
        kneeHandleY,
      ],
      makeup: [
        -36,
        mapY(evaluateCompressorTransfer(-36, values()), COMPRESSOR_AXIS),
      ],
    };

    kneeConnector.setAttribute(
      "d",
      "M" + mapX(kneeInput, COMPRESSOR_AXIS).toFixed(2) + "," + kneeHandleY.toFixed(2)
        + "L" + mapX(kneeInput, COMPRESSOR_AXIS).toFixed(2) + ","
        + clamp(kneeCurveY, COMPRESSOR_AXIS.top, COMPRESSOR_AXIS.bottom).toFixed(2),
    );

    for (const [name, position] of Object.entries(handles)) {
      const handle = root.querySelector('[data-graph-handle="' + name + '"]');
      handle?.setAttribute(
        "transform",
        "translate(" + mapX(position[0], COMPRESSOR_AXIS).toFixed(2)
          + " " + clamp(position[1], COMPRESSOR_AXIS.top, COMPRESSOR_AXIS.bottom).toFixed(2) + ")",
      );
    }
  }

  function segmentPath(side: ShapeSide, left: ShapePoint, right: ShapePoint): string {
    const commands: string[] = [];
    for (let sample = 0; sample <= 28; sample += 1) {
      const position = sample / 28;
      const magnitude = left.x + (right.x - left.x) * position;
      const output = evaluateBowedOutput(left.y, right.y, position, right.bend);
      const input = side === "negative" ? -magnitude : magnitude;
      commands.push(
        (sample === 0 ? "M" : "L")
          + mapX(input, SHAPER_AXIS).toFixed(2)
          + ","
          + mapY(output, SHAPER_AXIS).toFixed(2),
      );
    }
    return commands.join(" ");
  }

  function currentShapeGeometry(): ShapeGeometry {
    const points: GraphPoint[] = [];
    const segments: GraphSegment[] = [];
    const owner = morphOwner(values());
    for (const side of ["negative", "positive"] as const) {
      const sidePoints = effectiveShapePoints(values(), side);
      for (let index = 1; index < sidePoints.length; index += 1) {
        const point = sidePoints[index];
        const ownsMorph = side === owner.side && point.index === owner.index;
        const raw = ownsMorph ? rawShapePoint(values(), side, point.index) : point;
        const sign = side === "negative" ? -1 : 1;
        points.push({
          ...point,
          side,
          input: sign * point.x,
          handleInput: sign * raw.x,
          handleOutput: raw.y,
        });
        segments.push({
          side,
          index,
          path: segmentPath(side, sidePoints[index - 1], point),
        });
      }
    }
    return { points, segments };
  }

  function renderSelection() {
    const count = shapePointCount(values(), selection.side);
    if (selection.index > count) selection.index = count;
    const selectionName = selection.kind === "morph"
      ? "Morph B"
      : sideLabel(selection.side) + " " + selection.kind + " " + selection.index;
    selectionLabel.textContent = selectionName;
    addPointButton.disabled = count >= SHAPER_MAX_POINTS || selection.kind === "morph";
    deletePointButton.disabled = selection.kind !== "point" || count <= 1;
    const owner = morphOwner(values());
    morphOwnerLabel.textContent = "Morph A: " + sideLabel(owner.side) + " point " + owner.index;

    inspectorLabel.textContent = selectionName;
    const hasCoordinates = selection.kind === "point" || selection.kind === "morph";
    exactFieldWraps.input.hidden = !hasCoordinates;
    exactFieldWraps.output.hidden = !hasCoordinates;
    exactFieldWraps.bend.hidden = hasCoordinates;
    const point = rawShapePoint(values(), selection.side, selection.index);
    if (hasCoordinates) {
      const inputMagnitude = selection.kind === "morph"
        ? Number(values().morphTargetX)
        : point.x;
      const output = selection.kind === "morph"
        ? Number(values().morphTargetY)
        : point.y;
      exactFields.input.min = selection.side === "negative" ? "-1.5" : "0.01";
      exactFields.input.max = selection.side === "negative" ? "-0.01" : "1.5";
      exactFields.input.value = String(selection.side === "negative" ? -inputMagnitude : inputMagnitude);
      exactFields.output.value = String(output);
    } else {
      exactFields.bend.value = String(point.bend);
    }
  }

  function updateStableGeometry(geometry: ShapeGeometry) {
    for (const segment of geometry.segments) {
      shaperSegments.querySelector(
        '[data-shape-side="' + segment.side + '"][data-shape-index="' + segment.index + '"]',
      )?.setAttribute("d", segment.path);
    }
    for (const point of geometry.points) {
      const handle = shaperPoints.querySelector<SVGGElement>(
        '[data-shape-side="' + point.side + '"][data-shape-index="' + point.index + '"]',
      );
      handle?.setAttribute(
        "transform",
        "translate(" + mapX(point.handleInput, SHAPER_AXIS) + " " + mapY(point.handleOutput, SHAPER_AXIS) + ")",
      );
      if (handle) {
        handle.dataset.shapeInput = String(point.input);
        handle.dataset.shapeOutput = String(point.y);
        handle.dataset.shapeHandleInput = String(point.handleInput);
        handle.dataset.shapeHandleOutput = String(point.handleOutput);
        if (handle.dataset.morphEndpoint === "A") {
          handle.dataset.morphInput = String(point.handleInput);
          handle.dataset.morphOutput = String(point.handleOutput);
        }
      }
    }
  }

  /** Morph B: where the assigned point travels to at Morph 100%. Point A is drawn as that point's own handle. */
  function renderMorphTarget() {
    const owner = morphOwner(values());
    const point = rawShapePoint(values(), owner.side, owner.index);
    const x = finiteOr(values().morphTargetX, point.x);
    const y = finiteOr(values().morphTargetY, point.y);
    const input = owner.side === "negative" ? -x : x;
    if (!activeGesture) morphVisuals.replaceChildren();
    let handle = morphVisuals.querySelector<SVGGElement>('[data-morph-endpoint="B"]');
    if (!handle) {
      handle = createSvgElement("g", {
        "data-morph-endpoint": "B",
        role: "slider",
        tabindex: "0",
        "aria-label": "Morph B position",
        "aria-description": "Drag in two dimensions to set Morph position B.",
        "data-control-help": "Morph B: drag in two dimensions.",
      });
      const label = createSvgElement("text", { class: "morph-endpoint-label", x: 0, y: 0 });
      label.textContent = "B";
      handle.append(
        createSvgElement("circle", { class: "morph-endpoint-hit", r: 24 }),
        createSvgElement("circle", { class: "morph-endpoint", r: 12 }),
        label,
      );
      morphVisuals.append(handle);
    }
    handle.dataset.shapeSide = owner.side;
    handle.dataset.shapeIndex = String(owner.index);
    handle.dataset.shapeInput = String(input);
    handle.dataset.shapeOutput = String(y);
    handle.setAttribute("transform", "translate(" + mapX(input, SHAPER_AXIS) + " " + mapY(y, SHAPER_AXIS) + ")");
  }

  function renderShaper() {
    shaperCurve.setAttribute("d", sampledPath({
      minimum: SHAPER_AXIS.minimum,
      maximum: SHAPER_AXIS.maximum,
      samples: 300,
      evaluate: input => evaluateBipolarTransfer(input, values()),
      axis: SHAPER_AXIS,
    }));

    const geometry = currentShapeGeometry();
    renderSelection();
    if (activeGesture) {
      updateStableGeometry(geometry);
      renderMorphTarget();
      return;
    }

    shaperSegments.replaceChildren();
    for (const segment of geometry.segments) {
      shaperSegments.append(createSvgElement("path", {
        class: "shape-segment-hit",
        d: segment.path,
        "data-shape-segment-handle": "",
        "data-shape-side": segment.side,
        "data-shape-index": segment.index,
        "data-selected": String(
          selection.kind === "segment"
            && selection.side === segment.side
            && selection.index === segment.index,
        ),
        "aria-label": sideLabel(segment.side) + " segment " + segment.index,
        "aria-description": "Drag vertically to offset this segment at its midpoint. Up is positive; down is negative.",
        "data-control-help": "Bend is the midpoint output offset. Drag up for positive or down for negative.",
      }));
    }

    shaperPoints.replaceChildren();
    const owner = morphOwner(values());
    for (const point of geometry.points) {
      const ownsMorph = point.side === owner.side && point.index === owner.index;
      const attributes: { [name: string]: string | number } = {
        transform: "translate(" + mapX(point.handleInput, SHAPER_AXIS) + " " + mapY(point.handleOutput, SHAPER_AXIS) + ")",
        "data-shape-point-handle": "",
        "data-shape-side": point.side,
        "data-shape-index": point.index,
        "data-shape-input": point.input,
        "data-shape-output": point.y,
        "data-shape-handle-input": point.handleInput,
        "data-shape-handle-output": point.handleOutput,
        "data-selected": String(
          selection.kind === "point"
            && selection.side === point.side
            && selection.index === point.index,
        ),
        role: "slider",
        tabindex: "0",
        "aria-label": sideLabel(point.side) + " point " + point.index,
        "aria-description": ownsMorph
          ? "Morph position A. Drag in two dimensions."
          : "Drag in two dimensions to move this point.",
        "data-control-help": ownsMorph
          ? "Morph A: drag in two dimensions."
          : "Drag in two dimensions to move this point.",
      };
      if (ownsMorph) {
        attributes["data-morph-endpoint"] = "A";
        attributes["data-morph-input"] = point.handleInput;
        attributes["data-morph-output"] = point.handleOutput;
      }
      const group = createSvgElement("g", attributes);
      group.append(
        createSvgElement("circle", { class: "shape-point-hit", r: 24 }),
        createSvgElement("circle", { class: "shape-point", r: 10 }),
      );
      const label = createSvgElement("text", { class: "shape-point-label", x: 0, y: 4 });
      label.textContent = ownsMorph ? "A" : point.side === "negative" ? "−" : "+";
      group.append(label);
      shaperPoints.append(group);
    }
    renderMorphTarget();
  }

  function render() {
    renderCompressor();
    renderShaper();
  }

  function showReadout(element: SVGElement, textElement: SVGElement, text: string) {
    textElement.textContent = text;
    element.dataset.visible = "true";
  }

  function hideReadout(element: SVGElement) {
    element.dataset.visible = "false";
  }

  function compressorReadoutFor(control: CompressorHandle, value: number): string {
    if (control === "threshold") return "Threshold  " + value.toFixed(2) + " dB";
    if (control === "ratio") return "Ratio  " + value.toFixed(2) + ":1";
    if (control === "knee") return "Knee  " + value.toFixed(2) + " dB";
    return "Makeup  " + value.toFixed(2) + " dB";
  }

  function finishGesture(cancelled: boolean) {
    const gesture = activeGesture;
    if (!gesture) return;
    if (cancelled && gesture.changed) {
      if (gesture.kind === "compressor") {
        sound.set(gesture.endpointID, gesture.startValue);
      } else if (gesture.kind === "point") {
        sound.set(gesture.endpointIDs.x, gesture.startX);
        sound.set(gesture.endpointIDs.y, gesture.startY);
      } else {
        sound.set(gesture.endpointID, gesture.startValue);
      }
    }
    sound.endGesture();
    try {
      if (gesture.handle.hasPointerCapture(gesture.pointerId))
        gesture.handle.releasePointerCapture(gesture.pointerId);
    } catch {
      // Window-level lifecycle listeners remain authoritative.
    }
    activeGesture = undefined;
    if (gesture.kind === "compressor") {
      hideReadout(compressorReadout);
      renderCompressor();
    } else {
      hideReadout(shaperReadout);
      renderShaper();
    }
  }

  function beginPointGesture(handle: SVGGraphicsElement, event: PointerEvent) {
    const side = handleSide(handle);
    const index = Number(handle.dataset.shapeIndex);
    selection = { kind: "point", side, index };
    const raw = rawShapePoint(values(), side, index);
    const points = effectiveShapePoints(values(), side);
    const endpointIDs = shapePointEndpointIDs(side, index);
    activeGesture = {
      kind: "point",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      handle,
      side,
      endpointIDs,
      startPointer: graphValueAt(shaperSvg, SHAPER_AXIS, event.clientX, event.clientY),
      startX: raw.x,
      startY: raw.y,
      minimumX: points[index - 1].x + 0.001,
      maximumX: index + 1 < points.length ? points[index + 1].x - 0.001 : 1.5,
      changed: false,
    };
    sound.beginGesture([endpointIDs.x, endpointIDs.y]);
    showReadout(
      shaperReadout,
      shaperReadoutText,
      sideLabel(side) + " point " + index + "  in "
        + (side === "negative" ? -raw.x : raw.x).toFixed(3)
        + "  out " + raw.y.toFixed(3),
    );
  }

  function beginSegmentGesture(handle: SVGGraphicsElement, event: PointerEvent) {
    const side = handleSide(handle);
    const index = Number(handle.dataset.shapeIndex);
    const endpointID = shapePointEndpointIDs(side, index).bend;
    const startValue = rawShapePoint(values(), side, index).bend;
    selection = { kind: "segment", side, index };
    activeGesture = {
      kind: "bend",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      handle,
      side,
      endpointID,
      startPointer: graphValueAt(shaperSvg, SHAPER_AXIS, event.clientX, event.clientY),
      startValue,
      changed: false,
    };
    sound.beginGesture([endpointID]);
    showReadout(
      shaperReadout,
      shaperReadoutText,
      sideLabel(side) + " segment " + index + "  bend " + startValue.toFixed(3),
    );
  }

  function beginMorphGesture(handle: SVGGraphicsElement, event: PointerEvent) {
    const endpoint = handle.dataset.morphEndpoint;
    const side = handleSide(handle);
    const index = Number(handle.dataset.shapeIndex);
    const points = effectiveShapePoints(values(), side);
    const pointIDs = shapePointEndpointIDs(side, index);
    const endpointIDs = endpoint === "A"
      ? { x: pointIDs.x, y: pointIDs.y }
      : { x: "morphTargetX", y: "morphTargetY" };
    const raw = endpoint === "A"
      ? rawShapePoint(values(), side, index)
      : {
          x: finiteOr(values().morphTargetX, Number.NaN),
          y: finiteOr(values().morphTargetY, Number.NaN),
        };
    selection = { kind: endpoint === "B" ? "morph" : "point", side, index };
    activeGesture = {
      kind: "point",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      handle,
      side,
      endpointIDs,
      startPointer: graphValueAt(shaperSvg, SHAPER_AXIS, event.clientX, event.clientY),
      startX: raw.x,
      startY: raw.y,
      minimumX: points[index - 1].x + 0.001,
      maximumX: index + 1 < points.length ? points[index + 1].x - 0.001 : 1.5,
      changed: false,
    };
    sound.beginGesture([endpointIDs.x, endpointIDs.y]);
    showReadout(
      shaperReadout,
      shaperReadoutText,
      (endpoint === "B" ? "Morph B" : "Morph A") + "  in "
        + (side === "negative" ? -raw.x : raw.x).toFixed(3)
        + "  out " + raw.y.toFixed(3),
    );
  }

  function onPointerDown(event: PointerEvent) {
    if (activeGesture) return;
    const morphHandle = closestHandle(event, "[data-morph-endpoint]");
    const pointHandle = closestHandle(event, "[data-shape-point-handle]");
    const segmentHandle = closestHandle(event, "[data-shape-segment-handle]");
    if (morphHandle) beginMorphGesture(morphHandle, event);
    else if (pointHandle) beginPointGesture(pointHandle, event);
    else if (segmentHandle) beginSegmentGesture(segmentHandle, event);
    else return;
    renderSelection();
    try {
      (morphHandle ?? pointHandle ?? segmentHandle)?.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners retain ownership if SVG pointer capture is unavailable.
    }
    event.preventDefault();
  }

  function beginCompressorGesture(handle: SVGGraphicsElement, event: PointerEvent) {
    const control = compressorHandleOf(handle);
    const endpointID = COMPRESSOR_HANDLE_ENDPOINTS[control];
    const startValue = finiteOr(values()[endpointID], COMPRESSOR_DEFAULTS[endpointID]);
    activeGesture = {
      kind: "compressor",
      control,
      endpointID,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      handle,
      startPointer: graphValueAt(compressorSvg, COMPRESSOR_AXIS, event.clientX, event.clientY),
      startValue,
      startOutput: evaluateCompressorTransfer(COMPRESSOR_AXIS.maximum, values()),
      changed: false,
    };
    sound.beginGesture([endpointID]);
    showReadout(compressorReadout, compressorReadoutText, compressorReadoutFor(control, startValue));
    try { handle.setPointerCapture(event.pointerId); } catch { /* document listeners retain ownership */ }
    event.preventDefault();
  }

  function onCompressorPointerDown(event: PointerEvent) {
    if (activeGesture) return;
    const handle = closestHandle(event, "[data-graph-handle]");
    if (handle) beginCompressorGesture(handle, event);
  }

  function solveRatio(targetOutput: number): number {
    let lower = 1;
    let upper = 100;
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const candidate = (lower + upper) * 0.5;
      const output = evaluateCompressorTransfer(
        COMPRESSOR_AXIS.maximum,
        { ...values(), ratio: candidate },
      );
      if (output > targetOutput) lower = candidate;
      else upper = candidate;
    }
    return (lower + upper) * 0.5;
  }

  function onPointerMove(event: PointerEvent) {
    const gesture = activeGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (gesture.kind === "compressor") {
      const pointer = graphValueAt(compressorSvg, COMPRESSOR_AXIS, event.clientX, event.clientY);
      const inputDelta = pointer.input - gesture.startPointer.input;
      const outputDelta = pointer.output - gesture.startPointer.output;
      let value: number;
      if (gesture.control === "threshold")
        value = clamp(gesture.startValue + inputDelta, -36, 6);
      else if (gesture.control === "knee")
        value = clamp(gesture.startValue + inputDelta * 2, 0, 24);
      else if (gesture.control === "makeup")
        value = clamp(gesture.startValue + outputDelta, -24, 24);
      else
        value = solveRatio(gesture.startOutput + outputDelta);
      if (Math.abs(value - Number(values()[gesture.endpointID])) >= 1e-9)
        sound.set(gesture.endpointID, value);
      showReadout(compressorReadout, compressorReadoutText, compressorReadoutFor(gesture.control, value));
      gesture.changed = true;
      event.preventDefault();
      return;
    }
    const pointer = graphValueAt(shaperSvg, SHAPER_AXIS, event.clientX, event.clientY);
    if (gesture.kind === "point") {
      const horizontalDelta = pointer.input - gesture.startPointer.input;
      const nextX = clamp(
        gesture.startX + (gesture.side === "negative" ? -horizontalDelta : horizontalDelta),
        gesture.minimumX,
        gesture.maximumX,
      );
      const nextY = clamp(
        gesture.startY + (pointer.output - gesture.startPointer.output),
        -1.5,
        1.5,
      );
      if (Math.abs(nextX - Number(values()[gesture.endpointIDs.x])) >= 1e-9)
        sound.set(gesture.endpointIDs.x, nextX);
      if (Math.abs(nextY - Number(values()[gesture.endpointIDs.y])) >= 1e-9)
        sound.set(gesture.endpointIDs.y, nextY);
      showReadout(
        shaperReadout,
        shaperReadoutText,
        (gesture.endpointIDs.x === "morphTargetX" ? "Morph B" : sideLabel(gesture.side) + " point")
          + "  in " + (gesture.side === "negative" ? -nextX : nextX).toFixed(3)
          + "  out " + nextY.toFixed(3),
      );
    } else {
      const nextBend = clamp(
        gesture.startValue
          + (pointer.output - gesture.startPointer.output),
        -1,
        1,
      );
      if (Math.abs(nextBend - Number(values()[gesture.endpointID])) >= 1e-9)
        sound.set(gesture.endpointID, nextBend);
      showReadout(
        shaperReadout,
        shaperReadoutText,
        sideLabel(gesture.side) + " segment  bend " + nextBend.toFixed(3),
      );
    }
    gesture.changed = true;
    event.preventDefault();
  }

  function addPoint() {
    const side = selection.side;
    const count = shapePointCount(values(), side);
    if (count >= SHAPER_MAX_POINTS) return;
    const insertIndex = clamp(selection.index, 1, count);
    const points = effectiveShapePoints(values(), side);
    const left = points[insertIndex - 1];
    const right = points[insertIndex];
    const newX = (left.x + right.x) * 0.5;
    const newY = evaluateBipolarTransfer(side === "negative" ? -newX : newX, values());
    const splitPosition = (newX - left.x) / Math.max(0.001, right.x - left.x);
    const existingBend = rawShapePoint(values(), side, insertIndex).bend;
    const leftBend = clamp(existingBend * splitPosition * splitPosition, -1, 1);
    const rightPosition = 1 - splitPosition;
    const rightBend = clamp(existingBend * rightPosition * rightPosition, -1, 1);
    const changes: { [endpointID: string]: number } = {};

    for (let targetIndex = count + 1; targetIndex > insertIndex; targetIndex -= 1) {
      const source = rawShapePoint(values(), side, targetIndex - 1);
      const targetIDs = shapePointEndpointIDs(side, targetIndex);
      changes[targetIDs.x] = source.x;
      changes[targetIDs.y] = source.y;
      changes[targetIDs.bend] = source.bend;
    }

    const insertedIDs = shapePointEndpointIDs(side, insertIndex);
    changes[insertedIDs.x] = newX;
    changes[insertedIDs.y] = newY;
    changes[insertedIDs.bend] = leftBend;
    changes[shapePointEndpointIDs(side, insertIndex + 1).bend] = rightBend;
    const owner = morphOwner(values());
    if (owner.side === side && owner.index >= insertIndex)
      changes.morphPoint = owner.index + 1;
    changes[side === "negative" ? "curveNPointCount" : "curvePointCount"] = count + 1;
    selection = { kind: "point", side, index: insertIndex };
    sound.edit(changes);
    renderShaper();
  }

  function deletePoint() {
    if (selection.kind !== "point") return;
    const side = selection.side;
    const count = shapePointCount(values(), side);
    if (count <= 1) return;
    const deleteIndex = clamp(selection.index, 1, count);
    const changes: { [endpointID: string]: number } = {};

    for (let targetIndex = deleteIndex; targetIndex < count; targetIndex += 1) {
      const source = rawShapePoint(values(), side, targetIndex + 1);
      const targetIDs = shapePointEndpointIDs(side, targetIndex);
      changes[targetIDs.x] = source.x;
      changes[targetIDs.y] = source.y;
      changes[targetIDs.bend] = source.bend;
    }

    const owner = morphOwner(values());
    if (owner.side === side) {
      if (owner.index > deleteIndex) {
        changes.morphPoint = owner.index - 1;
      } else if (owner.index === deleteIndex) {
        const replacementIndex = Math.min(deleteIndex, count - 1);
        const replacement = deleteIndex < count
          ? rawShapePoint(values(), side, deleteIndex + 1)
          : rawShapePoint(values(), side, deleteIndex - 1);
        changes.morphPoint = replacementIndex;
        changes.morphTargetX = replacement.x;
        changes.morphTargetY = replacement.y;
      }
    }
    changes[side === "negative" ? "curveNPointCount" : "curvePointCount"] = count - 1;
    selection = { kind: "point", side, index: Math.min(deleteIndex, count - 1) };
    sound.edit(changes);
    renderShaper();
  }

  function assignSelectedPointToMorph() {
    if (selection.kind !== "point") return;
    const point = rawShapePoint(values(), selection.side, selection.index);
    sound.edit({
      morphSide: selection.side === "negative" ? -1 : 1,
      morphPoint: selection.index,
      morphTargetX: point.x,
      morphTargetY: point.y,
    });
    renderShaper();
  }

  function commitExactField(field: HTMLInputElement) {
    const value = Number(field.value);
    if (!Number.isFinite(value)) {
      renderSelection();
      return;
    }
    const endpointIDs = shapePointEndpointIDs(selection.side, selection.index);
    if (field.dataset.shapeExactField === "input") {
      const signed = selection.side === "negative"
        ? clamp(value, -1.5, -0.01)
        : clamp(value, 0.01, 1.5);
      sound.edit({
        [selection.kind === "morph" ? "morphTargetX" : endpointIDs.x]: Math.abs(signed),
      });
    } else if (field.dataset.shapeExactField === "output") {
      sound.edit({
        [selection.kind === "morph" ? "morphTargetY" : endpointIDs.y]: clamp(value, -1.5, 1.5),
      });
    } else {
      sound.edit({ [endpointIDs.bend]: clamp(value, -1, 1) });
    }
    renderShaper();
  }

  function onExactFieldChange(event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) commitExactField(event.currentTarget);
  }

  function onExactFieldKeyDown(event: KeyboardEvent) {
    if (event.key !== "Enter" || !(event.currentTarget instanceof HTMLInputElement)) return;
    event.preventDefault();
    commitExactField(event.currentTarget);
    event.currentTarget.select();
  }

  function onPointerUp(event: PointerEvent | MouseEvent) {
    if (!activeGesture) return;
    if (event.type === "mouseup") {
      // Embedded WebKit can lose the PointerEvent release after SVG capture.
      // Keep its legacy fallback strictly scoped to a mouse-owned gesture.
      if (activeGesture.pointerType === "mouse") finishGesture(false);
      return;
    }
    if (event instanceof PointerEvent && event.pointerId === activeGesture.pointerId) finishGesture(false);
  }

  function onPointerCancel(event: PointerEvent) {
    if (activeGesture && event.pointerId === activeGesture.pointerId)
      finishGesture(true);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && activeGesture) {
      event.preventDefault();
      finishGesture(true);
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState !== "visible") finishGesture(true);
  }

  function onWindowBlur() {
    finishGesture(true);
  }

  function pushTelemetry(frame: MeterFrame) {
    const compressorInput = Number(frame.compressorInputDb);
    const compressorOutput = Number(frame.compressorOutputDb);
    if (Number.isFinite(compressorInput) && Number.isFinite(compressorOutput)) {
      compressorOperatingPoint.setAttribute("cx", String(mapX(clamp(compressorInput, -48, 12), COMPRESSOR_AXIS)));
      compressorOperatingPoint.setAttribute("cy", String(mapY(clamp(compressorOutput, -48, 12), COMPRESSOR_AXIS)));
      compressorOperatingPoint.dataset.active = "true";
    }

    const shapeInput = Number(frame.clipInput);
    const shapeOutput = Number(frame.clipOutput);
    if (Number.isFinite(shapeInput) && Number.isFinite(shapeOutput)) {
      shaperOperatingPoint.setAttribute("cx", String(mapX(clamp(shapeInput, -1.5, 1.5), SHAPER_AXIS)));
      shaperOperatingPoint.setAttribute("cy", String(mapY(clamp(shapeOutput, -1.5, 1.5), SHAPER_AXIS)));
      shaperOperatingPoint.dataset.active = "true";
    }

    const reduction = Math.max(0, Number(frame.gainReductionDb) || 0);
    reductionHistory.push(reduction);
    if (reductionHistory.length > 120) reductionHistory.shift();
    gainReductionTrace.setAttribute("d", reductionHistory.map((value, index) => {
      const x = reductionHistory.length <= 1 ? 0 : (index / (reductionHistory.length - 1)) * 692;
      const y = 54 - clamp(value, 0, 24) / 24 * 48;
      return (index === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
    }).join(" "));
    gainReductionTrace.dataset.sampleCount = String(reductionHistory.length);
  }

  compressorSvg.addEventListener("pointerdown", onCompressorPointerDown);
  shaperSvg.addEventListener("pointerdown", onPointerDown);
  addPointButton.addEventListener("click", addPoint);
  deletePointButton.addEventListener("click", deletePoint);
  assignMorphButton.addEventListener("click", assignSelectedPointToMorph);
  for (const field of Object.values(exactFields)) {
    field.addEventListener("change", onExactFieldChange);
    field.addEventListener("keydown", onExactFieldKeyDown);
  }
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  document.addEventListener("mouseup", onPointerUp, true);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onWindowBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);
  render();

  return {
    render,
    pushTelemetry,
    destroy() {
      finishGesture(true);
      compressorSvg.removeEventListener("pointerdown", onCompressorPointerDown);
      shaperSvg.removeEventListener("pointerdown", onPointerDown);
      addPointButton.removeEventListener("click", addPoint);
      deletePointButton.removeEventListener("click", deletePoint);
      assignMorphButton.removeEventListener("click", assignSelectedPointToMorph);
      for (const field of Object.values(exactFields)) {
        field.removeEventListener("change", onExactFieldChange);
        field.removeEventListener("keydown", onExactFieldKeyDown);
      }
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("mouseup", onPointerUp, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
