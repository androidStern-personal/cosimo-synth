import {
    ENHANCER_LITE_SETTING_DESCRIPTORS,
    type EnhancerLiteShape,
    type EnhancerLiteSettingDescriptor,
} from "./enhancer-lite-state";
import {
    ENHANCER_FREQUENCY_TICKS as ENHANCER_LITE_FREQUENCY_TICKS,
    ENHANCER_SPECTRUM_PLOT as ENHANCER_LITE_PLOT,
    advanceEnhancerSpectrum as advanceEnhancerLiteSpectrum,
    createEnhancerFrequencyPath,
    enhancerBellResponseDb,
    enhancerFrequencyAfterClientDrag,
    enhancerFrequencyTicksForWidth,
    enhancerFrequencyX as enhancerLiteFrequencyX,
    enhancerGainY as enhancerLiteGainY,
    formatEnhancerFrequencyTick,
    type EnhancerSpectrumDisplay as EnhancerLiteSpectrumDisplay,
} from "../../../kit/index";
import {
    ENHANCER_LITE_ANALYZER_ENDPOINTS,
    ENHANCER_LITE_DB_ROWS,
    enhancerLiteShelfGainY,
} from "./spectrum";
import {
    ENHANCER_LITE_GESTURE_POLICY,
    enhancerLiteAmountFromUpwardPixels,
    enhancerLiteFrequencyFromHorizontalPixels,
    enhancerLiteQFromUpwardPixels,
} from "./gesture-policy";
import {
    EffectSnapshotBankController,
    createEffectHeader,
    createStandaloneEffectPresetController,
    type PatchConnectionLike,
    type StandaloneEffectPresetController,
} from "../../../kit/index";
import { ENHANCER_LITE_FACTORY_PRESETS } from "./factory-presets.js";

type ParameterListener = ((value: unknown) => void) & { endpointID?: string };
type EndpointListener = (message: unknown) => void;

/**
 * The kit's patch-connection shape, with the members this view calls itself
 * made required. The preset and snapshot controllers take the same object.
 */
type EnhancerLitePatchConnection = PatchConnectionLike & Required<Pick<
    PatchConnectionLike,
    | "addParameterListener"
    | "removeParameterListener"
    | "requestParameterValue"
    | "addEndpointListener"
    | "removeEndpointListener"
    | "sendEventOrValue"
>>;

/** Identity for presets, snapshots, and their stored-state keys. */
const effectID = "enhancer-lite";

type NumericDescriptor = Extract<EnhancerLiteSettingDescriptor, { readonly kind: "number" }>;
type ResponseRole = "primary" | "side";
type ReadoutRole = "frequency" | "primary-amount" | "side-amount" | "q";
type SpectrumRole = "input" | "output";

type NumberControl = NumericDescriptor & {
    readonly scale: "linear" | "log";
    readonly format: (value: number) => string;
};

type ResponseDrag = {
    readonly pointerID: number;
    readonly role: ResponseRole;
    readonly originClientX: number;
    readonly originClientY: number;
    readonly originFrequencyHz: number;
    readonly originAmount: number;
    readonly originQ: number;
    readonly captureTarget: SVGElement;
};

type ReadoutDrag = {
    readonly pointerID: number;
    readonly role: ReadoutRole;
    readonly originClientX: number;
    readonly originClientY: number;
    readonly originValue: number;
    readonly captureTarget: HTMLElement;
};

function requireNumberDescriptor(
    id: "freqHz" | "q" | "midAmount" | "sideAmount",
): NumericDescriptor {
    const descriptor = ENHANCER_LITE_SETTING_DESCRIPTORS.find((candidate) => candidate.id === id);
    if (!descriptor || descriptor.kind !== "number")
        throw new Error(`Enhancer Lite state is missing ${id}.`);

    return descriptor;
}

const formatFrequency = (value: number): string => (
    value >= 1000
        ? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} kHz`
        : `${Math.round(value)} Hz`
);
const formatQ = (value: number): string => value.toFixed(2);
const formatBoost = (value: number): string => `+${(value * 12).toFixed(1)} dB`;

const frequencyControl: NumberControl = {
    ...requireNumberDescriptor("freqHz"),
    scale: "log",
    format: formatFrequency,
};
const qControl: NumberControl = {
    ...requireNumberDescriptor("q"),
    scale: "log",
    format: formatQ,
};
const midAmountControl: NumberControl = {
    ...requireNumberDescriptor("midAmount"),
    scale: "linear",
    format: formatBoost,
};
const sideAmountControl: NumberControl = {
    ...requireNumberDescriptor("sideAmount"),
    scale: "linear",
    format: formatBoost,
};

const modeEndpointID = "modeIn";
const curveEndpointID = "curveIn";
const saturationModeEndpointID = "saturationModeIn";
const shapeEndpointID = "shapeIn";
const endpointInitialValues = new Map<string, number>([
    [frequencyControl.dspEndpointID, frequencyControl.initial],
    [qControl.dspEndpointID, qControl.initial],
    [modeEndpointID, 0],
    [midAmountControl.dspEndpointID, midAmountControl.initial],
    [sideAmountControl.dspEndpointID, sideAmountControl.initial],
    [curveEndpointID, 1],
    [saturationModeEndpointID, 0],
    [shapeEndpointID, 1],
]);

const responseModelSampleRate = 48_000 * 4;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function shelfResponseDb(
    shape: Exclude<EnhancerLiteShape, "bell">,
    frequencyHz: number,
    centreHz: number,
    q: number,
    amount: number,
): number {
    const gainDb = 12 * clamp(amount, 0, 1);
    const amplitude = Math.pow(10, gainDb / 40);
    const centreOmega = 2 * Math.PI * clamp(centreHz, 20, 20_000)
        / responseModelSampleRate;
    const centreCosine = Math.cos(centreOmega);
    const beta = Math.sin(centreOmega) * Math.sqrt(amplitude) / clamp(q, 0.1, 10);
    const plus = amplitude + 1;
    const minus = amplitude - 1;
    let b0: number;
    let b1: number;
    let b2: number;
    let a0: number;
    let a1: number;
    let a2: number;
    if (shape === "low") {
        b0 = amplitude * (plus - minus * centreCosine + beta);
        b1 = 2 * amplitude * (minus - plus * centreCosine);
        b2 = amplitude * (plus - minus * centreCosine - beta);
        a0 = plus + minus * centreCosine + beta;
        a1 = -2 * (minus + plus * centreCosine);
        a2 = plus + minus * centreCosine - beta;
    } else {
        b0 = amplitude * (plus + minus * centreCosine + beta);
        b1 = -2 * amplitude * (minus + plus * centreCosine);
        b2 = amplitude * (plus + minus * centreCosine - beta);
        a0 = plus - minus * centreCosine + beta;
        a1 = 2 * (minus - plus * centreCosine);
        a2 = plus - minus * centreCosine - beta;
    }

    const omega = 2 * Math.PI * clamp(frequencyHz, 20, 20_000)
        / responseModelSampleRate;
    const z1Real = Math.cos(omega);
    const z1Imaginary = -Math.sin(omega);
    const z2Real = Math.cos(2 * omega);
    const z2Imaginary = -Math.sin(2 * omega);
    const numeratorReal = b0 + b1 * z1Real + b2 * z2Real;
    const numeratorImaginary = b1 * z1Imaginary + b2 * z2Imaginary;
    const denominatorReal = a0 + a1 * z1Real + a2 * z2Real;
    const denominatorImaginary = a1 * z1Imaginary + a2 * z2Imaginary;
    const numeratorPower = numeratorReal * numeratorReal + numeratorImaginary * numeratorImaginary;
    const denominatorPower = denominatorReal * denominatorReal + denominatorImaginary * denominatorImaginary;
    return 10 * Math.log10(Math.max(numeratorPower / denominatorPower, 1e-30));
}

function responseDb(
    shape: EnhancerLiteShape,
    frequencyHz: number,
    centreHz: number,
    q: number,
    amount: number,
): number {
    return shape === "bell"
        ? enhancerBellResponseDb(frequencyHz, centreHz, q, amount)
        : shelfResponseDb(shape, frequencyHz, centreHz, q, amount);
}

function responsePath(
    shape: EnhancerLiteShape,
    centreHz: number,
    q: number,
    amount: number,
    closeArea = false,
): string {
    const path = createEnhancerFrequencyPath((frequencyHz) => {
        const gainDb = responseDb(shape, frequencyHz, centreHz, q, amount);
        return shape === "bell"
            ? enhancerLiteGainY(gainDb)
            : enhancerLiteShelfGainY(gainDb);
    });
    if (closeArea) {
        const baseline = enhancerLiteGainY(0).toFixed(2);
        return `${path} L ${(
            ENHANCER_LITE_PLOT.width - ENHANCER_LITE_PLOT.right
        ).toFixed(2)} ${baseline} L ${ENHANCER_LITE_PLOT.left.toFixed(2)} ${baseline} Z`;
    }
    return path;
}

class EnhancerLiteView extends HTMLElement {
    readonly patchConnection: EnhancerLitePatchConnection;
    readonly root: ShadowRoot;
    readonly values = new Map(endpointInitialValues);
    readonly parameterListeners: Array<{ readonly endpointID: string; readonly listener: ParameterListener }> = [];
    readonly endpointListeners: Array<{ readonly endpointID: string; readonly listener: EndpointListener }> = [];
    readonly spectrumDisplays = new Map<SpectrumRole, EnhancerLiteSpectrumDisplay>();
    // The kit's preset bar and A-G snapshots, mounted as one header above the
    // Lite surface. Both controllers address the eight sound endpoints the
    // patch exposes as parameters; the hidden analyzer endpoints stay out.
    readonly presetController: StandaloneEffectPresetController;
    readonly snapshotController: EffectSnapshotBankController;
    readonly effectHeader: ReturnType<typeof createEffectHeader>;
    hasAttached = false;
    drag: ResponseDrag | undefined;
    readoutDrag: ReadoutDrag | undefined;
    frequencyTickResizeObserver: ResizeObserver | undefined;

    constructor(patchConnection: EnhancerLitePatchConnection) {
        super();
        this.patchConnection = patchConnection;
        this.presetController = createStandaloneEffectPresetController({
            effectID,
            patchConnection,
            factoryPresets: ENHANCER_LITE_FACTORY_PRESETS,
        });
        this.snapshotController = new EffectSnapshotBankController({
            effectID,
            patchConnection,
        });
        this.effectHeader = createEffectHeader();
        this.effectHeader.presetController = this.presetController;
        this.effectHeader.snapshotController = this.snapshotController;
        this.root = this.attachShadow({ mode: "open" });
        this.root.innerHTML = this.getMarkup();
        this.requireElement<HTMLElement>(".shell").before(this.effectHeader);
        this.bindControls();
        this.renderAll();
    }

    connectedCallback(): void {
        if (this.hasAttached)
            return;

        this.hasAttached = true;
        for (const endpointID of endpointInitialValues.keys()) {
            const listener: ParameterListener = (value) => {
                if (typeof value !== "number" || !Number.isFinite(value))
                    return;

                this.values.set(endpointID, value);
                this.renderEndpoint(endpointID);
            };
            listener.endpointID = endpointID;
            this.parameterListeners.push({ endpointID, listener });
            this.patchConnection.addParameterListener(endpointID, listener);
            this.patchConnection.requestParameterValue(endpointID);
        }

        for (const role of ["input", "output"] as const) {
            const endpointID = ENHANCER_LITE_ANALYZER_ENDPOINTS[role];
            const listener: EndpointListener = (message) => this.renderSpectrum(role, message);
            this.endpointListeners.push({ endpointID, listener });
            this.patchConnection.addEndpointListener(endpointID, listener);
        }
        this.patchConnection.sendEventOrValue(
            ENHANCER_LITE_ANALYZER_ENDPOINTS.enabled,
            1,
            0,
        );
        const responsePlot = this.requireElement<SVGSVGElement>(".response-plot");
        this.frequencyTickResizeObserver = new ResizeObserver(() => {
            this.renderFrequencyTickDensity();
        });
        this.frequencyTickResizeObserver.observe(responsePlot);
        this.renderFrequencyTickDensity();

        // The header drops its bar bindings whenever it leaves the document,
        // so rebind before the controllers come back to life.
        this.effectHeader.presetController = this.presetController;
        this.effectHeader.snapshotController = this.snapshotController;
        this.snapshotController.attach();
        this.presetController.attach();
    }

    disconnectedCallback(): void {
        this.snapshotController.detach();
        this.presetController.detach();
        this.effectHeader.presetController = null;
        this.effectHeader.snapshotController = null;
        this.endReadoutDrag();
        this.endResponseDrag();
        this.patchConnection.sendEventOrValue(
            ENHANCER_LITE_ANALYZER_ENDPOINTS.enabled,
            0,
            0,
        );
        for (const { endpointID, listener } of this.parameterListeners)
            this.patchConnection.removeParameterListener(endpointID, listener);
        for (const { endpointID, listener } of this.endpointListeners)
            this.patchConnection.removeEndpointListener(endpointID, listener);

        this.parameterListeners.length = 0;
        this.endpointListeners.length = 0;
        this.spectrumDisplays.clear();
        this.frequencyTickResizeObserver?.disconnect();
        this.frequencyTickResizeObserver = undefined;
        this.hasAttached = false;
        this.drag = undefined;
    }

    requireElement<T extends Element>(selector: string): T {
        const element = this.root.querySelector<T>(selector);
        if (!element)
            throw new Error(`Enhancer Lite markup is missing ${selector}.`);

        return element;
    }

    bindControls(): void {
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
            button.addEventListener("click", () => {
                this.sendValue(modeEndpointID, button.dataset.mode === "mid-side" ? 1 : 0);
            });
        }
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-curve]")) {
            button.addEventListener("click", () => {
                this.sendValue(curveEndpointID, button.dataset.curve === "solid" ? 1 : 0);
            });
        }
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-saturation-mode]")) {
            button.addEventListener("click", () => {
                this.sendValue(
                    saturationModeEndpointID,
                    button.dataset.saturationMode === "medium" ? 1 : 0,
                );
            });
        }
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-shape]")) {
            button.addEventListener("click", () => {
                const shape = button.dataset.shape;
                this.sendValue(shapeEndpointID, shape === "low" ? 0 : (shape === "high" ? 2 : 1));
            });
        }

        for (const role of ["primary", "side"] as const) {
            for (const target of this.root.querySelectorAll<SVGElement>(`[data-drag-role='${role}']`)) {
                target.addEventListener("pointerdown", (event) => this.beginResponseDrag(event, role));
                target.addEventListener("pointermove", (event) => this.moveResponseDrag(event));
                target.addEventListener("pointerup", (event) => this.endResponseDrag(event.pointerId));
                target.addEventListener("pointercancel", (event) => this.endResponseDrag(event.pointerId));
                target.addEventListener(
                    "lostpointercapture",
                    (event) => this.endResponseDrag(event.pointerId, false),
                );
                target.addEventListener("keydown", (event) => this.handleResponseKey(event, role));
            }
        }

        for (const role of ["frequency", "primary-amount", "side-amount", "q"] as const)
            this.bindReadoutControl(role);
    }

    bindReadoutControl(role: ReadoutRole): void {
        const readout = this.requireElement<HTMLElement>(`[data-readout-control='${role}']`);
        readout.addEventListener("pointerdown", (event) => this.beginReadoutDrag(event, role));
        readout.addEventListener("pointermove", (event) => this.moveReadoutDrag(event));
        readout.addEventListener("pointerup", (event) => this.endReadoutDrag(event.pointerId));
        readout.addEventListener("pointercancel", (event) => this.endReadoutDrag(event.pointerId));
        readout.addEventListener("keydown", (event) => this.handleReadoutKey(event, role));
        readout.addEventListener(
            "lostpointercapture",
            (event) => this.endReadoutDrag(event.pointerId, false),
        );
    }

    sendValue(endpointID: string, value: number): void {
        const previous = this.values.get(endpointID);
        if (previous !== undefined && Math.abs(previous - value) <= 1e-9)
            return;

        this.values.set(endpointID, value);
        this.renderEndpoint(endpointID);
        this.patchConnection.sendEventOrValue(endpointID, value, 0);
    }

    beginReadoutDrag(event: PointerEvent, role: ReadoutRole): void {
        if (!event.isPrimary
            || event.button !== 0
            || (role === "side-amount" && !this.isMidSide())) {
            return;
        }

        if (!(event.currentTarget instanceof HTMLElement))
            return;

        this.endResponseDrag();
        this.endReadoutDrag();
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.toggleAttribute("data-dragging", true);
        this.readoutDrag = {
            pointerID: event.pointerId,
            role,
            originClientX: event.clientX,
            originClientY: event.clientY,
            originValue: role === "frequency"
                ? this.valueFor(frequencyControl)
                : (role === "q"
                    ? this.valueFor(qControl)
                    : this.valueFor(role === "side-amount" ? sideAmountControl : midAmountControl)),
            captureTarget: event.currentTarget,
        };
    }

    moveReadoutDrag(event: PointerEvent): void {
        const drag = this.readoutDrag;
        if (!drag || drag.pointerID !== event.pointerId)
            return;

        event.preventDefault();
        if (drag.role === "frequency") {
            this.sendValue(
                frequencyControl.dspEndpointID,
                clamp(
                    enhancerLiteFrequencyFromHorizontalPixels(
                        drag.originValue,
                        event.clientX - drag.originClientX,
                    ),
                    frequencyControl.min,
                    frequencyControl.max,
                ),
            );
            return;
        }

        if (drag.role === "q") {
            this.sendValue(
                qControl.dspEndpointID,
                clamp(
                    enhancerLiteQFromUpwardPixels(
                        drag.originValue,
                        drag.originClientY - event.clientY,
                    ),
                    qControl.min,
                    qControl.max,
                ),
            );
            return;
        }

        const amountControl = drag.role === "side-amount"
            ? sideAmountControl
            : midAmountControl;
        this.sendValue(
            amountControl.dspEndpointID,
            clamp(
                enhancerLiteAmountFromUpwardPixels(
                    drag.originValue,
                    drag.originClientY - event.clientY,
                ),
                amountControl.min,
                amountControl.max,
            ),
        );
    }

    endReadoutDrag(pointerID?: number, releaseCapture = true): void {
        const drag = this.readoutDrag;
        if (!drag || (pointerID !== undefined && drag.pointerID !== pointerID))
            return;

        this.readoutDrag = undefined;
        drag.captureTarget.toggleAttribute("data-dragging", false);
        if (releaseCapture && drag.captureTarget.hasPointerCapture(drag.pointerID))
            drag.captureTarget.releasePointerCapture(drag.pointerID);
    }

    handleReadoutKey(event: KeyboardEvent, role: ReadoutRole): void {
        const direction = role === "frequency"
            ? (event.key === "ArrowRight" ? 1 : (event.key === "ArrowLeft" ? -1 : 0))
            : (event.key === "ArrowUp" ? 1 : (event.key === "ArrowDown" ? -1 : 0));
        if (direction === 0)
            return;

        event.preventDefault();
        if (role === "frequency") {
            this.sendValue(
                frequencyControl.dspEndpointID,
                clamp(
                    this.valueFor(frequencyControl) * Math.pow(
                        2,
                        direction
                            * ENHANCER_LITE_GESTURE_POLICY.frequencyKeyboardOctavesPerStep,
                    ),
                    frequencyControl.min,
                    frequencyControl.max,
                ),
            );
            return;
        }

        if (role === "q") {
            this.sendValue(
                qControl.dspEndpointID,
                clamp(
                    this.valueFor(qControl) * Math.pow(
                        2,
                        direction * ENHANCER_LITE_GESTURE_POLICY.qKeyboardOctavesPerStep,
                    ),
                    qControl.min,
                    qControl.max,
                ),
            );
            return;
        }

        const amountControl = role === "side-amount" ? sideAmountControl : midAmountControl;
        this.sendValue(
            amountControl.dspEndpointID,
            clamp(
                this.valueFor(amountControl)
                    + direction * ENHANCER_LITE_GESTURE_POLICY.amountKeyboardStep,
                amountControl.min,
                amountControl.max,
            ),
        );
    }

    beginResponseDrag(event: PointerEvent, role: ResponseRole): void {
        if (!event.isPrimary || event.button !== 0 || (role === "side" && !this.isMidSide()))
            return;

        if (!(event.currentTarget instanceof SVGElement))
            return;

        this.endReadoutDrag();
        this.endResponseDrag();
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.toggleAttribute("data-dragging", true);
        const amountControl = role === "side" ? sideAmountControl : midAmountControl;
        this.drag = {
            pointerID: event.pointerId,
            role,
            originClientX: event.clientX,
            originClientY: event.clientY,
            originFrequencyHz: this.valueFor(frequencyControl),
            originAmount: this.valueFor(amountControl),
            originQ: this.valueFor(qControl),
            captureTarget: event.currentTarget,
        };
    }

    moveResponseDrag(event: PointerEvent): void {
        const drag = this.drag;
        if (!drag || drag.pointerID !== event.pointerId)
            return;

        event.preventDefault();
        if (event.shiftKey) {
            this.sendValue(
                qControl.dspEndpointID,
                clamp(
                    enhancerLiteQFromUpwardPixels(
                        drag.originQ,
                        drag.originClientY - event.clientY,
                    ),
                    qControl.min,
                    qControl.max,
                ),
            );
            return;
        }

        const plotBounds = this.requireElement<SVGSVGElement>(".response-plot")
            .getBoundingClientRect();
        const frequencyHz = enhancerFrequencyAfterClientDrag(
            drag.originFrequencyHz,
            drag.originClientX,
            event.clientX,
            {
                left: plotBounds.left,
                width: plotBounds.width,
            },
        );
        const amount = enhancerLiteAmountFromUpwardPixels(
            drag.originAmount,
            drag.originClientY - event.clientY,
        );
        const amountControl = drag.role === "side" ? sideAmountControl : midAmountControl;
        this.sendValue(
            frequencyControl.dspEndpointID,
            clamp(frequencyHz, frequencyControl.min, frequencyControl.max),
        );
        this.sendValue(
            amountControl.dspEndpointID,
            clamp(amount, amountControl.min, amountControl.max),
        );
    }

    endResponseDrag(pointerID?: number, releaseCapture = true): void {
        const drag = this.drag;
        if (!drag || (pointerID !== undefined && drag.pointerID !== pointerID))
            return;

        this.drag = undefined;
        drag.captureTarget.toggleAttribute("data-dragging", false);
        if (releaseCapture && drag.captureTarget.hasPointerCapture(drag.pointerID))
            drag.captureTarget.releasePointerCapture(drag.pointerID);
    }

    handleResponseKey(event: KeyboardEvent, role: ResponseRole): void {
        const direction = event.key === "ArrowUp" || event.key === "ArrowRight"
            ? 1
            : (event.key === "ArrowDown" || event.key === "ArrowLeft" ? -1 : 0);
        if (direction === 0)
            return;

        event.preventDefault();
        if (event.shiftKey) {
            this.sendValue(
                qControl.dspEndpointID,
                clamp(
                    this.valueFor(qControl) * Math.pow(
                        2,
                        direction * ENHANCER_LITE_GESTURE_POLICY.qKeyboardOctavesPerStep,
                    ),
                    qControl.min,
                    qControl.max,
                ),
            );
            return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            this.sendValue(
                frequencyControl.dspEndpointID,
                clamp(
                    this.valueFor(frequencyControl) * Math.pow(
                        2,
                        direction
                            * ENHANCER_LITE_GESTURE_POLICY.frequencyKeyboardOctavesPerStep,
                    ),
                    frequencyControl.min,
                    frequencyControl.max,
                ),
            );
            return;
        }

        const amountControl = role === "side" ? sideAmountControl : midAmountControl;
        this.sendValue(
            amountControl.dspEndpointID,
            clamp(
                this.valueFor(amountControl)
                    + direction * ENHANCER_LITE_GESTURE_POLICY.amountKeyboardStep,
                amountControl.min,
                amountControl.max,
            ),
        );
    }

    valueFor(control: NumberControl): number {
        return this.values.get(control.dspEndpointID) ?? control.initial;
    }

    isMidSide(): boolean {
        return (this.values.get(modeEndpointID) ?? 0) >= 0.5;
    }

    selectedShape(): EnhancerLiteShape {
        const value = this.values.get(shapeEndpointID) ?? 1;
        return value < 0.5 ? "low" : (value >= 1.5 ? "high" : "bell");
    }

    renderAll(): void {
        for (const endpointID of endpointInitialValues.keys())
            this.renderEndpoint(endpointID);
    }

    renderEndpoint(endpointID: string): void {
        if (endpointID === modeEndpointID)
            this.renderMode();
        if (endpointID === curveEndpointID)
            this.renderSegment(curveEndpointID, "curve");
        if (endpointID === saturationModeEndpointID)
            this.renderSegment(saturationModeEndpointID, "saturation-mode");
        if (endpointID === shapeEndpointID)
            this.renderShape();

        const affectsPlot = endpointID === frequencyControl.dspEndpointID
            || endpointID === qControl.dspEndpointID
            || endpointID === midAmountControl.dspEndpointID
            || endpointID === sideAmountControl.dspEndpointID
            || endpointID === modeEndpointID
            || endpointID === shapeEndpointID;
        if (affectsPlot)
            this.renderResponsePlot();
    }

    renderSpectrum(role: SpectrumRole, message: unknown): void {
        const previous = this.spectrumDisplays.get(role) ?? null;
        const next = advanceEnhancerLiteSpectrum(message, previous, performance.now());
        if (!next)
            return;

        this.spectrumDisplays.set(role, next);
        this.requireElement<SVGPathElement>(`[data-spectrum-role='${role}']`)
            .setAttribute("d", next.path);
        this.requireElement<HTMLElement>(`[data-spectrum-peak='${role}']`).textContent =
            next.peakDbfs <= ENHANCER_LITE_PLOT.minimumLevelDbfs + 0.05
                ? `<${ENHANCER_LITE_PLOT.minimumLevelDbfs} dB`
                : `${next.peakDbfs.toFixed(1)} dB`;
    }

    renderMode(): void {
        const isMidSide = this.isMidSide();
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
            button.setAttribute(
                "aria-pressed",
                String((button.dataset.mode === "mid-side") === isMidSide),
            );
        }
        this.requireElement<HTMLElement>("[data-primary-label]").textContent = isMidSide
            ? "MID"
            : "AMOUNT";
        const primaryAmountReadout = this.requireElement<HTMLElement>(
            "[data-readout-control='primary-amount']",
        );
        primaryAmountReadout.setAttribute("aria-label", isMidSide ? "Mid Amount" : "Amount");
        const sideAmountReadout = this.requireElement<HTMLElement>(
            "[data-readout-control='side-amount']",
        );
        sideAmountReadout.hidden = !isMidSide;
        sideAmountReadout.tabIndex = isMidSide ? 0 : -1;
    }

    renderSegment(endpointID: string, dataName: "curve" | "saturation-mode"): void {
        const enabled = (this.values.get(endpointID) ?? 0) >= 0.5;
        const datasetKey = dataName === "curve" ? "curve" : "saturationMode";
        const selectedValue = dataName === "curve"
            ? (enabled ? "solid" : "tube")
            : (enabled ? "medium" : "subtle");
        for (const button of this.root.querySelectorAll<HTMLButtonElement>(`[data-${dataName}]`)) {
            button.setAttribute("aria-pressed", String(button.dataset[datasetKey] === selectedValue));
        }
    }

    renderShape(): void {
        const selected = this.selectedShape();
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-shape]"))
            button.setAttribute("aria-pressed", String(button.dataset.shape === selected));
    }

    renderResponsePlot(): void {
        const frequencyHz = this.valueFor(frequencyControl);
        const q = this.valueFor(qControl);
        const primaryAmount = this.valueFor(midAmountControl);
        const sideAmount = this.valueFor(sideAmountControl);
        const isMidSide = this.isMidSide();
        const shape = this.selectedShape();
        const primaryPath = this.requireElement<SVGPathElement>("[data-response-role='primary']");
        const sidePath = this.requireElement<SVGPathElement>("[data-response-role='side']");
        const fillPath = this.requireElement<SVGPathElement>("[data-response-role='fill']");
        const primaryGuide = this.requireElement<SVGPathElement>("[data-response-role='primary-guide']");
        const sideGuide = this.requireElement<SVGPathElement>("[data-response-role='side-guide']");
        const primaryHandle = this.requireElement<SVGCircleElement>("[data-response-role='primary-handle']");
        const sideHandle = this.requireElement<SVGCircleElement>("[data-response-role='side-handle']");

        for (const label of this.root.querySelectorAll<SVGTextElement>("[data-shelf-overflow]"))
            label.toggleAttribute("hidden", shape === "bell");

        primaryPath.setAttribute("d", responsePath(shape, frequencyHz, q, primaryAmount));
        sidePath.setAttribute("d", responsePath(shape, frequencyHz, q, sideAmount));
        fillPath.setAttribute("d", responsePath(shape, frequencyHz, q, primaryAmount, true));
        const handleX = enhancerLiteFrequencyX(frequencyHz).toFixed(2);
        const primaryHandleY = enhancerLiteGainY(primaryAmount * 12).toFixed(2);
        const sideHandleY = enhancerLiteGainY(sideAmount * 12).toFixed(2);
        primaryHandle.setAttribute("cx", handleX);
        primaryHandle.setAttribute("cy", primaryHandleY);
        sideHandle.setAttribute("cx", handleX);
        sideHandle.setAttribute("cy", sideHandleY);
        if (shape !== "bell") {
            const primaryCurveY = enhancerLiteShelfGainY(
                shelfResponseDb(shape, frequencyHz, frequencyHz, q, primaryAmount),
            ).toFixed(2);
            const sideCurveY = enhancerLiteShelfGainY(
                shelfResponseDb(shape, frequencyHz, frequencyHz, q, sideAmount),
            ).toFixed(2);
            primaryGuide.setAttribute("d", `M ${handleX} ${primaryHandleY} V ${primaryCurveY}`);
            sideGuide.setAttribute("d", `M ${handleX} ${sideHandleY} V ${sideCurveY}`);
        }
        primaryGuide.toggleAttribute("hidden", shape === "bell");
        sideGuide.toggleAttribute("hidden", shape === "bell" || !isMidSide);
        sidePath.toggleAttribute("hidden", !isMidSide);
        sideHandle.toggleAttribute("hidden", !isMidSide);
        sideHandle.setAttribute("tabindex", isMidSide ? "0" : "-1");

        primaryHandle.setAttribute("aria-valuetext", `${shape}, ${formatFrequency(frequencyHz)}, ${formatBoost(primaryAmount)}, Q ${formatQ(q)}`);
        sideHandle.setAttribute("aria-valuetext", `${shape}, ${formatFrequency(frequencyHz)}, ${formatBoost(sideAmount)}, Q ${formatQ(q)}`);
        this.requireElement<HTMLElement>("[data-readout='frequency']").textContent = formatFrequency(frequencyHz);
        const frequencyReadout = this.requireElement<HTMLElement>(
            "[data-readout-control='frequency']",
        );
        frequencyReadout.setAttribute("aria-valuenow", String(frequencyHz));
        frequencyReadout.setAttribute("aria-valuetext", formatFrequency(frequencyHz));
        this.requireElement<HTMLElement>("[data-readout='q']").textContent = formatQ(q);
        const qReadout = this.requireElement<HTMLElement>("[data-readout-control='q']");
        qReadout.setAttribute("aria-valuenow", String(q));
        qReadout.setAttribute("aria-valuetext", `Q ${formatQ(q)}`);
        this.requireElement<HTMLElement>("[data-readout='primary']").textContent = formatBoost(primaryAmount);
        const primaryAmountReadout = this.requireElement<HTMLElement>(
            "[data-readout-control='primary-amount']",
        );
        primaryAmountReadout.setAttribute("aria-valuenow", String(primaryAmount * 12));
        primaryAmountReadout.setAttribute("aria-valuetext", formatBoost(primaryAmount));
        this.requireElement<HTMLElement>("[data-readout='side']").textContent = formatBoost(sideAmount);
        const sideAmountReadout = this.requireElement<HTMLElement>(
            "[data-readout-control='side-amount']",
        );
        sideAmountReadout.setAttribute("aria-valuenow", String(sideAmount * 12));
        sideAmountReadout.setAttribute("aria-valuetext", formatBoost(sideAmount));
    }

    renderFrequencyTickDensity(): void {
        const plot = this.requireElement<SVGSVGElement>(".response-plot");
        const visibleFrequencies = new Set(
            enhancerFrequencyTicksForWidth(plot.getBoundingClientRect().width)
                .map((tick) => tick.frequencyHz),
        );
        for (const tick of this.root.querySelectorAll<SVGElement>(
            "[data-frequency-hz], [data-frequency-grid-hz]",
        )) {
            const rawFrequency = tick.getAttribute("data-frequency-hz")
                ?? tick.getAttribute("data-frequency-grid-hz");
            const frequencyHz = Number(rawFrequency);
            tick.toggleAttribute("hidden", !visibleFrequencies.has(frequencyHz));
        }
    }

    responsePlotMarkup(): string {
        const verticalGrid = ENHANCER_LITE_FREQUENCY_TICKS.map((frequencyHz) => {
            const x = enhancerLiteFrequencyX(frequencyHz).toFixed(2);
            const label = formatEnhancerFrequencyTick(frequencyHz);
            return `<path class="grid-line" data-frequency-grid-hz="${frequencyHz}" d="M ${x} ${ENHANCER_LITE_PLOT.top} V ${enhancerLiteGainY(0).toFixed(2)}"></path>
                    <text class="axis-label frequency" data-frequency-hz="${frequencyHz}" x="${x}" y="${ENHANCER_LITE_PLOT.height - 7}" text-anchor="middle">${label}</text>`;
        }).join("");
        const horizontalGrid = ENHANCER_LITE_DB_ROWS.map(({ gainDb, levelDbfs }, index) => {
            const y = enhancerLiteGainY(gainDb).toFixed(2);
            return `<path class="grid-line${gainDb === 0 ? " baseline" : ""}" data-grid-row="${index}" d="M ${ENHANCER_LITE_PLOT.left} ${y} H ${ENHANCER_LITE_PLOT.width - ENHANCER_LITE_PLOT.right}"></path>
                    <text class="axis-label gain" data-gain-db="${gainDb}" x="${ENHANCER_LITE_PLOT.left - 8}" y="${Number(y) + 3}" text-anchor="end">${gainDb > 0 ? `+${gainDb}` : gainDb}</text>
                    <text class="axis-label level" data-level-dbfs="${levelDbfs}" x="${ENHANCER_LITE_PLOT.width - ENHANCER_LITE_PLOT.right + 8}" y="${Number(y) + 3}" text-anchor="start">${levelDbfs}</text>`;
        }).join("");
        return `
            <section class="response-panel" aria-label="Enhancer Lite response">
                <div class="plot-heading">
                    <span>HARMONIC SHAPE</span>
                    <span class="analyzer-legend" aria-label="Input and output spectrum peaks">
                        <span class="legend-item input"><i></i>IN <strong data-spectrum-peak="input">--</strong></span>
                        <span class="legend-item output"><i></i>OUT <strong data-spectrum-peak="output">--</strong></span>
                    </span>
                    <span class="gesture-hint">DRAG FREQ + AMOUNT&nbsp;&nbsp;·&nbsp;&nbsp;SHIFT DRAG Q</span>
                </div>
                <svg class="response-plot" viewBox="0 0 ${ENHANCER_LITE_PLOT.width} ${ENHANCER_LITE_PLOT.height}" preserveAspectRatio="none" role="application" aria-label="Draggable frequency and amount plot with input and output spectra">
                    ${verticalGrid}
                    ${horizontalGrid}
                    <text class="axis-label shelf-overflow" data-shelf-overflow="high" x="${ENHANCER_LITE_PLOT.left - 8}" y="9" text-anchor="end" hidden>+30</text>
                    <text class="axis-label shelf-overflow" data-shelf-overflow="low" x="${ENHANCER_LITE_PLOT.left - 8}" y="270" text-anchor="end" hidden>-18</text>
                    <path class="grid-line baseline" d="M ${ENHANCER_LITE_PLOT.left} ${enhancerLiteGainY(0).toFixed(2)} H ${ENHANCER_LITE_PLOT.width - ENHANCER_LITE_PLOT.right}"></path>
                    <text class="axis-unit gain" x="8" y="12">GAIN</text>
                    <text class="axis-unit level" x="${ENHANCER_LITE_PLOT.width - 5}" y="12" text-anchor="end">dBFS</text>
                    <path class="spectrum-trace input" data-spectrum-role="input"></path>
                    <path class="spectrum-trace output" data-spectrum-role="output"></path>
                    <path class="response-fill" data-response-role="fill"></path>
                    <path class="response-handle-guide primary" data-response-role="primary-guide" hidden></path>
                    <path class="response-handle-guide side" data-response-role="side-guide" hidden></path>
                    <path class="response-band primary" data-response-role="primary" data-drag-role="primary" tabindex="0"></path>
                    <path class="response-band side" data-response-role="side" data-drag-role="side" tabindex="-1" hidden></path>
                    <circle class="response-handle primary" data-response-role="primary-handle" data-drag-role="primary" tabindex="0" role="slider" r="6"></circle>
                    <circle class="response-handle side" data-response-role="side-handle" data-drag-role="side" tabindex="-1" role="slider" r="5" hidden></circle>
                </svg>
            </section>
        `;
    }

    getMarkup(): string {
        return `
            <style>
                :host {
                    /* The kit header's accent token, set to Lite's primary neon. */
                    --knob-track-value-color: #00f0ff;
                    display: block;
                    width: 820px;
                    min-height: 560px;
                    color: #f4fbff;
                    background: #000000;
                    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
                }
                * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
                [hidden] { display: none !important; }
                button { font: inherit; }
                .shell { min-height: 520px; padding: 20px; background: #000000; }
                .topline { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 14px; }
                h1 { margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; line-height: 1; }
                .tag { margin-top: 7px; color: #00f0ff; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; }
                .engine-label { color: #b7ff27; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
                .response-panel { border: 1px solid #123b43; border-radius: 12px; padding: 12px 12px 5px; background: #000000; box-shadow: 0 0 22px rgba(0,240,255,0.08); }
                .plot-heading { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 0 4px 4px; color: #00f0ff; font-size: 9px; letter-spacing: 0.11em; }
                .gesture-hint { color: #71878d; letter-spacing: 0.055em; }
                .analyzer-legend { display: flex; align-items: center; justify-content: center; gap: 14px; color: #71878d; letter-spacing: 0.055em; }
                .legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
                .legend-item i { width: 13px; height: 2px; border-radius: 2px; background: currentColor; box-shadow: 0 0 6px currentColor; }
                .legend-item strong { min-width: 55px; color: currentColor; font-weight: 600; font-variant-numeric: tabular-nums; }
                .legend-item.input { color: #6e7dff; }
                .legend-item.output { color: #b7ff27; }
                .gesture-hint { justify-self: end; }
                .response-plot { display: block; width: 100%; height: 272px; overflow: visible; touch-action: none; }
                .grid-line { fill: none; stroke: #101b1e; stroke-width: 1; vector-effect: non-scaling-stroke; pointer-events: none; }
                .grid-line.baseline { stroke: #29434a; }
                .axis-label, .axis-unit { fill: #526a70; font: 8px/1 "SF Mono", Menlo, monospace; pointer-events: none; }
                .axis-label.shelf-overflow { fill: #365c63; font-size: 7px; }
                .axis-unit { letter-spacing: 0.08em; }
                .axis-label.level, .axis-unit.level { fill: #677055; }
                .spectrum-trace { fill: none; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; pointer-events: none; }
                .spectrum-trace.input { stroke: #6e7dff; stroke-width: 1.35; opacity: 0.68; filter: drop-shadow(0 0 3px rgba(110,125,255,0.55)); }
                .spectrum-trace.output { stroke: #b7ff27; stroke-width: 1.65; opacity: 0.82; filter: drop-shadow(0 0 4px rgba(183,255,39,0.58)); }
                .response-fill { fill: rgba(0,240,255,0.07); stroke: none; pointer-events: none; }
                .response-handle-guide { fill: none; stroke-width: 1; stroke-dasharray: 2 3; vector-effect: non-scaling-stroke; pointer-events: none; opacity: 0.55; }
                .response-handle-guide.primary { stroke: #00f0ff; }
                .response-handle-guide.side { stroke: #ff2bd6; }
                .response-band { fill: none; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; cursor: grab; outline: none; }
                .response-band.primary { stroke: #00f0ff; stroke-width: 2.5; filter: drop-shadow(0 0 6px rgba(0,240,255,0.8)); }
                .response-band.side { stroke: #ff2bd6; stroke-width: 2; stroke-dasharray: 7 5; filter: drop-shadow(0 0 6px rgba(255,43,214,0.65)); }
                .response-band[data-dragging] { cursor: grabbing; stroke-width: 3.5; }
                .response-handle { vector-effect: non-scaling-stroke; cursor: grab; outline: none; }
                .response-handle.primary { fill: #00f0ff; stroke: #001317; stroke-width: 3; filter: drop-shadow(0 0 8px #00f0ff); }
                .response-handle.side { fill: #000000; stroke: #ff2bd6; stroke-width: 2.5; filter: drop-shadow(0 0 8px #ff2bd6); }
                .response-handle:focus-visible, .response-band:focus-visible { stroke: #b7ff27; filter: drop-shadow(0 0 8px #b7ff27); }
                .response-handle[data-dragging] { cursor: grabbing; stroke: #b7ff27; }
                .control-deck { display: grid; grid-template-columns: 1fr 1.3fr; gap: 12px; margin-top: 12px; }
                .readouts, .switches { border: 1px solid #20262c; border-radius: 10px; background: #000000; }
                .readouts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 12px 14px; }
                .readout { min-width: 0; border-right: 1px solid #20262c; padding: 0 13px; }
                .readout-control { position: relative; cursor: ew-resize; outline: none; touch-action: none; }
                .readout-control.vertical { cursor: ns-resize; }
                .readout-control:focus-visible { border-radius: 5px; box-shadow: 0 0 0 1px #b7ff27, 0 0 10px rgba(183,255,39,0.35); }
                .readout-control[data-dragging] { cursor: grabbing; }
                .drag-affordance { position: absolute; top: 0; right: 11px; color: #33484d; font-size: 9px; line-height: 1; pointer-events: none; }
                .readout-control.primary .drag-affordance { color: #14525a; }
                .readout-control.side .drag-affordance { color: #5a1d50; }
                .readout-control:hover .drag-affordance, .readout-control:focus-visible .drag-affordance { color: #00f0ff; }
                .readout-control.side:hover .drag-affordance, .readout-control.side:focus-visible .drag-affordance { color: #ff2bd6; }
                .readout-control[data-dragging] .drag-affordance { color: #b7ff27; }
                .readout:first-child { padding-left: 0; }
                .readout:last-child { border-right: 0; padding-right: 0; }
                dt { color: #5f7379; font-size: 8px; letter-spacing: 0.11em; }
                dd { margin: 7px 0 0; color: #f4fbff; font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
                .readout.primary dd { color: #00f0ff; }
                .readout.side dd { color: #ff2bd6; }
                .switches { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; padding: 10px; }
                .switch-group { display: grid; gap: 6px; }
                .switch-label { color: #5f7379; font-size: 8px; letter-spacing: 0.1em; }
                .segmented { display: flex; border: 1px solid #273137; border-radius: 7px; padding: 2px; background: #000000; }
                .segmented button { flex: 1; min-height: 25px; border: 0; border-radius: 4px; padding: 0 6px; color: #71878d; background: #000000; cursor: pointer; font-size: 8px; letter-spacing: 0.055em; text-transform: uppercase; }
                .segmented button[aria-pressed="true"] { color: #000000; background: #b7ff27; box-shadow: 0 0 10px rgba(183,255,39,0.55); }
                .segmented button:focus-visible { outline: 2px solid #00f0ff; outline-offset: 2px; }
                @media (max-width: 700px) {
                    :host { width: 100%; }
                    .control-deck { grid-template-columns: 1fr; }
                    .topline { align-items: flex-start; flex-direction: column; }
                    .plot-heading { grid-template-columns: 1fr auto; }
                    .gesture-hint { display: none; }
                }
            </style>
            <main class="shell">
                <header class="topline">
                    <div>
                        <h1>Enhancer Lite</h1>
                        <div class="tag">ONE BAND // STEREO + M/S</div>
                    </div>
                    <div class="engine-label">4X IIR // FAST CURVE</div>
                </header>
                ${this.responsePlotMarkup()}
                <div class="control-deck">
                    <dl class="readouts">
                        <div class="readout readout-control" data-readout-control="frequency" tabindex="0" role="slider" aria-label="Frequency" aria-orientation="horizontal" aria-valuemin="20" aria-valuemax="20000" aria-valuenow="130" aria-valuetext="130 Hz"><span class="drag-affordance" aria-hidden="true">↔</span><dt>FREQ</dt><dd data-readout="frequency">130 Hz</dd></div>
                        <div class="readout readout-control vertical primary" data-readout-control="primary-amount" tabindex="0" role="slider" aria-label="Amount" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="12" aria-valuenow="0" aria-valuetext="+0.0 dB"><span class="drag-affordance" aria-hidden="true">↕</span><dt data-primary-label>AMOUNT</dt><dd data-readout="primary">+0.0 dB</dd></div>
                        <div class="readout readout-control vertical side" data-readout-control="side-amount" tabindex="-1" role="slider" aria-label="Side Amount" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="12" aria-valuenow="0" aria-valuetext="+0.0 dB" hidden><span class="drag-affordance" aria-hidden="true">↕</span><dt>SIDE</dt><dd data-readout="side">+0.0 dB</dd></div>
                        <div class="readout readout-control vertical" data-readout-control="q" tabindex="0" role="slider" aria-label="Q" aria-orientation="vertical" aria-valuemin="0.1" aria-valuemax="10" aria-valuenow="0.71" aria-valuetext="Q 0.71"><span class="drag-affordance" aria-hidden="true">↕</span><dt>Q</dt><dd data-readout="q">0.71</dd></div>
                    </dl>
                    <div class="switches">
                        <div class="switch-group">
                            <span class="switch-label">SHAPE</span>
                            <div class="segmented">
                                <button type="button" data-shape="low" aria-pressed="false">Low</button>
                                <button type="button" data-shape="bell" aria-pressed="true">Bell</button>
                                <button type="button" data-shape="high" aria-pressed="false">High</button>
                            </div>
                        </div>
                        <div class="switch-group">
                            <span class="switch-label">ROUTE</span>
                            <div class="segmented">
                                <button type="button" data-mode="stereo" aria-pressed="true">Stereo</button>
                                <button type="button" data-mode="mid-side" aria-pressed="false">M/S</button>
                            </div>
                        </div>
                        <div class="switch-group">
                            <span class="switch-label">CHARACTER</span>
                            <div class="segmented">
                                <button type="button" data-curve="tube" aria-pressed="false">Tube</button>
                                <button type="button" data-curve="solid" aria-pressed="true">Solid</button>
                            </div>
                        </div>
                        <div class="switch-group">
                            <span class="switch-label">INTENSITY</span>
                            <div class="segmented">
                                <button type="button" data-saturation-mode="subtle" aria-pressed="true">Subtle</button>
                                <button type="button" data-saturation-mode="medium" aria-pressed="false">Medium</button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        `;
    }
}

/** Create the standalone one-band audition surface for a Cmajor patch connection. */
export default function createPatchView(patchConnection: EnhancerLitePatchConnection): HTMLElement {
    const elementName = "cosimo-enhancer-lite-view";
    if (!window.customElements.get(elementName))
        window.customElements.define(elementName, EnhancerLiteView);

    return new EnhancerLiteView(patchConnection);
}
