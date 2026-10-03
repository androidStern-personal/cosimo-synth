import { useEffect, useMemo, useRef, useState } from "react";
import { advanceFilterSpectrumDisplayState, buildFilterSpectrumBands, buildFilterSpectrumDbTicks,
    buildFilterSpectrumFrequencyTicks, buildFilterSpectrumGraphPoints, buildFilterSpectrumRenderGeometry,
    createFilterSpectrumDisplayFrame, type FilterSpectrumRenderGeometry, type FilterSpectrumRenderMode,
    type FilterSpectrumDisplayState, type FilterSpectrumFrame } from "./filter-spectrum";

export type FilterSpectrum = { frame: FilterSpectrumFrame | null; renderMode?: FilterSpectrumRenderMode; timestampMs?: number };
function drawFilterSpectrumOverlay({
    canvas,
    width,
    height,
    geometry,
}: {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    geometry: FilterSpectrumRenderGeometry;
}) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scaledWidth = Math.max(1, Math.round(width * devicePixelRatio));
    const scaledHeight = Math.max(1, Math.round(height * devicePixelRatio));

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
    }

    const context = canvas.getContext("2d");

    if (!context) {
        return;
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const accentRgb = window.getComputedStyle(canvas).getPropertyValue("--filter-spectrum-rgb")
        .trim()
        .split(/\s+/)
        .map((component) => Number.parseInt(component, 10));
    const [accentR, accentG, accentB] = accentRgb.length === 3 && accentRgb.every(Number.isFinite)
        ? accentRgb
        : [169, 140, 255];
    const accentColor = (alpha: number) => `rgba(${accentR}, ${accentG}, ${accentB}, ${alpha})`;
    const gradient = context.createLinearGradient(0, geometry.plotTop, 0, geometry.plotBottom);
    gradient.addColorStop(0, accentColor(0.14));
    gradient.addColorStop(1, accentColor(0.00));

    if (geometry.kind === "graph") {
        if (geometry.points.length === 0) {
            return;
        }

        context.beginPath();
        context.moveTo(geometry.points[0].x, geometry.plotBottom);

        for (const point of geometry.points) {
            context.lineTo(point.x, point.y);
        }

        context.lineTo(geometry.points[geometry.points.length - 1].x, geometry.plotBottom);
        context.closePath();
        context.fillStyle = gradient;
        context.fill();

        context.beginPath();
        for (let index = 0; index < geometry.points.length; index += 1) {
            const point = geometry.points[index];
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        }
        context.strokeStyle = accentColor(0.64);
        context.lineWidth = 1.9;
        context.stroke();

        context.beginPath();
        for (let index = 0; index < geometry.peakPoints.length; index += 1) {
            const point = geometry.peakPoints[index];
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        }

        context.strokeStyle = accentColor(0.30);
        context.lineWidth = 1;
        context.stroke();
        return;
    }

    const drawBarPath = (x: number, y: number, barWidth: number, barHeight: number, radius: number) => {
        const right = x + barWidth;
        const bottom = y + barHeight;
        const safeRadius = Math.max(0, Math.min(radius, barWidth * 0.5, barHeight * 0.5));
        context.beginPath();
        context.moveTo(x, bottom);
        context.lineTo(x, y + safeRadius);
        if (safeRadius > 0) {
            context.quadraticCurveTo(x, y, x + safeRadius, y);
            context.lineTo(right - safeRadius, y);
            context.quadraticCurveTo(right, y, right, y + safeRadius);
        } else {
            context.lineTo(x, y);
            context.lineTo(right, y);
        }
        context.lineTo(right, bottom);
        context.closePath();
    };

    for (const bar of geometry.bars) {
        if (bar.height <= 0 || bar.width <= 0) {
            continue;
        }

        drawBarPath(bar.x, bar.y, bar.width, bar.height, bar.radius);
        context.fillStyle = gradient;
        context.fill();
        context.strokeStyle = accentColor(0.56);
        context.lineWidth = geometry.rounded ? 1.45 : 1.1;
        context.stroke();
    }

    context.beginPath();
    for (const peakBar of geometry.peakBars) {
        if (peakBar.width <= 0) {
            continue;
        }

        const centerX = peakBar.x + (peakBar.width * 0.5);
        const halfWidth = Math.min(5, peakBar.width * 0.45);
        context.moveTo(centerX - halfWidth, peakBar.y);
        context.lineTo(centerX + halfWidth, peakBar.y);
    }
    context.strokeStyle = accentColor(0.32);
    context.lineWidth = 1;
    context.stroke();
}

export function useFilterSpectrum(spectrum: FilterSpectrum | null, size: { width: number; height: number }, plot: { plotLeft: number; plotRight: number; plotTop: number; plotBottom: number; plotWidth: number; plotHeight: number }) {
    const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const spectrumFrame = spectrum?.frame ?? null;
    const spectrumRenderMode = spectrum?.renderMode ?? "graph";
    const timestampMs = spectrum?.timestampMs;
    const spectrumBands = useMemo(() => buildFilterSpectrumBands(), []);
    const spectrumGraphPoints = useMemo(() => buildFilterSpectrumGraphPoints(), []);
    const spectrumFrequencyTicks = useMemo(() => buildFilterSpectrumFrequencyTicks(), []);
    const spectrumDbTicks = useMemo(() => buildFilterSpectrumDbTicks(), []);
    const [spectrumDisplay, setSpectrumDisplay] = useState<FilterSpectrumDisplayState | null>(null);

    useEffect(() => {
        const nextFrame = createFilterSpectrumDisplayFrame({
            frame: spectrumFrame,
            bands: spectrumBands,
            graphPoints: spectrumGraphPoints,
        });

        if (!nextFrame) {
            setSpectrumDisplay(null);
            return;
        }

        setSpectrumDisplay((previousState) => (
            advanceFilterSpectrumDisplayState(previousState, nextFrame, timestampMs ?? performance.now())
        ));
    }, [spectrumBands, spectrumFrame, spectrumGraphPoints, timestampMs]);

    const spectrumGeometry = useMemo(() => (
        spectrumDisplay
            ? buildFilterSpectrumRenderGeometry({
                renderMode: spectrumRenderMode,
                width: size.width,
                height: size.height,
                displayState: spectrumDisplay,
                plot,
            })
            : null
    ), [size.height, size.width, spectrumDisplay, spectrumRenderMode, plot]);

    useEffect(() => {
        const canvas = spectrumCanvasRef.current;

        if (!canvas) {
            return;
        }

        let animationFrameID = window.requestAnimationFrame(() => {
            if (!spectrumGeometry) {
                const context = canvas.getContext("2d");
                if (context) {
                    context.setTransform(1, 0, 0, 1, 0, 0);
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }
                return;
            }

            drawFilterSpectrumOverlay({
                canvas,
                width: size.width,
                height: size.height,
                geometry: spectrumGeometry,
            });
        });

        return () => {
            window.cancelAnimationFrame(animationFrameID);
        };
    }, [size.height, size.width, spectrumGeometry]);

    return { spectrumCanvasRef, spectrumDisplay, spectrumGeometry, spectrumBands,
        spectrumGraphPoints, spectrumFrequencyTicks, spectrumDbTicks, spectrumRenderMode };
}
