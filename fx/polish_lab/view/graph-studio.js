import {
  COMPRESSOR_DEFAULTS,
  clampValue,
  effectiveCompressorSettings,
  evaluateCompressorTransfer,
  finiteParameter,
} from "./dynamics-model.js";
import {
  CLIPPER_STAGE_DEFAULTS,
  CURVE_DEFAULTS,
  evaluateClipperTransfer,
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
  const knotHandles = [1, 2, 3].map(index => root.querySelector(`[data-graph-handle="knot${index}"]`));
  const knotVisuals = [1, 2, 3].map(index => root.querySelector(`[data-graph-control="knot${index}"]`));
  const segmentHandles = [1, 2, 3].map(index => root.querySelector(`[data-curve-segment="${index}"]`));
  const clipperOperatingPoint = root.querySelector("[data-clipper-operating-point]");
  const clipperOperatingGuide = root.querySelector("[data-clipper-operating-guide]");
  const clipperOperatingLabel = root.querySelector("[data-clipper-operating-label]");
  let activeGesture = null;

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

    const points = sanitizeCurve(currentCurveValues());
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
    for (let index = 1; index <= 3; index += 1) {
      const point = points[index];
      const left = points[index - 1];
      const externalInput = point.x / driveGain;
      const externalOutput = externalInput + (point.y - externalInput) * clipMix;
      knotVisuals[index - 1].setAttribute(
        "transform",
        `translate(${mapClipperX(externalInput).toFixed(3)} ${mapClipperY(externalOutput).toFixed(3)})`,
      );
      knotHandles[index - 1].setAttribute(
        "aria-valuetext",
        `Input ${point.x.toFixed(3)}, output ${point.y.toFixed(3)}`,
      );

      const segmentPath = [];
      for (let sample = 0; sample <= 36; sample += 1) {
        const drivenInput = left.x + (point.x - left.x) * sample / 36;
        const input = drivenInput / driveGain;
        const output = evaluateClipperTransfer(input, parameterValues);
        segmentPath.push(
          `${sample === 0 ? "M" : "L"}${mapClipperX(input).toFixed(2)},${mapClipperY(output).toFixed(2)}`,
        );
      }
      segmentHandles[index - 1].setAttribute("d", segmentPath.join(" "));
      segmentHandles[index - 1].setAttribute("aria-valuenow", String(point.tension));
      segmentHandles[index - 1].setAttribute("aria-valuetext", `Roundness ${point.tension.toFixed(3)}`);
    }

    const positiveBoundaryX = mapClipperX(Math.min(clipBoundary, CLIPPER_AXIS.maximum));
    clipRegion.setAttribute("x", positiveBoundaryX.toFixed(3));
    clipRegion.setAttribute("width", Math.max(0, CLIPPER_AXIS.right - positiveBoundaryX).toFixed(3));
    root.querySelector("[data-clipper-graph-summary]").textContent =
      `${formatDb(driveDb)} drive · ${finiteParameter(parameterValues, "clipMix", 100).toFixed(1)}% mix`;
  }

  function renderGraphs() {
    renderCompressor();
    renderClipper();
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
    const explicitHandle = event.target?.closest?.("[data-graph-handle]");
    let handle = explicitHandle;
    if (event.currentTarget === clipperSvg && explicitHandle?.dataset.graphHandle !== "drive") {
      let nearestKnot;
      for (const candidate of clipperSvg.querySelectorAll('[data-graph-handle^="knot"]')) {
        const bounds = candidate.getBoundingClientRect();
        const distance = Math.hypot(
          event.clientX - (bounds.left + bounds.width * 0.5),
          event.clientY - (bounds.top + bounds.height * 0.5),
        );
        if (!nearestKnot || distance < nearestKnot.distance)
          nearestKnot = { handle: candidate, distance };
      }

      let nearestSegment;
      for (const candidate of segmentHandles) {
        const distance = distanceToPathInScreen(candidate, event.clientX, event.clientY);
        if (!nearestSegment || distance < nearestSegment.distance)
          nearestSegment = { handle: candidate, distance };
      }

      // A point owns its exact centre. Between point centres, the visible curve
      // owns the gesture even when a point's larger touch target is on top.
      if (nearestKnot?.distance <= 8)
        handle = nearestKnot.handle;
      else if (nearestSegment?.distance <= 22)
        handle = nearestSegment.handle;
      else if (nearestKnot?.distance <= 34)
        handle = nearestKnot.handle;
    }
    if (!handle || activeGesture || event.button !== 0) return;
    const handleName = handle.dataset.graphHandle;
    const knotMatch = /^knot([1-3])$/.exec(handleName);
    const segmentMatch = /^segment([1-3])$/.exec(handleName);
    if (!["threshold", "ratio", "knee", "makeup", "drive"].includes(handleName)
        && !knotMatch && !segmentMatch) return;

    event.preventDefault();
    if (handleName === "drive") {
      const startValue = finiteParameter(parameterValues, "clipDriveDb", CLIPPER_STAGE_DEFAULTS.clipDriveDb);
      const p1x = sanitizeCurve(currentCurveValues())[1].x;
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
    if (knotMatch) {
      const knotIndex = Number(knotMatch[1]);
      const rawCurveValues = currentCurveValues();
      const points = sanitizeCurve(rawCurveValues);
      const driveDb = finiteParameter(parameterValues, "clipDriveDb", CLIPPER_STAGE_DEFAULTS.clipDriveDb);
      const driveGain = 10 ** (driveDb / 20);
      const mix = clampValue(finiteParameter(parameterValues, "clipMix", 100) * 0.01, 0, 1);
      const point = points[knotIndex];
      const previous = points[knotIndex - 1];
      const next = points[knotIndex + 1];
      const externalInput = point.x / driveGain;
      const xEndpointID = `curveP${knotIndex}X`;
      const yEndpointID = `curveP${knotIndex}Y`;
      activeGesture = {
        pointerId: event.pointerId,
        handle,
        handleName,
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
        maximumX: knotIndex === 3
          ? 1.5
          : Math.min(knotIndex === 1 ? 1.45 : 1.48, next.x - 0.001),
        minimumY: knotIndex === 1 ? 0 : previous.y,
        maximumY: knotIndex === 3
          ? 1.5
          : Math.min(knotIndex === 1 ? 1.45 : 1.48, next.y),
        changed: false,
        label: knotIndex === 3 ? "Ceiling" : `Point ${knotIndex}`,
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
    if (segmentMatch) {
      const segmentIndex = Number(segmentMatch[1]);
      const startValue = finiteParameter(
        parameterValues,
        `curveP${segmentIndex}T`,
        CURVE_DEFAULTS[`curveP${segmentIndex}T`],
      );
      const endpointID = `curveP${segmentIndex}T`;
      activeGesture = {
        pointerId: event.pointerId,
        handle,
        handleName,
        svg: clipperSvg,
        endpointID,
        startPoint: pointInSvg(clipperSvg, event.clientX, event.clientY),
        startValue,
        changed: false,
        label: segmentIndex === 3 ? "Ceiling roundness" : `Segment ${segmentIndex} roundness`,
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
    if (gesture.handleName.startsWith("knot")) {
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
          (targetOutput - gesture.externalInput * (1 - gesture.mix)) / gesture.mix,
          gesture.minimumY,
          gesture.maximumY,
        );
      const xEndpointID = `curveP${gesture.knotIndex}X`;
      const yEndpointID = `curveP${gesture.knotIndex}Y`;
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
    if (gesture.handleName.startsWith("segment")) {
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
      const firstKnotInput = sanitizeCurve(currentCurveValues())[1].x;
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
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
