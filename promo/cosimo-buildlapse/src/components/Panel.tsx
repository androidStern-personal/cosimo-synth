import React, { CSSProperties, ReactNode } from "react";
import { COLORS, MONO, Rect } from "../design";

// A positioned, bordered region with an optional corner label.
// Bounding box and opacity are interpolated by the parent and passed in,
// so transitions are entirely controlled by the composition layer.

type Props = {
  rect: Rect;
  opacity: number;
  /** Border + label opacity. Defaults to `opacity`. Allows fading the chrome
   * independently from the panel body — used for the hero whose body should
   * stay visible at full opacity while its border fades out at fullscreen. */
  chromeOpacity?: number;
  label?: string;
  index?: string;
  children: ReactNode;
};

export const Panel: React.FC<Props> = ({
  rect,
  opacity,
  chromeOpacity,
  label,
  index,
  children,
}) => {
  const chromeAlpha = chromeOpacity ?? opacity;
  const containerStyle: CSSProperties = {
    position: "absolute",
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    opacity,
    overflow: "hidden",
    background: COLORS.bgPanel,
  };

  const innerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
  };

  const borderStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    border: `1px solid ${COLORS.border}`,
    pointerEvents: "none",
    opacity: chromeAlpha,
  };

  const labelBarStyle: CSSProperties = {
    position: "absolute",
    top: 12,
    left: 14,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 1.2,
    color: COLORS.label,
    textTransform: "uppercase",
    pointerEvents: "none",
    display: "flex",
    gap: 18,
    alignItems: "center",
    opacity: chromeAlpha,
  };

  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: COLORS.borderHi,
  };

  const indexStyle: CSSProperties = {
    fontFamily: MONO,
    fontSize: 11,
    color: COLORS.labelDim,
  };

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>{children}</div>
      {chromeAlpha > 0.01 && <div style={borderStyle} />}
      {chromeAlpha > 0.01 && label && (
        <div style={labelBarStyle}>
          <div style={dotStyle} />
          <span>{label}</span>
          {index && <span style={indexStyle}>{index}</span>}
        </div>
      )}
    </div>
  );
};
