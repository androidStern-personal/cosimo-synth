import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCircularPxRadius, normalizePanelRect } from '../../src/browser/measure-panels.mjs';
import { cssPanelToSourcePixelRect } from '../../src/browser/crop-utils.mjs';
import { makeDebugOutlinesSvg } from '../../src/browser/svg-debug.mjs';

test('parseCircularPxRadius supports one px value', () => {
  assert.deepEqual(parseCircularPxRadius('18px', 'filter', 'topLeft'), { x: 18, y: 18 });
});

test('parseCircularPxRadius supports two equal px values from computed longhand', () => {
  assert.deepEqual(parseCircularPxRadius('18px 18px', 'filter', 'topLeft'), { x: 18, y: 18 });
});

test('parseCircularPxRadius rejects percent radii', () => {
  assert.throws(() => parseCircularPxRadius('50%', 'filter', 'topLeft'), /supports only circular px radii/);
});

test('parseCircularPxRadius rejects elliptical radii', () => {
  assert.throws(() => parseCircularPxRadius('10px 20px', 'filter', 'topLeft'), /circular radii/);
});

test('normalizePanelRect clamps radii to half min dimension', () => {
  const panel = normalizePanelRect({
    id: 'tiny',
    x: 0,
    y: 0,
    width: 20,
    height: 10,
    radii: {
      topLeft: { x: 100, y: 100 },
      topRight: { x: 100, y: 100 },
      bottomRight: { x: 100, y: 100 },
      bottomLeft: { x: 100, y: 100 },
    },
  });
  assert.equal(panel.radii.topLeft.x, 5);
  assert.equal(panel.radii.topLeft.y, 5);
});

test('cssPanelToSourcePixelRect multiplies source coordinates for high-DPI captures', () => {
  const layout = { cssWidth: 1600, cssHeight: 1000, imagePixelWidth: 3200, imagePixelHeight: 2000 };
  const panel = { x: 100, y: 50, width: 200, height: 80 };
  assert.deepEqual(cssPanelToSourcePixelRect(panel, layout), {
    sx: 200,
    sy: 100,
    sw: 400,
    sh: 160,
    dx: 0,
    dy: 0,
    dw: 200,
    dh: 80,
  });
});

test('debug SVG uses the CSS coordinate space', () => {
  const svg = makeDebugOutlinesSvg({
    cssWidth: 1600,
    cssHeight: 1000,
    sections: [
      {
        id: 'wavetable',
        x: 80,
        y: 120,
        width: 420,
        height: 240,
        radii: { topLeft: { x: 18, y: 18 } },
      },
    ],
  });
  assert.match(svg, /viewBox="0 0 1600 1000"/);
  assert.match(svg, /id="wavetable"/);
  assert.match(svg, /x="80\.000"/);
});
