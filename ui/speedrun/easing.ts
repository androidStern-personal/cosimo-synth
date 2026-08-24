/**
 * The one easing authority for speedrun motion. The replica state/gesture
 * replay and the scripted connection's partial-op interpolation must move
 * values along identical curves, or the accepted pacing silently forks.
 */

export function clamp01(value: number): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function smoothstep(value: number): number {
    const progress = clamp01(value);
    return progress * progress * (3 - (2 * progress));
}

export function mix(from: number, to: number, progress: number): number {
    return from + ((to - from) * smoothstep(progress));
}
