import {
    loadFactoryBankCatalogFromPatch,
    loadFactoryBankFramesFromPatch,
} from "./wavetable-bank.js";
import { MsegController } from "./mseg-controller.js";
import {
    MSEG_EDITOR_HORIZONTAL_PADDING_PX,
    MSEG_EDITOR_VERTICAL_PADDING_PX,
    MSEG_POINT_RADIUS_PX,
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    MSEG_SELECTED_POINT_RADIUS_PX,
    clampMsegRateSeconds,
    createMsegEditorMetrics,
    evaluateMsegShape,
    findMsegPointHitIndex,
    msegEditorCoordinatesToPoint,
    pointToMsegEditorCoordinates,
} from "./mseg.js";
import { getPatchThemeCSSVariables } from "./theme.js";
import { CanvasWavetableDisplay } from "./wavetable-display.js";
import { computeResponsivePatchLayout, getLayoutCSSVariables } from "./responsive-layout.js";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const wavetableSelectEndpointID = "wavetableSelect";
const playModeEndpointID = "playMode";
const glideTimeEndpointID = "glideTime";
const runtimeSyncRequestEndpointID = "runtimeSyncRequest";
const runtimeStateEndpointID = "runtimeState";
const retryDesiredTableRequestEndpointID = "retryDesiredTableRequest";
const msegDepthEndpointID = "mseg1Depth";
const effectiveWavetablePositionEndpointID = "effectiveWavetablePosition";
const runtimeFailurePhaseLoadSource = 1;
const runtimeFailurePhaseBuildMip = 2;
const runtimeFailurePhaseTransferMip = 3;
const runtimeFailureReasonTimeout = 2;
const runtimeFailureScopeCandidate = 0;
const runtimeFailureScopeService = 1;
const DISPLAY_POSITION_EPSILON = 0.000001;
const DISPLAY_GESTURE_AXIS_LOCK_PX = 12;
const DISPLAY_SWIPE_MIN_COMMIT_PX = 48;
const DISPLAY_SWIPE_COMMIT_RATIO = 0.18;
const DISPLAY_SLIDE_TRANSITION_MS = 240;
const MSEG_CURVE_PREVIEW_SAMPLES = 128;
const MSEG_DRAG_THRESHOLD_PX = 8;
const SVG_NS = "http://www.w3.org/2000/svg";
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PLAY_MODE_OPTIONS = [
    { value: 0, label: "Poly" },
    { value: 1, label: "Mono" },
    { value: 2, label: "Legato" },
];

const knobDefault = 0.0;
const patchThemeCSSVariables = getPatchThemeCSSVariables();

function emitPatchViewLog(level, message, fields = null) {
    const logger = typeof console?.[level] === "function"
        ? console[level].bind(console)
        : console.log?.bind(console);

    if (!logger) {
        return;
    }

    if (fields && typeof fields === "object" && Object.keys(fields).length > 0) {
        logger(`[wavetable-view] ${message}`, fields);
        return;
    }

    logger(`[wavetable-view] ${message}`);
}

function formatIOSFactoryLibraryLoadMessage(prefix, detail, platform) {
    const baseMessage = `${prefix}: ${detail}`;

    if (platform !== "ios") {
        return baseMessage;
    }

    return `${baseMessage}. Import the factory wavetable zip from the native library bar, then reopen the patch.`;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function clampDisplayPosition(value) {
    return clamp(Number(value) || 0, 0.0, 1.0);
}

function clampDepth(value) {
    return clamp(Number(value) || 0, -1.0, 1.0);
}

function clampPlayMode(value) {
    return clamp(Math.round(Number(value) || 0), 0, PLAY_MODE_OPTIONS.length - 1);
}

function clampGlideTime(value) {
    return clamp(Number(value) || 0, 0.0, 2.0);
}

function formatMsegRateSeconds(seconds) {
    const numericSeconds = Number(seconds);
    return `${clampMsegRateSeconds(Number.isFinite(numericSeconds) ? numericSeconds : 1.0).toFixed(3)} s`;
}

function formatGlideTime(seconds) {
    return `${clampGlideTime(seconds).toFixed(3)} s`;
}

function buildSelectOptionsHTML(options) {
    return options
        .map(({ value, label }) => `<option value="${value}">${label}</option>`)
        .join("");
}

function getPitchClass(noteNumber) {
    const safeNoteNumber = Math.round(Number(noteNumber) || 0);
    return ((safeNoteNumber % 12) + 12) % 12;
}

function isNaturalNoteNumber(noteNumber) {
    const pitchClass = getPitchClass(noteNumber);

    return pitchClass === 0 ||
        pitchClass === 2 ||
        pitchClass === 4 ||
        pitchClass === 5 ||
        pitchClass === 7 ||
        pitchClass === 9 ||
        pitchClass === 11;
}

export function countNaturalNotesInRange(rootNote, noteCount) {
    const safeRootNote = Math.round(Number(rootNote) || 0);
    const safeNoteCount = Math.max(1, Math.round(Number(noteCount) || 0));
    let naturalCount = 0;

    for (let noteOffset = 0; noteOffset < safeNoteCount; noteOffset += 1) {
        if (isNaturalNoteNumber(safeRootNote + noteOffset)) {
            naturalCount += 1;
        }
    }

    return Math.max(1, naturalCount);
}

export function computeKeyboardDimensions({
    rootNote = 36,
    noteCount = 24,
    availableWidth = 0,
    minNaturalWidth = 18,
} = {}) {
    const naturalCount = countNaturalNotesInRange(rootNote, noteCount);
    const safeAvailableWidth = Math.max(0, Number(availableWidth) || 0);
    const unclampedNaturalWidth = Math.max(1, (safeAvailableWidth - 1) / naturalCount);
    const naturalWidth = Math.max(Number(minNaturalWidth) || 0, unclampedNaturalWidth);
    const accidentalWidth = Math.max(8, naturalWidth * 0.58);

    return {
        naturalCount,
        naturalWidth,
        accidentalWidth,
    };
}

export function getAdjacentTableIndices(currentTableIndex, tableCount) {
    const safeTableCount = Math.max(0, Math.round(Number(tableCount) || 0));
    if (safeTableCount <= 1) {
        return [];
    }

    const safeCurrentIndex = clamp(
        Math.round(Number(currentTableIndex) || 0),
        0,
        safeTableCount - 1
    );
    const adjacent = [];

    if (safeCurrentIndex > 0) {
        adjacent.push(safeCurrentIndex - 1);
    }

    if (safeCurrentIndex < safeTableCount - 1) {
        adjacent.push(safeCurrentIndex + 1);
    }

    return adjacent;
}

export function resolveDisplayGestureAxis(deltaX, deltaY, axisLockThreshold = DISPLAY_GESTURE_AXIS_LOCK_PX) {
    const safeDeltaX = Math.abs(Number(deltaX) || 0);
    const safeDeltaY = Math.abs(Number(deltaY) || 0);
    const safeThreshold = Math.max(0, Number(axisLockThreshold) || 0);

    if (Math.max(safeDeltaX, safeDeltaY) < safeThreshold) {
        return "pending";
    }

    return safeDeltaX > safeDeltaY ? "horizontal" : "vertical";
}

export function resolveHorizontalSwipeTarget(startTableIndex, deltaX, tableCount) {
    const safeTableCount = Math.max(1, Math.round(Number(tableCount) || 1));
    const safeStartIndex = clamp(
        Math.round(Number(startTableIndex) || 0),
        0,
        safeTableCount - 1
    );
    const safeDeltaX = Number(deltaX) || 0;
    const direction = safeDeltaX < 0 ? 1 : safeDeltaX > 0 ? -1 : 0;

    if (direction === 0) {
        return {
            direction: 0,
            targetTableIndex: safeStartIndex,
            hasTarget: false,
        };
    }

    const targetTableIndex = clamp(safeStartIndex + direction, 0, safeTableCount - 1);
    return {
        direction,
        targetTableIndex,
        hasTarget: targetTableIndex !== safeStartIndex,
    };
}

export function shouldCommitHorizontalSwipe(
    deltaX,
    stageWidth,
    minCommitDistance = DISPLAY_SWIPE_MIN_COMMIT_PX,
    commitRatio = DISPLAY_SWIPE_COMMIT_RATIO
) {
    const safeStageWidth = Math.max(0, Number(stageWidth) || 0);
    const safeMinCommitDistance = Math.max(0, Number(minCommitDistance) || 0);
    const safeCommitRatio = Math.max(0, Number(commitRatio) || 0);
    const commitDistance = Math.max(safeMinCommitDistance, safeStageWidth * safeCommitRatio);

    return Math.abs(Number(deltaX) || 0) >= commitDistance;
}

function buildThemeCSSVariablesBlock() {
    return Object.entries(patchThemeCSSVariables)
        .map(([key, value]) => `${key}: ${value};`)
        .join("\n");
}

function getMsegEditorInteractionOptions(orientation = "horizontal") {
    return {
        orientation,
        pointRadius: MSEG_POINT_RADIUS_PX,
        horizontalPadding: MSEG_EDITOR_HORIZONTAL_PADDING_PX,
        verticalPadding: MSEG_EDITOR_VERTICAL_PADDING_PX,
    };
}

function formatMsegLoopLabel(loop) {
    return loop ? "Loop On" : "Loop Off";
}

function getMsegLoopIconSVG() {
    return `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 7h8.5l-1.9-1.9L15 4l4 4-4 4-1.4-1.1 1.9-1.9H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5Z"></path>
            <path d="M17 17H8.5l1.9 1.9L9 20l-4-4 4-4 1.4 1.1-1.9 1.9H17a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5Z"></path>
        </svg>
    `;
}

function buildMsegSurfaceHTML(rolePrefix, extraClass = "") {
    return `
        <svg class="mseg-surface ${extraClass}" data-role="${rolePrefix}-viewport">
            <g class="mseg-grid" data-role="${rolePrefix}-grid"></g>
            <path class="mseg-fill" data-role="${rolePrefix}-fill"></path>
            <path class="mseg-curve" data-role="${rolePrefix}-curve"></path>
            <g class="mseg-points" data-role="${rolePrefix}-points"></g>
        </svg>
    `;
}

function buildMsegLauncherHTML() {
    return `
        <div class="mseg-shell">
            <div class="mseg-launcher">
                <div class="mseg-launcher-head">
                    <div class="mseg-launcher-copy">
                        <div class="mseg-eyebrow">MSEG 1</div>
                        <strong class="mseg-route-title">Fixed Wavetable Route</strong>
                    </div>
                </div>

                <button class="mseg-preview-button" type="button" aria-label="Open MSEG editor">
                    <div class="mseg-preview-shell">
                        ${buildMsegSurfaceHTML("mseg-preview", "mseg-preview-surface")}
                    </div>
                </button>

                <div class="mseg-preview-footer">
                    <div class="mseg-launcher-rate-readout" data-role="mseg-launcher-rate-readout">1.000 s</div>
                    <button
                        class="mseg-loop-button mseg-launcher-loop-button"
                        type="button"
                        data-role="mseg-launcher-loop-button"
                        aria-pressed="true"
                        aria-label="Toggle full-shape loop"
                    >
                        ${getMsegLoopIconSVG()}
                    </button>
                </div>

                <div class="mseg-controls">
                    <label class="mseg-depth">
                        <span class="mseg-depth-label">Depth To Wavetable Position</span>
                        <input class="mseg-depth-slider" type="range" min="-1" max="1" step="0.001" value="1.000" />
                    </label>
                    <div class="mseg-depth-readout" data-role="mseg-depth-readout">1.000</div>
                </div>
            </div>
        </div>
    `;
}

function buildMsegModalHTML() {
    return `
        <div class="mseg-modal-layer" data-role="mseg-modal-layer" data-open="false">
            <button class="mseg-modal-backdrop" type="button" data-role="mseg-modal-backdrop" aria-label="Close MSEG editor"></button>
            <section class="mseg-modal" aria-hidden="true">
                <div class="mseg-modal-head">
                    <div class="mseg-modal-copy">
                        <div class="mseg-eyebrow">MSEG 1</div>
                        <strong class="mseg-route-title">Fixed Wavetable Route</strong>
                    </div>
                    <button class="mseg-modal-close" type="button" data-role="mseg-modal-close">Done</button>
                </div>

                <div class="mseg-modal-stage">
                    <div class="mseg-editor-shell mseg-modal-editor-shell">
                        ${buildMsegSurfaceHTML("mseg-modal", "mseg-modal-surface")}
                    </div>
                </div>

                <div class="mseg-modal-footer">
                    <label class="mseg-rate">
                        <span class="mseg-depth-label">Time In Seconds</span>
                        <input
                            class="mseg-rate-slider"
                            type="range"
                            aria-label="MSEG time in seconds"
                            min="${MSEG_RATE_MIN_SECONDS.toFixed(3)}"
                            max="${MSEG_RATE_MAX_SECONDS.toFixed(3)}"
                            step="0.001"
                            value="1.000"
                        />
                    </label>
                    <div class="mseg-modal-footer-actions">
                        <div class="mseg-rate-readout" data-role="mseg-rate-readout">1.000 s</div>
                        <button class="mseg-loop-button" type="button" data-role="mseg-loop-button" aria-pressed="true" aria-label="Toggle full-shape loop">
                            ${getMsegLoopIconSVG()}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function getMsegStyles(platform = "desktop") {
    const compact = platform === "ios";
    return `
        .mseg-shell {
            min-width: 0;
            display: grid;
            gap: ${compact ? "10px" : "12px"};
            ${compact
                ? ""
                : `
                    border-radius: 16px;
                    border: 1px solid rgba(var(--cosimo-accent-blue-rgb), 0.14);
                    background: rgba(5, 8, 20, 0.88);
                    padding: 14px;
                `}
        }

        .mseg-launcher {
            display: grid;
            gap: 12px;
            min-width: 0;
        }

        .mseg-launcher-head,
        .mseg-modal-head {
            display: flex;
            justify-content: space-between;
            align-items: end;
            gap: 12px;
        }

        .mseg-launcher-copy,
        .mseg-modal-copy {
            display: grid;
            gap: 4px;
            min-width: 0;
        }

        .mseg-eyebrow {
            font-size: 10px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: rgba(212, 220, 230, ${compact ? "0.34" : "0.42"});
            font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
        }

        .mseg-route-title {
            font-size: ${compact ? "15px" : "16px"};
            font-weight: 600;
            color: #eef2f5;
            letter-spacing: -0.03em;
        }

        .mseg-modal-close {
            border: 1px solid rgba(var(--cosimo-accent-blue-rgb), 0.22);
            border-radius: 999px;
            background: rgba(var(--cosimo-accent-blue-rgb), 0.1);
            color: var(--cosimo-accent-blue);
            min-height: 38px;
            padding: 0 14px;
            font-size: 11px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .mseg-preview-button {
            width: 100%;
            border: 0;
            padding: 0;
            margin: 0;
            background: transparent;
            color: inherit;
            text-align: left;
        }

        .mseg-preview-shell {
            border-radius: ${compact ? "18px" : "14px"};
            overflow: hidden;
            border: 1px solid rgba(var(--cosimo-accent-blue-rgb), 0.16);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 18%),
                linear-gradient(180deg, rgba(9, 13, 24, 0.94), rgba(4, 7, 15, 0.98));
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .mseg-preview-surface {
            display: block;
            width: 100%;
            height: ${compact ? "128px" : "142px"};
        }

        .mseg-preview-footer {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
            align-items: center;
        }

        .mseg-launcher-rate-readout {
            font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
            font-size: 12px;
            letter-spacing: 0.08em;
            color: var(--cosimo-accent-blue);
            min-width: 0;
            white-space: nowrap;
        }

        .mseg-controls {
            display: grid;
            min-width: 0;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 12px;
            align-items: end;
        }

        .mseg-depth,
        .mseg-rate {
            display: grid;
            gap: 6px;
            min-width: 0;
        }

        .mseg-depth-label {
            font-size: 10px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: rgba(212, 220, 230, ${compact ? "0.42" : "0.72"});
        }

        .mseg-depth-readout,
        .mseg-rate-readout {
            font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
            font-size: 12px;
            letter-spacing: 0.08em;
            color: var(--cosimo-accent-blue);
        }

        .mseg-rate-slider,
        .mseg-depth-slider {
            width: 100%;
            accent-color: var(--cosimo-accent-blue);
        }

        .mseg-surface {
            display: block;
            width: 100%;
        }

        .mseg-grid {
            stroke: rgba(255, 255, 255, 0.07);
            stroke-width: 1;
        }

        .mseg-fill {
            fill: rgba(var(--cosimo-accent-blue-rgb), 0.18);
        }

        .mseg-curve {
            fill: none;
            stroke: var(--cosimo-accent-blue);
            stroke-width: 3;
            stroke-linejoin: round;
            stroke-linecap: round;
        }

        .mseg-point {
            fill: rgba(var(--cosimo-background-rgb), 0.95);
            stroke: var(--cosimo-accent-blue);
            stroke-width: 3;
        }

        .mseg-point.selected {
            fill: rgba(var(--cosimo-accent-blue-rgb), 0.22);
            stroke-width: 3.25;
        }

        .mseg-editor-shell {
            position: relative;
            border-radius: ${compact ? "22px" : "18px"};
            overflow: hidden;
            border: 1px solid rgba(var(--cosimo-accent-blue-rgb), 0.18);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 16%),
                linear-gradient(180deg, rgba(9, 13, 24, 0.94), rgba(4, 7, 15, 0.98));
            box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.04),
                inset 0 -30px 54px rgba(2, 4, 12, 0.44);
        }

        .mseg-modal-layer {
            position: absolute;
            inset: 0;
            z-index: 20;
            display: grid;
            padding: ${compact
                ? "max(10px, env(safe-area-inset-top)) 10px 10px 10px"
                : "18px"};
            opacity: 0;
            pointer-events: none;
            transition: opacity 180ms ease;
        }

        .mseg-modal-layer[data-open="true"] {
            opacity: 1;
            pointer-events: auto;
        }

        .mseg-modal-backdrop {
            position: absolute;
            inset: 0;
            border: 0;
            padding: 0;
            margin: 0;
            background: rgba(2, 4, 11, 0.82);
            backdrop-filter: blur(10px);
        }

        .mseg-modal {
            position: relative;
            z-index: 1;
            min-width: 0;
            min-height: 0;
            display: grid;
            grid-template-rows: ${compact ? "0 minmax(0, 1fr) auto" : "auto minmax(0, 1fr) auto"};
            gap: 12px;
            padding: ${compact ? "14px" : "18px"};
            border-radius: ${compact ? "26px" : "24px"};
            border: 1px solid rgba(var(--cosimo-accent-blue-rgb), 0.18);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 16%),
                rgba(5, 8, 20, 0.98);
            box-shadow:
                0 26px 60px rgba(2, 4, 12, 0.58),
                inset 0 1px 0 rgba(255, 255, 255, 0.04);
            transform: translateY(18px) scale(0.985);
            opacity: 0;
            transition:
                transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
                opacity 180ms ease;
        }

        .mseg-modal-layer[data-open="true"] .mseg-modal {
            transform: translateY(0) scale(1);
            opacity: 1;
        }

        .mseg-modal-stage {
            min-height: 0;
            display: grid;
        }

        .mseg-modal-editor-shell {
            min-height: ${compact ? "220px" : "340px"};
            height: 100%;
        }

        .mseg-modal-surface {
            width: 100%;
            height: 100%;
            touch-action: none;
            cursor: crosshair;
        }

        .mseg-modal-footer {
            display: grid;
            min-width: 0;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 12px;
            align-items: end;
        }

        .mseg-modal-footer-actions {
            display: grid;
            gap: 10px;
            justify-items: end;
        }

        .mseg-loop-button {
            width: 48px;
            height: 48px;
            border-radius: 999px;
            border: 1px solid rgba(var(--cosimo-accent-blue-rgb), 0.18);
            background: rgba(var(--cosimo-background-rgb), 0.68);
            color: rgba(var(--cosimo-accent-blue-rgb), 0.42);
            display: grid;
            place-items: center;
            padding: 0;
        }

        .mseg-loop-button[aria-pressed="true"] {
            background: rgba(var(--cosimo-accent-blue-rgb), 0.16);
            color: var(--cosimo-accent-blue);
            box-shadow:
                inset 0 0 0 1px rgba(var(--cosimo-accent-blue-rgb), 0.18),
                0 0 18px rgba(var(--cosimo-accent-blue-rgb), 0.12);
        }

        .mseg-loop-button svg {
            width: 20px;
            height: 20px;
            display: block;
        }

        .mseg-launcher-loop-button {
            width: 42px;
            height: 42px;
        }

        .mseg-loop-button path {
            fill: currentColor;
        }

        .mseg-preview-button:active,
        .mseg-modal-close:active,
        .mseg-loop-button:active {
            transform: translateY(1px) scale(0.985);
        }

        ${compact ? `
            .mseg-modal-layer {
                position: relative;
                inset: auto;
                min-height: 0;
                padding: 0;
            }

            .mseg-modal-backdrop {
                display: none;
            }

            .mseg-modal {
                position: relative;
                inset: auto;
                display: flex;
                flex-direction: column;
                gap: 6px;
                min-height: 100%;
                padding: 4px 10px 0;
                border: 0;
                border-radius: 0;
                background: transparent;
                box-shadow: none;
            }

            .mseg-modal-head {
                position: absolute;
                top: 4px;
                right: 4px;
                left: 4px;
                z-index: 2;
                justify-content: flex-end;
                align-items: start;
                pointer-events: none;
            }

            .mseg-modal-copy {
                display: none;
            }

            .mseg-modal-close {
                pointer-events: auto;
                min-height: 32px;
                padding: 0 12px;
                border: 0;
                background: rgba(var(--cosimo-background-rgb), 0.72);
                color: rgba(var(--cosimo-accent-blue-rgb), 0.9);
                box-shadow: inset 0 0 0 1px rgba(var(--cosimo-accent-blue-rgb), 0.14);
            }

            .mseg-modal-stage {
                flex: 1 1 auto;
                min-height: 0;
            }

            .mseg-modal-editor-shell {
                min-height: 0;
                border-radius: 18px;
                border-color: rgba(var(--cosimo-accent-blue-rgb), 0.12);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
            }

            .mseg-modal-footer {
                grid-template-columns: minmax(0, 1fr) auto auto;
                gap: 8px;
                align-items: center;
                padding: 0 2px 0;
            }

            .mseg-modal-footer .mseg-rate {
                gap: 0;
            }

            .mseg-modal-footer .mseg-depth-label {
                display: none;
            }

            .mseg-modal-footer-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .mseg-rate-readout {
                font-size: 11px;
                white-space: nowrap;
            }

            .mseg-loop-button {
                width: auto;
                height: auto;
                min-width: 34px;
                min-height: 34px;
                border: 0;
                border-radius: 0;
                background: transparent;
                box-shadow: none;
                padding: 4px;
            }

            .mseg-loop-button[aria-pressed="true"] {
                background: transparent;
                box-shadow: none;
            }

            .mseg-loop-button svg {
                width: 18px;
                height: 18px;
            }
        ` : ""}
    `;
}

export function displayPositionsMatch(left, right, epsilon = DISPLAY_POSITION_EPSILON) {
    return Math.abs(clampDisplayPosition(left) - clampDisplayPosition(right)) <= epsilon;
}

export function mapDisplayDragToPosition(startValue, startClientY, nextClientY, dragSpan) {
    const safeSpan = Math.max(1, Number(dragSpan) || 0);
    const delta = (Number(startClientY) || 0) - (Number(nextClientY) || 0);

    return clampDisplayPosition((Number(startValue) || 0) + (delta / safeSpan));
}

export function normalizeEffectiveWavetablePositionMessage(message) {
    const payload = message?.event ?? message;

    if (payload === null || payload === undefined) {
        return null;
    }

    if (typeof payload === "number") {
        return {
            voiceGeneration: 0,
            position: clampDisplayPosition(payload),
        };
    }

    const rawPosition = Number(payload?.position);
    if (!Number.isFinite(rawPosition)) {
        return null;
    }

    const rawGeneration = Number(payload?.voiceGeneration);
    return {
        voiceGeneration: Number.isFinite(rawGeneration)
            ? Math.max(0, Math.trunc(rawGeneration))
            : 0,
        position: clampDisplayPosition(rawPosition),
    };
}

export function selectObservedWavetablePositionState(currentState, message) {
    const previousState = currentState && typeof currentState === "object"
        ? {
            voiceGeneration: Number.isFinite(Number(currentState.voiceGeneration))
                ? Math.trunc(Number(currentState.voiceGeneration))
                : -1,
            position: clampDisplayPosition(currentState.position),
        }
        : {
            voiceGeneration: -1,
            position: knobDefault,
        };
    const nextState = normalizeEffectiveWavetablePositionMessage(message);

    if (!nextState) {
        return previousState;
    }

    if (nextState.voiceGeneration < previousState.voiceGeneration) {
        return previousState;
    }

    return nextState;
}

export function normalizeRuntimeTableState(message) {
    const payload = message?.event ?? message;

    if (!payload || typeof payload !== "object") {
        return null;
    }

    return {
        desiredTableIndex: Math.max(0, Math.trunc(Number(payload.desiredTableIndex) || 0)),
        desiredIntentSerial: Math.max(0, Math.trunc(Number(payload.desiredIntentSerial) || 0)),
        serviceState: Math.max(0, Math.trunc(Number(payload.serviceState) || 0)),
        hasActive: Boolean(payload.hasActive),
        activeTableIndex: Math.max(0, Math.trunc(Number(payload.activeTableIndex) || 0)),
        activeGeneration: Math.max(0, Math.trunc(Number(payload.activeGeneration) || 0)),
        hasLoading: Boolean(payload.hasLoading),
        loadingTableIndex: Math.max(0, Math.trunc(Number(payload.loadingTableIndex) || 0)),
        loadingGeneration: Math.max(0, Math.trunc(Number(payload.loadingGeneration) || 0)),
        hasFailure: Boolean(payload.hasFailure),
        failedTableIndex: Math.max(0, Math.trunc(Number(payload.failedTableIndex) || 0)),
        failedGeneration: Math.max(0, Math.trunc(Number(payload.failedGeneration) || 0)),
        failureScope: Math.max(0, Math.trunc(Number(payload.failureScope) || 0)),
        failurePhase: Math.max(0, Math.trunc(Number(payload.failurePhase) || 0)),
        failureReasonCode: Math.max(0, Math.trunc(Number(payload.failureReasonCode) || 0)),
    };
}

function describeRuntimeTableFailure(normalized) {
    if (!normalized?.hasFailure) {
        return null;
    }

    if (
        normalized.failurePhase === runtimeFailurePhaseTransferMip &&
        normalized.failureReasonCode === runtimeFailureReasonTimeout
    ) {
        return "Wavetable load timed out.";
    }

    if (normalized.failurePhase === runtimeFailurePhaseLoadSource) {
        return "Could not read wavetable source.";
    }

    if (normalized.failurePhase === runtimeFailurePhaseBuildMip) {
        return "Could not build wavetable mip data.";
    }

    if (normalized.failurePhase === runtimeFailurePhaseTransferMip) {
        return "Could not transfer wavetable mip data.";
    }

    return "Wavetable load failed.";
}

function describeRuntimeTableFailureDetails(normalized, tableName = "Requested wavetable") {
    if (!normalized?.hasFailure) {
        return null;
    }

    const phaseLabel = normalized.failurePhase === runtimeFailurePhaseLoadSource
        ? "source read"
        : normalized.failurePhase === runtimeFailurePhaseBuildMip
            ? "mip build"
            : normalized.failurePhase === runtimeFailurePhaseTransferMip
                ? "mip transfer"
                : "unknown phase";
    const scopeLabel = normalized.failureScope === runtimeFailureScopeService
        ? "committed load"
        : "candidate load";
    const generationLabel = normalized.failedGeneration > 0
        ? `generation ${normalized.failedGeneration}`
        : "candidate generation";
    const reasonLabel = normalized.failureReasonCode === runtimeFailureReasonTimeout
        ? "timeout"
        : "generic failure";

    return `${tableName} failed during ${phaseLabel} (${scopeLabel}, ${generationLabel}, ${reasonLabel}).`;
}

function summarizeRuntimeTableStateForLog(normalized) {
    if (!normalized) {
        return null;
    }

    return {
        desiredTableIndex: normalized.desiredTableIndex,
        desiredIntentSerial: normalized.desiredIntentSerial,
        serviceState: normalized.serviceState,
        active: normalized.hasActive
            ? {
                tableIndex: normalized.activeTableIndex,
                generation: normalized.activeGeneration,
            }
            : null,
        loading: normalized.hasLoading
            ? {
                tableIndex: normalized.loadingTableIndex,
                generation: normalized.loadingGeneration,
            }
            : null,
        failure: normalized.hasFailure
            ? {
                tableIndex: normalized.failedTableIndex,
                generation: normalized.failedGeneration,
                scope: normalized.failureScope,
                phase: normalized.failurePhase,
                reason: normalized.failureReasonCode,
            }
            : null,
    };
}

export function resolveRuntimeTablePresentation(message, fallbackTableIndex = 0) {
    const normalized = normalizeRuntimeTableState(message);
    const safeFallbackTableIndex = Math.max(0, Math.trunc(Number(fallbackTableIndex) || 0));

    if (!normalized) {
        return {
            desiredTableIndex: safeFallbackTableIndex,
            presentedTableIndex: safeFallbackTableIndex,
            activeTableIndex: null,
            activeGeneration: null,
            loadingTableIndex: null,
            loadingGeneration: null,
            isPendingSelection: false,
            isRetryableFailure: false,
            failureMessage: null,
        };
    }

    const activeTableIndex = normalized.hasActive ? normalized.activeTableIndex : null;
    const activeGeneration = normalized.hasActive ? normalized.activeGeneration : null;
    const loadingTableIndex = normalized.hasLoading ? normalized.loadingTableIndex : null;
    const loadingGeneration = normalized.hasLoading ? normalized.loadingGeneration : null;
    const presentedTableIndex = activeTableIndex ?? loadingTableIndex ?? normalized.desiredTableIndex;

    return {
        desiredTableIndex: normalized.desiredTableIndex,
        presentedTableIndex,
        activeTableIndex,
        activeGeneration,
        loadingTableIndex,
        loadingGeneration,
        isPendingSelection: loadingTableIndex !== null || (
            activeTableIndex !== null && normalized.desiredTableIndex !== activeTableIndex
        ),
        isRetryableFailure: normalized.hasFailure && normalized.failedTableIndex === normalized.desiredTableIndex,
        failureMessage: describeRuntimeTableFailure(normalized),
    };
}

function registerCustomElement(name, elementClass) {
    if (!window.customElements.get(name)) {
        window.customElements.define(name, elementClass);
    }
}

function findParameterEndpointInfo(status, endpointID) {
    return status?.details?.inputs?.find(
        (endpointInfo) =>
            endpointInfo?.endpointID === endpointID &&
            endpointInfo?.purpose === "parameter"
    );
}

function formatOrdinal(value) {
    return String(value).padStart(2, "0");
}

function measureElementRect(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
        return null;
    }

    const rect = element.getBoundingClientRect();

    return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
    };
}

function measureElementStyle(element) {
    if (!element || typeof globalThis.getComputedStyle !== "function") {
        return null;
    }

    const style = globalThis.getComputedStyle(element);

    return {
        display: style.display,
        position: style.position,
        top: style.top,
        right: style.right,
        bottom: style.bottom,
        left: style.left,
        width: style.width,
        height: style.height,
        minHeight: style.minHeight,
        maxWidth: style.maxWidth,
        overflow: style.overflow,
        overflowY: style.overflowY,
        gridRow: style.gridRow,
        gridTemplateRows: style.gridTemplateRows,
        alignSelf: style.alignSelf,
    };
}

export function collectCosimoLayoutMetrics() {
    const host = globalThis.document?.querySelector?.("cosimo-synth-view");
    const shadow = host?.shadowRoot ?? null;
    const shell = shadow?.querySelector?.(".ios-shell") ?? null;
    const topRow = shadow?.querySelector?.(".ios-top-row") ?? null;
    const mainView = shadow?.querySelector?.(".ios-main-view") ?? null;
    const scroll = shadow?.querySelector?.(".ios-scroll") ?? null;
    const content = shadow?.querySelector?.(".ios-content") ?? null;
    const footer = shadow?.querySelector?.(".keyboard-footer") ?? null;
    const toolbar = shadow?.querySelector?.(".keyboard-toolbar") ?? null;
    const keyboardHost = shadow?.querySelector?.(".keyboard-host") ?? null;
    const keyboard = shadow?.querySelector?.(".keyboard") ?? null;
    const displayStatus = shadow?.querySelector?.("[data-role='display-status']") ?? shadow?.querySelector?.(".display-status") ?? null;
    const bankReadout = shadow?.querySelector?.(".bank-readout") ?? null;
    const tableErrorBanner = shadow?.querySelector?.("[data-role='table-error-banner']") ?? null;
    const wrapperErrorText = globalThis.document?.querySelector?.("#cmaj-error-text") ?? null;

    const viewportWidth =
        Number(globalThis.visualViewport?.width) ||
        Number(globalThis.window?.innerWidth) ||
        0;
    const viewportHeight =
        Number(globalThis.visualViewport?.height) ||
        Number(globalThis.window?.innerHeight) ||
        0;

    return {
        viewport: {
            width: viewportWidth,
            height: viewportHeight,
            scrollX: Number(globalThis.window?.scrollX) || 0,
            scrollY: Number(globalThis.window?.scrollY) || 0,
            visualWidth: Number(globalThis.visualViewport?.width) || null,
            visualHeight: Number(globalThis.visualViewport?.height) || null,
        },
        shellChildren: shell ? Array.from(shell.children, (node) => node.className || node.tagName) : null,
        footerChildren: footer ? Array.from(footer.children, (node) => node.className || node.tagName) : null,
        keyboardHostChildren: keyboardHost ? Array.from(keyboardHost.children, (node) => node.className || node.tagName) : null,
        isReady: Boolean(host && shadow && shell && footer && keyboardHost && keyboard),
        hostRect: measureElementRect(host),
        shellRect: measureElementRect(shell),
        topRowRect: measureElementRect(topRow),
        mainViewRect: measureElementRect(mainView),
        scrollRect: measureElementRect(scroll),
        contentRect: measureElementRect(content),
        toolbarRect: measureElementRect(toolbar),
        footerRect: measureElementRect(footer),
        keyboardHostRect: measureElementRect(keyboardHost),
        keyboardRect: measureElementRect(keyboard),
        shellStyle: measureElementStyle(shell),
        footerStyle: measureElementStyle(footer),
        keyboardHostStyle: measureElementStyle(keyboardHost),
        keyboardStyle: measureElementStyle(keyboard),
        displayStatusText: displayStatus?.textContent?.trim?.() ?? null,
        bankReadoutText: bankReadout?.textContent?.trim?.() ?? null,
        tableErrorText: tableErrorBanner?.textContent?.trim?.() ?? null,
        tableErrorHidden: tableErrorBanner?.hidden ?? null,
        wrapperErrorText: wrapperErrorText?.textContent?.trim?.() ?? null,
        footerBottomGap: footer ? viewportHeight - footer.getBoundingClientRect().bottom : null,
        keyboardBottomGap: keyboard ? viewportHeight - keyboard.getBoundingClientRect().bottom : null,
    };
}

if (typeof globalThis === "object") {
    globalThis.__cosimoCollectLayoutMetrics = collectCosimoLayoutMetrics;
}

function getKeyboardTagName(keyboardStyle) {
    return `cosimo-synth-keyboard-${keyboardStyle}`;
}

function defineKeyboardElement(patchConnection, keyboardStyle, keyboardOptions) {
    const tagName = getKeyboardTagName(keyboardStyle);

    if (!window.customElements.get(tagName)) {
        const CosimoKeyboard = class extends patchConnection.utilities.PianoKeyboard {
            constructor() {
                super({
                    naturalNoteWidth: keyboardOptions.naturalNoteWidth,
                    accidentalWidth: keyboardOptions.accidentalWidth,
                    accidentalPercentageHeight: 64,
                    pressedNoteColour: "#f56cb6",
                });
            }

            bindRenderedTouchHandlers() {
                for (const child of this.root.children) {
                    child.addEventListener("touchstart", (event) => this.touchStart(event), { passive: false });
                    child.addEventListener("touchend", (event) => this.touchEnd(event));
                }
            }

            attributeChangedCallback(name, oldValue, newValue) {
                super.attributeChangedCallback?.(name, oldValue, newValue);

                if (oldValue === newValue) {
                    return;
                }

                this.notes = [];
                this.refreshHTML();
                this.bindRenderedTouchHandlers();
                this.refreshActiveNoteElements();
            }
        };

        registerCustomElement(tagName, CosimoKeyboard);
    }

    return tagName;
}

export class CosimoSynthView extends HTMLElement {
    constructor(patchConnection, options = {}) {
        super();

        const initialViewportWidth =
            Number(globalThis.visualViewport?.width) ||
            Number(globalThis.window?.innerWidth) ||
            393;
        const initialViewportHeight =
            Number(globalThis.visualViewport?.height) ||
            Number(globalThis.window?.innerHeight) ||
            852;

        this.patchConnection = patchConnection;
        this.options = { platform: "desktop", ...options };
        this.currentValue = knobDefault;
        this.currentDisplayPosition = knobDefault;
        this.currentTableIndex = 0;
        this.desiredTableIndex = 0;
        this.currentFrameCount = 1;
        this.currentPlayMode = 0;
        this.currentGlideTime = 0.0;
        this.hasDisplayedValue = false;
        this.display = null;
        this.displaySlots = [];
        this.activeDisplaySlotIndex = 0;
        this.observedWavetablePositionState = {
            voiceGeneration: -1,
            position: knobDefault,
        };
        this.hasEffectiveWavetablePositionMonitor = false;
        this.displayFramesCache = new Map();
        this.displayFramesLoading = new Map();
        this.factoryBankCatalog = null;
        this.latestRuntimeTableState = null;
        this.latchedRuntimeFailureState = null;
        this.runtimeTablePresentation = resolveRuntimeTablePresentation(null, 0);
        this.hasRuntimeTableState = false;
        this.nextDisplaySelectionToken = 1;
        this.resizeObserver = null;
        this.windowResizeListener = null;
        this.currentLayout = computeResponsivePatchLayout({
            width: this.options.platform === "ios" ? initialViewportWidth : 1120,
            height: this.options.platform === "ios" ? initialViewportHeight : 680,
            platform: this.options.platform,
        });
        this.keyboardStyle = "";
        this.keyboardNoteCount = 0;
        this.keyboardRootNote = 36;
        this.keyboardMinRootNote = 12;
        this.keyboardMaxRootNote = 72;
        this.knobEndpointID = null;
        this.scanRailEndpointID = null;
        this.tableSelectEndpointID = null;
        this.activeDisplayDrag = null;
        this.msegController = null;
        this.msegState = null;
        this.isMsegModalOpen = false;
        this.selectedMsegPointIndex = 0;
        this.activeMsegPointer = null;
        this.msegPreviewSurface = null;
        this.msegModalSurface = null;

        this.attachShadow({ mode: "open" });

        try {
            this.initialiseView();
        } catch (error) {
            console.error(error);
            this.showError(error);
        }
    }

    disconnectedCallback() {
        this.resizeObserver?.disconnect();

        if (this.windowResizeListener) {
            window.removeEventListener("resize", this.windowResizeListener);
        }

        if (this.keyboard) {
            this.keyboard.detachPatchConnection?.(this.patchConnection);
        }

        if (this.handleParameterChange) {
            this.patchConnection.removeParameterListener(
                wavetablePositionEndpointID,
                this.handleParameterChange
            );
        }

        if (this.handlePlayModeParameterChange) {
            this.patchConnection.removeParameterListener(
                playModeEndpointID,
                this.handlePlayModeParameterChange
            );
        }

        if (this.handleGlideTimeParameterChange) {
            this.patchConnection.removeParameterListener(
                glideTimeEndpointID,
                this.handleGlideTimeParameterChange
            );
        }

        if (this.handleEffectiveWavetablePositionChange && this.hasEffectiveWavetablePositionMonitor) {
            this.patchConnection.removeEndpointListener?.(
                effectiveWavetablePositionEndpointID,
                this.handleEffectiveWavetablePositionChange
            );
        }

        if (this.handleRuntimeTableStateChange) {
            this.patchConnection.removeEndpointListener?.(
                runtimeStateEndpointID,
                this.handleRuntimeTableStateChange
            );
        }

        if (this.handleStatusUpdate) {
            this.patchConnection.removeStatusListener(this.handleStatusUpdate);
        }

        this.msegController?.detach();

        if (this.scanRailInput && this.handleScanRailInput) {
            this.scanRailInput.removeEventListener("input", this.handleScanRailInput);
            this.scanRailInput.removeEventListener("pointerdown", this.handleScanRailGestureStart);
            this.scanRailInput.removeEventListener("pointerup", this.handleScanRailGestureEnd);
            this.scanRailInput.removeEventListener("change", this.handleScanRailGestureEnd);
            this.stepDownButton?.removeEventListener("click", this.handleScanStepDown);
            this.stepUpButton?.removeEventListener("click", this.handleScanStepUp);
        }

        if (this.displayViewport && this.handleDisplayDragStart) {
            this.displayViewport.removeEventListener("pointerdown", this.handleDisplayDragStart);
            this.displayViewport.removeEventListener("pointermove", this.handleDisplayDragMove);
            this.displayViewport.removeEventListener("pointerup", this.handleDisplayDragEnd);
            this.displayViewport.removeEventListener("pointercancel", this.handleDisplayDragEnd);
        }

        if (this.tableSelect && this.handleTableSelectChange) {
            this.tableSelect.removeEventListener("change", this.handleTableSelectChange);
        }

        if (this.tableRetryButton && this.handleRetryButtonClick) {
            this.tableRetryButton.removeEventListener("click", this.handleRetryButtonClick);
        }

        if (this.msegModalSurface?.viewport && this.handleMsegPointerDown) {
            this.msegModalSurface.viewport.removeEventListener("pointerdown", this.handleMsegPointerDown);
            this.msegModalSurface.viewport.removeEventListener("pointermove", this.handleMsegPointerMove);
            this.msegModalSurface.viewport.removeEventListener("pointerup", this.handleMsegPointerUp);
            this.msegModalSurface.viewport.removeEventListener("pointercancel", this.handleMsegPointerUp);
        }

        if (this.msegPreviewButton && this.handleOpenMsegModal) {
            this.msegPreviewButton.removeEventListener("click", this.handleOpenMsegModal);
        }

        if (this.msegModalCloseButton && this.handleCloseMsegModal) {
            this.msegModalCloseButton.removeEventListener("click", this.handleCloseMsegModal);
        }

        if (this.msegModalBackdrop && this.handleCloseMsegModal) {
            this.msegModalBackdrop.removeEventListener("click", this.handleCloseMsegModal);
        }

        if (this.msegDepthInput && this.handleMsegDepthInput) {
            this.msegDepthInput.removeEventListener("input", this.handleMsegDepthInput);
        }

        if (this.msegRateInput && this.handleMsegRateInput) {
            this.msegRateInput.removeEventListener("input", this.handleMsegRateInput);
        }

        if (this.playModeSelect && this.handlePlayModeInput) {
            this.playModeSelect.removeEventListener("change", this.handlePlayModeInput);
        }

        if (this.glideTimeInput && this.handleGlideTimeInput) {
            this.glideTimeInput.removeEventListener("input", this.handleGlideTimeInput);
        }

        if (this.msegLoopButton && this.handleMsegLoopInput) {
            this.msegLoopButton.removeEventListener("click", this.handleMsegLoopInput);
        }

        if (this.msegLauncherLoopButton && this.handleMsegLoopInput) {
            this.msegLauncherLoopButton.removeEventListener("click", this.handleMsegLoopInput);
        }

        if (this.octaveDownButton && this.handleOctaveDown) {
            this.octaveDownButton.removeEventListener("click", this.handleOctaveDown);
        }

        if (this.octaveUpButton && this.handleOctaveUp) {
            this.octaveUpButton.removeEventListener("click", this.handleOctaveUp);
        }
    }

    initialiseView() {
        this.shadowRoot.innerHTML = this.getHTML();

        this.knobControlHost = this.shadowRoot.querySelector(".knob-control-host");
        this.valueReadout = this.shadowRoot.querySelector("[data-role='value-readout']");
        this.frameReadout = this.shadowRoot.querySelector("[data-role='frame-readout']");
        this.heroFrameReadout = this.shadowRoot.querySelector("[data-role='hero-frame-readout']");
        this.keyboardHost = this.shadowRoot.querySelector(".keyboard-host");
        this.hint = this.shadowRoot.querySelector(".hint");
        this.displayViewport = this.shadowRoot.querySelector(".wavetable-stage");
        this.displayLayers = Array.from(this.shadowRoot.querySelectorAll(".wavetable-layer"));
        this.displayCanvases = Array.from(this.shadowRoot.querySelectorAll(".wavetable-canvas"));
        this.displayOverlay = this.shadowRoot.querySelector(".display-overlay");
        this.displayStatus = this.shadowRoot.querySelector("[data-role='display-status']");
        this.bankReadout = this.shadowRoot.querySelector(".bank-readout");
        this.tableErrorBanner = this.shadowRoot.querySelector("[data-role='table-error-banner']");
        this.stageGestureHint = this.shadowRoot.querySelector("[data-role='stage-gesture-hint']");
        this.scanRailInput = this.shadowRoot.querySelector(".scan-slider");
        this.stepDownButton = this.shadowRoot.querySelector(".step-down");
        this.stepUpButton = this.shadowRoot.querySelector(".step-up");
        this.tableSelect = this.shadowRoot.querySelector(".table-select");
        this.tableRetryButton = this.shadowRoot.querySelector(".table-retry-button");
        this.bankPickerTrigger = this.shadowRoot.querySelector(".bank-picker-trigger");
        this.railLabelStart = this.shadowRoot.querySelector("[data-role='rail-label-start']");
        this.railLabelMid = this.shadowRoot.querySelector("[data-role='rail-label-mid']");
        this.railLabelEnd = this.shadowRoot.querySelector("[data-role='rail-label-end']");
        this.octaveDownButton = this.shadowRoot.querySelector(".octave-down");
        this.octaveUpButton = this.shadowRoot.querySelector(".octave-up");
        this.octaveReadout = this.shadowRoot.querySelector("[data-role='octave-readout']");
        this.msegPreviewButton = this.shadowRoot.querySelector(".mseg-preview-button");
        this.msegModalLayer = this.shadowRoot.querySelector("[data-role='mseg-modal-layer']");
        this.msegModalBackdrop = this.shadowRoot.querySelector("[data-role='mseg-modal-backdrop']");
        this.msegModalCloseButton = this.shadowRoot.querySelector("[data-role='mseg-modal-close']");
        this.msegDepthInput = this.shadowRoot.querySelector(".mseg-depth-slider");
        this.msegDepthReadout = this.shadowRoot.querySelector("[data-role='mseg-depth-readout']");
        this.msegLauncherRateReadout = this.shadowRoot.querySelector("[data-role='mseg-launcher-rate-readout']");
        this.msegLauncherLoopButton = this.shadowRoot.querySelector("[data-role='mseg-launcher-loop-button']");
        this.msegRateInput = this.shadowRoot.querySelector(".mseg-rate-slider");
        this.msegRateReadout = this.shadowRoot.querySelector("[data-role='mseg-rate-readout']");
        this.msegLoopButton = this.shadowRoot.querySelector("[data-role='mseg-loop-button']");
        this.playModeSelect = this.shadowRoot.querySelector(".play-mode-select");
        this.glideTimeInput = this.shadowRoot.querySelector(".glide-time-slider");
        this.glideTimeReadout = this.shadowRoot.querySelector("[data-role='glide-time-readout']");
        this.msegPreviewSurface = this.getMsegSurfaceRefs("mseg-preview");
        this.msegModalSurface = this.getMsegSurfaceRefs("mseg-modal");

        this.displaySlots = this.displayCanvases.map((canvas, slotIndex) => ({
            slotIndex,
            layer: this.displayLayers[slotIndex] ?? canvas,
            canvas,
            display: new CanvasWavetableDisplay(canvas),
            tableIndex: null,
            frameCount: 0,
        }));
        this.activeDisplaySlotIndex = 0;
        this.display = this.displaySlots[0]?.display ?? null;
        this.msegController = new MsegController(this.patchConnection, {
            onStateChange: (state) => this.handleMsegStateChange(state),
        });
        this.msegController.attach();

        this.handleParameterChange = this.setDisplayedValue.bind(this);
        this.handlePlayModeParameterChange = this.syncPlayModeControl.bind(this);
        this.handleGlideTimeParameterChange = this.syncGlideTimeControl.bind(this);
        this.handleEffectiveWavetablePositionChange = this.handleObservedDisplayPosition.bind(this);
        this.handleRuntimeTableStateChange = this.handleRuntimeTableState.bind(this);
        this.handleStatusUpdate = this.handlePatchStatus.bind(this);
        this.handleDisplayDragStart = this.beginDisplayDrag.bind(this);
        this.handleDisplayDragMove = this.updateDisplayDrag.bind(this);
        this.handleDisplayDragEnd = this.endDisplayDrag.bind(this);
        this.handleMsegPointerDown = this.beginMsegInteraction.bind(this);
        this.handleMsegPointerMove = this.updateMsegInteraction.bind(this);
        this.handleMsegPointerUp = this.endMsegInteraction.bind(this);
        this.handleOpenMsegModal = this.openMsegModal.bind(this);
        this.handleCloseMsegModal = this.closeMsegModal.bind(this);
        this.handleMsegRateInput = this.handleMsegRateInput.bind(this);
        this.handleMsegLoopInput = this.handleMsegLoopInput.bind(this);
        this.handleMsegDepthInput = () => {
            this.msegController?.setDepth(clampDepth(this.msegDepthInput?.value));
        };
        this.handlePlayModeInput = this.handlePlayModeInput.bind(this);
        this.handleGlideTimeInput = this.handleGlideTimeInput.bind(this);
        this.handleOctaveDown = () => this.nudgeKeyboardOctave(-12);
        this.handleOctaveUp = () => this.nudgeKeyboardOctave(12);
        this.handleTableSelectChange = this.handleTableSelectChange.bind(this);
        this.handleRetryButtonClick = this.handleRetryButtonClick.bind(this);

        if (this.tableSelect) {
            this.tableSelect.addEventListener("change", this.handleTableSelectChange);
        }

        this.tableRetryButton?.addEventListener("click", this.handleRetryButtonClick);
        this.playModeSelect?.addEventListener("change", this.handlePlayModeInput);
        this.glideTimeInput?.addEventListener("input", this.handleGlideTimeInput);

        if (this.displayViewport) {
            this.displayViewport.addEventListener("pointerdown", this.handleDisplayDragStart);
            this.displayViewport.addEventListener("pointermove", this.handleDisplayDragMove);
            this.displayViewport.addEventListener("pointerup", this.handleDisplayDragEnd);
            this.displayViewport.addEventListener("pointercancel", this.handleDisplayDragEnd);
        }

        if (this.msegModalSurface?.viewport) {
            this.msegModalSurface.viewport.addEventListener("pointerdown", this.handleMsegPointerDown);
            this.msegModalSurface.viewport.addEventListener("pointermove", this.handleMsegPointerMove);
            this.msegModalSurface.viewport.addEventListener("pointerup", this.handleMsegPointerUp);
            this.msegModalSurface.viewport.addEventListener("pointercancel", this.handleMsegPointerUp);
        }

        this.msegPreviewButton?.addEventListener("click", this.handleOpenMsegModal);
        this.msegModalCloseButton?.addEventListener("click", this.handleCloseMsegModal);
        this.msegModalBackdrop?.addEventListener("click", this.handleCloseMsegModal);
        this.msegRateInput?.addEventListener("input", this.handleMsegRateInput);
        this.msegLoopButton?.addEventListener("click", this.handleMsegLoopInput);
        this.msegLauncherLoopButton?.addEventListener("click", this.handleMsegLoopInput);
        this.msegDepthInput?.addEventListener("input", this.handleMsegDepthInput);
        this.octaveDownButton?.addEventListener("click", this.handleOctaveDown);
        this.octaveUpButton?.addEventListener("click", this.handleOctaveUp);

        this.applyResponsiveLayout(this.currentLayout, true);

        if (this.options.platform === "ios") {
            this.buildScanRail();
        } else {
            this.buildKnob();
        }

        this.buildKeyboard();
        this.installResizeObserver();
        this.resetDisplayLayerPositions();
        this.setDisplayedValue(knobDefault);
        this.setDisplayState("loading", "Loading wavetable bank…");
        this.syncPlayModeControl(0);
        this.syncGlideTimeControl(0.0);
        this.setMsegModalOpen(false);

        this.patchConnection.addParameterListener(
            wavetablePositionEndpointID,
            this.handleParameterChange
        );
        this.patchConnection.addParameterListener(
            playModeEndpointID,
            this.handlePlayModeParameterChange
        );
        this.patchConnection.addParameterListener(
            glideTimeEndpointID,
            this.handleGlideTimeParameterChange
        );
        if (typeof this.patchConnection.addEndpointListener === "function") {
            try {
                this.patchConnection.addEndpointListener(
                    effectiveWavetablePositionEndpointID,
                    this.handleEffectiveWavetablePositionChange
                );
                this.hasEffectiveWavetablePositionMonitor = true;
            } catch (error) {
                console.warn("Could not subscribe to effective wavetable position updates", error);
            }

            try {
                this.patchConnection.addEndpointListener(
                    runtimeStateEndpointID,
                    this.handleRuntimeTableStateChange
                );
            } catch (error) {
                console.warn("Could not subscribe to runtime wavetable state updates", error);
            }
        }
        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);
        this.patchConnection.requestParameterValue(playModeEndpointID);
        this.patchConnection.requestParameterValue(glideTimeEndpointID);
        this.requestRuntimeTableSync();

        this.patchConnection.addStatusListener(this.handleStatusUpdate);
        this.patchConnection.requestStatusUpdate();
        this.msegController.requestBootState();
    }

    installResizeObserver() {
        const resize = () => {
            const hostBounds = this.getBoundingClientRect();
            const nextLayout = computeResponsivePatchLayout({
                width: hostBounds.width,
                height: hostBounds.height,
                platform: this.options.platform,
            });
            const stageBounds = this.displayViewport.getBoundingClientRect();

            this.applyResponsiveLayout(nextLayout);
            this.syncKeyboardGeometry();
            this.displaySlots.forEach((slot) => {
                slot.display.resize(stageBounds.width, stageBounds.height, window.devicePixelRatio || 1);
            });
            this.resetDisplayLayerPositions();
            this.renderMsegEditor();
        };

        if ("ResizeObserver" in window) {
            this.resizeObserver = new ResizeObserver(() => resize());
            this.resizeObserver.observe(this);
            this.resizeObserver.observe(this.displayViewport);
        } else {
            this.windowResizeListener = () => resize();
            window.addEventListener("resize", this.windowResizeListener);
        }

        requestAnimationFrame(resize);
    }

    applyResponsiveLayout(nextLayout, force = false) {
        const layoutChanged =
            force ||
            this.currentLayout.gridTemplateColumns !== nextLayout.gridTemplateColumns ||
            this.currentLayout.noteCount !== nextLayout.noteCount ||
            this.currentLayout.controlHeight !== nextLayout.controlHeight ||
            this.currentLayout.stageMinHeight !== nextLayout.stageMinHeight ||
            this.currentLayout.keyboardHeight !== nextLayout.keyboardHeight ||
            this.currentLayout.headerStacks !== nextLayout.headerStacks ||
            this.currentLayout.controlStyle !== nextLayout.controlStyle;

        this.currentLayout = nextLayout;
        this.toggleAttribute("stacked-header", nextLayout.headerStacks);

        Object.entries(getLayoutCSSVariables(nextLayout)).forEach(([key, value]) => {
            this.style.setProperty(key, value);
        });

        if (layoutChanged && this.keyboard) {
            this.syncKeyboardLayout();
        }
    }

    getDisplayStageWidth() {
        return Math.max(
            1,
            this.displayViewport?.getBoundingClientRect?.().width ||
                this.displayViewport?.clientWidth ||
                1
        );
    }

    getActiveDisplaySlot() {
        return this.displaySlots[this.activeDisplaySlotIndex] ?? null;
    }

    getInactiveDisplaySlot() {
        if (this.displaySlots.length < 2) {
            return null;
        }

        return this.displaySlots[(this.activeDisplaySlotIndex + 1) % this.displaySlots.length] ?? null;
    }

    setDisplaySlotTransition(slot, enabled) {
        if (!slot?.layer?.style) {
            return;
        }

        slot.layer.style.transition = enabled
            ? `transform ${DISPLAY_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
            : "none";
    }

    setDisplaySlotOffset(slot, offsetPx) {
        if (!slot?.layer?.style) {
            return;
        }

        slot.layer.style.transform = `translate3d(${Number(offsetPx || 0).toFixed(3)}px, 0, 0)`;
    }

    resetDisplayLayerPositions() {
        const activeSlot = this.getActiveDisplaySlot();
        const inactiveSlot = this.getInactiveDisplaySlot();
        const stageWidth = this.getDisplayStageWidth();

        if (activeSlot) {
            this.setDisplaySlotTransition(activeSlot, false);
            this.setDisplaySlotOffset(activeSlot, 0);
        }

        if (inactiveSlot) {
            this.setDisplaySlotTransition(inactiveSlot, false);
            this.setDisplaySlotOffset(inactiveSlot, stageWidth);
        }
    }

    renderBankIntoSlot(slot, bank) {
        if (!slot || !bank) {
            return;
        }

        slot.display.setFrames(bank.frames);
        slot.display.setPosition(this.currentDisplayPosition);
        slot.tableIndex = bank.tableIndex;
        slot.frameCount = bank.frameCount;
    }

    finalizeDisplayedBank(bank) {
        this.currentFrameCount = Math.max(1, Number(bank?.frameCount) || 1);
        this.display = this.getActiveDisplaySlot()?.display ?? this.display;
        this.updateFrameReadouts();
        this.updateBankReadout();
        this.setDisplayState(
            "loaded",
            this.options.platform === "ios"
                ? `${bank.frameCount} shapes`
                : `${bank.frameCount} frames`
        );
    }

    async ensureBankCatalogLoaded() {
        if (this.factoryBankCatalog) {
            return this.factoryBankCatalog;
        }

        this.factoryBankCatalog = await loadFactoryBankCatalogFromPatch(this.patchConnection);
        this.populateTableSelector();
        this.updateBankReadout();
        this.updateFrameReadouts();
        return this.factoryBankCatalog;
    }

    populateTableSelector() {
        if (!this.tableSelect || !this.factoryBankCatalog) {
            return;
        }

        this.tableSelect.innerHTML = "";

        this.factoryBankCatalog.tables.forEach((table, tableIndex) => {
            const option = document.createElement("option");
            option.value = String(tableIndex);
            option.textContent = table.name;
            this.tableSelect.appendChild(option);
        });

        this.desiredTableIndex = clamp(
            this.desiredTableIndex,
            0,
            this.factoryBankCatalog.tables.length - 1
        );
        this.tableSelect.value = String(this.desiredTableIndex);
    }

    getSelectedTableMeta() {
        return this.factoryBankCatalog?.tables?.[this.currentTableIndex] ?? null;
    }

    getDesiredTableMeta() {
        return this.factoryBankCatalog?.tables?.[this.desiredTableIndex] ?? null;
    }

    getVisibleRuntimeFailureState() {
        if (this.latestRuntimeTableState?.hasFailure) {
            return this.latestRuntimeTableState;
        }

        if (!this.latchedRuntimeFailureState) {
            return null;
        }

        if (this.latchedRuntimeFailureState.desiredTableIndex !== this.desiredTableIndex) {
            return null;
        }

        return this.latchedRuntimeFailureState;
    }

    updateLatchedRuntimeFailureState(normalizedRuntimeState) {
        if (!normalizedRuntimeState) {
            return;
        }

        if (normalizedRuntimeState.hasFailure) {
            this.latchedRuntimeFailureState = { ...normalizedRuntimeState };
            return;
        }

        if (!this.latchedRuntimeFailureState) {
            return;
        }

        if (normalizedRuntimeState.desiredTableIndex !== this.latchedRuntimeFailureState.desiredTableIndex) {
            this.latchedRuntimeFailureState = null;
            return;
        }

        if (
            normalizedRuntimeState.hasActive &&
            normalizedRuntimeState.activeTableIndex === normalizedRuntimeState.desiredTableIndex
        ) {
            this.latchedRuntimeFailureState = null;
        }
    }

    updateBankReadout() {
        const showRetry = Boolean(this.runtimeTablePresentation?.isRetryableFailure);
        const visibleFailureState = this.getVisibleRuntimeFailureState();
        const failureMessage = visibleFailureState
            ? describeRuntimeTableFailure(visibleFailureState)
            : null;

        if (this.tableRetryButton) {
            this.tableRetryButton.hidden = !showRetry;
            this.tableRetryButton.disabled = !showRetry;
        }

        if (!this.bankReadout) {
            return;
        }

        const selectedTable = this.getSelectedTableMeta();
        const desiredTable = this.getDesiredTableMeta();
        const failureDetail = visibleFailureState
            ? describeRuntimeTableFailureDetails(
                visibleFailureState,
                desiredTable?.name ?? selectedTable?.name ?? "Requested wavetable"
            )
            : null;

        if (this.tableErrorBanner) {
            this.tableErrorBanner.hidden = !failureDetail;
            this.tableErrorBanner.textContent = failureDetail ?? "";
        }

        if (this.displayStatus && failureMessage) {
            this.displayStatus.textContent = failureMessage;
        } else if (
            this.displayStatus &&
            this.runtimeTablePresentation?.isPendingSelection &&
            desiredTable &&
            desiredTable !== selectedTable
        ) {
            this.displayStatus.textContent = `Loading ${desiredTable.name}…`;
        }

        if (!selectedTable) {
            this.bankReadout.textContent = this.options.platform === "ios"
                ? "Factory bank"
                : "Factory bank";
            return;
        }

        if (failureMessage) {
            if (desiredTable && desiredTable !== selectedTable) {
                this.bankReadout.textContent = this.options.platform === "ios"
                    ? `${selectedTable.name} -> ${desiredTable.name} • ${failureMessage}`
                    : `Audible • ${selectedTable.name} -> Requested • ${desiredTable.name} • ${failureMessage}`;
                return;
            }

            this.bankReadout.textContent = this.options.platform === "ios"
                ? `${selectedTable.name} • ${failureMessage}`
                : `Factory bank • ${selectedTable.name} • ${failureMessage}`;
            return;
        }

        if (
            this.runtimeTablePresentation?.isPendingSelection &&
            desiredTable &&
            desiredTable !== selectedTable
        ) {
            this.bankReadout.textContent = this.options.platform === "ios"
                ? `${selectedTable.name} -> ${desiredTable.name}`
                : `Audible • ${selectedTable.name} -> Requested • ${desiredTable.name}`;
            return;
        }

        this.bankReadout.textContent = this.options.platform === "ios"
            ? selectedTable.name
            : `Factory bank • ${selectedTable.name}`;
    }

    requestRuntimeTableSync() {
        this.patchConnection.sendEventOrValue?.(runtimeSyncRequestEndpointID, 1);
    }

    requestRetryDesiredTable() {
        if (!this.runtimeTablePresentation?.isRetryableFailure) {
            return false;
        }

        emitPatchViewLog("warn", "Retrying failed wavetable load", {
            visibleFailureState: this.getVisibleRuntimeFailureState(),
            runtimeTablePresentation: this.runtimeTablePresentation,
        });
        this.patchConnection.sendEventOrValue?.(retryDesiredTableRequestEndpointID, 1);
        return true;
    }

    handleRetryButtonClick(event) {
        if (this.requestRetryDesiredTable()) {
            event?.preventDefault?.();
        }
    }

    handleTableSelectChange() {
        const nextIndex = Number(this.tableSelect?.value ?? 0);

        if (nextIndex === this.desiredTableIndex && this.requestRetryDesiredTable()) {
            return;
        }

        this.sendSelectedTableIndex(nextIndex);
    }

    updateFrameReadouts() {
        const safeFrameCount = Math.max(1, this.currentFrameCount);
        const frameIndex = Math.round(this.currentDisplayPosition * Math.max(0, safeFrameCount - 1)) + 1;

        if (this.frameReadout) {
            this.frameReadout.textContent = formatOrdinal(frameIndex);
        }

        if (this.heroFrameReadout) {
            this.heroFrameReadout.textContent = `${formatOrdinal(frameIndex)}/${formatOrdinal(safeFrameCount)}`;
        }

        if (this.railLabelStart) {
            this.railLabelStart.textContent = `Shape ${formatOrdinal(1)}`;
        }

        if (this.railLabelMid) {
            this.railLabelMid.textContent = `Shape ${formatOrdinal(Math.max(1, Math.ceil(safeFrameCount / 2)))}`;
        }

        if (this.railLabelEnd) {
            this.railLabelEnd.textContent = `Shape ${formatOrdinal(safeFrameCount)}`;
        }
    }

    async fetchDisplayBank(tableIndex, { showLoadingState = false } = {}) {
        const cachedBank = this.displayFramesCache.get(tableIndex);
        if (cachedBank) {
            return cachedBank;
        }

        const inFlightRequest = this.displayFramesLoading.get(tableIndex);
        if (inFlightRequest) {
            return inFlightRequest;
        }

        if (showLoadingState) {
            this.setDisplayState("loading", "Loading wavetable bank…");
        }

        const request = loadFactoryBankFramesFromPatch(this.patchConnection, { tableIndex })
            .then((bank) => {
                this.displayFramesCache.set(tableIndex, bank);
                return bank;
            })
            .catch((error) => {
                console.error(error);
                emitPatchViewLog("error", "Could not load display wavetable frames", {
                    tableIndex,
                    detail: String(error?.message || error || "Unknown error"),
                });

                if (showLoadingState) {
                    const detail = String(error?.message || error || "Unknown error");
                    this.setDisplayState(
                        "error",
                        formatIOSFactoryLibraryLoadMessage(
                            "Could not load wavetable bank",
                            detail,
                            this.options.platform
                        )
                    );
                    if (this.bankReadout) {
                        this.bankReadout.textContent = this.options.platform === "ios"
                            ? "Display unavailable"
                            : `Display unavailable: ${detail}`;
                    }
                }

                throw error;
            })
            .finally(() => {
                this.displayFramesLoading.delete(tableIndex);
            });

        this.displayFramesLoading.set(tableIndex, request);
        return request;
    }

    preloadAdjacentTables(tableIndex = this.currentTableIndex) {
        const tableCount = this.factoryBankCatalog?.tables?.length ?? 0;

        getAdjacentTableIndices(tableIndex, tableCount).forEach((adjacentTableIndex) => {
            void this.fetchDisplayBank(adjacentTableIndex).catch(() => {});
        });
    }

    applyLoadedBank(bank) {
        const activeSlot = this.getActiveDisplaySlot();
        this.renderBankIntoSlot(activeSlot, bank);
        this.resetDisplayLayerPositions();
        this.finalizeDisplayedBank(bank);
    }

    async animateTableSlide(bank, direction) {
        const activeSlot = this.getActiveDisplaySlot();
        const inactiveSlot = this.getInactiveDisplaySlot();

        if (!activeSlot || !inactiveSlot || direction === 0) {
            this.applyLoadedBank(bank);
            return;
        }

        const stageWidth = this.getDisplayStageWidth();
        const incomingOffset = direction > 0 ? stageWidth : -stageWidth;
        const outgoingOffset = direction > 0 ? -stageWidth : stageWidth;

        this.renderBankIntoSlot(inactiveSlot, bank);
        this.setDisplaySlotTransition(activeSlot, false);
        this.setDisplaySlotTransition(inactiveSlot, false);
        this.setDisplaySlotOffset(activeSlot, 0);
        this.setDisplaySlotOffset(inactiveSlot, incomingOffset);

        await new Promise((resolve) => requestAnimationFrame(resolve));

        this.setDisplaySlotTransition(activeSlot, true);
        this.setDisplaySlotTransition(inactiveSlot, true);
        this.setDisplaySlotOffset(activeSlot, outgoingOffset);
        this.setDisplaySlotOffset(inactiveSlot, 0);

        await new Promise((resolve) => window.setTimeout(resolve, DISPLAY_SLIDE_TRANSITION_MS));

        this.activeDisplaySlotIndex = inactiveSlot.slotIndex;
        this.display = inactiveSlot.display;
        this.finalizeDisplayedBank(bank);
        this.resetDisplayLayerPositions();
    }

    async setSelectedTableIndex(value, { animateDirection = 0 } = {}) {
        const maxTableIndex = this.factoryBankCatalog
            ? Math.max(0, this.factoryBankCatalog.tables.length - 1)
            : 255;
        const nextTableIndex = clamp(Math.round(Number(value) || 0), 0, maxTableIndex);
        const requestToken = this.nextDisplaySelectionToken;
        this.nextDisplaySelectionToken += 1;
        const previousTableIndex = this.currentTableIndex;

        if (this.tableSelect && this.tableSelect.value !== String(nextTableIndex)) {
            this.tableSelect.value = String(nextTableIndex);
        }

        if (
            nextTableIndex === this.currentTableIndex &&
            this.displayFramesCache.has(nextTableIndex) &&
            this.getActiveDisplaySlot()?.tableIndex === nextTableIndex
        ) {
            return;
        }

        this.currentTableIndex = nextTableIndex;
        this.updateBankReadout();

        const bank = await this.fetchDisplayBank(nextTableIndex, { showLoadingState: true });
        if (requestToken !== this.nextDisplaySelectionToken - 1) {
            return;
        }

        if (animateDirection !== 0 && nextTableIndex !== previousTableIndex) {
            await this.animateTableSlide(bank, animateDirection);
        } else {
            this.applyLoadedBank(bank);
        }

        if (nextTableIndex === this.currentTableIndex) {
            this.preloadAdjacentTables(nextTableIndex);
        }
    }

    handlePatchStatus(status) {
        if (status?.error) {
            if (this.hint) {
                this.hint.textContent = "The patch failed to load.";
            }
            this.setDisplayState("error", "The patch failed to load.");
            return;
        }

        const endpointInfo = findParameterEndpointInfo(status, wavetablePositionEndpointID);
        const tableSelectInfo = findParameterEndpointInfo(status, wavetableSelectEndpointID);

        if (endpointInfo) {
            if (this.options.platform === "ios") {
                this.buildScanRail(endpointInfo);
            } else {
                this.buildKnob(endpointInfo);
            }
        }

        if (tableSelectInfo) {
            this.tableSelectEndpointID = tableSelectInfo.endpointID;
        }

        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);
        this.patchConnection.requestParameterValue(playModeEndpointID);
        this.patchConnection.requestParameterValue(glideTimeEndpointID);
        this.requestRuntimeTableSync();
        if (this.hint) {
            this.hint.textContent = this.options.platform === "ios"
                ? ""
                : "Click the keyboard once, then use A W S E D F T G Y H U J K to play notes from your computer keyboard.";
        }

        void this.ensureBankCatalogLoaded()
            .catch((error) => {
                console.error(error);
                const detail = String(error?.message || error || "Unknown error");
                this.setDisplayState(
                    "error",
                    formatIOSFactoryLibraryLoadMessage(
                        "Could not load wavetable catalog",
                        detail,
                        this.options.platform
                    )
                );
            })
            .finally(() => {
                this.applyRuntimeTablePresentation();
            });
    }

    applyRuntimeTablePresentation() {
        if (!this.hasRuntimeTableState || !this.factoryBankCatalog) {
            return;
        }

        const nextDesiredTableIndex = clamp(
            this.runtimeTablePresentation.desiredTableIndex,
            0,
            Math.max(0, this.factoryBankCatalog.tables.length - 1)
        );
        const nextPresentedTableIndex = clamp(
            this.runtimeTablePresentation.presentedTableIndex,
            0,
            Math.max(0, this.factoryBankCatalog.tables.length - 1)
        );
        const animateDirection =
            Math.abs(nextPresentedTableIndex - this.currentTableIndex) === 1
                ? Math.sign(nextPresentedTableIndex - this.currentTableIndex)
                : 0;

        this.desiredTableIndex = nextDesiredTableIndex;
        if (this.tableSelect && this.tableSelect.value !== String(nextDesiredTableIndex)) {
            this.tableSelect.value = String(nextDesiredTableIndex);
        }

        void this.setSelectedTableIndex(nextPresentedTableIndex, { animateDirection }).catch(() => {});
    }

    handleRuntimeTableState(message) {
        this.latestRuntimeTableState = normalizeRuntimeTableState(message);
        emitPatchViewLog("info", "Received runtime table state", summarizeRuntimeTableStateForLog(this.latestRuntimeTableState));
        this.updateLatchedRuntimeFailureState(this.latestRuntimeTableState);
        this.runtimeTablePresentation = resolveRuntimeTablePresentation(
            this.latestRuntimeTableState,
            this.currentTableIndex
        );
        this.hasRuntimeTableState = true;
        if (this.latestRuntimeTableState?.hasFailure) {
            const desiredTable = this.factoryBankCatalog?.tables?.[this.latestRuntimeTableState.desiredTableIndex];
            emitPatchViewLog("error", "Wavetable runtime reported a load failure", {
                message: describeRuntimeTableFailure(this.latestRuntimeTableState),
                detail: describeRuntimeTableFailureDetails(
                    this.latestRuntimeTableState,
                    desiredTable?.name ?? "Requested wavetable"
                ),
                state: summarizeRuntimeTableStateForLog(this.latestRuntimeTableState),
            });
        }
        this.applyRuntimeTablePresentation();
        this.updateBankReadout();
    }

    handleMsegStateChange(state) {
        this.msegState = state;
        this.selectedMsegPointIndex = clamp(
            this.selectedMsegPointIndex,
            0,
            Math.max(0, state.shape.points.length - 1)
        );
        this.renderMsegEditor();
        this.syncMsegPlaybackControls();
        this.syncMsegDepthControl();
    }

    getMsegSurfaceRefs(rolePrefix) {
        return {
            viewport: this.shadowRoot.querySelector(`[data-role='${rolePrefix}-viewport']`),
            grid: this.shadowRoot.querySelector(`[data-role='${rolePrefix}-grid']`),
            fill: this.shadowRoot.querySelector(`[data-role='${rolePrefix}-fill']`),
            curve: this.shadowRoot.querySelector(`[data-role='${rolePrefix}-curve']`),
            points: this.shadowRoot.querySelector(`[data-role='${rolePrefix}-points']`),
        };
    }

    getMsegSurfaceOrientation(surface, { showPoints = false } = {}) {
        if (this.options?.platform !== "ios" || !showPoints) {
            return "horizontal";
        }

        const hostBounds = this.getBoundingClientRect?.() ?? null;
        const viewportBounds = globalThis.visualViewport ?? null;
        const width = Math.max(
            0,
            hostBounds?.width ||
                this.clientWidth ||
                viewportBounds?.width ||
                globalThis.window?.innerWidth ||
                0
        );
        const height = Math.max(
            0,
            hostBounds?.height ||
                this.clientHeight ||
                viewportBounds?.height ||
                globalThis.window?.innerHeight ||
                0
        );

        if (width > 0 && height > 0) {
            return height > width ? "vertical" : "horizontal";
        }

        if (!surface?.viewport) {
            return "horizontal";
        }

        const bounds = surface.viewport.getBoundingClientRect?.() ?? { width: 0, height: 0 };
        const fallbackWidth = Math.max(1, bounds.width || surface.viewport.clientWidth || 0);
        const fallbackHeight = Math.max(1, bounds.height || surface.viewport.clientHeight || 0);
        return fallbackHeight > fallbackWidth ? "vertical" : "horizontal";
    }

    setMsegModalOpen(nextOpen) {
        this.isMsegModalOpen = Boolean(nextOpen);
        if (!this.isMsegModalOpen) {
            this.activeMsegPointer = null;
        }
        this.toggleAttribute("mseg-modal-open", this.isMsegModalOpen);

        if (this.msegModalLayer) {
            this.msegModalLayer.dataset.open = this.isMsegModalOpen ? "true" : "false";
        }

        const modalElement = this.msegModalLayer?.querySelector(".mseg-modal");
        if (modalElement) {
            modalElement.setAttribute("aria-hidden", this.isMsegModalOpen ? "false" : "true");
        }

        this.renderMsegEditor();

        if (this.isMsegModalOpen) {
            if (typeof globalThis.requestAnimationFrame === "function") {
                globalThis.requestAnimationFrame(() => this.renderMsegEditor());
            } else {
                this.renderMsegEditor();
            }
        }
    }

    openMsegModal(event) {
        event?.preventDefault?.();
        this.setMsegModalOpen(true);
    }

    closeMsegModal(event) {
        event?.preventDefault?.();
        this.setMsegModalOpen(false);
    }

    syncMsegDepthControl() {
        if (!this.msegDepthInput || !this.msegState) {
            return;
        }

        const nextDepth = clampDepth(this.msegState.depth);
        if (globalThis.document?.activeElement !== this.msegDepthInput) {
            this.msegDepthInput.value = nextDepth.toFixed(3);
        }

        if (this.msegDepthReadout) {
            this.msegDepthReadout.textContent = nextDepth.toFixed(3);
        }
    }

    syncPlayModeControl(value) {
        this.currentPlayMode = clampPlayMode(value);

        if (this.playModeSelect && globalThis.document?.activeElement !== this.playModeSelect) {
            this.playModeSelect.value = String(this.currentPlayMode);
        }
    }

    syncGlideTimeControl(value) {
        this.currentGlideTime = clampGlideTime(value);

        if (this.glideTimeInput && globalThis.document?.activeElement !== this.glideTimeInput) {
            this.glideTimeInput.value = this.currentGlideTime.toFixed(3);
        }

        if (this.glideTimeReadout) {
            this.glideTimeReadout.textContent = formatGlideTime(this.currentGlideTime);
        }
    }

    syncMsegPlaybackControls() {
        if (!this.msegState?.playback) {
            return;
        }

        const nextSeconds = clampMsegRateSeconds(this.msegState.playback.rate?.seconds);
        if (this.msegRateInput && globalThis.document?.activeElement !== this.msegRateInput) {
            this.msegRateInput.value = nextSeconds.toFixed(3);
        }

        if (this.msegRateReadout) {
            this.msegRateReadout.textContent = formatMsegRateSeconds(nextSeconds);
        }

        if (this.msegLauncherRateReadout) {
            this.msegLauncherRateReadout.textContent = formatMsegRateSeconds(nextSeconds);
        }

        const isLoopEnabled = this.msegState.playback.loop !== null;

        if (this.msegLoopButton) {
            this.msegLoopButton.setAttribute("aria-pressed", isLoopEnabled ? "true" : "false");
            this.msegLoopButton.setAttribute("title", isLoopEnabled ? "Loop full shape" : "Play one shot");
        }

        if (this.msegLauncherLoopButton) {
            this.msegLauncherLoopButton.setAttribute("aria-pressed", isLoopEnabled ? "true" : "false");
            this.msegLauncherLoopButton.setAttribute("title", formatMsegLoopLabel(this.msegState.playback.loop));
        }
    }

    handleMsegRateInput() {
        if (!this.msegController || !this.msegState?.playback) {
            return;
        }

        this.msegController.setPlayback({
            ...this.msegState.playback,
            rate: {
                kind: "seconds",
                seconds: clampMsegRateSeconds(this.msegRateInput?.value),
            },
        });
    }

    handleMsegLoopInput() {
        if (!this.msegController || !this.msegState?.playback) {
            return;
        }

        this.msegController.setPlayback({
            ...this.msegState.playback,
            loop: this.msegState.playback.loop ? null : { startX: 0.0, endX: 1.0 },
            noteOffPolicy: "finish_loop",
        });
    }

    handlePlayModeInput() {
        const nextValue = clampPlayMode(this.playModeSelect?.value);
        this.syncPlayModeControl(nextValue);
        this.patchConnection.sendEventOrValue?.(playModeEndpointID, nextValue);
    }

    handleGlideTimeInput() {
        const nextValue = clampGlideTime(this.glideTimeInput?.value);
        this.syncGlideTimeControl(nextValue);
        this.patchConnection.sendEventOrValue?.(glideTimeEndpointID, nextValue);
    }

    getMsegSurfaceSize(surface, fallbackWidth = 600, fallbackHeight = 220) {
        const bounds = surface?.viewport?.getBoundingClientRect?.() ?? { width: 0, height: 0 };
        const width = Math.max(1, bounds.width || surface?.viewport?.clientWidth || fallbackWidth);
        const height = Math.max(1, bounds.height || surface?.viewport?.clientHeight || fallbackHeight);
        surface?.viewport?.setAttribute("viewBox", `0 0 ${width} ${height}`);
        return { width, height };
    }

    renderMsegGrid(surface, metrics) {
        if (!surface?.grid) {
            return;
        }

        surface.grid.innerHTML = "";

        [0.25, 0.5, 0.75].forEach((step) => {
            const horizontalLine = document.createElementNS(SVG_NS, "line");
            const y = metrics.plotTop + ((1.0 - step) * metrics.plotHeight);
            horizontalLine.setAttribute("x1", metrics.plotLeft.toFixed(3));
            horizontalLine.setAttribute("y1", y.toFixed(3));
            horizontalLine.setAttribute("x2", metrics.plotRight.toFixed(3));
            horizontalLine.setAttribute("y2", y.toFixed(3));
            surface.grid.appendChild(horizontalLine);
        });

        [0.25, 0.5, 0.75].forEach((step) => {
            const verticalLine = document.createElementNS(SVG_NS, "line");
            const x = metrics.plotLeft + (step * metrics.plotWidth);
            verticalLine.setAttribute("x1", x.toFixed(3));
            verticalLine.setAttribute("y1", metrics.plotTop.toFixed(3));
            verticalLine.setAttribute("x2", x.toFixed(3));
            verticalLine.setAttribute("y2", metrics.plotBottom.toFixed(3));
            surface.grid.appendChild(verticalLine);
        });
    }

    renderMsegSurface(surface, { showPoints = false } = {}) {
        if (!surface?.viewport || !surface.curve || !surface.fill || !surface.points || !this.msegState) {
            return;
        }

        const { width, height } = this.getMsegSurfaceSize(
            surface,
            showPoints ? 840 : 600,
            showPoints ? 360 : 132
        );
        const orientation = this.getMsegSurfaceOrientation(surface, { showPoints });
        const editorOptions = getMsegEditorInteractionOptions(orientation);
        const metrics = createMsegEditorMetrics(width, height, editorOptions);
        this.renderMsegGrid(surface, metrics);
        let pathData = "";

        for (let index = 0; index < MSEG_CURVE_PREVIEW_SAMPLES; index += 1) {
            const x = index / (MSEG_CURVE_PREVIEW_SAMPLES - 1);
            const y = evaluateMsegShape(this.msegState.shape, x);
            const coordinates = pointToMsegEditorCoordinates({ x, y }, width, height, editorOptions);
            pathData += `${index === 0 ? "M" : "L"} ${coordinates.x.toFixed(3)} ${coordinates.y.toFixed(3)} `;
        }

        const curvePath = pathData.trim();
        surface.curve.setAttribute("d", curvePath);
        surface.fill.setAttribute("d", orientation === "vertical"
            ? `${curvePath} L ${metrics.plotLeft.toFixed(3)} ${metrics.plotTop.toFixed(3)} ` +
                `L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} Z`
            : `${curvePath} L ${metrics.plotRight.toFixed(3)} ${metrics.plotBottom.toFixed(3)} ` +
                `L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} Z`
        );
        surface.points.innerHTML = "";

        if (!showPoints) {
            return;
        }

        this.msegState.shape.points.forEach((point, pointIndex) => {
            const coordinates = pointToMsegEditorCoordinates(point, width, height, editorOptions);
            const circle = document.createElementNS(SVG_NS, "circle");
            circle.setAttribute("cx", coordinates.x.toFixed(3));
            circle.setAttribute("cy", coordinates.y.toFixed(3));
            circle.setAttribute(
                "r",
                String(pointIndex === this.selectedMsegPointIndex ? MSEG_SELECTED_POINT_RADIUS_PX : MSEG_POINT_RADIUS_PX)
            );
            circle.setAttribute(
                "class",
                pointIndex === this.selectedMsegPointIndex ? "mseg-point selected" : "mseg-point"
            );
            circle.setAttribute("vector-effect", "non-scaling-stroke");
            circle.dataset.pointIndex = String(pointIndex);
            surface.points.appendChild(circle);
        });
    }

    renderMsegEditor() {
        if (!this.msegState) {
            return;
        }

        this.renderMsegSurface(this.msegPreviewSurface, { showPoints: false });
        this.renderMsegSurface(this.msegModalSurface, { showPoints: true });
    }

    beginMsegInteraction(event) {
        if (!this.isMsegModalOpen || !this.msegModalSurface?.viewport || !this.msegState) {
            return;
        }

        const bounds = this.msegModalSurface.viewport.getBoundingClientRect();
        const editorOptions = getMsegEditorInteractionOptions(
            this.getMsegSurfaceOrientation(this.msegModalSurface, { showPoints: true })
        );
        const targetPointIndex = findMsegPointHitIndex(
            this.msegState.shape,
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
            undefined,
            editorOptions
        );

        if (targetPointIndex >= 0) {
            this.selectedMsegPointIndex = targetPointIndex;
            this.activeMsegPointer = {
                pointerId: event.pointerId,
                pointIndex: this.selectedMsegPointIndex,
                startClientX: event.clientX,
                startClientY: event.clientY,
                moved: false,
                deleteOnRelease:
                    targetPointIndex > 0 &&
                    targetPointIndex < this.msegState.shape.points.length - 1,
            };
            this.renderMsegEditor();
            this.msegModalSurface.viewport.setPointerCapture?.(event.pointerId);
            event.preventDefault?.();
            return;
        }

        const point = msegEditorCoordinatesToPoint(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
            editorOptions
        );
        this.msegController?.addPoint(point.x, point.y);
        const points = this.msegController?.getState().shape.points ?? [];
        this.selectedMsegPointIndex = points.findIndex(
            (nextPoint) =>
                Math.abs(nextPoint.x - point.x) <= 1e-6 &&
                Math.abs(nextPoint.y - point.y) <= 1e-6
        );
        this.renderMsegEditor();
        event.preventDefault?.();
    }

    updateMsegInteraction(event) {
        if (!this.activeMsegPointer || !this.msegModalSurface?.viewport) {
            return;
        }

        if (event.pointerId !== this.activeMsegPointer.pointerId) {
            return;
        }

        const movementDistance = Math.hypot(
            event.clientX - this.activeMsegPointer.startClientX,
            event.clientY - this.activeMsegPointer.startClientY
        );

        if (!this.activeMsegPointer.moved && movementDistance < MSEG_DRAG_THRESHOLD_PX) {
            return;
        }

        const bounds = this.msegModalSurface.viewport.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
            getMsegEditorInteractionOptions(
                this.getMsegSurfaceOrientation(this.msegModalSurface, { showPoints: true })
            )
        );
        this.activeMsegPointer.moved = true;
        this.msegController?.movePoint(this.activeMsegPointer.pointIndex, point.x, point.y);
        this.selectedMsegPointIndex = this.activeMsegPointer.pointIndex;
        event.preventDefault?.();
    }

    endMsegInteraction(event) {
        if (!this.activeMsegPointer || event.pointerId !== this.activeMsegPointer.pointerId) {
            return;
        }

        const pointerState = this.activeMsegPointer;
        this.msegModalSurface.viewport.releasePointerCapture?.(event.pointerId);
        this.activeMsegPointer = null;

        if (!pointerState.moved && pointerState.deleteOnRelease && this.msegController) {
            this.msegController.deletePoint(pointerState.pointIndex);
            this.selectedMsegPointIndex = clamp(
                pointerState.pointIndex - 1,
                0,
                this.msegController.getState().shape.points.length - 1
            );
        }

        this.renderMsegEditor();
        event.preventDefault?.();
    }

    setDisplayState(state, message) {
        if (this.displayStatus) {
            this.displayStatus.textContent = message;
        }
        this.displayViewport.dataset.state = state;
        this.displayOverlay.textContent = message;
        this.displayOverlay.hidden = state === "loaded";
    }

    showError(error) {
        const message = String(error?.stack || error);

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    background: #02040b;
                    color: #ffd9d9;
                    font-family: Menlo, Monaco, monospace;
                }

                pre {
                    margin: 0;
                    padding: 16px;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
            </style>
            <pre>${message}</pre>
        `;
    }

    getKeyboardStyle() {
        if (this.options.platform !== "ios") {
            return "desktop";
        }

        if (this.currentLayout.isCompact) {
            return "ios-compact";
        }

        if (this.currentLayout.keyboardHeight <= 92) {
            return "ios-short";
        }

        return "ios-regular";
    }

    getKeyboardRangeLabel() {
        const startNote = this.keyboardRootNote;
        const lastNote = this.keyboardRootNote + Math.max(0, this.currentLayout.noteCount - 1);
        const formatNote = (noteNumber) => {
            const safeNote = Math.max(0, Math.round(Number(noteNumber) || 0));
            return `${NOTE_NAMES[safeNote % 12]}${Math.floor(safeNote / 12) - 1}`;
        };

        return `${formatNote(startNote)} - ${formatNote(lastNote)}`;
    }

    syncKeyboardOctaveControls() {
        if (this.octaveReadout) {
            this.octaveReadout.textContent = this.getKeyboardRangeLabel();
        }

        if (this.octaveDownButton) {
            this.octaveDownButton.disabled = this.keyboardRootNote <= this.keyboardMinRootNote;
        }

        if (this.octaveUpButton) {
            this.octaveUpButton.disabled = this.keyboardRootNote >= this.keyboardMaxRootNote;
        }
    }

    setKeyboardRootNote(value) {
        const nextRootNote = clamp(
            Math.round(Number(value) || 0),
            this.keyboardMinRootNote,
            this.keyboardMaxRootNote
        );

        this.keyboardRootNote = nextRootNote;
        this.keyboard?.setAttribute("root-note", String(nextRootNote));
        this.syncKeyboardOctaveControls();
    }

    nudgeKeyboardOctave(offset) {
        this.setKeyboardRootNote(this.keyboardRootNote + offset);

        if (this.options.platform !== "ios") {
            this.focusKeyboard();
        }
    }

    syncKeyboardGeometry() {
        if (this.options.platform !== "ios" || !this.keyboard || !this.keyboardHost) {
            return;
        }

        const hostWidth = this.keyboardHost.getBoundingClientRect().width;
        if (hostWidth <= 0) {
            return;
        }

        const { naturalWidth, accidentalWidth } = computeKeyboardDimensions({
            rootNote: this.keyboardRootNote,
            noteCount: this.currentLayout.noteCount,
            availableWidth: hostWidth,
            minNaturalWidth: this.currentLayout.keyboardNaturalNoteWidth,
        });

        const currentNaturalWidth = Number(this.keyboard.naturalWidth) || 0;
        const currentAccidentalWidth = Number(this.keyboard.accidentalWidth) || 0;

        if (
            Math.abs(currentNaturalWidth - naturalWidth) < 0.01 &&
            Math.abs(currentAccidentalWidth - accidentalWidth) < 0.01
        ) {
            return;
        }

        this.keyboard.naturalWidth = naturalWidth;
        this.keyboard.accidentalWidth = accidentalWidth;
        this.keyboard.notes = [];
        this.keyboard.refreshHTML();
        this.keyboard.bindRenderedTouchHandlers?.();
        this.keyboard.refreshActiveNoteElements?.();
    }

    buildKeyboard() {
        const keyboardStyle = this.getKeyboardStyle();
        const tagName = defineKeyboardElement(
            this.patchConnection,
            keyboardStyle,
            {
                naturalNoteWidth: this.currentLayout.keyboardNaturalNoteWidth,
                accidentalWidth: this.currentLayout.keyboardAccidentalWidth,
            }
        );

        this.keyboard = new (window.customElements.get(tagName))();
        this.keyboard.classList.add("keyboard");
        this.keyboard.setAttribute("root-note", String(this.keyboardRootNote));
        this.keyboard.setAttribute("note-count", `${this.currentLayout.noteCount}`);
        this.keyboard.attachToPatchConnection?.(this.patchConnection, midiInputEndpointID);

        if (this.options.platform !== "ios") {
            this.keyboard.addEventListener("mousedown", () => this.focusKeyboard(), { passive: true });
        }

        this.keyboardHost.innerHTML = "";
        this.keyboardHost.appendChild(this.keyboard);

        this.syncKeyboardGeometry();
        requestAnimationFrame(() => {
            this.syncKeyboardGeometry();

            if (this.options.platform !== "ios") {
                this.focusKeyboard();
            }
        });
        this.keyboardStyle = keyboardStyle;
        this.keyboardNoteCount = this.currentLayout.noteCount;
        this.hasOnscreenKeyboard = true;
        this.syncKeyboardOctaveControls();
        if (this.hint) {
            this.hint.textContent = this.options.platform === "ios" ? "" : "Connecting the keyboard to the synth…";
        }
    }

    syncKeyboardLayout() {
        const nextStyle = this.getKeyboardStyle();
        const nextNoteCount = this.currentLayout.noteCount;

        if (this.keyboardStyle === nextStyle && this.keyboardNoteCount === nextNoteCount) {
            return;
        }

        this.keyboard.detachPatchConnection?.(this.patchConnection);
        this.buildKeyboard();
    }

    focusKeyboard() {
        this.keyboard?.shadowRoot?.querySelector(".note-holder")?.focus();
    }

    buildKnob(endpointInfo) {
        if (!endpointInfo) {
            return;
        }

        if (this.knobControl && this.knobEndpointID === endpointInfo.endpointID) {
            return;
        }

        const { Knob } = this.patchConnection.utilities.ParameterControls;
        this.knobControl = new Knob(this.patchConnection, endpointInfo);
        this.knobEndpointID = endpointInfo.endpointID;
        this.knobControl.classList.add("cosimo-knob");

        this.knobControlHost.innerHTML = "";
        this.knobControlHost.appendChild(this.knobControl);
    }

    buildScanRail(endpointInfo = { endpointID: wavetablePositionEndpointID }) {
        const endpointID = endpointInfo.endpointID || wavetablePositionEndpointID;

        if (this.scanRailEndpointID === endpointID) {
            return;
        }

        this.scanRailEndpointID = endpointID;

        if (!this.scanRailInput) {
            return;
        }

        if (this.handleScanRailInput) {
            this.scanRailInput.removeEventListener("input", this.handleScanRailInput);
            this.scanRailInput.removeEventListener("pointerdown", this.handleScanRailGestureStart);
            this.scanRailInput.removeEventListener("pointerup", this.handleScanRailGestureEnd);
            this.scanRailInput.removeEventListener("change", this.handleScanRailGestureEnd);
            this.stepDownButton?.removeEventListener("click", this.handleScanStepDown);
            this.stepUpButton?.removeEventListener("click", this.handleScanStepUp);
        }

        this.handleScanRailInput = () => {
            const nextValue = clampDisplayPosition(this.scanRailInput.value);

            if (this.hasDisplayedValue && displayPositionsMatch(this.currentValue, nextValue)) {
                return;
            }

            this.patchConnection.sendEventOrValue(endpointID, nextValue);
            this.setDisplayedValue(nextValue);
        };
        this.handleScanRailGestureStart = () => {
            this.patchConnection.sendParameterGestureStart?.(endpointID);
        };
        this.handleScanRailGestureEnd = () => {
            this.patchConnection.sendParameterGestureEnd?.(endpointID);
        };
        this.handleScanStepDown = () => this.nudgeScanRail(-this.getFrameStepSize());
        this.handleScanStepUp = () => this.nudgeScanRail(this.getFrameStepSize());

        this.scanRailInput.addEventListener("input", this.handleScanRailInput);
        this.scanRailInput.addEventListener("pointerdown", this.handleScanRailGestureStart);
        this.scanRailInput.addEventListener("pointerup", this.handleScanRailGestureEnd);
        this.scanRailInput.addEventListener("change", this.handleScanRailGestureEnd);
        this.stepDownButton?.addEventListener("click", this.handleScanStepDown);
        this.stepUpButton?.addEventListener("click", this.handleScanStepUp);
    }

    getFrameStepSize() {
        return this.currentFrameCount > 1 ? 1.0 / (this.currentFrameCount - 1) : 1.0;
    }

    nudgeScanRail(amount) {
        if (!this.scanRailInput || !this.scanRailEndpointID) {
            return;
        }

        this.patchConnection.sendParameterGestureStart?.(this.scanRailEndpointID);
        this.scanRailInput.value = clamp((Number(this.scanRailInput.value) || 0) + amount, 0, 1).toFixed(3);
        this.handleScanRailInput?.();
        this.patchConnection.sendParameterGestureEnd?.(this.scanRailEndpointID);
    }

    getPrimaryPositionEndpointID() {
        return this.scanRailEndpointID || this.knobEndpointID || wavetablePositionEndpointID;
    }

    sendSelectedTableIndex(nextIndex) {
        emitPatchViewLog("info", "User requested wavetable change", {
            previousDesiredTableIndex: this.desiredTableIndex,
            nextDesiredTableIndex: Math.round(Number(nextIndex) || 0),
        });
        this.patchConnection.sendParameterGestureStart?.(wavetableSelectEndpointID);
        this.patchConnection.sendEventOrValue(wavetableSelectEndpointID, nextIndex);
        this.patchConnection.sendParameterGestureEnd?.(wavetableSelectEndpointID);
    }

    commitDraggedDisplayPosition(nextValue) {
        const clampedValue = clampDisplayPosition(nextValue);
        const endpointID = this.getPrimaryPositionEndpointID();

        if (!endpointID) {
            return;
        }

        if (this.scanRailInput) {
            this.scanRailInput.value = clampedValue.toFixed(3);
            this.handleScanRailInput?.();
            return;
        }

        if (this.hasDisplayedValue && displayPositionsMatch(this.currentValue, clampedValue)) {
            return;
        }

        this.patchConnection.sendEventOrValue(endpointID, clampedValue);
        this.setDisplayedValue(clampedValue);
    }

    beginDisplayDrag(event) {
        const endpointID = this.getPrimaryPositionEndpointID();

        if (!endpointID || !this.displayViewport) {
            return;
        }

        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        if (event.target?.closest?.(".bank-picker-trigger")) {
            return;
        }

        const bounds = this.displayViewport.getBoundingClientRect();
        this.activeDisplayDrag = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            endpointID,
            mode: "pending",
            startTableIndex: this.currentTableIndex,
            startValue: this.currentValue,
            dragSpanX: bounds.width,
            dragSpanY: bounds.height,
        };

        this.displayViewport.setPointerCapture?.(event.pointerId);
        this.preloadAdjacentTables(this.currentTableIndex);
        event.preventDefault?.();
    }

    updateDisplayDrag(event) {
        if (!this.activeDisplayDrag || event.pointerId !== this.activeDisplayDrag.pointerId) {
            return;
        }

        const deltaX = event.clientX - this.activeDisplayDrag.startClientX;
        const deltaY = event.clientY - this.activeDisplayDrag.startClientY;
        const gestureAxis = resolveDisplayGestureAxis(deltaX, deltaY);

        if (this.activeDisplayDrag.mode === "pending" && gestureAxis !== "pending") {
            this.activeDisplayDrag.mode = gestureAxis;

            if (gestureAxis === "vertical") {
                this.patchConnection.sendParameterGestureStart?.(this.activeDisplayDrag.endpointID);
            }
        }

        if (this.activeDisplayDrag.mode === "horizontal") {
            const tableCount = this.factoryBankCatalog?.tables?.length ?? 0;
            const swipeTarget = resolveHorizontalSwipeTarget(
                this.activeDisplayDrag.startTableIndex,
                deltaX,
                tableCount
            );
            const activeSlot = this.getActiveDisplaySlot();
            const inactiveSlot = this.getInactiveDisplaySlot();
            const stageWidth = this.getDisplayStageWidth();
            const clampedOffset = clamp(deltaX, -stageWidth, stageWidth);

            this.activeDisplayDrag.currentDeltaX = clampedOffset;
            this.activeDisplayDrag.direction = swipeTarget.direction;
            this.activeDisplayDrag.previewTargetTableIndex = swipeTarget.targetTableIndex;
            this.activeDisplayDrag.hasHorizontalTarget = swipeTarget.hasTarget;

            if (activeSlot) {
                this.setDisplaySlotTransition(activeSlot, false);
                this.setDisplaySlotOffset(activeSlot, clampedOffset);
            }

            if (inactiveSlot) {
                if (swipeTarget.hasTarget) {
                    const previewBank = this.displayFramesCache.get(swipeTarget.targetTableIndex);
                    if (previewBank) {
                        this.renderBankIntoSlot(inactiveSlot, previewBank);
                        this.setDisplaySlotTransition(inactiveSlot, false);
                        this.setDisplaySlotOffset(
                            inactiveSlot,
                            clampedOffset + (swipeTarget.direction > 0 ? stageWidth : -stageWidth)
                        );
                    } else {
                        void this.fetchDisplayBank(swipeTarget.targetTableIndex).catch(() => {});
                        this.setDisplaySlotTransition(inactiveSlot, false);
                        this.setDisplaySlotOffset(inactiveSlot, swipeTarget.direction > 0 ? stageWidth : -stageWidth);
                    }
                } else {
                    this.setDisplaySlotTransition(inactiveSlot, false);
                    this.setDisplaySlotOffset(inactiveSlot, stageWidth);
                }
            }

            event.preventDefault?.();
            return;
        }

        if (this.activeDisplayDrag.mode !== "vertical") {
            return;
        }

        const nextValue = mapDisplayDragToPosition(
            this.activeDisplayDrag.startValue,
            this.activeDisplayDrag.startClientY,
            event.clientY,
            this.activeDisplayDrag.dragSpanY
        );

        this.commitDraggedDisplayPosition(nextValue);
        event.preventDefault?.();
    }

    endDisplayDrag(event) {
        if (!this.activeDisplayDrag || event.pointerId !== this.activeDisplayDrag.pointerId) {
            return;
        }

        this.displayViewport?.releasePointerCapture?.(event.pointerId);
        const dragState = this.activeDisplayDrag;
        this.activeDisplayDrag = null;

        if (dragState.mode === "vertical") {
            this.patchConnection.sendParameterGestureEnd?.(dragState.endpointID);
        } else if (dragState.mode === "horizontal") {
            const swipeTarget = resolveHorizontalSwipeTarget(
                dragState.startTableIndex,
                dragState.currentDeltaX,
                this.factoryBankCatalog?.tables?.length ?? 0
            );
            const shouldCommitSwipe =
                swipeTarget.hasTarget &&
                shouldCommitHorizontalSwipe(dragState.currentDeltaX, dragState.dragSpanX);

            this.resetDisplayLayerPositions();

            if (shouldCommitSwipe) {
                this.sendSelectedTableIndex(swipeTarget.targetTableIndex);
            }
        } else {
            this.resetDisplayLayerPositions();
        }

        event.preventDefault?.();
    }

    handleObservedDisplayPosition(message) {
        const nextState = selectObservedWavetablePositionState(
            this.observedWavetablePositionState,
            message
        );

        if (
            nextState.voiceGeneration === this.observedWavetablePositionState.voiceGeneration &&
            displayPositionsMatch(nextState.position, this.observedWavetablePositionState.position)
        ) {
            return;
        }

        this.observedWavetablePositionState = nextState;
        this.setDisplayPosition(nextState.position);
    }

    setDisplayPosition(value) {
        const nextValue = clampDisplayPosition(value);

        if (displayPositionsMatch(this.currentDisplayPosition, nextValue)) {
            return;
        }

        this.currentDisplayPosition = nextValue;
        this.updateFrameReadouts();
        this.displaySlots.forEach((slot) => slot.display.setPosition(nextValue));
    }

    setDisplayedValue(value) {
        const nextValue = clampDisplayPosition(value);

        if (this.hasDisplayedValue && displayPositionsMatch(this.currentValue, nextValue)) {
            return;
        }

        this.hasDisplayedValue = true;
        this.currentValue = nextValue;
        if (this.valueReadout) {
            this.valueReadout.textContent = this.options.platform === "ios"
                ? nextValue.toFixed(3)
                : nextValue.toFixed(2);
        }

        if (this.scanRailInput && document.activeElement !== this.scanRailInput) {
            this.scanRailInput.value = nextValue.toFixed(3);
        }

        this.setDisplayPosition(nextValue);
    }

    getHTML() {
        if (this.options.platform === "ios") {
            return this.getIOSHTML();
        }

        return this.getDesktopHTML();
    }

    getDesktopHTML() {
        return `
            <style>
                ${this.patchConnection.utilities.ParameterControls.Knob.getCSS()}

                * {
                    box-sizing: border-box;
                    font-family: "Avenir Next", Avenir, sans-serif;
                }

                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    background: #02040b;
                    color: #f3f0ff;
                    ${buildThemeCSSVariablesBlock()}
                    --cosimo-panel-padding: 18px;
                    --cosimo-card-padding: 18px;
                    --cosimo-section-gap: 16px;
                    --cosimo-main-grid-columns: minmax(0, 1fr) 208px;
                    --cosimo-control-height: 150px;
                    --cosimo-stage-min-height: 280px;
                    --cosimo-keyboard-height: 122px;
                    --cosimo-title-font-size: 14px;
                    --cosimo-subtitle-font-size: 22px;
                }

                .panel {
                    width: 100%;
                    height: 100%;
                    padding: var(--cosimo-panel-padding);
                }

                .card {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    border: 1px solid rgba(122, 142, 255, 0.18);
                    border-radius: 18px;
                    background: rgba(4, 7, 18, 0.96);
                    box-shadow:
                        0 24px 60px rgba(3, 6, 18, 0.48),
                        inset 0 1px 0 rgba(160, 173, 255, 0.08);
                    padding: var(--cosimo-card-padding);
                    display: grid;
                    gap: var(--cosimo-section-gap);
                    grid-template-rows: auto 1fr auto auto;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    gap: var(--cosimo-section-gap);
                }

                :host([stacked-header]) .header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .title {
                    font-size: var(--cosimo-title-font-size);
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: #8da2ff;
                }

                .subtitle {
                    font-size: var(--cosimo-subtitle-font-size);
                    line-height: 1;
                    color: #ffd8a6;
                    margin-top: 6px;
                }

                .display-status {
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: rgba(73, 93, 186, 0.14);
                    color: #f56cb6;
                    font-size: 12px;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    box-shadow: inset 0 1px 0 rgba(160, 173, 255, 0.08);
                }

                .main-grid {
                    display: grid;
                    grid-template-columns: var(--cosimo-main-grid-columns);
                    gap: var(--cosimo-section-gap);
                    align-items: stretch;
                }

                .wavetable-panel {
                    min-width: 0;
                    border-radius: 16px;
                    border: 1px solid rgba(122, 142, 255, 0.12);
                    background: rgba(5, 8, 20, 0.94);
                    padding: 14px 14px 12px;
                    display: grid;
                    grid-template-rows: auto 1fr;
                    gap: 12px;
                }

                .wavetable-copy {
                    display: flex;
                    justify-content: flex-start;
                    align-items: baseline;
                    gap: 12px;
                    font-size: 12px;
                }

                .bank-readout {
                    color: rgba(255, 214, 165, 0.9);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .table-picker {
                    display: grid;
                    gap: 4px;
                }

                .table-picker-label {
                    font-size: 10px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(168, 180, 255, 0.68);
                }

                .table-select {
                    min-width: 180px;
                    border-radius: 10px;
                    border: 1px solid rgba(122, 142, 255, 0.28);
                    background: rgba(8, 11, 24, 0.98);
                    color: #eef2f5;
                    padding: 8px 10px;
                    font-size: 13px;
                }

                .table-retry-button {
                    border: 1px solid rgba(245, 108, 182, 0.28);
                    border-radius: 10px;
                    background: rgba(245, 108, 182, 0.08);
                    color: #ffd8e8;
                    padding: 8px 10px;
                    font-size: 11px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    justify-self: start;
                }

                .table-retry-button[hidden] {
                    display: none;
                }

                .table-error-banner {
                    display: block;
                    min-height: 18px;
                    padding: 10px 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(245, 108, 182, 0.24);
                    background: rgba(245, 108, 182, 0.1);
                    color: #ffd8e8;
                    font-size: 12px;
                    line-height: 1.4;
                }

                .table-error-banner[hidden] {
                    display: none;
                }

                .wavetable-stage {
                    position: relative;
                    aspect-ratio: 1.9 / 1;
                    min-height: var(--cosimo-stage-min-height);
                    border-radius: 12px;
                    overflow: hidden;
                    background: #04070f;
                    box-shadow:
                        inset 0 1px 0 rgba(149, 164, 255, 0.08),
                        inset 0 -30px 54px rgba(2, 4, 12, 0.44);
                }

                .wavetable-canvas {
                    width: 100%;
                    height: 100%;
                    display: block;
                }

                .display-overlay {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    place-items: center;
                    text-align: center;
                    padding: 22px;
                    font-size: 13px;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    color: rgba(255, 216, 172, 0.86);
                    background: rgba(4, 7, 18, 0.82);
                    backdrop-filter: blur(4px);
                }

                .display-overlay[hidden] {
                    display: none;
                }

                .wavetable-stage[data-state="error"] .display-overlay {
                    color: #ffb0d5;
                }

                .control-panel {
                    border-radius: 16px;
                    border: 1px solid rgba(122, 142, 255, 0.12);
                    background: rgba(5, 8, 20, 0.78);
                    padding: 16px 12px 14px;
                    display: grid;
                    align-content: start;
                    justify-items: center;
                    gap: 14px;
                }

                .play-panel {
                    border-radius: 16px;
                    border: 1px solid rgba(122, 142, 255, 0.12);
                    background: rgba(5, 8, 20, 0.88);
                    padding: 12px 14px;
                    display: grid;
                    gap: 0;
                }

                .play-grid {
                    display: grid;
                    grid-template-columns: minmax(160px, 210px) minmax(0, 1fr);
                    gap: 12px;
                    align-items: center;
                }

                .play-field {
                    display: grid;
                    gap: 0;
                    min-width: 0;
                }

                .glide-field-body {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 12px;
                    align-items: center;
                }

                .play-select {
                    width: 100%;
                    border-radius: 10px;
                    border: 1px solid rgba(122, 142, 255, 0.28);
                    background: rgba(8, 11, 24, 0.98);
                    color: #eef2f5;
                    padding: 9px 10px;
                    font-size: 13px;
                }

                .glide-time-slider {
                    width: 100%;
                }

                .glide-time-readout {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    color: #87d7f5;
                    white-space: nowrap;
                }

                .control-heading {
                    font-size: 12px;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(154, 170, 255, 0.78);
                }

                .knob-shell {
                    width: var(--cosimo-control-height);
                    height: calc(var(--cosimo-control-height) + 20px);
                    display: grid;
                    justify-items: center;
                    align-content: start;
                    gap: 8px;
                }

                .knob-control-host {
                    width: var(--cosimo-control-height);
                    height: var(--cosimo-control-height);
                    display: grid;
                    place-items: center;
                }

                .cosimo-knob.knob-container {
                    --knob-track-background-color: rgba(112, 128, 214, 0.28);
                    --knob-track-value-color: #f19335;
                    --knob-dial-border-color: rgba(196, 204, 255, 0.08);
                    --knob-dial-background-color: radial-gradient(circle at 32% 28%, #434f95 0%, #1d2450 42%, #090d1f 100%);
                    --knob-dial-tick-color: #ffd8a6;

                    width: var(--cosimo-control-height);
                    height: var(--cosimo-control-height);
                }

                .cosimo-knob .knob-path {
                    stroke-width: 6;
                }

                .cosimo-knob .knob-dial {
                    height: 70%;
                    width: 70%;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    border: none;
                    background: radial-gradient(circle at 32% 28%, #434f95 0%, #1d2450 42%, #090d1f 100%);
                    box-shadow:
                        inset 0 2px 10px rgba(196, 204, 255, 0.14),
                        inset 0 -10px 18px rgba(0, 0, 0, 0.42),
                        0 12px 24px rgba(4, 8, 20, 0.42);
                }

                .cosimo-knob .knob-dial-tick {
                    width: 4px;
                    height: 27px;
                    border-radius: 999px;
                    background: linear-gradient(180deg, #ffd9a4 0%, #f56cb6 100%);
                    box-shadow: 0 0 12px rgba(245, 108, 182, 0.48);
                    left: calc(50% - 2px);
                    top: 12px;
                }

                .value-text {
                    font-size: 18px;
                    letter-spacing: 0.08em;
                    color: #ffd8a6;
                    line-height: 1;
                }

                .label {
                    text-align: center;
                    font-size: 13px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(203, 212, 255, 0.8);
                }

                .keyboard-host {
                    min-height: var(--cosimo-keyboard-height);
                    display: grid;
                    align-items: stretch;
                }

                .keyboard {
                    width: 100%;
                    height: var(--cosimo-keyboard-height);
                    border-radius: 12px;
                    overflow: hidden;
                    background: rgba(6, 10, 24, 0.94);
                    padding: 8px 10px 10px;
                    touch-action: none;
                }

                .hint {
                    font-size: 12px;
                    color: rgba(194, 202, 255, 0.72);
                }

                .mseg-panel {
                    border-radius: 16px;
                    border: 1px solid rgba(122, 142, 255, 0.12);
                    background: rgba(5, 8, 20, 0.88);
                    padding: 14px;
                    display: grid;
                    gap: 12px;
                }

                .mseg-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    gap: 12px;
                }

                .mseg-title {
                    display: grid;
                    gap: 4px;
                }

                .mseg-title strong {
                    font-size: 16px;
                    letter-spacing: -0.03em;
                    color: #eef2f5;
                }

                .mseg-depth-readout {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    color: #87d7f5;
                }

                .mseg-editor-shell {
                    position: relative;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid rgba(122, 142, 255, 0.14);
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 22%),
                        linear-gradient(180deg, rgba(8, 12, 24, 0.94), rgba(4, 7, 15, 0.98));
                }

                .mseg-editor {
                    display: block;
                    width: 100%;
                    height: 180px;
                    touch-action: none;
                    cursor: crosshair;
                }

                .mseg-grid {
                    stroke: rgba(255, 255, 255, 0.08);
                    stroke-width: 1;
                }

                .mseg-curve {
                    fill: none;
                    stroke: #87d7f5;
                    stroke-width: 3;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                }

                .mseg-point {
                    fill: #ffd8a6;
                    stroke: rgba(4, 7, 15, 0.96);
                    stroke-width: 2;
                    cursor: grab;
                }

                ${getMsegStyles("desktop")}
            </style>

            <div class="panel">
                <div class="card">
                    <div class="header">
                        <div>
                            <div class="title">Cosimo Synth</div>
                            <div class="subtitle">Wavetable Position</div>
                        </div>
                        <div class="display-status">Loading wavetable bank…</div>
                    </div>

                    <div class="main-grid">
                        <div class="wavetable-panel">
                            <div class="wavetable-copy">
                                <div class="bank-readout">Factory bank</div>
                                <label class="table-picker">
                                    <span class="table-picker-label">Table</span>
                                    <select class="table-select"></select>
                                </label>
                                <button class="table-retry-button" type="button" hidden>Retry Load</button>
                                <div class="table-error-banner" data-role="table-error-banner" hidden></div>
                            </div>
                            <div class="wavetable-stage" data-state="loading">
                                <canvas class="wavetable-canvas"></canvas>
                                <div class="display-overlay">Loading wavetable bank…</div>
                            </div>
                        </div>

                        <div class="control-panel">
                            <div class="control-heading">Frame Scan</div>
                            <div class="knob-shell">
                                <div class="knob-control-host"></div>
                                <div class="value-text" data-role="value-readout">0.00</div>
                                <div class="label">Wavetable Position</div>
                            </div>
                        </div>
                    </div>

                    <div class="play-panel">
                        <div class="play-grid">
                            <label class="play-field" aria-label="Voice mode">
                                <select class="play-select play-mode-select" aria-label="Voice mode">${buildSelectOptionsHTML(PLAY_MODE_OPTIONS)}</select>
                            </label>
                            <label class="play-field" aria-label="Glide time">
                                <div class="glide-field-body">
                                    <input class="glide-time-slider" type="range" min="0" max="1" step="0.001" value="0.000" aria-label="Glide time" />
                                    <div class="glide-time-readout" data-role="glide-time-readout">0.000 s</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    ${buildMsegLauncherHTML()}
                    ${buildMsegModalHTML()}

                    <div class="keyboard-host"></div>
                    <div class="hint">Connecting the keyboard to the synth…</div>
                </div>
            </div>
        `;
    }

    getIOSHTML() {
        return `
            <style>
                * {
                    box-sizing: border-box;
                }

                :host {
                    display: block;
                    box-sizing: border-box;
                    width: 100%;
                    height: 100%;
                    min-height: 100dvh;
                    overflow-x: hidden;
                    overscroll-behavior: none;
                    background: #04070f;
                    color: #eef2f5;
                    ${buildThemeCSSVariablesBlock()}
                    font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Avenir Next", sans-serif;
                    --cosimo-section-gap: 12px;
                    --cosimo-stage-min-height: 248px;
                    --cosimo-keyboard-height: 122px;
                    --cosimo-control-height: 54px;
                    --cosimo-ios-top-inset: 0px;
                    --cosimo-ios-bottom-inset: 0px;
                    --cosimo-ios-safe-top: calc(env(safe-area-inset-top) + var(--cosimo-ios-top-inset));
                    --cosimo-ios-safe-bottom: calc(env(safe-area-inset-bottom) + var(--cosimo-ios-bottom-inset));
                    --cosimo-bottom-safe-area: env(safe-area-inset-bottom);
                }

                .ios-shell {
                    box-sizing: border-box;
                    width: 100%;
                    height: 100%;
                    min-height: 100dvh;
                    padding:
                        var(--cosimo-ios-safe-top)
                        env(safe-area-inset-right)
                        var(--cosimo-ios-safe-bottom)
                        env(safe-area-inset-left);
                    min-width: 0;
                    display: grid;
                    grid-template-rows: minmax(0, 1fr) auto;
                }

                .ios-top-row {
                    position: relative;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    grid-template-rows: minmax(0, 1fr);
                    min-height: 0;
                    overflow: hidden;
                }

                .ios-main-view {
                    display: grid;
                    min-height: 0;
                    grid-column: 1;
                    grid-row: 1;
                }

                .mseg-modal-layer {
                    grid-column: 1;
                    grid-row: 1;
                    min-height: 0;
                }

                .ios-scroll {
                    height: 100%;
                    min-height: 0;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    -webkit-overflow-scrolling: touch;
                }

                :host([mseg-modal-open]) .ios-main-view {
                    display: none;
                }

                .ios-content {
                    display: grid;
                    min-width: 0;
                    align-content: start;
                    gap: 16px;
                    padding: 0 16px;
                }

                .wavetable-panel,
                .mseg-panel,
                .keyboard-footer {
                    min-width: 0;
                }

                .section-label,
                .display-status,
                .bank-readout,
                .mini-label,
                .octave-readout {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .section-label,
                .mini-label {
                    font-size: 10px;
                    color: rgba(212, 220, 230, 0.34);
                }

                .wavetable-panel {
                    display: grid;
                    min-width: 0;
                    gap: 0;
                }

                .display-status,
                .bank-readout,
                .position-label {
                    font-size: 10px;
                    color: rgba(212, 220, 230, 0.42);
                }

                .table-picker {
                    display: grid;
                    gap: 6px;
                }

                .bank-picker-trigger {
                    position: relative;
                    display: inline-flex;
                    align-items: end;
                    min-width: 0;
                    max-width: min(72%, 260px);
                    pointer-events: auto;
                }

                .table-select-overlay {
                    position: absolute;
                    inset: -8px -10px;
                    width: calc(100% + 20px);
                    min-height: 40px;
                    opacity: 0.001;
                    appearance: none;
                    border: 0;
                    background: transparent;
                    color: transparent;
                    font-size: 16px;
                }

                .table-retry-button {
                    border: 1px solid rgba(245, 108, 182, 0.28);
                    border-radius: 999px;
                    background: rgba(245, 108, 182, 0.08);
                    color: #ffd8e8;
                    padding: 6px 10px;
                    font-size: 10px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .table-retry-button[hidden] {
                    display: none;
                }

                .table-error-banner {
                    display: block;
                    min-width: 0;
                    padding: 10px 12px;
                    border-radius: 14px;
                    border: 1px solid rgba(245, 108, 182, 0.24);
                    background: rgba(245, 108, 182, 0.12);
                    color: #ffd8e8;
                    font-size: 12px;
                    line-height: 1.35;
                }

                .table-error-banner[hidden] {
                    display: none;
                }

                .shape-readout,
                .position-readout {
                    font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
                    font-weight: 600;
                    letter-spacing: -0.03em;
                    color: #87d7f5;
                }

                .shape-readout {
                    font-size: 12px;
                }

                .position-readout {
                    font-size: 20px;
                    line-height: 1;
                }

                .wavetable-stage {
                    position: relative;
                    width: 100%;
                    min-width: 0;
                    max-width: 100%;
                    min-height: var(--cosimo-stage-min-height);
                    aspect-ratio: 1.55 / 1;
                    border-radius: 0;
                    overflow: hidden;
                    background: transparent;
                    touch-action: none;
                }

                .wavetable-stage::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(rgba(255, 255, 255, 0.026) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.026) 1px, transparent 1px);
                    background-size: 28px 28px;
                    opacity: 0.24;
                    pointer-events: none;
                }

                .wavetable-display-stack {
                    position: absolute;
                    inset: 0;
                }

                .wavetable-layer {
                    position: absolute;
                    inset: 0;
                    will-change: transform;
                }

                .wavetable-canvas {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    display: block;
                }

                .display-overlay {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    place-items: center;
                    text-align: center;
                    padding: 20px;
                    font-size: 13px;
                    color: rgba(255, 216, 172, 0.86);
                    background: rgba(4, 7, 18, 0.82);
                    backdrop-filter: blur(4px);
                }

                .display-overlay[hidden] {
                    display: none;
                }

                .stage-copy {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    gap: 8px;
                    padding: 12px;
                    pointer-events: none;
                }

                .stage-copy-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                }

                .stage-copy-row:last-child {
                    align-items: end;
                }

                .mini-label.active {
                    color: #87d7f5;
                }

                .mini-label.warm {
                    color: #f2b86b;
                }

                .bank-readout {
                    min-width: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                }

                .display-status {
                    justify-self: start;
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.04);
                }

                .keyboard-footer {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    gap: 0;
                    padding: 0 12px;
                    border-top: 0;
                    background: #04070f;
                    box-shadow: none;
                }

                .keyboard-toolbar {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .octave-controls {
                    display: inline-grid;
                    grid-template-columns: auto auto auto;
                    gap: 8px;
                    align-items: center;
                }

                .octave-button {
                    min-width: 72px;
                    min-height: 34px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.04);
                    color: #eef2f5;
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .octave-button:disabled {
                    opacity: 0.32;
                }

                .octave-readout {
                    min-width: 88px;
                    text-align: center;
                    font-size: 12px;
                    color: #87d7f5;
                }

                .keyboard-host {
                    min-width: 0;
                    min-height: var(--cosimo-keyboard-height);
                    display: grid;
                    align-items: stretch;
                }

                .keyboard {
                    width: 100%;
                    height: var(--cosimo-keyboard-height);
                    border-radius: 14px 14px 0 0;
                    overflow: hidden;
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 18%),
                        linear-gradient(180deg, rgba(10, 13, 18, 0.68), rgba(7, 9, 13, 0.92));
                    padding: 6px 6px 0;
                    touch-action: none;
                }

                .mseg-panel {
                    display: grid;
                    min-width: 0;
                    gap: 10px;
                }

                .play-panel {
                    display: grid;
                    min-width: 0;
                    gap: 0;
                }

                .play-grid {
                    display: grid;
                    min-width: 0;
                    grid-template-columns: minmax(132px, 160px) minmax(0, 1fr);
                    gap: 10px;
                    align-items: center;
                }

                .play-field {
                    display: grid;
                    min-width: 0;
                    gap: 0;
                }

                .glide-field-body {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 10px;
                    align-items: center;
                }

                .play-select {
                    width: 100%;
                    min-height: 36px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.04);
                    color: #eef2f5;
                    padding: 8px 10px;
                    font-size: 13px;
                }

                .glide-time-slider {
                    width: 100%;
                }

                .glide-time-readout {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    font-size: 12px;
                    color: #87d7f5;
                    letter-spacing: 0.08em;
                    white-space: nowrap;
                }

                .mseg-head {
                    display: grid;
                    min-width: 0;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 8px;
                    align-items: end;
                }

                .mseg-title {
                    display: grid;
                    gap: 4px;
                }

                .mseg-title strong {
                    font-size: 15px;
                    font-weight: 600;
                    color: #eef2f5;
                    letter-spacing: -0.03em;
                }

                .mseg-depth-readout {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    font-size: 12px;
                    color: #87d7f5;
                    letter-spacing: 0.08em;
                }

                .mseg-editor-shell {
                    border-radius: 0;
                    overflow: hidden;
                    border: 0;
                    background: transparent;
                }

                .mseg-editor {
                    display: block;
                    width: 100%;
                    height: 148px;
                    touch-action: none;
                }

                .mseg-grid {
                    stroke: rgba(255, 255, 255, 0.08);
                    stroke-width: 1;
                }

                .mseg-curve {
                    fill: none;
                    stroke: #87d7f5;
                    stroke-width: 3;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                }

                .mseg-point {
                    fill: #ffd8a6;
                    stroke: rgba(4, 7, 15, 0.96);
                    stroke-width: 2;
                }

                @media (max-height: 720px) {
                    .ios-content {
                        gap: 14px;
                    }

                    .mseg-editor {
                        height: 136px;
                    }
                }

                ${getMsegStyles("ios")}
            </style>

            <div class="ios-shell">
                <div class="ios-top-row">
                    <div class="ios-main-view">
                        <div class="ios-scroll">
                            <div class="ios-content">
                            <div class="wavetable-panel">
                                <div class="wavetable-stage" data-state="loading">
                                    <div class="wavetable-display-stack">
                                        <div class="wavetable-layer">
                                            <canvas class="wavetable-canvas"></canvas>
                                        </div>
                                        <div class="wavetable-layer">
                                            <canvas class="wavetable-canvas"></canvas>
                                        </div>
                                    </div>
                                    <div class="display-overlay">Loading wavetable bank…</div>
                                    <div class="stage-copy">
                                        <div class="stage-copy-row">
                                            <div class="mini-label active">Wavescan</div>
                                            <div class="display-status" data-role="display-status">Loading wavetable bank…</div>
                                            <div class="shape-readout" data-role="hero-frame-readout">01/16</div>
                                        </div>
                                        <div class="table-error-banner" data-role="table-error-banner" hidden></div>
                                        <div></div>
                                        <div class="stage-copy-row">
                                            <label class="bank-picker-trigger">
                                                <div class="bank-readout">Factory bank</div>
                                                <select class="table-select table-select-overlay" aria-label="Select wavetable"></select>
                                            </label>
                                            <button class="table-retry-button" type="button" hidden>Retry</button>
                                            <div class="mini-label warm" data-role="stage-gesture-hint">Swipe + Drag</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="play-panel">
                                <div class="play-grid">
                                    <label class="play-field" aria-label="Voice mode">
                                        <select class="play-select play-mode-select" aria-label="Voice mode">${buildSelectOptionsHTML(PLAY_MODE_OPTIONS)}</select>
                                    </label>
                                    <label class="play-field" aria-label="Glide time">
                                        <div class="glide-field-body">
                                            <input class="glide-time-slider" type="range" min="0" max="1" step="0.001" value="0.000" aria-label="Glide time" />
                                            <div class="glide-time-readout" data-role="glide-time-readout">0.000 s</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            ${buildMsegLauncherHTML()}

                            <div class="keyboard-toolbar">
                                <div class="octave-controls">
                                    <button class="octave-button octave-down" type="button">Oct -</button>
                                    <div class="octave-readout" data-role="octave-readout">C3 - C5</div>
                                    <button class="octave-button octave-up" type="button">Oct +</button>
                                </div>
                            </div>
                            </div>
                        </div>
                    </div>

                    ${buildMsegModalHTML()}
                </div>

                <div class="keyboard-footer">
                    <div class="keyboard-host"></div>
                </div>
            </div>
        `;
    }
}

export function createPatchViewWithOptions(patchConnection, options = {}) {
    const tagName = "cosimo-synth-view";

    if (!window.customElements.get(tagName)) {
        window.customElements.define(tagName, CosimoSynthView);
    }

    return new (window.customElements.get(tagName))(patchConnection, options);
}

export default function createPatchView(patchConnection) {
    return createPatchViewWithOptions(patchConnection);
}
