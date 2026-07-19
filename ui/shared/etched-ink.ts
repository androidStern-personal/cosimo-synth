/**
 * Depth-stack engraving ("ink on paper") post-process — Phase-4 module-graphic
 * treatment (reference mockup: transient/DEPTHSTACK_LAB.html).
 *
 * The source canvas is treated as a grayscale ENERGY field (its luminance).
 * Ink is WITHHELD where energy burns hot: per pixel
 *   coverage = min(1, energy · inkDensity)
 *   density  = coverage · (1 − min(1, energy · exposure))^contrast
 * then density quantizes to 1-bit marks with an ordered dither (8×8 Bayer
 * stipple or a rotated line screen), rendered at grain-px cell size via a
 * low-res buffer and nearest-neighbor upscale so the grain reads intentional.
 *
 * TONAL MODEL (the critical inversion): low-but-nonzero energy prints DENSE
 * ink; brightness must be EARNED by energy. Hot cores withhold ink and let
 * the paper burn through as glow. Renderers that assume "more signal = more
 * marks" invert tonally — tests below the API pin this.
 *
 * Existing graphics keep 100% of their geometry/animation: host them on a
 * hidden canvas and run this pass over their output. A known flat background
 * (e.g. the wavetable display's hardcoded vertical gradient) is removed with
 * `backgroundKey` so covered-but-empty panel area stays clean paper.
 */

export type EtchedDither = "stipple" | "hatch" | "wash";

/** RGB triple 0..255. */
export type EtchedRGB = readonly [number, number, number];

/** Tunable parameters (defaults mirror the approved lab setup). */
export type EtchedInkParams = {
    /** Dither cell size in output px (low-res buffer scale). */
    readonly grainPx: number;
    /**
     * Pre-gain on source luminance. The lab painted its own field calibrated
     * to ~1.0 whites; existing renderers draw at subtle alphas, so their luma
     * needs amplification before the tonal model applies.
     */
    readonly energyGain: number;
    /** Luminance below this is treated as empty (kills key-out residue speckle). */
    readonly energyFloor: number;
    /** Coverage gain: how little energy it takes to consider a pixel "drawn". */
    readonly inkDensity: number;
    /** Burn-through gain: how fast hot energy withholds ink. */
    readonly exposure: number;
    /** Shaping power on the withheld term. */
    readonly contrast: number;
    readonly dither: EtchedDither;
    readonly hatchSpacingPx: number;
    readonly hatchAngleRad: number;
    /** Ink color (near-black; from the shell's ink token). */
    readonly ink: EtchedRGB;
    /**
     * Optional known vertical background gradient of the SOURCE to key out
     * (top→bottom RGB) so panel fill contributes zero energy.
     */
    readonly backgroundKey: { readonly top: EtchedRGB; readonly bottom: EtchedRGB } | null;
};

/** The approved lab defaults. */
export function createDefaultEtchedInkParams(): EtchedInkParams {
    return {
        grainPx: 2,
        energyGain: 2.4,
        energyFloor: 0.045,
        inkDensity: 14,
        exposure: 1.6,
        contrast: 1.25,
        dither: "stipple",
        hatchSpacingPx: 7,
        hatchAngleRad: (45 * Math.PI) / 180,
        ink: [34, 28, 19],
        backgroundKey: null,
    };
}

const BAYER_8 = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
] as const;

function luminance(r: number, g: number, b: number): number {
    return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
}

/**
 * The tonal core: energy → ink density (0..1), before dithering.
 *
 * @param energy - Normalized field energy at the pixel (0..1).
 * @param params - Treatment parameters.
 * @returns Ink density 0..1 (1 = certain mark).
 */
export function computeInkDensity(energy: number, params: EtchedInkParams): number {
    const raw = Math.min(1, Math.max(0, energy));
    if (raw < params.energyFloor) {
        return 0;
    }
    const amplified = Math.min(1, raw * params.energyGain);
    const coverage = Math.min(1, amplified * params.inkDensity);
    const withheld = Math.max(0, 1 - amplified * params.exposure);
    return coverage * Math.pow(withheld, params.contrast);
}

/**
 * Ordered-dither threshold (0..1) for a low-res buffer coordinate.
 *
 * @param x - Buffer x.
 * @param y - Buffer y.
 * @param params - Treatment parameters (dither style, hatch geometry).
 * @returns Threshold the density must exceed to place a mark.
 */
export function ditherThreshold(x: number, y: number, params: EtchedInkParams): number {
    if (params.dither === "hatch") {
        const spacing = Math.max(1, params.hatchSpacingPx);
        const v = x * Math.cos(params.hatchAngleRad) + y * Math.sin(params.hatchAngleRad);
        const t = (((v % spacing) + spacing) % spacing) / spacing;
        return Math.abs(t * 2 - 1);
    }
    const bayerIndex = (y & 7) * 8 + (x & 7);
    const bayerValue = BAYER_8[bayerIndex];
    return (bayerValue === undefined ? 0 : bayerValue) / 64;
}

/** A reusable pass instance (owns its low-res working buffer). */
export type EtchedInkPass = {
    /**
     * Composite the etched rendering of `source` onto `target`.
     * The caller paints the paper (and any solid vector chrome) itself;
     * this draws ONLY the ink marks, using alpha.
     */
    apply(
        source: CanvasImageSource & { width: number; height: number },
        target: CanvasRenderingContext2D,
        widthPx: number,
        heightPx: number,
    ): void;
    setParams(patch: Partial<EtchedInkParams>): void;
    getParams(): EtchedInkParams;
};

/**
 * Create an etched-ink post-process pass.
 *
 * @param initialParams - Starting parameters (lab defaults when omitted).
 * @returns The pass instance.
 */
export function createEtchedInkPass(initialParams: Partial<EtchedInkParams> = {}): EtchedInkPass {
    let params: EtchedInkParams = { ...createDefaultEtchedInkParams(), ...initialParams };
    const buffer = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const bufferContext = buffer?.getContext("2d", { willReadFrequently: true }) ?? null;

    return {
        apply(source, target, widthPx, heightPx) {
            if (buffer === null || bufferContext === null) {
                throw new Error("etched-ink requires a DOM canvas environment");
            }
            const scale = 1 / Math.max(1, params.grainPx);
            const bufferWidth = Math.max(1, Math.round(widthPx * scale));
            const bufferHeight = Math.max(1, Math.round(heightPx * scale));
            if (buffer.width !== bufferWidth || buffer.height !== bufferHeight) {
                buffer.width = bufferWidth;
                buffer.height = bufferHeight;
            }
            bufferContext.imageSmoothingEnabled = true;
            bufferContext.clearRect(0, 0, bufferWidth, bufferHeight);
            bufferContext.drawImage(source, 0, 0, bufferWidth, bufferHeight);

            const image = bufferContext.getImageData(0, 0, bufferWidth, bufferHeight);
            const data = image.data;
            const [inkR, inkG, inkB] = params.ink;
            const key = params.backgroundKey;

            for (let y = 0; y < bufferHeight; y += 1) {
                let keyLuma = 0;
                if (key !== null) {
                    const t = bufferHeight <= 1 ? 0 : y / (bufferHeight - 1);
                    keyLuma = luminance(
                        key.top[0] + (key.bottom[0] - key.top[0]) * t,
                        key.top[1] + (key.bottom[1] - key.top[1]) * t,
                        key.top[2] + (key.bottom[2] - key.top[2]) * t,
                    );
                }
                for (let x = 0; x < bufferWidth; x += 1) {
                    const index = (y * bufferWidth + x) * 4;
                    const r = data[index] ?? 0;
                    const g = data[index + 1] ?? 0;
                    const b = data[index + 2] ?? 0;
                    let energy = luminance(r, g, b);
                    if (key !== null) {
                        energy = keyLuma >= 1 ? 0 : Math.max(0, (energy - keyLuma) / (1 - keyLuma));
                    }
                    const density = computeInkDensity(energy, params);
                    let inkAlpha: number;
                    if (params.dither === "wash") {
                        inkAlpha = density * 0.85;
                    } else {
                        inkAlpha = density > ditherThreshold(x, y, params) ? 1 : 0;
                    }
                    data[index] = inkR;
                    data[index + 1] = inkG;
                    data[index + 2] = inkB;
                    data[index + 3] = Math.round(255 * inkAlpha);
                }
            }

            bufferContext.putImageData(image, 0, 0);
            const previousSmoothing = target.imageSmoothingEnabled;
            target.imageSmoothingEnabled = false;
            target.drawImage(buffer, 0, 0, bufferWidth, bufferHeight, 0, 0, widthPx, heightPx);
            target.imageSmoothingEnabled = previousSmoothing;
        },
        setParams(patch) {
            params = { ...params, ...patch };
        },
        getParams() {
            return params;
        },
    };
}
