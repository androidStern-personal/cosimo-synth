export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export const formatFrequency = (value: number): string => (
    value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} kHz` : `${Math.round(value)} Hz`
);
export const formatQ = (value: number): string => value.toFixed(2);
export const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;
/** Amount 0..1 is a 0..12 dB bell boost. */
export const formatBoost = (value: number): string => `+${(value * 12).toFixed(1)} dB`;
