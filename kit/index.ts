// Builder Kit public entry. A new plugin starts from:
//
//     import { definePluginState, parameter, presets, snapshots } from "../../kit/index";        // state.ts
//     import { createStatefulPatchView, usePluginState, usePluginHistory, Knob } from "../../../kit/index"; // view
//
// Every name exported here follows kit/docs/COMPATIBILITY.md.
// Deep paths under kit/ui are internal and may move or change in any kit release.

// State and history
export { definePluginState, parameter, storedValue, preparedState, eventValue, preparationFailure } from "./ui/plugin-state-definition";
export type { PluginStateFields, PluginStateCodec, PluginStateJson, PluginStateValueResult, PluginStateLifetime, PluginStateOptions,
    PluginStatePrepareContext, PluginStateSharedPlan, PluginStatePreparationFailure } from "./ui/plugin-state-definition";
// For custom delivery seams; see PLUGIN_STATE.md.
export type { PluginStateDelivery, PluginStateDeliveryContext, PluginStateDocumentContext, PluginStateEffect, PluginStateSubmission,
    PluginStateDeliveryOutcome } from "./ui/plugin-state-definition";
export { sharedData } from "./ui/shared-data-delivery";
export { nativeValue } from "./ui/native-value";
export * as Native from "./ui/native-value-codecs";
export { usePluginState, usePluginHistory } from "./ui/plugin-state-react";
export type { PluginStateControl, PluginStateControlState, PluginStateControlError, PluginStateChanges, PluginStateEditor,
    PluginStateEditResult, PluginStateRejectionReason, PluginStateHistory, PluginStateHistoryEntry } from "./ui/plugin-state-react";
export { createStatefulPatchView } from "./ui/plugin-state-view";
export { UndoHistory } from "./ui/undo-history";

// Presets and snapshots: declared as state, recalled as one Undo entry.
export { presets } from "./ui/presets";
export type { Preset, PresetLibrary, FactoryPreset, PresetFile, PresetActionResult, SoundValues } from "./ui/presets";
export { usePresets } from "./ui/use-presets";
export type { Presets, PresetSummary } from "./ui/use-presets";
export { snapshots } from "./ui/snapshots";
export type { SnapshotSlots } from "./ui/snapshots";
export { useSnapshots } from "./ui/use-snapshots";
export type { Snapshots } from "./ui/use-snapshots";
export { PresetBar } from "./ui/preset-bar";
export type { PresetBarProps } from "./ui/preset-bar";
export { SnapshotBar } from "./ui/snapshot-bar";
export type { SnapshotBarProps } from "./ui/snapshot-bar";

// Controls
export { Knob, KnobRoot, KnobControl, KnobDial, KnobLabel, KnobValue, KnobInput, KnobRange, KnobMarker, useKnob } from "./ui/knob";
export type { KnobRootProps, KnobValueOptions, KnobControlProps, KnobDrag, KnobParseResult } from "./ui/knob";
export type { ValueScale } from "./ui/value-scale";
export type { LiveValue, LiveNumber } from "./ui/live-value";
export { Slider } from "./ui/slider";
export type { SliderProps, SliderModulation } from "./ui/slider";
export * as Mseg from "./ui/mseg-module";
export { FilterEditor, DEFAULT_FILTER_Q_SCALE } from "./ui/filter-editor";
export type { FilterEditorProps, FilterValue, FilterMode, FilterModeOption, FilterRange, FilterQScale, FilterEditTarget,
    FilterModulation, FilterModulationEndpoints } from "./ui/filter-editor";
export type { FilterSpectrumFrame, FilterSpectrumRenderMode } from "./ui/filter-spectrum";
export { formatFrequencyDisplay, normalizeEntryText, parseNumericAndUnit, unitIs, parameterEntrySpecForFrequency,
    parameterEntrySpecForScalar, parameterEntrySpecForSeconds, parameterEntrySpecForMilliseconds } from "./ui/parameter-value-entry";
export type { ParameterEntrySpec } from "./ui/parameter-value-entry";

// Patch connection. Writes through usePatchParameter go straight to the host and are not Undo entries.
export { usePatchConnection, usePatchParameter } from "./ui/cmajor-react";
export type { PatchConnectionLike, PatchParameter } from "./ui/cmajor-react";

// Browser preview: the parameter list a view exports as `browserPreviewParameters`.
export type { BrowserPreviewParameter } from "./ui/preview/connection";
