import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, easeOut } from "../design";

type CopyProps = {
  children: React.ReactNode;
  from: number;
  to: number;
  x?: number;
  y?: number;
  align?: "left" | "right" | "center";
  size?: number;
  maxWidth?: number;
};

export const Copy = ({
  children,
  from,
  to,
  x = 96,
  y = 96,
  align = "left",
  size = 64,
  maxWidth = 1100,
}: CopyProps) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [from, from + 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const exit = interpolate(frame, [to - 4, to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(enter, exit);
  const translate = interpolate(enter, [0, 1], [18, 0]);
  const blur = interpolate(enter, [0, 1], [18, 0]);

  return (
    <div
      className="caption"
      style={{
        position: "absolute",
        left: align === "right" ? undefined : x,
        right: align === "right" ? 96 : undefined,
        top: y,
        width: maxWidth,
        color: COLORS.cream,
        fontSize: size,
        lineHeight: 0.94,
        opacity,
        textAlign: align,
        filter: `blur(${blur}px)`,
        transform: `translateY(${translate}px)`,
      }}
    >
      {children}
    </div>
  );
};
