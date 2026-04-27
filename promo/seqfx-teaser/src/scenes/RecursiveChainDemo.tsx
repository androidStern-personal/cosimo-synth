import React, { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  RealSeqFxBlockPill,
  SEQFX_UI_BASE_HEIGHT,
  SEQFX_UI_BASE_WIDTH,
  SeqFxUi,
  createRecursiveSeqFxPromoStateForBlocks,
  type RecursiveSeqFxPromoBlockSpec,
} from "../components/SeqFxUi";
import {
  BEAT,
  COLORS,
  EFFECTS,
  EffectKey,
  bar,
  beat,
  easeInOut,
  easeOut,
  fmt,
  overshoot,
  progress,
  pulse,
  tempoFrames,
} from "../design";

type RecursiveBlock = {
  id: string;
  effect: Extract<EffectKey, "tape" | "stutter">;
  lane: number;
  startStep: number;
  dropFrame: number;
};

type ScriptToken = {
  text: string;
  effect?: Extract<EffectKey, "tape" | "stutter">;
  small?: boolean;
  lineBreakBefore?: boolean;
};

type ScriptLine = {
  from: number;
  to: number;
  tokens: ScriptToken[];
  chain: Array<Extract<EffectKey, "tape" | "stutter">>;
  size: number;
};

const UI_LEFT = 225;
const UI_TOP = 300;
const UI_SCALE = 0.91;

const GRID = (() => {
  const workspaceMarginX = 18;
  const workspaceGap = 16;
  const gridColumnShare = 1.22 / (1.22 + 0.9);
  const gridShellWidth = (SEQFX_UI_BASE_WIDTH - workspaceMarginX * 2 - workspaceGap) * gridColumnShare;
  const gridShellPaddingX = 32;
  const gridTrackWidth = gridShellWidth - gridShellPaddingX * 2;
  const normalGap = 3;
  const beatGap = 9;
  const rowSteps = 16;
  const totalGaps = normalGap * 12 + beatGap * 3;
  const cell = (gridTrackWidth - totalGaps) / rowSteps;
  const laneGap = 6;

  const gapAfterStep = (step: number) => ((step + 1) % 4 === 0 ? beatGap : normalGap);
  const xForStep = (step: number) => {
    const localStep = Math.max(0, Math.min(rowSteps, step % rowSteps));
    let x = workspaceMarginX + gridShellPaddingX;
    for (let i = 0; i < localStep; i += 1) {
      x += cell + gapAfterStep(i);
    }
    return x;
  };

  return {
    top: 96,
    lane: cell + laneGap,
    blockHeight: cell,
    blockLength: 4,
    xForStep,
  };
})();

const TIMING = {
  prerollEnd: bar(2),
  tapeDrop1: bar(3),
  stutterDrop1: bar(4),
  tapeDrop2: bar(5),
  stutterDrop2: bar(6),
  fixedChain: bar(7),
  rebuild: bar(8) + beat(2),
  sceneEnd: bar(10),
} as const;

const blocks: RecursiveBlock[] = [
  { id: "tape-1", effect: "tape", lane: 0, startStep: 0, dropFrame: TIMING.tapeDrop1 },
  { id: "stutter-1", effect: "stutter", lane: 1, startStep: 2, dropFrame: TIMING.stutterDrop1 },
  { id: "tape-2", effect: "tape", lane: 2, startStep: 4, dropFrame: TIMING.tapeDrop2 },
  { id: "stutter-2", effect: "stutter", lane: 3, startStep: 6, dropFrame: TIMING.stutterDrop2 },
];

const scriptLines: ScriptLine[] = [
  {
    from: TIMING.prerollEnd,
    to: beat(13),
    tokens: [
      { text: "TAPE STOP", effect: "tape" },
      { text: "THE BEAT.", small: true },
    ],
    chain: ["tape"],
    size: 92,
  },
  {
    from: beat(13),
    to: beat(18),
    tokens: [
      { text: "NOW", small: true },
      { text: "STUTTER", effect: "stutter" },
      { text: "THE", small: true },
      { text: "TAPE STOP.", effect: "tape" },
    ],
    chain: ["tape", "stutter"],
    size: 78,
  },
  {
    from: beat(18),
    to: beat(22),
    tokens: [
      { text: "TAPE STOP", effect: "tape" },
      { text: "THE", small: true },
      { text: "STUTTER", effect: "stutter" },
      { text: "OF THE", small: true },
      { text: "TAPE STOP.", effect: "tape" },
    ],
    chain: ["tape", "stutter", "tape"],
    size: 62,
  },
  {
    from: beat(22),
    to: TIMING.fixedChain,
    tokens: [
      { text: "NOW", small: true },
      { text: "STUTTER", effect: "stutter" },
      { text: "THE TAPE-STOP", effect: "tape" },
      { text: "OF THE STUTTER", effect: "stutter", lineBreakBefore: true },
      { text: "OF THE TAPE STOP.", effect: "tape" },
    ],
    chain: ["tape", "stutter", "tape", "stutter"],
    size: 48,
  },
];

const blockRect = (block: RecursiveBlock) => ({
  x: GRID.xForStep(block.startStep),
  y: GRID.top + block.lane * GRID.lane,
  width: GRID.xForStep(block.startStep + GRID.blockLength) - GRID.xForStep(block.startStep),
  height: GRID.blockHeight,
});

const landingDurationForBlock = (block: RecursiveBlock) =>
  tempoFrames(block.effect === "stutter" ? 15 : 22);
const landingEndFrame = (block: RecursiveBlock) => block.dropFrame - BEAT;
const flyStartFrame = (block: RecursiveBlock) => landingEndFrame(block) - landingDurationForBlock(block);
const commitStartFrame = (block: RecursiveBlock) => block.dropFrame - tempoFrames(12);
const commitEndFrame = (block: RecursiveBlock) => block.dropFrame;
const downbeatIn = (frame: number, from: number, to: number) =>
  frame >= from ? Math.max(0.18, progress(frame, from, to, easeOut)) : 0;

const blockToStateSpec = (block: RecursiveBlock): RecursiveSeqFxPromoBlockSpec => ({
  lane: block.lane,
  startStep: block.startStep,
  length: GRID.blockLength,
  effect: block.effect,
});

export const RecursiveChainDemo = () => {
  const frame = useCurrentFrame();
  const committedBlocks = blocks.filter((block) => frame >= commitEndFrame(block));
  const committedKey = committedBlocks.map((block) => block.id).join("|");
  const sequencerState = useMemo(
    () => createRecursiveSeqFxPromoStateForBlocks(committedBlocks.map(blockToStateSpec)),
    [committedKey],
  );
  const assembly = 1;
  const proof = downbeatIn(frame, TIMING.rebuild, TIMING.rebuild + beat(3.5));
  const camera = progress(frame, TIMING.prerollEnd, TIMING.stutterDrop2 + BEAT, easeInOut);
  const payoffCamera = progress(frame, TIMING.rebuild, TIMING.rebuild + beat(5), easeInOut);
  const fixedChainOn = Math.min(
    downbeatIn(frame, TIMING.fixedChain, TIMING.fixedChain + BEAT),
    1 - progress(frame, TIMING.rebuild - BEAT, TIMING.rebuild, easeInOut),
  );
  const uiOpacity = 1 - progress(frame, TIMING.sceneEnd - BEAT, TIMING.sceneEnd, easeInOut);
  const uiTiltX = interpolate(camera, [0, 1], [4, 8]) - payoffCamera * 2;
  const uiTiltY = interpolate(camera, [0, 1], [-5, -13]) + payoffCamera * 5;
  const uiY = interpolate(camera, [0, 1], [6, 30]) + payoffCamera * 20;
  const uiScale = UI_SCALE * interpolate(proof, [0, 1], [1.02, 0.88]);

  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1900 }}>
      <RecursiveKineticCopy frame={frame} />

      <div
        style={{
          position: "absolute",
          left: UI_LEFT,
          top: UI_TOP,
          width: SEQFX_UI_BASE_WIDTH,
          height: SEQFX_UI_BASE_HEIGHT,
          opacity: uiOpacity * (1 - fixedChainOn * 0.68),
          transformStyle: "preserve-3d",
          transform: `scale(${uiScale}) translateY(${uiY}px) rotateX(${uiTiltX}deg) rotateY(${uiTiltY}deg)`,
          transformOrigin: "50% 45%",
          filter: `drop-shadow(0 48px 90px rgba(0,0,0,${0.38 + proof * 0.18}))`,
        }}
      >
        <SeqFxUi
          frame={frame}
          state={sequencerState}
          playheadStep={Math.min(10, Math.max(0, Math.floor((frame - TIMING.prerollEnd) / BEAT)))}
          selectedCell={{ lane: Math.min(3, Math.floor(Math.max(0, frame - TIMING.prerollEnd) / beat(3.5))), step: 6 }}
          showInspector
          showPlayhead={false}
          assembly={assembly}
          scale={1}
          compact
        />
        <GridOverlay frame={frame} />
      </div>

      <FixedChainPunchline frame={frame} />
      <ChainRebuildMoneyShot frame={frame} />
      <BuildSeqFxLine frame={frame} />
    </div>
  );
};

const RecursiveKineticCopy = ({ frame }: { frame: number }) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      right: 80,
      top: 48,
      height: 252,
      zIndex: 20,
      pointerEvents: "none",
      textAlign: "center",
    }}
  >
    {scriptLines.map((line, index) => {
      const enter = progress(frame, line.from, line.from + tempoFrames(12), easeOut);
      const exit = 1 - progress(frame, line.to - tempoFrames(10), line.to, easeInOut);
      const active = Math.min(enter, exit);
      const previous = progress(frame, line.to - tempoFrames(8), line.to + tempoFrames(10), easeOut);
      const y = interpolate(enter, [0, 1], [34, 0]) - previous * 42;
      const stopDrag =
        line.chain[line.chain.length - 1] === "tape"
          ? pulse(frame, line.from + tempoFrames(38), tempoFrames(38))
          : 0;
      const stutterDrag =
        line.chain[line.chain.length - 1] === "stutter"
          ? pulse(frame, line.from + tempoFrames(24), tempoFrames(30))
          : 0;
      return (
        <div
          className="caption"
          key={`${line.from}-${index}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            color: COLORS.cream,
            fontSize: line.size,
            lineHeight: 0.9,
            letterSpacing: "0.005em",
            opacity: active,
            filter: `blur(${interpolate(enter, [0, 1], [18, 0])}px) saturate(${1 + stutterDrag * 0.8})`,
            transform: `translateY(${y + stopDrag * 14}px) scaleX(${1 - stopDrag * 0.055}) scale(${interpolate(active, [0, 1], [0.965, 1])})`,
            textShadow: `0 0 ${22 + stutterDrag * 28}px rgba(0,179,204,${0.18 + stutterDrag * 0.22})`,
          }}
        >
          <div
            className="mono"
            style={{
              marginBottom: 14,
              color: index % 2 === 0 ? COLORS.tape : COLORS.stutter,
              fontSize: 15,
              fontWeight: 950,
              letterSpacing: "0.2em",
            }}
          >
            RECURSION 0{index + 1}
          </div>
          <div>
            {line.tokens.map((token, tokenIndex) => (
              <React.Fragment key={`${token.text}-${tokenIndex}`}>
                {token.lineBreakBefore ? <br /> : null}
                <KineticToken token={token} line={line} frame={frame} index={tokenIndex} />
              </React.Fragment>
            ))}
          </div>
          <NestedChainTrail line={line} frame={frame} />
        </div>
      );
    })}
  </div>
);

const KineticToken = ({
  token,
  line,
  frame,
  index,
}: {
  token: ScriptToken;
  line: ScriptLine;
  frame: number;
  index: number;
}) => {
  const tokenIn = progress(
    frame,
    line.from + index * tempoFrames(3),
    line.from + tempoFrames(12) + index * tempoFrames(3),
    easeOut,
  );
  const tapePull =
    token.effect === "tape"
      ? pulse(frame, line.from + tempoFrames(32) + index * tempoFrames(2), tempoFrames(34))
      : 0;
  const stutterHit =
    token.effect === "stutter"
      ? pulse(frame, line.from + tempoFrames(20) + index * tempoFrames(2), tempoFrames(28))
      : 0;
  const jitter = token.effect === "stutter" ? Math.sin(frame * 3.1 + index) * 7 * stutterHit : 0;
  const color = token.effect === "tape" ? COLORS.tape : token.effect === "stutter" ? COLORS.stutter : COLORS.cream;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        margin: token.small ? "0 12px" : "0 16px",
        color,
        fontSize: token.small ? "0.56em" : "1em",
        opacity: tokenIn,
        transform: `translate3d(${fmt(jitter)}px, ${fmt(interpolate(tokenIn, [0, 1], [24, tapePull * 8]))}px, 0) scaleX(${fmt(1 - tapePull * 0.11)}) skewX(${fmt(-tapePull * 5)}deg)`,
        transformOrigin: "50% 70%",
        textShadow:
          token.effect === "stutter"
            ? `0 0 ${18 + stutterHit * 28}px rgba(181,217,156,0.46)`
            : token.effect === "tape"
              ? `0 0 ${18 + tapePull * 26}px rgba(152,193,217,0.46)`
              : "0 0 16px rgba(239,234,224,0.16)",
        filter: `blur(${fmt((1 - tokenIn) * 10 + tapePull * 0.8)}px)`,
      }}
    >
      {token.effect === "stutter"
        ? [1, 2, 3].map((ghost) => (
            <span
              key={ghost}
              aria-hidden
              style={{
                position: "absolute",
                left: `${ghost * 5}px`,
                top: `${ghost % 2 === 0 ? -4 : 5}px`,
                opacity: stutterHit * (0.24 / ghost),
                color: ghost === 1 ? COLORS.cyan : COLORS.magenta,
                mixBlendMode: "screen",
              }}
            >
              {token.text}
            </span>
          ))
        : null}
      {token.text}
    </span>
  );
};

const NestedChainTrail = ({ line, frame }: { line: ScriptLine; frame: number }) => {
  const trail = progress(frame, line.from + tempoFrames(12), line.from + tempoFrames(30), easeOut);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
        marginTop: 26,
        opacity: trail,
        transform: `translateY(${interpolate(trail, [0, 1], [18, 0])}px)`,
      }}
    >
      {line.chain.map((effect, index) => (
        <React.Fragment key={`${line.from}-${effect}-${index}`}>
          <div
            style={{
              position: "relative",
              transform: `scale(${fmt(1 - index * 0.055)})`,
              transformOrigin: "50% 50%",
            }}
          >
            <RealSeqFxBlockPill effect={effect} width={210} height={54} />
            <div
              className="mono"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -18,
                color: "rgba(239,234,224,0.52)",
                fontSize: 9,
                fontWeight: 950,
                letterSpacing: "0.16em",
              }}
            >
              LAYER {index + 1}
            </div>
          </div>
          {index < line.chain.length - 1 ? (
            <div
              className="mono"
              style={{
                color: COLORS.cyan,
                fontSize: 18,
                fontWeight: 950,
                opacity: 0.82,
                textShadow: "0 0 14px rgba(0,179,204,0.55)",
              }}
            >
              INTO
            </div>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
};

const GridOverlay = ({ frame }: { frame: number }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      transformStyle: "preserve-3d",
      zIndex: 40,
    }}
  >
    <SignalLinks frame={frame} />
    {blocks.map((block) => (
      <TailHighlight key={`tail-${block.id}`} block={block} frame={frame} />
    ))}
    {blocks.map((block) => (
      <LandingBlock key={block.id} block={block} frame={frame} />
    ))}
  </div>
);

const LandingBlock = ({ block, frame }: { block: RecursiveBlock; frame: number }) => {
  const rect = blockRect(block);
  const arrive = progress(
    frame,
    flyStartFrame(block),
    landingEndFrame(block),
    block.effect === "stutter" ? overshoot : easeOut,
  );
  const commit = progress(frame, commitStartFrame(block), commitEndFrame(block), easeInOut);
  const visible =
    progress(frame, flyStartFrame(block) - tempoFrames(8), flyStartFrame(block) + tempoFrames(2), easeOut) *
    (1 -
      progress(
        frame,
        commitStartFrame(block) + tempoFrames(5),
        commitEndFrame(block) + tempoFrames(4),
        easeInOut,
      ));
  const startX = rect.x + (block.effect === "stutter" ? 560 : -360) + block.lane * 26;
  const startY = rect.y - 276 + block.lane * 18;
  const x = interpolate(arrive, [0, 1], [startX, rect.x]);
  const y = interpolate(arrive, [0, 1], [startY, rect.y]);
  const hoverZ = 30 + block.lane * 14;
  const z = interpolate(commit, [0, 1], [interpolate(arrive, [0, 1], [480, hoverZ]), 2]);
  const scale = interpolate(commit, [0, 1], [interpolate(arrive, [0, 1], [1.28, 1]), 0.992]);
  const rotateX = interpolate(arrive, [0, 1], [block.effect === "stutter" ? -16 : 18, 0]);
  const rotateY = interpolate(arrive, [0, 1], [block.effect === "stutter" ? 20 : -18, 0]);
  const jitter =
    block.effect === "stutter" && arrive > 0 && arrive < 1
      ? Math.sin(frame * 2.9) * 7 * (1 - arrive)
      : 0;
  const impact = pulse(frame, landingEndFrame(block), tempoFrames(13));
  const sinkImpact = pulse(frame, commitEndFrame(block), tempoFrames(9));
  const shadow = 1 - commit * 0.86;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: rect.width,
        height: rect.height,
        opacity: visible,
        transformStyle: "preserve-3d",
        transform: `translate3d(${fmt(x + jitter)}px, ${fmt(y)}px, ${fmt(z)}px) rotateX(${fmt(rotateX)}deg) rotateY(${fmt(rotateY)}deg) scale(${fmt(scale)})`,
        filter: `drop-shadow(0 ${fmt((18 + impact * 16) * shadow)}px ${fmt((28 + impact * 26) * shadow)}px rgba(0,0,0,${fmt((0.34 + impact * 0.18) * shadow)}))`,
      }}
    >
      <RealSeqFxBlockPill effect={block.effect} width={rect.width} height={rect.height} />
      <div
        style={{
          position: "absolute",
          inset: -5 - impact * 9,
          borderRadius: 11,
          border: `2px solid ${block.effect === "tape" ? "rgba(242,209,107,0.72)" : "rgba(0,179,204,0.76)"}`,
          opacity: impact * 0.72 + sinkImpact * 0.46,
          boxShadow:
            block.effect === "tape"
              ? `0 0 ${34 + sinkImpact * 22}px rgba(242,209,107,0.48)`
              : `0 0 ${34 + sinkImpact * 22}px rgba(0,179,204,0.54)`,
        }}
      />
    </div>
  );
};

const TailHighlight = ({ block, frame }: { block: RecursiveBlock; frame: number }) => {
  const next = blocks[blocks.findIndex((candidate) => candidate.id === block.id) + 1];
  if (!next) return null;
  const rect = blockRect(block);
  const from = block.dropFrame + BEAT;
  const to = next.dropFrame - tempoFrames(6);
  const on = Math.min(
    progress(frame, from, from + tempoFrames(8), easeOut),
    1 - progress(frame, to - tempoFrames(8), to),
  );
  const pulseAmount = 0.55 + Math.sin(frame * 0.4) * 0.25;
  const x = GRID.xForStep(block.startStep + 2);
  const width = GRID.xForStep(block.startStep + GRID.blockLength) - x;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: rect.y - 4,
        width,
        height: rect.height + 8,
        opacity: on,
        borderRadius: 10,
        border: `2px solid rgba(242,209,107,${0.42 + pulseAmount * 0.3})`,
        background: "rgba(242,209,107,0.08)",
        boxShadow: `0 0 ${24 + pulseAmount * 18}px rgba(242,209,107,0.46)`,
        transform: "translateZ(64px)",
      }}
    >
      <div
        className="mono"
        style={{
          position: "absolute",
          left: 8,
          top: -24,
          color: "rgba(28,28,28,0.58)",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.14em",
        }}
      >
        TAIL
      </div>
    </div>
  );
};

const SignalLinks = ({ frame }: { frame: number }) => (
  <svg
    width={SEQFX_UI_BASE_WIDTH}
    height={SEQFX_UI_BASE_HEIGHT}
    viewBox={`0 0 ${SEQFX_UI_BASE_WIDTH} ${SEQFX_UI_BASE_HEIGHT}`}
    style={{ position: "absolute", inset: 0, overflow: "visible", transform: "translateZ(70px)" }}
  >
    <defs>
      <linearGradient id="recursive-link" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stopColor={COLORS.gold} stopOpacity="0.08" />
        <stop offset="48%" stopColor={COLORS.gold} stopOpacity="0.78" />
        <stop offset="100%" stopColor={COLORS.cyan} stopOpacity="0.78" />
      </linearGradient>
    </defs>
    {blocks.slice(0, -1).map((block, index) => {
      const next = blocks[index + 1];
      const fromRect = blockRect(block);
      const toRect = blockRect(next);
      const from = block.dropFrame + tempoFrames(4);
      const to = next.dropFrame - tempoFrames(4);
      const on = Math.min(
        progress(frame, from, from + tempoFrames(10), easeOut),
        1 - progress(frame, to - tempoFrames(6), to),
      );
      const draw = progress(frame, from + tempoFrames(2), to, easeOut);
      const x1 = GRID.xForStep(block.startStep + GRID.blockLength) - 4;
      const y1 = fromRect.y + fromRect.height / 2;
      const x2 = toRect.x + toRect.width * 0.12;
      const y2 = toRect.y + toRect.height / 2;
      const midX = (x1 + x2) / 2 + 44;
      const path = `M ${fmt(x1)} ${fmt(y1)} C ${fmt(midX)} ${fmt(y1 - 36)} ${fmt(midX)} ${fmt(y2 - 42)} ${fmt(x2)} ${fmt(y2)}`;
      return (
        <path
          key={block.id}
          d={path}
          fill="none"
          stroke="url(#recursive-link)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="240"
          strokeDashoffset={240 - draw * 240}
          opacity={on}
          filter="drop-shadow(0 0 10px rgba(0,179,204,0.5))"
        />
      );
    })}
  </svg>
);

const FixedChainPunchline = ({ frame }: { frame: number }) => {
  const on = Math.min(
    downbeatIn(frame, TIMING.fixedChain, TIMING.fixedChain + BEAT),
    1 - progress(frame, TIMING.rebuild - BEAT, TIMING.rebuild, easeInOut),
  );
  const flash = pulse(frame, TIMING.fixedChain, tempoFrames(14));
  const shake = pulse(frame, TIMING.fixedChain + BEAT, tempoFrames(18)) * Math.sin(frame * 1.9) * 10;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: on,
        zIndex: 58,
        background:
          `radial-gradient(circle at 50% 42%, rgba(238,108,77,${0.34 + flash * 0.28}), transparent 34%),` +
          "linear-gradient(105deg, rgba(8,11,16,0.28), rgba(70,12,24,0.86) 48%, rgba(8,11,16,0.92))",
        boxShadow: `inset 0 0 ${80 + flash * 80}px rgba(238,108,77,0.38)`,
      }}
    >
      <div
        className="mono"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 180,
          color: "rgba(239,234,224,0.72)",
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: "0.2em",
          textAlign: "center",
        }}
      >
        TRADITIONAL FIXED CHAIN
      </div>
      <div
        className="caption"
        style={{
          position: "absolute",
          left: 140 + shake,
          right: 140 - shake,
          top: 214,
          color: COLORS.cream,
          fontSize: 76,
          lineHeight: 0.88,
          textAlign: "center",
          textShadow: "0 0 34px rgba(238,108,77,0.64)",
          transform: `translateY(${interpolate(on, [0, 1], [26, 0])}px) scale(${1 + flash * 0.025})`,
        }}
      >
        MOST FX SEQUENCERS
        <br />
        LOCK YOU IN TO A
        <br />
        FIXED SIGNAL CHAIN.
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 524,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 18,
          transform: `translateX(${shake * 0.4}px)`,
        }}
      >
        <MiniEffect effect="tape" width={176} />
        <Arrow />
        <MiniEffect effect="stutter" width={176} />
        <Arrow />
        <div
          style={{
            position: "relative",
            opacity: 0.36,
            transform: `translateX(${pulse(frame, TIMING.fixedChain + BEAT, tempoFrames(18)) * 24}px)`,
          }}
        >
          <MiniEffect effect="tape" />
          <div
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: 10,
              border: "3px solid rgba(238,108,77,0.95)",
              boxShadow: "0 0 30px rgba(238,108,77,0.5)",
            }}
          />
        </div>
      </div>
      <div
        className="mono"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 640,
          color: "rgba(239,234,224,0.62)",
          fontSize: 15,
          fontWeight: 950,
          letterSpacing: "0.16em",
          textAlign: "center",
        }}
      >
        ONE TAPE STOP SLOT. ONE STUTTER SLOT. NO RECURSION.
      </div>
    </div>
  );
};

const MiniEffect = ({ effect, width = 136 }: { effect: Extract<EffectKey, "tape" | "stutter">; width?: number }) => {
  const info = EFFECTS[effect];
  return (
    <div
      className="mono"
      style={{
        display: "grid",
        placeItems: "center",
        width,
        height: 62,
        borderRadius: 8,
        background: info.color,
        color: "rgba(8,11,16,0.78)",
        fontSize: 15,
        fontWeight: 950,
        letterSpacing: "0.1em",
        boxShadow: `0 0 28px ${info.color}66`,
      }}
    >
      {info.label.toUpperCase()}
    </div>
  );
};

const Arrow = () => (
  <div
    className="mono"
    style={{
      color: COLORS.cyan,
      fontSize: 30,
      fontWeight: 900,
      textShadow: "0 0 16px rgba(0,179,204,0.56)",
    }}
  >
    -&gt;
  </div>
);

const stepChains: Array<{
  label: string;
  order: Array<Extract<EffectKey, "tape" | "stutter">>;
  previous?: Array<Extract<EffectKey, "tape" | "stutter">>;
}> = [
  { label: "STEP 03", order: ["tape", "stutter"] },
  { label: "STEP 05", order: ["stutter", "tape"], previous: ["tape", "stutter"] },
  { label: "STEP 07", order: ["tape", "stutter", "tape", "stutter"], previous: ["stutter", "tape"] },
];

const ChainRebuildMoneyShot = ({ frame }: { frame: number }) => {
  const proof = downbeatIn(frame, TIMING.rebuild, TIMING.rebuild + beat(3.5));
  const exit = 1 - progress(frame, TIMING.sceneEnd - BEAT, TIMING.sceneEnd, easeInOut);
  const opacity = Math.min(proof, exit);

  return (
    <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none", perspective: 1600, zIndex: 42 }}>
      <div
        style={{
          position: "absolute",
          left: 842,
          top: 116,
          width: 948,
          height: 560,
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(8,11,16,0.58), rgba(8,11,16,0.18))",
          border: "1px solid rgba(239,234,224,0.14)",
          boxShadow: "0 46px 110px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.04)",
          transform: `translateY(${interpolate(proof, [0, 1], [32, 0])}px) rotateY(-8deg) rotateX(4deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="mono"
          style={{
            position: "absolute",
            left: 34,
            top: 28,
            color: COLORS.cyan,
            fontSize: 15,
            fontWeight: 950,
            letterSpacing: "0.17em",
            textShadow: "0 0 18px rgba(0,179,204,0.54)",
          }}
        >
          CHAIN ORDER REBUILDS PER STEP
        </div>
        <div style={{ position: "absolute", left: 34, right: 34, top: 82, display: "flex", gap: 20 }}>
          {stepChains.map((step, index) => (
            <StepChainColumn key={step.label} step={step} frame={frame} index={index} />
          ))}
        </div>
        <div
          className="caption"
          style={{
            position: "absolute",
            left: 34,
            right: 34,
            bottom: 30,
            color: COLORS.cream,
            fontSize: 31,
            lineHeight: 0.95,
            textAlign: "center",
          }}
        >
          TAPE STOP {"->"} STUTTER {"->"} TAPE STOP {"->"} STUTTER
        </div>
      </div>
    </div>
  );
};

const StepChainColumn = ({
  step,
  frame,
  index,
}: {
  step: (typeof stepChains)[number];
  frame: number;
  index: number;
}) => {
  const from = TIMING.rebuild + index * BEAT;
  const show = downbeatIn(frame, from, from + BEAT);
  const gap = 78;
  return (
    <div
      style={{
        position: "relative",
        width: index === 2 ? 328 : 262,
        height: 362,
        opacity: show,
        borderRadius: 10,
        border: "1px solid rgba(239,234,224,0.13)",
        background: "rgba(239,234,224,0.055)",
        overflow: "hidden",
        transform: `translateY(${interpolate(show, [0, 1], [24, 0])}px)`,
      }}
    >
      <div
        className="mono"
        style={{
          position: "absolute",
          left: 18,
          top: 16,
          color: index === 1 ? COLORS.gold : COLORS.cyan,
          fontSize: 13,
          fontWeight: 950,
          letterSpacing: "0.16em",
        }}
      >
        {step.label}
      </div>
      <div
        className="mono"
        style={{
          position: "absolute",
          right: 18,
          top: 16,
          color: "rgba(239,234,224,0.48)",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.14em",
        }}
      >
        ORDER
      </div>
      {step.order.map((effect, effectIndex) => {
        const previousIndex = step.previous?.indexOf(effect) ?? effectIndex;
        const cardIn = progress(
          frame,
          from + tempoFrames(6) + effectIndex * tempoFrames(3),
          from + tempoFrames(25) + effectIndex * tempoFrames(3),
          easeOut,
        );
        const x = interpolate(cardIn, [0, 1], [index === 0 ? -26 : -54, 0]);
        const y = interpolate(cardIn, [0, 1], [72 + previousIndex * gap, 72 + effectIndex * gap]);
        const flash = pulse(frame, from + tempoFrames(24) + effectIndex * tempoFrames(3), tempoFrames(12));
        return (
          <React.Fragment key={`${step.label}-${effect}-${effectIndex}`}>
            <div
              style={{
                position: "absolute",
                left: index === 2 ? 50 : 26,
                top: 0,
                width: index === 2 ? 228 : 210,
                height: 58,
                transform: `translate(${fmt(x)}px, ${fmt(y)}px)`,
                filter: `drop-shadow(0 ${14 + flash * 18}px ${24 + flash * 20}px rgba(0,0,0,0.38))`,
              }}
            >
              <RealSeqFxBlockPill effect={effect} width={index === 2 ? 228 : 210} height={58} />
              <div
                style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: 10,
                  border: `2px solid ${effect === "tape" ? "rgba(152,193,217,0.62)" : "rgba(181,217,156,0.62)"}`,
                  opacity: flash,
                  boxShadow: `0 0 26px ${effect === "tape" ? "rgba(152,193,217,0.5)" : "rgba(181,217,156,0.5)"}`,
                }}
              />
            </div>
            {effectIndex < step.order.length - 1 ? (
              <div
                className="mono"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 136 + effectIndex * gap,
                  color: COLORS.cyan,
                  fontSize: 13,
                  fontWeight: 950,
                  letterSpacing: "0.14em",
                  textAlign: "center",
                  opacity: cardIn * 0.76,
                }}
              >
                THEN
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const BuildSeqFxLine = ({ frame }: { frame: number }) => {
  const on = Math.min(
    downbeatIn(frame, TIMING.rebuild, TIMING.rebuild + BEAT),
    1 - progress(frame, TIMING.sceneEnd - BEAT, TIMING.sceneEnd, easeInOut),
  );
  return (
    <div
      className="caption"
      style={{
        position: "absolute",
        left: 92,
        top: 84,
        maxWidth: 790,
        zIndex: 64,
        color: COLORS.cream,
        fontSize: 58,
        lineHeight: 0.94,
        opacity: on,
        transform: `translateY(${interpolate(on, [0, 1], [24, 0])}px)`,
        textShadow: "0 0 26px rgba(0,179,204,0.2)",
      }}
    >
      REBUILD THE CHAIN ON EVERY STEP
      <br />
      WITH <span style={{ color: COLORS.cyan }}>SEQFX.</span>
    </div>
  );
};
