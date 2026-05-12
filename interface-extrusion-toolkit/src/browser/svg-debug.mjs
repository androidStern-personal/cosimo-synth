function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
}

export function makeDebugOutlinesSvg(layout) {
  const rects = layout.sections.map((section) => {
    const r = section.radii?.topLeft?.x ?? 0;
    return `  <rect id="${esc(section.id)}" x="${section.x.toFixed(3)}" y="${section.y.toFixed(3)}" width="${section.width.toFixed(3)}" height="${section.height.toFixed(3)}" rx="${r.toFixed(3)}" ry="${r.toFixed(3)}" fill="none" stroke="#00ffcc" stroke-width="2" vector-effect="non-scaling-stroke"/>\n  <text x="${(section.x + 6).toFixed(3)}" y="${(section.y + 18).toFixed(3)}" fill="#00ffcc" font-family="monospace" font-size="14">${esc(section.id)}</text>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${layout.cssWidth}" height="${layout.cssHeight}" viewBox="0 0 ${layout.cssWidth} ${layout.cssHeight}">\n  <rect x="0" y="0" width="${layout.cssWidth}" height="${layout.cssHeight}" fill="none" stroke="#ff00ff" stroke-width="2"/>\n${rects}\n</svg>\n`;
}
