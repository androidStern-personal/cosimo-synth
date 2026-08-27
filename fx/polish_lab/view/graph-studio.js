import {
  COMPRESSOR_DEFAULTS,
  clampValue,
  effectiveCompressorSettings,
  evaluateCompressorTransfer,
  finiteParameter,
} from "./dynamics-model.js";
import {
  CLIPPER_STAGE_DEFAULTS,
  CURVE_EDITOR_DEFAULTS,
  CURVE_EDITOR_MAX_POINTS,
  CURVE_DEFAULTS,
  editorAmount,
  editorPointCount,
  effectiveEditorCurve,
  evaluateEditableCurve,
  evaluateClipperTransfer,
  isCurveEditorEnabled,
  sanitizeCurve,
} from "./curve-model.js";

const COMPRESSOR_AXIS = Object.freeze({
  minimum: -48,
  maximum: 12,
  left: 58,
  right: 722,
  top: 24,
  bottom: 346,
});

const CLIPPER_AXIS = Object.freeze({
  minimum: 0,
  maximum: 1.5,
  left: 58,
  right: 722,
  top: 24,
  bottom: 346,
});

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function pointInSvg(svg, clientX, clientY) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function distanceToPathInScreen(path, clientX, clientY) {
  const matrix = path.getScreenCTM();
  if (!matrix) return Number.POSITIVE_INFINITY;

  const length = path.getTotalLength();
  const sampleCount = Math.min(96, Math.max(12, Math.ceil(length / 4)));
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= sampleCount; index += 1) {
    const point = path.getPointAtLength(length * index / sampleCount).matrixTransform(matrix);
    nearestDistance = Math.min(
      nearestDistance,
      Math.hypot(clientX - point.x, clientY - point.y),
    );
  }
  return nearestDistance;
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [attribute, value] of Object.entries(attributes))
    element.setAttribute(attribute, String(value));
  return element;
}

function setInputValue(input, value, enabled) {
  input.disabled = !enabled;
  input.value = enabled && Number.isFinite(value) ? Number(value).toFixed(6) : "";
}

function mapInputDb(value) {
  const axis = COMPRESSOR_AXIS;
  return axis.left + ((value - axis.minimum) / (axis.maximum - axis.minimum)) * (axis.right - axis.left);
}

function mapOutputDb(value) {
  const axis = COMPRESSOR_AXIS;
  return axis.bottom - ((value - axis.minimum) / (axis.maximum - axis.minimum)) * (axis.bottom - axis.top);
}

function mapClipperX(value) {
  const axis = CLIPPER_AXIS;
  return axis.left + ((value - axis.minimum) / (axis.maximum - axis.minimum)) * (axis.right - axis.left);
}

function mapClipperY(value) {
  const axis = CLIPPER_AXIS;
  return axis.bottom - ((value - axis.minimum) / (axis.maximum - axis.minimum)) * (axis.bottom - axis.top);
}

function formatDb(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)} dB`;
}

function ratioProbeInput(settings) {
  return Math.min(COMPRESSOR_AXIS.maximum, settings.thresholdDb + 12);
}

function solveRatioEndpoint({ parameterValues, endpointID, probeInput, targetOutput }) {
  const minimum = 1;
  const maximum = endpointID === "ratio" ? 100 : 1000;
  const candidateParameters = new Map(parameterValues);
  const outputAt = candidate => {
    candidateParameters.set(endpointID, candidate);
    return evaluateCompressorTransfer(probeInput, candidateParameters);
  };
  const outputAtMinimum = outputAt(minimum);
  const outputAtMaximum = outputAt(maximum);
  if (targetOutput >= outputAtMinimum) return minimum;
  if (targetOutput <= outputAtMaximum) return maximum;

  let low = minimum;
  let high = maximum;
  for (let iteration = 0; iteration < 42; iteration += 1) {
    const middle = (low + high) * 0.5;
    if (outputAt(middle) > targetOutput) low = middle;
    else high = middle;
  }
  return (low + high) * 0.5;
}

export function createPolishGraphStudio({ root, patchConnection, parameterValues, sendParameter }) {
  const compressorSvg = root.querySelector('[data-transfer-graph="compressor"]');
  const compressorPath = root.querySelector("[data-compressor-curve]");
  const thresholdHandle = root.querySelector('[data-graph-handle="threshold"]');
  const thresholdVisual = root.querySelector('[data-graph-control="threshold"]');
  const ratioHandle = root.querySelector('[data-graph-handle="ratio"]');
  const ratioVisual = root.querySelector('[data-graph-control="ratio"]');
  const kneeHandle = root.querySelector('[data-graph-handle="knee"]');
  const kneeVisual = root.querySelector('[data-graph-control="knee"]');
  const kneeRegion = root.querySelector("[data-compressor-knee-region]");
  const makeupHandle = root.querySelector('[data-graph-handle="makeup"]');
  const makeupVisual = root.querySelector('[data-graph-control="makeup"]');
  const readout = root.querySelector("[data-graph-readout]");
  const compressorOperatingPoint = root.querySelector("[data-compressor-operating-point]");
  const compressorOperatingInput = root.querySelector("[data-compressor-operating-input]");
  const compressorOperatingOutput = root.querySelector("[data-compressor-operating-output]");
  const gainReductionTrace = root.querySelector("[data-gain-reduction-trace]");
  const gainReductionValue = root.querySelector("[data-gain-reduction-live-value]");
  const gainReductionHistory = [];
  const clipperSvg = root.querySelector('[data-transfer-graph="clipper"]');
  const decodedClipperPath = root.querySelector("[data-decoded-clipper-curve]");
  const clipperPath = root.querySelector("[data-clipper-curve]");
  const driveHandle = root.querySelector('[data-graph-handle="drive"]');
  const driveVisual = root.querySelector('[data-graph-control="drive"]');
  const driveGuide = root.querySelector("[data-drive-guide]");
  const clipRegion = root.querySelector("[data-clipped-region]");
  const curveSegmentsHost = root.querySelector("[data-curve-segments]");
  const curveBendsHost = root.querySelector("[data-curve-bends]");
  const curvePointsHost = root.querySelector("[data-curve-points]");
  const curveAmountVisualsHost = root.querySelector("[data-curve-amount-visuals]");
  const curveMode = root.querySelector("[data-curve-editor-mode]");
  const curveModeNote = root.querySelector("[data-curve-editor-note]");
  const startEditorButton = root.querySelector("[data-curve-start-editor]");
  const addPointButton = root.querySelector("[data-curve-add]");
  const removePointButton = root.querySelector("[data-curve-remove]");
  const linkAmountButton = root.querySelector("[data-curve-link-amount]");
  const curveSelection = root.querySelector("[data-curve-selection]");
  const exactXInput = root.querySelector("[data-curve-exact-x]");
  const exactYInput = root.querySelector("[data-curve-exact-y]");
  const exactBendInput = root.querySelector("[data-curve-exact-bend]");
  const amountXInput = root.querySelector("[data-curve-amount-x]");
  const amountYInput = root.querySelector("[data-curve-amount-y]");
  const clipperOperatingPoint = root.querySelector("[data-clipper-operating-point]");
  const clipperOperatingGuide = root.querySelector("[data-clipper-operating-guide]");
  const clipperOperatingLabel = root.querySelector("[data-clipper-operating-label]");
  let activeGesture = null;
  let selectedEditorPoint = 1;
  let addPointArmed = false;

  const segmentHandles = () => Array.from(curveSegmentsHost.querySelectorAll("[data-curve-segment]"));
  const knotHandles = () => Array.from(curvePointsHost.querySelectorAll('[data-graph-handle^="knot"]'));

  function renderCompressor() {
    const path = [];
    for (let index = 0; index <= 240; index += 1) {
      const inputDb = COMPRESSOR_AXIS.minimum
        + (COMPRESSOR_AXIS.maximum - COMPRESSOR_AXIS.minimum) * index / 240;
      const outputDb = evaluateCompressorTransfer(inputDb, parameterValues);
      path.push(
        `${index === 0 ? "M" : "L"}${mapInputDb(inputDb).toFixed(2)},${mapOutputDb(outputDb).toFixed(2)}`,
      );
    }
    compressorPath.setAttribute("d", path.join(" "));

    const thresholdDb = finiteParameter(
      parameterValues,
      "thresholdDb",
      COMPRESSOR_DEFAULTS.thresholdDb,
    );
    thresholdVisual.setAttribute("transform", `translate(${mapInputDb(thresholdDb).toFixed(3)} 0)`);
    thresholdHandle.setAttribute("aria-valuenow", String(thresholdDb));
    thresholdHandle.setAttribute("aria-valuetext", formatDb(thresholdDb));

    const settings = effectiveCompressorSettings(parameterValues);
    const kneeLeft = settings.thresholdDb - settings.kneeDb * 0.5;
    const kneeRight = settings.thresholdDb + settings.kneeDb * 0.5;
    kneeRegion.setAttribute("x", mapInputDb(kneeLeft).toFixed(3));
    kneeRegion.setAttribute("width", Math.max(0, mapInputDb(kneeRight) - mapInputDb(kneeLeft)).toFixed(3));
    const kneeOutput = evaluateCompressorTransfer(kneeRight, parameterValues);
    kneeVisual.setAttribute(
      "transform",
      `translate(${mapInputDb(kneeRight).toFixed(3)} ${mapOutputDb(kneeOutput).toFixed(3)})`,
    );
    kneeHandle.setAttribute("aria-valuenow", String(settings.kneeDb));
    kneeHandle.setAttribute("aria-valuetext", formatDb(settings.kneeDb));
    const makeupProbeInput = -36;
    const makeupProbeOutput = evaluateCompressorTransfer(makeupProbeInput, parameterValues);
    makeupVisual.setAttribute(
      "transform",
      `translate(${mapInputDb(makeupProbeInput).toFixed(3)} ${mapOutputDb(makeupProbeOutput).toFixed(3)})`,
    );
    const baseMakeupDb = finiteParameter(parameterValues, "makeupDb", COMPRESSOR_DEFAULTS.makeupDb);
    makeupHandle.setAttribute("aria-valuenow", String(baseMakeupDb));
    makeupHandle.setAttribute("aria-valuetext", formatDb(baseMakeupDb));
    const probeInput = ratioProbeInput(settings);
    const probeOutput = evaluateCompressorTransfer(probeInput, parameterValues);
    ratioVisual.setAttribute(
      "transform",
      `translate(${mapInputDb(probeInput).toFixed(3)} ${mapOutputDb(probeOutput).toFixed(3)})`,
    );
    ratioHandle.setAttribute("aria-valuenow", String(settings.ratio));
    ratioHandle.setAttribute("aria-valuetext", `${settings.ratio.toFixed(settings.ratio >= 100 ? 0 : 2)} to 1`);
    root.querySelector("[data-compressor-graph-summary]").textContent =
      `${settings.ratio.toFixed(settings.ratio >= 100 ? 0 : 2)}:1 · ${formatDb(settings.makeupDb)} makeup`;
  }

  function currentCurveValues() {
    return Object.fromEntries(Object.keys(CURVE_DEFAULTS).map(endpointID => [
      endpointID,
      finiteParameter(parameterValues, endpointID, CURVE_DEFAULTS[endpointID]),
    ]));
  }

  function rawEditorPointValue(index, axis) {
    const endpointID = `curveP${index}${axis}`;
    const fallback = index <= 3
      ? CURVE_DEFAULTS[endpointID]
      : CURVE_EDITOR_DEFAULTS[endpointID];
    return finiteParameter(parameterValues, endpointID, fallback);
  }

  function editorPointsAtAmount(amount) {
    const values = new Map(parameterValues);
    values.set("amount", amount);
    return effectiveEditorCurve(values);
  }

  function displayCurvePoint(point, driveGain, mix) {
    const input = point.x / driveGain;
    return {
      input,
      output: input + (point.y - input) * mix,
    };
  }

  function renderCurveEditorUi() {
    const enabled = isCurveEditorEnabled(parameterValues);
    const initialized = finiteParameter(parameterValues, "curveEditorInitialized", 0) >= 0.5;
    const count = enabled ? editorPointCount(parameterValues) : 0;
    selectedEditorPoint = enabled
      ? Math.round(clampValue(selectedEditorPoint, 1, count))
      : 1;
    for (const point of curvePointsHost.querySelectorAll("[data-editor-point]"))
      point.dataset.selected = String(enabled && Number(point.dataset.editorPoint) === selectedEditorPoint);
    const amountPoint = enabled
      ? Math.round(clampValue(finiteParameter(parameterValues, "curveAmountPoint", 0), 0, count))
      : 0;

    curveMode.textContent = enabled ? "Point editor" : "Decoded curve";
    curveModeNote.textContent = enabled
      ? "Move anchors in two dimensions. Drag one diamond per segment to bend it; add a point whenever one bend is not enough."
      : "The decoded interpolation remains exact. Start the point editor to keep its anchors but replace its interpolation with straight, individually bendable segments.";
    startEditorButton.textContent = enabled
      ? "Use decoded curve"
      : initialized ? "Resume point editor" : "Start point editor";
    addPointButton.disabled = !enabled || count >= CURVE_EDITOR_MAX_POINTS;
    addPointButton.dataset.active = String(enabled && addPointArmed);
    addPointButton.textContent = addPointArmed ? "Tap curve…" : "+ Point";
    removePointButton.disabled = !enabled || count <= 2;
    linkAmountButton.disabled = !enabled;
    curveSelection.textContent = enabled ? `Point ${selectedEditorPoint}` : "Select a point";

    if (!enabled) {
      linkAmountButton.textContent = "Move with Amount";
      setInputValue(exactXInput, NaN, false);
      setInputValue(exactYInput, NaN, false);
      setInputValue(exactBendInput, NaN, false);
      setInputValue(amountXInput, NaN, false);
      setInputValue(amountYInput, NaN, false);
      return;
    }

    const basePoints = editorPointsAtAmount(0);
    const selected = basePoints[selectedEditorPoint];
    const previous = basePoints[selectedEditorPoint - 1];
    const next = basePoints[selectedEditorPoint + 1];
    exactXInput.min = String(selectedEditorPoint === 1 ? 0.01 : previous.x + 0.001);
    exactXInput.max = String(selectedEditorPoint === count ? 1.5 : next.x - 0.001);
    exactYInput.min = String(selectedEditorPoint === 1 ? 0 : previous.y);
    exactYInput.max = String(selectedEditorPoint === count ? 1.5 : next.y);
    setInputValue(exactXInput, rawEditorPointValue(selectedEditorPoint, "X"), true);
    setInputValue(exactYInput, rawEditorPointValue(selectedEditorPoint, "Y"), true);
    setInputValue(
      exactBendInput,
      finiteParameter(parameterValues, `curveB${selectedEditorPoint}`, 0),
      true,
    );

    const selectedOwnsAmount = amountPoint === selectedEditorPoint;
    linkAmountButton.textContent = selectedOwnsAmount ? "Remove Amount motion" : "Move with Amount";
    setInputValue(
      amountXInput,
      finiteParameter(parameterValues, "curveAmountTargetX", selected.x),
      selectedOwnsAmount,
    );
    setInputValue(
      amountYInput,
      finiteParameter(parameterValues, "curveAmountTargetY", selected.y),
      selectedOwnsAmount,
    );
    amountXInput.min = exactXInput.min;
    amountXInput.max = exactXInput.max;
    amountYInput.min = exactYInput.min;
    amountYInput.max = exactYInput.max;
  }

  function renderClipper() {
    const path = [];
    const decodedPath = [];
    const decodedValues = { ...CURVE_DEFAULTS, ...CLIPPER_STAGE_DEFAULTS };
    for (let index = 0; index <= 300; index += 1) {
      const input = CLIPPER_AXIS.minimum
        + (CLIPPER_AXIS.maximum - CLIPPER_AXIS.minimum) * index / 300;
      const output = evaluateClipperTransfer(input, parameterValues);
      path.push(`${index === 0 ? "M" : "L"}${mapClipperX(input).toFixed(2)},${mapClipperY(output).toFixed(2)}`);
      const decodedOutput = evaluateClipperTransfer(input, decodedValues);
      decodedPath.push(
        `${index === 0 ? "M" : "L"}${mapClipperX(input).toFixed(2)},${mapClipperY(decodedOutput).toFixed(2)}`,
      );
    }
    clipperPath.setAttribute("d", path.join(" "));
    decodedClipperPath.setAttribute("d", decodedPath.join(" "));

    const editorEnabled = isCurveEditorEnabled(parameterValues);
    const points = editorEnabled
      ? effectiveEditorCurve(parameterValues)
      : sanitizeCurve(currentCurveValues());
    const driveDb = finiteParameter(parameterValues, "clipDriveDb", CLIPPER_STAGE_DEFAULTS.clipDriveDb);
    const driveGain = 10 ** (driveDb / 20);
    const clipBoundary = points[1].x / driveGain;
    const displayedBoundary = clampValue(clipBoundary, 0.02, CLIPPER_AXIS.maximum);
    const driveOutput = evaluateClipperTransfer(displayedBoundary, parameterValues);
    driveVisual.setAttribute(
      "transform",
      `translate(${mapClipperX(displayedBoundary).toFixed(3)} ${(CLIPPER_AXIS.bottom - 14).toFixed(3)})`,
    );
    driveGuide.setAttribute(
      "d",
      `M${mapClipperX(displayedBoundary).toFixed(3)} ${CLIPPER_AXIS.bottom - 14}V${mapClipperY(driveOutput).toFixed(3)}`,
    );
    driveVisual.dataset.offscale = String(clipBoundary > CLIPPER_AXIS.maximum);
    driveHandle.setAttribute("aria-valuenow", String(driveDb));
    driveHandle.setAttribute("aria-valuetext", formatDb(driveDb));

    const clipMix = clampValue(finiteParameter(parameterValues, "clipMix", 100) * 0.01, 0, 1);
    curveSegmentsHost.replaceChildren();
    curveBendsHost.replaceChildren();
    curvePointsHost.replaceChildren();
    curveAmountVisualsHost.replaceChildren();
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      const left = points[index - 1];

      const segmentPath = [];
      for (let sample = 0; sample <= 36; sample += 1) {
        const drivenInput = left.x + (point.x - left.x) * sample / 36;
        const input = drivenInput / driveGain;
        const output = evaluateClipperTransfer(input, parameterValues);
        segmentPath.push(
          `${sample === 0 ? "M" : "L"}${mapClipperX(input).toFixed(2)},${mapClipperY(output).toFixed(2)}`,
        );
      }
      const segmentValue = editorEnabled ? point.bend : point.tension;
      const segmentHandleName = editorEnabled ? `bend${index}` : `segment${index}`;
      const segment = createSvgElement("path", {
        class: "curve-segment-hit",
        "data-curve-segment": index,
        "data-segment-handle": segmentHandleName,
        ...(!editorEnabled ? { "data-graph-handle": segmentHandleName } : {}),
        role: "slider",
        tabindex: 0,
        "aria-label": editorEnabled
          ? `Drag segment ${index} vertically to bend it`
          : `Drag decoded segment ${index} vertically to change its roundness`,
        "aria-valuemin": -1,
        "aria-valuemax": 1,
        "aria-valuenow": segmentValue,
        "aria-valuetext": `${editorEnabled ? "Bend" : "Roundness"} ${segmentValue.toFixed(3)}`,
        d: segmentPath.join(" "),
      });
      curveSegmentsHost.append(segment);

      if (editorEnabled) {
        const drivenMidpoint = (left.x + point.x) * 0.5;
        const externalMidpoint = drivenMidpoint / driveGain;
        const midpointOutput = evaluateClipperTransfer(externalMidpoint, parameterValues);
        const bend = createSvgElement("g", {
          transform: `translate(${mapClipperX(externalMidpoint).toFixed(3)} ${mapClipperY(midpointOutput).toFixed(3)})`,
          "data-graph-control": `bend${index}`,
          "data-graph-handle": `bend${index}`,
          "data-editor-bend": index,
          role: "slider",
          tabindex: 0,
          "aria-label": `Segment ${index} bend`,
          "aria-valuemin": -1,
          "aria-valuemax": 1,
          "aria-valuenow": segmentValue,
        });
        bend.append(
          createSvgElement("rect", { x: -28, y: -28, width: 56, height: 56, fill: "rgba(0,0,0,0.001)", stroke: "none" }),
          createSvgElement("path", { class: "bend-grip", d: "M0 -9L9 0L0 9L-9 0Z" }),
        );
        curveBendsHost.append(bend);
      }
    }

    const basePoints = editorEnabled ? editorPointsAtAmount(0) : points;
    const amountPoint = editorEnabled
      ? Math.round(clampValue(finiteParameter(parameterValues, "curveAmountPoint", 0), 0, points.length - 1))
      : 0;
    for (let index = 1; index < points.length; index += 1) {
      const point = amountPoint === index ? basePoints[index] : points[index];
      const displayed = displayCurvePoint(point, driveGain, clipMix);
      const knot = createSvgElement("g", {
        transform: `translate(${mapClipperX(displayed.input).toFixed(3)} ${mapClipperY(displayed.output).toFixed(3)})`,
        "data-graph-control": `knot${index}`,
        "data-graph-handle": `knot${index}`,
        ...(editorEnabled ? { "data-editor-point": index } : {}),
        "data-selected": String(editorEnabled && selectedEditorPoint === index),
        role: "slider",
        tabindex: 0,
        "aria-label": `${index === points.length - 1 ? "Ceiling" : `Point ${index}`} input and output; drag freely`,
        "aria-valuetext": `Input ${point.x.toFixed(3)}, output ${point.y.toFixed(3)}`,
      });
      knot.append(
        createSvgElement("rect", { x: -26, y: -26, width: 52, height: 52, fill: "transparent", stroke: "transparent" }),
        createSvgElement("circle", { class: "knot-grip", cx: 0, cy: 0, r: 11 }),
      );
      const number = createSvgElement("text", { class: "knot-number", x: 0, y: 0 });
      number.textContent = String(index);
      knot.append(number);
      curvePointsHost.append(knot);
    }

    if (editorEnabled && amountPoint > 0) {
      const targetPoints = editorPointsAtAmount(100);
      const base = displayCurvePoint(basePoints[amountPoint], driveGain, clipMix);
      const target = displayCurvePoint(targetPoints[amountPoint], driveGain, clipMix);
      const current = displayCurvePoint(points[amountPoint], driveGain, clipMix);
      curveAmountVisualsHost.append(createSvgElement("path", {
        class: "amount-path",
        d: `M${mapClipperX(base.input).toFixed(3)} ${mapClipperY(base.output).toFixed(3)}L${mapClipperX(target.input).toFixed(3)} ${mapClipperY(target.output).toFixed(3)}`,
      }));
      const targetHandle = createSvgElement("g", {
        transform: `translate(${mapClipperX(target.input).toFixed(3)} ${mapClipperY(target.output).toFixed(3)})`,
        "data-graph-control": "amountTarget",
        "data-graph-handle": "amountTarget",
        role: "slider",
        tabindex: 0,
        "aria-label": `Point ${amountPoint} position at 100 percent Amount`,
      });
      targetHandle.append(
        createSvgElement("rect", { x: -26, y: -26, width: 52, height: 52, fill: "rgba(0,0,0,0.001)", stroke: "none" }),
        createSvgElement("path", { class: "amount-target-grip", d: "M0 -12L12 0L0 12L-12 0Z" }),
      );
      curveAmountVisualsHost.append(targetHandle);
      const currentHandle = createSvgElement("g", {
        transform: `translate(${mapClipperX(current.input).toFixed(3)} ${mapClipperY(current.output).toFixed(3)})`,
        "data-graph-control": "amountCurrent",
        "data-visible": String(editorAmount(parameterValues) > 0.001 && editorAmount(parameterValues) < 0.999),
      });
      currentHandle.append(createSvgElement("circle", { class: "amount-current-grip", cx: 0, cy: 0, r: 6 }));
      curveAmountVisualsHost.append(currentHandle);
    }

    const positiveBoundaryX = mapClipperX(Math.min(clipBoundary, CLIPPER_AXIS.maximum));
    clipRegion.setAttribute("x", positiveBoundaryX.toFixed(3));
    clipRegion.setAttribute("width", Math.max(0, CLIPPER_AXIS.right - positiveBoundaryX).toFixed(3));
    root.querySelector("[data-clipper-graph-summary]").textContent = editorEnabled
      ? `${points.length - 1} points · ${formatDb(driveDb)} drive · ${finiteParameter(parameterValues, "clipMix", 100).toFixed(1)}% mix`
      : `${formatDb(driveDb)} drive · ${finiteParameter(parameterValues, "clipMix", 100).toFixed(1)}% mix`;
    renderCurveEditorUi();
  }

  function renderGraphs() {
    renderCompressor();
    renderClipper();
  }

  function sendParameterTransaction(changes) {
    const entries = Object.entries(changes);
    for (const [endpointID] of entries)
      patchConnection.sendParameterGestureStart?.(endpointID);
    for (const [endpointID, value] of entries)
      sendParameter(endpointID, value);
    for (const [endpointID] of entries)
      patchConnection.sendParameterGestureEnd?.(endpointID);
  }

  function toggleCurveEditor() {
    finishGesture(true);
    addPointArmed = false;
    if (isCurveEditorEnabled(parameterValues)) {
      sendParameterTransaction({ curveEditorEnabled: false });
      return;
    }

    if (finiteParameter(parameterValues, "curveEditorInitialized", 0) >= 0.5) {
      sendParameterTransaction({ curveEditorEnabled: true });
      return;
    }

    const firstX = rawEditorPointValue(1, "X");
    const firstY = rawEditorPointValue(1, "Y");
    const changes = {
      curvePointCount: Math.round(clampValue(
        finiteParameter(parameterValues, "curvePointCount", 3),
        2,
        3,
      )),
      curveB1: 0,
      curveB2: 0,
      curveB3: 0,
      curveB4: 0,
      curveB5: 0,
      curveB6: 0,
      curveB7: 0,
      curveAmountTargetX: firstX,
      curveAmountTargetY: firstY,
      curveAmountPoint: 0,
      curveEditorInitialized: true,
      curveEditorEnabled: true,
    };
    selectedEditorPoint = 1;
    sendParameterTransaction(changes);
  }

  function bendFromControl(leftY, rightY, controlY) {
    const span = rightY - leftY;
    if (Math.abs(span) < 1e-9) return 0;
    return clampValue(2 * (controlY - (leftY + rightY) * 0.5) / span, -1, 1);
  }

  function addEditorPointAt(clientX, clientY) {
    if (!isCurveEditorEnabled(parameterValues)) return;
    const count = editorPointCount(parameterValues);
    if (count >= CURVE_EDITOR_MAX_POINTS) {
      addPointArmed = false;
      renderCurveEditorUi();
      return;
    }

    const graphPoint = pointInSvg(clipperSvg, clientX, clientY);
    const driveDb = finiteParameter(parameterValues, "clipDriveDb", CLIPPER_STAGE_DEFAULTS.clipDriveDb);
    const driveGain = 10 ** (driveDb / 20);
    const baseValues = new Map(parameterValues);
    baseValues.set("amount", 0);
    const points = effectiveEditorCurve(baseValues);
    const externalInput = (graphPoint.x - CLIPPER_AXIS.left)
      / (CLIPPER_AXIS.right - CLIPPER_AXIS.left)
      * CLIPPER_AXIS.maximum;
    const drivenInput = clampValue(
      externalInput * driveGain,
      0.005,
      points.at(-1).x - 0.001,
    );
    let insertIndex = points.findIndex((point, index) => index > 0 && drivenInput < point.x);
    if (insertIndex < 1) insertIndex = points.length - 1;
    const left = points[insertIndex - 1];
    const right = points[insertIndex];
    const position = clampValue((drivenInput - left.x) / (right.x - left.x), 0.001, 0.999);
    const y = evaluateEditableCurve(drivenInput, baseValues);
    const controlY = left.y + (0.5 + 0.5 * right.bend) * (right.y - left.y);
    const leftControlY = left.y + (controlY - left.y) * position;
    const rightControlY = controlY + (right.y - controlY) * position;
    const leftBend = bendFromControl(left.y, y, leftControlY);
    const rightBend = bendFromControl(y, right.y, rightControlY);
    const nextPoints = points.slice(1).map(point => ({ ...point }));
    nextPoints.splice(insertIndex - 1, 0, { x: drivenInput, y, bend: leftBend });
    nextPoints[insertIndex].bend = rightBend;
    const changes = {};
    for (let index = 1; index <= nextPoints.length; index += 1) {
      changes[`curveP${index}X`] = nextPoints[index - 1].x;
      changes[`curveP${index}Y`] = nextPoints[index - 1].y;
      changes[`curveB${index}`] = nextPoints[index - 1].bend;
    }
    const amountPoint = Math.round(finiteParameter(parameterValues, "curveAmountPoint", 0));
    if (amountPoint >= insertIndex)
      changes.curveAmountPoint = amountPoint + 1;
    changes.curvePointCount = count + 1;
    selectedEditorPoint = insertIndex;
    addPointArmed = false;
    sendParameterTransaction(changes);
  }

  function removeSelectedEditorPoint() {
    if (!isCurveEditorEnabled(parameterValues)) return;
    const count = editorPointCount(parameterValues);
    if (count <= 2) return;
    const removeIndex = Math.round(clampValue(selectedEditorPoint, 1, count));
    const baseValues = new Map(parameterValues);
    baseValues.set("amount", 0);
    const points = effectiveEditorCurve(baseValues);
    let mergedBend;
    if (removeIndex < count) {
      const left = points[removeIndex - 1];
      const removed = points[removeIndex];
      const right = points[removeIndex + 1];
      const position = (removed.x - left.x) / (right.x - left.x);
      const outputPosition = Math.abs(right.y - left.y) < 1e-9
        ? position
        : (removed.y - left.y) / (right.y - left.y);
      mergedBend = clampValue(
        (outputPosition - position) / Math.max(1e-9, position * (1 - position)),
        -1,
        1,
      );
    }

    const nextPoints = points.slice(1).map(point => ({ ...point }));
    nextPoints.splice(removeIndex - 1, 1);
    if (mergedBend !== undefined)
      nextPoints[removeIndex - 1].bend = mergedBend;
    const changes = {};
    for (let index = 1; index <= nextPoints.length; index += 1) {
      changes[`curveP${index}X`] = nextPoints[index - 1].x;
      changes[`curveP${index}Y`] = nextPoints[index - 1].y;
      changes[`curveB${index}`] = nextPoints[index - 1].bend;
    }
    const amountPoint = Math.round(finiteParameter(parameterValues, "curveAmountPoint", 0));
    if (amountPoint === removeIndex)
      changes.curveAmountPoint = 0;
    else if (amountPoint > removeIndex)
      changes.curveAmountPoint = amountPoint - 1;
    changes.curvePointCount = count - 1;
    selectedEditorPoint = Math.min(removeIndex, count - 1);
    sendParameterTransaction(changes);
  }

  function toggleSelectedAmountMotion() {
    if (!isCurveEditorEnabled(parameterValues)) return;
    const amountPoint = Math.round(finiteParameter(parameterValues, "curveAmountPoint", 0));
    if (amountPoint === selectedEditorPoint) {
      sendParameterTransaction({ curveAmountPoint: 0 });
      return;
    }
    const base = editorPointsAtAmount(0)[selectedEditorPoint];
    sendParameterTransaction({
      curveAmountTargetX: base.x,
      curveAmountTargetY: base.y,
      curveAmountPoint: selectedEditorPoint,
    });
  }

  function applyExactEditorInput(input) {
    if (!isCurveEditorEnabled(parameterValues) || input.disabled) return;
    const numeric = Number(input.value);
    if (!Number.isFinite(numeric)) return;
    const value = clampValue(numeric, Number(input.min), Number(input.max));
    const endpointID = input === exactXInput
      ? `curveP${selectedEditorPoint}X`
      : input === exactYInput
        ? `curveP${selectedEditorPoint}Y`
        : input === exactBendInput
          ? `curveB${selectedEditorPoint}`
          : input === amountXInput
            ? "curveAmountTargetX"
            : "curveAmountTargetY";
    sendParameterTransaction({ [endpointID]: value });
  }

  function onExactInputKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyExactEditorInput(event.currentTarget);
  }

  function setReadout(label, formattedValue, visible) {
    readout.textContent = `${label}  ${formattedValue}`;
    readout.dataset.visible = String(visible);
  }

  function finishGesture(cancelled) {
    const gesture = activeGesture;
    if (!gesture) return;
    activeGesture = null;

    const endpointIDs = gesture.endpointIDs ?? (gesture.endpointID ? [gesture.endpointID] : []);
    if (cancelled && gesture.changed) {
      for (const endpointID of endpointIDs) {
        const startValue = gesture.startValues?.[endpointID] ?? gesture.startValue;
        sendParameter(endpointID, startValue);
      }
    }

    try {
      if (gesture.handle.hasPointerCapture(gesture.pointerId))
        gesture.handle.releasePointerCapture(gesture.pointerId);
    } catch {
      // Capture can already be gone on host cancellation.
    }

    for (const endpointID of endpointIDs)
      patchConnection.sendParameterGestureEnd?.(endpointID);
    if (gesture.label && gesture.formatValue) {
      const resetValue = gesture.startValues
        ? `in ${gesture.startXValue.toFixed(4)} · out ${gesture.startYValue.toFixed(4)}`
        : gesture.formatValue(gesture.startValue);
      setReadout(gesture.label, resetValue, false);
    }
  }

  function onPointerDown(event) {
    if (event.currentTarget === clipperSvg && addPointArmed && event.button === 0) {
      event.preventDefault();
      addEditorPointAt(event.clientX, event.clientY);
      return;
    }
    const explicitHandle = event.target?.closest?.("[data-graph-handle]");
    let handle = explicitHandle;
    const explicitName = explicitHandle?.dataset.graphHandle;
    const explicitBendGrip = /^(?:bend|segment)[1-7]$/.test(explicitName ?? "");
    if (event.currentTarget === clipperSvg && explicitName !== "drive" && !explicitBendGrip) {
      let nearestKnot;
      for (const candidate of knotHandles()) {
        const bounds = candidate.getBoundingClientRect();
        const distance = Math.hypot(
          event.clientX - (bounds.left + bounds.width * 0.5),
          event.clientY - (bounds.top + bounds.height * 0.5),
        );
        if (!nearestKnot || distance < nearestKnot.distance)
          nearestKnot = { handle: candidate, distance };
      }

      let nearestSegment;
      for (const candidate of segmentHandles()) {
        const distance = distanceToPathInScreen(candidate, event.clientX, event.clientY);
        if (!nearestSegment || distance < nearestSegment.distance)
          nearestSegment = { handle: candidate, distance };
      }

      if (explicitName === "amountTarget") {
        const targetBounds = explicitHandle.getBoundingClientRect();
        const targetDistance = Math.hypot(
          event.clientX - (targetBounds.left + targetBounds.width * 0.5),
          event.clientY - (targetBounds.top + targetBounds.height * 0.5),
        );
        // The target diamond owns its own centre, but its touch square must not
        // steal the exact centre of a nearby ordinary point.
        if (nearestKnot?.distance <= 8 && nearestKnot.distance + 1 < targetDistance)
          handle = nearestKnot.handle;
      } else {
        // A point owns its exact centre. Between point centres, the visible
        // curve owns the gesture even when a point's larger target is on top.
        if (nearestKnot?.distance <= 8)
          handle = nearestKnot.handle;
        else if (nearestSegment?.distance <= 22)
          handle = nearestSegment.handle;
        else if (nearestKnot?.distance <= 34)
          handle = nearestKnot.handle;
      }
    }
    if (!handle || activeGesture || event.button !== 0) return;
    const handleName = handle.dataset.graphHandle ?? handle.dataset.segmentHandle;
    const knotMatch = /^knot([1-7])$/.exec(handleName);
    const segmentMatch = /^segment([1-7])$/.exec(handleName);
    const bendMatch = /^bend([1-7])$/.exec(handleName);
    if (!["threshold", "ratio", "knee", "makeup", "drive"].includes(handleName)
        && handleName !== "amountTarget" && !knotMatch && !segmentMatch && !bendMatch) return;

    event.preventDefault();
    if (handleName === "drive") {
      const startValue = finiteParameter(parameterValues, "clipDriveDb", CLIPPER_STAGE_DEFAULTS.clipDriveDb);
      const p1x = isCurveEditorEnabled(parameterValues)
        ? effectiveEditorCurve(parameterValues)[1].x
        : sanitizeCurve(currentCurveValues())[1].x;
      const trueBoundary = p1x / (10 ** (startValue / 20));
      activeGesture = {
        pointerId: event.pointerId,
        handle,
        handleName,
        svg: clipperSvg,
        endpointID: "clipDriveDb",
        startPoint: pointInSvg(clipperSvg, event.clientX, event.clientY),
        startValue,
        startDisplayedBoundary: clampValue(trueBoundary, 0.02, CLIPPER_AXIS.maximum),
        changed: false,
        label: "Drive",
        formatValue: formatDb,
      };
      try { handle.setPointerCapture(event.pointerId); } catch { /* window listeners remain authoritative */ }
      patchConnection.sendParameterGestureStart?.("clipDriveDb");
      setReadout("Drive", formatDb(startValue), true);
      return;
    }
    if (handleName === "amountTarget" || knotMatch) {
      const editorEnabled = isCurveEditorEnabled(parameterValues);
      const knotIndex = handleName === "amountTarget"
        ? Math.round(finiteParameter(parameterValues, "curveAmountPoint", 0))
        : Number(knotMatch[1]);
      if (knotIndex < 1) return;
      if (editorEnabled) {
        selectedEditorPoint = knotIndex;
        renderCurveEditorUi();
      }
      const rawCurveValues = editorEnabled
        ? {
          [`curveP${knotIndex}X`]: rawEditorPointValue(knotIndex, "X"),
          [`curveP${knotIndex}Y`]: rawEditorPointValue(knotIndex, "Y"),
          curveAmountTargetX: finiteParameter(parameterValues, "curveAmountTargetX", rawEditorPointValue(knotIndex, "X")),
          curveAmountTargetY: finiteParameter(parameterValues, "curveAmountTargetY", rawEditorPointValue(knotIndex, "Y")),
        }
        : currentCurveValues();
      const points = editorEnabled
        ? (handleName === "amountTarget" ? editorPointsAtAmount(100) : editorPointsAtAmount(0))
        : sanitizeCurve(rawCurveValues);
      const driveDb = finiteParameter(parameterValues, "clipDriveDb", CLIPPER_STAGE_DEFAULTS.clipDriveDb);
      const driveGain = 10 ** (driveDb / 20);
      const mix = clampValue(finiteParameter(parameterValues, "clipMix", 100) * 0.01, 0, 1);
      const point = points[knotIndex];
      const previous = points[knotIndex - 1];
      const next = points[knotIndex + 1];
      const externalInput = point.x / driveGain;
      const xEndpointID = handleName === "amountTarget" ? "curveAmountTargetX" : `curveP${knotIndex}X`;
      const yEndpointID = handleName === "amountTarget" ? "curveAmountTargetY" : `curveP${knotIndex}Y`;
      const finalIndex = points.length - 1;
      activeGesture = {
        pointerId: event.pointerId,
        handle,
        handleName,
        kind: "point",
        svg: clipperSvg,
        endpointIDs: [xEndpointID, yEndpointID],
        startValues: {
          [xEndpointID]: rawCurveValues[xEndpointID],
          [yEndpointID]: rawCurveValues[yEndpointID],
        },
        startPoint: pointInSvg(clipperSvg, event.clientX, event.clientY),
        knotIndex,
        startXValue: point.x,
        startYValue: point.y,
        externalInput,
        startOutput: externalInput + (point.y - externalInput) * mix,
        driveGain,
        mix,
        minimumX: knotIndex === 1 ? 0.01 : previous.x + 0.001,
        maximumX: knotIndex === finalIndex
          ? 1.5
          : next.x - 0.001,
        minimumY: knotIndex === 1 ? 0 : previous.y,
        maximumY: knotIndex === finalIndex
          ? 1.5
          : next.y,
        changed: false,
        label: handleName === "amountTarget"
          ? `Point ${knotIndex} · Amount 100%`
          : knotIndex === finalIndex ? "Ceiling" : `Point ${knotIndex}`,
        formatValue: value => Number(value).toFixed(4),
      };
      try { handle.setPointerCapture(event.pointerId); } catch { /* window listeners remain authoritative */ }
      for (const endpointID of activeGesture.endpointIDs)
        patchConnection.sendParameterGestureStart?.(endpointID);
      setReadout(
        activeGesture.label,
        `in ${point.x.toFixed(4)} · out ${point.y.toFixed(4)}`,
        true,
      );
      return;
    }
    if (segmentMatch || bendMatch) {
      const editorBend = Boolean(bendMatch);
      const segmentIndex = Number((bendMatch ?? segmentMatch)[1]);
      const endpointID = editorBend ? `curveB${segmentIndex}` : `curveP${segmentIndex}T`;
      const startValue = finiteParameter(
        parameterValues,
        endpointID,
        editorBend ? 0 : CURVE_DEFAULTS[endpointID],
      );
      activeGesture = {
        pointerId: event.pointerId,
        handle,
        handleName,
        kind: "bend",
        svg: clipperSvg,
        endpointID,
        startPoint: pointInSvg(clipperSvg, event.clientX, event.clientY),
        startValue,
        changed: false,
        label: editorBend
          ? `Segment ${segmentIndex} bend`
          : segmentIndex === 3 ? "Ceiling roundness" : `Segment ${segmentIndex} roundness`,
        formatValue: value => Number(value).toFixed(3),
      };
      try { handle.setPointerCapture(event.pointerId); } catch { /* window listeners remain authoritative */ }
      patchConnection.sendParameterGestureStart?.(endpointID);
      setReadout(activeGesture.label, activeGesture.formatValue(startValue), true);
      return;
    }
    const settings = effectiveCompressorSettings(parameterValues);
    const endpointID = handleName === "threshold"
      ? "thresholdDb"
      : handleName === "knee"
        ? "kneeDb"
        : handleName === "makeup"
          ? "makeupDb"
        : settings.macro < 0.5 ? "ratio" : "macroRatioTarget";
    const startValue = finiteParameter(parameterValues, endpointID, endpointID === "thresholdDb"
      ? COMPRESSOR_DEFAULTS.thresholdDb
      : endpointID === "kneeDb" ? COMPRESSOR_DEFAULTS.kneeDb
        : endpointID === "makeupDb" ? COMPRESSOR_DEFAULTS.makeupDb
        : endpointID === "ratio" ? COMPRESSOR_DEFAULTS.ratio : COMPRESSOR_DEFAULTS.macroRatioTarget);
    activeGesture = {
      pointerId: event.pointerId,
      handle,
      svg: compressorSvg,
      handleName,
      endpointID,
      startPoint: pointInSvg(compressorSvg, event.clientX, event.clientY),
      startValue,
      changed: false,
      label: handleName === "threshold"
        ? "Threshold"
        : handleName === "knee" ? "Knee width"
          : handleName === "makeup" ? "Makeup"
          : endpointID === "ratio" ? "Ratio" : "Ratio target",
      formatValue: handleName === "threshold" || handleName === "knee" || handleName === "makeup"
        ? formatDb
        : value => `${Number(value).toFixed(Number(value) >= 100 ? 0 : 2)}:1`,
      probeInput: handleName === "ratio" ? ratioProbeInput(settings) : undefined,
      startOutput: handleName === "ratio"
        ? evaluateCompressorTransfer(ratioProbeInput(settings), parameterValues)
        : undefined,
    };
    try { handle.setPointerCapture(event.pointerId); } catch { /* window listeners remain authoritative */ }
    patchConnection.sendParameterGestureStart?.(endpointID);
    setReadout(activeGesture.label, activeGesture.formatValue(startValue), true);
  }

  function onPointerMove(event) {
    const gesture = activeGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.preventDefault();
    const point = pointInSvg(gesture.svg, event.clientX, event.clientY);
    if (gesture.handleName === "drive") {
      const plotWidth = CLIPPER_AXIS.right - CLIPPER_AXIS.left;
      const graphRange = CLIPPER_AXIS.maximum - CLIPPER_AXIS.minimum;
      const targetBoundary = clampValue(
        gesture.startDisplayedBoundary + (point.x - gesture.startPoint.x) * graphRange / plotWidth,
        0.02,
        CLIPPER_AXIS.maximum,
      );
      const value = clampValue(
        gesture.startValue - 20 * Math.log10(targetBoundary / gesture.startDisplayedBoundary),
        -24,
        36,
      );
      if (Math.abs(value - finiteParameter(parameterValues, gesture.endpointID, gesture.startValue)) < 1e-9)
        return;
      gesture.changed = true;
      sendParameter(gesture.endpointID, value);
      setReadout(gesture.label, gesture.formatValue(value), true);
      return;
    }
    if (gesture.kind === "point") {
      const graphRange = CLIPPER_AXIS.maximum - CLIPPER_AXIS.minimum;
      const plotWidth = CLIPPER_AXIS.right - CLIPPER_AXIS.left;
      const plotHeight = CLIPPER_AXIS.bottom - CLIPPER_AXIS.top;
      const externalTarget = gesture.externalInput
        + (point.x - gesture.startPoint.x) * graphRange / plotWidth;
      const xValue = clampValue(externalTarget * gesture.driveGain, gesture.minimumX, gesture.maximumX);
      const targetOutput = gesture.startOutput
        - (point.y - gesture.startPoint.y) * graphRange / plotHeight;
      const yValue = gesture.mix <= 0.0001
        ? gesture.startYValue
        : clampValue(
          (targetOutput - externalTarget * (1 - gesture.mix)) / gesture.mix,
          gesture.minimumY,
          gesture.maximumY,
        );
      const [xEndpointID, yEndpointID] = gesture.endpointIDs;
      let wrote = false;
      if (Math.abs(xValue - finiteParameter(parameterValues, xEndpointID, gesture.startXValue)) >= 1e-9) {
        sendParameter(xEndpointID, xValue);
        wrote = true;
      }
      if (Math.abs(yValue - finiteParameter(parameterValues, yEndpointID, gesture.startYValue)) >= 1e-9) {
        sendParameter(yEndpointID, yValue);
        wrote = true;
      }
      if (!wrote) return;
      gesture.changed = true;
      setReadout(gesture.label, `in ${xValue.toFixed(4)} · out ${yValue.toFixed(4)}`, true);
      return;
    }
    if (gesture.kind === "bend") {
      const plotHeight = CLIPPER_AXIS.bottom - CLIPPER_AXIS.top;
      const value = clampValue(
        gesture.startValue - (point.y - gesture.startPoint.y) * 2 / plotHeight,
        -1,
        1,
      );
      if (Math.abs(value - finiteParameter(parameterValues, gesture.endpointID, gesture.startValue)) < 1e-9)
        return;
      gesture.changed = true;
      sendParameter(gesture.endpointID, value);
      setReadout(gesture.label, gesture.formatValue(value), true);
      return;
    }
    const graphRange = COMPRESSOR_AXIS.maximum - COMPRESSOR_AXIS.minimum;
    let value;
    if (gesture.handleName === "threshold" || gesture.handleName === "knee") {
      const plotWidth = COMPRESSOR_AXIS.right - COMPRESSOR_AXIS.left;
      value = clampValue(
        gesture.startValue
          + (point.x - gesture.startPoint.x) * graphRange / plotWidth * (gesture.handleName === "knee" ? 2 : 1),
        gesture.handleName === "knee" ? 0 : -36,
        gesture.handleName === "knee" ? 24 : 6,
      );
    } else if (gesture.handleName === "makeup") {
      const plotHeight = COMPRESSOR_AXIS.bottom - COMPRESSOR_AXIS.top;
      value = clampValue(
        gesture.startValue - (point.y - gesture.startPoint.y) * graphRange / plotHeight,
        -24,
        24,
      );
    } else {
      const plotHeight = COMPRESSOR_AXIS.bottom - COMPRESSOR_AXIS.top;
      const targetOutput = gesture.startOutput
        - (point.y - gesture.startPoint.y) * graphRange / plotHeight;
      value = solveRatioEndpoint({
        parameterValues,
        endpointID: gesture.endpointID,
        probeInput: gesture.probeInput,
        targetOutput,
      });
    }
    if (Math.abs(value - finiteParameter(parameterValues, gesture.endpointID, gesture.startValue)) < 1e-9)
      return;
    gesture.changed = true;
    sendParameter(gesture.endpointID, value);
    setReadout(gesture.label, gesture.formatValue(value), true);
  }

  function onPointerUp(event) {
    if (activeGesture && event.pointerId === activeGesture.pointerId)
      finishGesture(false);
  }

  function onPointerCancel(event) {
    if (activeGesture && event.pointerId === activeGesture.pointerId)
      finishGesture(true);
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && activeGesture) {
      event.preventDefault();
      finishGesture(true);
    }
  }

  function onWindowBlur() {
    finishGesture(true);
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") finishGesture(true);
  }

  function onAddPointClick() {
    if (!isCurveEditorEnabled(parameterValues)) return;
    addPointArmed = !addPointArmed;
    renderCurveEditorUi();
  }

  function pushTelemetry(frame = {}) {
    const compressorInputDb = Number(frame.compressorInputDb);
    const compressorOutputDb = Number(frame.compressorOutputDb);
    const hasOperatingPoint = Number.isFinite(compressorInputDb) && Number.isFinite(compressorOutputDb);
    compressorOperatingPoint.dataset.active = String(hasOperatingPoint);
    compressorOperatingInput.dataset.active = String(hasOperatingPoint);
    compressorOperatingOutput.dataset.active = String(hasOperatingPoint);
    if (hasOperatingPoint) {
      const x = mapInputDb(compressorInputDb);
      const y = mapOutputDb(compressorOutputDb);
      compressorOperatingPoint.setAttribute("cx", x.toFixed(3));
      compressorOperatingPoint.setAttribute("cy", y.toFixed(3));
      compressorOperatingPoint.dataset.inputDb = String(compressorInputDb);
      compressorOperatingPoint.dataset.outputDb = String(compressorOutputDb);
      compressorOperatingInput.setAttribute("d", `M${x.toFixed(3)} ${COMPRESSOR_AXIS.bottom}V${y.toFixed(3)}H${COMPRESSOR_AXIS.left}`);
      compressorOperatingOutput.setAttribute("x", (COMPRESSOR_AXIS.left + 8).toFixed(3));
      compressorOperatingOutput.setAttribute("y", (y - 8).toFixed(3));
      compressorOperatingOutput.textContent = `${formatDb(compressorInputDb)} → ${formatDb(compressorOutputDb)}`;
    }

    const gainReductionDb = Math.max(0, Math.abs(Number(frame.gainReductionDb) || 0));
    gainReductionHistory.push(gainReductionDb);
    if (gainReductionHistory.length > 120) gainReductionHistory.shift();
    const traceWidth = 716;
    const traceLeft = 42;
    const traceTop = 12;
    const traceBottom = 72;
    const path = gainReductionHistory.map((value, index) => {
      const x = gainReductionHistory.length <= 1
        ? traceLeft + traceWidth
        : traceLeft + traceWidth * index / (gainReductionHistory.length - 1);
      const y = traceTop + Math.min(24, value) / 24 * (traceBottom - traceTop);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    });
    gainReductionTrace.setAttribute("d", path.join(" "));
    gainReductionTrace.dataset.sampleCount = String(gainReductionHistory.length);
    gainReductionValue.textContent = formatDb(-gainReductionDb);

    const clipInput = Number(frame.clipInput);
    const clipOutput = Number(frame.clipOutput);
    const hasClipPoint = Number.isFinite(clipInput) && Number.isFinite(clipOutput);
    clipperOperatingPoint.dataset.active = String(hasClipPoint);
    clipperOperatingGuide.dataset.active = String(hasClipPoint);
    clipperOperatingLabel.dataset.active = String(hasClipPoint);
    if (hasClipPoint) {
      const x = mapClipperX(Math.abs(clipInput));
      const y = mapClipperY(Math.abs(clipOutput));
      const driveDb = finiteParameter(parameterValues, "clipDriveDb", CLIPPER_STAGE_DEFAULTS.clipDriveDb);
      const firstKnotInput = isCurveEditorEnabled(parameterValues)
        ? effectiveEditorCurve(parameterValues)[1].x
        : sanitizeCurve(currentCurveValues())[1].x;
      const clipped = Math.abs(clipInput) * (10 ** (driveDb / 20)) >= firstKnotInput;
      clipperOperatingPoint.setAttribute("cx", x.toFixed(3));
      clipperOperatingPoint.setAttribute("cy", y.toFixed(3));
      clipperOperatingPoint.dataset.input = String(clipInput);
      clipperOperatingPoint.dataset.output = String(clipOutput);
      clipperOperatingPoint.dataset.clipped = String(clipped);
      clipperOperatingGuide.setAttribute("d", `M${x.toFixed(3)} ${CLIPPER_AXIS.bottom}V${y.toFixed(3)}H${CLIPPER_AXIS.left}`);
      clipperOperatingLabel.setAttribute("x", (CLIPPER_AXIS.left + 8).toFixed(3));
      clipperOperatingLabel.setAttribute("y", (y - 8).toFixed(3));
      clipperOperatingLabel.textContent = `${clipInput.toFixed(3)} → ${clipOutput.toFixed(3)}${clipped ? " · CLIPPED" : " · CLEAN"}`;
    }
  }

  compressorSvg.addEventListener("pointerdown", onPointerDown);
  clipperSvg.addEventListener("pointerdown", onPointerDown);
  startEditorButton.addEventListener("click", toggleCurveEditor);
  addPointButton.addEventListener("click", onAddPointClick);
  removePointButton.addEventListener("click", removeSelectedEditorPoint);
  linkAmountButton.addEventListener("click", toggleSelectedAmountMotion);
  for (const input of [exactXInput, exactYInput, exactBendInput, amountXInput, amountYInput]) {
    input.addEventListener("change", () => applyExactEditorInput(input));
    input.addEventListener("keydown", onExactInputKeyDown);
  }
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onWindowBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);

  renderGraphs();

  return {
    render: renderGraphs,
    pushTelemetry,
    destroy() {
      finishGesture(true);
      compressorSvg.removeEventListener("pointerdown", onPointerDown);
      clipperSvg.removeEventListener("pointerdown", onPointerDown);
      startEditorButton.removeEventListener("click", toggleCurveEditor);
      addPointButton.removeEventListener("click", onAddPointClick);
      removePointButton.removeEventListener("click", removeSelectedEditorPoint);
      linkAmountButton.removeEventListener("click", toggleSelectedAmountMotion);
      for (const input of [exactXInput, exactYInput, exactBendInput, amountXInput, amountYInput])
        input.removeEventListener("keydown", onExactInputKeyDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
