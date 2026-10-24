import { createStockControlsView } from "../../../ui/shared/stock-controls-view";
import definition from "../state";

export default createStockControlsView({
    definition,
    title: "OTT Lab",
    description: "Standalone multiband upward/downward dynamics lab. Every patch parameter is a Cmajor stock control, so the DSP can be auditioned before synth integration.",
    css: `
        :host {
            --foreground: #eff7ee;
            --background: #070a09;
            --accent: #8ff0a4;
            --muted-text: rgba(239, 247, 238, 0.72);
            --heading-text: rgba(239, 247, 238, 0.74);
            min-height: 720px;
            background:
                radial-gradient(circle at 16% 6%, rgba(143, 240, 164, 0.19), transparent 30%),
                radial-gradient(circle at 86% 0%, rgba(255, 232, 132, 0.13), transparent 28%),
                linear-gradient(180deg, #111714 0%, #070a09 100%);
        }
        .title { gap: 12px; }
    `,
});
