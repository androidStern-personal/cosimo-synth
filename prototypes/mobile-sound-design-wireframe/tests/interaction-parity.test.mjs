import assert from "node:assert/strict";
import test, { after } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });

class TestPointerEvent extends dom.window.MouseEvent {
  constructor(type, init = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    Object.defineProperties(this, {
      pointerId: { value: init.pointerId ?? 1 },
      pointerType: { value: init.pointerType ?? "touch" },
    });
  }
}

globalThis.PointerEvent = TestPointerEvent;
dom.window.PointerEvent = TestPointerEvent;
dom.window.HTMLCanvasElement.prototype.getContext = function getContext() {
  const canvas = this;
  return new Proxy({}, {
    get(target, property) {
      if (property === "canvas") return canvas;
      if (property === "measureText") return () => ({ width: 0 });
      if (!(property in target)) target[property] = () => {};
      return target[property];
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
};

const capturedPointers = new WeakMap();
dom.window.HTMLElement.prototype.setPointerCapture = function setPointerCapture(pointerId) {
  const ids = capturedPointers.get(this) || new Set();
  ids.add(pointerId);
  capturedPointers.set(this, ids);
};
dom.window.HTMLElement.prototype.releasePointerCapture = function releasePointerCapture(pointerId) {
  capturedPointers.get(this)?.delete(pointerId);
};
dom.window.HTMLElement.prototype.hasPointerCapture = function hasPointerCapture(pointerId) {
  return capturedPointers.get(this)?.has(pointerId) || false;
};
dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { bottom: 50, height: 50, left: 0, right: 100, top: 0, width: 100, x: 0, y: 0 };
};
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { createServer } = await import("vite");
const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
after(async () => vite.close());
const { ParameterControl } = await vite.ssrLoadModule("/src/features/module-editor/ParameterControl.jsx");
const { MappingChip } = await vite.ssrLoadModule("/src/features/modulation/MappingChip.jsx");
const { ModulationInspector } = await vite.ssrLoadModule("/src/features/modulation/ModulationInspector.jsx");
const { SourceTargetRow } = await vite.ssrLoadModule("/src/features/sources/SourceTargetList.jsx");
const { SourceShelf } = await vite.ssrLoadModule("/src/features/sources/SourceShelf.jsx");
const { ModuleGraphicSurface } = await vite.ssrLoadModule("/src/features/module-editor/graphics/ModuleGraphicSurface.jsx");
const { EffectRack } = await vite.ssrLoadModule("/src/features/rack/EffectRack.jsx");
const { AuditionTransport } = await vite.ssrLoadModule("/src/features/audition/AuditionTransport.jsx");
const { useMobileSynthController } = await vite.ssrLoadModule("/src/controllers/useMobileSynthController.js");
const { useMockCosimoAdapter } = await vite.ssrLoadModule("/src/adapters/useMockCosimoAdapter.js");
const {
  calculateDragValue,
  resolveDragAxis,
} = await import("../src/interactions/useAxisDrag.js");

function render(element) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return {
    host,
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function pointer(node, type, x, y, pointerId = 1) {
  act(() => {
    node.dispatchEvent(new TestPointerEvent(type, {
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
      pointerId,
    }));
  });
}

function click(node) {
  act(() => node.dispatchEvent(new dom.window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  })));
}

function makeControl(overrides = {}) {
  const source = { id: "mseg-1", label: "MSEG 1", slot: 1, type: "mseg" };
  return {
    activeMapping: { amount: 25, id: "phaser.depth::mseg-1", source, sourceId: source.id },
    activeSource: source,
    activeSourceColor: "#d85b36",
    articulationColor: "#d2a128",
    articulationOverride: null,
    defaultValue: 50,
    formatValue: (value) => `${Math.round(value)}%`,
    label: "Depth",
    patchBaseValue: 40,
    targetId: "phaser.depth",
    value: 50,
    ...overrides,
  };
}

function renderController(initialSession = {}) {
  let latest = null;
  function Harness() {
    const adapter = useMockCosimoAdapter();
    latest = useMobileSynthController(adapter, initialSession);
    return null;
  }
  const view = render(React.createElement(Harness));
  return {
    ...view,
    current: () => latest,
    run(callback) {
      act(() => callback(latest));
    },
  };
}

test("axis resolver locks only after threshold and value math preserves direction", () => {
  assert.equal(resolveDragAxis(4, 4, 5), null);
  assert.equal(resolveDragAxis(8, 3, 5), "x");
  assert.equal(resolveDragAxis(3, -8, 5), "y");
  assert.equal(calculateDragValue({
    startValue: 50,
    delta: 25,
    extent: 100,
    minimum: 0,
    maximum: 100,
  }), 75);
  assert.equal(calculateDragValue({
    startValue: 0,
    delta: -25,
    extent: 50,
    minimum: -100,
    maximum: 100,
    inverted: true,
  }), 100);
});

test("parameter tile preserves tap, X-base, Y-mapping, haptic, HUD, and click suppression", () => {
  const baseValues = [];
  const amounts = [];
  const readouts = [];
  const haptics = [];
  let selections = 0;
  const view = render(React.createElement(ParameterControl, {
    control: makeControl(),
    isSelected: true,
    onChangeBase: (value) => baseValues.push(value),
    onChangeMappingAmount: (_id, value) => amounts.push(value),
    onHaptic: (kind) => haptics.push(kind),
    onSelect: () => { selections += 1; },
    onShowReadout: (value) => readouts.push(value),
    ordinal: 2,
  }));
  const tile = view.host.querySelector("button.parameter-control");

  pointer(tile, "pointerdown", 10, 20);
  pointer(tile, "pointermove", 70, 22);
  pointer(tile, "pointerup", 70, 22);
  click(tile);

  assert.equal(selections, 1, "drag must not also execute the synthetic tap");
  assert.equal(baseValues.at(-1), 100);
  assert.equal(amounts.length, 0);
  assert.deepEqual(haptics, ["light"]);
  assert.match(readouts.at(-1), /Depth\s+100%/);

  pointer(tile, "pointerdown", 50, 40, 2);
  pointer(tile, "pointermove", 52, 10, 2);
  pointer(tile, "pointerup", 52, 10, 2);
  assert.equal(amounts.at(-1), 100);
  assert.match(readouts.at(-1), /MSEG 1 → Depth\s+\+100%/);
  view.unmount();
});

test("unmapped parameter Y gesture explains the missing relationship and suppresses tap", () => {
  const readouts = [];
  let selections = 0;
  const view = render(React.createElement(ParameterControl, {
    control: makeControl({ activeMapping: null, activeSource: null }),
    onChangeBase: () => {},
    onChangeMappingAmount: () => {},
    onSelect: () => { selections += 1; },
    onShowReadout: (value) => readouts.push(value),
    ordinal: 2,
  }));
  const tile = view.host.querySelector("button.parameter-control");
  pointer(tile, "pointerdown", 50, 40);
  pointer(tile, "pointermove", 50, 5);
  pointer(tile, "pointerup", 50, 5);
  click(tile);
  assert.equal(selections, 1);
  assert.match(readouts.at(-1), /choose a source mapping below/i);
  view.unmount();
});

test("parameter keyboard nudges and articulation patch-base marker survive refactor", () => {
  const bases = [];
  const control = makeControl({
    articulationOverride: { articulationId: "Pluck", value: 60 },
    patchBaseValue: 42,
    value: 60,
  });
  const view = render(React.createElement(ParameterControl, {
    control,
    onChangeBase: (value) => bases.push(value),
    onChangeMappingAmount: () => {},
    onSelect: () => {},
    onShowReadout: () => {},
    ordinal: 2,
  }));
  const tile = view.host.querySelector("button.parameter-control");
  act(() => tile.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "ArrowRight",
  })));
  assert.equal(bases.at(-1), 61);
  assert.equal(view.host.querySelector(".parameter-control__patch-base").style.insetInlineStart, "42%");
  view.unmount();
});

test("mapping chip vertical drag activates that relationship and never falls through to click", () => {
  const amounts = [];
  const haptics = [];
  let selections = 0;
  const source = { id: "mseg-1", label: "MSEG 1", slot: 1, type: "mseg" };
  const mapping = { amount: 20, id: "phaser.frequency::mseg-1", sourceId: source.id };
  const view = render(React.createElement(MappingChip, {
    color: "#d85b36",
    isSelected: false,
    mapping,
    onAmountChange: (_id, value) => amounts.push(value),
    onHaptic: (kind) => haptics.push(kind),
    onSelect: () => { selections += 1; },
    onShowReadout: () => {},
    source,
    targetLabel: "Frequency",
  }));
  const chip = view.host.querySelector("button.mapping-chip");
  pointer(chip, "pointerdown", 30, 40);
  pointer(chip, "pointermove", 31, 5);
  pointer(chip, "pointerup", 31, 5);
  click(chip);
  assert.equal(selections, 1);
  assert.equal(amounts.at(-1), 100);
  assert.deepEqual(haptics, ["light"]);
  view.unmount();
});

test("mapping selection swaps one permanently mounted detail surface", () => {
  const sources = {
    "macro-1": { color: "#9d5ca8", id: "macro-1", label: "Macro 1", slot: 1, type: "macro" },
    "mseg-1": { color: "#d85b36", id: "mseg-1", label: "MSEG 1", slot: 1, type: "mseg" },
  };
  const mappings = [
    { amount: 22, id: "phaser.depth::macro-1", needsReducer: false, polarity: "Unipolar", reducer: "Max", sourceId: "macro-1" },
    { amount: 40, id: "phaser.depth::mseg-1", needsReducer: true, polarity: "Bipolar", reducer: "Mean", sourceId: "mseg-1" },
  ];
  function Harness() {
    const [activeId, setActiveId] = React.useState(mappings[0].id);
    return React.createElement(ModulationInspector, {
      activeMappingId: activeId,
      availableSources: [],
      mappings,
      onAddMapping: () => {},
      onChangeAmount: () => {},
      onClearArticulationOverride: () => {},
      onOpenSource: () => {},
      onRemoveMapping: () => {},
      onSelectMapping: setActiveId,
      onSetPolarity: () => {},
      onSetReducer: () => {},
      onShowReadout: () => {},
      sourceLookup: sources,
      target: { label: "Depth" },
    });
  }
  const view = render(React.createElement(Harness));
  assert.equal(view.host.querySelectorAll(".mapping-detail").length, 1);
  assert.match(view.host.querySelector(".mapping-detail").textContent, /Macro 1/);
  click(view.host.querySelectorAll("button.mapping-chip")[1]);
  assert.equal(view.host.querySelectorAll(".mapping-detail").length, 1);
  assert.match(view.host.querySelector(".mapping-detail").textContent, /MSEG 1/);
  assert.equal(view.host.querySelectorAll(".mapping-focus-editor").length, 0);
  view.unmount();
});

test("source target row keeps X-base, Y-source amount, open-target, and drop identity separate", () => {
  const baseValues = [];
  const amounts = [];
  const opened = [];
  const cleared = [];
  const toggled = [];
  let selections = 0;
  const source = { id: "envelope-1", label: "Envelope 1", slot: 1, type: "envelope" };
  const row = {
    baseValue: 40,
    articulationColor: "#d2a128",
    articulationOverride: { articulationId: "Pluck", value: 40 },
    formatValue: (value) => `${Math.round(value)}%`,
    formattedBaseValue: "40%",
    mapping: { amount: 30, id: "wavetable.warp::envelope-1", polarity: "Bipolar", reducer: "Max" },
    needsReducer: false,
    patchBaseValue: 30,
    target: { defaultValue: 50, key: "wavetable.warp", label: "Warp", moduleLabel: "Wavetable" },
  };
  const view = render(React.createElement(SourceTargetRow, {
    onBaseValueChange: ({ value }) => baseValues.push(value),
    onMappingAmountChange: ({ amount }) => amounts.push(amount),
    onClearArticulationOverride: (targetId) => cleared.push(targetId),
    onOpenTarget: (intent) => opened.push(intent),
    onSelect: () => { selections += 1; },
    onToggle: (mappingId) => toggled.push(mappingId),
    onTransientValue: () => {},
    row,
    selected: true,
    semanticColor: "#2698bd",
    source,
  }));
  const target = view.host.querySelector("article.cosimo-source-target");
  assert.equal(target.dataset.modulationTarget, "wavetable.warp");
  const control = view.host.querySelector("button.cosimo-source-target__control");
  pointer(control, "pointerdown", 10, 20);
  pointer(control, "pointermove", 70, 22);
  pointer(control, "pointerup", 70, 22);
  assert.equal(baseValues.at(-1), 100);
  assert.equal(selections, 1, "drag pointer-down selects this relationship");
  pointer(control, "pointerdown", 40, 40, 2);
  pointer(control, "pointermove", 42, 5, 2);
  pointer(control, "pointerup", 42, 5, 2);
  assert.equal(amounts.at(-1), 100);
  assert.equal(view.host.querySelector(".cosimo-source-target__patch-base").style.insetInlineStart, "30%");
  assert.equal(view.host.querySelector(".cosimo-source-target__mapping-range").style.inlineSize, "15%");
  act(() => control.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "ArrowLeft",
  })));
  assert.equal(baseValues.at(-1), 39);
  click(view.host.querySelector("button.cosimo-source-target__control"));
  assert.equal(toggled.length, 0, "the click generated by the preceding drag stays suppressed");
  click(view.host.querySelector("button.cosimo-source-target__control"));
  assert.equal(toggled[0], "wavetable.warp::envelope-1");
  click(view.host.querySelector("button.cosimo-source-target__clear-override"));
  assert.equal(cleared[0], "wavetable.warp");
  click(view.host.querySelector("button.cosimo-source-target__open"));
  assert.equal(opened[0].targetId, "wavetable.warp");
  view.unmount();
});

test("source target tap remains expanded after pointer-down establishes drag ownership", () => {
  const source = { id: "envelope-1", label: "Envelope 1", slot: 1, type: "envelope" };
  const row = {
    baseValue: 40,
    articulationColor: "#d2a128",
    articulationOverride: { articulationId: "Pluck", value: 40 },
    formatValue: (value) => `${Math.round(value)}%`,
    formattedBaseValue: "40%",
    mapping: { amount: 30, id: "wavetable.warp::envelope-1", polarity: "Bipolar", reducer: "Max" },
    needsReducer: false,
    patchBaseValue: 30,
    target: { defaultValue: 50, key: "wavetable.warp", label: "Warp", moduleLabel: "Wavetable" },
  };
  function Harness() {
    const [selectedId, setSelectedId] = React.useState(null);
    return React.createElement(SourceTargetRow, {
      onSelect: setSelectedId,
      onToggle: (mappingId) => setSelectedId((current) => current === mappingId ? null : mappingId),
      onTransientValue: () => {},
      row,
      selected: selectedId === row.mapping.id,
      semanticColor: "#2698bd",
      source,
    });
  }
  const view = render(React.createElement(Harness));
  const control = view.host.querySelector("button.cosimo-source-target__control");
  pointer(control, "pointerdown", 20, 20);
  pointer(control, "pointerup", 20, 20);
  click(control);
  assert.equal(control.getAttribute("aria-pressed"), "true");
  assert.ok(view.host.querySelector(".cosimo-source-target__detail"));
  assert.ok(view.host.querySelector("button.cosimo-source-target__clear-override"));
  pointer(control, "pointerdown", 20, 20, 2);
  pointer(control, "pointerup", 20, 20, 2);
  click(control);
  assert.equal(control.getAttribute("aria-pressed"), "false");
  view.unmount();
});

test("parameter gesture never changes axis after lock and cancellation never falls through to tap", () => {
  const bases = [];
  const amounts = [];
  let selections = 0;
  const view = render(React.createElement(ParameterControl, {
    control: makeControl(),
    onChangeBase: (value) => bases.push(value),
    onChangeMappingAmount: (_id, value) => amounts.push(value),
    onSelect: () => { selections += 1; },
    onShowReadout: () => {},
    ordinal: 2,
  }));
  const tile = view.host.querySelector("button.parameter-control");
  pointer(tile, "pointerdown", 10, 25);
  pointer(tile, "pointermove", 45, 26);
  pointer(tile, "pointermove", 46, 0);
  pointer(tile, "pointercancel", 46, 0);
  click(tile);
  assert.ok(bases.length >= 2, "the locked X gesture remains a base edit");
  assert.equal(amounts.length, 0, "the gesture must never switch from X to Y");
  assert.equal(selections, 1, "pointer-down selects once; cancellation suppresses click");
  view.unmount();
});

test("module graphic locks to one declared axis and moves only that parameter", () => {
  const changes = [];
  const focuses = [];
  const haptics = [];
  const view = render(React.createElement(ModuleGraphicSurface, {
    ariaLabel: "Wavetable direct editor",
    moduleId: "wavetable",
    onAxesChange: (intent) => changes.push(intent),
    onGraphicFocus: (intent) => focuses.push(intent),
    onHaptic: (kind) => haptics.push(kind),
    values: { index: 35, warp: 40 },
  }));
  const surface = view.host.querySelector("[role=group]");
  pointer(surface, "pointerdown", 20, 25);
  pointer(surface, "pointermove", 75, 27);
  pointer(surface, "pointermove", 76, 2);
  pointer(surface, "pointerup", 76, 2);
  assert.deepEqual(haptics, ["light"]);
  assert.equal(focuses[0].parameterId, "warp");
  assert.ok(changes.length >= 2);
  assert.ok(changes.every((intent) => Object.keys(intent.changes)[0] === "warp"));
  view.unmount();
});

test("source long press opens management without also opening the source", async () => {
  let focusCount = 0;
  let deletedId = null;
  const source = { id: "envelope-1", label: "Envelope 1", slot: 1, type: "envelope" };
  const view = render(React.createElement(SourceShelf, {
    attachmentCounts: { "envelope-1": 2 },
    onDeleteSource: (sourceId) => { deletedId = sourceId; },
    onFocusSource: () => { focusCount += 1; },
    sources: [source],
  }));
  const chip = view.host.querySelector("button.cosimo-source-chip");
  pointer(chip, "pointerdown", 20, 20);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 540)));
  pointer(chip, "pointerup", 20, 20);
  click(chip);
  const menu = view.host.querySelector('[aria-label="Envelope 1 actions"]');
  assert.ok(menu, "long press must expose source actions");
  assert.match(menu.textContent, /Delete · 2 mappings/);
  assert.equal(focusCount, 0, "long press must not also open the source editor");
  click(menu.querySelector("button"));
  assert.equal(deletedId, "envelope-1");
  view.unmount();
});

test("source-to-target navigation preserves its shallow return trail and exact row context", () => {
  const controller = renderController();
  controller.run(({ actions }) => actions.focusModule("drive"));
  controller.run(({ actions }) => actions.openSource("envelope-1"));
  controller.run(({ actions }) => actions.selectSourceMapping("wavetable.warp::envelope-1"));
  controller.run(({ actions }) => actions.setSourceScrollTop(37));
  controller.run(({ actions }) => actions.openTargetFromSource(
    "wavetable.warp",
    "wavetable.warp::envelope-1",
    37,
  ));
  assert.equal(controller.current().state.focusedSource, null);
  assert.equal(controller.current().state.selectedTargetId, "wavetable.warp");
  assert.equal(controller.current().state.returnToSource.sourceId, "envelope-1");

  controller.run(({ actions }) => actions.chooseWorkspace("effects"));
  assert.equal(controller.current().state.returnToSource.sourceId, "envelope-1");
  controller.run(({ actions }) => actions.returnToSource());
  assert.equal(controller.current().state.focusedSource.id, "envelope-1");
  assert.equal(controller.current().state.sourceMappingId, "wavetable.warp::envelope-1");
  assert.equal(controller.current().state.sourceScrollTop, 37);
  controller.run(({ actions }) => actions.closeSource());
  assert.equal(controller.current().state.activeModuleId, "drive");
  controller.unmount();
});

test("source drop creates one mapping and a repeated drop focuses instead of duplicating", () => {
  const controller = renderController();
  const originalElementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => ({
    closest: () => ({ getAttribute: () => "phaser.feedback" }),
  });
  const drop = () => {
    controller.run(({ actions }) => actions.beginSourceDrag("envelope-1"));
    controller.run(({ actions }) => actions.moveSourceDrag(30, 30));
    controller.run(({ actions }) => actions.stopSourceDrag());
  };
  drop();
  let relations = controller.current().state.patch.mappings.filter(
    (mapping) => mapping.targetKey === "phaser.feedback" && mapping.sourceId === "envelope-1",
  );
  assert.equal(relations.length, 1);
  assert.equal(controller.current().state.selectedTargetId, "phaser.feedback");
  assert.equal(controller.current().state.activeMappingId, relations[0].id);
  drop();
  relations = controller.current().state.patch.mappings.filter(
    (mapping) => mapping.targetKey === "phaser.feedback" && mapping.sourceId === "envelope-1",
  );
  assert.equal(relations.length, 1, "duplicate drops must not duplicate relationships");
  assert.equal(controller.current().state.activeMappingId, relations[0].id);
  document.elementFromPoint = originalElementFromPoint;
  controller.unmount();
});

test("delete and Undo restore the source, mappings, focus, selected row, and scroll", () => {
  const controller = renderController();
  controller.run(({ actions }) => actions.openSource("envelope-1"));
  controller.run(({ actions }) => actions.selectSourceMapping("wavetable.warp::envelope-1"));
  controller.run(({ actions }) => actions.setSourceScrollTop(29));
  controller.run(({ actions }) => actions.deleteSource("envelope-1"));
  assert.equal(controller.current().state.sourceLookup["envelope-1"], undefined);
  assert.ok(controller.current().state.deletedSource);
  controller.run(({ actions }) => actions.undoDelete());
  assert.equal(controller.current().state.focusedSource.id, "envelope-1");
  assert.equal(controller.current().state.sourceMappingId, "wavetable.warp::envelope-1");
  assert.equal(controller.current().state.sourceScrollTop, 29);
  assert.ok(controller.current().state.patch.mappings.some(
    (mapping) => mapping.id === "wavetable.warp::envelope-1",
  ));
  controller.unmount();
});

test("capture remains owned by the parameter moved during Trigger, not later selection", () => {
  const controller = renderController();
  controller.run(({ actions }) => actions.startTrigger());
  controller.run(({ actions }) => actions.setParameter("phaser.depth", 73));
  controller.run(({ actions }) => actions.endTrigger());
  assert.equal(controller.current().state.audition.captureCandidate.targetKey, "phaser.depth");
  controller.run(({ actions }) => actions.selectTarget("phaser.feedback"));
  assert.equal(controller.current().state.selectedTargetId, "phaser.feedback");
  controller.run(({ actions }) => actions.captureMotion());
  const captured = controller.current().state.patch.sources.find(
    (source) => source.type === "mseg" && source.id !== "mseg-1",
  );
  assert.ok(captured);
  assert.equal(captured.capturedMotion.targetKey, "phaser.depth");
  assert.ok(controller.current().state.patch.mappings.some(
    (mapping) => mapping.targetKey === "phaser.depth" && mapping.sourceId === captured.id,
  ));
  assert.equal(controller.current().state.focusedSource.id, captured.id);
  assert.equal(controller.current().state.sourceMappingId, `phaser.depth::${captured.id}`);
  controller.run(({ actions }) => actions.closeSource());
  assert.equal(controller.current().state.selectedTargetId, "phaser.depth");
  controller.unmount();
});

test("rack reorder pointer-cancel restores the pre-gesture order", () => {
  const reorders = [];
  const restores = [];
  const items = ["filter", "drive", "phaser"].map((id, index) => ({
    enabled: true,
    id,
    isSelected: index === 0,
    label: id[0].toUpperCase() + id.slice(1),
    quick: {
      defaultValue: 0,
      format: (value) => `${value}%`,
      formattedValue: "50%",
      label: "Amount",
      targetId: `${id}.amount`,
      value: 50,
    },
  }));
  const originalElementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => ({
    closest: () => ({ getAttribute: () => "drive" }),
  });
  const view = render(React.createElement(EffectRack, {
    items,
    onEffectEnabledChange: () => {},
    onEffectFocus: () => {},
    onQuickChange: () => {},
    onReadout: () => {},
    onReorder: (...args) => reorders.push(args),
    onRestoreOrder: (order) => restores.push(order),
  }));
  const handle = view.host.querySelector('[aria-label="Reorder Filter"]');
  pointer(handle, "pointerdown", 10, 10);
  pointer(handle, "pointermove", 35, 10);
  pointer(handle, "pointercancel", 35, 10);
  assert.deepEqual(reorders, [["filter", "drive"]]);
  assert.deepEqual(restores, [["filter", "drive", "phaser"]]);
  document.elementFromPoint = originalElementFromPoint;
  view.unmount();
});

test("trigger pointer-leave is only a lost-capture fallback", () => {
  let starts = 0;
  let ends = 0;
  const view = render(React.createElement(AuditionTransport, {
    articulationId: "Default",
    articulations: [{ color: "#777", id: "Default", label: "Default" }],
    canCapture: false,
    latch: false,
    note: "C3",
    onArticulationChange: () => {},
    onCapture: () => {},
    onLatchChange: () => {},
    onNoteChange: () => {},
    onRepeatChange: () => {},
    onTriggerCancel: () => {},
    onTriggerEnd: () => { ends += 1; },
    onTriggerFallback: () => {},
    onTriggerStart: () => { starts += 1; },
    repeat: false,
    status: "Waiting for note",
    triggerActive: true,
  }));
  const trigger = view.host.querySelector("button.cosimo-audition__trigger");
  pointer(trigger, "pointerdown", 10, 10);
  pointer(trigger, "pointerleave", 60, 10);
  assert.equal(starts, 1);
  assert.equal(ends, 0, "leaving while pointer capture is valid must keep the note held");
  pointer(trigger, "pointerup", 60, 10);
  assert.equal(ends, 1);
  view.unmount();
});

test("fallback Trigger timer cannot terminate a newer held note", async () => {
  const controller = renderController();
  controller.run(({ actions }) => actions.fallbackTrigger());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 40)));
  controller.run(({ actions }) => actions.startTrigger());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 190)));
  assert.equal(controller.current().state.audition.triggerActive, true);
  controller.run(({ actions }) => actions.cancelTrigger());
  controller.unmount();
});

test("target-side Add Source includes Velocity, Pressure, and Slide", () => {
  const controller = renderController();
  controller.run(({ actions }) => actions.selectTarget("phaser.feedback"));
  const available = new Set(controller.current().state.availableSources.map((source) => source.id));
  assert.equal(available.has("velocity"), true);
  assert.equal(available.has("pressure"), true);
  assert.equal(available.has("slide"), true);
  controller.unmount();
});
