import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const FONTAUDIO_DIRECTORY = path.join(REPOSITORY_ROOT, "ui", "assets", "fontaudio");
const OUTPUT_DIRECTORY = path.join(REPOSITORY_ROOT, "ui", "assets", "modulation-sources");

const PALETTE = Object.freeze({
    macro: "#ff6b2c",
    cyclic: "#54d9ff",
    shape: "#d978e5",
    performance: "#b9d947",
});

const LOGICAL_SIZES = Object.freeze([24, 32, 44]);
const DEVICE_PIXEL_RATIOS = Object.freeze([1, 2, 3]);
const PIXEL_SIZES = Object.freeze([
    ...new Set(LOGICAL_SIZES.flatMap((size) => DEVICE_PIXEL_RATIOS.map((ratio) => size * ratio))),
].sort((left, right) => left - right));

const GLYPHS = Object.freeze({
    macro: {
        source: "fad-slider-round-1.svg",
        transform: "translate(6.5 12.5) scale(0.13)",
    },
    lfo: {
        source: "fad-modsine.svg",
        transform: "translate(6 12) scale(0.14)",
    },
    envelope: {
        source: "fad-ADSR.svg",
        transform: "translate(6 12) scale(0.14)",
    },
    mseg: {
        source: "fad-automation-4p.svg",
        transform: "translate(7 13) scale(0.13)",
    },
    velocity: {
        source: "fad-keyboard.svg",
        transform: "translate(10.2 10.2) scale(0.17)",
    },
    pressure: {
        source: "fad-thunderbolt.svg",
        transform: "translate(12.5 12.5) scale(0.152)",
    },
    slide: {
        source: "fad-arrows-horz.svg",
        transform: "translate(11.5 12) scale(0.16)",
    },
    "mod-wheel": {
        source: "fad-vroundswitch-on.svg",
        transform: "translate(12.8 12) scale(0.15)",
    },
});

const SOURCE_ASSETS = Object.freeze([
    ...numberedSources("macro", "Macro", "macro", 4),
    ...numberedSources("lfo", "LFO", "cyclic", 3),
    ...numberedSources("envelope", "Envelope", "shape", 3),
    ...numberedSources("mseg", "MSEG", "shape", 3),
    sourceAsset("velocity", "Velocity", "velocity", "performance"),
    sourceAsset("pressure", "Pressure", "pressure", "performance"),
    sourceAsset("slide", "Slide", "slide", "performance"),
    sourceAsset("mod-wheel", "Mod Wheel", "mod-wheel", "performance"),
]);

function sourceAsset(id, label, glyph, family, number = null) {
    return Object.freeze({ id, label, glyph, family, number });
}

function numberedSources(idPrefix, labelPrefix, family, count) {
    return Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        return sourceAsset(`${idPrefix}-${number}`, `${labelPrefix} ${number}`, idPrefix, family, number);
    });
}

function extractSvgContents(source) {
    const body = source
        .replace(/^.*?<svg[^>]*>/s, "")
        .replace(/<\/svg>\s*$/s, "")
        .replace(/\s+stroke="#979797"/g, "")
        .trim();

    if (!body.includes("<path") && !body.includes("<g")) {
        throw new Error("fontaudio source did not contain renderable SVG content");
    }

    return body;
}

function digitMarkup(number) {
    const pathByDigit = {
        1: "M46.3 28.5 49.7 25.7v14.8M46.2 40.5h7",
        2: "M45.7 29.1c.3-2.3 1.7-3.5 3.8-3.5 2.2 0 3.7 1.4 3.7 3.4 0 1.8-1 3.1-2.6 4.6l-4.8 4.5v2.4h7.7",
        3: "M46.1 27.4c.8-1.2 2-1.8 3.5-1.8 2.2 0 3.6 1.3 3.6 3.3 0 1.8-1 3-2.9 3.5 2.1.4 3.2 1.7 3.2 3.8 0 2.7-1.7 4.4-4.2 4.4-1.7 0-3-.7-3.9-2",
        4: "M51.8 40.5V25.6l-6.4 10.2h8.4",
    };
    const digitPath = pathByDigit[number];
    if (digitPath === undefined) {
        throw new Error(`unsupported modulation-source number: ${number}`);
    }
    return `<path d="${digitPath}" fill="none" stroke="currentColor" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function renderIconSvg(asset, glyphContents, color) {
    const glyph = GLYPHS[asset.glyph];
    const number = asset.number === null ? "" : digitMarkup(asset.number);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-labelledby="title" style="color:${color}">
  <title id="title">${asset.label} modulation source</title>
  <circle cx="32" cy="32" r="28.25" fill="none" stroke="currentColor" stroke-width="3.25"/>
  <g fill="currentColor" stroke="none" transform="${glyph.transform}">
    ${glyphContents}
  </g>
  ${number}
</svg>
`;
}

async function writeSvgAssets(glyphContentsByName) {
    const fixedDirectory = path.join(OUTPUT_DIRECTORY, "svg", "fixed");
    const maskDirectory = path.join(OUTPUT_DIRECTORY, "svg", "mask");
    await Promise.all([mkdir(fixedDirectory, { recursive: true }), mkdir(maskDirectory, { recursive: true })]);

    const writtenAssets = [];
    for (const asset of SOURCE_ASSETS) {
        const glyphContents = glyphContentsByName.get(asset.glyph);
        if (glyphContents === undefined) {
            throw new Error(`missing loaded glyph contents for ${asset.glyph}`);
        }
        const fixedRelativePath = path.join("svg", "fixed", `${asset.id}.svg`);
        const maskRelativePath = path.join("svg", "mask", `${asset.id}.svg`);
        await Promise.all([
            writeFile(
                path.join(OUTPUT_DIRECTORY, fixedRelativePath),
                renderIconSvg(asset, glyphContents, PALETTE[asset.family]),
                "utf8",
            ),
            writeFile(
                path.join(OUTPUT_DIRECTORY, maskRelativePath),
                renderIconSvg(asset, glyphContents, "#ffffff"),
                "utf8",
            ),
        ]);
        writtenAssets.push({
            ...asset,
            color: PALETTE[asset.family],
            svg: fixedRelativePath,
            maskSvg: maskRelativePath,
        });
    }
    return writtenAssets;
}

async function rasterizePngAssets(writtenAssets) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        for (const pixelSize of PIXEL_SIZES) {
            const sizeDirectory = path.join(OUTPUT_DIRECTORY, "png", String(pixelSize));
            await mkdir(sizeDirectory, { recursive: true });
            await page.setViewportSize({ width: pixelSize, height: pixelSize });

            for (const asset of writtenAssets) {
                const svg = await readFile(path.join(OUTPUT_DIRECTORY, asset.svg), "utf8");
                await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`);
                await page.screenshot({
                    path: path.join(sizeDirectory, `${asset.id}.png`),
                    omitBackground: true,
                });
            }
        }
    } finally {
        await browser.close();
    }
}

async function writeManifest(writtenAssets) {
    const manifest = {
        format: "cosimo.modulation-source-icons.v1",
        palette: PALETTE,
        logicalSizes: LOGICAL_SIZES,
        devicePixelRatios: DEVICE_PIXEL_RATIOS,
        pixelSizes: PIXEL_SIZES,
        glyphSources: Object.fromEntries(
            Object.entries(GLYPHS).map(([name, glyph]) => [name, `../fontaudio/${glyph.source}`]),
        ),
        assets: writtenAssets.map((asset) => ({
            ...asset,
            png: Object.fromEntries(PIXEL_SIZES.map((size) => [size, `png/${size}/${asset.id}.png`])),
        })),
    };
    await writeFile(
        path.join(OUTPUT_DIRECTORY, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
    );
}

async function main() {
    const glyphContentsByName = new Map();
    for (const [name, glyph] of Object.entries(GLYPHS)) {
        const source = await readFile(path.join(FONTAUDIO_DIRECTORY, glyph.source), "utf8");
        glyphContentsByName.set(name, extractSvgContents(source));
    }

    await mkdir(OUTPUT_DIRECTORY, { recursive: true });
    const writtenAssets = await writeSvgAssets(glyphContentsByName);
    await rasterizePngAssets(writtenAssets);
    await writeManifest(writtenAssets);
    console.log(`Generated ${writtenAssets.length} modulation-source icons at ${PIXEL_SIZES.length} PNG sizes.`);
}

await main();
