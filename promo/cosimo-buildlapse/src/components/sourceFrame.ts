// Map a window of composite frames onto a window of source frames.
// Pure function — keeps timing-curve experimentation in one place later
// (e.g. to swap in an eased curve, just call interpolate() before the floor).

export const linearSourceFrame = (
  compositeFrame: number,
  windowStart: number,
  windowEnd: number,
  sourceFirst: number,
  sourceLast: number
): number => {
  const span = Math.max(1, windowEnd - windowStart);
  const t = Math.min(1, Math.max(0, (compositeFrame - windowStart) / span));
  const sourceCount = sourceLast - sourceFirst + 1;
  // Map t∈[0,1) onto sourceCount discrete frames; clamp the final tick
  // so we don't index past the last frame.
  const idx = Math.min(sourceCount - 1, Math.floor(t * sourceCount));
  return sourceFirst + idx;
};
