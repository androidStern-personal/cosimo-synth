import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, fmt } from "../design";

type BackgroundProps = {
  intensity?: number;
  captionOn?: boolean;
  variant?: "quiet" | "assembly" | "stack" | "hero" | "end";
};

const ribbonPath = (frame: number, yBase: number, amp: number, phase: number) => {
  const points: string[] = [];
  for (let i = 0; i <= 16; i += 1) {
    const x = (i / 16) * 2020 - 50;
    const y =
      yBase +
      Math.sin(i * 0.9 + frame * 0.025 + phase) * amp +
      Math.sin(i * 1.7 - frame * 0.012 + phase) * amp * 0.42;
    points.push(`${i === 0 ? "M" : "L"} ${fmt(x)} ${fmt(y)}`);
  }
  return points.join(" ");
};

const particles = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 269) % 1920,
  y: (i * 173) % 1080,
  speed: 0.45 + ((i * 7) % 17) / 12,
  len: 18 + ((i * 19) % 80),
  hue: i % 3,
}));

export const AbstractBackground = ({
  intensity = 0.35,
  captionOn = false,
  variant = "quiet",
}: BackgroundProps) => {
  const frame = useCurrentFrame();
  const damp = captionOn ? 0.7 : 1;
  const motionFrame = captionOn ? Math.floor(frame / 12) * 12 : frame;
  const hot =
    variant === "hero" ? COLORS.magenta : variant === "stack" ? COLORS.acid : COLORS.blue;
  const glow = interpolate(intensity, [0, 1], [0.18, 0.78]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background:
          `radial-gradient(circle at ${28 + Math.sin(frame * 0.011) * 8}% ${18 + Math.cos(frame * 0.015) * 6}%, rgba(0,179,204,${0.13 * intensity}), transparent 30%),` +
          `radial-gradient(circle at ${74 + Math.cos(frame * 0.009) * 5}% ${78 + Math.sin(frame * 0.017) * 7}%, rgba(255,79,216,${0.11 * intensity}), transparent 34%),` +
          `linear-gradient(120deg, ${COLORS.bg0}, ${COLORS.bg1} 52%, #07090D)`,
      }}
    >
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="ribbon-a" x1="0" x2="1" y1="0" y2="0">
            <stop stopColor={COLORS.cyan} stopOpacity={0} offset="0%" />
            <stop stopColor={COLORS.cyan} stopOpacity={0.56 * damp} offset="44%" />
            <stop stopColor={hot} stopOpacity={0.42 * damp} offset="74%" />
            <stop stopColor={hot} stopOpacity={0} offset="100%" />
          </linearGradient>
          <linearGradient id="ribbon-b" x1="0" x2="1" y1="0" y2="0">
            <stop stopColor={COLORS.gold} stopOpacity={0} offset="0%" />
            <stop stopColor={COLORS.gold} stopOpacity={0.32 * damp} offset="52%" />
            <stop stopColor={COLORS.acid} stopOpacity={0.22 * damp} offset="100%" />
          </linearGradient>
          <filter id="soft-glow">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        <path
          d={ribbonPath(motionFrame, 330, 88 + intensity * 46, 0)}
          fill="none"
          stroke="url(#ribbon-a)"
          strokeWidth={24 + intensity * 18}
          strokeLinecap="round"
          opacity={0.38 + glow * 0.5}
          filter="url(#soft-glow)"
        />
        <path
          d={ribbonPath(motionFrame, 760, 54 + intensity * 34, 2.7)}
          fill="none"
          stroke="url(#ribbon-b)"
          strokeWidth={12 + intensity * 14}
          strokeLinecap="round"
          opacity={0.16 + glow * 0.28}
        />
        {particles.map((p) => {
          const x = (p.x + motionFrame * p.speed * (1.4 + intensity)) % 2060 - 70;
          const y = p.y + Math.sin(frame * 0.018 + p.x) * 16;
          const color = p.hue === 0 ? COLORS.cyan : p.hue === 1 ? COLORS.magenta : COLORS.cream;
          return (
            <line
              key={`${p.x}-${p.y}`}
              x1={x}
              x2={x + p.len}
              y1={y}
              y2={y - p.len * 0.12}
              stroke={color}
              strokeWidth={1.4}
              strokeOpacity={(0.08 + intensity * 0.16) * damp}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.16 + intensity * 0.12,
          backgroundImage:
            "linear-gradient(rgba(239,234,224,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(239,234,224,0.05) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          maskImage: "radial-gradient(circle at 50% 48%, black, transparent 72%)",
        }}
      />
    </div>
  );
};
