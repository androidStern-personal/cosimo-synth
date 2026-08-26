import {
    ENHANCER_LITE_SETTING_DESCRIPTORS,
    type EnhancerLiteSettingDescriptor,
} from "../../../ui/shared/enhancer-lite-state";

type ParameterListener = ((value: number) => void) & { endpointID?: string };

type EnhancerLitePatchConnection = {
    addParameterListener(endpointID: string, listener: ParameterListener): void;
    removeParameterListener(endpointID: string, listener: ParameterListener): void;
    requestParameterValue(endpointID: string): void;
    sendEventOrValue(endpointID: string, value: number, rampFrames?: number): void;
};

type NumericDescriptor = Extract<EnhancerLiteSettingDescriptor, { readonly kind: "number" }>;
type ResponseRole = "primary" | "side";

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

const endpointInitialValues = new Map<string, number>([
    [frequencyControl.dspEndpointID, frequencyControl.initial],
    [qControl.dspEndpointID, qControl.initial],
    [modeEndpointID, 0],
    [midAmountControl.dspEndpointID, midAmountControl.initial],
    [sideAmountControl.dspEndpointID, sideAmountControl.initial],
    [curveEndpointID, 1],
    [saturationModeEndpointID, 0],
]);

const responsePlot = Object.freeze({
    width: 760,
    height: 272,
    left: 42,
    right: 14,
    top: 18,
    bottom: 28,
    minimumHz: 20,
    maximumHz: 20_000,
    maximumDb: 12,
    modelSampleRate: 48_000 * 4,
});

const responseGridFrequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000] as const;
const responseGridLevels = [0, 3, 6, 9, 12] as const;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function responseX(frequencyHz: number): number {
    const normalized = Math.log(clamp(frequencyHz, responsePlot.minimumHz, responsePlot.maximumHz)
        / responsePlot.minimumHz) / Math.log(responsePlot.maximumHz / responsePlot.minimumHz);
    return responsePlot.left
        + normalized * (responsePlot.width - responsePlot.left - responsePlot.right);
}

function responseY(gainDb: number): number {
    const normalized = clamp(gainDb, 0, responsePlot.maximumDb) / responsePlot.maximumDb;
    return responsePlot.height - responsePlot.bottom
        - normalized * (responsePlot.height - responsePlot.top - responsePlot.bottom);
}

function peakingResponseDb(
    frequencyHz: number,
    centreHz: number,
    q: number,
    amount: number,
): number {
    const gainDb = 12 * clamp(amount, 0, 1);
    const amplitude = Math.pow(10, gainDb / 40);
    const centreOmega = 2 * Math.PI * clamp(centreHz, 20, 20_000)
        / responsePlot.modelSampleRate;
    const alpha = Math.sin(centreOmega) / (2 * clamp(q, 0.1, 10));
    const centreCosine = Math.cos(centreOmega);
    const omega = 2 * Math.PI * clamp(frequencyHz, 20, 20_000)
        / responsePlot.modelSampleRate;
    const z1Real = Math.cos(omega);
    const z1Imaginary = -Math.sin(omega);
    const z2Real = Math.cos(2 * omega);
    const z2Imaginary = -Math.sin(2 * omega);
    const numeratorReal = 1 + alpha * amplitude
        - 2 * centreCosine * z1Real
        + (1 - alpha * amplitude) * z2Real;
    const numeratorImaginary = -2 * centreCosine * z1Imaginary
        + (1 - alpha * amplitude) * z2Imaginary;
    const denominatorReal = 1 + alpha / amplitude
        - 2 * centreCosine * z1Real
        + (1 - alpha / amplitude) * z2Real;
    const denominatorImaginary = -2 * centreCosine * z1Imaginary
        + (1 - alpha / amplitude) * z2Imaginary;
    const numeratorPower = numeratorReal * numeratorReal + numeratorImaginary * numeratorImaginary;
    const denominatorPower = denominatorReal * denominatorReal + denominatorImaginary * denominatorImaginary;
    return clamp(10 * Math.log10(Math.max(numeratorPower / denominatorPower, 1e-30)), 0, 12);
}

function responsePath(centreHz: number, q: number, amount: number, closeArea = false): string {
    const pointCount = 241;
    const points: Array<string> = [];
    for (let index = 0; index < pointCount; index += 1) {
        const normalized = index / (pointCount - 1);
        const frequencyHz = responsePlot.minimumHz
            * Math.pow(responsePlot.maximumHz / responsePlot.minimumHz, normalized);
        points.push(
            `${index === 0 ? "M" : "L"} ${responseX(frequencyHz).toFixed(2)} `
            + responseY(peakingResponseDb(frequencyHz, centreHz, q, amount)).toFixed(2),
        );
    }
    if (closeArea) {
        const baseline = responseY(0).toFixed(2);
        points.push(`L ${(responsePlot.width - responsePlot.right).toFixed(2)} ${baseline}`);
        points.push(`L ${responsePlot.left.toFixed(2)} ${baseline} Z`);
    }
    return points.join(" ");
}

class EnhancerLiteView extends HTMLElement {
    readonly patchConnection: EnhancerLitePatchConnection;
    readonly root: ShadowRoot;
    readonly values = new Map(endpointInitialValues);
    readonly parameterListeners: Array<{ readonly endpointID: string; readonly listener: ParameterListener }> = [];
    hasAttached = false;
    drag: ResponseDrag | undefined;

    constructor(patchConnection: EnhancerLitePatchConnection) {
        super();
        this.patchConnection = patchConnection;
        this.root = this.attachShadow({ mode: "open" });
        this.root.innerHTML = this.getMarkup();
        this.bindControls();
        this.renderAll();
    }

    connectedCallback(): void {
        if (this.hasAttached)
            return;

        this.hasAttached = true;
        for (const endpointID of endpointInitialValues.keys()) {
            const listener: ParameterListener = (value) => {
                if (!Number.isFinite(value))
                    return;

                this.values.set(endpointID, value);
                this.renderEndpoint(endpointID);
            };
            listener.endpointID = endpointID;
            this.parameterListeners.push({ endpointID, listener });
            this.patchConnection.addParameterListener(endpointID, listener);
            this.patchConnection.requestParameterValue(endpointID);
        }
    }

    disconnectedCallback(): void {
        for (const { endpointID, listener } of this.parameterListeners)
            this.patchConnection.removeParameterListener(endpointID, listener);

        this.parameterListeners.length = 0;
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

        for (const role of ["primary", "side"] as const) {
            for (const target of this.root.querySelectorAll<SVGElement>(`[data-drag-role='${role}']`)) {
                target.addEventListener("pointerdown", (event) => this.beginResponseDrag(event, role));
                target.addEventListener("pointermove", (event) => this.moveResponseDrag(event));
                target.addEventListener("pointerup", (event) => this.endResponseDrag(event));
                target.addEventListener("pointercancel", (event) => this.endResponseDrag(event));
                target.addEventListener("keydown", (event) => this.handleResponseKey(event, role));
            }
        }
    }

    sendValue(endpointID: string, value: number): void {
        const previous = this.values.get(endpointID);
        if (previous !== undefined && Math.abs(previous - value) <= 1e-9)
            return;

        this.values.set(endpointID, value);
        this.renderEndpoint(endpointID);
        this.patchConnection.sendEventOrValue(endpointID, value, 0);
    }

    beginResponseDrag(event: PointerEvent, role: ResponseRole): void {
        if (event.button !== 0 || (role === "side" && !this.isMidSide()))
            return;

        if (!(event.currentTarget instanceof SVGElement))
            return;

        event.preventDefault();
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
        const bounds = this.requireElement<SVGSVGElement>(".response-plot").getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0)
            return;

        if (event.shiftKey) {
            const octaves = (drag.originClientY - event.clientY) / bounds.height
                * Math.log2(qControl.max / qControl.min);
            this.sendValue(
                qControl.dspEndpointID,
                clamp(drag.originQ * Math.pow(2, octaves), qControl.min, qControl.max),
            );
            return;
        }

        const logSpan = Math.log(frequencyControl.max / frequencyControl.min);
        const frequencyHz = drag.originFrequencyHz * Math.exp(
            (event.clientX - drag.originClientX) / bounds.width * logSpan,
        );
        const amount = drag.originAmount
            + (drag.originClientY - event.clientY) / bounds.height;
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

    endResponseDrag(event: PointerEvent): void {
        const drag = this.drag;
        if (!drag || drag.pointerID !== event.pointerId)
            return;

        drag.captureTarget.toggleAttribute("data-dragging", false);
        if (drag.captureTarget.hasPointerCapture(event.pointerId))
            drag.captureTarget.releasePointerCapture(event.pointerId);
        this.drag = undefined;
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
                clamp(this.valueFor(qControl) * Math.pow(2, direction / 6), qControl.min, qControl.max),
            );
            return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            this.sendValue(
                frequencyControl.dspEndpointID,
                clamp(
                    this.valueFor(frequencyControl) * Math.pow(2, direction / 12),
                    frequencyControl.min,
                    frequencyControl.max,
                ),
            );
            return;
        }

        const amountControl = role === "side" ? sideAmountControl : midAmountControl;
        this.sendValue(
            amountControl.dspEndpointID,
            clamp(this.valueFor(amountControl) + direction * 0.01, amountControl.min, amountControl.max),
        );
    }

    valueFor(control: NumberControl): number {
        return this.values.get(control.dspEndpointID) ?? control.initial;
    }

    isMidSide(): boolean {
        return (this.values.get(modeEndpointID) ?? 0) >= 0.5;
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

        const affectsPlot = endpointID === frequencyControl.dspEndpointID
            || endpointID === qControl.dspEndpointID
            || endpointID === midAmountControl.dspEndpointID
            || endpointID === sideAmountControl.dspEndpointID
            || endpointID === modeEndpointID;
        if (affectsPlot)
            this.renderResponsePlot();
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
        this.requireElement<HTMLElement>("[data-side-readout]").hidden = !isMidSide;
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

    renderResponsePlot(): void {
        const frequencyHz = this.valueFor(frequencyControl);
        const q = this.valueFor(qControl);
        const primaryAmount = this.valueFor(midAmountControl);
        const sideAmount = this.valueFor(sideAmountControl);
        const isMidSide = this.isMidSide();
        const primaryPath = this.requireElement<SVGPathElement>("[data-response-role='primary']");
        const sidePath = this.requireElement<SVGPathElement>("[data-response-role='side']");
        const fillPath = this.requireElement<SVGPathElement>("[data-response-role='fill']");
        const primaryHandle = this.requireElement<SVGCircleElement>("[data-response-role='primary-handle']");
        const sideHandle = this.requireElement<SVGCircleElement>("[data-response-role='side-handle']");

        primaryPath.setAttribute("d", responsePath(frequencyHz, q, primaryAmount));
        sidePath.setAttribute("d", responsePath(frequencyHz, q, sideAmount));
        fillPath.setAttribute("d", responsePath(frequencyHz, q, primaryAmount, true));
        primaryHandle.setAttribute("cx", responseX(frequencyHz).toFixed(2));
        primaryHandle.setAttribute("cy", responseY(primaryAmount * 12).toFixed(2));
        sideHandle.setAttribute("cx", responseX(frequencyHz).toFixed(2));
        sideHandle.setAttribute("cy", responseY(sideAmount * 12).toFixed(2));
        sidePath.toggleAttribute("hidden", !isMidSide);
        sideHandle.toggleAttribute("hidden", !isMidSide);
        sideHandle.setAttribute("tabindex", isMidSide ? "0" : "-1");

        primaryHandle.setAttribute("aria-valuetext", `${formatFrequency(frequencyHz)}, ${formatBoost(primaryAmount)}, Q ${formatQ(q)}`);
        sideHandle.setAttribute("aria-valuetext", `${formatFrequency(frequencyHz)}, ${formatBoost(sideAmount)}, Q ${formatQ(q)}`);
        this.requireElement<HTMLElement>("[data-readout='frequency']").textContent = formatFrequency(frequencyHz);
        this.requireElement<HTMLElement>("[data-readout='q']").textContent = formatQ(q);
        this.requireElement<HTMLElement>("[data-readout='primary']").textContent = formatBoost(primaryAmount);
        this.requireElement<HTMLElement>("[data-readout='side']").textContent = formatBoost(sideAmount);
    }

    responsePlotMarkup(): string {
        const verticalGrid = responseGridFrequencies.map((frequencyHz) => {
            const x = responseX(frequencyHz).toFixed(2);
            const label = frequencyHz >= 1000 ? `${frequencyHz / 1000}k` : String(frequencyHz);
            return `<path class="grid-line" d="M ${x} ${responsePlot.top} V ${responseY(0).toFixed(2)}"></path>
                    <text class="axis-label" x="${x}" y="${responsePlot.height - 7}" text-anchor="middle">${label}</text>`;
        }).join("");
        const horizontalGrid = responseGridLevels.map((gainDb) => {
            const y = responseY(gainDb).toFixed(2);
            return `<path class="grid-line${gainDb === 0 ? " baseline" : ""}" d="M ${responsePlot.left} ${y} H ${responsePlot.width - responsePlot.right}"></path>
                    <text class="axis-label" x="${responsePlot.left - 8}" y="${Number(y) + 3}" text-anchor="end">${gainDb === 0 ? "0" : `+${gainDb}`}</text>`;
        }).join("");
        return `
            <section class="response-panel" aria-label="Enhancer Lite response">
                <div class="plot-heading">
                    <span>HARMONIC BAND</span>
                    <span class="gesture-hint">DRAG FREQ + AMOUNT&nbsp;&nbsp;·&nbsp;&nbsp;SHIFT DRAG Q</span>
                </div>
                <svg class="response-plot" viewBox="0 0 ${responsePlot.width} ${responsePlot.height}" role="application" aria-label="Draggable frequency and amount plot">
                    ${verticalGrid}
                    ${horizontalGrid}
                    <text class="axis-unit" x="8" y="18">dB</text>
                    <path class="response-fill" data-response-role="fill"></path>
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
                    display: block;
                    width: 820px;
                    min-height: 520px;
                    color: #f4fbff;
                    background: #000000;
                    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
                }
                * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
                [hidden] { display: none !important; }
                button { font: inherit; }
                .shell { min-height: 520px; padding: 20px; background: #000000; }
                .topline { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 14px; }
                h1 { margin: 0; color: #f4fbff; font: 800 25px/1 "Avenir Next", "Helvetica Neue", sans-serif; letter-spacing: 0.17em; text-transform: uppercase; }
                .tag { margin-top: 7px; color: #00f0ff; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; }
                .engine-label { color: #b7ff27; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
                .response-panel { border: 1px solid #123b43; border-radius: 12px; padding: 12px 12px 5px; background: #000000; box-shadow: 0 0 22px rgba(0,240,255,0.08); }
                .plot-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 4px 4px; color: #00f0ff; font-size: 9px; letter-spacing: 0.11em; }
                .gesture-hint { color: #71878d; letter-spacing: 0.055em; }
                .response-plot { display: block; width: 100%; height: 272px; overflow: visible; touch-action: none; }
                .grid-line { fill: none; stroke: #101b1e; stroke-width: 1; vector-effect: non-scaling-stroke; pointer-events: none; }
                .grid-line.baseline { stroke: #29434a; }
                .axis-label, .axis-unit { fill: #526a70; font: 8px/1 "SF Mono", Menlo, monospace; pointer-events: none; }
                .axis-unit { letter-spacing: 0.08em; }
                .response-fill { fill: rgba(0,240,255,0.07); stroke: none; pointer-events: none; }
                .response-band { fill: none; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; cursor: grab; outline: none; }
                .response-band.primary { stroke: #00f0ff; stroke-width: 2.5; filter: drop-shadow(0 0 6px rgba(0,240,255,0.8)); }
                .response-band.side { stroke: #ff2bd6; stroke-width: 2; stroke-dasharray: 7 5; filter: drop-shadow(0 0 6px rgba(255,43,214,0.65)); }
                .response-band[data-dragging] { cursor: grabbing; stroke-width: 3.5; }
                .response-handle { vector-effect: non-scaling-stroke; cursor: grab; outline: none; }
                .response-handle.primary { fill: #00f0ff; stroke: #001317; stroke-width: 3; filter: drop-shadow(0 0 8px #00f0ff); }
                .response-handle.side { fill: #000000; stroke: #ff2bd6; stroke-width: 2.5; filter: drop-shadow(0 0 8px #ff2bd6); }
                .response-handle:focus-visible, .response-band:focus-visible { stroke: #b7ff27; filter: drop-shadow(0 0 8px #b7ff27); }
                .response-handle[data-dragging] { cursor: grabbing; stroke: #b7ff27; }
                .control-deck { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; margin-top: 12px; }
                .readouts, .switches { border: 1px solid #20262c; border-radius: 10px; background: #000000; }
                .readouts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 12px 14px; }
                .readout { min-width: 0; border-right: 1px solid #20262c; padding: 0 13px; }
                .readout:first-child { padding-left: 0; }
                .readout:last-child { border-right: 0; padding-right: 0; }
                dt { color: #5f7379; font-size: 8px; letter-spacing: 0.11em; }
                dd { margin: 7px 0 0; color: #f4fbff; font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
                .readout.primary dd { color: #00f0ff; }
                .readout.side dd { color: #ff2bd6; }
                .switches { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 10px; }
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
                        <div class="readout"><dt>FREQ</dt><dd data-readout="frequency">130 Hz</dd></div>
                        <div class="readout primary"><dt data-primary-label>AMOUNT</dt><dd data-readout="primary">+0.0 dB</dd></div>
                        <div class="readout side" data-side-readout hidden><dt>SIDE</dt><dd data-readout="side">+0.0 dB</dd></div>
                        <div class="readout"><dt>Q</dt><dd data-readout="q">0.71</dd></div>
                    </dl>
                    <div class="switches">
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
