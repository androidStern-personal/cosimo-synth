import { useId, type ReactNode } from "react";

import {
    getOscillatorControlAddress,
    type OscillatorBindingContract,
    type OscillatorSelectionViewModel,
} from "../shared/oscillator-binding";

type DesktopOscillatorConnectionContext = "stage" | "controls";

type DesktopOscillatorConnectionBoundaryProps = {
    readonly connectedOscillatorAContent: ReactNode;
    readonly context: DesktopOscillatorConnectionContext;
    readonly pendingClassName?: string;
    readonly selectedOscillator: OscillatorBindingContract;
};

type DesktopOscillatorPresentationProps = {
    readonly connectedOscillatorAStage: ReactNode;
    readonly pendingStageClassName?: string;
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

function PendingOscillatorConnection({
    context,
    pendingClassName,
    selectedOscillator,
}: {
    readonly context: DesktopOscillatorConnectionContext;
    readonly pendingClassName?: string;
    readonly selectedOscillator: OscillatorBindingContract;
}) {
    const oscillatorID = selectedOscillator.id;
    const detail = context === "stage"
        ? `Oscillator ${oscillatorID}'s independent table and sound controls are not connected to the synth engine yet.`
        : `Oscillator ${oscillatorID}'s sound and articulation editing are not connected to the synth engine yet.`;

    return (
        <section
            data-role="desktop-oscillator-connection-pending"
            data-oscillator-id={oscillatorID}
            data-connection-context={context}
            data-section-accent="cyan"
            className={pendingClassName ?? "min-h-[158px]"}
            aria-label={`Oscillator ${oscillatorID} controls pending synth connection`}
        >
            <div className="grid h-full min-h-[inherit] place-content-center gap-3 rounded-[18px] border border-cyan-200/10 bg-cyan-300/[0.025] px-6 py-12 text-center">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-100/85">
                    Oscillator {oscillatorID}
                </div>
                <p className="mx-auto max-w-[480px] text-[11px] leading-relaxed text-slate-300/65" role="status">
                    {detail}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-300/60">
                    <span data-role="desktop-oscillator-table-identity" className="rounded-full border border-white/[0.07] bg-black/20 px-2 py-1">
                        Table {oscillatorID}
                    </span>
                    <span data-role="desktop-oscillator-modulation-identity" className="rounded-full border border-white/[0.07] bg-black/20 px-2 py-1">
                        Modulation {oscillatorID}
                    </span>
                    <span data-role="desktop-oscillator-articulation-identity" className="rounded-full border border-white/[0.07] bg-black/20 px-2 py-1">
                        Articulation {oscillatorID}
                    </span>
                </div>
            </div>
        </section>
    );
}

/**
 * Prevents the unconnected B/C tabs from falling through to today's legacy
 * oscillator-A controls while retaining their exact future product addresses.
 */
export function DesktopOscillatorConnectionBoundary({
    connectedOscillatorAContent,
    context,
    pendingClassName,
    selectedOscillator,
}: DesktopOscillatorConnectionBoundaryProps) {
    const addressMetadata = projectedAddressMetadata(selectedOscillator);
    const isLegacyOscillatorAConnected = selectedOscillator.id === "A";

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
            data-product-wiring={isLegacyOscillatorAConnected ? "legacy-a-only" : "indexed-host-pending"}
            className="min-w-0"
        >
            {isLegacyOscillatorAConnected ? connectedOscillatorAContent : (
                <PendingOscillatorConnection
                    context={context}
                    pendingClassName={pendingClassName}
                    selectedOscillator={selectedOscillator}
                />
            )}
        </div>
    );
}

/**
 * Desktop-owned A/B/C tab assembly. Selection is presentation state supplied
 * by the shared binding view model and never enters patch or host state.
 */
export function DesktopOscillatorPresentation({
    connectedOscillatorAStage,
    pendingStageClassName,
    selection,
}: DesktopOscillatorPresentationProps) {
    const panelID = useId();

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
                {selection.options.map((oscillator) => {
                    const isSelected = selection.selectedOscillatorID === oscillator.id;

                    return (
                        <button
                            key={oscillator.id}
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
                    connectedOscillatorAContent={connectedOscillatorAStage}
                    context="stage"
                    pendingClassName={pendingStageClassName}
                    selectedOscillator={selection.selectedOscillator}
                />
            </div>
        </div>
    );
}
