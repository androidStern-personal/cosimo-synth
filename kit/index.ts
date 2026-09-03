// Builder Kit public entry.
//
// Plugin code imports the kit from this module only:
//
//     import { createPresetBar, usePatchParameter } from "../../kit/index";
//
// Everything re-exported here is the supported surface of the kit and is kept
// stable across kit releases (see kit/kit.json for the kit version).
// Deep paths such as `kit/ui/effects/preset-bar` are implementation layout
// and are unsupported: any kit update may move or rename them without notice.

// Effect core: presets, snapshots, chrome, state contract, runtime mirror,
// worker services.
export * from "./ui/effects/standalone-effect-presets";
export * from "./ui/effects/preset-bar";
export * from "./ui/effects/snapshot-bar";
export * from "./ui/effects/effect-header";
export * from "./ui/effects/effect-preset-shared";
export * from "./ui/effects/effect-preset-v2";
export * from "./ui/effects/effect-snapshots";
export * from "./ui/effects/effect-snapshot-bank";
export * from "./ui/effects/effect-state-contract";
export * from "./ui/stored-state-runtime-mirror";
export * from "./ui/patch-worker-services";

// Primitives: React bindings for the patch connection, editor tokens and
// surfaces, range/curve editors, parameter text entry, the spectrum display.
export * from "./ui/cmajor-react";
export * from "./ui/editor-tokens";
export * from "./ui/editor-tick-slider";
export * from "./ui/editor-curve-surface";
export * from "./ui/editor-curve-geometry";
export * from "./ui/filter-range-editor";
export * from "./ui/parameter-value-entry";
export * from "./ui/enhancer-spectrum";
