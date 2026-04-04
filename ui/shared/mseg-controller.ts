import type { PatchConnectionLike } from "./cmajor-react";
import {
    MSEG_DEFAULT_DEPTH,
    addMsegPoint,
    clampMsegDepth,
    createDefaultMsegPlayback,
    createDefaultMsegShape,
    deleteMsegPoint,
    deserializeMsegDepth,
    deserializeMsegPlayback,
    deserializeMsegShape,
    msegPlaybacksEqual,
    msegShapesEqual,
    moveMsegPoint,
    normalizeMsegPlayback,
    normalizeMsegShape,
    renderMsegShape,
    setMsegSegmentCurvePower,
    serializeMsegPlayback,
    serializeMsegShape,
    toMsegPlaybackConfigEvent,
    type MsegPlayback,
    type MsegShape,
    type MsegState,
} from "./mseg";

export const MSEG_SHAPE_STATE_KEY = "mseg1.shape";
export const MSEG_PLAYBACK_STATE_KEY = "mseg1.playback";
export const MSEG_DEPTH_STATE_KEY = "mseg1.depth";
export const MSEG_BUFFER_ENDPOINT_ID = "mseg1Buffer";
export const MSEG_PLAYBACK_ENDPOINT_ID = "mseg1Playback";
export const MSEG_DEPTH_ENDPOINT_ID = "mseg1Depth";

type StoredStateMessage = {
    key?: unknown;
    value?: unknown;
};

type MsegControllerOptions = {
    shapeKey?: string;
    playbackKey?: string;
    depthKey?: string;
    bufferEndpointID?: string;
    playbackEndpointID?: string;
    depthEndpointID?: string;
    onStateChange?: ((state: MsegState) => void) | null;
};

export class MsegController {
    private readonly patchConnection: PatchConnectionLike;
    private readonly options: Required<Omit<MsegControllerOptions, "onStateChange">> & {
        onStateChange: ((state: MsegState) => void) | null;
    };

    private shape: MsegShape = createDefaultMsegShape();
    private playback: MsegPlayback = createDefaultMsegPlayback();
    private depth = MSEG_DEFAULT_DEPTH;
    private pendingBootState: Record<string, unknown> | null = null;
    private pendingBootKeys: Set<string> | null = null;

    constructor(patchConnection: PatchConnectionLike, options: MsegControllerOptions = {}) {
        this.patchConnection = patchConnection;
        this.options = {
            shapeKey: MSEG_SHAPE_STATE_KEY,
            playbackKey: MSEG_PLAYBACK_STATE_KEY,
            depthKey: MSEG_DEPTH_STATE_KEY,
            bufferEndpointID: MSEG_BUFFER_ENDPOINT_ID,
            playbackEndpointID: MSEG_PLAYBACK_ENDPOINT_ID,
            depthEndpointID: MSEG_DEPTH_ENDPOINT_ID,
            onStateChange: null,
            ...options,
        };
        this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
    }

    attach() {
        this.patchConnection.addStoredStateValueListener?.(this.handleStoredStateValue);
    }

    detach() {
        this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValue);
    }

    requestBootState() {
        if (typeof this.patchConnection.requestFullStoredState === "function") {
            this.patchConnection.requestFullStoredState((state) => {
                this.applyBootState(state);
            });
            return;
        }

        if (typeof this.patchConnection.requestStoredStateValue !== "function") {
            this.uploadAll();
            this.emitStateChange();
            return;
        }

        this.pendingBootState = {};
        this.pendingBootKeys = new Set([
            this.options.shapeKey,
            this.options.playbackKey,
            this.options.depthKey,
        ]);

        this.patchConnection.requestStoredStateValue(this.options.shapeKey);
        this.patchConnection.requestStoredStateValue(this.options.playbackKey);
        this.patchConnection.requestStoredStateValue(this.options.depthKey);
    }

    getState(): MsegState {
        return {
            shape: this.shape,
            playback: this.playback,
            depth: this.depth,
        };
    }

    private handleStoredStateValue(message: unknown) {
        if (!message || typeof message !== "object") {
            return;
        }

        const nextMessage = message as StoredStateMessage;
        const key = typeof nextMessage.key === "string" ? nextMessage.key : null;

        if (!key) {
            return;
        }

        if (this.pendingBootKeys?.has(key)) {
            if (this.pendingBootState) {
                this.pendingBootState[key] = nextMessage.value;
            }
            this.pendingBootKeys.delete(key);

            if (this.pendingBootKeys.size === 0) {
                const nextBootState = this.pendingBootState;
                this.pendingBootState = null;
                this.pendingBootKeys = null;
                this.applyBootState(nextBootState ?? {});
            }
            return;
        }

        if (key === this.options.shapeKey) {
            this.shape = deserializeMsegShape(nextMessage.value);
            this.uploadBuffer();
            this.emitStateChange();
        } else if (key === this.options.playbackKey) {
            this.playback = deserializeMsegPlayback(nextMessage.value);
            this.uploadPlayback();
            this.emitStateChange();
        } else if (key === this.options.depthKey) {
            this.depth = deserializeMsegDepth(nextMessage.value);
            this.uploadDepth();
            this.emitStateChange();
        }
    }

    private applyBootState(state: Record<string, unknown>) {
        const fullState = state && typeof state === "object" ? state : {};
        this.shape = deserializeMsegShape(fullState[this.options.shapeKey]);
        this.playback = deserializeMsegPlayback(fullState[this.options.playbackKey]);
        this.depth = deserializeMsegDepth(fullState[this.options.depthKey]);
        this.pendingBootState = null;
        this.pendingBootKeys = null;
        this.uploadAll();
        this.emitStateChange();
    }

    setShape(nextShape: unknown) {
        const normalizedShape = normalizeMsegShape(nextShape);
        if (msegShapesEqual(this.shape, normalizedShape)) {
            return;
        }

        this.shape = normalizedShape;
        this.patchConnection.sendStoredStateValue?.(this.options.shapeKey, serializeMsegShape(this.shape));
        this.uploadBuffer();
        this.emitStateChange();
    }

    setPlayback(nextPlayback: unknown) {
        const normalizedPlayback = normalizeMsegPlayback(nextPlayback);
        if (msegPlaybacksEqual(this.playback, normalizedPlayback)) {
            return;
        }

        this.playback = normalizedPlayback;
        this.patchConnection.sendStoredStateValue?.(this.options.playbackKey, serializeMsegPlayback(this.playback));
        this.uploadPlayback();
        this.emitStateChange();
    }

    setDepth(nextDepth: number) {
        const clampedDepth = clampMsegDepth(nextDepth);
        if (this.depth === clampedDepth) {
            return;
        }

        this.depth = clampedDepth;
        this.patchConnection.sendStoredStateValue?.(this.options.depthKey, this.depth);
        this.uploadDepth();
        this.emitStateChange();
    }

    addPoint(x: number, y: number) {
        this.setShape(addMsegPoint(this.shape, x, y));
    }

    movePoint(pointIndex: number, x: number, y: number) {
        this.setShape(moveMsegPoint(this.shape, pointIndex, x, y));
    }

    deletePoint(pointIndex: number) {
        this.setShape(deleteMsegPoint(this.shape, pointIndex));
    }

    setSegmentCurvePower(segmentIndex: number, curvePower: number) {
        this.setShape(setMsegSegmentCurvePower(this.shape, segmentIndex, curvePower));
    }

    private uploadAll() {
        this.uploadBuffer();
        this.uploadPlayback();
        this.uploadDepth();
    }

    private uploadBuffer() {
        this.patchConnection.sendEventOrValue?.(this.options.bufferEndpointID, Array.from(renderMsegShape(this.shape)));
    }

    private uploadPlayback() {
        this.patchConnection.sendEventOrValue?.(this.options.playbackEndpointID, toMsegPlaybackConfigEvent(this.playback));
    }

    private uploadDepth() {
        this.patchConnection.sendEventOrValue?.(this.options.depthEndpointID, this.depth);
    }

    private emitStateChange() {
        this.options.onStateChange?.(this.getState());
    }
}
