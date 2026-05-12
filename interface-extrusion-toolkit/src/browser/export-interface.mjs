#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { readJsonFile, validateManifest } from './manifest.mjs';
import { makeBrowserMeasurementFunctionSource } from './measure-panels.mjs';
import { makeDebugOutlinesSvg } from './svg-debug.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:\n  node src/browser/export-interface.mjs --manifest manifest.json --out captures/my-interface\n`;
}

function pngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('Expected PNG screenshot; file does not have a PNG signature');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.manifest || !args.out) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const manifest = validateManifest(await readJsonFile(args.manifest));
  await fs.mkdir(args.out, { recursive: true });

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: manifest.capture.widthCss, height: manifest.capture.heightCss },
    deviceScaleFactor: manifest.capture.deviceScaleFactor ?? 1,
  });

  if (manifest.capture.captureMode) {
    await context.addInitScript((captureMode) => {
      window.__INTERFACE_CAPTURE_MODE__ = captureMode;
    }, manifest.capture.captureMode);
  }

  const page = await context.newPage();
  try {
    await page.goto(manifest.capture.url, { waitUntil: manifest.capture.waitUntil ?? 'load' });

    if (manifest.capture.waitForReadyExpression) {
      await page.waitForFunction(manifest.capture.waitForReadyExpression, null, {
        timeout: manifest.capture.readyTimeoutMs ?? 10000,
      });
    } else if (manifest.capture.waitForCaptureReady === true) {
      await page.waitForFunction(() => window.__INTERFACE_CAPTURE_READY__ === true, null, {
        timeout: manifest.capture.readyTimeoutMs ?? 10000,
      });
    }

    const root = page.locator(manifest.capture.rootSelector);
    await root.waitFor({ state: 'visible', timeout: manifest.capture.rootTimeoutMs ?? 10000 });

    const measureInPage = makeBrowserMeasurementFunctionSource();
    const measured = await page.evaluate(measureInPage, {
      rootSelector: manifest.capture.rootSelector,
      sections: manifest.sections,
    });

    const imagePath = path.join(args.out, 'interface.png');
    const screenshotScale = manifest.capture.screenshotScale ?? 'css';
    if (!['css', 'device'].includes(screenshotScale)) {
      throw new Error(`capture.screenshotScale must be "css" or "device"; got ${screenshotScale}`);
    }

    await root.screenshot({
      path: imagePath,
      scale: screenshotScale,
      animations: manifest.capture.animations ?? 'allow',
    });

    const imageBuffer = await fs.readFile(imagePath);
    const imageSize = pngDimensions(imageBuffer);
    const pixelScaleX = imageSize.width / measured.cssWidth;
    const pixelScaleY = imageSize.height / measured.cssHeight;

    const layout = {
      interfaceId: manifest.interfaceId,
      cssWidth: measured.cssWidth,
      cssHeight: measured.cssHeight,
      imagePath: 'interface.png',
      imagePixelWidth: imageSize.width,
      imagePixelHeight: imageSize.height,
      pixelScaleX,
      pixelScaleY,
      sections: measured.sections,
    };

    await fs.writeFile(path.join(args.out, 'layout.json'), JSON.stringify(layout, null, 2));
    await fs.writeFile(path.join(args.out, 'debug-outlines.svg'), makeDebugOutlinesSvg(layout));

    console.log(`Wrote ${imagePath}`);
    console.log(`Wrote ${path.join(args.out, 'layout.json')}`);
    console.log(`Wrote ${path.join(args.out, 'debug-outlines.svg')}`);
    console.table(layout.sections.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
