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
    serializeMsegPlayback,
    serializeMsegShape,
    toMsegPlaybackConfigEvent,
} from "./mseg.js";

export const MSEG_SHAPE_STATE_KEY = "mseg1.shape";
export const MSEG_PLAYBACK_STATE_KEY = "mseg1.playback";
export const MSEG_DEPTH_STATE_KEY = "mseg1.depth";
export const MSEG_BUFFER_ENDPOINT_ID = "mseg1Buffer";
export const MSEG_PLAYBACK_ENDPOINT_ID = "mseg1Playback";
export const MSEG_DEPTH_ENDPOINT_ID = "mseg1Depth";

export class MsegController {
    constructor(patchConnection, options = {}) {
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
        this.shape = createDefaultMsegShape();
        this.playback = createDefaultMsegPlayback();
        this.depth = MSEG_DEFAULT_DEPTH;
        this.hasBootstrapped = false;
        this.pendingBootState = null;
        this.pendingBootKeys = null;
        this.handleStoredStateValue = (message) => this.onStoredStateValue(message);
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
            this.hasBootstrapped = true;
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

    getState() {
        return {
            shape: this.shape,
            playback: this.playback,
            depth: this.depth,
        };
    }

    onStoredStateValue(message) {
        if (!message || typeof message !== "object") {
            return;
        }

        if (this.pendingBootKeys?.has(message.key)) {
            this.pendingBootState[message.key] = message.value;
            this.pendingBootKeys.delete(message.key);

            if (this.pendingBootKeys.size === 0) {
                const nextBootState = this.pendingBootState;
                this.pendingBootState = null;
                this.pendingBootKeys = null;
                this.applyBootState(nextBootState);
            }
            return;
        }

        if (message.key === this.options.shapeKey) {
            this.shape = deserializeMsegShape(message.value);
            this.uploadBuffer();
            this.emitStateChange();
        } else if (message.key === this.options.playbackKey) {
            this.playback = deserializeMsegPlayback(message.value);
            this.uploadPlayback();
            this.emitStateChange();
        } else if (message.key === this.options.depthKey) {
            this.depth = deserializeMsegDepth(message.value);
            this.uploadDepth();
            this.emitStateChange();
        }
    }

    applyBootState(state) {
        const fullState = state && typeof state === "object" ? state : {};
        this.shape = deserializeMsegShape(fullState[this.options.shapeKey]);
        this.playback = deserializeMsegPlayback(fullState[this.options.playbackKey]);
        this.depth = deserializeMsegDepth(fullState[this.options.depthKey]);
        this.pendingBootState = null;
        this.pendingBootKeys = null;
        this.uploadAll();
        this.hasBootstrapped = true;
        this.emitStateChange();
    }

    setShape(nextShape) {
        const normalizedShape = normalizeMsegShape(nextShape);
        if (msegShapesEqual(this.shape, normalizedShape)) {
            return;
        }

        this.shape = normalizedShape;
        this.patchConnection.sendStoredStateValue?.(this.options.shapeKey, serializeMsegShape(this.shape));
        this.uploadBuffer();
        this.emitStateChange();
    }

    setPlayback(nextPlayback) {
        const normalizedPlayback = normalizeMsegPlayback(nextPlayback);
        if (msegPlaybacksEqual(this.playback, normalizedPlayback)) {
            return;
        }

        this.playback = normalizedPlayback;
        this.patchConnection.sendStoredStateValue?.(
            this.options.playbackKey,
            serializeMsegPlayback(this.playback)
        );
        this.uploadPlayback();
        this.emitStateChange();
    }

    setDepth(nextDepth) {
        const clampedDepth = clampMsegDepth(nextDepth);
        if (this.depth === clampedDepth) {
            return;
        }

        this.depth = clampedDepth;
        this.patchConnection.sendStoredStateValue?.(this.options.depthKey, this.depth);
        this.uploadDepth();
        this.emitStateChange();
    }

    addPoint(x, y) {
        this.setShape(addMsegPoint(this.shape, x, y));
    }

    movePoint(pointIndex, x, y) {
        this.setShape(moveMsegPoint(this.shape, pointIndex, x, y));
    }

    deletePoint(pointIndex) {
        this.setShape(deleteMsegPoint(this.shape, pointIndex));
    }

    uploadAll() {
        this.uploadBuffer();
        this.uploadPlayback();
        this.uploadDepth();
    }

    uploadBuffer() {
        this.patchConnection.sendEventOrValue?.(
            this.options.bufferEndpointID,
            Array.from(renderMsegShape(this.shape))
        );
    }

    uploadPlayback() {
        this.patchConnection.sendEventOrValue?.(
            this.options.playbackEndpointID,
            toMsegPlaybackConfigEvent(this.playback)
        );
    }

    uploadDepth() {
        this.patchConnection.sendEventOrValue?.(this.options.depthEndpointID, this.depth);
    }

    emitStateChange() {
        this.options.onStateChange?.(this.getState());
    }
}
