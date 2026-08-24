import { Audio } from "@remotion/media";
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const SPIKE_DURATION_SECONDS = 10;
export const SPIKE_FPS = 30;
export const SPIKE_DURATION_FRAMES = SPIKE_DURATION_SECONDS * SPIKE_FPS;
export const SPIKE_WIDTH = 640;
export const SPIKE_HEIGHT = 360;

export type RendererSpikeProps = {
    readonly masterAudioUrl: string;
};

function WavetableCanvas({ frame }: { readonly frame: number }): React.JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) {
            return;
        }
        const width = canvas.width;
        const height = canvas.height;
        const phase = (frame / SPIKE_FPS) * Math.PI * 1.6;
        const morph = 0.35 + 0.25 * Math.sin(frame / 37);

        context.clearRect(0, 0, width, height);
        const gradient = context.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#14263a");
        gradient.addColorStop(1, "#26143c");
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        context.strokeStyle = "rgba(116, 232, 222, 0.2)";
        context.lineWidth = 1;
        for (let row = 1; row < 4; row += 1) {
            const y = (row / 4) * height;
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(width, y);
            context.stroke();
        }
        context.strokeStyle = "#7ce9de";
        context.lineWidth = 4;
        context.beginPath();
        for (let x = 0; x <= width; x += 2) {
            const normalized = x / width;
            const sine = Math.sin(normalized * Math.PI * 8 + phase);
            const folded = Math.asin(Math.sin(normalized * Math.PI * 4 - phase * 0.4)) / (Math.PI / 2);
            const y = height * 0.5 - (sine * (1 - morph) + folded * morph) * height * 0.28;
            if (x === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
        }
        context.stroke();
    }, [frame]);

    return (
        <canvas
            ref={canvasRef}
            width={380}
            height={118}
            style={{ border: "1px solid #31526a", borderRadius: 14, height: 118, width: 380 }}
        />
    );
}

function AnimatedKnob({ frame }: { readonly frame: number }): React.JSX.Element {
    const normalized = interpolate(frame, [0, SPIKE_DURATION_FRAMES - 1], [0.08, 0.94]);
    const angle = 225 + normalized * 270;
    const radians = angle * Math.PI / 180;
    const x = 50 + Math.cos(radians) * 34;
    const y = 50 + Math.sin(radians) * 34;
    return (
        <svg width="112" height="112" viewBox="-6 -6 112 112" aria-label="Animated parameter knob">
            <defs>
                <linearGradient id="knob-face" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#31394b" />
                    <stop offset="1" stopColor="#161a25" />
                </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="#11151e" stroke="#4e5b72" strokeWidth="2" />
            <circle cx="50" cy="50" r="38" fill="url(#knob-face)" stroke="#a771d3" strokeWidth="3" />
            <path
                d="M 22 76 A 39 39 0 1 1 78 76"
                fill="none"
                stroke="#5fe0d5"
                strokeDasharray={`${normalized * 184} 184`}
                strokeLinecap="round"
                strokeWidth="5"
            />
            <line x1="50" y1="50" x2={x} y2={y} stroke="#f4eaff" strokeLinecap="round" strokeWidth="4" />
            <circle cx="50" cy="50" r="5" fill="#f4eaff" />
        </svg>
    );
}

export function RendererSpikeComposition({ masterAudioUrl }: RendererSpikeProps): React.JSX.Element {
    const frame = useCurrentFrame();
    const second = Math.min(9, Math.floor(frame / SPIKE_FPS));
    const captions = [
        "INIT", "Shape oscillator A", "Sweep wavetable", "Bend warp", "Tune voices",
        "Open the filter", "Add movement", "Route the MSEG", "Polish the FX", "COSIMO",
    ];

    return (
        <AbsoluteFill
            style={{
                alignItems: "center",
                background: "linear-gradient(145deg, #090b13 0%, #171027 55%, #071b22 100%)",
                color: "#f7efff",
                display: "flex",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                justifyContent: "center",
            }}
        >
            <Audio src={masterAudioUrl} />
            <div style={{ alignItems: "center", display: "flex", gap: 34 }}>
                <AnimatedKnob frame={frame} />
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <WavetableCanvas frame={frame} />
                    <div
                        style={{
                            background: "linear-gradient(90deg, #24152f, #102c32)",
                            border: "1px solid #76518d",
                            borderRadius: 12,
                            color: "#d9fcf8",
                            fontSize: 20,
                            letterSpacing: 2,
                            padding: "12px 18px",
                            textTransform: "uppercase",
                        }}
                    >
                        {String(second + 1).padStart(2, "0")} · {captions[second]}
                    </div>
                </div>
            </div>
            <div style={{ bottom: 20, color: "#97a9bd", fontSize: 12, position: "absolute" }}>
                SVG · CANVAS · TEXT · BLOB-URL WAV
            </div>
        </AbsoluteFill>
    );
}
