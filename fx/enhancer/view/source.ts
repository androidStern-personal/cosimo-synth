type ParameterListener = ((value: number) => void) & { endpointID?: string };

type EnhancerPatchConnection = {
    addParameterListener(endpointID: string, listener: ParameterListener): void;
    removeParameterListener(endpointID: string, listener: ParameterListener): void;
    requestParameterValue(endpointID: string): void;
    sendEventOrValue(endpointID: string, value: number, rampFrames?: number): void;
};

type NumberControl = {
    readonly endpointID: string;
    readonly label: string;
    readonly min: number;
    readonly max: number;
    readonly initial: number;
    readonly step: number;
    readonly scale: "linear" | "log";
    readonly format: (value: number) => string;
};

type BandDefinition = {
    readonly number: 1 | 2;
    readonly accent: string;
    readonly frequency: NumberControl;
    readonly q: NumberControl;
    readonly primaryAmount: NumberControl;
    readonly sideAmount: NumberControl;
    readonly modeEndpointID: string;
    readonly curveEndpointID: string;
    readonly initialCurve: 0 | 1;
};

const formatFrequency = (value: number): string => (
    value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} kHz` : `${Math.round(value)} Hz`
);

const formatQ = (value: number): string => value.toFixed(2);
const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;
const formatBoost = (value: number): string => `+${(value * 12).toFixed(1)} dB`;

const deEmphasisControl: NumberControl = {
    endpointID: "deEmphasisIn",
    label: "De-emphasis",
    min: 0,
    max: 1,
    initial: 1,
    step: 0.001,
    scale: "linear",
    format: formatPercent,
};
const saturationModeEndpointID = "saturationModeIn";

const bandDefinitions: ReadonlyArray<BandDefinition> = [
    {
        number: 1,
        accent: "#f0b867",
        frequency: {
            endpointID: "b1FreqHzIn",
            label: "Frequency",
            min: 20,
            max: 20_000,
            initial: 130,
            step: 0.0001,
            scale: "log",
            format: formatFrequency,
        },
        q: {
            endpointID: "b1QIn",
            label: "Q",
            min: 0.1,
            max: 10,
            initial: 0.71,
            step: 0.001,
            scale: "linear",
            format: formatQ,
        },
        primaryAmount: {
            endpointID: "b1MidAmountIn",
            label: "Amount",
            min: 0,
            max: 1,
            initial: 0,
            step: 0.001,
            scale: "linear",
            format: formatBoost,
        },
        sideAmount: {
            endpointID: "b1SideAmountIn",
            label: "Side",
            min: 0,
            max: 1,
            initial: 0,
            step: 0.001,
            scale: "linear",
            format: formatBoost,
        },
        modeEndpointID: "b1ModeIn",
        curveEndpointID: "b1CurveIn",
        initialCurve: 1,
    },
    {
        number: 2,
        accent: "#8ec5ff",
        frequency: {
            endpointID: "b2FreqHzIn",
            label: "Frequency",
            min: 20,
            max: 20_000,
            initial: 9000,
            step: 0.0001,
            scale: "log",
            format: formatFrequency,
        },
        q: {
            endpointID: "b2QIn",
            label: "Q",
            min: 0.1,
            max: 10,
            initial: 0.71,
            step: 0.001,
            scale: "linear",
            format: formatQ,
        },
        primaryAmount: {
            endpointID: "b2MidAmountIn",
            label: "Amount",
            min: 0,
            max: 1,
            initial: 0,
            step: 0.001,
            scale: "linear",
            format: formatBoost,
        },
        sideAmount: {
            endpointID: "b2SideAmountIn",
            label: "Side",
            min: 0,
            max: 1,
            initial: 0,
            step: 0.001,
            scale: "linear",
            format: formatBoost,
        },
        modeEndpointID: "b2ModeIn",
        curveEndpointID: "b2CurveIn",
        initialCurve: 0,
    },
];

const endpointInitialValues = new Map<string, number>();
for (const band of bandDefinitions) {
    endpointInitialValues.set(band.frequency.endpointID, band.frequency.initial);
    endpointInitialValues.set(band.q.endpointID, band.q.initial);
    endpointInitialValues.set(band.modeEndpointID, 0);
    endpointInitialValues.set(band.primaryAmount.endpointID, band.primaryAmount.initial);
    endpointInitialValues.set(band.sideAmount.endpointID, band.sideAmount.initial);
    endpointInitialValues.set(band.curveEndpointID, band.initialCurve);
}
endpointInitialValues.set(deEmphasisControl.endpointID, deEmphasisControl.initial);
endpointInitialValues.set(saturationModeEndpointID, 0);

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function toSliderValue(control: NumberControl, dspValue: number): number {
    const value = clamp(dspValue, control.min, control.max);
    if (control.scale === "linear")
        return value;

    return Math.log(value / control.min) / Math.log(control.max / control.min);
}

function fromSliderValue(control: NumberControl, sliderValue: number): number {
    if (control.scale === "linear")
        return clamp(sliderValue, control.min, control.max);

    const normalized = clamp(sliderValue, 0, 1);
    return control.min * Math.pow(control.max / control.min, normalized);
}

const responsePlot = Object.freeze({
    width: 936,
    height: 168,
    left: 44,
    right: 12,
    top: 12,
    bottom: 24,
    minimumHz: 20,
    maximumHz: 20_000,
    maximumDb: 12,
    modelSampleRate: 48_000 * 4,
});

const responseGridFrequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000] as const;
const responseGridLevels = [0, 3, 6, 9, 12] as const;

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
    // Same 4x RBJ peaking-EQ law recovered from Spectre Good. The audio path
    // takes H(z)-1 into the shaper; a conventional EQ display shows H(z), so
    // the peak reads as the user's 0..12 dB Amount while retaining the actual
    // gain-dependent shoulders.
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
    const numeratorPower = numeratorReal * numeratorReal
        + numeratorImaginary * numeratorImaginary;
    const denominatorPower = denominatorReal * denominatorReal
        + denominatorImaginary * denominatorImaginary;
    return clamp(10 * Math.log10(Math.max(numeratorPower / denominatorPower, 1e-30)), 0, 12);
}

function responsePath(centreHz: number, q: number, amount: number, closeArea = false): string {
    const pointCount = 241;
    const points: string[] = [];
    for (let index = 0; index < pointCount; index += 1) {
        const normalized = index / (pointCount - 1);
        const frequencyHz = responsePlot.minimumHz
            * Math.pow(responsePlot.maximumHz / responsePlot.minimumHz, normalized);
        const x = responseX(frequencyHz);
        const y = responseY(peakingResponseDb(frequencyHz, centreHz, q, amount));
        points.push(`${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    if (closeArea) {
        const baseline = responseY(0).toFixed(2);
        points.push(`L ${(responsePlot.width - responsePlot.right).toFixed(2)} ${baseline}`);
        points.push(`L ${responsePlot.left.toFixed(2)} ${baseline} Z`);
    }
    return points.join(" ");
}

class EnhancerView extends HTMLElement {
    readonly patchConnection: EnhancerPatchConnection;
    readonly values = new Map(endpointInitialValues);
    readonly parameterListeners: Array<{ endpointID: string; listener: ParameterListener }> = [];
    hasAttached = false;

    constructor(patchConnection: EnhancerPatchConnection) {
        super();
        this.patchConnection = patchConnection;
        this.attachShadow({ mode: "open" });
        this.shadowRoot!.innerHTML = this.getMarkup();
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
    }

    bindControls(): void {
        const root = this.shadowRoot;
        if (!root)
            throw new Error("Enhancer controls require an attached shadow root.");

        for (const band of bandDefinitions) {
            for (const control of [band.frequency, band.q, band.primaryAmount, band.sideAmount])
                this.bindNumberControl(control);

            for (const button of root.querySelectorAll<HTMLButtonElement>(`[data-band='${band.number}'] [data-mode]`)) {
                button.addEventListener("click", () => {
                    const value = button.dataset.mode === "mid-side" ? 1 : 0;
                    this.patchConnection.sendEventOrValue(band.modeEndpointID, value, 0);
                });
            }

            for (const button of root.querySelectorAll<HTMLButtonElement>(`[data-band='${band.number}'] [data-curve]`)) {
                button.addEventListener("click", () => {
                    const value = button.dataset.curve === "solid" ? 1 : 0;
                    this.patchConnection.sendEventOrValue(band.curveEndpointID, value, 0);
                });
            }
        }

        for (const button of root.querySelectorAll<HTMLButtonElement>("[data-saturation-mode]")) {
            button.addEventListener("click", () => {
                const value = button.dataset.saturationMode === "medium" ? 1 : 0;
                this.patchConnection.sendEventOrValue(saturationModeEndpointID, value, 0);
            });
        }

        this.bindNumberControl(deEmphasisControl);
    }

    bindNumberControl(control: NumberControl): void {
        const host = this.shadowRoot!.querySelector<HTMLElement>(`[data-endpoint-id='${control.endpointID}']`)!;
        const input = host.querySelector<HTMLInputElement>("input")!;
        input.addEventListener("input", () => {
            const value = fromSliderValue(control, Number(input.value));
            this.patchConnection.sendEventOrValue(control.endpointID, value, 0);
        });
        input.addEventListener("dblclick", () => {
            this.patchConnection.sendEventOrValue(control.endpointID, control.initial, 0);
        });
    }

    renderAll(): void {
        for (const endpointID of endpointInitialValues.keys())
            this.renderEndpoint(endpointID);
    }

    renderEndpoint(endpointID: string): void {
        let affectsResponsePlot = false;
        if (endpointID === deEmphasisControl.endpointID)
            this.renderNumberControl(deEmphasisControl);
        if (endpointID === saturationModeEndpointID)
            this.renderSaturationMode();

        for (const band of bandDefinitions) {
            const numberControl = [band.frequency, band.q, band.primaryAmount, band.sideAmount]
                .find((candidate) => candidate.endpointID === endpointID);
            if (numberControl)
                this.renderNumberControl(numberControl);

            if (endpointID === band.modeEndpointID)
                this.renderMode(band);

            if (endpointID === band.curveEndpointID)
                this.renderCurve(band);

            if ([
                band.frequency.endpointID,
                band.q.endpointID,
                band.primaryAmount.endpointID,
                band.sideAmount.endpointID,
                band.modeEndpointID,
            ].includes(endpointID)) {
                affectsResponsePlot = true;
            }
        }

        if (affectsResponsePlot)
            this.renderResponsePlot();
    }

    renderNumberControl(control: NumberControl): void {
        const host = this.shadowRoot!.querySelector<HTMLElement>(`[data-endpoint-id='${control.endpointID}']`);
        if (!host)
            return;

        const value = this.values.get(control.endpointID) ?? control.initial;
        const input = host.querySelector<HTMLInputElement>("input")!;
        const output = host.querySelector<HTMLOutputElement>("output")!;
        input.value = String(toSliderValue(control, value));
        input.setAttribute("aria-valuetext", control.format(value));
        output.value = control.format(value);
    }

    renderMode(band: BandDefinition): void {
        const card = this.shadowRoot!.querySelector<HTMLElement>(`[data-band='${band.number}']`)!;
        const isMidSide = (this.values.get(band.modeEndpointID) ?? 0) >= 0.5;
        for (const button of card.querySelectorAll<HTMLButtonElement>("[data-mode]"))
            button.setAttribute("aria-pressed", String((button.dataset.mode === "mid-side") === isMidSide));

        card.querySelector<HTMLElement>("[data-role='primary-label']")!.textContent = isMidSide ? "Mid" : "Amount";
        card.querySelector<HTMLElement>("[data-role='side-control']")!.hidden = !isMidSide;
        card.querySelector<HTMLElement>("[data-role='routing-description']")!.textContent = isMidSide
            ? "Mid and Side are driven independently"
            : "Left and right share one linked drive";
    }

    renderCurve(band: BandDefinition): void {
        const card = this.shadowRoot!.querySelector<HTMLElement>(`[data-band='${band.number}']`)!;
        const isSolid = (this.values.get(band.curveEndpointID) ?? band.initialCurve) >= 0.5;
        for (const button of card.querySelectorAll<HTMLButtonElement>("[data-curve]"))
            button.setAttribute("aria-pressed", String((button.dataset.curve === "solid") === isSolid));
    }

    renderSaturationMode(): void {
        const root = this.shadowRoot;
        if (!root)
            throw new Error("Enhancer saturation mode requires an attached shadow root.");

        const isMedium = (this.values.get(saturationModeEndpointID) ?? 0) >= 0.5;
        for (const button of root.querySelectorAll<HTMLButtonElement>("[data-saturation-mode]")) {
            button.setAttribute(
                "aria-pressed",
                String((button.dataset.saturationMode === "medium") === isMedium),
            );
        }
    }

    renderResponsePlot(): void {
        for (const band of bandDefinitions) {
            const frequency = this.values.get(band.frequency.endpointID) ?? band.frequency.initial;
            const q = this.values.get(band.q.endpointID) ?? band.q.initial;
            const primary = this.values.get(band.primaryAmount.endpointID) ?? 0;
            const side = this.values.get(band.sideAmount.endpointID) ?? 0;
            const isMidSide = (this.values.get(band.modeEndpointID) ?? 0) >= 0.5;
            const selector = `[data-response-band='${band.number}']`;
            const primaryPath = this.shadowRoot?.querySelector<SVGPathElement>(
                `${selector}[data-response-role='primary']`,
            );
            const sidePath = this.shadowRoot?.querySelector<SVGPathElement>(
                `${selector}[data-response-role='side']`,
            );
            const fillPath = this.shadowRoot?.querySelector<SVGPathElement>(
                `${selector}[data-response-role='fill']`,
            );
            const primaryHandle = this.shadowRoot?.querySelector<SVGCircleElement>(
                `${selector}[data-response-role='primary-handle']`,
            );
            const sideHandle = this.shadowRoot?.querySelector<SVGCircleElement>(
                `${selector}[data-response-role='side-handle']`,
            );
            if (!primaryPath || !sidePath || !fillPath || !primaryHandle || !sideHandle)
                throw new Error(`Enhancer response markup is incomplete for band ${band.number}.`);

            primaryPath.setAttribute("d", responsePath(frequency, q, primary));
            sidePath.setAttribute("d", responsePath(frequency, q, side));
            fillPath.setAttribute("d", responsePath(frequency, q, primary, true));
            sidePath.toggleAttribute("hidden", !isMidSide);
            sideHandle.toggleAttribute("hidden", !isMidSide);
            primaryHandle.setAttribute("cx", responseX(frequency).toFixed(2));
            primaryHandle.setAttribute("cy", responseY(12 * primary).toFixed(2));
            sideHandle.setAttribute("cx", responseX(frequency).toFixed(2));
            sideHandle.setAttribute("cy", responseY(12 * side).toFixed(2));
            primaryPath.setAttribute(
                "aria-label",
                `Band ${band.number} ${isMidSide ? "Mid" : "Stereo"}: ${formatFrequency(frequency)}, Q ${formatQ(q)}, ${formatBoost(primary)}`,
            );
            sidePath.setAttribute(
                "aria-label",
                `Band ${band.number} Side: ${formatFrequency(frequency)}, Q ${formatQ(q)}, ${formatBoost(side)}`,
            );
        }
    }

    numberControlMarkup(control: NumberControl, role = ""): string {
        const sliderMin = control.scale === "linear" ? control.min : 0;
        const sliderMax = control.scale === "linear" ? control.max : 1;
        const roleMarkup = role ? ` data-role="${role}"` : "";
        const labelMarkup = role === "primary-control"
            ? `<span data-role="primary-label">${control.label}</span>`
            : `<span>${control.label}</span>`;
        return `
            <label class="control" data-endpoint-id="${control.endpointID}"${roleMarkup}>
                <span class="control-heading">${labelMarkup}<output>${control.format(control.initial)}</output></span>
                <input type="range" min="${sliderMin}" max="${sliderMax}" step="${control.step}" aria-label="${control.label}">
            </label>
        `;
    }

    responsePlotMarkup(): string {
        const verticalGrid = responseGridFrequencies.map((frequencyHz) => {
            const x = responseX(frequencyHz).toFixed(2);
            const label = frequencyHz >= 1000
                ? `${frequencyHz / 1000}k`
                : String(frequencyHz);
            return `<path class="response-grid-line" d="M ${x} ${responsePlot.top} V ${responseY(0).toFixed(2)}"></path>
                    <text class="response-axis-label frequency-label" x="${x}" y="${responsePlot.height - 6}" text-anchor="middle">${label}</text>`;
        }).join("");
        const horizontalGrid = responseGridLevels.map((gainDb) => {
            const y = responseY(gainDb).toFixed(2);
            return `<path class="response-grid-line${gainDb === 0 ? " baseline" : ""}" d="M ${responsePlot.left} ${y} H ${responsePlot.width - responsePlot.right}"></path>
                    <text class="response-axis-label level-label" x="${responsePlot.left - 8}" y="${Number(y) + 3}" text-anchor="end">${gainDb === 0 ? "0" : `+${gainDb}`}</text>`;
        }).join("");
        const bands = bandDefinitions.map((band) => `
            <path class="response-fill" data-response-band="${band.number}" data-response-role="fill" style="--response-accent:${band.accent}"></path>
            <path class="response-band primary" data-response-band="${band.number}" data-response-role="primary" style="--response-accent:${band.accent}"></path>
            <path class="response-band side" data-response-band="${band.number}" data-response-role="side" style="--response-accent:${band.accent}" hidden></path>
            <circle class="response-handle primary" data-response-band="${band.number}" data-response-role="primary-handle" style="--response-accent:${band.accent}" r="4.5"></circle>
            <circle class="response-handle side" data-response-band="${band.number}" data-response-role="side-handle" style="--response-accent:${band.accent}" r="3.5" hidden></circle>
        `).join("");
        return `
            <section class="response-panel" aria-label="Enhancer parametric response">
                <header class="response-heading">
                    <div>
                        <span class="response-title">Band selection</span>
                        <p>Measured 4× parametric shape · Amount changes both boost and shoulder width</p>
                    </div>
                    <div class="response-legend" aria-label="Response legend">
                        ${bandDefinitions.map((band) => `<span style="--response-accent:${band.accent}"><i></i>Band ${band.number}</span>`).join("")}
                        <span class="side-key"><i></i>Side in M/S</span>
                    </div>
                </header>
                <svg class="response-plot" viewBox="0 0 ${responsePlot.width} ${responsePlot.height}" role="img" aria-label="Frequency versus boost plot from 20 hertz to 20 kilohertz">
                    ${verticalGrid}
                    ${horizontalGrid}
                    <text class="response-axis-unit" x="9" y="17">dB</text>
                    ${bands}
                </svg>
            </section>
        `;
    }

    bandMarkup(band: BandDefinition): string {
        return `
            <section class="band" data-band="${band.number}" style="--band-accent:${band.accent}">
                <header class="band-header">
                    <div>
                        <span class="eyebrow">Band ${band.number}</span>
                        <p data-role="routing-description">Left and right share one linked drive</p>
                    </div>
                    <div class="segmented" aria-label="Band ${band.number} routing mode">
                        <button type="button" data-mode="stereo" aria-pressed="true">Stereo</button>
                        <button type="button" data-mode="mid-side" aria-pressed="false">M/S</button>
                    </div>
                </header>
                <div class="control-grid">
                    ${this.numberControlMarkup(band.frequency)}
                    ${this.numberControlMarkup(band.q)}
                    ${this.numberControlMarkup(band.primaryAmount, "primary-control")}
                    ${this.numberControlMarkup(band.sideAmount, "side-control")}
                </div>
                <footer class="band-footer">
                    <span>Character</span>
                    <div class="segmented character" aria-label="Band ${band.number} character">
                        <button type="button" data-curve="tube" aria-pressed="${band.initialCurve === 0}">Tube</button>
                        <button type="button" data-curve="solid" aria-pressed="${band.initialCurve === 1}">Solid</button>
                    </div>
                </footer>
            </section>
        `;
    }

    getMarkup(): string {
        return `
            <style>
                :host {
                    display: block;
                    width: 980px;
                    min-height: 700px;
                    color: #f4efe6;
                    background:
                        radial-gradient(circle at 8% 0%, rgba(240, 184, 103, 0.14), transparent 32%),
                        radial-gradient(circle at 92% 0%, rgba(142, 197, 255, 0.13), transparent 32%),
                        linear-gradient(180deg, #16171c 0%, #0b0c10 100%);
                    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
                }

                * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
                [hidden] { display: none !important; }
                button, input { font: inherit; }

                .shell { min-height: 700px; padding: 22px; }
                .topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
                h1, p { margin: 0; }
                h1 { font: 600 27px/1.1 "Avenir Next", "Helvetica Neue", sans-serif; letter-spacing: 0.16em; }
                .subtitle { margin-top: 8px; color: rgba(244, 239, 230, 0.58); font-size: 11px; line-height: 1.5; letter-spacing: 0.04em; }
                .top-controls { width: min(360px, 42%); display: grid; gap: 10px; --band-accent: #d8d3c8; }
                .badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
                .badge { border: 1px solid rgba(255,255,255,0.10); border-radius: 999px; padding: 7px 10px; color: rgba(244,239,230,0.72); background: rgba(255,255,255,0.035); font-size: 9px; letter-spacing: 0.09em; text-transform: uppercase; }
                .global-controls { display: grid; grid-template-columns: 1fr 1.2fr; gap: 9px; }
                .saturation-mode-panel, .de-emphasis-panel { border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 11px 12px 9px; background: rgba(255,255,255,0.035); }
                .saturation-mode-panel > span { display: block; margin-bottom: 8px; color: rgba(244,239,230,0.63); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
                .saturation-mode-panel .segmented { width: 100%; }
                .saturation-mode-panel button { flex: 1; padding: 0 7px; }
                .de-emphasis-panel p { margin-top: 7px; color: rgba(244,239,230,0.48); font-size: 8px; line-height: 1.4; text-align: right; }
                .response-panel { margin-bottom: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; padding: 13px 14px 5px; background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.035); }
                .response-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 0 5px 2px; }
                .response-title { color: rgba(244,239,230,0.82); font: 650 10px/1 "Avenir Next", "Helvetica Neue", sans-serif; letter-spacing: 0.14em; text-transform: uppercase; }
                .response-heading p { margin-top: 5px; color: rgba(244,239,230,0.46); font-size: 8px; letter-spacing: 0.025em; }
                .response-legend { display: flex; align-items: center; justify-content: flex-end; gap: 13px; color: rgba(244,239,230,0.56); font-size: 8px; letter-spacing: 0.055em; text-transform: uppercase; }
                .response-legend span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
                .response-legend i { display: inline-block; width: 16px; height: 2px; border-radius: 9px; background: var(--response-accent, rgba(244,239,230,0.62)); }
                .response-legend .side-key i { height: 0; border-top: 1.5px dashed rgba(244,239,230,0.62); background: transparent; }
                .response-plot { display: block; width: 100%; height: 168px; overflow: visible; }
                .response-grid-line { fill: none; stroke: rgba(255,255,255,0.05); stroke-width: 1; vector-effect: non-scaling-stroke; }
                .response-grid-line.baseline { stroke: rgba(255,255,255,0.17); }
                .response-axis-label, .response-axis-unit { fill: rgba(244,239,230,0.35); font: 8px/1 "SF Mono", Menlo, monospace; }
                .response-axis-unit { text-transform: uppercase; letter-spacing: 0.08em; }
                .response-fill { fill: color-mix(in srgb, var(--response-accent) 10%, transparent); stroke: none; }
                .response-band { fill: none; stroke: var(--response-accent); stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--response-accent) 35%, transparent)); }
                .response-band.side { stroke-width: 1.5; stroke-dasharray: 6 4; opacity: 0.72; }
                .response-handle { fill: var(--response-accent); stroke: #111318; stroke-width: 2; vector-effect: non-scaling-stroke; }
                .response-handle.side { fill: #111318; stroke: var(--response-accent); stroke-width: 1.5; opacity: 0.9; }
                .bands { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
                .band { min-width: 0; border: 1px solid rgba(255,255,255,0.09); border-radius: 18px; padding: 17px; background: rgba(255,255,255,0.035); box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), 0 18px 44px rgba(0,0,0,0.18); }
                .band-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
                .eyebrow { color: var(--band-accent); font: 700 12px/1 "Avenir Next", "Helvetica Neue", sans-serif; letter-spacing: 0.16em; text-transform: uppercase; }
                .band-header p { margin-top: 7px; color: rgba(244,239,230,0.52); font-size: 9px; line-height: 1.4; }
                .segmented { display: inline-flex; padding: 3px; border: 1px solid rgba(255,255,255,0.10); border-radius: 9px; background: rgba(0,0,0,0.28); }
                .segmented button { min-height: 27px; border: 0; border-radius: 6px; padding: 0 10px; color: rgba(244,239,230,0.52); background: transparent; cursor: pointer; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }
                .segmented button[aria-pressed="true"] { color: #111318; background: var(--band-accent); box-shadow: 0 4px 14px color-mix(in srgb, var(--band-accent) 28%, transparent); }
                .segmented button:focus-visible, input:focus-visible { outline: 2px solid var(--band-accent); outline-offset: 2px; }
                .control-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px 15px; min-height: 112px; margin-top: 18px; }
                .control { display: grid; gap: 8px; align-content: start; }
                .control-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: rgba(244,239,230,0.63); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
                output { color: #f4efe6; font-variant-numeric: tabular-nums; letter-spacing: 0; text-transform: none; }
                input[type="range"] { appearance: none; width: 100%; height: 16px; margin: 0; background: transparent; cursor: ew-resize; }
                input[type="range"]::-webkit-slider-runnable-track { height: 3px; border-radius: 99px; background: linear-gradient(90deg, color-mix(in srgb, var(--band-accent) 68%, #222) 0%, rgba(255,255,255,0.13) 100%); }
                input[type="range"]::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; margin-top: -5.5px; border: 2px solid #111318; border-radius: 50%; background: var(--band-accent); box-shadow: 0 0 0 1px rgba(255,255,255,0.18), 0 4px 12px rgba(0,0,0,0.35); }
                .band-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 13px; padding-top: 13px; border-top: 1px solid rgba(255,255,255,0.07); color: rgba(244,239,230,0.56); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
                .character button[aria-pressed="true"] { background: var(--band-accent); }
                .footnote { margin-top: 16px; color: rgba(244,239,230,0.48); font-size: 9px; line-height: 1.55; letter-spacing: 0.03em; text-align: center; }

                @media (max-width: 760px) {
                    :host { width: 100%; }
                    .bands { grid-template-columns: 1fr; }
                    .topline { align-items: stretch; flex-direction: column; }
                    .top-controls { width: 100%; }
                    .badges { justify-content: flex-start; }
                }
            </style>
            <main class="shell">
                <header class="topline">
                    <div>
                        <h1>Enhancer</h1>
                        <p class="subtitle">Two parametric harmonic bands. Each band routes in linked Stereo or independent Mid/Side.</p>
                    </div>
                    <div class="top-controls">
                        <div class="badges" aria-label="Fixed processing">
                            <span class="badge">4× oversampling</span>
                            <span class="badge">Dry + shaped bands</span>
                        </div>
                        <div class="global-controls">
                            <div class="saturation-mode-panel">
                                <span>Saturation mode</span>
                                <div class="segmented" aria-label="Saturation mode">
                                    <button type="button" data-saturation-mode="subtle" aria-pressed="true">Subtle</button>
                                    <button type="button" data-saturation-mode="medium" aria-pressed="false">Medium</button>
                                </div>
                            </div>
                            <div class="de-emphasis-panel">
                                ${this.numberControlMarkup(deEmphasisControl)}
                                <p>0% keeps the shaped bell · 100% subtracts the unprocessed bell</p>
                            </div>
                        </div>
                    </div>
                </header>
                ${this.responsePlotMarkup()}
                <div class="bands">
                    ${bandDefinitions.map((band) => this.bandMarkup(band)).join("")}
                </div>
                <p class="footnote">Stereo uses the Amount control for both channels. M/S relabels it Mid and reveals a separately saved Side amount. De-emphasis changes only the bell subtraction. Double-click a slider to reset it.</p>
            </main>
        `;
    }
}

type EnhancerViewConstructor = new (patchConnection: EnhancerPatchConnection) => EnhancerView;

export default function createPatchView(patchConnection: EnhancerPatchConnection): HTMLElement {
    const elementName = "cosimo-enhancer-view";
    if (!window.customElements.get(elementName))
        window.customElements.define(elementName, EnhancerView);

    const View = window.customElements.get(elementName) as unknown as EnhancerViewConstructor;
    return new View(patchConnection);
}
