import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

/** Decode an 8-bit RGB/RGBA PNG into an RGBA pixel buffer. */
export function decodePng(buffer) {
    assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks = [];

    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        offset += 12 + length;

        if (type === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === "IDAT") {
            idatChunks.push(data);
        } else if (type === "IEND") {
            break;
        }
    }

    assert.equal(bitDepth, 8);
    assert.equal(colorType === 6 || colorType === 2, true, `Unsupported PNG color type ${colorType}`);

    const inflated = inflateSync(Buffer.concat(idatChunks));
    const bytesPerPixel = colorType === 6 ? 4 : 3;
    const stride = width * bytesPerPixel;
    const pixels = Buffer.alloc(width * height * 4);
    let sourceOffset = 0;

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[sourceOffset];
        sourceOffset += 1;
        const targetRowStart = y * width * 4;

        for (let x = 0; x < stride; x += 1) {
            const raw = inflated[sourceOffset + x];
            const targetX = Math.floor(x / bytesPerPixel) * 4 + (x % bytesPerPixel);
            const left = x >= bytesPerPixel ? pixels[targetRowStart + targetX - 4] : 0;
            const up = y > 0 ? pixels[targetRowStart + targetX - (width * 4)] : 0;
            const upLeft = y > 0 && x >= bytesPerPixel
                ? pixels[targetRowStart + targetX - (width * 4) - 4]
                : 0;
            let value;

            if (filter === 0) {
                value = raw;
            } else if (filter === 1) {
                value = raw + left;
            } else if (filter === 2) {
                value = raw + up;
            } else if (filter === 3) {
                value = raw + Math.floor((left + up) / 2);
            } else if (filter === 4) {
                const prediction = left + up - upLeft;
                const leftDistance = Math.abs(prediction - left);
                const upDistance = Math.abs(prediction - up);
                const upLeftDistance = Math.abs(prediction - upLeft);
                const predictor = leftDistance <= upDistance && leftDistance <= upLeftDistance
                    ? left
                    : upDistance <= upLeftDistance ? up : upLeft;
                value = raw + predictor;
            } else {
                throw new Error(`Unsupported PNG filter ${filter}`);
            }

            pixels[targetRowStart + targetX] = value & 255;
            if (bytesPerPixel === 3 && x % bytesPerPixel === 2) {
                pixels[targetRowStart + targetX + 1] = 255;
            }
        }

        sourceOffset += stride;
    }

    return { width, height, pixels };
}

/** Read one clamped RGBA pixel from a decoded PNG. */
export function pngPixelAt(png, x, y) {
    const clampedX = Math.min(png.width - 1, Math.max(0, Math.round(x)));
    const clampedY = Math.min(png.height - 1, Math.max(0, Math.round(y)));
    const offset = ((clampedY * png.width) + clampedX) * 4;
    return [
        png.pixels[offset],
        png.pixels[offset + 1],
        png.pixels[offset + 2],
        png.pixels[offset + 3],
    ];
}

/** Manhattan distance between two RGB colors. */
export function rgbDistance(left, right) {
    return Math.abs(left[0] - right[0])
        + Math.abs(left[1] - right[1])
        + Math.abs(left[2] - right[2]);
}
