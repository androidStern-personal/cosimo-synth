import { useRef } from "react";
import { createRoot } from "react-dom/client";

import "../../ui/desktop/styles.css";
import {
    DesktopOscillatorPresentation,
} from "../../ui/desktop/desktop-oscillator-presentation";
import { useOscillatorSelectionViewModel } from "../../ui/shared/synth-hooks";
import { WavetableStageSection } from "../../ui/shared/synth-components";

declare global {
    interface Window {
        __COSIMO_DESKTOP_OSCILLATOR_HARNESS__?: {
            readonly getConnectedActionCount: () => number;
        };
    }
}

/** Mount the desktop oscillator selector around one observable legacy-A surface. */
export function installDesktopOscillatorPresentationHarness(target: HTMLElement): void {
    let connectedActionCount = 0;

    function Harness() {
        const selection = useOscillatorSelectionViewModel();
        const stageRef = useRef<HTMLDivElement | null>(null);

        return (
            <DesktopOscillatorPresentation
                selection={selection}
                pendingStageClassName="min-h-[220px]"
                connectedOscillatorAStage={(
                    <WavetableStageSection
                        stageRef={stageRef}
                        frames={null}
                        position={0.5}
                        warpMode={0}
                        warpAmount={0}
                        tableName="Basic Shapes"
                        pendingTableName={null}
                        frameCount={128}
                        desiredTableIndex={0}
                        tableOptions={[
                            { name: "Basic Shapes", frameCount: 128 },
                            { name: "Acid", frameCount: 128 },
                        ]}
                        canRetry={false}
                        onTableChange={() => {
                            connectedActionCount += 1;
                        }}
                        onTablePrewarm={() => {}}
                        onRetry={() => {}}
                        tableFocusBindings={{}}
                        onPointerDown={() => {}}
                        onPointerMove={() => {}}
                        onPointerUp={() => {}}
                        className="min-h-[220px]"
                    />
                )}
            />
        );
    }

    createRoot(target).render(<Harness />);
    window.__COSIMO_DESKTOP_OSCILLATOR_HARNESS__ = {
        getConnectedActionCount: () => connectedActionCount,
    };
}
