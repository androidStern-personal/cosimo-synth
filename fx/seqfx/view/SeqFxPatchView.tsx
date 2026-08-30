import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent } from "react";

import type { PatchConnectionLike } from "../../../ui/shared/cmajor-react";
import { createEffectHeader } from "../../../ui/shared/effects/effect-header";
import { EffectSnapshotBankController } from "../../../ui/shared/effects/effect-snapshot-bank";
import { createStandaloneEffectPresetController } from "../../../ui/shared/effects/standalone-effect-presets";
import {
    FilterRangeEditor,
    type FilterRangeEndpoints,
    type FilterRangeMode,
    type FilterRangeModeOption,
    type FilterRangeValue,
    cutoffRangeOctaves,
    cutoffsFromCenterRangeOctaves,
    geometricCenterCutoffHz,
} from "../../../ui/shared/filter-range-editor";
import { ModBadge, type ModulationDirection } from "../../../ui/shared/editor-tick-slider";
import {
    EDITOR_PLOT_BOTTOM_PADDING_PX,
    EDITOR_PLOT_TOP_PADDING_PX,
    EDITOR_RANGE_HANDLE_RADIUS_PX,
    useEditorSurfaceSize,
} from "../../../ui/shared/editor-tokens";
import {
    adaptiveSampleEditorCurve,
    createEditorCurvePlotRect,
    editorCurveFillPathToBaseline,
    normalizedCurvePointToPlotPoint,
    polylineToSvgPath,
    type EditorCurvePlotRect,
} from "../../../ui/shared/editor-curve-geometry";
import {
    EditorCurveAxis,
    EditorCurveFill,
    EditorCurveHandle,
    EditorCurvePath,
    EditorCurvePlotArea,
    EditorCurveSurface,
} from "../../../ui/shared/editor-curve-surface";
import { AuxSource, auxSourceMonitorPoint, buildAuxSourcePreviewPath } from "./AuxSource";
import { CrusherEditor, type CrusherModulation } from "./CrusherEditor";
import { StutterEnvelopeEditor, type StutterModulation } from "./StutterEnvelopeEditor";
import {
    SEQFX_EFFECT_TYPES,
    SEQFX_EFFECT_TYPE_NAMES,
    SEQFX_EFFECT_TYPE_SHORT_NAMES,
    SEQFX_LANE_NAMES,
    SEQFX_PATTERN_COUNT,
    SEQFX_STEP_COUNT,
    getSeqFxEffectDefinition,
    getSeqFxBlockAtStep,
    getSeqFxLaneBlocks,
    isSeqFxTriggerLatchedParamForEffect,
    type SeqFxAuxSource,
    type SeqFxAuxState,
    type SeqFxBlock,
    type SeqFxEffectType,
    type SeqFxPattern,
    type SeqFxStep,
    type SeqFxStepValueSnapshot,
    type SeqFxState,
} from "./seqfx-state";
import { formatStutterShapeLabel } from "./stutter-envelope";
import {
    TALK_BOX_VOWELS,
    formatTalkBoxVowelPair,
    resolveTalkBoxFormants,
} from "./talk-box-contract";
import {
    TAPE_STOP_MAX_CATCHUP_PERCENT,
    TAPE_STOP_MAX_CURVE,
    TAPE_STOP_MAX_STOP_POINT_PERCENT,
    TAPE_STOP_MIN_CATCHUP_PERCENT,
    TAPE_STOP_MIN_CURVE,
    TAPE_STOP_MIN_STOP_POINT_PERCENT,
    TAPE_STOP_MODE_SPIN_UP,
    TAPE_STOP_MODE_STOP,
    TAPE_STOP_SPEED_FLOOR,
    evaluateTapeStopDisplaySpeed,
    multiplierToStopPointPercent,
    resolveTapeStopEnvelope,
    stopPointPercentToMultiplier,
} from "./tape-stop-envelope";
import { createSeqFxPresetStateAdapter } from "./seqfx-preset-adapter";
import {
    createSeqFxPresetMigrations,
    createSeqFxSnapshotMigrations,
} from "./seqfx-preset-migrations";
import { SEQFX_ENDPOINTS, SeqFxRuntimeBridge } from "./seqfx-runtime-bridge";

type SelectedCell = {
    lane: number;
    step: number;
};

type Selection = {
    lane: number;
    steps: number[];
    blockStartSteps?: number[];
};

type InspectorMode = "effect" | "mod";

type ResizeGesture = {
    mode: "resize";
    lane: number;
    startStep: number;
    length: number;
    previewLength: number | null;
};

type MoveGesture = {
    mode: "move";
    lane: number;
    sourceStartStep: number;
    length: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    previewTargetLane: number | null;
    previewTargetStartStep: number | null;
};

type BlockSelectionMoveGesture = {
    mode: "selectionMove";
    lane: number;
    blockStartSteps: number[];
    anchorStartStep: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    anchorMinStartStep: number;
    anchorMaxStartStep: number;
    previewTargetLane: number | null;
    previewTargetAnchorStartStep: number | null;
    previewMovedStartSteps: number[] | null;
};

type CopyGesture = {
    mode: "copy";
    lane: number;
    sourceStartStep: number;
    length: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    previewTargetLane: number | null;
    previewTargetStartStep: number | null;
};

type BlockSelectionCopyGesture = {
    mode: "selectionCopy";
    lane: number;
    blockStartSteps: number[];
    anchorStartStep: number;
    grabOffset: number;
    pointerStartX: number;
    pointerStartY: number;
    hasMoved: boolean;
    anchorMinStartStep: number;
    anchorMaxStartStep: number;
    previewTargetLane: number | null;
    previewTargetAnchorStartStep: number | null;
    previewCopiedStartSteps: number[] | null;
};

type BlockGesture = ResizeGesture | MoveGesture | BlockSelectionMoveGesture | CopyGesture | BlockSelectionCopyGesture;

type PatternPreview = {
    patternIndex: number;
    lane: number;
    copiedStartSteps?: number[];
    state: SeqFxState;
};

type AuxMonitorState = {
    cyclePhase: number[];
    amount: number[];
    durationMs: number[];
};

type AuxModulatedParam = {
    end: number;
    onEndChange: (value: number) => void;
    direction?: ModulationDirection;
};

type InvalidDropTarget = {
    patternIndex: number;
    lane: number;
    blocks: Array<{
        startStep: number;
        length: number;
    }>;
};

type ParamDefinition = {
    index: number;
    label: string;
    min: number;
    max: number;
    step: number;
    kind?: "select";
    amountKind?: ParamAmountKind;
    options?: string[];
    hint?: string;
};

type ParamAmountKind =
    | "cutoffOctaves"
    | "integer"
    | "linear"
    | "db"
    | "speed"
    | "percentPoints"
    | "percentValue"
    | "tapeStopPointPercent"
    | "stutterShape";

const EFFECT_OPTIONS = [
    SEQFX_EFFECT_TYPES.filter,
    SEQFX_EFFECT_TYPES.crusher,
    SEQFX_EFFECT_TYPES.tapeStop,
    SEQFX_EFFECT_TYPES.stutter,
    SEQFX_EFFECT_TYPES.comb,
    SEQFX_EFFECT_TYPES.ring,
    SEQFX_EFFECT_TYPES.talkBox,
    SEQFX_EFFECT_TYPES.vibro,
    SEQFX_EFFECT_TYPES.dirty,
] as const;

function defaultEffectTypeForChain(chain: number) {
    return EFFECT_OPTIONS[Math.min(EFFECT_OPTIONS.length - 1, Math.max(0, chain))] ?? SEQFX_EFFECT_TYPES.filter;
}

function SeqFxTitleSigil() {
    return (
        <svg
            aria-hidden="true"
            className="seqfx-title__sigil"
            data-role="seqfx-title-sigil"
            focusable="false"
            viewBox="0 0 24 24"
        >
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2">
                <path d="M3.5 18 L3.5 14" />
                <path d="M9 18 L9 9" />
                <path d="M14.5 18 L14.5 6" />
                <path d="M20 18 L20 11" />
            </g>
            <g fill="currentColor">
                <circle cx="3.5" cy="14" r="1.5" />
                <circle cx="9" cy="9" r="1.5" />
                <circle cx="14.5" cy="6" r="1.5" />
                <circle cx="20" cy="11" r="1.5" />
            </g>
        </svg>
    );
}

function SeqFxEmptyStateIcon() {
    return (
        <svg
            aria-hidden="true"
            className="seqfx-empty__icon"
            data-role="seqfx-empty-icon"
            focusable="false"
            viewBox="0 0 24 24"
        >
            <path
                d="M5 3.6 L5 18 L9.2 14.1 L11.7 19.4 L13.7 18.4 L11.2 13.2 L17 13 Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
        </svg>
    );
}

function SeqFxMixGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="seqfx-mix-row__glyph"
            data-role="seqfx-mix-glyph"
            focusable="false"
            viewBox="0 0 16 16"
        >
            <line
                x1="2.4"
                y1="8"
                x2="13.6"
                y2="8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.4"
            />
            <circle cx="10" cy="8" r="2.4" fill="currentColor" />
        </svg>
    );
}

function SeqFxDeleteGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="seqfx-delete-block__glyph"
            data-role="seqfx-delete-glyph"
            focusable="false"
            viewBox="0 0 12 12"
        >
            <path
                d="M3.2 3.2 L8.8 8.8 M8.8 3.2 L3.2 8.8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
        </svg>
    );
}

function effectIconTextureId(effectType: SeqFxEffectType, reactId: string) {
    return `seqfx-effect-icon-texture-${effectType}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function SeqFxEffectIconTexture({ id, viewBoxSize }: { id: string; viewBoxSize: number }) {
    const scale = viewBoxSize / 24;
    const tile = 2.5 * scale;
    const solidRadius = 1 * scale;
    const fadeRadius = 1.2 * scale;
    const dotId = `${id}-dot`;
    return (
        <defs>
            <radialGradient data-role="seqfx-effect-icon-texture-gradient" id={dotId}>
                <stop offset="0%" stopColor="#000" stopOpacity="0.10" />
                <stop offset={`${(solidRadius / fadeRadius) * 100}%`} stopColor="#000" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <pattern
                data-role="seqfx-effect-icon-texture"
                height={tile}
                id={id}
                patternUnits="userSpaceOnUse"
                width={tile}
            >
                <circle cx={tile / 2} cy={tile / 2} fill={`url(#${dotId})`} r={fadeRadius} />
            </pattern>
        </defs>
    );
}

const TAPE_STOP_ICON_PATH =
    "M3 5h18a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-3.5l-.55-2.45A1.4 1.4 0 0 0 15.59 15.5H8.41a1.4 1.4 0 0 0-1.36 1.05L6.5 19H3a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 3 5Zm5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z";
const TALK_BOX_ICON_PATH =
    "M55.618 178.111l75.645-94.377s.03-15.79 12.989-26.864c15.797-13.498 40.626-11.241 53.643 3.201 13.016 14.443 16.545 38.02-1.25 54.93-11.078 10.526-23.552 10.425-23.552 10.425l-94.71 75.646-9.344-9.14-17.266 16.088s-1.429 1.188-2.844-.578c-1.415-1.765-.71-3.282-.71-3.282l17.039-16.203-9.64-9.846zm17.729-1.144l5.687 5.484 75.162-59.15s-8.01-4.416-12.813-9.469c-4.804-5.053-7.58-11.981-7.58-11.981l-60.456 75.116zm75.827-105.668s-13.299 18.34 2.398 33.329c15.698 14.99 33.564 2.4 33.564 2.4s-16.071-3.727-24.79-12.39c-8.72-8.662-11.172-23.34-11.172-23.34zm5.393-4.513s3.702 14.109 12.601 23.073c8.899 8.965 22.874 12.662 22.874 12.662s12.885-19.52-3.271-34.318c-16.157-14.798-32.204-1.417-32.204-1.417z";
const DIRTY_ICON_PATH = "M232 64.5h-54l-111.5 112H26V193h50L187.5 81H232z";
const COMB_ICON_PATH =
    "M25.101 77.628a4.008 4.008 0 0 0 3.997 4.01h16.996c6.632 0 13.927 5.01 16.3 11.202l52.724 85.231c7.115 18.564 18.693 18.571 25.857.025L193.91 92.84c2.39-6.187 9.693-11.202 16.336-11.202h16.49a4.01 4.01 0 0 0 4-4.01V68.82a4 4 0 0 0-3.994-4.009h-23.508c-8.835 0-18.547 6.702-21.69 14.962l-47.147 73.852c-3.533 9.287-9.217 9.262-12.694-.051L75.2 79.805C72.108 71.524 62.44 64.81 53.6 64.81H29.11a4.012 4.012 0 0 0-4.008 4.01v8.808z";
const VIBRO_ICON_PATH =
    "M35.996 208c-2.207 0-3.077-1.532-1.935-3.434l91.878-153.132c1.138-1.896 2.98-1.902 4.122 0l91.878 153.132c1.138 1.896.272 3.434-1.935 3.434h-8.008c-2.207 0-4.922-1.54-6.054-3.421L130.058 78.42c-1.137-1.89-2.984-1.881-4.116 0L50.058 204.58c-1.138 1.889-3.848 3.42-6.054 3.42h-8.008z";

// Effect picker SVGs are local silhouettes matched to the riso cell palette.
function SeqFxEffectIcon({ effectType }: { effectType: SeqFxEffectType }) {
    const textureId = effectIconTextureId(effectType, useId());
    const textureFill = `url(#${textureId})`;

    switch (effectType) {
        case SEQFX_EFFECT_TYPES.filter:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="0 0 256 256">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={256} />
                    <path
                        data-role="seqfx-effect-icon-fill"
                        fill="currentColor"
                        fillRule="evenodd"
                        d="M24.22 67.796a3.995 3.995 0 0 1 4.008-3.991h85.498c8.834 0 19.732 6.112 24.345 13.657l53.76 87.936c3.46 5.66 11.628 10.247 18.256 10.247h16.718a3.996 3.996 0 0 1 3.994 4.007v8.985a4.007 4.007 0 0 1-4.007 4.008h-24.7c-8.835 0-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995 3.995 0 0 1-3.993-3.992V67.796z"
                    />
                    <path
                        fill={textureFill}
                        fillRule="evenodd"
                        d="M24.22 67.796a3.995 3.995 0 0 1 4.008-3.991h85.498c8.834 0 19.732 6.112 24.345 13.657l53.76 87.936c3.46 5.66 11.628 10.247 18.256 10.247h16.718a3.996 3.996 0 0 1 3.994 4.007v8.985a4.007 4.007 0 0 1-4.007 4.008h-24.7c-8.835 0-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995 3.995 0 0 1-3.993-3.992V67.796z"
                    />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.crusher:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="0 0 24 24">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={24} />
                    <path
                        d="M3 20 V12 H6 V5 H12 V20 H18 V12 H21 V16 H20 V22 H10 V7 H8 V14 H5 V22 H3 Z"
                        data-role="seqfx-effect-icon-fill"
                        fill="currentColor"
                    />
                    <path
                        d="M3 20 V12 H6 V5 H12 V20 H18 V12 H21 V16 H20 V22 H10 V7 H8 V14 H5 V22 H3 Z"
                        fill={textureFill}
                    />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.tapeStop:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="0 0 24 24">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={24} />
                    <path
                        data-role="seqfx-effect-icon-fill"
                        fill="currentColor"
                        fillRule="evenodd"
                        d={TAPE_STOP_ICON_PATH}
                    />
                    <path fill={textureFill} fillRule="evenodd" d={TAPE_STOP_ICON_PATH} />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.stutter:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="0 0 256 256">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={256} />
                    <g data-role="seqfx-effect-icon-fill" fill="currentColor" fillRule="evenodd">
                        <path d="M109.533 197.602a1.887 1.887 0 0 1-.034 2.76l-7.583 7.066a4.095 4.095 0 0 1-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581 4.11-1.658 5.74-.18l7.655 6.94c.82.743.833 1.952.02 2.708l-21.11 19.659s53.036.129 71.708.064c18.672-.064 33.437-16.973 33.437-34.7c0-7.214-5.578-17.64-5.578-17.64c-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794 1.772-.632 2.242.364c0 0 9.212 18.651 9.212 28.562c0 28.035-21.765 50.882-48.533 50.882s-70.921.201-70.921.201z" />
                        <path d="M144.398 58.435a1.887 1.887 0 0 1 .034-2.76l7.583-7.066a4.095 4.095 0 0 1 5.714.152l32.918 34.095c1.537 1.592 1.54 4.162.002 5.746l-33.1 34.092c-1.536 1.581-4.11 1.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437 16.973-33.437 34.7c0 7.214 5.578 17.64 5.578 17.64c.498.99.273 2.444-.483 3.229l-8.61 8.94c-.764.794-1.772.632-2.242-.364c0 0-9.212-18.65-9.212-28.562c0-28.035 21.765-50.882 48.533-50.882s70.921-.201 70.921-.201z" />
                    </g>
                    <g fill={textureFill} fillRule="evenodd">
                        <path d="M109.533 197.602a1.887 1.887 0 0 1-.034 2.76l-7.583 7.066a4.095 4.095 0 0 1-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581 4.11-1.658 5.74-.18l7.655 6.94c.82.743.833 1.952.02 2.708l-21.11 19.659s53.036.129 71.708.064c18.672-.064 33.437-16.973 33.437-34.7c0-7.214-5.578-17.64-5.578-17.64c-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794 1.772-.632 2.242.364c0 0 9.212 18.651 9.212 28.562c0 28.035-21.765 50.882-48.533 50.882s-70.921.201-70.921.201z" />
                        <path d="M144.398 58.435a1.887 1.887 0 0 1 .034-2.76l7.583-7.066a4.095 4.095 0 0 1 5.714.152l32.918 34.095c1.537 1.592 1.54 4.162.002 5.746l-33.1 34.092c-1.536 1.581-4.11 1.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437 16.973-33.437 34.7c0 7.214 5.578 17.64 5.578 17.64c.498.99.273 2.444-.483 3.229l-8.61 8.94c-.764.794-1.772.632-2.242-.364c0 0-9.212-18.65-9.212-28.562c0-28.035 21.765-50.882 48.533-50.882s70.921-.201 70.921-.201z" />
                    </g>
                </svg>
            );
        case SEQFX_EFFECT_TYPES.comb:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="18 18 220 220">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={220} />
                    <path
                        d={COMB_ICON_PATH}
                        data-role="seqfx-effect-icon-fill"
                        fill="currentColor"
                        fillRule="evenodd"
                    />
                    <path d={COMB_ICON_PATH} fill={textureFill} fillRule="evenodd" />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.ring:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="0 0 256 256">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={256} />
                    <path
                        d="M48 128c-1.955-29.248 19.364-64 37.364-64 18 0 36.136 13.843 36.136 64.5s19.136 80.5 49.136 80.5c30 0 53.364-40.125 53.364-80.5-8.182 0-7.273-.752-16 0 0 32.35-20.455 64.45-37.364 64.45s-33.909-13.542-33.909-64.45S120.273 48 85.364 48C50.454 48 32 88.626 32 127.748c6 0 8.364.252 16 .252z"
                        data-role="seqfx-effect-icon-fill"
                        fill="currentColor"
                        fillRule="evenodd"
                    />
                    <path
                        d="M48 128c-1.955-29.248 19.364-64 37.364-64 18 0 36.136 13.843 36.136 64.5s19.136 80.5 49.136 80.5c30 0 53.364-40.125 53.364-80.5-8.182 0-7.273-.752-16 0 0 32.35-20.455 64.45-37.364 64.45s-33.909-13.542-33.909-64.45S120.273 48 85.364 48C50.454 48 32 88.626 32 127.748c6 0 8.364.252 16 .252z"
                        fill={textureFill}
                        fillRule="evenodd"
                    />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.talkBox:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="0 0 256 256">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={256} />
                    <path
                        d={TALK_BOX_ICON_PATH}
                        data-role="seqfx-effect-icon-fill"
                        fill="currentColor"
                        fillRule="evenodd"
                    />
                    <path d={TALK_BOX_ICON_PATH} fill={textureFill} fillRule="evenodd" />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.vibro:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="0 0 256 256">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={256} />
                    <path
                        d={VIBRO_ICON_PATH}
                        data-role="seqfx-effect-icon-fill"
                        fill="currentColor"
                        fillRule="evenodd"
                    />
                    <path d={VIBRO_ICON_PATH} fill={textureFill} fillRule="evenodd" />
                </svg>
            );
        case SEQFX_EFFECT_TYPES.dirty:
            return (
                <svg aria-hidden="true" className="seqfx-effect-icon" focusable="false" viewBox="0 0 256 256">
                    <SeqFxEffectIconTexture id={textureId} viewBoxSize={256} />
                    <path
                        d={DIRTY_ICON_PATH}
                        data-role="seqfx-effect-icon-fill"
                        fill="currentColor"
                        fillRule="evenodd"
                    />
                    <path d={DIRTY_ICON_PATH} fill={textureFill} fillRule="evenodd" />
                </svg>
            );
        default:
            return null;
    }
}

function SeqFxMixRow({
    value,
    onChange,
}: {
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="seqfx-mix-row" data-role="seqfx-mix-row">
            <span className="seqfx-mix-row__label">
                <SeqFxMixGlyph />
                Block mix
            </span>
            <input
                aria-label="Block mix"
                data-role="seqfx-mix"
                max={1}
                min={0}
                onChange={(event) => onChange(Number(event.currentTarget.value))}
                step={0.01}
                type="range"
                value={value}
            />
            <output>{formatValue(value)}</output>
        </label>
    );
}

function enabledAuxTargetCount(aux: SeqFxAuxState) {
    return aux.targets.reduce((count, target) => count + (target.enabled ? 1 : 0), 0);
}

function modulationDirectionForValues(start: number, end: number): ModulationDirection {
    if (end > start) {
        return "up";
    }

    if (end < start) {
        return "down";
    }

    return "both";
}

function formatFilterHzChip(value: number) {
    const cutoff = clampNumber(value, 20, 20_000);
    const roundedCutoff = Math.round(cutoff);
    if (roundedCutoff >= 10_000) {
        return `${(roundedCutoff / 1000).toFixed(1)}k`;
    }

    if (roundedCutoff >= 1000) {
        return `${(roundedCutoff / 1000).toFixed(2)}k`;
    }

    return String(roundedCutoff);
}

function formatSignedFixed(value: number, decimals: number) {
    const zeroThreshold = 1 / (10 ** (decimals + 1));
    if (Math.abs(value) < zeroThreshold) {
        return Number(0).toFixed(decimals);
    }

    return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

function quantizeToStep(value: number, min: number, step: number) {
    if (!Number.isFinite(step) || step <= 0) {
        return value;
    }

    return min + (Math.round((value - min) / step) * step);
}

function modDisplayValue(definition: ParamDefinition, rawValue: number) {
    if (definition.amountKind === "tapeStopPointPercent") {
        return multiplierToStopPointPercent(rawValue);
    }

    if (definition.amountKind === "percentPoints") {
        return rawValue * 100;
    }

    return rawValue;
}

function rawValueFromModDisplay(definition: ParamDefinition, displayValue: number) {
    if (definition.amountKind === "tapeStopPointPercent") {
        return stopPointPercentToMultiplier(displayValue);
    }

    if (definition.amountKind === "percentPoints") {
        return displayValue / 100;
    }

    return displayValue;
}

function modDisplayBounds(definition: ParamDefinition) {
    if (definition.amountKind === "tapeStopPointPercent") {
        return {
            min: TAPE_STOP_MIN_STOP_POINT_PERCENT,
            max: TAPE_STOP_MAX_STOP_POINT_PERCENT,
        };
    }

    if (definition.amountKind === "percentPoints") {
        return {
            min: definition.min * 100,
            max: definition.max * 100,
        };
    }

    return {
        min: definition.min,
        max: definition.max,
    };
}

function modAmountBounds(definition: ParamDefinition, baseValue: number) {
    if (definition.amountKind === "cutoffOctaves") {
        const safeBase = clampNumber(baseValue, definition.min, definition.max);
        return {
            min: Math.log2(definition.min / safeBase),
            max: Math.log2(definition.max / safeBase),
        };
    }

    const baseDisplayValue = modDisplayValue(definition, baseValue);
    const bounds = modDisplayBounds(definition);
    return {
        min: bounds.min - baseDisplayValue,
        max: bounds.max - baseDisplayValue,
    };
}

function modAmountFromTarget(definition: ParamDefinition, baseValue: number, targetValue: number) {
    if (definition.amountKind === "cutoffOctaves") {
        const safeBase = clampNumber(baseValue, definition.min, definition.max);
        const safeTarget = clampNumber(targetValue, definition.min, definition.max);
        return Math.log2(safeTarget / safeBase);
    }

    return modDisplayValue(definition, targetValue) - modDisplayValue(definition, baseValue);
}

function targetFromModAmount(definition: ParamDefinition, baseValue: number, amount: number) {
    if (Math.abs(amount) < 0.0000001) {
        return clampNumber(baseValue, definition.min, definition.max);
    }

    if (definition.amountKind === "cutoffOctaves") {
        const safeBase = clampNumber(baseValue, definition.min, definition.max);
        return clampNumber(safeBase * (2 ** amount), definition.min, definition.max);
    }

    const baseDisplayValue = modDisplayValue(definition, baseValue);
    const displayBounds = modDisplayBounds(definition);
    const displayStep = definition.amountKind === "percentPoints"
        ? definition.step * 100
        : definition.amountKind === "tapeStopPointPercent"
            ? 1
            : definition.step;
    const nextDisplayValue = quantizeToStep(
        clampNumber(baseDisplayValue + amount, displayBounds.min, displayBounds.max),
        displayBounds.min,
        displayStep,
    );
    return clampNumber(rawValueFromModDisplay(definition, nextDisplayValue), definition.min, definition.max);
}

function normalizedAmountFromPhysical(amount: number, minAmount: number, maxAmount: number) {
    if (Math.abs(amount) < 0.0000001) {
        return 0;
    }

    if (amount > 0) {
        return maxAmount > 0 ? clampNumber(amount / maxAmount, 0, 1) : 0;
    }

    return minAmount < 0 ? -clampNumber(Math.abs(amount) / Math.abs(minAmount), 0, 1) : 0;
}

function physicalAmountFromNormalized(normalized: number, minAmount: number, maxAmount: number) {
    const clampedNormalized = clampNumber(normalized, -1, 1);
    if (clampedNormalized >= 0) {
        return clampedNormalized * Math.max(0, maxAmount);
    }

    return clampedNormalized * Math.max(0, Math.abs(minAmount));
}

function formatModAmountValue(definition: ParamDefinition, amount: number) {
    switch (definition.amountKind) {
        case "cutoffOctaves":
            return `${formatSignedFixed(amount, 2)} oct`;
        case "integer":
            return formatSignedFixed(Math.round(amount), 0);
        case "db":
            return `${formatSignedFixed(amount, 1)} dB`;
        case "speed":
            return `${formatSignedFixed(amount, 2)}x`;
        case "percentPoints":
        case "percentValue":
        case "tapeStopPointPercent":
            return `${formatSignedFixed(Math.round(amount), 0)}%`;
        case "stutterShape":
        case "linear":
        default:
            return formatSignedFixed(amount, 2);
    }
}

function formatModDestinationValue(definition: ParamDefinition, value: number) {
    switch (definition.amountKind) {
        case "cutoffOctaves":
            return formatFilterHzChip(value);
        case "integer":
            return String(Math.round(value));
        case "db":
            return `${value.toFixed(1)} dB`;
        case "speed":
            return `${value.toFixed(2)}x`;
        case "percentPoints":
            return `${Math.round(value * 100)}%`;
        case "percentValue":
            return `${Math.round(value)}%`;
        case "tapeStopPointPercent":
            return `${Math.round(multiplierToStopPointPercent(value))}%`;
        case "stutterShape":
            return formatStutterShapeLabel(value);
        case "linear":
        default:
            return formatValue(value);
    }
}

function SeqFxModToggleButton({
    aux,
    cyclePhase,
    amount,
    active,
    onClick,
}: {
    aux: SeqFxAuxState;
    cyclePhase: number;
    amount: number;
    active: boolean;
    onClick: () => void;
}) {
    const targetCount = enabledAuxTargetCount(aux);
    const path = useMemo(() => buildAuxSourcePreviewPath(aux.source), [aux.source.shape, aux.source.sourceCurve]);
    const phasePoint = auxSourceMonitorPoint(cyclePhase, amount);
    const targetWord = targetCount === 1 ? "target" : "targets";

    return (
        <button
            aria-label={`Edit modulation, shape ${aux.source.shape.toFixed(2)}, curve ${aux.source.sourceCurve.toFixed(2)}, ${targetCount} ${targetWord}`}
            aria-pressed={active}
            className={`seqfx-mod-toggle${active ? " is-selected" : ""}${targetCount > 0 ? " has-targets" : ""}`}
            data-role="seqfx-mod-toggle"
            onClick={onClick}
            type="button"
        >
            <span className="seqfx-mod-toggle__label">Mod</span>
            <svg className="seqfx-mod-toggle__thumb" viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden="true">
                <path data-role="seqfx-mod-thumbnail-path" d={path} />
                <circle
                    data-role="seqfx-mod-thumbnail-dot"
                    cx={phasePoint.x.toFixed(1)}
                    cy={phasePoint.y.toFixed(1)}
                    r="2.3"
                />
            </svg>
            <span className="seqfx-mod-toggle__badge" data-role="seqfx-mod-target-badge">{targetCount}</span>
        </button>
    );
}

function SeqFxModEditor({
    aux,
    cyclePhase,
    amount,
    params,
    definitions,
    onSourceChange,
    onTargetToggle,
    onTargetEndChange,
}: {
    aux: SeqFxAuxState;
    cyclePhase: number;
    amount: number;
    params: number[];
    definitions: ParamDefinition[];
    onSourceChange: (source: Partial<SeqFxAuxSource>) => void;
    onTargetToggle: (paramIndex: number) => void;
    onTargetEndChange: (paramIndex: number, value: number) => void;
}) {
    return (
        <div className="seqfx-mod-editor" data-role="seqfx-mod-editor">
            <AuxSource
                source={aux.source}
                cyclePhase={cyclePhase}
                amount={amount}
                onSourceChange={onSourceChange}
            />
            <div className="seqfx-mod-targets" data-role="seqfx-mod-targets">
                {definitions.map((definition) => {
                    const currentValue = clampNumber(Number(params[definition.index] ?? definition.min), definition.min, definition.max);
                    const target = aux.targets[definition.index];
                    const endValue = clampNumber(Number(target?.end ?? currentValue), definition.min, definition.max);
                    const enabled = target?.enabled === true;
                    const direction = enabled ? modulationDirectionForValues(currentValue, endValue) : "both";
                    const amountBounds = modAmountBounds(definition, currentValue);
                    const physicalAmount = modAmountFromTarget(definition, currentValue, endValue);
                    const normalizedAmount = normalizedAmountFromPhysical(physicalAmount, amountBounds.min, amountBounds.max);
                    const fillPosition = 50 + (normalizedAmount * 50);
                    const amountTrackStyle = {
                        "--mod-amount-fill-start": `${Math.min(50, fillPosition)}%`,
                        "--mod-amount-fill-end": `${Math.max(50, fillPosition)}%`,
                    } as CSSProperties;

                    return (
                        <div
                            className={`seqfx-mod-target-row${enabled ? " is-enabled" : ""}`}
                            data-param={definition.index}
                            data-role="seqfx-mod-target-row"
                            key={definition.index}
                        >
                            <span className="seqfx-mod-target-row__name">{definition.label}</span>
                            <button
                                aria-label={`Modulate ${definition.label}`}
                                aria-pressed={enabled}
                                className="seqfx-mod-target-row__toggle"
                                data-param={definition.index}
                                data-role="seqfx-mod-target-toggle"
                                onClick={() => onTargetToggle(definition.index)}
                                type="button"
                            >
                                <ModBadge isOn={enabled} direction={direction} />
                            </button>
                            {definition.kind === "select" ? (
                                <select
                                    aria-label={`${definition.label} modulation destination`}
                                    className="seqfx-mod-target-row__select"
                                    data-param={definition.index}
                                    data-role="seqfx-mod-target-destination"
                                    disabled={!enabled}
                                    onChange={(event) => onTargetEndChange(definition.index, Number(event.currentTarget.value))}
                                    value={Math.round(endValue)}
                                >
                                    {definition.options!.map((option, index) => (
                                        <option key={option} value={index}>{option}</option>
                                    ))}
                                </select>
                            ) : (
                                <>
                                    <span className="seqfx-mod-target-row__amount-control">
                                        <span className="seqfx-mod-target-row__zero" aria-hidden="true" />
                                        <input
                                            aria-label={`${definition.label} modulation amount`}
                                            aria-valuetext={`${formatModAmountValue(definition, physicalAmount)} to ${formatModDestinationValue(definition, endValue)}`}
                                            data-amount-current={physicalAmount}
                                            data-amount-max={amountBounds.max}
                                            data-amount-min={amountBounds.min}
                                            data-param={definition.index}
                                            data-role="seqfx-mod-target-amount"
                                            disabled={!enabled}
                                            max={1}
                                            min={-1}
                                            onChange={(event) => {
                                                const nextAmount = physicalAmountFromNormalized(Number(event.currentTarget.value), amountBounds.min, amountBounds.max);
                                                onTargetEndChange(definition.index, targetFromModAmount(definition, currentValue, nextAmount));
                                            }}
                                            onDoubleClick={(event) => {
                                                event.preventDefault();
                                                onTargetEndChange(definition.index, targetFromModAmount(definition, currentValue, 0));
                                            }}
                                            onInput={(event) => {
                                                const nextAmount = physicalAmountFromNormalized(Number(event.currentTarget.value), amountBounds.min, amountBounds.max);
                                                onTargetEndChange(definition.index, targetFromModAmount(definition, currentValue, nextAmount));
                                            }}
                                            step={0.000001}
                                            style={amountTrackStyle}
                                            type="range"
                                            value={normalizedAmount}
                                        />
                                    </span>
                                    <output
                                        className="seqfx-mod-target-row__amount-value"
                                        data-param={definition.index}
                                        data-role="seqfx-mod-target-amount-value"
                                    >
                                        {formatModAmountValue(definition, physicalAmount)}
                                    </output>
                                    <output
                                        className="seqfx-mod-target-row__destination"
                                        data-param={definition.index}
                                        data-role="seqfx-mod-target-destination"
                                    >
                                        {formatModDestinationValue(definition, endValue)}
                                    </output>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const PARAM_DEFINITIONS: Record<number, ParamDefinition[]> = {
    [SEQFX_EFFECT_TYPES.filter]: [
        { index: 0, label: "Mode", min: 0, max: 2, step: 1, kind: "select", options: ["Lowpass", "Highpass", "Bandpass"] },
        { index: 1, label: "Cutoff", min: 20, max: 20000, step: 1, amountKind: "cutoffOctaves" },
        { index: 3, label: "Resonance", min: 0.1, max: 20, step: 0.01, amountKind: "linear" },
    ],
    [SEQFX_EFFECT_TYPES.crusher]: [
        { index: 0, label: "Bits", min: 2, max: 16, step: 1, amountKind: "integer" },
        { index: 1, label: "Rate", min: 200, max: 48000, step: 1, amountKind: "cutoffOctaves", hint: "Converter sample rate; lower values produce wider steps and more aliasing." },
        { index: 2, label: "Drive", min: 0, max: 36, step: 0.1, amountKind: "db" },
        { index: 4, label: "ADC Q", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Pre-converter anti-alias filtering." },
        { index: 5, label: "DAC Q", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Post-converter reconstruction filtering." },
        { index: 6, label: "Dither", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Deterministic TPDF dither at the quantizer." },
    ],
    [SEQFX_EFFECT_TYPES.tapeStop]: [
        { index: 0, label: "Stop Time", min: 0, max: 8, step: 1, kind: "select", options: ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars", "1 Cell"], hint: "How long the motor takes to stop; it may outlive the block." },
        { index: 1, label: "Curve", min: -1, max: 1, step: 0.01, amountKind: "linear", hint: "Center is linear speed; left and right move the braking weight." },
        { index: 2, label: "Return", min: 0, max: 1, step: 1, kind: "select", options: ["Catch Up", "Spin Up"], hint: "Catch Up returns quickly; Spin Up uses Start Time." },
        { index: 3, label: "Start Time", min: 0, max: 8, step: 1, kind: "select", options: ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars", "1 Cell"] },
        { index: 4, label: "Character", min: 0, max: 1, step: 0.01, amountKind: "percentValue", hint: "Adds bounded high-frequency loss and saturation as the tape slows." },
        { index: 5, label: "Timing", min: 0, max: 1, step: 1, kind: "select", options: ["Sync", "Free"] },
        { index: 6, label: "Free Stop", min: 20, max: 8000, step: 1, amountKind: "linear", hint: "Milliseconds used when Timing is Free." },
        { index: 7, label: "Free Start", min: 20, max: 8000, step: 1, amountKind: "linear", hint: "Milliseconds used for a free-time Spin Up return." },
    ],
    [SEQFX_EFFECT_TYPES.stutter]: [
        { index: 0, label: "Slices", min: 2, max: 32, step: 1, amountKind: "integer", hint: "Record slice 1; repeat the rest." },
        { index: 1, label: "Speed", min: 0.5, max: 2, step: 0.01, amountKind: "speed", hint: "1.00 keeps the captured pitch." },
        { index: 2, label: "Shape", min: 0, max: 1, step: 0.01, amountKind: "stutterShape", hint: "Morphs the per-cut envelope." },
        { index: 3, label: "Gate", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Audible portion of each cut." },
    ],
    [SEQFX_EFFECT_TYPES.comb]: [
        { index: 0, label: "Tune", min: 30, max: 8000, step: 0.01, amountKind: "cutoffOctaves", hint: "Center frequency of the conventional and dispersed resonances." },
        { index: 1, label: "Decay", min: 0.02, max: 8, step: 0.01, amountKind: "linear", hint: "Time for the feedback loop to fall by 60 dB." },
        { index: 2, label: "Polarity", min: 0, max: 1, step: 1, kind: "select", options: ["Positive", "Negative"], hint: "Latched feedback polarity." },
        { index: 3, label: "Dispersion", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Morphs from the reference comb into compensated coupled modes." },
        { index: 4, label: "Damping", min: 500, max: 20000, step: 1, amountKind: "cutoffOctaves", hint: "Shortens high-frequency feedback decay." },
        { index: 5, label: "Motion", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Adds deterministic phase-offset motion to the dispersed modes." },
        { index: 6, label: "Drive", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Adds unity-small-signal saturation inside the feedback network." },
        { index: 7, label: "Width", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Moves from a mono-safe center to complementary stereo projection." },
    ],
    [SEQFX_EFFECT_TYPES.ring]: [
        { index: 0, label: "Frequency", min: 0.1, max: 12000, step: 0.01, amountKind: "cutoffOctaves", hint: "Carrier frequency; sine creates exact sum and difference sidebands." },
        { index: 1, label: "Wave", min: 0, max: 3, step: 1, kind: "select", options: ["Sine", "Triangle", "Square", "Noise"], hint: "Latched when the block triggers." },
        { index: 2, label: "Motion", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Adds a phase-continuous one-octave carrier sweep." },
        { index: 3, label: "Rate", min: 0.02, max: 20, step: 0.01, amountKind: "cutoffOctaves", hint: "Free-running motion rate in Hz." },
        { index: 4, label: "Spread", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Small opposite left/right carrier detunes, up to 25 cents per channel." },
        { index: 5, label: "Bias", min: -1, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Moves ring modulation toward positive or inverted dry signal." },
        { index: 6, label: "Rectify", min: -1, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Morphs the carrier toward positive or negative full-wave rectification." },
    ],
    [SEQFX_EFFECT_TYPES.talkBox]: [
        { index: 0, label: "From", min: 0, max: 4, step: 1, kind: "select", options: [...TALK_BOX_VOWELS], hint: "Starting vowel; latched when the block triggers." },
        { index: 1, label: "To", min: 0, max: 4, step: 1, kind: "select", options: [...TALK_BOX_VOWELS], hint: "Destination vowel; latched when the block triggers." },
        { index: 2, label: "Morph", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Moves both formants between the selected vowels on a perceptual frequency scale." },
        { index: 3, label: "Resonance", min: 1, max: 20, step: 0.01, amountKind: "linear", hint: "Controls the strength and width of both vocal resonances." },
        { index: 4, label: "Lows", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Restores source signal below the formants." },
        { index: 5, label: "Highs", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Restores source brightness above the formants." },
        { index: 6, label: "Drive", min: 0, max: 12, step: 0.1, amountKind: "db", hint: "Adds bounded excitation before the formant filters." },
    ],
    [SEQFX_EFFECT_TYPES.vibro]: [
        { index: 0, label: "Rate", min: 0.05, max: 12, step: 0.01, amountKind: "cutoffOctaves", hint: "Free-mode cycle rate; Sync derives the rate from Division and host tempo." },
        { index: 1, label: "Depth", min: 0, max: 100, step: 0.1, amountKind: "linear", hint: "Exact half peak-to-peak Doppler pitch span in cents." },
        { index: 2, label: "Wave", min: 0, max: 1, step: 1, kind: "select", options: ["Sine", "Triangle"], hint: "Latched pitch-motion shape; changes crossfade without resetting phase." },
        { index: 3, label: "Spread", min: 0, max: 180, step: 1, amountKind: "linear", hint: "Right-channel phase offset; 0° is mono-safe and 180° is opposite motion." },
        { index: 4, label: "Timing", min: 0, max: 1, step: 1, kind: "select", options: ["Sync", "Free"], hint: "Sync follows host tempo; Free uses Rate." },
        { index: 5, label: "Division", min: 0, max: 5, step: 1, kind: "select", options: ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar"], hint: "One modulation cycle when Timing is Sync." },
    ],
    [SEQFX_EFFECT_TYPES.dirty]: [
        { index: 0, label: "Drive", min: 0, max: 36, step: 0.1, amountKind: "db", hint: "Level into the oversampled nonlinear stage." },
        { index: 1, label: "Character", min: 0, max: 3, step: 1, kind: "select", options: ["Soft", "Hard", "Fold", "Bias"], hint: "Latched transfer shape; changes crossfade over 2 ms." },
        { index: 2, label: "Bias", min: -1, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Offsets the transfer curve for even-harmonic asymmetry." },
        { index: 3, label: "Dynamics", min: 0, max: 1, step: 0.01, amountKind: "percentPoints", hint: "Restores the source signal's level contrast after saturation." },
        { index: 4, label: "Tone", min: 500, max: 20000, step: 1, amountKind: "cutoffOctaves", hint: "Low-passes only the nonlinear residue, preserving the dry fundamental." },
        { index: 5, label: "Trim", min: -18, max: 6, step: 0.1, amountKind: "db", hint: "Output gain after dynamics compensation." },
    ],
};

const FILTER_PARAM_MODE = 0;
const FILTER_PARAM_CUTOFF = 1;
const FILTER_PARAM_RESONANCE = 3;
const CRUSHER_PARAM_BITS = 0;
const CRUSHER_PARAM_RATE_HZ = 1;
const CRUSHER_PARAM_DRIVE_DB = 2;
const CRUSHER_PARAM_CHARACTER = 3;
const CRUSHER_PARAM_ADC_QUALITY = 4;
const CRUSHER_PARAM_DAC_QUALITY = 5;
const CRUSHER_PARAM_DITHER = 6;
const TAPE_STOP_PARAM_START_LENGTH = 0;
const TAPE_STOP_PARAM_START_CURVE = 1;
const TAPE_STOP_PARAM_CATCHUP_CURVE = 2;
const TAPE_STOP_PARAM_CATCHUP_LENGTH = 3;
const TAPE_STOP_PARAM_MODE = 4;
const TAPE_STOP_PARAM_STOP_DIVISION = 0;
const TAPE_STOP_PARAM_CURVE = 1;
const TAPE_STOP_PARAM_RETURN = 2;
const TAPE_STOP_PARAM_START_DIVISION = 3;
const TAPE_STOP_PARAM_CHARACTER = 4;
const TAPE_STOP_PARAM_TIMING = 5;
const TAPE_STOP_PARAM_FREE_STOP_MS = 6;
const TAPE_STOP_PARAM_FREE_START_MS = 7;
const TAPE_STOP_RETURN_CATCH_UP = 0;
const TAPE_STOP_RETURN_SPIN_UP = 1;
const TAPE_STOP_TIMING_SYNC = 0;
const TAPE_STOP_TIMING_FREE = 1;
const STUTTER_PARAM_SLICES = 0;
const STUTTER_PARAM_SPEED = 1;
const STUTTER_PARAM_SHAPE = 2;
const STUTTER_PARAM_GATE = 3;
const COMB_PARAM_TUNE_HZ = 0;
const COMB_PARAM_DECAY_SECONDS = 1;
const COMB_PARAM_DISPERSION = 3;
const COMB_PARAM_DAMPING_HZ = 4;
const RING_PARAM_FREQUENCY = 0;
const RING_PARAM_WAVEFORM = 1;
const TALK_BOX_PARAM_FROM_VOWEL = 0;
const TALK_BOX_PARAM_TO_VOWEL = 1;
const TALK_BOX_PARAM_MORPH = 2;
const VIBRO_PARAM_RATE_HZ = 0;
const VIBRO_PARAM_DEPTH_CENTS = 1;
const VIBRO_PARAM_WAVEFORM = 2;
const VIBRO_PARAM_SPREAD_DEGREES = 3;
const VIBRO_PARAM_TIMING_MODE = 4;
const VIBRO_PARAM_DIVISION = 5;
const DIRTY_PARAM_DRIVE_DB = 0;
const DIRTY_PARAM_CHARACTER = 1;
const DIRTY_PARAM_BIAS = 2;

type SeqFxBlockVisualSize = "single" | "medium" | "wide";

const RISO_BLOCK_CELL_VIEWBOX = 28;
const RISO_BLOCK_GAP_VIEWBOX = 3;

function risoBlockViewBoxWidth(segmentLength: number) {
    const cellCount = Math.max(1, Math.trunc(segmentLength));
    return (cellCount * RISO_BLOCK_CELL_VIEWBOX) + ((cellCount - 1) * RISO_BLOCK_GAP_VIEWBOX);
}

function risoBlockVisualSize(segmentLength: number): SeqFxBlockVisualSize {
    if (segmentLength <= 1) {
        return "single";
    }

    if (segmentLength <= 3) {
        return "medium";
    }

    return "wide";
}

function clampUnit(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(1, Math.max(0, value));
}

function cutoffToRisoX(cutoffHz: number, width: number) {
    const safeCutoff = Math.min(20_000, Math.max(20, Number(cutoffHz) || 2_000));
    const normalized = (Math.log10(safeCutoff) - Math.log10(20)) / (Math.log10(20_000) - Math.log10(20));
    const margin = width <= 28 ? 7 : Math.min(18, Math.max(9, width * 0.12));
    return margin + (clampUnit(normalized) * Math.max(1, width - (margin * 2)));
}

function roundedPathValue(value: number) {
    return Number(value.toFixed(2));
}

function filterGlyphLabel(mode: number) {
    const roundedMode = Math.round(Number(mode));
    if (roundedMode === 1) return "HP";
    if (roundedMode === 2) return "BP";
    return "LP";
}

function filterRisoPath(mode: number, cutoffHz: number, resonance: number, width: number) {
    const x = cutoffToRisoX(cutoffHz, width);
    const qNormalized = clampUnit((Number(resonance) - 0.1) / 5.5);
    const peakY = 2 + ((1 - qNormalized) * 4);
    const passY = width <= 28 ? 12 : 10;
    const shoulder = Math.min(Math.max(width * 0.12, 4), width <= 28 ? 7 : 18);
    const modeLabel = filterGlyphLabel(mode);

    if (modeLabel === "BP") {
        const halfWidth = Math.min(Math.max(width * (0.22 - (qNormalized * 0.11)), 5), width * 0.28);
        const left = Math.max(0, x - halfWidth);
        const right = Math.min(width, x + halfWidth);
        return `M${roundedPathValue(left)} 28 Q${roundedPathValue(x - halfWidth * 0.55)} 27 ${roundedPathValue(x - halfWidth * 0.35)} 22 Q${roundedPathValue(x - halfWidth * 0.16)} 14 ${roundedPathValue(x)} ${roundedPathValue(peakY)} Q${roundedPathValue(x + halfWidth * 0.16)} 14 ${roundedPathValue(x + halfWidth * 0.35)} 22 Q${roundedPathValue(x + halfWidth * 0.55)} 27 ${roundedPathValue(right)} 28 Z`;
    }

    if (modeLabel === "HP") {
        return `M0 28 Q${roundedPathValue(Math.max(1, x - shoulder * 2.2))} 27 ${roundedPathValue(Math.max(2, x - shoulder))} 22 Q${roundedPathValue(x - shoulder * 0.45)} 12 ${roundedPathValue(x)} ${roundedPathValue(peakY)} Q${roundedPathValue(x + shoulder * 0.38)} ${roundedPathValue(passY + 2)} ${roundedPathValue(x + shoulder)} ${roundedPathValue(passY)} Q${roundedPathValue(width - 6)} ${roundedPathValue(passY)} ${roundedPathValue(width)} ${roundedPathValue(passY)} L${roundedPathValue(width)} 28 Z`;
    }

    return `M0 28 L0 ${roundedPathValue(passY)} Q${roundedPathValue(Math.max(1, x - shoulder * 2.2))} ${roundedPathValue(passY)} ${roundedPathValue(Math.max(2, x - shoulder))} ${roundedPathValue(passY - 1)} Q${roundedPathValue(x - shoulder * 0.38)} ${roundedPathValue(passY - 2)} ${roundedPathValue(x)} ${roundedPathValue(peakY)} Q${roundedPathValue(x + shoulder * 0.45)} 12 ${roundedPathValue(x + shoulder)} 22 Q${roundedPathValue(width - 2)} 27 ${roundedPathValue(width)} 28 Z`;
}

function formatRisoCutoff(cutoffHz: number) {
    const cutoff = Math.min(20_000, Math.max(20, Math.round(Number(cutoffHz) || 2_000)));
    if (cutoff >= 1000) {
        return `${Number((cutoff / 1000).toFixed(cutoff >= 10_000 ? 1 : 2))}k`;
    }

    return String(cutoff);
}

function formatRisoResonance(resonance: number) {
    return `q${Number(Number(resonance || 0).toFixed(2))}`;
}

function SeqFxFilterBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const mode = params[FILTER_PARAM_MODE] ?? 0;
    const cutoffHz = params[FILTER_PARAM_CUTOFF] ?? 2_000;
    const resonance = params[FILTER_PARAM_RESONANCE] ?? 0.707;
    const modeLabel = filterGlyphLabel(mode);
    const markerX = roundedPathValue(cutoffToRisoX(cutoffHz, width));

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="filter"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__ink"
                    d={filterRisoPath(mode, cutoffHz, resonance, width)}
                    data-role="seqfx-block-glyph-ink"
                />
                <path
                    className="seqfx-block-glyph__marker"
                    d={`M${markerX} 0 V28`}
                    data-role="seqfx-block-glyph-marker"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {modeLabel}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {formatRisoCutoff(cutoffHz)} · {formatRisoResonance(resonance)}
                </span>
            ) : null}
        </>
    );
}

function crusherStepCount(bits: number, rateHz: number) {
    const safeBits = Math.min(16, Math.max(2, Math.round(Number(bits) || 8)));
    const safeRateHz = Math.min(48_000, Math.max(200, Number(rateHz) || 48_000));
    const rateNormalized = Math.log(safeRateHz / 200) / Math.log(48_000 / 200);
    return Math.max(2, Math.min(12, Math.round((safeBits * 0.5) + (rateNormalized * 6))));
}

function crusherRisoPath(bits: number, rateHz: number, driveDb: number, width: number) {
    const stepCount = crusherStepCount(bits, rateHz);
    const levelCount = Math.max(2, Math.round(Number(bits)));
    const driveLift = clampUnit(Number(driveDb) / 36) * 5;
    const stepWidth = width / stepCount;
    const tops = Array.from({ length: stepCount }, (_unused, index) => {
        const position = stepCount <= 1 ? 0 : index / (stepCount - 1);
        const wave = Math.sin(Math.PI * position);
        const quantized = Math.round(wave * (levelCount - 1)) / Math.max(1, levelCount - 1);
        return Math.max(3, 24 - (quantized * 18) - driveLift);
    });
    const commands = [`M0 28`, `L0 ${roundedPathValue(tops[0] ?? 22)}`];

    tops.forEach((top, index) => {
        const nextX = index === tops.length - 1 ? width : (index + 1) * stepWidth;
        commands.push(`L${roundedPathValue(nextX)} ${roundedPathValue(top)}`);
        if (index < tops.length - 1) {
            commands.push(`L${roundedPathValue(nextX)} ${roundedPathValue(tops[index + 1] ?? top)}`);
        }
    });

    commands.push(`L${roundedPathValue(width)} 28 Z`);
    return commands.join(" ");
}

function SeqFxCrusherBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const bits = Math.round(Number(params[CRUSHER_PARAM_BITS] ?? 8));
    const rateHz = Math.max(200, Number(params[CRUSHER_PARAM_RATE_HZ] ?? 48_000));
    const driveDb = Number(params[CRUSHER_PARAM_DRIVE_DB] ?? 0);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="crusher"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__ink"
                    d={crusherRisoPath(bits, rateHz, driveDb, width)}
                    data-role="seqfx-block-glyph-ink"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {bits} BIT
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {rateHz >= 1_000 ? `${(rateHz / 1_000).toFixed(rateHz >= 10_000 ? 0 : 1)}k` : Math.round(rateHz)} Hz · {formatSignedFixed(driveDb, 0)} dB
                </span>
            ) : null}
        </>
    );
}

function tapeStopRisoPath(returnMode: number, curve: number, width: number) {
    const curveControl = clampNumber(Number(curve), -1, 1);
    const controlX = roundedPathValue(width * (0.5 + (curveControl * 0.24)));
    if (Math.round(Number(returnMode)) === TAPE_STOP_RETURN_SPIN_UP) {
        return `M0 4 Q${controlX} 4 ${roundedPathValue(width * 0.62)} 24 Q${roundedPathValue(width * 0.84)} 24 ${roundedPathValue(width)} 4 L${roundedPathValue(width)} 28 L0 28 Z`;
    }

    return `M0 4 Q${controlX} 4 ${roundedPathValue(width)} 27 L${roundedPathValue(width)} 28 L0 28 Z`;
}

function tapeStopRisoLabel(returnMode: number) {
    return Math.round(Number(returnMode)) === TAPE_STOP_RETURN_SPIN_UP ? "SPIN" : "STOP";
}

function SeqFxTapeStopBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const returnMode = params[TAPE_STOP_PARAM_RETURN] ?? TAPE_STOP_RETURN_CATCH_UP;
    const curve = params[TAPE_STOP_PARAM_CURVE] ?? 0;
    const label = tapeStopRisoLabel(returnMode);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="tape"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__ink"
                    d={tapeStopRisoPath(returnMode, curve, width)}
                    data-role="seqfx-block-glyph-ink"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {label}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    C{Number(curve).toFixed(1)}
                </span>
            ) : null}
        </>
    );
}

function stutterEnvelopeHeight(shape: number, index: number, count: number) {
    const position = count <= 1 ? 0 : index / (count - 1);
    const normalizedShape = clampUnit(Number(shape));
    if (normalizedShape < 0.25) {
        return 0.86;
    }

    if (normalizedShape < 0.5) {
        return 1 - (Math.abs(position - 0.5) * 1.4);
    }

    if (normalizedShape < 0.75) {
        return Math.sin(Math.PI * position);
    }

    return 1 - (position * 0.8);
}

function shortStutterShapeLabel(shape: number) {
    const label = formatStutterShapeLabel(shape).split(" -> ")[0]?.split(" (")[0] ?? "Gate";
    if (label === "Ramp Down") return "DECAY";
    if (label === "Ramp Up") return "SWELL";
    return label.toUpperCase();
}

function SeqFxStutterBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const slices = Math.min(32, Math.max(2, Math.round(Number(params[STUTTER_PARAM_SLICES] ?? 8))));
    const shape = Number(params[STUTTER_PARAM_SHAPE] ?? 0);
    const gap = slices > 20 ? 0.8 : slices > 12 ? 1.2 : 2;
    const barWidth = Math.max(0.7, (width - ((slices + 1) * gap)) / slices);
    const bars = Array.from({ length: slices }, (_unused, index) => {
        const height = Math.max(3, stutterEnvelopeHeight(shape, index, slices) * 22);
        return {
            height,
            x: gap + (index * (barWidth + gap)),
            y: 26 - height,
        };
    });
    const shapeLabel = shortStutterShapeLabel(shape);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="stutter"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <g className="seqfx-block-glyph__ink">
                    {bars.map((bar, index) => (
                        <rect
                            data-role="seqfx-block-glyph-rect"
                            height={roundedPathValue(bar.height)}
                            key={index}
                            width={roundedPathValue(barWidth)}
                            x={roundedPathValue(bar.x)}
                            y={roundedPathValue(bar.y)}
                        />
                    ))}
                </g>
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    x{slices}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    x{slices} {shapeLabel}
                </span>
            ) : null}
        </>
    );
}

function combRisoPath(tuneHz: number, dispersion: number, dampingHz: number, width: number) {
    const safeTune = clampNumber(Number(tuneHz), 30, 8_000);
    const safeDispersion = clampUnit(Number(dispersion));
    const safeDamping = clampNumber(Number(dampingHz), 500, 20_000);
    const tunePosition = Math.log(safeTune / 30) / Math.log(8_000 / 30);
    const toothCount = Math.max(3, Math.min(12, Math.round(3 + (tunePosition * 9))));
    const commands = [`M0 8`];
    for (let tooth = 0; tooth < toothCount; tooth += 1) {
        const center = ((tooth + 0.5) / toothCount) * width;
        const spacing = width / toothCount;
        const bend = Math.sin((tooth + 1) * 2.17) * spacing * 0.16 * safeDispersion;
        const x = clampNumber(center + bend, 0, width);
        const highLoss = tooth / Math.max(1, toothCount - 1);
        const dampingAmount = 1 - (Math.log(safeDamping / 500) / Math.log(20_000 / 500));
        const depth = Math.max(5, 19 - (highLoss * dampingAmount * 10));
        const halfWidth = Math.max(0.8, spacing * (0.1 + (safeDispersion * 0.08)));
        commands.push(
            `L${roundedPathValue(Math.max(0, x - halfWidth))} 8`,
            `L${roundedPathValue(x)} ${roundedPathValue(8 + depth)}`,
            `L${roundedPathValue(Math.min(width, x + halfWidth))} 8`,
        );
    }
    commands.push(`L${roundedPathValue(width)} 8`);
    return commands.join(" ");
}

function SeqFxCombBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const tuneHz = Number(params[COMB_PARAM_TUNE_HZ] ?? 220);
    const decaySeconds = Number(params[COMB_PARAM_DECAY_SECONDS] ?? 1.4);
    const dispersion = Number(params[COMB_PARAM_DISPERSION] ?? 0.55);
    const dampingHz = Number(params[COMB_PARAM_DAMPING_HZ] ?? 7_500);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="comb"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={combRisoPath(tuneHz, dispersion, dampingHz, width)}
                    data-role="seqfx-block-glyph-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {formatRisoCutoff(tuneHz)} HZ
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {Number(decaySeconds.toFixed(2))} s · {Math.round(clampUnit(dispersion) * 100)}%
                </span>
            ) : null}
        </>
    );
}

function ringRisoPath(waveform: number, frequencyHz: number, width: number) {
    const safeFrequency = clampNumber(Number(frequencyHz), 0.1, 12_000);
    const cycles = Math.max(1, Math.min(8, Math.round(1 + (Math.log10(safeFrequency / 0.1) / Math.log10(120_000)) * 7)));
    const points = Array.from({ length: 65 }, (_unused, index) => {
        const phase = (index / 64) * cycles;
        const wrapped = phase - Math.floor(phase);
        let carrier = Math.sin(phase * Math.PI * 2);
        if (waveform === 1) carrier = 1 - (4 * Math.abs(wrapped - 0.5));
        if (waveform === 2) carrier = wrapped < 0.5 ? 1 : -1;
        if (waveform === 3) carrier = Math.sin((index * 12.9898) + 78.233) * 0.82;
        return `${index === 0 ? "M" : "L"}${roundedPathValue((index / 64) * width)} ${roundedPathValue(14 - (carrier * 10))}`;
    });
    return points.join(" ");
}

function SeqFxRingBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const frequencyHz = Number(params[RING_PARAM_FREQUENCY] ?? 180);
    const waveform = Math.round(Number(params[RING_PARAM_WAVEFORM] ?? 0));
    const waveformLabel = ["SIN", "TRI", "SQR", "NOISE"][waveform] ?? "SIN";

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="ring"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={ringRisoPath(waveform, frequencyHz, width)}
                    data-role="seqfx-block-glyph-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {waveformLabel}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {frequencyHz >= 1_000 ? `${(frequencyHz / 1_000).toFixed(1)}k` : Number(frequencyHz.toFixed(1))} Hz
                </span>
            ) : null}
        </>
    );
}

function talkBoxRisoPath(firstHz: number, secondHz: number, resonance: number, width: number) {
    const firstX = cutoffToRisoX(firstHz, width);
    const secondX = cutoffToRisoX(secondHz, width);
    const q = clampNumber(Number(resonance), 1, 20);
    const peakWidth = Math.max(1.25, width * (0.12 - (0.075 * ((q - 1) / 19))));
    const points = Array.from({ length: 65 }, (_unused, index) => {
        const x = (index / 64) * width;
        const firstPeak = 1 / (1 + (((x - firstX) / peakWidth) ** 2));
        const secondPeak = 1 / (1 + (((x - secondX) / peakWidth) ** 2));
        const response = Math.min(1, (firstPeak * 0.88) + secondPeak);
        return `${index === 0 ? "M" : "L"}${roundedPathValue(x)} ${roundedPathValue(25 - (response * 21))}`;
    });
    return `${points.join(" ")} L${roundedPathValue(width)} 28 L0 28 Z`;
}

function SeqFxTalkBoxBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const fromVowel = Number(params[TALK_BOX_PARAM_FROM_VOWEL] ?? 0);
    const toVowel = Number(params[TALK_BOX_PARAM_TO_VOWEL] ?? 3);
    const morph = Number(params[TALK_BOX_PARAM_MORPH] ?? 0);
    const resonance = Number(params[3] ?? 6);
    const formants = resolveTalkBoxFormants(fromVowel, toVowel, morph);

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="talk-box"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__ink"
                    d={talkBoxRisoPath(formants.firstHz, formants.secondHz, resonance, width)}
                    data-role="seqfx-block-glyph-ink"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {formatTalkBoxVowelPair(fromVowel, toVowel)}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {Math.round(formants.firstHz)} / {Math.round(formants.secondHz)} Hz
                </span>
            ) : null}
        </>
    );
}

function vibroRisoPath(waveform: number, phaseOffset: number, width: number) {
    const cycles = width <= 28 ? 1.5 : Math.min(5, Math.max(2, width / 42));
    return Array.from({ length: 65 }, (_unused, index) => {
        const phase = ((index / 64) * cycles) + phaseOffset;
        const wrapped = phase - Math.floor(phase);
        const wave = waveform === 1
            ? 1 - (4 * Math.abs(wrapped - 0.5))
            : Math.sin(phase * Math.PI * 2);
        return `${index === 0 ? "M" : "L"}${roundedPathValue((index / 64) * width)} ${roundedPathValue(14 - (wave * 8))}`;
    }).join(" ");
}

function SeqFxVibroBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const rateHz = Number(params[VIBRO_PARAM_RATE_HZ] ?? 4.5);
    const depthCents = Number(params[VIBRO_PARAM_DEPTH_CENTS] ?? 28);
    const waveform = Math.round(Number(params[VIBRO_PARAM_WAVEFORM] ?? 0));
    const spreadDegrees = Number(params[VIBRO_PARAM_SPREAD_DEGREES] ?? 90);
    const timingMode = Math.round(Number(params[VIBRO_PARAM_TIMING_MODE] ?? 0));
    const division = Math.round(Number(params[VIBRO_PARAM_DIVISION] ?? 2));
    const divisionLabel = ["1/32", "1/16", "1/8", "1/4", "1/2", "1 BAR"][division] ?? "1/8";

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="vibro"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={vibroRisoPath(waveform, 0, width)}
                    data-role="seqfx-block-glyph-line"
                />
                <path
                    className="seqfx-block-glyph__line seqfx-block-glyph__line--secondary"
                    d={vibroRisoPath(waveform, clampNumber(spreadDegrees, 0, 180) / 360, width)}
                    data-role="seqfx-block-glyph-secondary-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {Number(depthCents.toFixed(1))}¢
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {timingMode === 0 ? `${divisionLabel} SYNC` : `${Number(rateHz.toFixed(2))} Hz`}
                </span>
            ) : null}
        </>
    );
}

function dirtyTransferSample(input: number, character: number, bias: number, driveDb: number) {
    const soft = (value: number) => value / Math.sqrt(1 + (value * value));
    const fold = (value: number) => {
        const wrapped = value - (4 * Math.floor((value + 2) / 4));
        if (wrapped > 1) return 2 - wrapped;
        if (wrapped < -1) return -2 - wrapped;
        return wrapped;
    };
    const shape = (value: number) => {
        if (character === 1) return clampNumber(value, -1, 1);
        if (character === 2) return fold(value);
        if (character === 3) return soft(value + 0.22) - soft(0.22);
        return soft(value);
    };
    const offset = clampNumber(bias, -1, 1) * 0.5;
    const driven = input * (10 ** (clampNumber(driveDb, 0, 36) / 20));
    return clampNumber(shape(driven + offset) - shape(offset), -1.25, 1.25);
}

function dirtyRisoPath(character: number, bias: number, driveDb: number, width: number) {
    return Array.from({ length: 65 }, (_unused, index) => {
        const input = ((index / 64) * 2) - 1;
        const output = dirtyTransferSample(input, character, bias, driveDb);
        const x = (index / 64) * width;
        const y = 14 - ((output / 1.25) * 11);
        return `${index === 0 ? "M" : "L"}${roundedPathValue(x)} ${roundedPathValue(y)}`;
    }).join(" ");
}

function SeqFxDirtyBlockGlyph({
    params,
    size,
    width,
}: {
    params: number[];
    size: SeqFxBlockVisualSize;
    width: number;
}) {
    const driveDb = Number(params[DIRTY_PARAM_DRIVE_DB] ?? 12);
    const character = Math.round(Number(params[DIRTY_PARAM_CHARACTER] ?? 0));
    const bias = Number(params[DIRTY_PARAM_BIAS] ?? 0);
    const characterLabel = ["SOFT", "HARD", "FOLD", "BIAS"][character] ?? "SOFT";

    return (
        <>
            <svg
                aria-hidden="true"
                className="seqfx-block-glyph"
                data-effect="dirty"
                data-role="seqfx-block-glyph"
                data-size={size}
                focusable="false"
                preserveAspectRatio="none"
                viewBox={`0 0 ${width} 28`}
            >
                <path
                    className="seqfx-block-glyph__line"
                    d={dirtyRisoPath(character, bias, driveDb, width)}
                    data-role="seqfx-block-glyph-line"
                />
            </svg>
            {size !== "single" ? (
                <span className="seqfx-block-glyph-label" data-role="seqfx-block-glyph-label">
                    {characterLabel}
                </span>
            ) : null}
            {size === "wide" ? (
                <span className="seqfx-block-glyph-readout" data-role="seqfx-block-glyph-readout">
                    {formatSignedFixed(driveDb, 0)} dB
                </span>
            ) : null}
        </>
    );
}

export function SeqFxBlockGlyph({
    effectType,
    params,
    segmentLength,
}: {
    effectType: SeqFxEffectType;
    params: number[];
    segmentLength: number;
}) {
    const size = risoBlockVisualSize(segmentLength);
    const width = risoBlockViewBoxWidth(segmentLength);

    switch (effectType) {
        case SEQFX_EFFECT_TYPES.filter:
            return <SeqFxFilterBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.crusher:
            return <SeqFxCrusherBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.tapeStop:
            return <SeqFxTapeStopBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.stutter:
            return <SeqFxStutterBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.comb:
            return <SeqFxCombBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.ring:
            return <SeqFxRingBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.talkBox:
            return <SeqFxTalkBoxBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.vibro:
            return <SeqFxVibroBlockGlyph params={params} size={size} width={width} />;
        case SEQFX_EFFECT_TYPES.dirty:
            return <SeqFxDirtyBlockGlyph params={params} size={size} width={width} />;
        default:
            return null;
    }
}

const SEQFX_FILTER_MODE_OPTIONS: FilterRangeModeOption[] = [
    { label: "LP", value: "lowpass" },
    { label: "HP", value: "highpass" },
    { label: "BP", value: "bandpass" },
];

function seqFxFilterModeToRangeMode(mode: number): FilterRangeMode {
    const roundedMode = Math.round(mode);
    if (roundedMode === 1) return "highpass";
    if (roundedMode === 2) return "bandpass";
    return "lowpass";
}

function filterRangeModeToSeqFxMode(mode: FilterRangeMode) {
    if (mode === "highpass") return 1;
    if (mode === "bandpass") return 2;
    return 0;
}

function filterRangeValueFromSeqFxStep(step: SeqFxStep): FilterRangeValue {
    const startCutoffHz = step.params[FILTER_PARAM_CUTOFF] ?? 2_000;
    const cutoffTarget = step.aux.targets[FILTER_PARAM_CUTOFF];
    const endCutoffHz = cutoffTarget?.enabled ? cutoffTarget.end : startCutoffHz;

    return {
        mode: seqFxFilterModeToRangeMode(step.params[FILTER_PARAM_MODE] ?? 0),
        cutoffHz: geometricCenterCutoffHz(startCutoffHz, endCutoffHz),
        q: step.params[FILTER_PARAM_RESONANCE] ?? 0.707,
    };
}

function filterRangeEndpointsFromSeqFxStep(step: SeqFxStep): FilterRangeEndpoints {
    const startCutoffHz = step.params[FILTER_PARAM_CUTOFF] ?? 2_000;
    const cutoffTarget = step.aux.targets[FILTER_PARAM_CUTOFF];
    return {
        startCutoffHz,
        endCutoffHz: cutoffTarget?.enabled ? cutoffTarget.end : startCutoffHz,
    };
}

function crusherValueFromSeqFxStep(step: SeqFxStep) {
    return {
        bits: step.params[CRUSHER_PARAM_BITS],
        rateHz: step.params[CRUSHER_PARAM_RATE_HZ],
        driveDb: step.params[CRUSHER_PARAM_DRIVE_DB],
        character: step.params[CRUSHER_PARAM_CHARACTER],
        adcQuality: step.params[CRUSHER_PARAM_ADC_QUALITY],
        dacQuality: step.params[CRUSHER_PARAM_DAC_QUALITY],
        dither: step.params[CRUSHER_PARAM_DITHER],
        mix: step.mix,
    };
}

function stutterValueFromSeqFxStep(step: SeqFxStep) {
    return {
        slices: step.params[STUTTER_PARAM_SLICES],
        speed: step.params[STUTTER_PARAM_SPEED],
        shape: step.params[STUTTER_PARAM_SHAPE],
        gate: step.params[STUTTER_PARAM_GATE],
    };
}

function buildStepNumbers() {
    return Array.from({ length: SEQFX_STEP_COUNT }, (_unused, index) => index);
}

const STEP_NUMBERS = buildStepNumbers();
const SEQFX_RATE_CELLS_PER_BEAT = [2, 4, 8] as const;
const SEQFX_BEATS_PER_BAR = 4;
const SEQFX_GRID_STEPS_PER_ROW = 16;
const SEQFX_GRID_BAR_COUNT = Math.ceil(SEQFX_STEP_COUNT / SEQFX_GRID_STEPS_PER_ROW);
const STEP_BARS = Array.from({ length: SEQFX_GRID_BAR_COUNT }, (_unused, barIndex) => (
    STEP_NUMBERS.slice(barIndex * SEQFX_GRID_STEPS_PER_ROW, (barIndex + 1) * SEQFX_GRID_STEPS_PER_ROW)
));
const SEQFX_BAR_FRAME_INNER_GAP_PX = 8;
const SEQFX_BAR_FRAME_GAP_PX = 8;
const SEQFX_BAR_FRAME_NUMBER_BAND_PX = 20;
const SEQFX_BAR_FRAME_ARROW_HEIGHT_PX = 25;
const SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX = 12;
const SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX = 4;
const SEQFX_BAR_FRAME_ARROW_SHAFT_HEIGHT_PX = 4;
const SEQFX_BAR_FRAME_BEVEL_PX = 12;
const SEQFX_BAR_FRAME_OUTER_BOTTOM_BEVEL_PX = SEQFX_BAR_FRAME_BEVEL_PX
    + (SEQFX_BAR_FRAME_GAP_PX * (2 - Math.SQRT2));
const SEQFX_BAR_FRAME_STROKE_INSET_PX = 1;
const SEQFX_GRID_SHELL_PADDING_TOP_PX = 24;
const SEQFX_STEP_NUMBER_HEIGHT_PX = 9;
const SEQFX_STEP_HEADER_GAP_PX = 12;
const SEQFX_INSPECTOR_TOP_ALIGN_OFFSET_PX = SEQFX_GRID_SHELL_PADDING_TOP_PX
    + SEQFX_STEP_NUMBER_HEIGHT_PX
    + SEQFX_STEP_HEADER_GAP_PX
    - (SEQFX_BAR_FRAME_NUMBER_BAND_PX + SEQFX_BAR_FRAME_GAP_PX + SEQFX_BAR_FRAME_INNER_GAP_PX)
    + SEQFX_BAR_FRAME_STROKE_INSET_PX;
const SEQFX_WORKSPACE_STYLE = {
    "--seqfx-grid-shell-padding-top": `${SEQFX_GRID_SHELL_PADDING_TOP_PX}px`,
    "--seqfx-inspector-top-align-offset": `${SEQFX_INSPECTOR_TOP_ALIGN_OFFSET_PX}px`,
    "--seqfx-step-header-gap": `${SEQFX_STEP_HEADER_GAP_PX}px`,
    "--seqfx-step-number-height": `${SEQFX_STEP_NUMBER_HEIGHT_PX}px`,
} as CSSProperties;

function cellsPerBeatForRateIndex(rateIndex: number) {
    return SEQFX_RATE_CELLS_PER_BEAT[Math.min(2, Math.max(0, Math.round(rateIndex)))] ?? 4;
}

function gridColumnForStep(step: number) {
    const clampedStep = Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, step));
    return ((clampedStep % SEQFX_GRID_STEPS_PER_ROW) * 2) + 1;
}

function gridRowForStep(step: number) {
    return 1;
}

function barIndexForStep(step: number) {
    const clampedStep = Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, step));
    return Math.floor(clampedStep / SEQFX_GRID_STEPS_PER_ROW);
}

function laneTrackRefKey(lane: number, barIndex: number) {
    return `${lane}:${barIndex}`;
}

function cellRefKey(lane: number, step: number) {
    return `${lane}:${step}`;
}

function frameCornerClassNames(lane: number, barIndex: number, startStep: number, endStep: number) {
    if (barIndex < 0 || barIndex >= SEQFX_GRID_BAR_COUNT) {
        return [];
    }

    const classNames: string[] = [];
    const lastLane = SEQFX_LANE_NAMES.length - 1;
    const firstStepInFrame = barIndex * SEQFX_GRID_STEPS_PER_ROW;
    const lastStepInFrame = SEQFX_GRID_STEPS_PER_ROW - 1;
    const localStartStep = startStep - firstStepInFrame;
    const localEndStep = endStep - firstStepInFrame;

    if (lane === 0 && localStartStep === 0) {
        classNames.push("has-frame-corner-tl");
    }

    if (lane === 0 && localEndStep === lastStepInFrame) {
        classNames.push("has-frame-corner-tr");
    }

    if (lane === lastLane && localStartStep === 0) {
        classNames.push("has-frame-corner-bl");
    }

    if (lane === lastLane && localEndStep === lastStepInFrame) {
        classNames.push("has-frame-corner-br");
    }

    return classNames;
}

function buildBeveledRectPath(left: number, top: number, right: number, bottom: number, bevel: number) {
    return [
        `M ${left + bevel} ${top}`,
        `L ${right - bevel} ${top}`,
        `L ${right} ${top + bevel}`,
        `L ${right} ${bottom - bevel}`,
        `L ${right - bevel} ${bottom}`,
        `L ${left + bevel} ${bottom}`,
        `L ${left} ${bottom - bevel}`,
        `L ${left} ${top + bevel}`,
        "Z",
    ].join(" ");
}

function buildOuterFrameBodyPath(
    left: number,
    top: number,
    right: number,
    bottom: number,
    topBevel: number,
    bottomBevel: number,
    centerX: number,
) {
    const shaftLeft = centerX - SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const shaftRight = centerX + SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;

    return [
        `M ${shaftRight} ${bottom}`,
        `L ${right - bottomBevel} ${bottom}`,
        `L ${right} ${bottom - bottomBevel}`,
        `L ${right} ${top + topBevel}`,
        `L ${right - topBevel} ${top}`,
        `L ${left + topBevel} ${top}`,
        `L ${left} ${top + topBevel}`,
        `L ${left} ${bottom - bottomBevel}`,
        `L ${left + bottomBevel} ${bottom}`,
        `L ${shaftLeft} ${bottom}`,
    ].join(" ");
}

function buildOuterFrameClosedPath(
    left: number,
    top: number,
    right: number,
    bottom: number,
    topBevel: number,
    bottomBevel: number,
) {
    return [
        `M ${left + topBevel} ${top}`,
        `L ${right - topBevel} ${top}`,
        `L ${right} ${top + topBevel}`,
        `L ${right} ${bottom - bottomBevel}`,
        `L ${right - bottomBevel} ${bottom}`,
        `L ${left + bottomBevel} ${bottom}`,
        `L ${left} ${bottom - bottomBevel}`,
        `L ${left} ${top + topBevel}`,
        "Z",
    ].join(" ");
}

function buildOuterFrameArrowPath(bottom: number, centerX: number) {
    const shaftLeft = centerX - SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const shaftRight = centerX + SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const arrowLeft = centerX - SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX;
    const arrowRight = centerX + SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX;
    const shaftBottom = bottom + SEQFX_BAR_FRAME_ARROW_SHAFT_HEIGHT_PX;
    const arrowTipY = bottom + SEQFX_BAR_FRAME_ARROW_HEIGHT_PX;

    return [
        `M ${shaftLeft} ${bottom}`,
        `L ${shaftLeft} ${shaftBottom}`,
        `L ${arrowLeft} ${shaftBottom}`,
        `L ${centerX} ${arrowTipY}`,
        `L ${arrowRight} ${shaftBottom}`,
        `L ${shaftRight} ${shaftBottom}`,
        `L ${shaftRight} ${bottom}`,
    ].join(" ");
}

function buildFramePlatePath(
    outerLeft: number,
    outerTop: number,
    outerRight: number,
    outerBottom: number,
    outerTopBevel: number,
    outerBottomBevel: number,
    centerX: number,
    innerLeft: number,
    innerTop: number,
    innerRight: number,
    innerBottom: number,
    innerBevel: number,
    hasArrow: boolean,
) {
    const shaftLeft = centerX - SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const shaftRight = centerX + SEQFX_BAR_FRAME_ARROW_SHAFT_HALF_WIDTH_PX;
    const arrowLeft = centerX - SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX;
    const arrowRight = centerX + SEQFX_BAR_FRAME_ARROW_HALF_WIDTH_PX;
    const shaftBottom = outerBottom + SEQFX_BAR_FRAME_ARROW_SHAFT_HEIGHT_PX;
    const arrowTipY = outerBottom + SEQFX_BAR_FRAME_ARROW_HEIGHT_PX;

    const outerSilhouette = hasArrow
        ? [
            `M ${shaftRight} ${outerBottom}`,
            `L ${outerRight - outerBottomBevel} ${outerBottom}`,
            `L ${outerRight} ${outerBottom - outerBottomBevel}`,
            `L ${outerRight} ${outerTop + outerTopBevel}`,
            `L ${outerRight - outerTopBevel} ${outerTop}`,
            `L ${outerLeft + outerTopBevel} ${outerTop}`,
            `L ${outerLeft} ${outerTop + outerTopBevel}`,
            `L ${outerLeft} ${outerBottom - outerBottomBevel}`,
            `L ${outerLeft + outerBottomBevel} ${outerBottom}`,
            `L ${shaftLeft} ${outerBottom}`,
            `L ${shaftLeft} ${shaftBottom}`,
            `L ${arrowLeft} ${shaftBottom}`,
            `L ${centerX} ${arrowTipY}`,
            `L ${arrowRight} ${shaftBottom}`,
            `L ${shaftRight} ${shaftBottom}`,
            "Z",
        ].join(" ")
        : buildOuterFrameClosedPath(
            outerLeft,
            outerTop,
            outerRight,
            outerBottom,
            outerTopBevel,
            outerBottomBevel,
        );

    return `${outerSilhouette} ${buildBeveledRectPath(innerLeft, innerTop, innerRight, innerBottom, innerBevel)}`;
}

function SeqFxBarFrame({ barIndex, hasArrow }: { barIndex: number; hasArrow: boolean }) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const [cellStackSize, setCellStackSize] = useState({ width: 1, height: 1 });

    useLayoutEffect(() => {
        const cellStack = frameRef.current?.parentElement;
        if (!cellStack) {
            return;
        }

        const update = () => {
            const bounds = cellStack.getBoundingClientRect();
            setCellStackSize({
                width: Math.max(1, bounds.width || 1),
                height: Math.max(1, bounds.height || 1),
            });
        };

        const observer = new ResizeObserver(update);
        observer.observe(cellStack);
        const updateOnResize = () => {
            update();
            requestAnimationFrame(update);
        };
        window.addEventListener("resize", updateOnResize);
        update();

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateOnResize);
        };
    }, []);

    const frameLeft = -(SEQFX_BAR_FRAME_INNER_GAP_PX + SEQFX_BAR_FRAME_GAP_PX);
    const frameTop = -(SEQFX_BAR_FRAME_NUMBER_BAND_PX + SEQFX_BAR_FRAME_GAP_PX + SEQFX_BAR_FRAME_INNER_GAP_PX);
    const frameWidth = cellStackSize.width + (2 * (SEQFX_BAR_FRAME_INNER_GAP_PX + SEQFX_BAR_FRAME_GAP_PX));
    const outerBottom = SEQFX_BAR_FRAME_NUMBER_BAND_PX
        + SEQFX_BAR_FRAME_GAP_PX
        + SEQFX_BAR_FRAME_INNER_GAP_PX
        + cellStackSize.height
        + SEQFX_BAR_FRAME_INNER_GAP_PX
        + SEQFX_BAR_FRAME_GAP_PX;
    const frameHeight = outerBottom + (hasArrow ? SEQFX_BAR_FRAME_ARROW_HEIGHT_PX : 0) + SEQFX_BAR_FRAME_STROKE_INSET_PX;
    const innerLeft = SEQFX_BAR_FRAME_GAP_PX;
    const innerTop = SEQFX_BAR_FRAME_NUMBER_BAND_PX + SEQFX_BAR_FRAME_GAP_PX;
    const innerRight = innerLeft + (2 * SEQFX_BAR_FRAME_INNER_GAP_PX) + cellStackSize.width;
    const innerBottom = innerTop + (2 * SEQFX_BAR_FRAME_INNER_GAP_PX) + cellStackSize.height;
    const outerLeft = innerLeft - SEQFX_BAR_FRAME_GAP_PX;
    const outerTop = SEQFX_BAR_FRAME_STROKE_INSET_PX;
    const outerRight = innerRight + SEQFX_BAR_FRAME_GAP_PX;
    const visibleOuterBottom = innerBottom + SEQFX_BAR_FRAME_GAP_PX;
    const centerX = frameWidth * 0.5;
    const cornerGlyphs = [
        {
            key: "tl",
            x: outerLeft + 14,
            y: outerTop + 14,
            rotate: -45,
            paths: ["M -5 -2.5 L 0 -2.5 L 0 2.5 L 5 2.5", "M -5 2.5 L -2.5 2.5", "M 2.5 -2.5 L 5 -2.5"],
        },
        {
            key: "tr",
            accent: true,
            x: outerRight - 14,
            y: outerTop + 14,
            rotate: 45,
            paths: ["M -5 0 L -1.5 0 L 0 -2.5 L 1.5 0 L 5 0", "M -3 3 L 3 3"],
        },
        {
            key: "br",
            x: outerRight - 14,
            y: visibleOuterBottom - 14,
            rotate: 135,
            paths: ["M -5 -3 L 5 -3", "M -5 0 L 5 0", "M -5 3 L 5 3"],
        },
        {
            key: "bl",
            x: outerLeft + 14,
            y: visibleOuterBottom - 14,
            rotate: -135,
            paths: ["M -5 -2.5 L -1.5 -2.5 L 1.5 2.5 L 5 2.5", "M -5 2.5 L -2.5 2.5", "M 2.5 -2.5 L 5 -2.5"],
        },
    ];
    const platePath = buildFramePlatePath(
        outerLeft,
        outerTop,
        outerRight,
        visibleOuterBottom,
        SEQFX_BAR_FRAME_BEVEL_PX,
        SEQFX_BAR_FRAME_OUTER_BOTTOM_BEVEL_PX,
        centerX,
        innerLeft,
        innerTop,
        innerRight,
        innerBottom,
        SEQFX_BAR_FRAME_BEVEL_PX,
        hasArrow,
    );
    const plateFilterId = `seqfx-bar-frame-plate-material-${barIndex}`;

    return (
        <div
            className="seqfx-bar-frame"
            data-bar={barIndex}
            data-has-arrow={hasArrow ? "true" : "false"}
            data-role="seqfx-bar-frame"
            ref={frameRef}
            style={{
                height: frameHeight,
                left: frameLeft,
                top: frameTop,
                width: `calc(100% + ${2 * (SEQFX_BAR_FRAME_INNER_GAP_PX + SEQFX_BAR_FRAME_GAP_PX)}px)`,
            }}
        >
            <svg
                aria-hidden="true"
                className="seqfx-bar-frame__svg"
                focusable="false"
                viewBox={`0 0 ${frameWidth} ${frameHeight}`}
            >
                <defs>
                    <filter
                        id={plateFilterId}
                        colorInterpolationFilters="sRGB"
                        filterUnits="userSpaceOnUse"
                        height={frameHeight + 64}
                        width={frameWidth + 64}
                        x={-32}
                        y={-32}
                    >
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.8" result="darkBlur" />
                        <feOffset in="darkBlur" dx="2.4" dy="3" result="darkOffset" />
                        <feFlood floodColor="#8f8577" floodOpacity="0.3" result="darkColor" />
                        <feComposite in="darkColor" in2="darkOffset" operator="in" result="darkShadow" />

                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="lightBlur" />
                        <feOffset in="lightBlur" dx="-2" dy="-2" result="lightOffset" />
                        <feFlood floodColor="#fff7e8" floodOpacity="0.64" result="lightColor" />
                        <feComposite in="lightColor" in2="lightOffset" operator="in" result="lightShadow" />

                        <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="edgeBlur" />
                        <feOffset in="edgeBlur" dx="0" dy="1.1" result="edgeOffset" />
                        <feFlood floodColor="#756c60" floodOpacity="0.18" result="edgeColor" />
                        <feComposite in="edgeColor" in2="edgeOffset" operator="in" result="edgeShadow" />

                        <feMerge>
                            <feMergeNode in="darkShadow" />
                            <feMergeNode in="lightShadow" />
                            <feMergeNode in="edgeShadow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <path
                    className="seqfx-bar-frame__plate"
                    data-role="seqfx-bar-frame-plate"
                    d={platePath}
                    filter={`url(#${plateFilterId})`}
                    fillRule="evenodd"
                />
                <g className="seqfx-bar-frame__corner-glyphs" data-role="seqfx-bar-frame-corner-glyphs">
                    {cornerGlyphs.map((glyph) => (
                        <g
                            className={glyph.accent ? "seqfx-bar-frame__corner-glyph is-accent" : "seqfx-bar-frame__corner-glyph"}
                            data-role="seqfx-bar-frame-corner-glyph"
                            data-corner={glyph.key}
                            key={glyph.key}
                            transform={`translate(${glyph.x} ${glyph.y}) rotate(${glyph.rotate})`}
                        >
                            {glyph.paths.map((pathData) => (
                                <path d={pathData} key={pathData} />
                            ))}
                        </g>
                    ))}
                </g>
                <path
                    className="seqfx-bar-frame__outer seqfx-bar-frame__outer-body"
                    data-role="seqfx-bar-frame-outer-body"
                    d={hasArrow
                        ? buildOuterFrameBodyPath(
                            outerLeft,
                            outerTop,
                            outerRight,
                            visibleOuterBottom,
                            SEQFX_BAR_FRAME_BEVEL_PX,
                            SEQFX_BAR_FRAME_OUTER_BOTTOM_BEVEL_PX,
                            centerX,
                        )
                        : buildOuterFrameClosedPath(
                            outerLeft,
                            outerTop,
                            outerRight,
                            visibleOuterBottom,
                            SEQFX_BAR_FRAME_BEVEL_PX,
                            SEQFX_BAR_FRAME_OUTER_BOTTOM_BEVEL_PX,
                        )}
                />
                {hasArrow ? (
                    <path
                        className="seqfx-bar-frame__outer seqfx-bar-frame__outer-arrow"
                        data-role="seqfx-bar-frame-outer-arrow"
                        d={buildOuterFrameArrowPath(visibleOuterBottom, centerX)}
                    />
                ) : null}
                <path
                    className="seqfx-bar-frame__inner"
                    data-role="seqfx-bar-frame-inner"
                    d={buildBeveledRectPath(
                        innerLeft,
                        innerTop,
                        innerRight,
                        innerBottom,
                        SEQFX_BAR_FRAME_BEVEL_PX,
                    )}
                />
            </svg>
        </div>
    );
}

function createGridGeometry(cellsPerBeat: number) {
    const cellsPerBar = cellsPerBeat * SEQFX_BEATS_PER_BAR;

    const cellStyle = (step: number): CSSProperties => ({
        gridColumn: `${gridColumnForStep(step)}`,
        gridRow: `${gridRowForStep(step)}`,
    });

    const blockSegments = (startStep: number, length: number) => {
        const lastStep = Math.min(SEQFX_STEP_COUNT - 1, startStep + length - 1);
        const segments: Array<{
            barIndex: number;
            endStep: number;
            isEndSegment: boolean;
            startStep: number;
            style: CSSProperties;
        }> = [];
        let segmentStart = Math.min(SEQFX_STEP_COUNT - 1, Math.max(0, startStep));

        while (segmentStart <= lastStep) {
            const barIndex = barIndexForStep(segmentStart);
            const rowEndStep = Math.min(lastStep, ((barIndex + 1) * SEQFX_GRID_STEPS_PER_ROW) - 1);
            segments.push({
                barIndex,
                endStep: rowEndStep,
                isEndSegment: rowEndStep === lastStep,
                startStep: segmentStart,
                style: {
                    gridColumn: `${gridColumnForStep(segmentStart)} / ${gridColumnForStep(rowEndStep) + 1}`,
                    gridRow: "1",
                },
            });
            segmentStart = rowEndStep + 1;
        }

        return segments;
    };

    const stepNumberStyle = (step: number): CSSProperties => ({
        gridColumn: `${gridColumnForStep(step)}`,
        gridRow: `${gridRowForStep(step)}`,
    });

    return {
        blockSegments,
        cellsPerBar,
        cellStyle,
        stepNumberStyle,
        isAltBar: (step: number) => Math.floor(step / cellsPerBar) % 2 === 1,
    };
}

function formatValue(value: number) {
    if (Math.abs(value) >= 100) {
        return String(Math.round(value));
    }

    return Number(value.toFixed(3)).toString();
}

function clampNumber(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function formatTapeStopPercent(value: number) {
    return `${Math.round(value)}%`;
}

function formatTapeStopCurve(value: number) {
    return `${Number(value.toFixed(2))}`;
}

function formatTapeStopSpeed(value: number) {
    return `${Number(value.toFixed(value >= 2 ? 1 : 2))}x`;
}

function estimatedStepDurationMsForRateIndex(rateIndex: number) {
    const quarterNoteMsAt120Bpm = 500;
    const quarterNotesPerStep = rateIndex <= 0 ? 0.5 : rateIndex >= 2 ? 0.125 : 0.25;
    return quarterNoteMsAt120Bpm * quarterNotesPerStep;
}

function tapeGraphX(normalizedTime: number, plot: EditorCurvePlotRect) {
    return plot.plotLeft + (clampNumber(normalizedTime, 0, 1) * plot.plotWidth);
}

function tapeGraphY(speed: number, maxSpeed: number, plot: EditorCurvePlotRect) {
    const normalizedSpeed = clampNumber(speed / maxSpeed, 0, 1);
    return plot.plotBottom - (normalizedSpeed * plot.plotHeight);
}

function curvePowerFromSpeedRatio(speedRatio: number, base: number) {
    const safeRatio = clampNumber(speedRatio, 0.001, 0.999);
    const safeBase = clampNumber(base, 0.001, 0.999);

    return clampNumber(
        Math.log(safeRatio) / Math.log(safeBase),
        TAPE_STOP_MIN_CURVE,
        TAPE_STOP_MAX_CURVE,
    );
}

function TapeStopRangeControl({
    label,
    value,
    valueLabel,
    min,
    max,
    step,
    dataRole,
    hint,
    disabled = false,
    onChange,
    modulation = null,
    onModulationToggle = null,
    formatEndValue = formatValue,
    endDataRole,
}: {
    label: string;
    value: number;
    valueLabel: string;
    min: number;
    max: number;
    step: number;
    dataRole: string;
    hint: string;
    disabled?: boolean;
    onChange: (value: number) => void;
    modulation?: AuxModulatedParam | null;
    onModulationToggle?: (() => void) | null;
    formatEndValue?: (value: number) => string;
    endDataRole?: string;
}) {
    const isModulated = Boolean(modulation);

    return (
        <div className={`seqfx-tape-control${isModulated ? " seqfx-tape-control--modulated" : ""}`}>
            <div className="seqfx-tape-control__head">
                {onModulationToggle ? (
                    <button
                        aria-pressed={isModulated}
                        className="seqfx-tape-control__label seqfx-tape-control__label--toggle"
                        data-role={`${dataRole}-mod-toggle`}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onModulationToggle();
                        }}
                        type="button"
                    >
                        <span>{label}</span>
                        <ModBadge isOn={isModulated} direction={modulation?.direction} />
                    </button>
                ) : (
                    <span className="seqfx-tape-control__label">{label}</span>
                )}
                {isModulated ? (
                    <output className="seqfx-tape-control__values">
                        <span className="seqfx-tape-control__chip seqfx-tape-control__chip--start">{valueLabel}</span>
                        <span className="seqfx-tape-control__arrow">-&gt;</span>
                        <span className="seqfx-tape-control__chip seqfx-tape-control__chip--end">{formatEndValue(modulation!.end)}</span>
                    </output>
                ) : (
                    <output>{valueLabel}</output>
                )}
            </div>
            <input
                data-role={dataRole}
                disabled={disabled}
                max={max}
                min={min}
                onChange={(event) => onChange(Number(event.currentTarget.value))}
                onInput={(event) => onChange(Number(event.currentTarget.value))}
                step={step}
                type="range"
                value={value}
            />
            {isModulated ? (
                <input
                    aria-label={`${label} end`}
                    className="seqfx-tape-control__end"
                    data-role={endDataRole ?? `${dataRole}-end`}
                    disabled={disabled}
                    max={max}
                    min={min}
                    onChange={(event) => modulation!.onEndChange(Number(event.currentTarget.value))}
                    onInput={(event) => modulation!.onEndChange(Number(event.currentTarget.value))}
                    step={step}
                    type="range"
                    value={modulation!.end}
                />
            ) : null}
            <small>{hint}</small>
        </div>
    );
}

type TapeStopModulation = {
    startLength?: AuxModulatedParam | null;
    startCurve?: AuxModulatedParam | null;
    catchupCurve?: AuxModulatedParam | null;
    catchupLength?: AuxModulatedParam | null;
    mode?: AuxModulatedParam | null;
    onToggleStartLength?: () => void;
    onToggleStartCurve?: () => void;
    onToggleCatchupCurve?: () => void;
    onToggleCatchupLength?: () => void;
    onToggleMode?: () => void;
};

function TapeStopEnvelopeEditor({
    step,
    blockLength,
    blockDurationMs,
    onParamChange,
    modulation = null,
}: {
    step: SeqFxStep;
    blockLength: number;
    blockDurationMs: number;
    onParamChange: (paramIndex: number, value: number) => void;
    modulation?: TapeStopModulation | null;
}) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const dragModeRef = useRef<"startLength" | "startCurve" | "catchupLength" | "catchupCurve" | null>(null);
    const size = useEditorSurfaceSize(viewportRef);
    const plot = useMemo(() => createEditorCurvePlotRect(size.width, size.height, {
        topPaddingPx: EDITOR_PLOT_TOP_PADDING_PX,
        bottomPaddingPx: EDITOR_PLOT_BOTTOM_PADDING_PX,
    }), [size.height, size.width]);
    const mode = Math.round(step.params[4]) === TAPE_STOP_MODE_SPIN_UP
        ? TAPE_STOP_MODE_SPIN_UP
        : TAPE_STOP_MODE_STOP;
    const stopPointPercent = multiplierToStopPointPercent(step.params[0]);
    const curve = clampNumber(step.params[1], TAPE_STOP_MIN_CURVE, TAPE_STOP_MAX_CURVE);
    const catchupCurve = clampNumber(step.params[2], TAPE_STOP_MIN_CURVE, TAPE_STOP_MAX_CURVE);
    const catchupPercent = clampNumber(step.params[3], TAPE_STOP_MIN_CATCHUP_PERCENT, TAPE_STOP_MAX_CATCHUP_PERCENT);
    const envelope = useMemo(() => resolveTapeStopEnvelope({
        blockDurationMs,
        mode,
        stopPointPercent,
        curve,
        catchupPercent,
        catchupCurve,
    }), [blockDurationMs, catchupCurve, catchupPercent, curve, mode, stopPointPercent]);
    const maxGraphSpeed = 1;
    const graphPoints = useMemo(() => adaptiveSampleEditorCurve({
        evaluate: (normalizedTime) => ({
            x: normalizedTime,
            y: evaluateTapeStopDisplaySpeed(envelope, normalizedTime * envelope.blockDurationMs) / maxGraphSpeed,
        }),
        plot,
        tolerancePx: 0.5,
        maxDepth: 12,
    }), [envelope, plot]);
    const graphPath = polylineToSvgPath(graphPoints, 2);
    const fillPath = editorCurveFillPathToBaseline(graphPoints, plot, 2);
    const oneXLineY = normalizedCurvePointToPlotPoint({ x: 0, y: 1 }, plot).y;
    const stopPointVisible = envelope.stopPointPercent <= 100;
    const stopPointX = tapeGraphX(Math.min(1, envelope.stopPointPercent / 100), plot);
    const stopPointY = tapeGraphY(
        evaluateTapeStopDisplaySpeed(envelope, Math.min(envelope.stopPointMs, envelope.blockDurationMs)),
        maxGraphSpeed,
        plot,
    );
    const catchupStartX = tapeGraphX(envelope.catchupStartMs / envelope.blockDurationMs, plot);
    const catchupStartY = tapeGraphY(evaluateTapeStopDisplaySpeed(envelope, envelope.catchupStartMs), maxGraphSpeed, plot);
    const catchupWidth = plot.plotRight - catchupStartX;
    const curveHandleTimeMs = Math.max(1, Math.min(envelope.stopPointMs, envelope.blockDurationMs) * 0.5);
    const curveHandleX = tapeGraphX(curveHandleTimeMs / envelope.blockDurationMs, plot);
    const curveHandleY = tapeGraphY(evaluateTapeStopDisplaySpeed(envelope, curveHandleTimeMs), maxGraphSpeed, plot);
    const catchupCurveHandleTimeMs = envelope.catchupDurationMs > 0
        ? envelope.catchupStartMs + (envelope.catchupDurationMs * 0.5)
        : envelope.blockDurationMs;
    const catchupCurveHandleX = tapeGraphX(catchupCurveHandleTimeMs / envelope.blockDurationMs, plot);
    const catchupCurveHandleY = tapeGraphY(evaluateTapeStopDisplaySpeed(envelope, catchupCurveHandleTimeMs), maxGraphSpeed, plot);
    const requestedCatchupStartPercent = 100 - catchupPercent;
    const realizedCatchupStartPercent = Math.round((envelope.catchupStartMs / envelope.blockDurationMs) * 100);
    const catchupPushed = Math.round((envelope.catchupStartMs / envelope.blockDurationMs) * 100) > Math.round(requestedCatchupStartPercent);
    const modeLabel = mode === TAPE_STOP_MODE_SPIN_UP ? "Spin-up" : "Stop";
    const startLengthHint = mode === TAPE_STOP_MODE_SPIN_UP
        ? "Where the sound reaches normal speed."
        : "Where the slowdown reaches near-zero speed.";

    const graphPointFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const bounds = svgRef.current?.getBoundingClientRect();
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            return null;
        }

        return {
            x: ((event.clientX - bounds.left) / bounds.width) * size.width,
            y: ((event.clientY - bounds.top) / bounds.height) * size.height,
        };
    };

    const normalizedGraphXFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const point = graphPointFromPointer(event);
        if (!point) {
            return null;
        }

        return clampNumber(
            (point.x - plot.plotLeft) / plot.plotWidth,
            0,
            1,
        );
    };

    const speedRatioFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const point = graphPointFromPointer(event);
        if (!point) {
            return null;
        }

        const normalizedY = clampNumber(
            1 - ((point.y - plot.plotTop) / plot.plotHeight),
            TAPE_STOP_SPEED_FLOOR + 0.001,
            0.999,
        );
        const targetSpeed = normalizedY * maxGraphSpeed;

        return clampNumber(
            (targetSpeed - TAPE_STOP_SPEED_FLOOR) / (1 - TAPE_STOP_SPEED_FLOOR),
            0.001,
            0.999,
        );
    };

    const updateStartLengthFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const normalizedX = normalizedGraphXFromPointer(event);
        if (normalizedX === null) {
            return;
        }

        const nextStartPercent = clampNumber(
            normalizedX * 100,
            TAPE_STOP_MIN_STOP_POINT_PERCENT,
            100,
        );
        onParamChange(0, stopPointPercentToMultiplier(nextStartPercent));
    };

    const updateCatchupLengthFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        const normalizedX = normalizedGraphXFromPointer(event);
        if (normalizedX === null) {
            return;
        }

        const nextCatchupPercent = clampNumber(
            (1 - normalizedX) * 100,
            TAPE_STOP_MIN_CATCHUP_PERCENT,
            TAPE_STOP_MAX_CATCHUP_PERCENT,
        );
        const nextCatchupStartPercent = 100 - nextCatchupPercent;

        onParamChange(3, nextCatchupPercent);

        if (nextCatchupStartPercent < stopPointPercent && stopPointPercent <= 100) {
            onParamChange(0, stopPointPercentToMultiplier(Math.max(
                TAPE_STOP_MIN_STOP_POINT_PERCENT,
                nextCatchupStartPercent,
            )));
        }
    };

    const updateStartCurveFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        if (envelope.stopPointMs <= 1) {
            return;
        }

        const ratio = speedRatioFromPointer(event);
        if (ratio === null) {
            return;
        }

        const progress = clampNumber(curveHandleTimeMs / envelope.stopPointMs, 0.001, 0.999);
        const base = mode === TAPE_STOP_MODE_SPIN_UP ? progress : 1 - progress;
        onParamChange(1, curvePowerFromSpeedRatio(ratio, base));
    };

    const updateCatchupCurveFromPointer = (event: PointerEvent<SVGSVGElement>) => {
        if (envelope.catchupDurationMs <= 1) {
            return;
        }

        const ratio = speedRatioFromPointer(event);
        if (ratio === null) {
            return;
        }

        const progress = clampNumber(
            (catchupCurveHandleTimeMs - envelope.catchupStartMs) / envelope.catchupDurationMs,
            0.001,
            0.999,
        );
        onParamChange(2, curvePowerFromSpeedRatio(ratio, progress));
    };

    const updateDragFromPointer = (mode: NonNullable<typeof dragModeRef.current>, event: PointerEvent<SVGSVGElement>) => {
        if (mode === "startLength") {
            updateStartLengthFromPointer(event);
        } else if (mode === "startCurve") {
            updateStartCurveFromPointer(event);
        } else if (mode === "catchupLength") {
            updateCatchupLengthFromPointer(event);
        } else if (mode === "catchupCurve") {
            updateCatchupCurveFromPointer(event);
        }
    };

    const handleGraphPointerDown = (mode: NonNullable<typeof dragModeRef.current>) => (event: PointerEvent<SVGCircleElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragModeRef.current = mode;
        svgRef.current?.setPointerCapture(event.pointerId);
        updateDragFromPointer(mode, event as unknown as PointerEvent<SVGSVGElement>);
    };

    const handleGraphPointerMove = (event: PointerEvent<SVGSVGElement>) => {
        if (dragModeRef.current) {
            updateDragFromPointer(dragModeRef.current, event);
        }
    };

    const endGraphDrag = (event: PointerEvent<SVGSVGElement>) => {
        if (!dragModeRef.current) {
            return;
        }

        dragModeRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    return (
        <section className="seqfx-tape-editor" aria-label="Tape stop speed envelope">
            <div className="seqfx-tape-editor__panel">
                <div ref={viewportRef} className="seqfx-tape-editor__viewport">
                    <EditorCurveSurface
                        ref={svgRef}
                        className="seqfx-tape-graph"
                        dataRole="seqfx-tape-graph"
                        heightPx={size.height}
                        widthPx={size.width}
                        role="img"
                        ariaLabel="Tape stop speed graph"
                        onPointerMove={handleGraphPointerMove}
                        onPointerUp={endGraphDrag}
                        onPointerCancel={endGraphDrag}
                    >
                        <EditorCurvePlotArea className="seqfx-tape-graph-bg" plot={plot} />
                        {envelope.catchupDurationMs > 0 ? (
                            <rect
                                className="seqfx-tape-catchup-region"
                                x={catchupStartX}
                                y={plot.plotTop}
                                width={Math.max(0, catchupWidth)}
                                height={plot.plotHeight}
                            />
                        ) : null}
                        <line className="editor-curve-grid-line seqfx-tape-grid-line" x1={plot.plotLeft} x2={plot.plotRight} y1={oneXLineY} y2={oneXLineY} />
                        <EditorCurveAxis className="seqfx-tape-axis" x1={plot.plotLeft} x2={plot.plotRight} y1={plot.plotBottom} y2={plot.plotBottom} />
                        <EditorCurveFill className="seqfx-tape-graph-fill" data-role="seqfx-tape-graph-fill" d={fillPath} />
                        <EditorCurvePath className="seqfx-tape-graph-line" data-role="seqfx-tape-graph-line" d={graphPath} />
                        <line className="seqfx-tape-marker-line" x1={catchupStartX} x2={catchupStartX} y1={plot.plotTop} y2={plot.plotBottom} />
                        {stopPointVisible ? (
                            <EditorCurveHandle
                                aria-label="Start length handle"
                                className="seqfx-tape-handle seqfx-tape-length-handle"
                                data-role="seqfx-tape-start-length-handle"
                                cx={stopPointX}
                                cy={stopPointY}
                                r={EDITOR_RANGE_HANDLE_RADIUS_PX}
                                variant="secondary"
                                onPointerDown={handleGraphPointerDown("startLength")}
                            />
                        ) : (
                            <>
                                <path className="seqfx-tape-offscreen-marker" d={`M ${plot.plotRight - 7} ${plot.plotTop + 8} L ${plot.plotRight} ${plot.plotTop + 14} L ${plot.plotRight - 7} ${plot.plotTop + 20}`} />
                                <text className="seqfx-tape-graph-label" x={plot.plotRight - 54} y={plot.plotTop + 19}>{formatTapeStopPercent(stopPointPercent)}</text>
                            </>
                        )}
                        <EditorCurveHandle
                            className="seqfx-tape-handle seqfx-tape-curve-handle"
                            data-role="seqfx-tape-start-curve-handle"
                            aria-label="Start curve handle"
                            cx={curveHandleX}
                            cy={curveHandleY}
                            r={EDITOR_RANGE_HANDLE_RADIUS_PX}
                            onPointerDown={handleGraphPointerDown("startCurve")}
                        />
                        <EditorCurveHandle
                            aria-label="Catchup length handle"
                            className="seqfx-tape-handle seqfx-tape-length-handle"
                            data-role="seqfx-tape-catchup-length-handle"
                            cx={catchupStartX}
                            cy={catchupStartY}
                            r={EDITOR_RANGE_HANDLE_RADIUS_PX}
                            variant="secondary"
                            onPointerDown={handleGraphPointerDown("catchupLength")}
                        />
                        {envelope.catchupDurationMs > 0 ? (
                            <EditorCurveHandle
                                aria-label="Catchup curve handle"
                                className="seqfx-tape-handle seqfx-tape-curve-handle"
                                data-role="seqfx-tape-catchup-curve-handle"
                                cx={catchupCurveHandleX}
                                cy={catchupCurveHandleY}
                                r={EDITOR_RANGE_HANDLE_RADIUS_PX}
                                onPointerDown={handleGraphPointerDown("catchupCurve")}
                            />
                        ) : null}
                        <text className="seqfx-tape-graph-label" x={Math.max(4, plot.plotLeft - 24)} y={oneXLineY + 4}>1x</text>
                        <text className="seqfx-tape-graph-label" x={Math.max(4, plot.plotLeft - 24)} y={plot.plotBottom - 2}>0x</text>
                        <text className="seqfx-tape-graph-label" x={plot.plotLeft} y={size.height - 10}>0</text>
                        <text className="seqfx-tape-graph-label" x={plot.plotRight} y={size.height - 10} textAnchor="end">{blockLength} cell{blockLength === 1 ? "" : "s"}</text>
                    </EditorCurveSurface>
                </div>
            </div>
            <div className="seqfx-tape-readout">
                <span>Speed floor {formatTapeStopSpeed(TAPE_STOP_SPEED_FLOOR)}</span>
                <span>Start length {formatTapeStopPercent(stopPointPercent)}</span>
                <span>{catchupPushed ? `Catchup starts at ${realizedCatchupStartPercent}%` : `Catchup length ${formatTapeStopPercent(catchupPercent)}`}</span>
            </div>
            <div className={`seqfx-field seqfx-tape-mode-field${modulation?.mode ? " seqfx-tape-mode-field--modulated" : ""}`}>
                <span>
                    {modulation?.onToggleMode ? (
                        <button
                            aria-pressed={Boolean(modulation.mode)}
                            className="seqfx-tape-control__label seqfx-tape-control__label--toggle"
                            data-role="seqfx-tape-mode-mod-toggle"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                modulation.onToggleMode!();
                            }}
                            type="button"
                        >
                            <span>Mode</span>
                            <ModBadge isOn={Boolean(modulation.mode)} direction={modulation.mode?.direction} />
                        </button>
                    ) : (
                        "Mode"
                    )}
                    {modulation?.mode ? (
                        <output className="seqfx-tape-control__values">
                            <span className="seqfx-tape-control__chip seqfx-tape-control__chip--start">{modeLabel}</span>
                            <span className="seqfx-tape-control__arrow">-&gt;</span>
                            <span className="seqfx-tape-control__chip seqfx-tape-control__chip--end">
                                {Math.round(modulation.mode.end) === TAPE_STOP_MODE_SPIN_UP ? "Spin-up" : "Stop"}
                            </span>
                        </output>
                    ) : null}
                </span>
                <select
                    data-role="seqfx-tape-mode"
                    onChange={(event) => onParamChange(4, Number(event.currentTarget.value))}
                    value={mode}
                >
                    <option value={TAPE_STOP_MODE_STOP}>Stop</option>
                    <option value={TAPE_STOP_MODE_SPIN_UP}>Spin-up</option>
                </select>
                {modulation?.mode ? (
                    <select
                        aria-label="Mode end"
                        data-role="seqfx-tape-mode-end"
                        onChange={(event) => modulation.mode!.onEndChange(Number(event.currentTarget.value))}
                        value={Math.round(modulation.mode.end)}
                    >
                        <option value={TAPE_STOP_MODE_STOP}>Stop</option>
                        <option value={TAPE_STOP_MODE_SPIN_UP}>Spin-up</option>
                    </select>
                ) : null}
                <small>{modeLabel === "Spin-up" ? "Starts nearly stopped, then rises." : "Starts normal, then slows down."}</small>
            </div>
            <TapeStopRangeControl
                dataRole="seqfx-tape-stop-point"
                endDataRole="seqfx-tape-stop-point-end"
                label="Start Length"
                min={TAPE_STOP_MIN_STOP_POINT_PERCENT}
                max={TAPE_STOP_MAX_STOP_POINT_PERCENT}
                step={1}
                value={stopPointPercent}
                valueLabel={formatTapeStopPercent(stopPointPercent)}
                hint={startLengthHint}
                modulation={modulation?.startLength ? {
                    ...modulation.startLength,
                    end: multiplierToStopPointPercent(modulation.startLength.end),
                    onEndChange: (value) => modulation.startLength!.onEndChange(stopPointPercentToMultiplier(value)),
                } : null}
                onModulationToggle={modulation?.onToggleStartLength ?? null}
                formatEndValue={formatTapeStopPercent}
                onChange={(value) => onParamChange(0, stopPointPercentToMultiplier(value))}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-curve"
                endDataRole="seqfx-tape-curve-end"
                label="Start Curve"
                min={TAPE_STOP_MIN_CURVE}
                max={TAPE_STOP_MAX_CURVE}
                step={0.01}
                value={curve}
                valueLabel={formatTapeStopCurve(curve)}
                hint="Bends the first part of the curve."
                modulation={modulation?.startCurve ?? null}
                onModulationToggle={modulation?.onToggleStartCurve ?? null}
                formatEndValue={formatTapeStopCurve}
                onChange={(value) => onParamChange(1, value)}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-catchup"
                endDataRole="seqfx-tape-catchup-end"
                label="Catchup Length"
                min={TAPE_STOP_MIN_CATCHUP_PERCENT}
                max={TAPE_STOP_MAX_CATCHUP_PERCENT}
                step={1}
                value={catchupPercent}
                valueLabel={formatTapeStopPercent(catchupPercent)}
                hint="How much of the block end is reserved for syncing back."
                modulation={modulation?.catchupLength ?? null}
                onModulationToggle={modulation?.onToggleCatchupLength ?? null}
                formatEndValue={formatTapeStopPercent}
                onChange={(value) => onParamChange(3, value)}
            />
            <TapeStopRangeControl
                dataRole="seqfx-tape-catchup-curve"
                endDataRole="seqfx-tape-catchup-curve-end"
                label="Catchup Curve"
                min={TAPE_STOP_MIN_CURVE}
                max={TAPE_STOP_MAX_CURVE}
                step={0.01}
                value={catchupCurve}
                valueLabel={formatTapeStopCurve(catchupCurve)}
                hint="Bends the return ramp."
                modulation={modulation?.catchupCurve ?? null}
                onModulationToggle={modulation?.onToggleCatchupCurve ?? null}
                formatEndValue={formatTapeStopCurve}
                onChange={(value) => onParamChange(2, value)}
            />
        </section>
    );
}

const TAPE_STOP_SYNC_LABELS = ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars", "1 Cell"] as const;

function tapeStopCurveLabel(value: number) {
    if (value < -0.08) {
        return `Early brake ${Math.round(Math.abs(value) * 100)}%`;
    }
    if (value > 0.08) {
        return `Late brake ${Math.round(value * 100)}%`;
    }
    return "Linear";
}

function tapeStopTrajectoryPath(curve: number, returnMode: number) {
    const power = Math.pow(4, clampNumber(curve, -1, 1));
    const points: string[] = [];
    const stopEnd = returnMode === TAPE_STOP_RETURN_SPIN_UP ? 0.62 : 0.9;

    for (let index = 0; index <= 24; index += 1) {
        const phase = index / 24;
        let speed = 0;
        if (phase <= stopEnd) {
            speed = Math.pow(Math.max(0, 1 - (phase / stopEnd)), power);
        } else if (returnMode === TAPE_STOP_RETURN_SPIN_UP) {
            speed = Math.pow((phase - stopEnd) / (1 - stopEnd), 1 / power);
        } else {
            speed = Math.pow((phase - stopEnd) / (1 - stopEnd), 3);
        }
        const x = 12 + (phase * 336);
        const y = 78 - (clampNumber(speed, 0, 1) * 62);
        points.push(`${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    return points.join(" ");
}

function TapeStopV2Editor({
    step,
    disabled,
    onParamChange,
}: {
    step: SeqFxStep;
    disabled: boolean;
    onParamChange: (paramIndex: number, value: number) => void;
}) {
    const stopDivision = Math.round(step.params[TAPE_STOP_PARAM_STOP_DIVISION] ?? 8);
    const curve = clampNumber(step.params[TAPE_STOP_PARAM_CURVE] ?? 0, -1, 1);
    const returnMode = Math.round(step.params[TAPE_STOP_PARAM_RETURN] ?? TAPE_STOP_RETURN_CATCH_UP);
    const startDivision = Math.round(step.params[TAPE_STOP_PARAM_START_DIVISION] ?? 1);
    const character = clampNumber(step.params[TAPE_STOP_PARAM_CHARACTER] ?? 0, 0, 1);
    const timing = Math.round(step.params[TAPE_STOP_PARAM_TIMING] ?? TAPE_STOP_TIMING_SYNC);
    const freeStopMs = clampNumber(step.params[TAPE_STOP_PARAM_FREE_STOP_MS] ?? 500, 20, 8_000);
    const freeStartMs = clampNumber(step.params[TAPE_STOP_PARAM_FREE_START_MS] ?? 125, 20, 8_000);
    const spinUp = returnMode === TAPE_STOP_RETURN_SPIN_UP;
    const freeTiming = timing === TAPE_STOP_TIMING_FREE;
    const stopLabel = freeTiming ? `${Math.round(freeStopMs)} ms` : TAPE_STOP_SYNC_LABELS[stopDivision] ?? "1 Cell";
    const startLabel = freeTiming ? `${Math.round(freeStartMs)} ms` : TAPE_STOP_SYNC_LABELS[startDivision] ?? "1/16";

    return (
        <section className="seqfx-tape-v2" data-role="seqfx-tape-v2-editor" aria-label="Tape Stop controls">
            <div className="seqfx-tape-v2__trajectory">
                <div className="seqfx-tape-v2__trajectory-head">
                    <span>Motor speed</span>
                    <strong>{stopLabel} · {spinUp ? `Spin Up ${startLabel}` : "Catch Up"}</strong>
                </div>
                <svg
                    aria-label={`Tape slows over ${stopLabel}, then ${spinUp ? `spins up over ${startLabel}` : "catches up"}`}
                    data-role="seqfx-tape-v2-trajectory"
                    role="img"
                    viewBox="0 0 360 92"
                >
                    <line className="seqfx-tape-v2__axis" x1="12" x2="348" y1="78" y2="78" />
                    <line className="seqfx-tape-v2__guide" x1="12" x2="348" y1="16" y2="16" />
                    <path
                        className="seqfx-tape-v2__curve"
                        data-role="seqfx-tape-v2-curve"
                        d={tapeStopTrajectoryPath(curve, returnMode)}
                    />
                    <text className="seqfx-tape-v2__axis-label" x="12" y="12">1x</text>
                    <text className="seqfx-tape-v2__axis-label" x="12" y="90">0x</text>
                </svg>
                <p>The block triggers the motor. The captured gesture keeps running until its return completes.</p>
            </div>

            <div className="seqfx-tape-v2__controls">
                <label className="seqfx-tape-v2-control">
                    <span>Timing <em>Trigger</em></span>
                    <select
                        aria-label="Tape Stop timing"
                        data-control="seqfx-tape-timing"
                        data-param={TAPE_STOP_PARAM_TIMING}
                        data-role="seqfx-param"
                        disabled={disabled}
                        onChange={(event) => onParamChange(TAPE_STOP_PARAM_TIMING, Number(event.currentTarget.value))}
                        value={timing}
                    >
                        <option value={TAPE_STOP_TIMING_SYNC}>Sync</option>
                        <option value={TAPE_STOP_TIMING_FREE}>Free</option>
                    </select>
                    <small>{freeTiming ? "Milliseconds stay fixed when tempo changes." : "The duration is latched from tempo at the trigger."}</small>
                </label>

                <label className="seqfx-tape-v2-control">
                    <span>Stop Time <em>Trigger</em></span>
                    {freeTiming ? (
                        <input
                            aria-label="Tape Stop free stop time in milliseconds"
                            data-control="seqfx-tape-stop-time"
                            data-param={TAPE_STOP_PARAM_FREE_STOP_MS}
                            data-role="seqfx-param"
                            disabled={disabled}
                            max={8_000}
                            min={20}
                            onChange={(event) => onParamChange(TAPE_STOP_PARAM_FREE_STOP_MS, Number(event.currentTarget.value))}
                            step={1}
                            type="number"
                            value={Math.round(freeStopMs)}
                        />
                    ) : (
                        <select
                            aria-label="Tape Stop synced stop time"
                            data-control="seqfx-tape-stop-time"
                            data-param={TAPE_STOP_PARAM_STOP_DIVISION}
                            data-role="seqfx-param"
                            disabled={disabled}
                            onChange={(event) => onParamChange(TAPE_STOP_PARAM_STOP_DIVISION, Number(event.currentTarget.value))}
                            value={stopDivision}
                        >
                            {TAPE_STOP_SYNC_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}
                        </select>
                    )}
                    <small>How long the captured audio takes to reach a stop.</small>
                </label>

                <label className="seqfx-tape-v2-control seqfx-tape-v2-control--wide">
                    <span>Curve <em>Trigger</em><output>{tapeStopCurveLabel(curve)}</output></span>
                    <input
                        aria-label="Tape Stop brake curve"
                        data-control="seqfx-tape-curve"
                        data-param={TAPE_STOP_PARAM_CURVE}
                        data-role="seqfx-param"
                        disabled={disabled}
                        max={1}
                        min={-1}
                        onChange={(event) => onParamChange(TAPE_STOP_PARAM_CURVE, Number(event.currentTarget.value))}
                        step={0.01}
                        type="range"
                        value={curve}
                    />
                    <small>Move the braking weight earlier or later without changing Stop Time.</small>
                </label>

                <label className="seqfx-tape-v2-control">
                    <span>Return <em>Trigger</em></span>
                    <select
                        aria-label="Tape Stop return behavior"
                        data-control="seqfx-tape-return"
                        data-param={TAPE_STOP_PARAM_RETURN}
                        data-role="seqfx-param"
                        disabled={disabled}
                        onChange={(event) => onParamChange(TAPE_STOP_PARAM_RETURN, Number(event.currentTarget.value))}
                        value={returnMode}
                    >
                        <option value={TAPE_STOP_RETURN_CATCH_UP}>Catch Up</option>
                        <option value={TAPE_STOP_RETURN_SPIN_UP}>Spin Up</option>
                    </select>
                    <small>{spinUp ? "Accelerates the captured audio, then crossfades to live input." : "Returns to live input with a short click-safe crossfade."}</small>
                </label>

                {spinUp ? (
                    <label className="seqfx-tape-v2-control">
                        <span>Start Time <em>Trigger</em></span>
                        {freeTiming ? (
                            <input
                                aria-label="Tape Stop free start time in milliseconds"
                                data-control="seqfx-tape-start-time"
                                data-param={TAPE_STOP_PARAM_FREE_START_MS}
                                data-role="seqfx-param"
                                disabled={disabled}
                                max={8_000}
                                min={20}
                                onChange={(event) => onParamChange(TAPE_STOP_PARAM_FREE_START_MS, Number(event.currentTarget.value))}
                                step={1}
                                type="number"
                                value={Math.round(freeStartMs)}
                            />
                        ) : (
                            <select
                                aria-label="Tape Stop synced start time"
                                data-control="seqfx-tape-start-time"
                                data-param={TAPE_STOP_PARAM_START_DIVISION}
                                data-role="seqfx-param"
                                disabled={disabled}
                                onChange={(event) => onParamChange(TAPE_STOP_PARAM_START_DIVISION, Number(event.currentTarget.value))}
                                value={startDivision}
                            >
                                {TAPE_STOP_SYNC_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}
                            </select>
                        )}
                        <small>How long the motor takes to return to normal speed.</small>
                    </label>
                ) : null}

                <label className="seqfx-tape-v2-control seqfx-tape-v2-control--wide">
                    <span>Character <em>Trigger</em><output>{Math.round(character * 100)}%</output></span>
                    <input
                        aria-label="Tape Stop character"
                        data-control="seqfx-tape-character"
                        data-param={TAPE_STOP_PARAM_CHARACTER}
                        data-role="seqfx-param"
                        disabled={disabled}
                        max={1}
                        min={0}
                        onChange={(event) => onParamChange(TAPE_STOP_PARAM_CHARACTER, Number(event.currentTarget.value))}
                        step={0.01}
                        type="range"
                        value={character}
                    />
                    <small>Adds speed-linked high-frequency loss and bounded saturation.</small>
                </label>
            </div>
            {disabled ? <p className="seqfx-tape-v2__disabled">Select one trigger or a complete block to edit this gesture.</p> : null}
        </section>
    );
}

function selectionFromCell(cell: SelectedCell | null): Selection | null {
    return cell ? { lane: cell.lane, steps: [cell.step] } : null;
}

function mergeRangeSelection(anchor: SelectedCell, target: SelectedCell): Selection {
    const start = Math.min(anchor.step, target.step);
    const end = Math.max(anchor.step, target.step);

    return {
        lane: anchor.lane,
        steps: Array.from({ length: end - start + 1 }, (_unused, index) => start + index),
    };
}

function selectionFromBlockStarts(pattern: SeqFxPattern, lane: number, blockStartSteps: number[]): Selection | null {
    const starts = [...new Set(blockStartSteps)].sort((left, right) => left - right);
    const steps = new Set<number>();
    const resolvedStarts: number[] = [];

    for (const startStep of starts) {
        const block = getSeqFxBlockAtStep(pattern, lane, startStep);
        if (!block || block.startStep !== startStep) {
            continue;
        }

        resolvedStarts.push(block.startStep);
        for (let step = block.startStep; step <= block.endStep; step += 1) {
            steps.add(step);
        }
    }

    if (resolvedStarts.length === 0) {
        return null;
    }

    return {
        lane,
        steps: [...steps].sort((left, right) => left - right),
        blockStartSteps: resolvedStarts,
    };
}

function blockStartsBetween(pattern: SeqFxPattern, lane: number, startStep: number, endStep: number): number[] {
    const rangeStart = Math.min(startStep, endStep);
    const rangeEnd = Math.max(startStep, endStep);

    return getSeqFxLaneBlocks(pattern, lane)
        .filter((block) => block.startStep >= rangeStart && block.startStep <= rangeEnd)
        .map((block) => block.startStep);
}

function selectionAnchorDragBounds(pattern: SeqFxPattern, lane: number, blockStartSteps: number[], anchorStartStep: number) {
    const blocks = blockStartSteps
        .map((startStep) => getSeqFxBlockAtStep(pattern, lane, startStep))
        .filter((block): block is SeqFxBlock => Boolean(block));

    if (blocks.length === 0) {
        return {
            minStartStep: 0,
            maxStartStep: SEQFX_STEP_COUNT - 1,
        };
    }

    const minDelta = Math.min(...blocks.map((block) => block.startStep - anchorStartStep));
    const maxEndDelta = Math.max(...blocks.map((block) => block.endStep - anchorStartStep));

    return {
        minStartStep: Math.max(0, -minDelta),
        maxStartStep: Math.min(SEQFX_STEP_COUNT - 1, SEQFX_STEP_COUNT - 1 - maxEndDelta),
    };
}

function getSelectionLabel(selection: Selection | null) {
    if (!selection) {
        return "Select a cell";
    }

    const blockStartSteps = selection.blockStartSteps ?? [];
    if (blockStartSteps.length > 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]} blocks ${blockStartSteps.map((step) => step + 1).join(", ")}`;
    }

    if (selection.steps.length === 1) {
        return `${SEQFX_LANE_NAMES[selection.lane]} step ${selection.steps[0] + 1}`;
    }

    return `${SEQFX_LANE_NAMES[selection.lane]} steps ${selection.steps[0] + 1}-${selection.steps.at(-1)! + 1}`;
}

function clampBlockStart(startStep: number, length: number) {
    return Math.min(SEQFX_STEP_COUNT - length, Math.max(0, startStep));
}

function isEditableElement(element: Element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        return true;
    }

    if (element instanceof HTMLInputElement) {
        const inputType = element.type.toLowerCase();
        return inputType !== "button"
            && inputType !== "checkbox"
            && inputType !== "radio"
            && inputType !== "range"
            && inputType !== "reset"
            && inputType !== "submit";
    }

    return (element instanceof HTMLElement && element.isContentEditable)
        || Boolean(element.closest('[contenteditable="true"], [role="textbox"]'));
}

function isEditableKeyboardEvent(event: globalThis.KeyboardEvent) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    return path.some((target) => target instanceof Element && isEditableElement(target));
}

function isEditableClipboardEvent(event: ClipboardEvent) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    return path.some((target) => target instanceof Element && isEditableElement(target));
}

function describeEventTarget(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) {
        return "non-element";
    }

    const tagName = target.tagName.toLowerCase();
    const role = target.getAttribute("data-role") ?? target.getAttribute("role") ?? "";
    const slot = target.getAttribute("data-slot") ?? "";
    const suffix = [role ? `role=${role}` : "", slot ? `slot=${slot}` : ""].filter(Boolean).join(" ");
    return suffix ? `${tagName} ${suffix}` : tagName;
}

function SeqFxPresetBarHost({
    bridge,
    patchConnection,
}: {
    bridge: SeqFxRuntimeBridge;
    patchConnection: PatchConnectionLike;
}) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const storedStateAdapter = useMemo(() => createSeqFxPresetStateAdapter({
        bridge,
        patchConnection,
    }), [bridge, patchConnection]);
    const presetController = useMemo(() => createStandaloneEffectPresetController({
        effectID: "seqfx",
        patchConnection,
        storedStateAdapters: [storedStateAdapter],
        presetMigrations: createSeqFxPresetMigrations,
    }), [patchConnection, storedStateAdapter]);
    const snapshotController = useMemo(() => new EffectSnapshotBankController({
        effectID: "seqfx",
        patchConnection,
        storedStateAdapters: [storedStateAdapter],
        snapshotMigrations: createSeqFxSnapshotMigrations,
    }), [patchConnection, storedStateAdapter]);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        const effectHeader = createEffectHeader();
        effectHeader.presetController = presetController;
        effectHeader.snapshotController = snapshotController;
        host.replaceChildren(effectHeader);
        snapshotController.attach();
        presetController.attach();

        return () => {
            presetController.detach();
            snapshotController.detach();
            effectHeader.presetController = null;
            effectHeader.snapshotController = null;
            effectHeader.remove();
        };
    }, [presetController, snapshotController]);

    return <div className="seqfx-preset-row" ref={hostRef} />;
}

export type SeqFxPromoControls = {
    state?: SeqFxState;
    selectedPattern?: number;
    rateIndex?: number;
    selectedCell?: SelectedCell | null;
    selection?: Selection | null;
    playheadStep?: number | null;
    inspectorMode?: InspectorMode;
    auxMonitor?: AuxMonitorState;
    hidePresetBar?: boolean;
};

export function SeqFxPatchView({
    patchConnection,
    promoControls,
}: {
    patchConnection: PatchConnectionLike;
    promoControls?: SeqFxPromoControls;
}) {
    const bridge = useMemo(() => new SeqFxRuntimeBridge(patchConnection), [patchConnection]);
    const [runtimeState, setState] = useState<SeqFxState>(() => bridge.getState());
    const [runtimeSelectedPattern, setSelectedPattern] = useState(() => bridge.getSelectedPatternIndex());
    const [runtimeRateIndex, setRateIndex] = useState(() => bridge.getRateIndex());
    const [runtimeSelectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [runtimeSelection, setSelection] = useState<Selection | null>(null);
    const [runtimePlayheadStep, setPlayheadStep] = useState<number | null>(null);
    const [observedStepDurationMs, setObservedStepDurationMs] = useState<number | null>(null);
    const [runtimeAuxMonitor, setAuxMonitor] = useState<AuxMonitorState>(() => ({
        cyclePhase: Array.from({ length: 4 }, () => 0),
        amount: Array.from({ length: 4 }, () => 0),
        durationMs: Array.from({ length: 4 }, () => 0),
    }));
    const [drawEffectType, setDrawEffectType] = useState<SeqFxEffectType | null>(null);
    const [runtimeInspectorMode, setInspectorMode] = useState<InspectorMode>("effect");
    const [gestureState, setGestureState] = useState<BlockGesture | null>(null);
    const [patternPreview, setPatternPreview] = useState<PatternPreview | null>(null);
    const [invalidDropTarget, setInvalidDropTarget] = useState<InvalidDropTarget | null>(null);
    const isPromoControlled = Boolean(promoControls);
    const state = isPromoControlled ? promoControls?.state ?? runtimeState : runtimeState;
    const selectedPattern = isPromoControlled ? promoControls?.selectedPattern ?? runtimeSelectedPattern : runtimeSelectedPattern;
    const rateIndex = isPromoControlled ? promoControls?.rateIndex ?? runtimeRateIndex : runtimeRateIndex;
    const selectedCell = isPromoControlled && promoControls && Object.prototype.hasOwnProperty.call(promoControls, "selectedCell")
        ? promoControls.selectedCell ?? null
        : runtimeSelectedCell;
    const selection = isPromoControlled && promoControls && Object.prototype.hasOwnProperty.call(promoControls, "selection")
        ? promoControls.selection ?? null
        : runtimeSelection;
    const playheadStep = isPromoControlled && promoControls && Object.prototype.hasOwnProperty.call(promoControls, "playheadStep")
        ? promoControls.playheadStep ?? null
        : runtimePlayheadStep;
    const auxMonitor = isPromoControlled ? promoControls?.auxMonitor ?? runtimeAuxMonitor : runtimeAuxMonitor;
    const inspectorMode = isPromoControlled ? promoControls?.inspectorMode ?? runtimeInspectorMode : runtimeInspectorMode;
    const cellsPerBeat = useMemo(() => cellsPerBeatForRateIndex(rateIndex), [rateIndex]);
    const gridGeometry = useMemo(() => createGridGeometry(cellsPerBeat), [cellsPerBeat]);
    const gridShellClassName = `seqfx-grid-shell seqfx-grid--beat-${cellsPerBeat}`;
    const laneTrackRefs = useRef(new Map<string, { lane: number; node: HTMLDivElement }>());
    const cellRefs = useRef(new Map<string, HTMLDivElement>());
    const gestureRef = useRef<BlockGesture | null>(null);
    const optionKeyRef = useRef(false);
    const rateIndexRef = useRef(rateIndex);
    const stateRef = useRef(state);
    const selectedPatternRef = useRef(selectedPattern);
    const selectedCellRef = useRef<SelectedCell | null>(selectedCell);
    const activeSelectionRef = useRef<Selection | null>(null);
    const cellClipboardRef = useRef<SeqFxStepValueSnapshot | null>(null);
    const liveEditPointerIdRef = useRef<number | null>(null);

    rateIndexRef.current = rateIndex;
    stateRef.current = state;
    selectedPatternRef.current = selectedPattern;
    selectedCellRef.current = selectedCell;

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        bridge.attach();
        const unsubscribeState = bridge.subscribe((nextState) => {
            setState(nextState);
            setSelectedPattern(bridge.getSelectedPatternIndex());
        });
        const unsubscribeMonitor = bridge.subscribeMonitor((monitor) => {
            const event = (monitor as { event?: unknown })?.event ?? monitor;
            const stepIndex = Number((event as { stepIndex?: unknown })?.stepIndex);
            const stepDurationMs = Number((event as { stepDurationMs?: unknown })?.stepDurationMs);
            const auxCyclePhase = (event as { auxCyclePhase?: unknown })?.auxCyclePhase;
            const auxAmount = (event as { auxAmount?: unknown })?.auxAmount;
            const auxDurationMs = (event as { auxDurationMs?: unknown })?.auxDurationMs;
            setPlayheadStep(Number.isFinite(stepIndex) ? stepIndex : null);
            if (Number.isFinite(stepDurationMs) && stepDurationMs > 0) {
                setObservedStepDurationMs(stepDurationMs);
            }
            if (Array.isArray(auxCyclePhase) || Array.isArray(auxAmount) || Array.isArray(auxDurationMs)) {
                setAuxMonitor({
                    cyclePhase: Array.from({ length: 4 }, (_unused, index) => {
                        const value = Number(Array.isArray(auxCyclePhase) ? auxCyclePhase[index] : 0);
                        return Number.isFinite(value) ? clampNumber(value, 0, 1) : 0;
                    }),
                    amount: Array.from({ length: 4 }, (_unused, index) => {
                        const value = Number(Array.isArray(auxAmount) ? auxAmount[index] : 0);
                        return Number.isFinite(value) ? clampNumber(value, 0, 1) : 0;
                    }),
                    durationMs: Array.from({ length: 4 }, (_unused, index) => {
                        const value = Number(Array.isArray(auxDurationMs) ? auxDurationMs[index] : 0);
                        return Number.isFinite(value) ? Math.max(0, value) : 0;
                    }),
                });
            }
        });
        const unsubscribeRate = bridge.subscribeRate((nextRateIndex) => {
            if (rateIndexRef.current !== nextRateIndex) {
                gestureRef.current = null;
                setGestureState(null);
                setPatternPreview(null);
                setInvalidDropTarget(null);
            }
            rateIndexRef.current = nextRateIndex;
            setRateIndex(nextRateIndex);
        });
        bridge.requestBootState();

        return () => {
            unsubscribeState();
            unsubscribeMonitor();
            unsubscribeRate();
            bridge.detach();
        };
    }, [bridge, isPromoControlled]);

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Alt") {
                optionKeyRef.current = true;
            }
        };
        const handleKeyUp = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Alt") {
                optionKeyRef.current = false;
            }
        };
        const clearOptionKey = () => {
            optionKeyRef.current = false;
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", clearOptionKey);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", clearOptionKey);
        };
    }, [isPromoControlled]);

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        const commitLiveEditForPointer = (event: globalThis.PointerEvent) => {
            if (liveEditPointerIdRef.current !== event.pointerId) {
                return;
            }

            liveEditPointerIdRef.current = null;
            bridge.commitLiveEdit();
        };
        const commitLiveEditForWindow = () => {
            if (liveEditPointerIdRef.current === null) {
                return;
            }

            liveEditPointerIdRef.current = null;
            bridge.commitLiveEdit();
        };

        window.addEventListener("pointerup", commitLiveEditForPointer);
        window.addEventListener("pointercancel", commitLiveEditForPointer);
        window.addEventListener("blur", commitLiveEditForWindow);

        return () => {
            window.removeEventListener("pointerup", commitLiveEditForPointer);
            window.removeEventListener("pointercancel", commitLiveEditForPointer);
            window.removeEventListener("blur", commitLiveEditForWindow);
            commitLiveEditForWindow();
        };
    }, [bridge, isPromoControlled]);

    useEffect(() => {
        if (isPromoControlled) {
            return;
        }

        const copySelectedCellValues = () => {
            const activeSelection = activeSelectionRef.current;
            if (!activeSelection || activeSelection.steps.length === 0) {
                return null;
            }

            const selectedCell = selectedCellRef.current;
            const sourceStep = selectedCell?.lane === activeSelection.lane
                && activeSelection.steps.includes(selectedCell.step)
                ? selectedCell.step
                : activeSelection.steps[0];

            const copiedValues = bridge.copyStepValues({
                patternIndex: selectedPatternRef.current,
                lane: activeSelection.lane,
                step: sourceStep,
            });
            cellClipboardRef.current = copiedValues;
            return copiedValues;
        };

        const pasteSelectedCellValues = () => {
            const activeSelection = activeSelectionRef.current;
            const copiedValues = cellClipboardRef.current;
            if (
                !activeSelection
                || activeSelection.steps.length === 0
                || !copiedValues
            ) {
                return false;
            }

            bridge.pasteStepValues({
                patternIndex: selectedPatternRef.current,
                lane: activeSelection.lane,
                steps: activeSelection.steps,
                values: copiedValues,
            });
            return true;
        };

        const handleClipboardKeyDown = (event: globalThis.KeyboardEvent) => {
            if (!event.metaKey || event.altKey || event.ctrlKey) {
                return;
            }

            const key = event.key.toLowerCase();
            if (key !== "c" && key !== "v") {
                return;
            }

            if (isEditableKeyboardEvent(event)) {
                return;
            }

            if (key === "c") {
                if (copySelectedCellValues()) {
                    event.preventDefault();
                }
                return;
            }

            if (pasteSelectedCellValues()) {
                event.preventDefault();
            }
        };

        const handleCopyEvent = (event: ClipboardEvent) => {
            if (isEditableClipboardEvent(event)) {
                return;
            }

            if (copySelectedCellValues()) {
                event.preventDefault();
            }
        };

        const handlePasteEvent = (event: ClipboardEvent) => {
            if (isEditableClipboardEvent(event)) {
                return;
            }

            if (pasteSelectedCellValues()) {
                event.preventDefault();
            }
        };

        window.addEventListener("keydown", handleClipboardKeyDown);
        window.addEventListener("copy", handleCopyEvent);
        window.addEventListener("paste", handlePasteEvent);

        return () => {
            window.removeEventListener("keydown", handleClipboardKeyDown);
            window.removeEventListener("copy", handleCopyEvent);
            window.removeEventListener("paste", handlePasteEvent);
        };
    }, [bridge, isPromoControlled]);

    function stepAtClientPointForLane(lane: number, clientX: number, clientY: number) {
        const rects = STEP_NUMBERS
            .map((step) => {
                const cell = cellRefs.current.get(cellRefKey(lane, step));
                return cell ? { step, rect: cell.getBoundingClientRect() } : null;
            })
            .filter((entry): entry is { step: number; rect: DOMRect } => Boolean(entry));

        if (rects.length === 0) {
            return null;
        }

        const containingCell = rects.find(({ rect }) => (
            clientX >= rect.left
            && clientX <= rect.right
            && clientY >= rect.top
            && clientY <= rect.bottom
        ));
        if (containingCell) {
            return containingCell.step;
        }

        const closestToPointer = rects.reduce((closest, current) => {
            const currentCenterY = current.rect.top + (current.rect.height / 2);
            const closestCenterY = closest.rect.top + (closest.rect.height / 2);
            return Math.abs(clientY - currentCenterY) < Math.abs(clientY - closestCenterY)
                ? current
                : closest;
        }, rects[0]);
        const targetCenterY = closestToPointer.rect.top + (closestToPointer.rect.height / 2);
        const rowRects = rects
            .filter(({ rect }) => Math.abs((rect.top + (rect.height / 2)) - targetCenterY) <= 1)
            .sort((left, right) => left.rect.left - right.rect.left);

        const first = rowRects[0];
        const last = rowRects[rowRects.length - 1];
        if (clientX <= first.rect.left) {
            return first.step;
        }
        if (clientX >= last.rect.right) {
            return last.step;
        }

        for (let index = 0; index < rowRects.length; index += 1) {
            const current = rowRects[index];
            if (clientX >= current.rect.left && clientX <= current.rect.right) {
                return current.step;
            }

            const next = rowRects[index + 1];
            if (next && clientX > current.rect.right && clientX < next.rect.left) {
                const midpoint = current.rect.right + ((next.rect.left - current.rect.right) / 2);
                return clientX < midpoint ? current.step : next.step;
            }
        }

        return last.step;
    }

    useEffect(() => {
        const pointerStepForLane = (lane: number, event: globalThis.PointerEvent) => {
            return stepAtClientPointForLane(lane, event.clientX, event.clientY);
        };

        const targetLaneForPointer = (event: globalThis.PointerEvent, fallbackLane: number) => {
            const laneEntries = [...laneTrackRefs.current.values()]
                .sort((left, right) => {
                    const leftBounds = left.node.getBoundingClientRect();
                    const rightBounds = right.node.getBoundingClientRect();
                    return leftBounds.top - rightBounds.top || left.lane - right.lane;
                });

            if (laneEntries.length === 0) {
                return fallbackLane;
            }

            let closestLane = fallbackLane;
            let closestDistance = Number.POSITIVE_INFINITY;

            for (const { lane, node } of laneEntries) {
                const bounds = node.getBoundingClientRect();
                if (event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
                    return lane;
                }

                const centerY = bounds.top + (bounds.height / 2);
                const distance = Math.abs(event.clientY - centerY);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestLane = lane;
                }
            }

            return closestLane;
        };

        const selectBlockRange = (lane: number, startStep: number, length: number) => {
            setSelectedCell({ lane, step: startStep });
            setSelection({
                lane,
                steps: Array.from({ length }, (_unused, index) => startStep + index),
                blockStartSteps: [startStep],
            });
        };

        const targetStartFromPointer = (gesture: MoveGesture | CopyGesture, event: globalThis.PointerEvent) => {
            const targetLane = targetLaneForPointer(event, gesture.previewTargetLane ?? gesture.lane);
            const pointerStep = pointerStepForLane(targetLane, event);
            if (pointerStep === null) {
                return null;
            }

            return {
                lane: targetLane,
                startStep: clampBlockStart(pointerStep - gesture.grabOffset, gesture.length),
            };
        };

        const targetAnchorStartFromPointer = (gesture: BlockSelectionMoveGesture | BlockSelectionCopyGesture, event: globalThis.PointerEvent) => {
            const targetLane = targetLaneForPointer(event, gesture.previewTargetLane ?? gesture.lane);
            const pointerStep = pointerStepForLane(targetLane, event);
            if (pointerStep === null) {
                return null;
            }

            return {
                lane: targetLane,
                startStep: Math.min(
                    gesture.anchorMaxStartStep,
                    Math.max(gesture.anchorMinStartStep, pointerStep - gesture.grabOffset),
                ),
            };
        };

        const setInvalidSingleDrop = (lane: number, startStep: number, length: number) => {
            setInvalidDropTarget({
                patternIndex: selectedPatternRef.current,
                lane,
                blocks: [{ startStep, length }],
            });
        };

        const setInvalidSelectionDrop = (sourceLane: number, targetLane: number, blockStartSteps: number[], anchorStartStep: number, targetAnchorStartStep: number) => {
            const pattern = stateRef.current.patterns[selectedPatternRef.current];
            const delta = targetAnchorStartStep - anchorStartStep;
            setInvalidDropTarget({
                patternIndex: selectedPatternRef.current,
                lane: targetLane,
                blocks: blockStartSteps
                    .map((sourceStartStep) => getSeqFxBlockAtStep(pattern, sourceLane, sourceStartStep))
                    .filter((block): block is SeqFxBlock => Boolean(block))
                    .map((block) => ({
                        startStep: clampBlockStart(block.startStep + delta, block.length),
                        length: block.length,
                    })),
            });
        };

        const gestureMovedEnough = (gesture: MoveGesture | CopyGesture | BlockSelectionMoveGesture | BlockSelectionCopyGesture, event: globalThis.PointerEvent) => {
            const deltaX = event.clientX - gesture.pointerStartX;
            const deltaY = event.clientY - gesture.pointerStartY;
            return (deltaX * deltaX) + (deltaY * deltaY) >= 16;
        };

        const handlePointerMove = (event: globalThis.PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture) {
                return;
            }

            event.preventDefault();

            if (gesture.mode === "resize") {
                const rawStep = pointerStepForLane(gesture.lane, event);
                if (rawStep === null) {
                    return;
                }

                const endStep = Math.min(SEQFX_STEP_COUNT - 1, Math.max(gesture.startStep, rawStep));
                const length = endStep - gesture.startStep + 1;
                if (gesture.previewLength === length) {
                    return;
                }

                try {
                    const previewState = bridge.previewBlockResize({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        startStep: gesture.startStep,
                        length,
                    });
                    gesture.previewLength = length;
                    setPatternPreview({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        state: previewState,
                    });
                    selectBlockRange(gesture.lane, gesture.startStep, length);
                } catch {
                    // Overlap attempts are ignored so the gesture stops at the last valid length.
                }
                return;
            }

            if (!gesture.hasMoved && !gestureMovedEnough(gesture, event)) {
                return;
            }

            gesture.hasMoved = true;

            if (gesture.mode === "selectionMove") {
                const targetAnchor = targetAnchorStartFromPointer(gesture, event);
                if (
                    targetAnchor === null
                    || (
                        targetAnchor.lane === gesture.previewTargetLane
                        && targetAnchor.startStep === gesture.previewTargetAnchorStartStep
                    )
                    || (
                        targetAnchor.lane === gesture.lane
                        && targetAnchor.startStep === gesture.anchorStartStep
                        && gesture.previewTargetAnchorStartStep === null
                    )
                ) {
                    return;
                }

                try {
                    const result = bridge.previewBlockSelectionMove({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        blockStartSteps: gesture.blockStartSteps,
                        anchorStartStep: gesture.anchorStartStep,
                        targetLane: targetAnchor.lane,
                        targetAnchorStartStep: targetAnchor.startStep,
                    });
                    gesture.previewTargetLane = result.movedLane;
                    gesture.previewTargetAnchorStartStep = targetAnchor.startStep;
                    gesture.previewMovedStartSteps = result.movedStartSteps;
                    setInvalidDropTarget(null);
                    setPatternPreview({
                        patternIndex: selectedPatternRef.current,
                        lane: result.movedLane,
                        state: result.state,
                    });
                    selectBlockStartsFromPattern(
                        result.state.patterns[selectedPatternRef.current],
                        result.movedLane,
                        result.movedStartSteps,
                        targetAnchor.startStep,
                    );
                } catch {
                    gesture.previewTargetLane = null;
                    gesture.previewTargetAnchorStartStep = null;
                    gesture.previewMovedStartSteps = null;
                    setPatternPreview(null);
                    selectBlockStartsFromPattern(
                        bridge.getState().patterns[selectedPatternRef.current],
                        gesture.lane,
                        gesture.blockStartSteps,
                        gesture.anchorStartStep,
                    );
                    setInvalidSelectionDrop(
                        gesture.lane,
                        targetAnchor.lane,
                        gesture.blockStartSteps,
                        gesture.anchorStartStep,
                        targetAnchor.startStep,
                    );
                    // Invalid group targets, such as collisions, keep the selection at its last valid position.
                }
                return;
            }

            if (gesture.mode === "selectionCopy") {
                const targetAnchor = targetAnchorStartFromPointer(gesture, event);
                if (
                    targetAnchor === null
                    || (
                        targetAnchor.lane === gesture.previewTargetLane
                        && targetAnchor.startStep === gesture.previewTargetAnchorStartStep
                    )
                ) {
                    return;
                }

                try {
                    const result = bridge.previewBlockSelectionCopy({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        blockStartSteps: gesture.blockStartSteps,
                        anchorStartStep: gesture.anchorStartStep,
                        targetLane: targetAnchor.lane,
                        targetAnchorStartStep: targetAnchor.startStep,
                    });
                    gesture.previewTargetLane = result.copiedLane;
                    gesture.previewTargetAnchorStartStep = targetAnchor.startStep;
                    gesture.previewCopiedStartSteps = result.copiedStartSteps.length > 0
                        ? result.copiedStartSteps
                        : null;
                    if (result.copiedStartSteps.length > 0) {
                        setInvalidDropTarget(null);
                        setPatternPreview({
                            patternIndex: selectedPatternRef.current,
                            lane: result.copiedLane,
                            copiedStartSteps: result.copiedStartSteps,
                            state: result.state,
                        });
                    } else {
                        gesture.previewTargetLane = null;
                        gesture.previewTargetAnchorStartStep = null;
                        gesture.previewCopiedStartSteps = null;
                        setPatternPreview(null);
                        setInvalidSelectionDrop(
                            gesture.lane,
                            targetAnchor.lane,
                            gesture.blockStartSteps,
                            gesture.anchorStartStep,
                            targetAnchor.startStep,
                        );
                    }
                } catch {
                    gesture.previewTargetLane = null;
                    gesture.previewTargetAnchorStartStep = null;
                    gesture.previewCopiedStartSteps = null;
                    setPatternPreview(null);
                    setInvalidSelectionDrop(
                        gesture.lane,
                        targetAnchor.lane,
                        gesture.blockStartSteps,
                        gesture.anchorStartStep,
                        targetAnchor.startStep,
                    );
                }
                return;
            }

            const target = targetStartFromPointer(gesture, event);
            if (target === null) {
                return;
            }

            if (gesture.mode === "move") {
                if (
                    (
                        target.lane === gesture.previewTargetLane
                        && target.startStep === gesture.previewTargetStartStep
                    )
                    || (
                        target.lane === gesture.lane
                        && target.startStep === gesture.sourceStartStep
                        && gesture.previewTargetStartStep === null
                    )
                ) {
                    return;
                }

                try {
                    const previewState = bridge.previewBlockMove({
                        patternIndex: selectedPatternRef.current,
                        lane: gesture.lane,
                        startStep: gesture.sourceStartStep,
                        targetLane: target.lane,
                        targetStartStep: target.startStep,
                    });
                    gesture.previewTargetLane = target.lane;
                    gesture.previewTargetStartStep = target.startStep;
                    setInvalidDropTarget(null);
                    setPatternPreview({
                        patternIndex: selectedPatternRef.current,
                        lane: target.lane,
                        state: previewState,
                    });
                    selectBlockRange(target.lane, target.startStep, gesture.length);
                } catch {
                    gesture.previewTargetLane = null;
                    gesture.previewTargetStartStep = null;
                    setPatternPreview(null);
                    selectBlockRange(gesture.lane, gesture.sourceStartStep, gesture.length);
                    setInvalidSingleDrop(target.lane, target.startStep, gesture.length);
                    // Invalid targets, such as overlaps, keep the block at its last valid start.
                }
                return;
            }

            try {
                const preview = bridge.previewBlockCopyPaint({
                    patternIndex: selectedPatternRef.current,
                    lane: gesture.lane,
                    startStep: gesture.sourceStartStep,
                    targetLane: target.lane,
                    targetStartStep: target.startStep,
                });
                gesture.previewTargetLane = preview.copiedLane;
                gesture.previewTargetStartStep = target.startStep;
                if (preview.copiedStartSteps.length > 0) {
                    setInvalidDropTarget(null);
                    setPatternPreview({
                        patternIndex: selectedPatternRef.current,
                        lane: preview.copiedLane,
                        copiedStartSteps: preview.copiedStartSteps,
                        state: preview.state,
                    });
                } else {
                    gesture.previewTargetLane = null;
                    gesture.previewTargetStartStep = null;
                    setPatternPreview(null);
                    setInvalidSingleDrop(target.lane, target.startStep, gesture.length);
                }
            } catch {
                gesture.previewTargetLane = null;
                gesture.previewTargetStartStep = null;
                setPatternPreview(null);
                setInvalidSingleDrop(target.lane, target.startStep, gesture.length);
            }
        };

        const stopGesture = (event: globalThis.PointerEvent) => {
            const gesture = gestureRef.current;
            if (!gesture) {
                return;
            }

            if (gesture.mode === "resize") {
                if (gesture.previewLength !== null) {
                    try {
                        bridge.resizeBlock({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            startStep: gesture.startStep,
                            length: gesture.previewLength,
                        });
                        selectBlockRange(gesture.lane, gesture.startStep, gesture.previewLength);
                    } catch {
                        // Invalid release targets leave the source block untouched.
                    }
                }
            } else if (gesture.mode === "move" && gesture.hasMoved) {
                if (
                    gesture.previewTargetStartStep !== null
                    && gesture.previewTargetLane !== null
                    && (
                        gesture.previewTargetLane !== gesture.lane
                        || gesture.previewTargetStartStep !== gesture.sourceStartStep
                    )
                ) {
                    try {
                        bridge.moveBlock({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            startStep: gesture.sourceStartStep,
                            targetLane: gesture.previewTargetLane,
                            targetStartStep: gesture.previewTargetStartStep,
                        });
                        selectBlockRange(gesture.previewTargetLane, gesture.previewTargetStartStep, gesture.length);
                    } catch {
                        // Invalid release targets leave the source block untouched.
                    }
                } else {
                    selectBlockRange(gesture.lane, gesture.sourceStartStep, gesture.length);
                }
            } else if (gesture.mode === "selectionMove" && gesture.hasMoved) {
                if (
                    gesture.previewTargetAnchorStartStep !== null
                    && gesture.previewTargetLane !== null
                    && gesture.previewMovedStartSteps !== null
                ) {
                    try {
                        const result = bridge.moveBlockSelection({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            blockStartSteps: gesture.blockStartSteps,
                            anchorStartStep: gesture.anchorStartStep,
                            targetLane: gesture.previewTargetLane,
                            targetAnchorStartStep: gesture.previewTargetAnchorStartStep,
                        });
                        selectBlockStartsFromPattern(
                            result.state.patterns[selectedPatternRef.current],
                            result.movedLane,
                            result.movedStartSteps,
                            gesture.previewTargetAnchorStartStep,
                        );
                    } catch {
                        // Invalid release targets leave the selected blocks untouched.
                    }
                } else {
                    selectBlockStartsFromPattern(
                        bridge.getState().patterns[selectedPatternRef.current],
                        gesture.lane,
                        gesture.blockStartSteps,
                        gesture.anchorStartStep,
                    );
                }
            } else if (gesture.mode === "copy" && gesture.hasMoved) {
                if (
                    gesture.previewTargetLane !== null
                    && gesture.previewTargetStartStep !== null
                    && (
                        gesture.previewTargetLane !== gesture.lane
                        || gesture.previewTargetStartStep !== gesture.sourceStartStep
                    )
                ) {
                    try {
                        const result = bridge.copyBlockPaint({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            startStep: gesture.sourceStartStep,
                            targetLane: gesture.previewTargetLane,
                            targetStartStep: gesture.previewTargetStartStep,
                        });
                        const selectedStartStep = result.copiedStartSteps.at(-1);
                        if (selectedStartStep !== undefined) {
                            selectBlockRange(result.copiedLane, selectedStartStep, gesture.length);
                        }
                    } catch {
                        // Invalid release targets leave the source block untouched.
                    }
                }
            } else if (gesture.mode === "selectionCopy" && gesture.hasMoved) {
                if (
                    gesture.previewTargetLane !== null
                    && gesture.previewTargetAnchorStartStep !== null
                    && gesture.previewCopiedStartSteps !== null
                ) {
                    try {
                        const result = bridge.copyBlockSelection({
                            patternIndex: selectedPatternRef.current,
                            lane: gesture.lane,
                            blockStartSteps: gesture.blockStartSteps,
                            anchorStartStep: gesture.anchorStartStep,
                            targetLane: gesture.previewTargetLane,
                            targetAnchorStartStep: gesture.previewTargetAnchorStartStep,
                        });
                        if (result.copiedStartSteps.length > 0) {
                            selectBlockStartsFromPattern(
                                result.state.patterns[selectedPatternRef.current],
                                result.copiedLane,
                                result.copiedStartSteps,
                                gesture.previewTargetAnchorStartStep,
                            );
                        }
                    } catch {
                        // Invalid release targets leave the selected blocks untouched.
                    }
                }
            }

            gestureRef.current = null;
            setGestureState(null);
            setPatternPreview(null);
            setInvalidDropTarget(null);
        };

        const cancelGesture = () => {
            const gesture = gestureRef.current;
            if (!gesture) {
                return;
            }

            if (gesture.mode === "resize") {
                selectBlockRange(gesture.lane, gesture.startStep, gesture.length);
            } else if (gesture.mode === "move") {
                selectBlockRange(gesture.lane, gesture.sourceStartStep, gesture.length);
            } else if (gesture.mode === "selectionMove") {
                selectBlockStartsFromPattern(
                    bridge.getState().patterns[selectedPatternRef.current],
                    gesture.lane,
                    gesture.blockStartSteps,
                    gesture.anchorStartStep,
                );
            } else if (gesture.mode === "selectionCopy") {
                selectBlockStartsFromPattern(
                    bridge.getState().patterns[selectedPatternRef.current],
                    gesture.lane,
                    gesture.blockStartSteps,
                    gesture.anchorStartStep,
                );
            }

            gestureRef.current = null;
            setGestureState(null);
            setPatternPreview(null);
            setInvalidDropTarget(null);
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", stopGesture);
        window.addEventListener("pointercancel", cancelGesture);
        window.addEventListener("blur", cancelGesture);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", stopGesture);
            window.removeEventListener("pointercancel", cancelGesture);
            window.removeEventListener("blur", cancelGesture);
        };
    }, [bridge]);

    function beginGesture(gesture: BlockGesture) {
        gestureRef.current = gesture;
        setGestureState(gesture);
        setInvalidDropTarget(null);
    }

    function selectBlockRange(lane: number, startStep: number, length: number) {
        setSelectedCell({ lane, step: startStep });
        setSelection({
            lane,
            steps: Array.from({ length }, (_unused, index) => startStep + index),
            blockStartSteps: [startStep],
        });
    }

    function selectBlockStartsFromPattern(
        pattern: SeqFxPattern,
        lane: number,
        blockStartSteps: number[],
        anchorStartStep = blockStartSteps[0],
    ) {
        const nextSelection = selectionFromBlockStarts(pattern, lane, blockStartSteps);
        if (!nextSelection) {
            return;
        }

        setSelectedCell({ lane, step: anchorStartStep });
        setSelection(nextSelection);
    }

    function pointerGrabOffset(lane: number, startStep: number, length: number, clientX: number, clientY: number) {
        const pointerStep = stepAtClientPointForLane(lane, clientX, clientY);
        if (pointerStep === null) {
            return 0;
        }

        return Math.min(length - 1, Math.max(0, pointerStep - startStep));
    }

    function deleteBlockAt(lane: number, step: number) {
        const pattern = stateRef.current.patterns[selectedPatternRef.current];
        const block = getSeqFxBlockAtStep(pattern, lane, step);
        if (!block) {
            return;
        }

        const selectedStarts = selection?.lane === lane ? selection.blockStartSteps ?? [] : [];
        if (selectedStarts.includes(block.startStep)) {
            bridge.deleteBlockSelection({
                patternIndex: selectedPatternRef.current,
                lane,
                blockStartSteps: selectedStarts,
            });
            setSelectedCell(null);
            setSelection(null);
            gestureRef.current = null;
            setGestureState(null);
            setPatternPreview(null);
            setInvalidDropTarget(null);
            return;
        }

        bridge.deleteBlock({
            patternIndex: selectedPatternRef.current,
            lane: block.lane,
            startStep: block.startStep,
        });
        setSelectedCell(null);
        setSelection(null);
        gestureRef.current = null;
        setGestureState(null);
        setPatternPreview(null);
        setInvalidDropTarget(null);
    }

    const selectedPatternState = state.patterns[selectedPattern];
    const renderedPatternState = patternPreview?.patternIndex === selectedPattern
        ? patternPreview.state.patterns[selectedPattern]
        : selectedPatternState;
    const copyPreviewStartSteps = useMemo(() => (
        patternPreview?.patternIndex === selectedPattern
            ? new Set(patternPreview.copiedStartSteps ?? [])
            : new Set<number>()
    ), [patternPreview, selectedPattern]);
    const activeSelection = selection ?? selectionFromCell(selectedCell);
    activeSelectionRef.current = activeSelection;
    const inspectedLane = activeSelection?.lane ?? selectedCell?.lane ?? null;
    const inspectedStep = activeSelection?.steps[0] ?? selectedCell?.step ?? null;
    const inspectedCell = inspectedLane !== null && inspectedStep !== null
        ? renderedPatternState.lanes[inspectedLane].steps[inspectedStep]
        : null;
    const inspectedEffectType = inspectedCell?.active
        ? inspectedCell.effectType
        : drawEffectType ?? defaultEffectTypeForChain(inspectedLane ?? 0);
    const inspectedParamDefinitions = PARAM_DEFINITIONS[inspectedEffectType] ?? [];
    const inspectedAuxParamDefinitions = inspectedParamDefinitions.filter((definition) => (
        getSeqFxEffectDefinition(inspectedEffectType).parameters[definition.index]?.auxEligible === true
    ));
    const inspectedBlock = inspectedLane !== null && inspectedStep !== null
        ? getSeqFxBlockAtStep(renderedPatternState, inspectedLane, inspectedStep)
        : null;
    const selectedBlockStartSteps = activeSelection?.blockStartSteps ?? [];
    const selectedBlockGroup = selectedBlockStartSteps.length > 0;
    const selectedWholeBlock = Boolean(
        activeSelection
        && inspectedBlock
        && selectedBlockStartSteps.length <= 1
        && activeSelection.lane === inspectedBlock.lane
        && activeSelection.steps.length === inspectedBlock.length
        && activeSelection.steps[0] === inspectedBlock.startStep,
    );
    const inspectedBlockLength = inspectedBlock?.length ?? Math.max(1, activeSelection?.steps.length ?? 1);
    const tapeGraphBlockDurationMs = (observedStepDurationMs ?? estimatedStepDurationMsForRateIndex(rateIndex))
        * inspectedBlockLength;
    const auxEditable = Boolean(
        inspectedBlock
        && inspectedCell?.active
        && inspectedEffectType !== SEQFX_EFFECT_TYPES.empty
        && getSeqFxEffectDefinition(inspectedEffectType).parameters.some((parameter) => parameter.auxEligible)
        && selectedBlockStartSteps.length <= 1,
    );
    const inspectedAux = auxEditable ? inspectedCell?.aux ?? null : null;
    const inspectedAuxCyclePhase = inspectedLane !== null ? auxMonitor.cyclePhase[inspectedLane] ?? 0 : 0;
    const inspectedAuxAmount = inspectedLane !== null ? auxMonitor.amount[inspectedLane] ?? 0 : 0;
    const showModEditor = inspectorMode === "mod" && Boolean(inspectedAux);

    useEffect(() => {
        if (!auxEditable && inspectorMode !== "effect") {
            setInspectorMode("effect");
        }
    }, [auxEditable, inspectorMode]);

    function setAuxTargetEnd(paramIndex: number, value: number) {
        if (!inspectedBlock) {
            return;
        }

        if (activeSelection && selectedBlockGroup) {
            bridge.setBlockSelectionAuxTargetEnd({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                value,
            });
            return;
        }

        bridge.setBlockAuxTargetEnd({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            paramIndex,
            value,
        });
    }

    function setSelectedAuxTargetEnabled(paramIndex: number, enabled: boolean) {
        if (!inspectedBlock) {
            return;
        }

        if (activeSelection && selectedBlockGroup) {
            bridge.setBlockSelectionAuxTargetEnabled({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                enabled,
            });
            return;
        }

        bridge.setBlockAuxTargetEnabled({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            paramIndex,
            enabled,
        });
    }

    function auxTarget(paramIndex: number, direction: ModulationDirection = "both"): AuxModulatedParam | null {
        if (!inspectedAux || !inspectedBlock) {
            return null;
        }

        const target = inspectedAux.targets[paramIndex];
        if (!target?.enabled) {
            return null;
        }

        return {
            end: target.end,
            direction,
            onEndChange: (value) => setAuxTargetEnd(paramIndex, value),
        };
    }

    function toggleAuxTarget(paramIndex: number) {
        if (!inspectedAux || !inspectedBlock) {
            return;
        }

        bridge.setBlockAuxTargetEnabled({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            paramIndex,
            enabled: !inspectedAux.targets[paramIndex]?.enabled,
        });
    }

    function setAuxSource(source: Partial<SeqFxAuxSource>) {
        if (!inspectedBlock) {
            return;
        }

        bridge.setBlockAuxSource({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            source,
        });
    }

    function modulationForTapeStop(): TapeStopModulation | null {
        if (!auxEditable) {
            return null;
        }

        return {
            startLength: auxTarget(TAPE_STOP_PARAM_START_LENGTH),
            startCurve: auxTarget(TAPE_STOP_PARAM_START_CURVE),
            catchupCurve: auxTarget(TAPE_STOP_PARAM_CATCHUP_CURVE),
            catchupLength: auxTarget(TAPE_STOP_PARAM_CATCHUP_LENGTH),
            mode: auxTarget(TAPE_STOP_PARAM_MODE),
            onToggleStartLength: () => toggleAuxTarget(TAPE_STOP_PARAM_START_LENGTH),
            onToggleStartCurve: () => toggleAuxTarget(TAPE_STOP_PARAM_START_CURVE),
            onToggleCatchupCurve: () => toggleAuxTarget(TAPE_STOP_PARAM_CATCHUP_CURVE),
            onToggleCatchupLength: () => toggleAuxTarget(TAPE_STOP_PARAM_CATCHUP_LENGTH),
            onToggleMode: () => toggleAuxTarget(TAPE_STOP_PARAM_MODE),
        };
    }

    function modulationForCrusher(): CrusherModulation | null {
        if (!auxEditable) {
            return null;
        }

        return {
            phase: inspectedAuxAmount,
            bits: auxTarget(CRUSHER_PARAM_BITS),
            rateHz: auxTarget(CRUSHER_PARAM_RATE_HZ),
            driveDb: auxTarget(CRUSHER_PARAM_DRIVE_DB),
            adcQuality: auxTarget(CRUSHER_PARAM_ADC_QUALITY),
            dacQuality: auxTarget(CRUSHER_PARAM_DAC_QUALITY),
            dither: auxTarget(CRUSHER_PARAM_DITHER),
            onToggleBits: () => toggleAuxTarget(CRUSHER_PARAM_BITS),
            onToggleRateHz: () => toggleAuxTarget(CRUSHER_PARAM_RATE_HZ),
            onToggleDriveDb: () => toggleAuxTarget(CRUSHER_PARAM_DRIVE_DB),
            onToggleAdcQuality: () => toggleAuxTarget(CRUSHER_PARAM_ADC_QUALITY),
            onToggleDacQuality: () => toggleAuxTarget(CRUSHER_PARAM_DAC_QUALITY),
            onToggleDither: () => toggleAuxTarget(CRUSHER_PARAM_DITHER),
        };
    }

    function modulationForStutter(): StutterModulation | null {
        if (!auxEditable) {
            return null;
        }

        return {
            phase: inspectedAuxAmount,
            slices: auxTarget(STUTTER_PARAM_SLICES),
            speed: auxTarget(STUTTER_PARAM_SPEED),
            shape: auxTarget(STUTTER_PARAM_SHAPE),
            gate: auxTarget(STUTTER_PARAM_GATE),
            onToggleSlices: () => toggleAuxTarget(STUTTER_PARAM_SLICES),
            onToggleSpeed: () => toggleAuxTarget(STUTTER_PARAM_SPEED),
            onToggleShape: () => toggleAuxTarget(STUTTER_PARAM_SHAPE),
            onToggleGate: () => toggleAuxTarget(STUTTER_PARAM_GATE),
        };
    }

    function selectPattern(patternIndex: number) {
        bridge.selectPattern(patternIndex);
        setPatternPreview(null);
        setInvalidDropTarget(null);
        setSelectedCell(null);
        setSelection(null);
    }

    function activateCell(lane: number, step: number, shiftKey: boolean) {
        setInvalidDropTarget(null);

        if (shiftKey && selectedCell && selectedCell.lane === lane) {
            const nextSelection = mergeRangeSelection(selectedCell, { lane, step });
            setSelection(nextSelection);
            return;
        }

        bridge.createBlock({
            patternIndex: selectedPattern,
            lane,
            startStep: step,
            length: 1,
            effectType: drawEffectType ?? defaultEffectTypeForChain(lane),
        });
        setSelectedCell({ lane, step });
        setSelection({ lane, steps: [step], blockStartSteps: [step] });
    }

    function handleCellPointerDown(event: PointerEvent<HTMLDivElement>, lane: number, step: number) {
        if (event.button !== 0) {
            return;
        }

        activateCell(lane, step, event.shiftKey);
    }

    function isKeyboardActivation(event: ReactKeyboardEvent<HTMLDivElement>) {
        return event.key === "Enter" || event.key === " " || event.key === "Spacebar";
    }

    function handleCellKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, lane: number, step: number) {
        if (!isKeyboardActivation(event)) {
            return;
        }

        event.preventDefault();
        activateCell(lane, step, event.shiftKey);
    }

    function handleBlockPointerDown(event: PointerEvent<HTMLDivElement>, lane: number, startStep: number, length: number) {
        if (event.button !== 0) {
            return;
        }

        event.stopPropagation();
        const grabOffset = pointerGrabOffset(lane, startStep, length, event.clientX, event.clientY);
        const pattern = stateRef.current.patterns[selectedPatternRef.current];
        const activeBlockStarts = selection?.lane === lane ? selection.blockStartSteps ?? [] : [];
        const clickedSelectedBlock = activeBlockStarts.includes(startStep);

        if (event.shiftKey) {
            const anchorBlock = selectedCell?.lane === lane
                ? getSeqFxBlockAtStep(pattern, lane, selectedCell.step)
                : null;
            const blockStartSteps = anchorBlock
                ? blockStartsBetween(pattern, lane, anchorBlock.startStep, startStep)
                : [startStep];

            selectBlockStartsFromPattern(pattern, lane, blockStartSteps, anchorBlock?.startStep ?? startStep);
            return;
        }

        if (event.altKey || event.getModifierState("Alt") || optionKeyRef.current) {
            if (clickedSelectedBlock && activeBlockStarts.length > 1) {
                const bounds = selectionAnchorDragBounds(pattern, lane, activeBlockStarts, startStep);
                beginGesture({
                    mode: "selectionCopy",
                    lane,
                    blockStartSteps: [...activeBlockStarts],
                    anchorStartStep: startStep,
                    grabOffset,
                    pointerStartX: event.clientX,
                    pointerStartY: event.clientY,
                    hasMoved: false,
                    anchorMinStartStep: bounds.minStartStep,
                    anchorMaxStartStep: bounds.maxStartStep,
                    previewTargetLane: null,
                    previewTargetAnchorStartStep: null,
                    previewCopiedStartSteps: null,
                });
                return;
            }

            selectBlockRange(lane, startStep, length);
            beginGesture({
                mode: "copy",
                lane,
                sourceStartStep: startStep,
                length,
                grabOffset,
                pointerStartX: event.clientX,
                pointerStartY: event.clientY,
                hasMoved: false,
                previewTargetLane: null,
                previewTargetStartStep: null,
            });
            return;
        }

        if (clickedSelectedBlock && activeBlockStarts.length > 1) {
            const bounds = selectionAnchorDragBounds(pattern, lane, activeBlockStarts, startStep);
            beginGesture({
                mode: "selectionMove",
                lane,
                blockStartSteps: [...activeBlockStarts],
                anchorStartStep: startStep,
                grabOffset,
                pointerStartX: event.clientX,
                pointerStartY: event.clientY,
                hasMoved: false,
                anchorMinStartStep: bounds.minStartStep,
                anchorMaxStartStep: bounds.maxStartStep,
                previewTargetLane: null,
                previewTargetAnchorStartStep: null,
                previewMovedStartSteps: null,
            });
            return;
        }

        selectBlockRange(lane, startStep, length);
        beginGesture({
            mode: "move",
            lane,
            sourceStartStep: startStep,
            length,
            grabOffset,
            pointerStartX: event.clientX,
            pointerStartY: event.clientY,
            hasMoved: false,
            previewTargetLane: null,
            previewTargetStartStep: null,
        });
    }

    function handleBlockKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, lane: number, startStep: number, length: number) {
        if (!isKeyboardActivation(event)) {
            return;
        }

        event.preventDefault();
        selectBlockRange(lane, startStep, length);
    }

    function handleBlockDoubleClick(event: MouseEvent<HTMLDivElement>, lane: number, startStep: number) {
        event.preventDefault();
        event.stopPropagation();
        deleteBlockAt(lane, startStep);
    }

    function handleCellDoubleClick(event: MouseEvent<HTMLDivElement>, lane: number, step: number) {
        event.preventDefault();
        event.stopPropagation();
        deleteBlockAt(lane, step);
    }

    function handleResizePointerDown(event: PointerEvent<HTMLSpanElement>, lane: number, startStep: number, length: number) {
        event.preventDefault();
        event.stopPropagation();
        beginGesture({ mode: "resize", lane, startStep, length, previewLength: null });
    }

    function handleInspectorPointerDownCapture(event: PointerEvent<HTMLElement>) {
        if (isPromoControlled || (event.pointerType === "mouse" && event.button !== 0)) {
            return;
        }

        liveEditPointerIdRef.current = event.pointerId;
        bridge.beginLiveEdit();
    }

    function setMix(value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionMix({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                value,
            });
        } else if (selectedWholeBlock && inspectedBlock) {
            bridge.setBlockMix({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                value,
            });
        } else {
            bridge.setStepMix({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                steps: activeSelection.steps,
                value,
            });
        }
    }

    function setParam(paramIndex: number, value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionParam({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                value,
            });
        } else if (selectedWholeBlock && inspectedBlock) {
            bridge.setBlockParam({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                paramIndex,
                value,
            });
        } else {
            bridge.setStepParam({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                steps: activeSelection.steps,
                paramIndex,
                value,
            });
        }
    }

    function setEffectType(value: number) {
        const nextEffectType = EFFECT_OPTIONS.includes(value as typeof EFFECT_OPTIONS[number])
            ? value as SeqFxEffectType
            : SEQFX_EFFECT_TYPES.filter;
        setDrawEffectType(nextEffectType);

        if (!inspectedBlock || !activeSelection || activeSelection.blockStartSteps?.length !== 1) {
            return;
        }

        bridge.setBlockEffect({
            patternIndex: selectedPattern,
            lane: inspectedBlock.lane,
            startStep: inspectedBlock.startStep,
            effectType: nextEffectType,
        });
    }

    function setFilterValue(nextValue: FilterRangeValue) {
        if (!inspectedCell) {
            return;
        }

        const currentValue = filterRangeValueFromSeqFxStep(inspectedCell);
        const currentRange = filterRangeEndpointsFromSeqFxStep(inspectedCell);
        const currentMode = filterRangeModeToSeqFxMode(currentValue.mode);
        const nextMode = filterRangeModeToSeqFxMode(nextValue.mode);

        if (nextMode !== currentMode) {
            setParam(FILTER_PARAM_MODE, nextMode);
        }

        if (Math.abs(nextValue.q - currentValue.q) > 0.000001) {
            setParam(FILTER_PARAM_RESONANCE, nextValue.q);
        }

        if (Math.abs(nextValue.cutoffHz - currentValue.cutoffHz) <= 0.000001) {
            return;
        }

        const direction = currentRange.endCutoffHz >= currentRange.startCutoffHz ? 1 : -1;
        const nextRange = cutoffsFromCenterRangeOctaves({
            centerCutoffHz: nextValue.cutoffHz,
            rangeOctaves: cutoffRangeOctaves(currentRange.startCutoffHz, currentRange.endCutoffHz),
            direction,
        });

        setFilterRange(nextRange);
    }

    function setFilterRange(nextRange: FilterRangeEndpoints) {
        setParam(FILTER_PARAM_CUTOFF, nextRange.startCutoffHz);

        if (!inspectedBlock) {
            return;
        }

        const shouldModulateCutoff = Math.abs(nextRange.endCutoffHz - nextRange.startCutoffHz) > 0.000001;
        setAuxTargetEnd(FILTER_PARAM_CUTOFF, nextRange.endCutoffHz);

        if (selectedBlockGroup || (inspectedCell?.aux.targets[FILTER_PARAM_CUTOFF]?.enabled === true) !== shouldModulateCutoff) {
            setSelectedAuxTargetEnabled(FILTER_PARAM_CUTOFF, shouldModulateCutoff);
        }
    }

    function setStutterParam(paramIndex: number, value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionParam({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                paramIndex,
                value,
            });
        } else if (inspectedBlock) {
            bridge.setBlockParam({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                paramIndex,
                value,
            });
        } else {
            setParam(paramIndex, value);
        }
    }

    function setStutterMix(value: number) {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.setBlockSelectionMix({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
                value,
            });
        } else if (inspectedBlock) {
            bridge.setBlockMix({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
                value,
            });
        } else {
            setMix(value);
        }
    }

    function deleteSelectedBlock() {
        if (!activeSelection) {
            return;
        }

        if (selectedBlockGroup) {
            bridge.deleteBlockSelection({
                patternIndex: selectedPattern,
                lane: activeSelection.lane,
                blockStartSteps: selectedBlockStartSteps,
            });
        } else if (inspectedBlock) {
            bridge.deleteBlock({
                patternIndex: selectedPattern,
                lane: inspectedBlock.lane,
                startStep: inspectedBlock.startStep,
            });
        }
        setSelectedCell(null);
        setSelection(null);
        setPatternPreview(null);
        setInvalidDropTarget(null);
    }

    return (
        <main className={gestureState ? "seqfx-root is-dragging" : "seqfx-root"} data-role="seqfx-root">
            {promoControls?.hidePresetBar ? null : (
                <SeqFxPresetBarHost bridge={bridge} patchConnection={patchConnection} />
            )}

            <section className="seqfx-topbar" aria-label="SeqFX pattern controls">
                <div className="seqfx-title">
                    <SeqFxTitleSigil />
                    <h1>SeqFX</h1>
                </div>
                <div className="seqfx-patterns" role="group" aria-label="Patterns">
                    {Array.from({ length: SEQFX_PATTERN_COUNT }, (_unused, index) => (
                        <button
                            className={index === selectedPattern ? "seqfx-pattern is-selected" : "seqfx-pattern"}
                            key={index}
                            type="button"
                            aria-pressed={index === selectedPattern}
                            onClick={() => selectPattern(index)}
                            data-role="seqfx-pattern"
                            data-pattern={index}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            </section>

            <section className="seqfx-workspace" style={SEQFX_WORKSPACE_STYLE}>
                <div className={gridShellClassName} aria-label="Effect sequence grid">
                    {STEP_BARS.map((barSteps, barIndex) => (
                        <div className="seqfx-bar-section" data-role="seqfx-bar-section" data-bar={barIndex} key={barIndex}>
                            <div className="seqfx-step-header">
                                <div className="seqfx-lane-spacer" />
                                <div className="seqfx-step-track">
                                    {barSteps.map((step) => (
                                        <div
                                            className={playheadStep === step ? "seqfx-step-number is-playhead" : "seqfx-step-number"}
                                            key={step}
                                            style={gridGeometry.stepNumberStyle(step)}
                                        >
                                            {step + 1}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="seqfx-bar-lanes" data-role="seqfx-bar-lanes" data-bar={barIndex}>
                                <SeqFxBarFrame barIndex={barIndex} hasArrow={barIndex === 0} />
                                {SEQFX_LANE_NAMES.map((laneName, lane) => {
                                    const laneBlocks = getSeqFxLaneBlocks(renderedPatternState, lane);
                                    const invalidBlocks = invalidDropTarget?.patternIndex === selectedPattern && invalidDropTarget.lane === lane
                                        ? invalidDropTarget.blocks
                                        : [];

                                    return (
                                        <div className="seqfx-lane-row" key={`${barIndex}:${laneName}`}>
                                            <div className="seqfx-lane-label">{laneName}</div>
                                            <div
                                                className="seqfx-lane-track"
                                                data-role="seqfx-lane-track"
                                                data-bar={barIndex}
                                                data-lane={lane}
                                                ref={(node) => {
                                                    const key = laneTrackRefKey(lane, barIndex);
                                                    if (node) {
                                                        laneTrackRefs.current.set(key, { lane, node });
                                                    } else {
                                                        laneTrackRefs.current.delete(key);
                                                    }
                                                }}
                                            >
                                                {barSteps.map((step) => {
                                                    const cell = renderedPatternState.lanes[lane].steps[step];
                                                    const selected = activeSelection?.lane === lane && activeSelection.steps.includes(step);
                                                    const className = [
                                                        "seqfx-cell",
                                                        ...frameCornerClassNames(lane, barIndex, step, step),
                                                        gridGeometry.isAltBar(step) ? "is-alt-bar" : "",
                                                        cell.active ? "is-covered" : "",
                                                        selected ? "is-selected" : "",
                                                        playheadStep === step ? "is-playhead" : "",
                                                    ].filter(Boolean).join(" ");

                                                    return (
                                                        <div
                                                            aria-label={`${laneName} step ${step + 1}`}
                                                            aria-pressed={cell.active}
                                                            className={className}
                                                            data-role="seqfx-cell"
                                                            data-lane={lane}
                                                            data-step={step}
                                                            key={step}
                                                            onDoubleClick={(event) => handleCellDoubleClick(event, lane, step)}
                                                            onKeyDown={(event) => handleCellKeyDown(event, lane, step)}
                                                            onPointerDown={(event) => handleCellPointerDown(event, lane, step)}
                                                            ref={(node) => {
                                                                const key = cellRefKey(lane, step);
                                                                if (node) {
                                                                    cellRefs.current.set(key, node);
                                                                } else {
                                                                    cellRefs.current.delete(key);
                                                                }
                                                            }}
                                                            role="button"
                                                            style={gridGeometry.cellStyle(step)}
                                                            tabIndex={0}
                                                        >
                                                            <span />
                                                        </div>
                                                    );
                                                })}
                                                {invalidBlocks.flatMap((block) => (
                                                    gridGeometry.blockSegments(block.startStep, block.length)
                                                        .filter((segment) => segment.barIndex === barIndex)
                                                        .map((segment) => (
                                                            <div
                                                                aria-hidden="true"
                                                                className={[
                                                                    "seqfx-invalid-drop",
                                                                    ...frameCornerClassNames(lane, barIndex, segment.startStep, segment.endStep),
                                                                ].join(" ")}
                                                                data-role="seqfx-invalid-drop"
                                                                data-lane={lane}
                                                                data-start={block.startStep}
                                                                data-segment-start={segment.startStep}
                                                                key={`invalid:${lane}:${block.startStep}:${segment.startStep}`}
                                                                style={segment.style}
                                                            />
                                                        ))
                                                ))}
                                                {laneBlocks.map((block) => {
                                                    const blockIsPreview = patternPreview?.patternIndex === selectedPattern
                                                        && patternPreview.lane === lane
                                                        && copyPreviewStartSteps.has(block.startStep);
                                                    const selected = activeSelection?.lane === lane
                                                        && (
                                                            activeSelection.blockStartSteps?.includes(block.startStep)
                                                            || (
                                                                activeSelection.steps[0] === block.startStep
                                                                && activeSelection.steps.length === block.length
                                                            )
                                                        );
                                                    const baseClassName = [
                                                        "seqfx-block",
                                                        blockIsPreview ? "is-copy-preview" : "",
                                                        selected ? "is-selected" : "",
                                                        playheadStep !== null && playheadStep >= block.startStep && playheadStep <= block.endStep ? "is-playhead" : "",
                                                    ].filter(Boolean).join(" ");
                                                    const effectName = SEQFX_EFFECT_TYPE_NAMES[block.effectType] ?? "Effect";
                                                    const ariaLabel = block.length === 1
                                                        ? `${laneName} ${effectName} block ${block.startStep + 1}`
                                                        : `${laneName} ${effectName} block ${block.startStep + 1}-${block.endStep + 1}`;

                                                    return gridGeometry.blockSegments(block.startStep, block.length)
                                                        .filter((segment) => segment.barIndex === barIndex)
                                                        .map((segment) => {
                                                            const primarySegment = segment.startStep === block.startStep;
                                                            const segmentLength = segment.endStep - segment.startStep + 1;
                                                            const stepParams = renderedPatternState.lanes[lane].steps[block.startStep]?.params ?? [];
                                                            return (
                                                                        <div
                                                                            aria-label={primarySegment ? ariaLabel : undefined}
                                                                            className={[
                                                                                baseClassName,
                                                                                ...frameCornerClassNames(lane, barIndex, segment.startStep, segment.endStep),
                                                                            ].join(" ")}
                                                                    data-effect={block.effectType}
                                                                    data-role={primarySegment ? "seqfx-block" : "seqfx-block-segment"}
                                                                    data-lane={lane}
                                                                    data-preview={blockIsPreview ? "true" : undefined}
                                                                    data-start={block.startStep}
                                                                    data-segment-start={segment.startStep}
                                                                    key={`${lane}:${block.startStep}:${segment.startStep}`}
                                                                    onDoubleClick={(event) => handleBlockDoubleClick(event, lane, block.startStep)}
                                                                    onKeyDown={primarySegment
                                                                        ? (event) => handleBlockKeyDown(event, lane, block.startStep, block.length)
                                                                        : undefined}
                                                                    onPointerDown={(event) => handleBlockPointerDown(event, lane, block.startStep, block.length)}
                                                                    role={primarySegment ? "button" : undefined}
                                                                    style={segment.style}
                                                                    tabIndex={primarySegment ? 0 : undefined}
                                                                >
                                                                    <span className="seqfx-block-fill">
                                                                        <SeqFxBlockGlyph
                                                                            effectType={block.effectType}
                                                                            params={stepParams}
                                                                            segmentLength={segmentLength}
                                                                        />
                                                                    </span>
                                                                    {segment.isEndSegment ? (
                                                                        <span
                                                                            aria-hidden="true"
                                                                            className="seqfx-block-resize"
                                                                            data-role="seqfx-block-resize"
                                                                            data-lane={lane}
                                                                            data-start={block.startStep}
                                                                            onPointerDown={(event) => handleResizePointerDown(event, lane, block.startStep, block.length)}
                                                                        />
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        });
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <aside
                    className="seqfx-inspector"
                    data-role="seqfx-inspector"
                    onPointerDownCapture={handleInspectorPointerDownCapture}
                >
                    <div className="seqfx-inspector-heading">
                        <span aria-hidden="true" className="seqfx-inspector-heading__bullet" data-role="seqfx-inspector-bullet" />
                        <strong>{getSelectionLabel(activeSelection)}</strong>
                        <span aria-hidden="true" className="seqfx-inspector-heading__rule" data-role="seqfx-inspector-rule" />
                    </div>
                    {!inspectedCell || inspectedLane === null ? (
                        <p className="seqfx-empty" data-role="seqfx-empty">
                            <SeqFxEmptyStateIcon />
                            <span>Choose a lane cell to edit its mix and effect settings.</span>
                        </p>
                    ) : (
                        <>
                            <div className="seqfx-effect-picker" data-role="seqfx-effect-type" role="group" aria-label="Effect">
                                <div className="seqfx-effect-picker__options">
                                    {EFFECT_OPTIONS.map((effectType) => {
                                        const selected = inspectedEffectType === effectType;
                                        return (
                                            <button
                                                key={effectType}
                                                type="button"
                                                className={selected ? "is-selected" : undefined}
                                                data-effect-type={effectType}
                                                data-role="seqfx-effect-type-option"
                                                disabled={selectedBlockStartSteps.length > 1}
                                                aria-label={SEQFX_EFFECT_TYPE_NAMES[effectType]}
                                                aria-pressed={selected}
                                                onClick={() => setEffectType(effectType)}
                                            >
                                                <SeqFxEffectIcon effectType={effectType} />
                                            </button>
                                        );
                                    })}
                                </div>
                                {inspectedAux ? (
                                    <SeqFxModToggleButton
                                        aux={inspectedAux}
                                        cyclePhase={inspectedAuxCyclePhase}
                                        amount={inspectedAuxAmount}
                                        active={showModEditor}
                                        onClick={() => setInspectorMode(showModEditor ? "effect" : "mod")}
                                    />
                                ) : null}
                            </div>
                            {showModEditor && inspectedAux ? (
                                <SeqFxModEditor
                                    aux={inspectedAux}
                                    cyclePhase={inspectedAuxCyclePhase}
                                    amount={inspectedAuxAmount}
                                    params={inspectedCell.params}
                                    definitions={inspectedAuxParamDefinitions}
                                    onSourceChange={setAuxSource}
                                    onTargetToggle={toggleAuxTarget}
                                    onTargetEndChange={setAuxTargetEnd}
                                />
                            ) : (
                                <>
                                    {inspectedEffectType === SEQFX_EFFECT_TYPES.filter ? (
                                        <FilterRangeEditor
                                            ariaLabel="SeqFX filter range editor"
                                            modeOptions={SEQFX_FILTER_MODE_OPTIONS}
                                            range={filterRangeEndpointsFromSeqFxStep(inspectedCell)}
                                            rangePolarity="bipolar"
                                            showHandleChips
                                            showModeControls
                                            value={filterRangeValueFromSeqFxStep(inspectedCell)}
                                            onRangeChange={setFilterRange}
                                            onValueChange={setFilterValue}
                                        />
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.crusher ? (
                                        <CrusherEditor
                                            value={crusherValueFromSeqFxStep(inspectedCell)}
                                            onBitsChange={(value) => setParam(CRUSHER_PARAM_BITS, value)}
                                            onRateHzChange={(value) => setParam(CRUSHER_PARAM_RATE_HZ, value)}
                                            onDriveDbChange={(value) => setParam(CRUSHER_PARAM_DRIVE_DB, value)}
                                            onCharacterChange={(value) => setParam(CRUSHER_PARAM_CHARACTER, value)}
                                            onAdcQualityChange={(value) => setParam(CRUSHER_PARAM_ADC_QUALITY, value)}
                                            onDacQualityChange={(value) => setParam(CRUSHER_PARAM_DAC_QUALITY, value)}
                                            onDitherChange={(value) => setParam(CRUSHER_PARAM_DITHER, value)}
                                            modulation={modulationForCrusher()}
                                        />
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.tapeStop ? (
                                        <TapeStopV2Editor
                                            step={inspectedCell}
                                            disabled={!selectedBlockGroup && !selectedWholeBlock && (activeSelection?.steps.length ?? 0) > 1}
                                            onParamChange={setParam}
                                        />
                                    ) : inspectedEffectType === SEQFX_EFFECT_TYPES.stutter ? (
                                        <StutterEnvelopeEditor
                                            value={stutterValueFromSeqFxStep(inspectedCell)}
                                            onGateChange={(value) => setStutterParam(STUTTER_PARAM_GATE, value)}
                                            onShapeChange={(value) => setStutterParam(STUTTER_PARAM_SHAPE, value)}
                                            onSlicesChange={(value) => setStutterParam(STUTTER_PARAM_SLICES, value)}
                                            onSpeedChange={(value) => setStutterParam(STUTTER_PARAM_SPEED, value)}
                                            modulation={modulationForStutter()}
                                        />
                                    ) : inspectedParamDefinitions.map((definition) => {
                                        const triggerLatched = isSeqFxTriggerLatchedParamForEffect(inspectedEffectType, definition.index);
                                        const disabled = triggerLatched && !selectedBlockGroup && !selectedWholeBlock && (activeSelection?.steps.length ?? 0) > 1;
                                        const value = inspectedCell.params[definition.index];

                                        return (
                                            <label className="seqfx-field" key={definition.index}>
                                                <span>
                                                    {definition.label}
                                                    {triggerLatched ? <em>Trigger</em> : null}
                                                </span>
                                                {definition.kind === "select" ? (
                                                    <select
                                                        data-role="seqfx-param"
                                                        data-param={definition.index}
                                                        disabled={disabled}
                                                        onChange={(event) => setParam(definition.index, Number(event.currentTarget.value))}
                                                        value={Math.round(value)}
                                                    >
                                                        {definition.options!.map((option, index) => (
                                                            <option key={option} value={index}>{option}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        data-role="seqfx-param"
                                                        data-param={definition.index}
                                                        disabled={disabled}
                                                        max={definition.max}
                                                        min={definition.min}
                                                        onChange={(event) => setParam(definition.index, Number(event.currentTarget.value))}
                                                        step={definition.step}
                                                        type="number"
                                                        value={formatValue(value)}
                                                    />
                                                )}
                                                <small>
                                                    {disabled
                                                        ? "Select one cell to edit this trigger."
                                                        : definition.hint ?? `${definition.min} to ${definition.max}`}
                                                </small>
                                            </label>
                                        );
                                    })}
                                    <SeqFxMixRow
                                        value={inspectedCell.mix}
                                        onChange={inspectedEffectType === SEQFX_EFFECT_TYPES.stutter ? setStutterMix : setMix}
                                    />
                                </>
                            )}
                            {selectedBlockGroup || (selectedWholeBlock && inspectedBlock) ? (
                                <button
                                    className="seqfx-delete-block"
                                    data-role="seqfx-delete-block"
                                    onClick={deleteSelectedBlock}
                                    type="button"
                                >
                                    <SeqFxDeleteGlyph />
                                    <span>{selectedBlockStartSteps.length > 1 ? "Delete Selection" : "Delete Block"}</span>
                                </button>
                            ) : null}
                        </>
                    )}
                </aside>
            </section>

        </main>
    );
}
