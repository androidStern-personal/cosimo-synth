import { createStockControlsView } from "../../../ui/shared/stock-controls-view";
import definition from "../state";

export default createStockControlsView({
    definition,
    title: "Chorus Lab",
    description: "Every patch parameter as a Cmajor stock control. Knob turns, presets and snapshots share one Undo history.",
    css: `
        :host {
            --foreground: #f4efe6;
            --background: #0d0e13;
            --accent: #f0b867;
            --muted-text: rgba(244, 239, 230, 0.72);
            --heading-text: rgba(244, 239, 230, 0.74);
            min-height: 680px;
            background:
                radial-gradient(circle at top left, rgba(255, 214, 120, 0.18), transparent 34%),
                radial-gradient(circle at top right, rgba(108, 145, 255, 0.15), transparent 26%),
                linear-gradient(180deg, #17171d 0%, #0d0e13 100%);
        }
    `,
});
