import { type CaptureLayoutPx } from "./measurePanels";

type DebugPanelOverlayProps = {
    layout: CaptureLayoutPx;
};

export function DebugPanelOverlay({ layout }: DebugPanelOverlayProps) {
    return (
        <div
            aria-hidden="true"
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 6,
            }}
        >
            {layout.panels.map((panel) => (
                <div
                    key={panel.id}
                    style={{
                        position: "absolute",
                        left: `${panel.x}px`,
                        top: `${panel.y}px`,
                        width: `${panel.width}px`,
                        height: `${panel.height}px`,
                        border: "1px solid rgba(0, 255, 255, 0.75)",
                        background: "rgba(0, 255, 255, 0.05)",
                        color: "#e6fbff",
                        font: "11px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            left: 4,
                            top: 4,
                            background: "rgba(0, 8, 18, 0.82)",
                            border: "1px solid rgba(0, 255, 255, 0.45)",
                            borderRadius: 4,
                            padding: "1px 5px",
                            fontSize: 10,
                        }}
                    >
                        {panel.id} ({Math.round(panel.x)}, {Math.round(panel.y)})
                    </div>
                </div>
            ))}
        </div>
    );
}
