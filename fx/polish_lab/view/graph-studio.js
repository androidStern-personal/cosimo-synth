import {
  COMPRESSOR_DEFAULTS,
  evaluateCompressorTransfer,
  finiteParameter,
} from "./dynamics-model.js";
import {
  SHAPER_MAX_POINTS,
  effectiveShapePoints,
  evaluateBipolarTransfer,
  morphOwner,
  quadraticBow,
  rawShapePoint,
  shapePointCount,
  shapePointEndpointIDs,
} from "./curve-model.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const COMPRESSOR_AXIS = Object.freeze({
  minimum: -48,
  maximum: 12,
  left: 54,
  right: 746,
  top: 18,
  bottom: 262,
});

const SHAPER_AXIS = Object.freeze({
  minimum: -1.5,
  maximum: 1.5,
  left: 44,
  right: 756,
  top: 18,
  bottom: 402,
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

function mapX(value, axis) {
  return axis.left + ((value - axis.minimum) / (axis.maximum - axis.minimum)) * (axis.right - axis.left);
}

function mapY(value, axis) {
  return axis.bottom - ((value - axis.minimum) / (axis.maximum - axis.minimum)) * (axis.bottom - axis.top);
}

function sampledPath({ minimum, maximum, samples, evaluate, axis }) {
  const commands = [];
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

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, String(value));
  return element;
}

function sideLabel(side) {
  return side === "negative" ? "Negative" : "Positive";
}

export function createPolishGraphStudio({ root, patchConnection, parameterValues, sendParameter }) {
  const compressorCurve = root.querySelector("[data-compressor-curve]");
  const compressorSvg = root.querySelector('[data-transfer-graph="compressor"]');
  const compressorSummary = root.querySelector("[data-compressor-summary]");
  const compressorOperatingPoint = root.querySelector("[data-compressor-operating-point]");
  const kneeConnector = root.querySelector("[data-knee-connector]");
  const compressorReadout = root.querySelector("[data-compressor-readout]");
  const compressorReadoutText = root.querySelector("[data-compressor-readout-text]");
  const gainReductionTrace = root.querySelector("[data-gain-reduction-trace]");
  const shaperSvg = root.querySelector('[data-transfer-graph="shaper"]');
  const shaperCurve = root.querySelector("[data-shaper-curve]");
  const shaperSegments = root.querySelector("[data-shape-segments]");
  const shaperPoints = root.querySelector("[data-shape-points]");
  const morphVisuals = root.querySelector("[data-morph-visuals]");
  const shaperOperatingPoint = root.querySelector("[data-shaper-operating-point]");
  const shaperReadout = root.querySelector("[data-shaper-readout]");
  const shaperReadoutText = root.querySelector("[data-shaper-readout-text]");
  const selectionLabel = root.querySelector("[data-shape-selection]");
  const morphOwnerLabel = root.querySelector("[data-morph-owner]");
  const addPointButton = root.querySelector("[data-shape-add]");
  const deletePointButton = root.querySelector("[data-shape-delete]");
  const assignMorphButton = root.querySelector("[data-morph-assign]");
  const inspectorLabel = root.querySelector("[data-shape-inspector-label]");
  const exactFields = Object.fromEntries(
    Array.from(root.querySelectorAll("[data-shape-exact-field]"))
      .map(field => [field.dataset.shapeExactField, field]),
  );
  const exactFieldWraps = Object.fromEntries(
    Array.from(root.querySelectorAll("[data-shape-exact-wrap]"))
      .map(wrapper => [wrapper.dataset.shapeExactWrap, wrapper]),
  );
  const reductionHistory = [];
  let selection = { kind: "point", side: "positive", index: 1 };
  let activeGesture;

  function renderCompressor() {
    compressorCurve.setAttribute("d", sampledPath({
      minimum: COMPRESSOR_AXIS.minimum,
      maximum: COMPRESSOR_AXIS.maximum,
      samples: 240,
      evaluate: input => evaluateCompressorTransfer(input, parameterValues),
      axis: COMPRESSOR_AXIS,
    }));

    const threshold = finiteParameter(parameterValues, "thresholdDb", COMPRESSOR_DEFAULTS.thresholdDb);
    const ratio = finiteParameter(parameterValues, "ratio", COMPRESSOR_DEFAULTS.ratio);
    const knee = finiteParameter(parameterValues, "kneeDb", COMPRESSOR_DEFAULTS.kneeDb);
    const makeup = finiteParameter(parameterValues, "makeupDb", COMPRESSOR_DEFAULTS.makeupDb);
    compressorSummary.textContent = threshold.toFixed(1)
      + " dB · "
      + ratio.toFixed(2)
      + ":1 · "
      + knee.toFixed(1)
      + " dB knee";

    const kneeInput = clamp(threshold + knee * 0.5, COMPRESSOR_AXIS.minimum, COMPRESSOR_AXIS.maximum);
    const kneeCurveY = mapY(evaluateCompressorTransfer(kneeInput, parameterValues), COMPRESSOR_AXIS);
    const kneeHandleY = clamp(kneeCurveY - 32, COMPRESSOR_AXIS.top, COMPRESSOR_AXIS.bottom);
    const handles = {
      threshold: [
        threshold,
        mapY(evaluateCompressorTransfer(threshold, parameterValues), COMPRESSOR_AXIS),
      ],
      ratio: [
        COMPRESSOR_AXIS.maximum,
        mapY(evaluateCompressorTransfer(COMPRESSOR_AXIS.maximum, parameterValues), COMPRESSOR_AXIS),
      ],
      knee: [
        kneeInput,
        kneeHandleY,
      ],
      makeup: [
        -36,
        mapY(evaluateCompressorTransfer(-36, parameterValues), COMPRESSOR_AXIS),
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

  function segmentPath(side, left, right) {
    const commands = [];
    for (let sample = 0; sample <= 28; sample += 1) {
      const position = sample / 28;
      const magnitude = left.x + (right.x - left.x) * position;
      const output = left.y + (right.y - left.y) * quadraticBow(position, right.bend);
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

  function currentShapeGeometry() {
    const points = [];
    const segments = [];
    const owner = morphOwner(parameterValues);
    for (const side of ["negative", "positive"]) {
      const sidePoints = effectiveShapePoints(parameterValues, side);
      for (let index = 1; index < sidePoints.length; index += 1) {
        const point = sidePoints[index];
        const ownsMorph = side === owner.side && point.index === owner.index;
        const raw = ownsMorph ? rawShapePoint(parameterValues, side, point.index) : point;
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
    const count = shapePointCount(parameterValues, selection.side);
    if (selection.index > count) selection.index = count;
    const selectionName = selection.kind === "morph"
      ? "Morph B"
      : sideLabel(selection.side) + " " + selection.kind + " " + selection.index;
    selectionLabel.textContent = selectionName;
    addPointButton.disabled = count >= SHAPER_MAX_POINTS || selection.kind === "morph";
    deletePointButton.disabled = selection.kind !== "point" || count <= 1;
    const owner = morphOwner(parameterValues);
    morphOwnerLabel.textContent = "Morph A: " + sideLabel(owner.side) + " point " + owner.index;

    inspectorLabel.textContent = selectionName;
    const hasCoordinates = selection.kind === "point" || selection.kind === "morph";
    exactFieldWraps.input.hidden = !hasCoordinates;
    exactFieldWraps.output.hidden = !hasCoordinates;
    exactFieldWraps.bend.hidden = hasCoordinates;
    const point = rawShapePoint(parameterValues, selection.side, selection.index);
    if (hasCoordinates) {
      const inputMagnitude = selection.kind === "morph"
        ? Number(parameterValues.get("morphTargetX"))
        : point.x;
      const output = selection.kind === "morph"
        ? Number(parameterValues.get("morphTargetY"))
        : point.y;
      exactFields.input.min = selection.side === "negative" ? "-1.5" : "0.01";
      exactFields.input.max = selection.side === "negative" ? "-0.01" : "1.5";
      exactFields.input.value = String(selection.side === "negative" ? -inputMagnitude : inputMagnitude);
      exactFields.output.value = String(output);
    } else {
      exactFields.bend.value = String(point.bend);
    }
  }

  function updateStableGeometry(geometry) {
    for (const segment of geometry.segments) {
      shaperSegments.querySelector(
        '[data-shape-side="' + segment.side + '"][data-shape-index="' + segment.index + '"]',
      )?.setAttribute("d", segment.path);
    }
    for (const point of geometry.points) {
      const handle = shaperPoints.querySelector(
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

  function morphEndpointGeometry() {
    const owner = morphOwner(parameterValues);
    const point = rawShapePoint(parameterValues, owner.side, owner.index);
    const targetXValue = Number(parameterValues.get("morphTargetX"));
    const targetYValue = Number(parameterValues.get("morphTargetY"));
    const targetX = Number.isFinite(targetXValue) ? targetXValue : point.x;
    const targetY = Number.isFinite(targetYValue) ? targetYValue : point.y;
    const sign = owner.side === "negative" ? -1 : 1;
    return [
      { endpoint: "A", side: owner.side, index: owner.index, x: point.x, y: point.y, input: point.x * sign },
      { endpoint: "B", side: owner.side, index: owner.index, x: targetX, y: targetY, input: targetX * sign },
    ];
  }

  function renderMorphVisuals() {
    const endpoints = morphEndpointGeometry().filter(endpoint => endpoint.endpoint === "B");
    if (!activeGesture) morphVisuals.replaceChildren();
    for (const endpoint of endpoints) {
      let handle = morphVisuals.querySelector('[data-morph-endpoint="' + endpoint.endpoint + '"]');
      if (!handle) {
        handle = createSvgElement("g", {
          "data-morph-endpoint": endpoint.endpoint,
          role: "slider",
          tabindex: "0",
          "aria-label": "Morph " + endpoint.endpoint + " position",
          "aria-description": "Drag in two dimensions to set Morph position " + endpoint.endpoint + ".",
          "data-control-help": "Morph " + endpoint.endpoint + ": drag in two dimensions.",
        });
        handle.append(
          createSvgElement("circle", { class: "morph-endpoint-hit", r: 24 }),
          createSvgElement("circle", { class: "morph-endpoint", r: 12 }),
        );
        const label = createSvgElement("text", { class: "morph-endpoint-label", x: 0, y: 0 });
        label.textContent = endpoint.endpoint;
        handle.append(label);
        morphVisuals.append(handle);
      }
      handle.dataset.shapeSide = endpoint.side;
      handle.dataset.shapeIndex = String(endpoint.index);
      handle.dataset.shapeInput = String(endpoint.input);
      handle.dataset.shapeOutput = String(endpoint.y);
      handle.setAttribute(
        "transform",
        "translate(" + mapX(endpoint.input, SHAPER_AXIS) + " " + mapY(endpoint.y, SHAPER_AXIS) + ")",
      );
    }
  }

  function renderShaper() {
    shaperCurve.setAttribute("d", sampledPath({
      minimum: SHAPER_AXIS.minimum,
      maximum: SHAPER_AXIS.maximum,
      samples: 300,
      evaluate: input => evaluateBipolarTransfer(input, parameterValues),
      axis: SHAPER_AXIS,
    }));

    const geometry = currentShapeGeometry();
    renderSelection();
    if (activeGesture) {
      updateStableGeometry(geometry);
      renderMorphVisuals();
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
        "aria-description": "Drag vertically on the curve to bend this segment.",
        "data-control-help": "Drag vertically on the curve to bend this segment.",
      }));
    }

    shaperPoints.replaceChildren();
    const owner = morphOwner(parameterValues);
    for (const point of geometry.points) {
      const ownsMorph = point.side === owner.side && point.index === owner.index;
      const attributes = {
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
    renderMorphVisuals();
  }

  function render() {
    renderCompressor();
    renderShaper();
  }

  function svgValueAt(clientX, clientY) {
    const point = shaperSvg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(shaperSvg.getScreenCTM().inverse());
    return {
      input: SHAPER_AXIS.minimum
        + ((local.x - SHAPER_AXIS.left) / (SHAPER_AXIS.right - SHAPER_AXIS.left))
        * (SHAPER_AXIS.maximum - SHAPER_AXIS.minimum),
      output: SHAPER_AXIS.minimum
        + ((SHAPER_AXIS.bottom - local.y) / (SHAPER_AXIS.bottom - SHAPER_AXIS.top))
        * (SHAPER_AXIS.maximum - SHAPER_AXIS.minimum),
    };
  }

  function compressorValueAt(clientX, clientY) {
    const point = compressorSvg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(compressorSvg.getScreenCTM().inverse());
    return {
      input: COMPRESSOR_AXIS.minimum
        + ((local.x - COMPRESSOR_AXIS.left) / (COMPRESSOR_AXIS.right - COMPRESSOR_AXIS.left))
        * (COMPRESSOR_AXIS.maximum - COMPRESSOR_AXIS.minimum),
      output: COMPRESSOR_AXIS.minimum
        + ((COMPRESSOR_AXIS.bottom - local.y) / (COMPRESSOR_AXIS.bottom - COMPRESSOR_AXIS.top))
        * (COMPRESSOR_AXIS.maximum - COMPRESSOR_AXIS.minimum),
    };
  }

  function endpointIDsForGesture(gesture) {
    if (gesture.kind === "compressor") return [gesture.endpointID];
    return gesture.kind === "point"
      ? [gesture.endpointIDs.x, gesture.endpointIDs.y]
      : [gesture.endpointID];
  }

  function showReadout(element, textElement, text) {
    textElement.textContent = text;
    element.dataset.visible = "true";
  }

  function hideReadout(element) {
    element.dataset.visible = "false";
  }

  function compressorReadoutFor(control, value) {
    if (control === "threshold") return "Threshold  " + value.toFixed(2) + " dB";
    if (control === "ratio") return "Ratio  " + value.toFixed(2) + ":1";
    if (control === "knee") return "Knee  " + value.toFixed(2) + " dB";
    return "Makeup  " + value.toFixed(2) + " dB";
  }

  function finishGesture(cancelled) {
    const gesture = activeGesture;
    if (!gesture) return;
    if (cancelled && gesture.changed) {
      if (gesture.kind === "compressor") {
        sendParameter(gesture.endpointID, gesture.startValue);
      } else if (gesture.kind === "point") {
        sendParameter(gesture.endpointIDs.x, gesture.startX);
        sendParameter(gesture.endpointIDs.y, gesture.startY);
      } else {
        sendParameter(gesture.endpointID, gesture.startValue);
      }
    }
    for (const endpointID of endpointIDsForGesture(gesture))
      patchConnection.sendParameterGestureEnd?.(endpointID);
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

  function beginPointGesture(handle, event) {
    const side = handle.dataset.shapeSide;
    const index = Number(handle.dataset.shapeIndex);
    selection = { kind: "point", side, index };
    const raw = rawShapePoint(parameterValues, side, index);
    const points = effectiveShapePoints(parameterValues, side);
    const endpointIDs = shapePointEndpointIDs(side, index);
    activeGesture = {
      kind: "point",
      pointerId: event.pointerId,
      handle,
      side,
      endpointIDs,
      startPointer: svgValueAt(event.clientX, event.clientY),
      startX: raw.x,
      startY: raw.y,
      minimumX: points[index - 1].x + 0.001,
      maximumX: points[index + 1]?.x - 0.001 || 1.5,
      changed: false,
    };
    patchConnection.sendParameterGestureStart?.(endpointIDs.x);
    patchConnection.sendParameterGestureStart?.(endpointIDs.y);
    showReadout(
      shaperReadout,
      shaperReadoutText,
      sideLabel(side) + " point " + index + "  in "
        + (side === "negative" ? -raw.x : raw.x).toFixed(3)
        + "  out " + raw.y.toFixed(3),
    );
  }

  function beginSegmentGesture(handle, event) {
    const side = handle.dataset.shapeSide;
    const index = Number(handle.dataset.shapeIndex);
    const endpointID = shapePointEndpointIDs(side, index).bend;
    selection = { kind: "segment", side, index };
    activeGesture = {
      kind: "bend",
      pointerId: event.pointerId,
      handle,
      side,
      endpointID,
      startPointer: svgValueAt(event.clientX, event.clientY),
      startValue: rawShapePoint(parameterValues, side, index).bend,
      changed: false,
    };
    patchConnection.sendParameterGestureStart?.(endpointID);
    showReadout(
      shaperReadout,
      shaperReadoutText,
      sideLabel(side) + " segment " + index + "  bend " + activeGesture.startValue.toFixed(3),
    );
  }

  function beginMorphGesture(handle, event) {
    const endpoint = handle.dataset.morphEndpoint;
    const side = handle.dataset.shapeSide;
    const index = Number(handle.dataset.shapeIndex);
    const points = effectiveShapePoints(parameterValues, side);
    const pointIDs = shapePointEndpointIDs(side, index);
    const endpointIDs = endpoint === "A"
      ? { x: pointIDs.x, y: pointIDs.y }
      : { x: "morphTargetX", y: "morphTargetY" };
    const raw = endpoint === "A"
      ? rawShapePoint(parameterValues, side, index)
      : {
          x: Number(parameterValues.get("morphTargetX")),
          y: Number(parameterValues.get("morphTargetY")),
        };
    selection = { kind: endpoint === "B" ? "morph" : "point", side, index };
    activeGesture = {
      kind: "point",
      pointerId: event.pointerId,
      handle,
      side,
      endpointIDs,
      startPointer: svgValueAt(event.clientX, event.clientY),
      startX: raw.x,
      startY: raw.y,
      minimumX: points[index - 1].x + 0.001,
      maximumX: points[index + 1]?.x - 0.001 || 1.5,
      changed: false,
    };
    patchConnection.sendParameterGestureStart?.(endpointIDs.x);
    patchConnection.sendParameterGestureStart?.(endpointIDs.y);
    showReadout(
      shaperReadout,
      shaperReadoutText,
      (endpoint === "B" ? "Morph B" : "Morph A") + "  in "
        + (side === "negative" ? -raw.x : raw.x).toFixed(3)
        + "  out " + raw.y.toFixed(3),
    );
  }

  function onPointerDown(event) {
    if (activeGesture) return;
    const morphHandle = event.target?.closest?.("[data-morph-endpoint]");
    const pointHandle = event.target?.closest?.("[data-shape-point-handle]");
    const segmentHandle = event.target?.closest?.("[data-shape-segment-handle]");
    if (!morphHandle && !pointHandle && !segmentHandle) return;
    if (morphHandle) beginMorphGesture(morphHandle, event);
    else if (pointHandle) beginPointGesture(pointHandle, event);
    else beginSegmentGesture(segmentHandle, event);
    renderSelection();
    try {
      activeGesture.handle.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners retain ownership if SVG pointer capture is unavailable.
    }
    event.preventDefault();
  }

  function beginCompressorGesture(handle, event) {
    const control = handle.dataset.graphHandle;
    const endpointID = control === "threshold"
      ? "thresholdDb"
      : control === "knee"
        ? "kneeDb"
        : control === "makeup"
          ? "makeupDb"
          : "ratio";
    const fallback = endpointID === "thresholdDb"
      ? COMPRESSOR_DEFAULTS.thresholdDb
      : endpointID === "kneeDb"
        ? COMPRESSOR_DEFAULTS.kneeDb
        : endpointID === "makeupDb"
          ? COMPRESSOR_DEFAULTS.makeupDb
          : COMPRESSOR_DEFAULTS.ratio;
    activeGesture = {
      kind: "compressor",
      control,
      endpointID,
      pointerId: event.pointerId,
      handle,
      startPointer: compressorValueAt(event.clientX, event.clientY),
      startValue: finiteParameter(parameterValues, endpointID, fallback),
      startOutput: evaluateCompressorTransfer(COMPRESSOR_AXIS.maximum, parameterValues),
      changed: false,
    };
    patchConnection.sendParameterGestureStart?.(endpointID);
    showReadout(compressorReadout, compressorReadoutText, compressorReadoutFor(control, activeGesture.startValue));
    try { handle.setPointerCapture(event.pointerId); } catch { /* document listeners retain ownership */ }
    event.preventDefault();
  }

  function onCompressorPointerDown(event) {
    if (activeGesture) return;
    const handle = event.target?.closest?.("[data-graph-handle]");
    if (handle) beginCompressorGesture(handle, event);
  }

  function solveRatio(targetOutput) {
    let lower = 1;
    let upper = 100;
    const values = Object.fromEntries(parameterValues);
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const candidate = (lower + upper) * 0.5;
      const output = evaluateCompressorTransfer(
        COMPRESSOR_AXIS.maximum,
        { ...values, ratio: candidate },
      );
      if (output > targetOutput) lower = candidate;
      else upper = candidate;
    }
    return (lower + upper) * 0.5;
  }

  function onPointerMove(event) {
    const gesture = activeGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (gesture.kind === "compressor") {
      const pointer = compressorValueAt(event.clientX, event.clientY);
      const inputDelta = pointer.input - gesture.startPointer.input;
      const outputDelta = pointer.output - gesture.startPointer.output;
      let value;
      if (gesture.control === "threshold")
        value = clamp(gesture.startValue + inputDelta, -36, 6);
      else if (gesture.control === "knee")
        value = clamp(gesture.startValue + inputDelta * 2, 0, 24);
      else if (gesture.control === "makeup")
        value = clamp(gesture.startValue + outputDelta, -24, 24);
      else
        value = solveRatio(gesture.startOutput + outputDelta);
      if (Math.abs(value - Number(parameterValues.get(gesture.endpointID))) >= 1e-9)
        sendParameter(gesture.endpointID, value);
      showReadout(compressorReadout, compressorReadoutText, compressorReadoutFor(gesture.control, value));
      gesture.changed = true;
      event.preventDefault();
      return;
    }
    const pointer = svgValueAt(event.clientX, event.clientY);
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
      if (Math.abs(nextX - Number(parameterValues.get(gesture.endpointIDs.x))) >= 1e-9)
        sendParameter(gesture.endpointIDs.x, nextX);
      if (Math.abs(nextY - Number(parameterValues.get(gesture.endpointIDs.y))) >= 1e-9)
        sendParameter(gesture.endpointIDs.y, nextY);
      showReadout(
        shaperReadout,
        shaperReadoutText,
        (gesture.endpointIDs.x === "morphTargetX" ? "Morph B" : sideLabel(gesture.side) + " point")
          + "  in " + (gesture.side === "negative" ? -nextX : nextX).toFixed(3)
          + "  out " + nextY.toFixed(3),
      );
    } else {
      const visualDirection = gesture.side === "negative" ? -1 : 1;
      const nextBend = clamp(
        gesture.startValue
          + (pointer.output - gesture.startPointer.output) * visualDirection,
        -1,
        1,
      );
      if (Math.abs(nextBend - Number(parameterValues.get(gesture.endpointID))) >= 1e-9)
        sendParameter(gesture.endpointID, nextBend);
      showReadout(
        shaperReadout,
        shaperReadoutText,
        sideLabel(gesture.side) + " segment  bend " + nextBend.toFixed(3),
      );
    }
    gesture.changed = true;
    event.preventDefault();
  }

  function sendTransaction(changes) {
    const entries = Object.entries(changes);
    for (const [endpointID] of entries)
      patchConnection.sendParameterGestureStart?.(endpointID);
    for (const [endpointID, value] of entries)
      sendParameter(endpointID, value);
    for (const [endpointID] of entries)
      patchConnection.sendParameterGestureEnd?.(endpointID);
  }

  function addPoint() {
    const side = selection.side;
    const count = shapePointCount(parameterValues, side);
    if (count >= SHAPER_MAX_POINTS) return;
    const insertIndex = clamp(selection.index, 1, count);
    const points = effectiveShapePoints(parameterValues, side);
    const left = points[insertIndex - 1];
    const right = points[insertIndex];
    const newX = (left.x + right.x) * 0.5;
    const newY = evaluateBipolarTransfer(side === "negative" ? -newX : newX, parameterValues);
    const splitPosition = (newX - left.x) / Math.max(0.001, right.x - left.x);
    const existingBend = rawShapePoint(parameterValues, side, insertIndex).bend;
    const leftBend = clamp(
      existingBend * splitPosition
        / Math.max(0.001, 1 + existingBend * (1 - splitPosition)),
      -1,
      1,
    );
    const rightBend = clamp(
      existingBend * (1 - splitPosition)
        / Math.max(0.001, 1 - existingBend * splitPosition),
      -1,
      1,
    );
    const changes = {};

    for (let targetIndex = count + 1; targetIndex > insertIndex; targetIndex -= 1) {
      const source = rawShapePoint(parameterValues, side, targetIndex - 1);
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
    const owner = morphOwner(parameterValues);
    if (owner.side === side && owner.index >= insertIndex)
      changes.morphPoint = owner.index + 1;
    changes[side === "negative" ? "curveNPointCount" : "curvePointCount"] = count + 1;
    selection = { kind: "point", side, index: insertIndex };
    sendTransaction(changes);
    renderShaper();
  }

  function deletePoint() {
    if (selection.kind !== "point") return;
    const side = selection.side;
    const count = shapePointCount(parameterValues, side);
    if (count <= 1) return;
    const deleteIndex = clamp(selection.index, 1, count);
    const changes = {};

    for (let targetIndex = deleteIndex; targetIndex < count; targetIndex += 1) {
      const source = rawShapePoint(parameterValues, side, targetIndex + 1);
      const targetIDs = shapePointEndpointIDs(side, targetIndex);
      changes[targetIDs.x] = source.x;
      changes[targetIDs.y] = source.y;
      changes[targetIDs.bend] = source.bend;
    }

    const owner = morphOwner(parameterValues);
    if (owner.side === side) {
      if (owner.index > deleteIndex) {
        changes.morphPoint = owner.index - 1;
      } else if (owner.index === deleteIndex) {
        const replacementIndex = Math.min(deleteIndex, count - 1);
        const replacement = deleteIndex < count
          ? rawShapePoint(parameterValues, side, deleteIndex + 1)
          : rawShapePoint(parameterValues, side, deleteIndex - 1);
        changes.morphPoint = replacementIndex;
        changes.morphTargetX = replacement.x;
        changes.morphTargetY = replacement.y;
      }
    }
    changes[side === "negative" ? "curveNPointCount" : "curvePointCount"] = count - 1;
    selection = { kind: "point", side, index: Math.min(deleteIndex, count - 1) };
    sendTransaction(changes);
    renderShaper();
  }

  function assignSelectedPointToMorph() {
    if (selection.kind !== "point") return;
    const point = rawShapePoint(parameterValues, selection.side, selection.index);
    sendTransaction({
      morphSide: selection.side === "negative" ? -1 : 1,
      morphPoint: selection.index,
      morphTargetX: point.x,
      morphTargetY: point.y,
    });
    renderShaper();
  }

  function commitExactField(field) {
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
      sendTransaction({
        [selection.kind === "morph" ? "morphTargetX" : endpointIDs.x]: Math.abs(signed),
      });
    } else if (field.dataset.shapeExactField === "output") {
      sendTransaction({
        [selection.kind === "morph" ? "morphTargetY" : endpointIDs.y]: clamp(value, -1.5, 1.5),
      });
    } else {
      sendTransaction({ [endpointIDs.bend]: clamp(value, -1, 1) });
    }
    renderShaper();
  }

  function onExactFieldChange(event) {
    commitExactField(event.currentTarget);
  }

  function onExactFieldKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitExactField(event.currentTarget);
    event.currentTarget.select();
  }

  function onPointerUp() {
    if (activeGesture) finishGesture(false);
  }

  function onPointerCancel() {
    if (activeGesture) finishGesture(true);
  }

  function onKeyDown(event) {
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

  function pushTelemetry(frame = {}) {
    const compressorInput = Number(frame.compressorInputDb);
    const compressorOutput = Number(frame.compressorOutputDb);
    if (Number.isFinite(compressorInput) && Number.isFinite(compressorOutput)) {
      compressorOperatingPoint.setAttribute("cx", mapX(clamp(compressorInput, -48, 12), COMPRESSOR_AXIS));
      compressorOperatingPoint.setAttribute("cy", mapY(clamp(compressorOutput, -48, 12), COMPRESSOR_AXIS));
      compressorOperatingPoint.dataset.active = "true";
    }

    const shapeInput = Number(frame.clipInput);
    const shapeOutput = Number(frame.clipOutput);
    if (Number.isFinite(shapeInput) && Number.isFinite(shapeOutput)) {
      shaperOperatingPoint.setAttribute("cx", mapX(clamp(shapeInput, -1.5, 1.5), SHAPER_AXIS));
      shaperOperatingPoint.setAttribute("cy", mapY(clamp(shapeOutput, -1.5, 1.5), SHAPER_AXIS));
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
