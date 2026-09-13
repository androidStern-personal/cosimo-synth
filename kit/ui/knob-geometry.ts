/** Point on a 270-degree dial, in a 100-unit viewBox. */
export function knobArcPoint(position: number, radius: number) {
    const angle = (225 - Math.min(1, Math.max(0, position)) * 270) * Math.PI / 180;
    return { x: 50 + radius * Math.cos(angle), y: 50 - radius * Math.sin(angle) };
}

const text = (p: { x: number; y: number }) => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`;

/** Filled sector between two normalized positions. */
export function knobSector(from: number, to: number, radius: number) {
    const low = Math.min(from, to), high = Math.max(from, to);
    if ((high - low) * 270 <= 0.001) return "";
    return `M 50 50 L ${text(knobArcPoint(low, radius))} A ${radius} ${radius} 0 ${(high - low) * 270 > 180 ? 1 : 0} 1 ${text(knobArcPoint(high, radius))} Z`;
}

/** Filled annular interval in the same dial coordinates. */
export function knobAnnulus(from: number, to: number, inner: number, outer: number) {
    const low = Math.min(from, to), high = Math.max(from, to);
    if ((high - low) * 270 <= 0.001) return "";
    const large = (high - low) * 270 > 180 ? 1 : 0;
    return `M ${text(knobArcPoint(low, outer))} A ${outer} ${outer} 0 ${large} 1 ${text(knobArcPoint(high, outer))} L ${text(knobArcPoint(high, inner))} A ${inner} ${inner} 0 ${large} 0 ${text(knobArcPoint(low, inner))} Z`;
}
