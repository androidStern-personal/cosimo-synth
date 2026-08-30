import {
    useEffect,
    useMemo,
    useRef,
    type CSSProperties,
    type ReactNode,
} from "react";

import {
    EnhancerSpectrumGraph,
    type EnhancerSpectrumCurve,
    type EnhancerSpectrumMarker,
} from "../shared/enhancer-spectrum-graph";
import {
    createEnhancerFrequencyPath,
    enhancerFrequencyX,
    type EnhancerSpectrumDisplay,
} from "../shared/enhancer-spectrum";
import {
    polishCompressorOutputDb,
    polishEnhancerResponseDb,
    polishSafeBassMagnitudeDb,
    polishSoftClipOutput,
    type PolishMeterFrame,
} from "../shared/polish";

/** The only editable values the accepted T75 surface is allowed to explain. */
export type PolishFullScreenValues = {
    readonly safeBassAmount: number;
    readonly enhancerAmount: number;
    readonly compressionClipAmount: number;
    readonly outputTrimDb: number;
};

/**
 * Control slots keep the full page owned by T75 while T74 remains the sole
 * owner of compact controls, bypass state, and their eventual bindings.
 */
export type PolishFullScreenControls = {
    readonly safeBass: ReactNode;
    readonly enhancer: ReactNode;
    readonly comp: ReactNode;
    readonly outputTrim: ReactNode;
};

/** Approved module activity is supplied by T74 instead of duplicated here. */
export type PolishFullScreenModuleActivity = {
    readonly safeBass: boolean;
    readonly enhancer: boolean;
    readonly comp: boolean;
    readonly outputTrim: boolean;
};

/** Optional T74-owned bypass actions mirrored beside their full-page stages. */
export type PolishFullScreenModuleActions = Partial<Readonly<Record<
    keyof PolishFullScreenModuleActivity,
    ReactNode
>>>;

/** Controlled composition boundary for opening and closing the Polish page. */
export type PolishFullScreenEditorProps = {
    readonly open: boolean;
    readonly onClose: () => void;
    readonly values: PolishFullScreenValues;
    readonly controls: PolishFullScreenControls;
    readonly moduleActivity: PolishFullScreenModuleActivity;
    readonly moduleActions?: PolishFullScreenModuleActions;
    readonly meter: PolishMeterFrame;
    readonly spectrum: EnhancerSpectrumDisplay | null;
};

type PolishStageProps = {
    readonly id: string;
    readonly eyebrow: string;
    readonly title: string;
    readonly active: boolean;
    readonly action?: ReactNode;
    readonly copy: ReactNode;
    readonly graphic: ReactNode;
    readonly control?: ReactNode;
    readonly className?: string;
};

const plotRight = 760 - 42;
const transferPlot = Object.freeze({
    width: 360,
    height: 220,
    left: 34,
    right: 18,
    top: 16,
    bottom: 30,
});

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function PolishStage({
    id,
    eyebrow,
    title,
    active,
    action,
    copy,
    graphic,
    control,
    className = "",
}: PolishStageProps) {
    return (
        <section
            className={`polish-fullscreen-stage ${className}`.trim()}
            data-polish-stage={id}
            data-stage-active={String(active)}
        >
            <header className="polish-fullscreen-stage-header">
                <div>
                    <span>{eyebrow}</span>
                    <h2>{title}</h2>
                </div>
                {action === undefined ? null : (
                    <div className="polish-fullscreen-stage-action">{action}</div>
                )}
            </header>
            <p className="polish-fullscreen-stage-copy">{copy}</p>
            <div className="polish-fullscreen-stage-graphic">{graphic}</div>
            {control === undefined ? null : (
                <div className="polish-fullscreen-stage-control">{control}</div>
            )}
        </section>
    );
}

function SafeBassGraphic({ amount }: { readonly amount: number }) {
    const responsePath = createEnhancerFrequencyPath((frequencyHz) => {
        const responseDb = clamp(polishSafeBassMagnitudeDb(frequencyHz, amount), -36, 0);
        return 18 + (-responseDb / 36) * 104;
    });
    const cutoffX = enhancerFrequencyX(120);

    return (
        <svg
            className="polish-safe-bass-graphic"
            data-role="polish-safe-bass-graphic"
            viewBox="0 0 760 148"
            preserveAspectRatio="none"
            role="img"
            aria-label="Safe Bass side high-pass response with a fixed 120 hertz cutoff"
        >
            <path className="polish-stage-grid" d={`M 42 122 H ${plotRight}`} />
            <path className="polish-stage-grid" d={`M ${cutoffX.toFixed(2)} 18 V 122`} />
            <path className="polish-safe-bass-response" d={responsePath} />
            <text x={cutoffX + 8} y={34}>120 Hz · SIDE</text>
        </svg>
    );
}

function createPolishEnhancerCurves(amount: number): {
    curves: ReadonlyArray<EnhancerSpectrumCurve>;
    markers: ReadonlyArray<EnhancerSpectrumMarker>;
} {
    const amount01 = clamp(amount, 0, 1);
    const midResponse = (frequencyHz: number) => (
        polishEnhancerResponseDb(frequencyHz, amount01, "mid")
    );
    const sideResponse = (frequencyHz: number) => (
        polishEnhancerResponseDb(frequencyHz, amount01, "side")
    );
    return {
        curves: [
            {
                id: "mid",
                label: "Mid response",
                gainDbAtFrequency: midResponse,
                color: "#f4c86a",
            },
            {
                id: "side",
                label: "Side response",
                gainDbAtFrequency: sideResponse,
                color: "#7cc8ff",
                dashArray: "7 5",
            },
        ],
        markers: [
            {
                id: "body",
                label: "Fixed body band at 130 hertz",
                frequencyHz: 130,
                gainDb: midResponse(130),
                color: "#f4c86a",
            },
            {
                id: "air",
                label: "Fixed air band at 9 kilohertz",
                frequencyHz: 9_000,
                gainDb: sideResponse(9_000),
                color: "#7cc8ff",
            },
        ],
    };
}

function transferX(value: number, minimum: number, maximum: number): number {
    return transferPlot.left + (value - minimum) / (maximum - minimum)
        * (transferPlot.width - transferPlot.left - transferPlot.right);
}

function transferY(value: number, minimum: number, maximum: number): number {
    return transferPlot.height - transferPlot.bottom - (value - minimum) / (maximum - minimum)
        * (transferPlot.height - transferPlot.top - transferPlot.bottom);
}

function createTransferPath(
    minimum: number,
    maximum: number,
    outputAtInput: (input: number) => number,
): string {
    return Array.from({ length: 121 }, (_, index) => {
        const input = minimum + (maximum - minimum) * index / 120;
        const output = outputAtInput(input);
        return `${index === 0 ? "M" : "L"} ${transferX(input, minimum, maximum).toFixed(2)} ${transferY(output, minimum, maximum).toFixed(2)}`;
    }).join(" ");
}

function TransferCurve({
    kind,
    amount,
}: {
    readonly kind: "compressor" | "soft-clipper";
    readonly amount: number;
}) {
    const isCompressor = kind === "compressor";
    const minimum = isCompressor ? -30 : -1.2;
    const maximum = isCompressor ? 6 : 1.2;
    const responsePath = createTransferPath(
        minimum,
        maximum,
        isCompressor
            ? (input) => polishCompressorOutputDb(input, amount)
            : (input) => polishSoftClipOutput(input, amount),
    );
    const identityPath = `M ${transferX(minimum, minimum, maximum)} ${transferY(minimum, minimum, maximum)} L ${transferX(maximum, minimum, maximum)} ${transferY(maximum, minimum, maximum)}`;

    return (
        <svg
            className="polish-transfer-curve"
            data-role={`polish-${kind}-transfer-curve`}
            viewBox={`0 0 ${transferPlot.width} ${transferPlot.height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${isCompressor ? "Compressor" : "Soft clipper"} input to output transfer curve`}
        >
            <path className="polish-stage-grid" d={`M ${transferPlot.left} ${transferPlot.top} V ${transferPlot.height - transferPlot.bottom} H ${transferPlot.width - transferPlot.right}`} />
            <path className="polish-transfer-identity" d={identityPath} />
            <path className="polish-transfer-response" d={responsePath} />
            <text x={transferPlot.left} y={transferPlot.height - 8}>INPUT</text>
            <text x={transferPlot.left + 4} y={transferPlot.top + 10}>OUTPUT</text>
        </svg>
    );
}

function OutputMeter({
    label,
    valueDbfs,
}: {
    readonly label: string;
    readonly valueDbfs: number;
}) {
    const level = clamp((valueDbfs + 60) / 60, 0, 1);
    return (
        <div
            className="polish-output-meter"
            data-overload={String(valueDbfs >= 0)}
            style={{ "--polish-meter-level": level } as CSSProperties}
        >
            <span>{label}</span>
            <i aria-hidden="true"><b /></i>
            <output>{valueDbfs <= -100 ? "−∞" : `${valueDbfs.toFixed(1)} dBFS`}</output>
        </div>
    );
}

function shouldRemainOutsideModal(candidate: HTMLElement): boolean {
    return candidate.getAttribute("data-role") === "synth-preset-bar-host"
        || candidate.getAttribute("data-role") === "mobile-global-mod-rail-portal"
        || candidate.querySelector('[data-role="mobile-global-mod-rail-portal"]') !== null;
}

/** Render T75's dedicated, controlled full-page Polish surface. */
export function PolishFullScreenEditor({
    open,
    onClose,
    values,
    controls,
    moduleActivity,
    moduleActions = {},
    meter,
    spectrum,
}: PolishFullScreenEditorProps) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const enhancerPresentation = useMemo(
        () => createPolishEnhancerCurves(values.enhancerAmount),
        [values.enhancerAmount],
    );

    useEffect(() => {
        const editor = editorRef.current;
        if (!open || editor === null) {
            return;
        }

        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const siblings = Array.from(editor.parentElement?.children ?? []).filter(
            (candidate): candidate is HTMLElement => candidate instanceof HTMLElement
                && candidate !== editor
                && !shouldRemainOutsideModal(candidate),
        );
        const inertStates = siblings.map((element) => ({ element, inert: element.inert }));
        for (const sibling of siblings) {
            sibling.inert = true;
        }
        closeButtonRef.current?.focus({ preventScroll: true });

        const handleKeyboard = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current();
                return;
            }
            if (event.key !== "Tab") {
                return;
            }

            const focusable = Array.from(editor.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )).filter((element) => !element.hidden);
            if (focusable.length === 0) {
                return;
            }
            const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
            const nextIndex = event.shiftKey
                ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
                : (currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);
            event.preventDefault();
            focusable[nextIndex]?.focus();
        };

        window.addEventListener("keydown", handleKeyboard, true);
        return () => {
            window.removeEventListener("keydown", handleKeyboard, true);
            for (const state of inertStates) {
                state.element.inert = state.inert;
            }
            previouslyFocused?.focus({ preventScroll: true });
        };
    }, [open]);

    if (!open) {
        return null;
    }

    const gainReductionDb = Math.max(0, -(meter.compressorGainReductionDb ?? 0));

    return (
        <div
            ref={editorRef}
            className="polish-fullscreen-backdrop"
            data-role="polish-fullscreen-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="polish-fullscreen-title"
        >
            <div className="polish-fullscreen-frame">
                <header className="polish-fullscreen-header">
                    <div>
                        <span>FIXED OUTPUT SECTION</span>
                        <h1 id="polish-fullscreen-title">POLISH</h1>
                        <p>See what each stage is doing without changing the approved sound.</p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        className="polish-fullscreen-close"
                        data-role="polish-fullscreen-close"
                        onClick={onClose}
                    >
                        <span aria-hidden="true">←</span> Done
                    </button>
                </header>

                <div className="polish-fullscreen-scroll" data-role="polish-fullscreen-scroll">
                    <div className="polish-fullscreen-chain" aria-label="Polish signal order">
                        <span>SAFE BASS</span><i /><span>ENHANCER</span><i />
                        <span>COMPRESSOR</span><i /><span>SOFT CLIPPER</span><i />
                        <span>OUTPUT TRIM</span>
                    </div>

                    <PolishStage
                        id="safe-bass"
                        eyebrow="01 · STEREO FOUNDATION"
                        title="Safe Bass"
                        active={moduleActivity.safeBass}
                        action={moduleActions.safeBass}
                        copy="Keeps deep bass centered by high-pass filtering the stereo side signal below the fixed 120 Hz cutoff."
                        graphic={<SafeBassGraphic amount={values.safeBassAmount} />}
                        control={controls.safeBass}
                    />

                    <PolishStage
                        id="enhancer"
                        eyebrow="02 · HARMONIC SHAPE"
                        title="Enhancer"
                        active={moduleActivity.enhancer}
                        action={moduleActions.enhancer}
                        copy="Two fixed bands add body at 130 Hz and air at 9 kHz. The incoming signal is shown behind the Mid and Side response curves."
                        graphic={(
                            <EnhancerSpectrumGraph
                                spectrum={spectrum}
                                curves={enhancerPresentation.curves}
                                markers={enhancerPresentation.markers}
                                ariaLabel="Incoming Polish spectrum with fixed Mid and Side Enhancer response curves"
                            />
                        )}
                        control={controls.enhancer}
                        className="polish-fullscreen-stage-wide"
                    />

                    <div className="polish-comp-link" data-role="polish-comp-explanation">
                        <strong>One Comp Amount</strong>
                        <span>drives both compression and soft clipping.</span>
                    </div>

                    <PolishStage
                        id="compressor"
                        eyebrow="03 · DYNAMIC CONTROL"
                        title="Compressor"
                        active={moduleActivity.comp}
                        action={moduleActions.comp}
                        copy="A fixed 20 ms attack and 120 ms release control peaks with a soft 6 dB knee. The live readout is the gain currently being removed."
                        graphic={(
                            <div className="polish-compressor-graphic">
                                <TransferCurve kind="compressor" amount={values.compressionClipAmount} />
                                <output data-role="polish-compressor-gain-reduction">
                                    <span>GAIN REDUCTION</span>
                                    <strong>{gainReductionDb.toFixed(1)} dB</strong>
                                </output>
                            </div>
                        )}
                        control={controls.comp}
                    />

                    <PolishStage
                        id="soft-clipper"
                        eyebrow="04 · PEAK FINISH"
                        title="Soft Clipper"
                        active={moduleActivity.comp}
                        copy="The same Comp Amount blends toward the accepted soft curve above −3 dBFS, rounding overs without a separate hidden control."
                        graphic={<TransferCurve kind="soft-clipper" amount={values.compressionClipAmount} />}
                    />

                    <PolishStage
                        id="output-trim"
                        eyebrow="05 · FINAL LEVEL"
                        title="Output Trim"
                        active={moduleActivity.outputTrim}
                        action={moduleActions.outputTrim}
                        copy={`Applies ${values.outputTrimDb > 0 ? "+" : ""}${values.outputTrimDb.toFixed(1)} dB after every other Polish stage.`}
                        graphic={(
                            <div className="polish-output-meters" data-role="polish-output-meters">
                                <OutputMeter label="PEAK" valueDbfs={meter.peakDbfs} />
                                <OutputMeter label="LOUDNESS · 400 ms" valueDbfs={meter.loudnessDbfs} />
                            </div>
                        )}
                        control={controls.outputTrim}
                        className="polish-fullscreen-stage-output"
                    />
                </div>
            </div>
        </div>
    );
}
