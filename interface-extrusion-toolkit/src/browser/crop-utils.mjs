export function computePixelScale(layout) {
  const pixelScaleX = layout.pixelScaleX ?? layout.imagePixelWidth / layout.cssWidth;
  const pixelScaleY = layout.pixelScaleY ?? layout.imagePixelHeight / layout.cssHeight;
  if (!Number.isFinite(pixelScaleX) || !Number.isFinite(pixelScaleY) || pixelScaleX <= 0 || pixelScaleY <= 0) {
    throw new Error('Invalid pixel scale values in layout');
  }
  return { pixelScaleX, pixelScaleY };
}

export function cssPanelToSourcePixelRect(panel, layout) {
  const { pixelScaleX, pixelScaleY } = computePixelScale(layout);
  return {
    sx: panel.x * pixelScaleX,
    sy: panel.y * pixelScaleY,
    sw: panel.width * pixelScaleX,
    sh: panel.height * pixelScaleY,
    dx: 0,
    dy: 0,
    dw: panel.width,
    dh: panel.height,
  };
}
