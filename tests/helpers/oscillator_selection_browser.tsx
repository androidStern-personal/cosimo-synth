import { createRoot } from "react-dom/client";

import { useOscillatorSelectionViewModel } from "../../ui/shared/synth-hooks";
import type { OscillatorID } from "../../ui/shared/modulation-targets";

type OscillatorSelectionSnapshot = {
    readonly selectedOscillatorID: OscillatorID;
    readonly oscillatorIndex: number;
    readonly optionIDs: ReadonlyArray<OscillatorID>;
};

declare global {
    interface Window {
        __COSIMO_OSCILLATOR_SELECTION_HARNESS__?: {
            getSnapshot: () => OscillatorSelectionSnapshot | null;
            projectPanWrite: (value: number) => unknown;
        };
    }
}

/** Mount the focused shared-selection proof without a patch connection. */
export function installOscillatorSelectionHarness(target: HTMLElement): void {
    let snapshot: OscillatorSelectionSnapshot | null = null;
    let projectPanWrite: ((value: number) => unknown) | null = null;

    function Harness() {
        const selection = useOscillatorSelectionViewModel();
        projectPanWrite = (value) => selection.projectControlWrite("pan", value);
        snapshot = {
            selectedOscillatorID: selection.selectedOscillatorID,
            oscillatorIndex: selection.selectedOscillator.oscillatorIndex,
            optionIDs: selection.options.map((option) => option.id),
        };

        return (
            <div>
                {selection.options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        data-oscillator-id={option.id}
                        aria-pressed={selection.selectedOscillatorID === option.id}
                        onClick={() => selection.selectOscillator(option.id)}
                    >
                        {option.id}
                    </button>
                ))}
            </div>
        );
    }

    createRoot(target).render(<Harness />);
    window.__COSIMO_OSCILLATOR_SELECTION_HARNESS__ = {
        getSnapshot: () => snapshot,
        projectPanWrite: (value) => {
            if (projectPanWrite === null) throw new Error("Oscillator selection harness has not rendered");
            return projectPanWrite(value);
        },
    };
}
