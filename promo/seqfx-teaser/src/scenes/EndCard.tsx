import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, EFFECTS, EffectKey, easeOut, progress, tempoFrames } from "../design";

const effects: EffectKey[] = ["tape", "stutter", "crusher", "filter"];
const finalCardLabels: Partial<Record<EffectKey, string>> = {
  crusher: "Bitcrush",
};
const recursiveWords = ["EFFECTS OF", "EFFECTS OF", "EFFECTS OF", "EFFECTS."] as const;

export const EndCard = () => {
  const frame = useCurrentFrame();
  const title = progress(frame, -tempoFrames(4), tempoFrames(10), easeOut);
  const recursive = progress(frame, tempoFrames(14), tempoFrames(54), easeOut);
  const taglineA = progress(frame, tempoFrames(50), tempoFrames(62), easeOut);
  const taglineB = progress(frame, tempoFrames(54), tempoFrames(66), easeOut);
  const tile = progress(frame, tempoFrames(8), tempoFrames(30), easeOut);
  const collapse = progress(frame, 0, tempoFrames(14), easeOut);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 46%, rgba(239,234,224,0.08), transparent 30%), linear-gradient(rgba(8,11,16,0.22), rgba(8,11,16,0.9))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 242,
          display: "grid",
          justifyItems: "center",
          opacity: title,
          transform: `translateY(${interpolate(title, [0, 1], [28, 0])}px) scale(${interpolate(collapse, [0, 1], [1.18, 1])})`,
        }}
      >
        <div
          style={{
            color: COLORS.cream,
            fontSize: 154,
            fontWeight: 950,
            letterSpacing: "0.02em",
            textShadow: "0 0 46px rgba(0,179,204,0.25)",
          }}
        >
          SEQFX
        </div>
        <div
          className="caption"
          style={{
            position: "relative",
            marginTop: 34,
            width: 1480,
            height: 96,
            color: COLORS.cream,
            fontSize: 48,
            lineHeight: 0.94,
            opacity: recursive,
          }}
        >
          {recursiveWords.map((word, i) => {
            const wordIn = progress(frame, tempoFrames(16 + i * 8), tempoFrames(25 + i * 8), easeOut);
            const tunnel = progress(frame, tempoFrames(48), tempoFrames(72), easeOut);
            const x = interpolate(wordIn, [0, 1], [-120, 64]) + i * 340 - tunnel * i * 14;
            const y = interpolate(wordIn, [0, 1], [30, 0]) + tunnel * Math.sin(i * 1.4) * 9;
            const scale = interpolate(wordIn, [0, 1], [1.18, 1]) * (1 - tunnel * i * 0.055);
            return (
              <span
                key={`${word}-${i}`}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  color: i % 2 === 0 ? COLORS.tape : COLORS.stutter,
                  opacity: wordIn,
                  transform: `translate(${x}px, ${y}px) scale(${scale}) rotateZ(${interpolate(wordIn, [0, 1], [i % 2 === 0 ? -2 : 2, 0])}deg)`,
                  transformOrigin: "50% 50%",
                  textShadow:
                    i % 2 === 0
                      ? "0 0 28px rgba(152,193,217,0.28)"
                      : "0 0 28px rgba(181,217,156,0.3)",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div
          className="caption"
          style={{
            marginTop: 30,
            color: COLORS.cream,
            fontSize: 46,
            lineHeight: 1,
            opacity: 1,
            textAlign: "center",
          }}
        >
          <span style={{ opacity: taglineA }}>IN ANY ORDER.</span>
          <span style={{ display: "inline-block", width: 30 }} />
          <span style={{ opacity: taglineB }}>ON ANY STEP.</span>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 54, opacity: tile }}>
          {effects.map((effect, i) => {
            const info = EFFECTS[effect];
            return (
              <div key={`${effect}-${i}`} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
                <div
                  className="mono"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 168,
                    height: 66,
                    borderRadius: 7,
                    background: info.color,
                    color: "rgba(8,11,16,0.74)",
                    fontSize: 20,
                    fontWeight: 950,
                    letterSpacing: "0.12em",
                    boxShadow: `0 0 ${18 + Math.sin(frame * 0.05 + i) * 4}px ${info.color}66`,
                    transform: `translateY(${interpolate(tile, [0, 1], [28 + i * 6, 0])}px)`,
                  }}
                >
                  {(finalCardLabels[effect] ?? info.label).toUpperCase()}
                </div>
                <div
                  className="mono"
                  style={{
                    color: "rgba(239,234,224,0.58)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                  }}
                >
                  CHAIN {i + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
