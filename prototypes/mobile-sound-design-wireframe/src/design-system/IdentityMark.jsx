import {
  BezierCurve,
  Circle,
  CursorClick,
  Feather,
  Gauge,
  Lightning,
  Pulse,
  Waveform,
} from "@phosphor-icons/react";

const SOURCE_ICONS = {
  macro: Gauge,
  envelope: Pulse,
  mseg: BezierCurve,
  fixed: Waveform,
};

const ARTICULATION_ICONS = {
  Default: Circle,
  Pluck: CursorClick,
  Bowed: Feather,
  Accent: Lightning,
};

export function SourceIcon({ source, size = 18 }) {
  const Icon = SOURCE_ICONS[source?.type] || Waveform;
  return <Icon aria-hidden="true" size={size} weight="regular" />;
}

export function SourceIdentity({ source, color, includeName = false, size = 18 }) {
  return (
    <span className="source-identity" style={{ "--identity-color": color }} title={source?.label}>
      <SourceIcon source={source} size={size} />
      {source?.slot != null && <span className="source-identity__slot">{source.slot}</span>}
      {includeName && <span className="source-identity__name">{source?.label}</span>}
    </span>
  );
}

export function ArticulationIcon({ articulation, size = 16 }) {
  const Icon = ARTICULATION_ICONS[articulation] || Circle;
  return <Icon aria-hidden="true" size={size} weight="regular" />;
}
