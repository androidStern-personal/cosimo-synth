import { useId, useRef, type ReactNode } from "react";

import {
    getOscillatorControlAddress,
    type OscillatorBindingContract,
    type OscillatorSelectionViewModel,
} from "../shared/oscillator-binding";

type DesktopOscillatorConnectionBoundaryProps = {
    readonly content: ReactNode;
    readonly selectedOscillator: OscillatorBindingContract;
};

type DesktopOscillatorPresentationProps = {
    readonly selectedOscillatorStage: ReactNode;
    readonly selection: OscillatorSelectionViewModel;
};

function projectedAddressMetadata(selectedOscillator: OscillatorBindingContract) {
    return {
        articulationTargetIDs: selectedOscillator.articulationParameterIDs.join(" "),
        controlEndpointIDs: selectedOscillator.controls
            .filter((control) => control.controlID !== "wavetableSelect")
            .map((control) => control.endpointID)
            .join(" "),
        modulationTargetIDs: selectedOscillator.modulationTargets
            .map((target) => target.uiTargetID)
            .join(" "),
        tableEndpointID: getOscillatorControlAddress(selectedOscillator.id, "wavetableSelect").endpointID,
    };
}

/** Adds observable identity metadata around the selected live oscillator. */
export function DesktopOscillatorConnectionBoundary({
    content,
    selectedOscillator,
}: DesktopOscillatorConnectionBoundaryProps) {
    const addressMetadata = projectedAddressMetadata(selectedOscillator);

    return (
        <div
            data-role="desktop-oscillator-connection-boundary"
            data-oscillator-id={selectedOscillator.id}
            data-oscillator-index={selectedOscillator.oscillatorIndex}
            data-table-status-endpoint-id={selectedOscillator.tableStatus.endpointID}
            data-table-status-index={selectedOscillator.tableStatus.oscillatorIndex}
            data-projected-table-endpoint-id={addressMetadata.tableEndpointID}
            data-projected-sound-endpoint-ids={addressMetadata.controlEndpointIDs}
            data-projected-modulation-target-ids={addressMetadata.modulationTargetIDs}
            data-projected-articulation-target-ids={addressMetadata.articulationTargetIDs}
            data-product-wiring="abc-live"
            className="min-w-0"
        >
            {content}
        </div>
    );
}

/**
 * Desktop-owned A/B/C tab assembly. Selection is presentation state supplied
 * by the shared binding view model and never enters patch or host state.
 */
export function DesktopOscillatorPresentation({
    selectedOscillatorStage,
    selection,
}: DesktopOscillatorPresentationProps) {
    const panelID = useId();
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

    return (
        <div
            data-role="desktop-oscillator-presentation"
            data-selected-oscillator-id={selection.selectedOscillatorID}
            className="relative min-w-0"
        >
            <div
                data-role="desktop-oscillator-tabs"
                className="absolute left-1/2 top-3 z-20 flex h-5 -translate-x-1/2 items-center rounded-[5px] border border-white/[0.08] bg-black/55 p-px shadow-lg backdrop-blur-sm"
                role="tablist"
                aria-label="Oscillator"
            >
                {selection.options.map((oscillator, oscillatorIndex) => {
                    const isSelected = selection.selectedOscillatorID === oscillator.id;

                    return (
                        <button
                            key={oscillator.id}
                            ref={(element) => {
                                tabRefs.current[oscillatorIndex] = element;
                            }}
                            id={`${panelID}-tab-${oscillator.id}`}
                            type="button"
                            role="tab"
                            aria-controls={panelID}
                            aria-label={`Oscillator ${oscillator.id}`}
                            aria-selected={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            data-role={`oscillator-tab-${oscillator.id.toLowerCase()}`}
                            data-oscillator-id={oscillator.id}
                            className={`h-[16px] min-w-5 rounded-[4px] px-1 text-[8px] font-semibold ${
                                isSelected
                                    ? "bg-cyan-300/20 text-cyan-100"
                                    : "text-slate-300/55 hover:text-slate-100"
                            }`}
                            onClick={() => selection.selectOscillator(oscillator.id)}
                            onKeyDown={(event) => {
                                const finalIndex = selection.options.length - 1;
                                let nextIndex: number | undefined;

                                switch (event.key) {
                                    case "ArrowLeft":
                                        nextIndex = oscillatorIndex === 0 ? finalIndex : oscillatorIndex - 1;
                                        break;
                                    case "ArrowRight":
                                        nextIndex = oscillatorIndex === finalIndex ? 0 : oscillatorIndex + 1;
                                        break;
                                    case "Home":
                                        nextIndex = 0;
                                        break;
                                    case "End":
                                        nextIndex = finalIndex;
                                        break;
                                    default:
                                        return;
                                }

                                event.preventDefault();
                                const nextOscillator = selection.options[nextIndex];
                                selection.selectOscillator(nextOscillator.id);
                                tabRefs.current[nextIndex]?.focus();
                            }}
                        >
                            {oscillator.id}
                        </button>
                    );
                })}
            </div>

            <div
                id={panelID}
                role="tabpanel"
                aria-labelledby={`${panelID}-tab-${selection.selectedOscillatorID}`}
                className="min-w-0"
            >
                <DesktopOscillatorConnectionBoundary
                    content={selectedOscillatorStage}
                    selectedOscillator={selection.selectedOscillator}
                />
            </div>
        </div>
    );
}
